import { Message, Thread } from 'mailspring-exports';
import { ChangeUnreadTask } from '../src/flux/tasks/change-unread-task';

describe('ChangeMailTask sync-engine serialization', () => {
  const message = new Message({ id: 'message-a', threadId: 'thread-a', accountId: 'account-a' });

  it('omits the empty thread selector for a message-scoped task', () => {
    const task = new ChangeUnreadTask({ messages: [message], unread: false });
    const wire = JSON.parse(JSON.stringify(task));
    expect(wire.messageIds).toEqual(['message-a']);
    expect(Object.prototype.hasOwnProperty.call(wire, 'threadIds')).toBe(false);
    expect(task.threadIds).toEqual([]);
  });

  it('preserves the thread selector for a thread-scoped task', () => {
    const thread = new Thread({ id: 'thread-a', accountId: 'account-a' });
    const task = new ChangeUnreadTask({ threads: [thread], unread: false });
    expect(JSON.parse(JSON.stringify(task)).threadIds).toEqual(['thread-a']);
  });

  it('keeps message scoping through IPC deserialization and undo', () => {
    const task = new ChangeUnreadTask({ messages: [message], unread: false });
    const restored = new ChangeUnreadTask().fromJSON(JSON.parse(JSON.stringify(task)));
    const undo = restored.createUndoTask();
    for (const item of [restored, undo]) {
      const wire = JSON.parse(JSON.stringify(item));
      expect(wire.messageIds).toEqual(['message-a']);
      expect(Object.prototype.hasOwnProperty.call(wire, 'threadIds')).toBe(false);
    }
    expect(undo.unread).toBe(true);
  });
});
