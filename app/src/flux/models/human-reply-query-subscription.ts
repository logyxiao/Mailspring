import { Matcher } from '../attributes/matcher';
import { MutableQuerySubscription } from './mutable-query-subscription';
import { Thread } from './thread';
import { Message } from './message';
import { Model } from './model';
import DatabaseStore from '../stores/database-store';
import { DatabaseChangeRecord } from '../stores/database-change-record';
import { humanReplyMessageConditionsSQL } from '../../human-reply-mailbox-query';

// Thread subjects can omit Re: or come from an earlier sent message. Check the
// original subject of an actual inbox message, not the conversation title.
export class HumanReplyMatcher extends Matcher {
  constructor(private categoryIds: string[]) {
    super(Thread.attributes.subject);
  }

  whereSQL() {
    return `EXISTS (SELECT 1 FROM Message m INDEXED BY MessageListThreadIndex
      WHERE m.threadId = Thread.id AND m.accountId = Thread.accountId
      AND ${this.messageConditionsSQL()})`;
  }

  messageConditionsSQL() {
    return humanReplyMessageConditionsSQL(this.categoryIds);
  }

  evaluate() {
    // Thread-list focus checks only have thread metadata. As with search
    // matchers, let the database subscription determine actual membership.
    return true;
  }
}

export default class HumanReplyQuerySubscription extends MutableQuerySubscription<Thread> {
  private refreshTimer: ReturnType<typeof setTimeout>;
  private disposed = false;

  constructor(private categoryIds: string[]) {
    super(
      DatabaseStore.findAll<Thread>(Thread)
        .where([
          Thread.attributes.categories.containsAny(categoryIds),
          Thread.attributes.inAllMail.equal(true),
          new HumanReplyMatcher(categoryIds),
        ])
        .limit(0),
      // Use indexed, paged local queries. The packaged app's legacy background
      // query agent may exit without resolving its pending requests.
      { emitResultSet: true }
    );
  }

  async _fetchMissingModels() {
    const missing = await super._fetchMissingModels();
    const models = [...(this._set ? this._set.models() : []), ...missing];
    if (!models.length) return [];
    const rows = await DatabaseStore._query(
      `SELECT m.threadId, m.subject, json_extract(m.data, '$.snippet') AS snippet
       FROM Message m INDEXED BY MessageListThreadIndex
       WHERE m.threadId IN (${models.map(() => '?').join(',')})
       AND ${new HumanReplyMatcher(this.categoryIds).messageConditionsSQL()}
       ORDER BY m.date DESC, m.id DESC`,
      models.map((model) => model.id)
    );
    const previews = new Map<string, { subject: string; snippet: string }>();
    for (const row of rows) {
      if (!previews.has(row.threadId)) {
        previews.set(row.threadId, { subject: row.subject, snippet: row.snippet });
      }
    }
    return models.map((model) => {
      const copy = model.clone();
      // Display-only metadata is not a model attribute and never persists.
      copy.humanReplyPreview = previews.get(model.id);
      return copy;
    });
  }

  applyChangeRecord = (record: DatabaseChangeRecord<Model>) => {
    if (this.disposed || ![Thread.name, Message.name].includes(record.objectClass)) return;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.cancelPendingUpdate();
      // Reload models too: IDs may be unchanged after a read/star/subject update.
      this._set = null;
      this.update({ mustRefetchEntireRange: true });
    }, 100);
  };

  onLastCallbackRemoved() {
    this.disposed = true;
    clearTimeout(this.refreshTimer);
    this.cancelPendingUpdate();
  }
}
