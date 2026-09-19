import Database from 'better-sqlite3';
import {
  groupSentRecipients,
  sentRecipientCSV,
  SENT_RECIPIENT_QUERY,
  SentRecipientRecord,
} from '../src/sent-recipient-export';

describe('Sent recipient export', () => {
  const record = (id: string, subject: string, changes: Partial<SentRecipientRecord> = {}) => ({
    id,
    subject,
    accountId: 'a',
    sender: 'a@qq.com',
    to: ['editor@example.com'],
    cc: [],
    bcc: [],
    ...changes,
  });

  it('merges article variants across accounts, not by the selected account or whole subject', () => {
    const groups = groupSentRecipients([
      record('1', '短篇 | 质子府里养忠犬 | 1.22万字 | 爽文'),
      record('2', '《质子府里养忠犬》-短篇-沐眠投稿-12171字'),
      record('1', 'Re: 质子府里养忠犬短篇 | 鸢源投稿', {
        accountId: 'b',
        sender: 'b@qq.com',
        to: ['second@example.com'],
      }),
      record('3', '《质子府里养忠犬》_古言_1.22万字'),
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0].title).toBe('质子府里养忠犬');
    expect(groups[0].messageCount).toBe(4);
    expect(groups[0].subjectCount).toBe(4);
    expect(groups[0].senders).toEqual(['a@qq.com', 'b@qq.com']);
    expect(groups[0].recipients).toEqual(['editor@example.com', 'second@example.com']);
  });

  it('deduplicates addresses across To, Cc, Bcc and repeated records', () => {
    const message = record('1', '《作品》', {
      to: [' EDITOR@example.com ', ''],
      cc: ['editor@example.com'],
      bcc: ['hidden@example.com'],
    });
    const [group] = groupSentRecipients([message, message]);
    expect(group.recipients).toEqual(['editor@example.com', 'hidden@example.com']);
    expect(group.messageCount).toBe(1);
  });

  it('recognizes clear submission templates even without a bracketed title elsewhere', () => {
    const groups = groupSentRecipients([
      record('1', '投稿｜退婚后，我挑了京城最坏的郎君｜13216字'),
      record('2', '他爱了我一个寒假，却认错我的脸-女频-虐文-短篇-11128字'),
      record('3', '他爱了我一个寒假，却认错我的脸_短篇_11128字'),
    ]);
    expect(groups.length).toBe(2);
    expect(groups.every((g) => g.recognized)).toBe(true);
    expect(groups.find((g) => g.title.startsWith('他爱')).messageCount).toBe(2);
    expect(groups.find((g) => g.title.startsWith('退婚')).title).toBe(
      '退婚后,我挑了京城最坏的郎君'
    );
  });

  it('samples two distinct original subjects from the whole article group across accounts', () => {
    const subjects = [
      '《我说，你听》-短篇-沐眠投稿-12171字',
      'Re: 《我说，你听》 | 短篇 | 鸢源投稿 | 1.22万字',
      '《我说，你听》_古言_知乎风',
    ];
    const messages = [
      record('1', subjects[0]),
      record('2', subjects[0]),
      record('3', subjects[1], { accountId: 'b', sender: 'b@qq.com' }),
      record('4', subjects[2]),
      record('5', '《另一篇》'),
    ];
    spyOn(Math, 'random').andReturn(0.99);
    const group = groupSentRecipients(messages).find((g) => g.title === '我说,你听');
    expect(group.subjectExamples.length).toBe(2);
    expect(new Set(group.subjectExamples).size).toBe(2);
    expect(group.subjectExamples).toContain(subjects[2]);
    expect(group.subjectExamples.every((s) => subjects.includes(s))).toBe(true);
    expect(group.subjectExamples.every((s) => s.includes('我说，你听'))).toBe(true);
  });

  it('exports one example for repeated identical subjects and none for missing subjects', () => {
    const groups = groupSentRecipients([
      record('1', '《作品》-短篇-作者'),
      record('2', '《作品》-短篇-作者'),
      record('3', ''),
    ]);
    expect(groups.find((g) => g.title === '作品').subjectExamples).toEqual(['《作品》-短篇-作者']);
    expect(groups.find((g) => !g.title).subjectExamples).toEqual([]);
  });

  it('keeps unrelated, ambiguous and missing subjects instead of guessing a title', () => {
    const groups = groupSentRecipients([
      record('1', '《忠犬》'),
      record('2', '我家的忠犬续篇'),
      record('3', '《忠犬》与《另一篇》'),
      record('4', ''),
      record('5', '连通性测试'),
    ]);
    expect(groups.length).toBe(5);
    expect(groups.filter((g) => g.recognized).length).toBe(1);
  });

  it('keeps distinct bracketed titles and punctuation while normalizing width and whitespace', () => {
    const groups = groupSentRecipients([
      record('1', '《我说，你听》'),
      record('2', '《我说,你听》'),
      record('3', '《我说你听》'),
      record('4', '《我说，你听续篇》'),
    ]);
    expect(groups.length).toBe(3);
    expect(groups.find((g) => g.title === '我说,你听').messageCount).toBe(2);
  });

  it('does not lose sent messages without visible recipients', () => {
    const [group] = groupSentRecipients([record('1', '《作品》', { to: [] })]);
    expect(group.messageCount).toBe(1);
    expect(group.recipients).toEqual([]);
  });

  it('writes one CSV row per article with safe quoting, BOM and semicolon-separated addresses', () => {
    const csv = sentRecipientCSV([
      ['文章名', '邮箱'],
      ['a,"b"\nc', 'one@example.com; two@example.com'],
      ['\t=HYPERLINK("bad")', 2],
      ['+SUM(1)', '@bad'],
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"a,""b""\nc","one@example.com; two@example.com"\r\n');
    expect(csv).toContain('"\'\t=HYPERLINK(""bad"")","2"');
    expect(csv).toContain('"\'+SUM(1)","\'@bad"');
  });

  it('selects only non-draft sent messages across folder and label accounts, not incoming replies', () => {
    const db = new Database(':memory:');
    try {
      db.exec(`CREATE TABLE Message (id TEXT, accountId TEXT, data TEXT, draft INTEGER, remoteFolderId TEXT);
        CREATE TABLE Folder (id TEXT, role TEXT);
        CREATE TABLE Label (id TEXT, role TEXT, accountId TEXT);
        INSERT INTO Folder VALUES ('sent-a', 'sent'), ('inbox-a', 'inbox');
        INSERT INTO Label VALUES ('sent-b', 'sent', 'b');`);
      const insert = db.prepare('INSERT INTO Message VALUES (?, ?, ?, ?, ?)');
      insert.run('outgoing-a', 'a', '{}', 0, 'sent-a');
      insert.run('incoming-same-thread', 'a', '{}', 0, 'inbox-a');
      insert.run('draft', 'a', '{}', 1, 'sent-a');
      insert.run('outgoing-b', 'b', JSON.stringify({ labels: [{ id: 'sent-b' }] }), 0, null);
      insert.run(
        'wrong-account-label',
        'a',
        JSON.stringify({ labels: [{ id: 'sent-b' }] }),
        0,
        null
      );
      expect(
        db
          .prepare(SENT_RECIPIENT_QUERY)
          .all()
          .map((m: { id: string }) => m.id)
          .sort()
      ).toEqual(['outgoing-a', 'outgoing-b']);
    } finally {
      db.close();
    }
  });
});
