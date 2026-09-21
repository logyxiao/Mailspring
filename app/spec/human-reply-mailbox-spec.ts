import SQLite from 'better-sqlite3';
import {
  CategoryStore,
  Account,
  DatabaseStore,
  Folder,
  MailboxPerspective,
  Message,
  Thread,
} from 'mailspring-exports';
import SidebarSection from '../internal_packages/account-sidebar/lib/sidebar-section';
import HumanReplyQuerySubscription, {
  HumanReplyMatcher,
} from '../src/flux/models/human-reply-query-subscription';

describe('Human reply mailbox', () => {
  let db;
  beforeEach(() => {
    db = new SQLite(':memory:');
    db.exec(`CREATE TABLE Thread (id TEXT, accountId TEXT);
      CREATE TABLE Message (threadId TEXT, accountId TEXT, subject TEXT,
        draft INTEGER, remoteFolderId TEXT, data TEXT);
      CREATE INDEX MessageListThreadIndex ON Message(threadId);`);
  });
  afterEach(() => db.close());

  const add = (id: string, subject: string, folder = 'inbox', options = {}) => {
    const m = { account: 'a', draft: 0, labels: [], ...options };
    db.prepare('INSERT INTO Thread VALUES (?, ?)').run(id, m.account);
    db.prepare('INSERT INTO Message VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      m.account,
      subject,
      m.draft,
      folder,
      JSON.stringify({ labels: m.labels })
    );
  };
  const results = (ids = ['inbox']) =>
    db
      .prepare(`SELECT id FROM Thread WHERE ${new HumanReplyMatcher(ids).whereSQL()} ORDER BY id`)
      .all()
      .map((row) => row.id);

  it('filters original subjects, case insensitively, while retaining normal Chinese replies', () => {
    ['自动回复：收到', 'AutoReply notice', 'autoreplay notice', 'rE: 投稿'].forEach((s, i) =>
      add(`auto${i}`, s)
    );
    add('human', '回复：作品');
    add('normal', '审核结果');
    add('empty', null);
    expect(results()).toEqual(['empty', 'human', 'normal']);
  });

  it('requires a non-draft inbox message and supports label-based inboxes', () => {
    add('sent', '稿件', 'sent');
    add('spam', '稿件', 'spam');
    add('trash', '稿件', 'trash');
    add('draft', '稿件', 'inbox', { draft: 1 });
    add('other-account', '稿件', 'other-inbox', { account: 'b' });
    add('gmail', '人工回复', 'all', { labels: [{ id: 'inbox' }] });
    expect(results()).toEqual(['gmail']);
    expect(results(['other-inbox'])).toEqual(['other-account']);
  });

  it('does not let an earlier sent message admit a Re reply; admits a mixed thread only when it has a qualifying inbox message', () => {
    add('mixed', 'Re: 作品');
    db.prepare('INSERT INTO Message VALUES (?, ?, ?, 0, ?, ?)').run(
      'mixed',
      'a',
      '作品',
      'sent',
      '{}'
    );
    expect(results()).toEqual([]);
    db.prepare('INSERT INTO Message VALUES (?, ?, ?, 0, ?, ?)').run(
      'mixed',
      'a',
      '回复：作品',
      'inbox',
      '{}'
    );
    expect(results()).toEqual(['mixed']);
    expect(results(["inbox' OR 1=1 --"])).toEqual([]);
  });

  it('restores the virtual mailbox and hides excluded messages without changing the inbox view', () => {
    const inbox = new Folder({ id: 'inbox', accountId: 'a', role: 'inbox', path: 'INBOX' });
    spyOn(CategoryStore, 'getCategoriesWithRoles').andReturn([inbox]);
    const perspective = MailboxPerspective.forHumanReplies(['a']);
    expect(perspective.name).toBe('Human Replies');
    expect(MailboxPerspective.fromJSON(perspective.toJSON()).isEqual(perspective)).toBe(true);
    expect(perspective.canReceiveThreadsFromAccountIds()).toBe(false);
    const messages = [new Message({ subject: 'Re: 作品' }), new Message({ subject: '回复：作品' })];
    expect(perspective.filterMessages(messages)).toEqual([messages[1]]);
    expect(MailboxPerspective.forInbox(['a']).filterMessages(messages)).toEqual(messages);
  });

  it('places Human Replies below Inbox with one child per account', () => {
    AppEnv.savedState.sidebarKeysCollapsed = {};
    const accounts = ['a', 'b'].map(
      (id) => new Account({ id, emailAddress: `${id}@qq.com`, provider: 'imap' })
    );
    const folders = accounts.map(
      (account) =>
        new Folder({
          id: `inbox-${account.id}`,
          accountId: account.id,
          role: 'inbox',
          path: 'INBOX',
        })
    );
    spyOn(CategoryStore, 'categories').andReturn(folders);
    spyOn(CategoryStore, 'getCategoriesWithRoles').andCallFake((values, ...roles) =>
      folders.filter(
        (folder) =>
          roles.includes(folder.role) && values.some((a) => (a.id || a) === folder.accountId)
      )
    );
    spyOn(CategoryStore, 'getCategoryByRole').andCallFake((account, role) =>
      folders.find((folder) => folder.accountId === (account.id || account) && folder.role === role)
    );
    const section = SidebarSection.standardSectionForAccounts(accounts);
    expect(section.items[0].perspective.categoriesSharedRole()).toBe('inbox');
    const item = section.items[1];
    expect(item.name).toBe('Human Replies');
    expect(item.perspective.accountIds).toEqual(['a', 'b']);
    expect(item.children.map((child) => child.perspective.accountIds)).toEqual([['a'], ['b']]);
    expect(item.children.map((child) => child.name)).toEqual(
      accounts.map((account) => account.label)
    );
    expect(new Set([item.id, ...item.children.map((child) => child.id)]).size).toBe(3);
  });

  it('refreshes on message changes and cancels pending refreshes when leaving', () => {
    // Construction starts a database query, so suppress it for this lifecycle test.
    spyOn(HumanReplyQuerySubscription.prototype, 'update');
    const actual = new HumanReplyQuerySubscription(['inbox']);
    expect(actual.query().clone().limit(50).sql()).toContain('EXISTS (SELECT 1 FROM Message');
    expect(actual.query()._background).toBe(false);
    expect(actual.query().clone().limit(50).sql()).toContain('INDEXED BY MessageListThreadIndex');
    spyOn(actual, 'cancelPendingUpdate');
    const update = HumanReplyQuerySubscription.prototype.update as any;
    update.reset();
    actual._set = {} as any;
    actual.applyChangeRecord({ objectClass: 'Message' } as any);
    advanceClock(150);
    expect(actual._set).toBe(null);
    expect(update).toHaveBeenCalledWith({ mustRefetchEntireRange: true });
    update.reset();
    actual.applyChangeRecord({ objectClass: 'Thread' } as any);
    actual.onLastCallbackRemoved();
    advanceClock(150);
    expect(update).not.toHaveBeenCalled();
  });

  it('shows the qualifying message subject without changing persisted thread data', async () => {
    spyOn(HumanReplyQuerySubscription.prototype, 'update');
    const subscription = new HumanReplyQuerySubscription(['inbox']);
    const thread = new Thread({ id: 'mixed', subject: '自动回复：旧标题' });
    subscription._set = {
      ids: () => ['mixed'],
      modelWithId: () => thread,
      models: () => [thread],
    } as any;
    (DatabaseStore._query as jasmine.Spy).andReturn(
      Promise.resolve([
        { threadId: 'mixed', subject: '回复：新标题', snippet: '审核结果' },
        { threadId: 'mixed', subject: '更早的标题', snippet: '早前消息' },
      ])
    );
    const models = await subscription._fetchMissingModels();
    expect(models[0].humanReplyPreview.subject).toBe('回复：新标题');
    expect(models[0].subject).toBe(thread.subject);
    expect(models[0].toJSON().humanReplyPreview).toBe(undefined);
    expect(thread.humanReplyPreview).toBe(undefined);
    subscription.onLastCallbackRemoved();
  });
});
