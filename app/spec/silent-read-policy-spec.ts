import { Actions, Message, MailRulesStore } from 'mailspring-exports';
import { shouldSilentlyReadSubject } from '../src/silent-read-policy';
import { Notifier } from '../internal_packages/unread-notifications/lib/main';
import { ChangeUnreadTask } from '../src/flux/tasks/change-unread-task';

describe('Silent read subject policy', () => {
  let previousSince: number;
  let notifier: Notifier;

  beforeEach(() => {
    AppEnv.config.set('core.reading.silentReadSubjectKeywords', ['自动回复', 'AutoReply']);
    previousSince = MailRulesStore._autoSince;
    MailRulesStore._autoSince = Date.now() - 10000;
    spyOn(Actions, 'queueTask');
    notifier = new Notifier();
    spyOn(notifier, '_onNewMessagesReceived').andReturn(Promise.resolve());
  });

  afterEach(() => {
    MailRulesStore._autoSince = previousSince;
    notifier.unlisten();
  });

  const message = (id: string, subject: string, accountId = 'account-a') =>
    new Message({
      id,
      subject,
      accountId,
      threadId: 'shared-thread',
      unread: true,
      draft: false,
      date: new Date(),
      from: [],
    });

  const headers = (messages: Message[]) => ({
    type: 'persist' as const,
    objectClass: Message.name,
    objects: messages,
    objectsRawJSON: messages.map((m) => ({ id: m.id, headersSyncComplete: true })),
  });

  it('matches either keyword anywhere in the subject, ignoring English case', () => {
    for (const subject of [
      '自动回复：已收到',
      'Re: AutoReply: Thanks',
      '通知 autoreply',
      'AUTOREPLY',
    ]) {
      expect(shouldSilentlyReadSubject(subject)).toBe(true);
    }
    for (const subject of ['回复：审核结果', 'Your reply', '', null, undefined]) {
      expect(shouldSilentlyReadSubject(subject)).toBe(false);
    }
  });

  it('does not match every message when the keyword list is empty or contains blanks', () => {
    AppEnv.config.set('core.reading.silentReadSubjectKeywords', [' ', '']);
    expect(shouldSilentlyReadSubject('普通邮件')).toBe(false);
    AppEnv.config.set('core.reading.silentReadSubjectKeywords', []);
    expect(shouldSilentlyReadSubject('AutoReply')).toBe(false);
  });

  it('marks only matching messages read before bodies arrive, across accounts', () => {
    MailRulesStore._onDatabaseChanged(
      headers([
        message('automatic-a', '自动回复'),
        message('ordinary', '人工回复'),
        message('automatic-b', 'AutoReply', 'account-b'),
      ]) as any
    );
    const calls = (Actions.queueTask as any).calls;
    expect(calls.length).toBe(2);
    for (const [index, id] of ['automatic-a', 'automatic-b'].entries()) {
      const task = calls[index].args[0];
      expect(task instanceof ChangeUnreadTask).toBe(true);
      expect(task.messageIds).toEqual([id]);
      expect(task.threadIds).toEqual([]);
      expect(task.unread).toBe(false);
      expect(task.canBeUndone).toBe(false);
      expect(task.accountId).toBe(index === 0 ? 'account-a' : 'account-b');
    }
  });

  it('still marks matches read when desktop notifications are disabled', () => {
    AppEnv.config.set('core.notifications.enabled', false);
    MailRulesStore._onDatabaseChanged(headers([message('a', 'AutoReply')]) as any);
    expect(Actions.queueTask).toHaveBeenCalled();
  });

  it('ignores drafts, already-read messages, old mail and subsequent updates', () => {
    const draft = message('draft', 'AutoReply');
    draft.draft = true;
    const read = message('read', 'AutoReply');
    read.unread = false;
    const old = message('old', 'AutoReply');
    old.date = new Date(2000, 0, 1);
    MailRulesStore._onDatabaseChanged(headers([draft, read, old]) as any);
    const update = headers([message('updated', 'AutoReply')]);
    update.objectsRawJSON[0].headersSyncComplete = false;
    MailRulesStore._onDatabaseChanged(update as any);
    expect(Actions.queueTask).not.toHaveBeenCalled();
  });

  it('suppresses notification handling even while matching messages remain unread', async () => {
    const messages = [message('a', '自动回复'), message('b', 'aUtOrEpLy')];
    await notifier._onMessagesChanged(messages, new Set(messages.map((m) => m.id)));
    expect(notifier._onNewMessagesReceived).not.toHaveBeenCalled();
    expect(notifier.unnotifiedQueue).toEqual([]);
  });

  it('preserves ordinary mail notifications in a mixed batch', async () => {
    const automatic = message('a', 'AutoReply');
    const ordinary = message('b', '人工回复：稿件通过');
    await notifier._onMessagesChanged([automatic, ordinary], new Set(['a', 'b']));
    expect(notifier._onNewMessagesReceived).toHaveBeenCalledWith([ordinary]);
  });
});
