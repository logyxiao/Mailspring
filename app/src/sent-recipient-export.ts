// Shared by the in-app exporter and offline reports. No mailbox/UI state is
// consulted here: the caller supplies a snapshot of every selected account.
export interface SentRecipientRecord {
  id: string;
  accountId: string;
  sender: string;
  subject: string;
  to: string[];
  cc: string[];
  bcc: string[];
}

export interface SentRecipientGroup {
  title: string;
  recognized: boolean;
  recipients: string[];
  senders: string[];
  messageCount: number;
  subjectCount: number;
  subjectExamples: string[];
}

function sampleSubjectExamples(subjects: Set<string>) {
  const examples = [...subjects].filter(Boolean);
  const count = Math.min(2, examples.length);
  for (let i = 0; i < count; i++) {
    const index = i + Math.floor(Math.random() * (examples.length - i));
    [examples[i], examples[index]] = [examples[index], examples[i]];
  }
  return examples.slice(0, count);
}

const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim();
const withoutReplyPrefix = (subject: string) =>
  normalize(subject).replace(/^(?:(?:re|fw|fwd|回复|转发)\s*:\s*)+/i, '');
const boundary = /[\s_+|·•—–\-:：/【】[\]《》]/;

function bracketedTitles(subject: string) {
  return [...new Set([...subject.matchAll(/《([^《》]+)》/g)].map((m) => normalize(m[1])))];
}

function structuredTitle(subject: string) {
  const parts = withoutReplyPrefix(subject)
    .split(/[_+|·•—–-]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const metadata =
    /^(?:短篇(?:小说)?|知乎(?:风|文)|女频|男频|古言|现言|爽文|虐文|甜宠|追妻|虐爽文|世情|认错文|\d+(?:\.\d+)?万?字|投稿)$/;
  // Only infer a new unbracketed title when every other segment is explicit
  // submission metadata. Ordinary correspondence stays as its full subject.
  if (parts.length < 3 || !parts.some((part) => /^(短篇(?:小说)?|投稿)$/.test(part))) return null;
  const candidates = parts.filter((part) => !metadata.test(part));
  return candidates.length === 1 ? candidates[0] : null;
}

export function groupSentRecipients(records: SentRecipientRecord[]): SentRecipientGroup[] {
  // Learn titles from the complete snapshot first, so unbracketed variants
  // can match titles sent by another account or encountered later in time.
  const knownTitles = new Map<string, string>();
  for (const record of records) {
    const titles = bracketedTitles(record.subject || '');
    if (titles.length === 1 && titles[0]) {
      knownTitles.set(titles[0].toLocaleLowerCase(), titles[0]);
    } else if (titles.length === 0) {
      const title = structuredTitle(record.subject || '');
      if (title) knownTitles.set(title.toLocaleLowerCase(), title);
    }
  }
  const groups = new Map<
    string,
    {
      title: string;
      recognized: boolean;
      recipients: Set<string>;
      senders: Set<string>;
      subjects: Set<string>;
      messageCount: number;
    }
  >();
  const seen = new Set<string>();
  for (const record of records) {
    const recordKey = JSON.stringify([record.accountId, record.id]);
    if (seen.has(recordKey)) continue;
    seen.add(recordKey);
    const original = (record.subject || '').trim();
    const subject = withoutReplyPrefix(original);
    const brackets = bracketedTitles(subject);
    let title = original;
    let recognized = false;
    if (brackets.length === 1 && brackets[0]) {
      title = knownTitles.get(brackets[0].toLocaleLowerCase()) || brackets[0];
      recognized = true;
    } else if (brackets.length === 0) {
      const lower = subject.toLocaleLowerCase();
      const matches: string[] = [];
      for (const [key, display] of knownTitles) {
        const index = lower.indexOf(key);
        if (index < 0) continue;
        const before = lower.slice(0, index);
        const after = lower.slice(index + key.length);
        const leftBoundary = !before || boundary.test(before.slice(-1)) || /投稿$/.test(before);
        const rightBoundary =
          !after || boundary.test(after[0]) || /^(短篇|投稿|世情[-_+|]|虐爽文[-_+|])/.test(after);
        if (leftBoundary && rightBoundary) matches.push(display);
      }
      // Multiple article names in one subject are ambiguous. Keep the full
      // subject instead of assigning its recipients to an arbitrary article.
      if (matches.length === 1) {
        [title] = matches;
        recognized = true;
      }
    }
    const key = JSON.stringify([
      recognized,
      recognized ? normalize(title).toLocaleLowerCase() : title,
    ]);
    if (!groups.has(key)) {
      groups.set(key, {
        title,
        recognized,
        recipients: new Set(),
        senders: new Set(),
        subjects: new Set(),
        messageCount: 0,
      });
    }
    const group = groups.get(key);
    group.messageCount += 1;
    group.subjects.add(original);
    group.senders.add(record.sender.trim().toLowerCase());
    for (const address of [...(record.to || []), ...(record.cc || []), ...(record.bcc || [])]) {
      const email = address.trim().toLowerCase();
      if (email) group.recipients.add(email);
    }
  }
  return [...groups.values()]
    .map((g) => ({
      title: g.title,
      recognized: g.recognized,
      recipients: [...g.recipients].sort(),
      senders: [...g.senders].filter(Boolean).sort(),
      messageCount: g.messageCount,
      subjectCount: g.subjects.size,
      subjectExamples: sampleSubjectExamples(g.subjects),
    }))
    .sort(
      (a, b) =>
        Number(b.recognized) - Number(a.recognized) || a.title.localeCompare(b.title, 'zh-CN')
    );
}

// Quote every cell, include a UTF-8 BOM for Excel, and neutralize formula
// prefixes in user-controlled subjects/addresses (including leading tabs).
export function sentRecipientCSV(rows: (string | number)[][]) {
  const cell = (value: string | number) => {
    let text = String(value);
    if (/^[\s\uFEFF]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return `\uFEFF${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
}

// Filter messages themselves, never whole threads: a sent conversation also
// contains received messages. Support folder-based and label-based accounts.
export const SENT_RECIPIENT_QUERY = `SELECT m.id, m.accountId, m.data FROM Message m
  WHERE m.draft = 0 AND (
    m.remoteFolderId IN (SELECT id FROM Folder WHERE role = 'sent')
    OR EXISTS (
      SELECT 1 FROM json_each(m.data, '$.labels') item
      JOIN Label label ON label.id = json_extract(item.value, '$.id')
      WHERE label.role = 'sent' AND label.accountId = m.accountId
    )
  )`;
