import { DEFAULT_REPLY_EXCLUSIONS } from './reply-subject-policy';

const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;

function conditionsForInboxSQL(inboxIdsSQL: string) {
  const allowedSubject = DEFAULT_REPLY_EXCLUSIONS.map(
    (keyword) => `instr(lower(COALESCE(m.subject, '')), ${quote(keyword.toLowerCase())}) = 0`
  ).join(' AND ');
  return `m.draft = 0 AND ${allowedSubject}
    AND (m.remoteFolderId IN (${inboxIdsSQL}) OR EXISTS (
      SELECT 1 FROM json_each(m.data, '$.labels') label
      WHERE json_extract(label.value, '$.id') IN (${inboxIdsSQL})
    ))`;
}

export function humanReplyMessageConditionsSQL(categoryIds: string[]) {
  return conditionsForInboxSQL(categoryIds.map(quote).join(','));
}

// Start from the small indexed set of unread conversations, then check actual
// unread inbox messages. An unread auto-reply must not count a read human reply.
export const HUMAN_REPLY_UNREAD_COUNTS_SQL = `SELECT Thread.accountId, COUNT(*) AS unread
  FROM Thread
  WHERE Thread.unread = 1 AND Thread.inAllMail = 1
  AND EXISTS (
    SELECT 1 FROM ThreadCategory category
    WHERE category.id = Thread.id AND category.value IN (
      SELECT id FROM Folder WHERE role = 'inbox'
      UNION SELECT id FROM Label WHERE role = 'inbox'
    )
  )
  AND EXISTS (
    SELECT 1 FROM Message m INDEXED BY MessageListThreadIndex
    WHERE m.threadId = Thread.id AND m.accountId = Thread.accountId AND m.unread = 1
    AND ${conditionsForInboxSQL("SELECT id FROM Folder WHERE role = 'inbox' UNION SELECT id FROM Label WHERE role = 'inbox'")}
  )
  GROUP BY Thread.accountId`;
