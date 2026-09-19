import { SENT_RECIPIENT_QUERY } from './sent-recipient-export';

export const DEFAULT_REPLY_EXCLUSIONS = ['自动回复', 'AutoReply', 'AutoReplay', 'Re:'];

export interface ReplyReportMessage {
  id: string;
  accountId: string;
  accountEmail: string;
  sent: boolean;
  subject: string;
  timestamp: number | null;
  from: string[];
  recipients: string[];
  headerId: string;
  inReplyTo: string;
  references: string[];
}

export type ReplyMatchMethod = 'header' | 'subject' | 'article';
export interface MatchedHumanReply {
  sent: ReplyReportMessage;
  reply: ReplyReportMessage;
  correspondent: string;
  elapsedSeconds: number;
  weekdaySeconds: number;
  method: ReplyMatchMethod;
  first: boolean;
}

export type UnmatchedReplyReason = 'ambiguous' | 'no-match' | 'invalid-date' | 'multiple-senders';
export interface UnmatchedHumanReply {
  reply: ReplyReportMessage;
  reason: UnmatchedReplyReason;
}

export interface HumanReplyReport {
  matches: MatchedHumanReply[];
  unmatched: UnmatchedHumanReply[];
  excludedCount: number;
  sentCount: number;
  receivedCount: number;
  ignoredCount: number;
  firstReplyCount: number;
  averageSeconds: number | null;
  medianSeconds: number | null;
  exclusions: string[];
  multipleSendingAccountsOnly?: boolean;
  singleAccountEmailCount?: number;
  singleAccountReplyCount?: number;
  filteredUnmatchedCount?: number;
}

const address = (value: string) => value.trim().toLowerCase();
const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim();
const headerId = (value: string) => (value || '').trim().replace(/^<|>$/g, '');
const key = (...parts: string[]) => JSON.stringify(parts);
const subjectKey = (value: string) =>
  normalize(value || '')
    .replace(/^(?:(?:re|fw|fwd|回复|回覆|答复|转发)\s*:\s*)+/i, '')
    .toLowerCase();
const validTime = (value: number | null) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export function weekdayElapsedSeconds(startSeconds: number, endSeconds: number) {
  if (!validTime(startSeconds) || !validTime(endSeconds) || endSeconds < startSeconds) return null;
  let cursor = startSeconds * 1000;
  const end = endSeconds * 1000;
  let elapsed = 0;
  while (cursor < end) {
    const day = new Date(cursor);
    const next = new Date(cursor);
    next.setHours(24, 0, 0, 0);
    const boundary = Math.min(end, next.getTime());
    if (day.getDay() !== 0 && day.getDay() !== 6) elapsed += boundary - cursor;
    cursor = boundary;
  }
  return elapsed / 1000;
}

function bracketedTitle(subject: string) {
  const titles = [
    ...new Set([...normalize(subject).matchAll(/《([^《》]+)》/g)].map((m) => m[1].trim())),
  ];
  return titles.length === 1 ? titles[0].toLowerCase() : '';
}

export function isExcludedReplySubject(subject: string, exclusions = DEFAULT_REPLY_EXCLUSIONS) {
  const lower = (subject || '').toLowerCase();
  return exclusions.some((value) => value.trim() && lower.includes(value.trim().toLowerCase()));
}

export function analyzeHumanReplies(
  input: ReplyReportMessage[],
  exclusions = DEFAULT_REPLY_EXCLUSIONS,
  ownAliases: string[] = []
): HumanReplyReport {
  const ownAddresses = new Set([...input.map((m) => m.accountEmail), ...ownAliases].map(address));
  const unique = new Map<string, ReplyReportMessage>();
  for (const message of input) {
    // IMAP labels/folders may expose copies of the same message. Header IDs
    // are scoped to the account; copies never create additional samples.
    const identity = key(message.accountId, headerId(message.headerId) || message.id);
    if (!unique.has(identity) || message.sent) unique.set(identity, message);
  }
  const messages = [...unique.values()];
  const sent = messages.filter((m) => m.sent);
  const received = messages.filter(
    (m) => !m.sent && !m.from.some((email) => ownAddresses.has(address(email)))
  );
  const knownTitles = [...new Set(sent.map((m) => bracketedTitle(m.subject)).filter(Boolean))];
  const article = (subject: string) => {
    const explicit = bracketedTitle(subject);
    if (explicit || /[《》]/.test(subject)) return explicit;
    const text = subjectKey(subject);
    const matches = knownTitles.filter((title) => {
      const index = text.indexOf(title);
      if (index < 0) return false;
      const before = text.slice(0, index);
      const after = text.slice(index + title.length);
      return (
        (!before || /[\s_+|·•—–:：/-]$/.test(before) || /投稿$/.test(before)) &&
        (!after || /^[\s_+|·•—–:：/-]/.test(after) || /^(短篇|投稿)/.test(after))
      );
    });
    return matches.length === 1 ? matches[0] : '';
  };
  const byHeader = new Map<string, ReplyReportMessage[]>();
  const bySubject = new Map<string, ReplyReportMessage[]>();
  const byArticle = new Map<string, ReplyReportMessage[]>();
  const correspondents = new Set<string>();
  const add = (map: Map<string, ReplyReportMessage[]>, k: string, m: ReplyReportMessage) => {
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(m);
  };
  for (const m of messages) {
    if (m.headerId) add(byHeader, key(m.accountId, headerId(m.headerId)), m);
  }
  for (const m of sent) {
    for (const email of new Set(m.recipients.map(address).filter(Boolean))) {
      correspondents.add(key(m.accountId, email));
      if (subjectKey(m.subject)) add(bySubject, key(m.accountId, email, subjectKey(m.subject)), m);
      const title = article(m.subject);
      if (title) add(byArticle, key(m.accountId, email, title), m);
    }
  }

  // Follow explicit reply ancestry, including an intervening automated reply.
  // References are ordered oldest-to-newest; the closest known ancestor wins.
  const findHeaderAncestor = (reply: ReplyReportMessage) => {
    let current = reply;
    const visited = new Set<string>([reply.id]);
    for (let depth = 0; depth < 30; depth++) {
      const ids = [current.inReplyTo, ...current.references.slice().reverse()]
        .map(headerId)
        .filter(Boolean);
      let parent: ReplyReportMessage;
      for (const id of ids) {
        const candidates = byHeader.get(key(reply.accountId, id)) || [];
        if (candidates.length === 1) {
          [parent] = candidates;
          break;
        }
      }
      if (!parent || visited.has(parent.id)) return null;
      if (parent.sent) return parent;
      visited.add(parent.id);
      current = parent;
    }
    return null;
  };

  const matches: MatchedHumanReply[] = [];
  const unmatched: UnmatchedHumanReply[] = [];
  const firstPairs = new Set<string>();
  let excludedCount = 0;
  let ignoredCount = 0;
  received.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0) || a.id.localeCompare(b.id));
  for (const reply of received) {
    if (isExcludedReplySubject(reply.subject, exclusions)) {
      excludedCount++;
      continue;
    }
    const senders = [...new Set(reply.from.map(address).filter(Boolean))];
    const hasReference = Boolean(reply.inReplyTo || reply.references.length);
    const replyLike = /^(回复|回覆|答复|re)\s*[:：]/i.test(reply.subject.trim());
    if (
      !senders.some((email) => correspondents.has(key(reply.accountId, email))) &&
      !hasReference &&
      !replyLike
    ) {
      ignoredCount++;
      continue;
    }
    const reject = (reason: UnmatchedReplyReason) => unmatched.push({ reply, reason });
    if (senders.length !== 1) {
      reject('multiple-senders');
      continue;
    }
    const [correspondent] = senders;
    if (!validTime(reply.timestamp)) {
      reject('invalid-date');
      continue;
    }
    let source = findHeaderAncestor(reply);
    let method: ReplyMatchMethod = 'header';
    if (!source) {
      const exact =
        bySubject.get(key(reply.accountId, correspondent, subjectKey(reply.subject))) || [];
      const title = article(reply.subject);
      const related = byArticle.get(key(reply.accountId, correspondent, title)) || [];
      const choose = (candidates: ReplyReportMessage[]) =>
        candidates.filter((m) => validTime(m.timestamp) && m.timestamp <= reply.timestamp);
      let candidates = choose(exact);
      method = 'subject';
      if (!candidates.length) {
        candidates = choose(related);
        method = 'article';
      }
      if (candidates.length > 1) {
        reject('ambiguous');
        continue;
      }
      if (!candidates.length) {
        reject(exact.length || related.length ? 'invalid-date' : 'no-match');
        continue;
      }
      [source] = candidates;
    }
    if (!validTime(source.timestamp) || source.timestamp > reply.timestamp) {
      reject('invalid-date');
      continue;
    }
    const pair = key(source.accountId, source.id, correspondent);
    matches.push({
      sent: source,
      reply,
      correspondent,
      elapsedSeconds: reply.timestamp - source.timestamp,
      weekdaySeconds: weekdayElapsedSeconds(source.timestamp, reply.timestamp),
      method,
      first: !firstPairs.has(pair),
    });
    firstPairs.add(pair);
  }
  const durations = matches
    .filter((m) => m.first)
    .map((m) => m.elapsedSeconds)
    .sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  return {
    matches,
    unmatched,
    excludedCount,
    ignoredCount,
    sentCount: sent.length,
    receivedCount: received.length,
    firstReplyCount: durations.length,
    averageSeconds: durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null,
    medianSeconds: durations.length
      ? (durations[middle] + durations[Math.floor((durations.length - 1) / 2)]) / 2
      : null,
    exclusions: exclusions.filter((s) => s.trim()),
  };
}

export const REPLY_REPORT_QUERY = `SELECT m.id, m.accountId, m.data,
  CASE WHEN sent.id IS NULL THEN 0 ELSE 1 END AS isSent
  FROM Message m LEFT JOIN (${SENT_RECIPIENT_QUERY}) sent ON sent.id = m.id
  WHERE m.draft = 0`;

export function keepMultiAccountReplyEmails(report: HumanReplyReport): HumanReplyReport {
  if (report.multipleSendingAccountsOnly) return report;
  const sendingEmails = new Map<string, Set<string>>();
  for (const match of report.matches) {
    const email = address(match.correspondent);
    if (!sendingEmails.has(email)) sendingEmails.set(email, new Set());
    const sender = address(match.sent.accountEmail);
    if (sender) sendingEmails.get(email).add(sender);
  }
  const eligible = new Set(
    [...sendingEmails].filter(([, senders]) => senders.size >= 2).map(([email]) => email)
  );
  const matches = report.matches.filter((m) => eligible.has(address(m.correspondent)));
  // Apply the same scope to the unpaired sheet so excluded correspondents'
  // private message contents do not reappear there.
  const unmatched = report.unmatched.filter((m) => {
    const senders = [...new Set(m.reply.from.map(address).filter(Boolean))];
    return senders.length === 1 && eligible.has(senders[0]);
  });
  const durations = matches
    .filter((m) => m.first)
    .map((m) => m.elapsedSeconds)
    .sort((a, b) => a - b);
  return {
    ...report,
    matches,
    unmatched,
    firstReplyCount: durations.length,
    averageSeconds: durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null,
    medianSeconds: durations.length
      ? (durations[Math.floor(durations.length / 2)] +
          durations[Math.floor((durations.length - 1) / 2)]) /
        2
      : null,
    multipleSendingAccountsOnly: true,
    singleAccountEmailCount: sendingEmails.size - eligible.size,
    singleAccountReplyCount: report.matches.length - matches.length,
    filteredUnmatchedCount: report.unmatched.length - unmatched.length,
  };
}

export function replyMessageFromRow(
  row: { id: string; accountId: string; data: string; isSent: number },
  accountEmail: string
): ReplyReportMessage {
  const data = JSON.parse(row.data);
  const emails = (contacts) => (contacts || []).map((c) => c.email || '').filter(Boolean);
  const extra = Object.fromEntries(
    Object.entries(data.extraHeaders || {}).map(([k, v]) => [k.toLowerCase(), v])
  );
  const references = String(extra.references || '').match(/<[^>]+>/g) || [];
  const inReplyTo = data.rthMsgId || extra['in-reply-to'] || '';
  return {
    id: row.id,
    accountId: row.accountId,
    accountEmail,
    sent: Boolean(row.isSent),
    subject: data.subject || '',
    timestamp: typeof data.date === 'number' ? data.date : null,
    from: emails(data.from),
    recipients: [...emails(data.to), ...emails(data.cc), ...emails(data.bcc)],
    headerId: data.hMsgId || '',
    inReplyTo: String(inReplyTo),
    references,
  };
}
