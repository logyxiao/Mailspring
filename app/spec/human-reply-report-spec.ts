import { Workbook } from 'exceljs';
import {
  analyzeHumanReplies,
  keepMultiAccountReplyEmails,
  isExcludedReplySubject,
  weekdayElapsedSeconds,
  replyMessageFromRow,
  ReplyReportMessage,
} from '../src/human-reply-report';
import {
  createHumanReplyWorkbook,
  extractReplyContent,
} from '../src/services/human-reply-workbook';

describe('Human reply report', () => {
  const start = new Date(2026, 8, 18, 18).getTime() / 1000; // Friday, local time
  const monday = new Date(2026, 8, 21, 10).getTime() / 1000;
  const message = (
    id: string,
    overrides: Partial<ReplyReportMessage> = {}
  ): ReplyReportMessage => ({
    id,
    accountId: 'a',
    accountEmail: 'author@qq.com',
    sent: true,
    subject: '《作品》-短篇-作者-10000字',
    timestamp: start,
    from: ['author@qq.com'],
    recipients: ['editor@example.com'],
    headerId: `<${id}@example.com>`,
    inReplyTo: '',
    references: [],
    ...overrides,
  });
  const reply = (id: string, overrides: Partial<ReplyReportMessage> = {}) =>
    message(id, {
      sent: false,
      from: ['editor@example.com'],
      recipients: ['author@qq.com'],
      timestamp: monday,
      subject: '回复：《作品》-短篇-作者-10000字',
      ...overrides,
    });

  it('follows the requested subject exclusions including Re and both AutoReply spellings', () => {
    for (const subject of [
      '自动回复：收到',
      'AUTOreply received',
      'autoreplay',
      'Re: 投稿',
      'rE: 投稿',
    ]) {
      expect(isExcludedReplySubject(subject)).toBe(true);
    }
    expect(isExcludedReplySubject('回复：作品')).toBe(false);
    expect(isExcludedReplySubject('普通人工回复')).toBe(false);
    expect(isExcludedReplySubject('普通邮件', [' '])).toBe(false);
  });

  it('uses only the first qualifying reply per sent message and correspondent for the average', () => {
    const report = analyzeHumanReplies([
      message('sent'),
      message('unanswered', { subject: '《另一篇》' }),
      reply('automatic', { subject: '自动回复：《作品》', timestamp: start + 60 }),
      reply('first'),
      reply('later', { timestamp: monday + 7200 }),
    ]);
    expect(report.firstReplyCount).toBe(1);
    expect(report.matches.map((m) => m.first)).toEqual([true, false]);
    expect(report.averageSeconds).toBe(monday - start);
    expect(report.excludedCount).toBe(1);
    expect(report.matches[0].weekdaySeconds).toBe(16 * 3600);
  });

  it('follows reference ancestry through an excluded automatic reply and counts each recipient once', () => {
    const report = analyzeHumanReplies([
      message('sent', { recipients: ['one@example.com', 'two@example.com'] }),
      reply('auto', {
        subject: 'AutoReply',
        inReplyTo: '<sent@example.com>',
        timestamp: start + 60,
      }),
      reply('one', {
        subject: 'Changed subject',
        from: ['one@example.com'],
        inReplyTo: '<auto@example.com>',
      }),
      reply('two', {
        subject: 'Changed again',
        from: ['two@example.com'],
        references: ['<sent@example.com>'],
        timestamp: monday + 3600,
      }),
    ]);
    expect(report.firstReplyCount).toBe(2);
    expect(report.matches.every((m) => m.method === 'header')).toBe(true);
    expect(report.averageSeconds).toBe(monday - start + 1800);
  });

  it('does not guess the latest send when several messages could have received a reply', () => {
    const report = analyzeHumanReplies([
      message('first'),
      message('second', { timestamp: start + 3600 }),
      reply('ambiguous'),
    ]);
    expect(report.matches.length).toBe(0);
    expect(report.averageSeconds).toBe(null);
    expect(report.unmatched[0].reason).toBe('ambiguous');
  });

  it('keeps matching within the account and correspondent, and deduplicates folder copies', () => {
    const first = reply('reply');
    const report = analyzeHumanReplies([
      message('sent'),
      first,
      { ...first, id: 'folder-copy' },
      reply('other-account', { accountId: 'b', accountEmail: 'other@qq.com' }),
      reply('wrong-person', { from: ['someone@example.com'] }),
      reply('self', { from: ['author@qq.com'] }),
    ]);
    expect(report.matches.length).toBe(1);
    expect(report.unmatched.length).toBe(2);
  });

  it('falls back to article title only for a unique send to the replying address', () => {
    const report = analyzeHumanReplies([
      message('sent'),
      reply('reply', { subject: '回复：《作品》审核结果' }),
    ]);
    expect(report.matches.length).toBe(1);
    expect(report.matches[0].method).toBe('article');
  });

  it('excludes invalid and negative reply intervals', () => {
    const report = analyzeHumanReplies([
      message('sent'),
      reply('before', { timestamp: start - 10, inReplyTo: '<sent@example.com>' }),
      reply('missing', { timestamp: null }),
    ]);
    expect(report.matches.length).toBe(0);
    expect(report.unmatched.every((m) => m.reason === 'invalid-date')).toBe(true);
  });

  it('reads native JSON reply headers and contacts instead of the unused SQL reply column', () => {
    const parsed = replyMessageFromRow(
      {
        id: 'id',
        accountId: 'a',
        isSent: 0,
        data: JSON.stringify({
          date: start,
          hMsgId: 'reply',
          rthMsgId: 'sent',
          subject: '回复：投稿',
          from: [{ email: 'editor@example.com' }],
          to: [{ email: 'author@qq.com' }],
          extraHeaders: { References: '<first> <second>' },
        }),
      },
      'author@qq.com'
    );
    expect(parsed.inReplyTo).toBe('sent');
    expect(parsed.references).toEqual(['<first>', '<second>']);
    expect(parsed.from).toEqual(['editor@example.com']);
  });

  it('subtracts only weekend portions, preserving partial weekdays and zero-weekday intervals', () => {
    expect(weekdayElapsedSeconds(start, monday)).toBe(16 * 3600);
    const saturday = new Date(2026, 8, 19, 10).getTime() / 1000;
    const sunday = new Date(2026, 8, 20, 15).getTime() / 1000;
    expect(weekdayElapsedSeconds(saturday, sunday)).toBe(0);
    expect(weekdayElapsedSeconds(start, start + 3600)).toBe(3600);
    expect(weekdayElapsedSeconds(start, start)).toBe(0);
    expect(weekdayElapsedSeconds(monday, start)).toBe(null);
    const nextMonday = new Date(2026, 8, 28, 10).getTime() / 1000;
    expect(weekdayElapsedSeconds(start, nextMonday)).toBe((16 + 120) * 3600);
  });

  it('extracts reply text without scripts while retaining original quoted text separately', () => {
    const content = extractReplyContent(
      '<p>稿件收到，感谢！</p><blockquote>原稿内容</blockquote><script>danger()</script><img src="https://example.com/tracker">'
    );
    expect(content.text).toBe('稿件收到，感谢！');
    expect(content.fullText).toContain('原稿内容');
    expect(content.fullText).not.toContain('danger');
    expect(extractReplyContent(null).available).toBe(false);
    expect(extractReplyContent('').available).toBe(true);
  });

  it('writes editable per-editor weekend policies and cached natural/effective averages', async () => {
    const report = analyzeHumanReplies([message('sent'), reply('reply')]);
    const bodies = new Map([['reply', extractReplyContent('<p>=This is literal reply text</p>')]]);
    const accounts = [{ email: 'author@qq.com', sentCount: 1 }];
    const workbook = createHumanReplyWorkbook(report, bodies, accounts);
    const summary = workbook.getWorksheet('Reply Time Summary');
    const details = workbook.getWorksheet('Human Reply Details');
    const recipients = workbook.getWorksheet('Reply Times by Email');
    expect(summary.getCell('B12').result).toBe(64);
    expect(summary.getCell('B14').result).toBe(16);
    expect(recipients.getCell('H5').value).toBe('No');
    expect(recipients.getCell('H5').dataValidation.type).toBe('list');
    expect(details.getCell('M5').result).toBe(16);
    expect(details.getCell('L5').formula).toContain("'Reply Times by Email'!$H$5:$H$5");
    expect(details.getCell('N5').type).toBe(3); // String, never a formula
    const restored = new Workbook();
    await restored.xlsx.load(await workbook.xlsx.writeBuffer());
    expect(restored.worksheets.map((sheet) => sheet.name)).toEqual([
      'Reply Time Summary',
      'Reply Times by Email',
      'Human Reply Details',
      'Unmatched Replies',
    ]);
    expect(restored.getWorksheet('Human Reply Details').getCell('N5').value).toBe(
      '=This is literal reply text'
    );
    const includingWeekends = createHumanReplyWorkbook(report, bodies, accounts, new Date(), [
      'EDITOR@example.com',
    ]);
    expect(includingWeekends.getWorksheet('Reply Time Summary').getCell('B14').result).toBe(64);
  });

  it('keeps only multi-account correspondents and recalculates all sample statistics', () => {
    const report = analyzeHumanReplies([
      message('shared-a'),
      reply('shared-reply-a'),
      message('shared-b', { accountId: 'b', accountEmail: 'author-b@qq.com' }),
      reply('shared-reply-b', {
        accountId: 'b',
        accountEmail: 'author-b@qq.com',
        timestamp: monday + 3600,
      }),
      reply('shared-unmatched', { subject: '回复：未找到的主题' }),
      message('private-send', { recipients: ['private@example.com'] }),
      reply('private-reply', { from: ['private@example.com'], timestamp: start + 60 }),
      reply('private-unmatched', { from: ['private@example.com'], subject: '回复：私人事项' }),
      // A second account sending to someone without a qualifying reply must
      // not turn that person's one-account row into an eligible row.
      message('private-no-reply', {
        accountId: 'b',
        accountEmail: 'author-b@qq.com',
        recipients: ['private@example.com'],
      }),
    ]);
    const filtered = keepMultiAccountReplyEmails(report);
    expect(filtered.matches.length).toBe(2);
    expect(filtered.matches.every((m) => m.correspondent === 'editor@example.com')).toBe(true);
    expect(filtered.unmatched.map((m) => m.reply.id)).toEqual(['shared-unmatched']);
    expect(filtered.firstReplyCount).toBe(2);
    expect(filtered.averageSeconds).toBe(64.5 * 3600);
    expect(filtered.medianSeconds).toBe(64.5 * 3600);
    expect(filtered.singleAccountEmailCount).toBe(1);
    expect(filtered.singleAccountReplyCount).toBe(1);
    expect(filtered.filteredUnmatchedCount).toBe(1);
    expect(keepMultiAccountReplyEmails(filtered)).toBe(filtered);
    const workbook = createHumanReplyWorkbook(filtered, new Map(), []);
    expect(workbook.getWorksheet('Reply Times by Email').rowCount).toBe(5);
    expect(workbook.getWorksheet('Human Reply Details').rowCount).toBe(6);
    expect(workbook.getWorksheet('Unmatched Replies').rowCount).toBe(5);
    expect(workbook.getWorksheet('Reply Time Summary').getCell('B12').result).toBe(64.5);
    expect(workbook.getWorksheet('Reply Time Summary').getCell('B14').result).toBe(16.5);
  });

  it('counts distinct sending email addresses, not account IDs, and handles all rows being removed', () => {
    const filtered = keepMultiAccountReplyEmails(
      analyzeHumanReplies([
        message('a'),
        reply('reply-a'),
        message('b', { accountId: 'duplicate', accountEmail: ' AUTHOR@qq.com ' }),
        reply('reply-b', { accountId: 'duplicate', accountEmail: ' AUTHOR@qq.com ' }),
      ])
    );
    expect(filtered.matches.length).toBe(0);
    expect(filtered.firstReplyCount).toBe(0);
    expect(filtered.averageSeconds).toBe(null);
    expect(filtered.medianSeconds).toBe(null);
    const workbook = createHumanReplyWorkbook(filtered, new Map(), []);
    expect(workbook.getWorksheet('Reply Time Summary').getCell('B12').result).toBe('');
    expect(workbook.getWorksheet('Reply Time Summary').getCell('B14').result).toBe('');
  });

  it('leaves empty averages blank and preserves long bodies in continuation columns', () => {
    const empty = createHumanReplyWorkbook(analyzeHumanReplies([message('sent')]), new Map(), []);
    expect(empty.getWorksheet('Reply Time Summary').getCell('B12').result).toBe('');
    expect(empty.getWorksheet('Reply Time Summary').getCell('B14').result).toBe('');
    const report = analyzeHumanReplies([message('sent'), reply('reply')]);
    const text = '文'.repeat(40000);
    const workbook = createHumanReplyWorkbook(
      report,
      new Map([['reply', { available: true, text, fullText: text }]]),
      []
    );
    const details = workbook.getWorksheet('Human Reply Details');
    expect(String(details.getCell('N5').value) + String(details.getCell('O5').value)).toBe(text);
  });
});
