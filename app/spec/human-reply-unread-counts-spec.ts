import SQLite from 'better-sqlite3';
import {
  DatabaseStore,
  ThreadCountsStore,
  CategoryStore,
  Folder,
  MailboxPerspective,
} from 'mailspring-exports';
import SidebarItem from '../internal_packages/account-sidebar/lib/sidebar-item';
import { HUMAN_REPLY_UNREAD_COUNTS_SQL } from '../src/human-reply-mailbox-query';

describe('Human reply unread counts', () => {
  let db;
  let originalCounts;
  let originalHumanCounts;
  beforeEach(() => {
    originalCounts = ThreadCountsStore._counts;
    originalHumanCounts = ThreadCountsStore._humanReplyUnreadCounts;
    db = new SQLite(':memory:');
    db.exec(`CREATE TABLE Thread (id TEXT, accountId TEXT, unread INTEGER, inAllMail INTEGER);
      CREATE TABLE Message (threadId TEXT, accountId TEXT, subject TEXT, draft INTEGER,
        unread INTEGER, remoteFolderId TEXT, data TEXT);
      CREATE INDEX MessageListThreadIndex ON Message(threadId);
      CREATE TABLE ThreadCategory (id TEXT, value TEXT);
      CREATE TABLE Folder (id TEXT, role TEXT);
      CREATE TABLE Label (id TEXT, role TEXT);
      INSERT INTO Folder VALUES ('inbox-a', 'inbox'), ('inbox-b', 'inbox');
      INSERT INTO Label VALUES ('label-inbox', 'inbox');`);
  });
  afterEach(() => {
    db.close();
    ThreadCountsStore._counts = originalCounts;
    ThreadCountsStore._humanReplyUnreadCounts = originalHumanCounts;
  });
  const add = (id, subject, overrides = {}) => {
    const row = {
      accountId: 'a',
      unread: 1,
      messageUnread: 1,
      inAllMail: 1,
      draft: 0,
      folder: 'inbox-a',
      category: 'inbox-a',
      labels: [],
      ...overrides,
    };
    db.prepare('INSERT INTO Thread VALUES (?, ?, ?, ?)').run(
      id,
      row.accountId,
      row.unread,
      row.inAllMail
    );
    db.prepare('INSERT INTO ThreadCategory VALUES (?, ?)').run(id, row.category);
    db.prepare('INSERT INTO Message VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id,
      row.accountId,
      subject,
      row.draft,
      row.messageUnread,
      row.folder,
      JSON.stringify({ labels: row.labels })
    );
  };
  const counts = () => db.prepare(HUMAN_REPLY_UNREAD_COUNTS_SQL).all();

  it('counts only unread human inbox conversations, once each and per account', () => {
    add('human-a', '回复：作品');
    add('human-b', '审稿结果', { accountId: 'b', folder: 'inbox-b', category: 'inbox-b' });
    ['自动回复：收到', 'AutoReply', 'AUTOREPLAY', 'rE: 投稿'].forEach((subject, i) =>
      add(`auto-${i}`, subject)
    );
    add('read', '已读回信', { unread: 0, messageUnread: 0 });
    add('sent', '稿件', { folder: 'sent' });
    add('draft', '草稿', { draft: 1 });
    add('spam', '垃圾邮件', { inAllMail: 0 });
    db.prepare('INSERT INTO Message SELECT * FROM Message WHERE threadId = ?').run('human-a');
    expect(counts()).toEqual([
      { accountId: 'a', unread: 1 },
      { accountId: 'b', unread: 1 },
    ]);
  });

  it('ignores unread automatic replies in a conversation whose human reply is already read', () => {
    add('mixed', '人工回复', { messageUnread: 0 });
    db.prepare(
      "INSERT INTO Message VALUES ('mixed', 'a', 'AutoReply', 0, 1, 'inbox-a', '{}')"
    ).run();
    expect(counts()).toEqual([]);
    db.prepare("UPDATE Message SET unread = 1 WHERE subject = '人工回复'").run();
    expect(counts()).toEqual([{ accountId: 'a', unread: 1 }]);
    db.prepare('UPDATE Message SET unread = 0').run();
    expect(counts()).toEqual([]);
  });

  it('counts label inboxes and excludes archived messages', () => {
    add('gmail', '回复：作品', {
      folder: 'all',
      category: 'label-inbox',
      labels: [{ id: 'label-inbox' }],
    });
    add('archived', '回复：归档', { folder: 'archive', category: 'archive' });
    expect(counts()).toEqual([{ accountId: 'a', unread: 1 }]);
  });

  it('refreshes badges even when ordinary inbox totals stay the same, and clears zero counts', async () => {
    const query = DatabaseStore._query as jasmine.Spy;
    query.andCallFake((sql) =>
      Promise.resolve(
        sql === HUMAN_REPLY_UNREAD_COUNTS_SQL
          ? [
              { accountId: 'a', unread: 2 },
              { accountId: 'b', unread: 3 },
            ]
          : []
      )
    );
    spyOn(ThreadCountsStore, 'trigger');
    await ThreadCountsStore._onCountsChanged();
    expect(ThreadCountsStore.humanReplyUnreadCountForAccountIds(['a', 'b'])).toBe(5);
    expect(ThreadCountsStore.humanReplyUnreadCountForAccountIds(['a', 'a'])).toBe(2);
    expect(ThreadCountsStore.humanReplyUnreadCountForAccountIds(['missing'])).toBe(0);
    expect(ThreadCountsStore.trigger).toHaveBeenCalled();
    const trigger = ThreadCountsStore.trigger as jasmine.Spy;
    trigger.reset();
    query.andReturn(Promise.resolve([]));
    await ThreadCountsStore._onCountsChanged();
    expect(ThreadCountsStore.humanReplyUnreadCountForAccountIds(['a', 'b'])).toBe(0);
    expect(trigger).toHaveBeenCalled();
  });

  it('displays the filtered counts on the parent and account sidebar items', () => {
    AppEnv.savedState.sidebarKeysCollapsed = {};
    const folders = ['a', 'b'].map(
      (id) => new Folder({ id: `inbox-${id}`, accountId: id, role: 'inbox', path: 'INBOX' })
    );
    spyOn(CategoryStore, 'getCategoriesWithRoles').andCallFake((ids) =>
      folders.filter((folder) => ids.includes(folder.accountId))
    );
    ThreadCountsStore._humanReplyUnreadCounts = { a: 2, b: 3 };
    expect(MailboxPerspective.forHumanReplies(['a', 'b']).unreadCount()).toBe(5);
    expect(SidebarItem.forHumanReplies(['a', 'b']).count).toBe(5);
    expect(SidebarItem.forHumanReplies(['a'], { name: 'Account A' }).count).toBe(2);
    expect(SidebarItem.forHumanReplies(['b'], { name: 'Account B' }).count).toBe(3);
  });
});
