import _ from 'underscore';
import MailspringStore from 'mailspring-store';
import DatabaseStore from './database-store';
import { Thread } from '../models/thread';
import { HUMAN_REPLY_UNREAD_COUNTS_SQL } from '../../human-reply-mailbox-query';

interface ThreadCountRow {
  categoryId: string;
  unread: number;
  total: number;
}

class ThreadCountsStore extends MailspringStore {
  _counts = {};
  _humanReplyUnreadCounts: Record<string, number> = {};

  constructor() {
    super();

    if (AppEnv.isMainWindow()) {
      // For now, unread counts are only retrieved in the main window.
      const onCountsChangedDebounced = _.throttle(this._onCountsChanged, 1000);
      DatabaseStore.listen((change) => {
        if ([Thread.name, 'Message', 'Folder', 'Label'].includes(change.objectClass)) {
          onCountsChangedDebounced();
        }
      });
      onCountsChangedDebounced();
    }
  }

  _onCountsChanged = async () => {
    try {
      const [results, humanReplyResults] = await Promise.all([
        DatabaseStore._query('SELECT * FROM `ThreadCounts`'),
        DatabaseStore._query(HUMAN_REPLY_UNREAD_COUNTS_SQL),
      ]);
      const nextCounts = {};
      for (const { categoryId, unread, total } of results as ThreadCountRow[]) {
        nextCounts[categoryId] = { unread, total };
      }
      const nextHumanReplyCounts: Record<string, number> = {};
      for (const { accountId, unread } of humanReplyResults) {
        nextHumanReplyCounts[accountId] = unread;
      }
      if (
        _.isEqual(nextCounts, this._counts) &&
        _.isEqual(nextHumanReplyCounts, this._humanReplyUnreadCounts)
      ) {
        return;
      }
      this._counts = nextCounts;
      this._humanReplyUnreadCounts = nextHumanReplyCounts;
      this.trigger();
    } catch (error) {
      AppEnv.reportError(error);
    }
  };

  humanReplyUnreadCountForAccountIds(accountIds: string[]) {
    return [...new Set(accountIds)].reduce(
      (sum, accountId) => sum + (this._humanReplyUnreadCounts[accountId] || 0),
      0
    );
  }

  unreadCountForCategoryId(catId: string) {
    if (this._counts[catId] === undefined) {
      return null;
    }
    return this._counts[catId]['unread'];
  }

  totalCountForCategoryId(catId: string) {
    if (this._counts[catId] === undefined) {
      return null;
    }
    return this._counts[catId]['total'];
  }
}

export default new ThreadCountsStore();
