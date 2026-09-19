import { Workbook } from 'exceljs';
import { load } from 'cheerio';
import { localized } from '../intl';
import { HumanReplyReport, ReplyMatchMethod, UnmatchedReplyReason } from '../human-reply-report';

export interface ReplyBodyContent {
  text: string;
  fullText: string;
  available: boolean;
}

export function extractReplyContent(html: string | null | undefined): ReplyBodyContent {
  if (html == null) return { text: '', fullText: '', available: false };
  // Cheerio is an inert parser: exporting never loads remote images, runs
  // scripts, or inserts message HTML into the application's document.
  const $ = load(html);
  $('script, style, head, noscript, iframe, object, embed').remove();
  $('br').replaceWith('\n');
  $('p, div, li, tr, table, section, blockquote').append('\n');
  const clean = (value: string) =>
    value
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  const fullText = clean($('body').text());
  $(
    'blockquote, .gmail_quote, .yahoo_quoted, .moz-cite-prefix, .mailspring-quoted-text-segment'
  ).remove();
  let text = clean($('body').text());
  const quoteBoundary = text.search(
    /(?:^|\n)\s*(?:[-—_]{2,}\s*(?:原始邮件|Original Message|转发邮件)\s*[-—_]*|On [^\n]+wrote:)/i
  );
  if (quoteBoundary >= 0) text = text.slice(0, quoteBoundary).trim();
  return { text: text || fullText, fullText, available: true };
}

function matchLabel(method: ReplyMatchMethod) {
  if (method === 'header') return localized('Reply reference headers');
  if (method === 'subject') return localized('Same account, correspondent and full subject');
  return localized('Same account, correspondent and article title');
}

function reasonLabel(reason: UnmatchedReplyReason) {
  if (reason === 'ambiguous') return localized('Multiple possible sent messages');
  if (reason === 'invalid-date') return localized('Missing dates or reply predates sending');
  if (reason === 'multiple-senders') return localized('Multiple or missing sender addresses');
  return localized('No matching sent message in synced data');
}

const HOURS = 3600;
const localExcelDate = (seconds: number | null) => {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
};

function tableSheet(
  workbook: Workbook,
  name: string,
  headers: string[],
  rows: any[][],
  widths: number[]
) {
  const sheet = workbook.getWorksheet(name) || workbook.addWorksheet(name);
  sheet.views = [{ state: 'frozen', ySplit: 4, xSplit: 1, showGridLines: false }];
  sheet.getCell('A2').value = name;
  sheet.getCell('A2').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF203F68' } };
  sheet.getRow(2).height = 27;
  sheet.getRow(4).values = headers;
  sheet.addRows(rows);
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.eachRow((row, number) => {
    if (number < 4) return;
    row.font = { name: 'Arial', size: 10, color: { argb: 'FF26344A' } };
    row.alignment = { vertical: 'top', wrapText: true };
    row.height = number === 4 ? 32 : 48;
    if (number === 4) {
      row.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF203F68' } };
      row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    } else if (number % 2) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F5F9' } };
    }
  });
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: Math.max(4, rows.length + 4), column: headers.length },
  };
  return sheet;
}

function bodyParts(text: string) {
  // Excel limits a cell to 32,767 characters. Continue in adjacent columns
  // rather than silently losing the end of a long reply.
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length) {
    let end = Math.min(30000, remaining.length);
    if (end < remaining.length && /[\uD800-\uDBFF]/.test(remaining[end - 1])) end--;
    parts.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  return parts.length ? parts : [''];
}

function bodyStatus(content: ReplyBodyContent) {
  return content.available ? localized('Body available') : localized('Body not downloaded');
}

export function createHumanReplyWorkbook(
  report: HumanReplyReport,
  bodies: Map<string, ReplyBodyContent>,
  accounts: { email: string; sentCount: number }[],
  exportedAt = new Date(),
  weekendReviewEmails: string[] = []
) {
  const weekendReviewers = new Set(weekendReviewEmails.map((email) => email.trim().toLowerCase()));
  const effectiveHours = (m: HumanReplyReport['matches'][number]) =>
    (weekendReviewers.has(m.correspondent) ? m.elapsedSeconds : m.weekdaySeconds) / HOURS;
  const recipientSheetName = localized('Reply Times by Email');
  const quotedRecipients = `'${recipientSheetName.replace(/'/g, "''")}'`;
  const recipientLast = Math.max(5, new Set(report.matches.map((m) => m.correspondent)).size + 4);
  const workbook = new Workbook();
  workbook.creator = 'Mailspring';
  workbook.created = exportedAt;
  workbook.calcProperties.fullCalcOnLoad = true;
  const summary = workbook.addWorksheet(localized('Reply Time Summary'), {
    views: [{ showGridLines: false }],
  });
  workbook.addWorksheet(recipientSheetName);
  const missing = { text: '', fullText: '', available: false };
  const contentFor = (id: string) => bodies.get(id) || missing;
  const maxReplyParts = Math.max(
    1,
    ...report.matches.map((m) => bodyParts(contentFor(m.reply.id).text).length)
  );
  const maxFullParts = Math.max(
    1,
    ...report.matches.map((m) => bodyParts(contentFor(m.reply.id).fullText).length)
  );
  const contentHeaders = (count: number, full: boolean) =>
    Array.from({ length: count }, (_, index) => {
      if (index === 0)
        return full
          ? localized('Full Reply Body (Including Quotes)')
          : localized('Human Reply Content');
      return full
        ? localized('Full Reply Body (Continued %@)', index + 1)
        : localized('Human Reply Content (Continued %@)', index + 1);
    });
  const paddedParts = (text: string, count: number) => {
    const parts = bodyParts(text);
    return Array.from({ length: count }, (_, i) => parts[i] || '');
  };
  const detailsName = localized('Human Reply Details');
  const details = tableSheet(
    workbook,
    detailsName,
    [
      localized('Sending Account'),
      localized('Replying Email'),
      localized('Sent Subject'),
      localized('Sent Time'),
      localized('Reply Subject'),
      localized('Reply Time'),
      localized('Reply Delay (Hours)'),
      localized('Included in Average'),
      localized('Matching Basis'),
      localized('Reply Body Status'),
      localized('Weekday Delay (Hours)'),
      localized('Reviews on Weekends'),
      localized('Effective Review Delay (Hours)'),
      ...contentHeaders(maxReplyParts, false),
      ...contentHeaders(maxFullParts, true),
    ],
    report.matches.map((m, index) => {
      const body = contentFor(m.reply.id);
      const row = index + 5;
      const weekendValue = weekendReviewers.has(m.correspondent)
        ? localized('Yes')
        : localized('No');
      return [
        m.sent.accountEmail,
        m.correspondent,
        m.sent.subject,
        localExcelDate(m.sent.timestamp),
        m.reply.subject,
        localExcelDate(m.reply.timestamp),
        m.elapsedSeconds / HOURS,
        m.first ? localized('Yes') : localized('No'),
        matchLabel(m.method),
        bodyStatus(body),
        m.weekdaySeconds / HOURS,
        {
          formula: `INDEX(${quotedRecipients}!$H$5:$H$${recipientLast},MATCH(B${row},${quotedRecipients}!$A$5:$A$${recipientLast},0))`,
          result: weekendValue,
        },
        { formula: `IF(L${row}="${localized('Yes')}",G${row},K${row})`, result: effectiveHours(m) },
        ...paddedParts(body.text, maxReplyParts),
        ...paddedParts(body.fullText, maxFullParts),
      ];
    }),
    [
      26,
      28,
      50,
      23,
      50,
      23,
      17,
      17,
      38,
      23,
      22,
      20,
      24,
      ...Array(maxReplyParts + maxFullParts).fill(85),
    ]
  );
  details.getColumn(4).numFmt = details.getColumn(6).numFmt = 'yyyy-mm-dd hh:mm:ss';
  details.getColumn(7).numFmt = '0.00';
  details.getColumn(11).numFmt = details.getColumn(13).numFmt = '0.00';
  report.matches.forEach((m, index) => {
    const text = contentFor(m.reply.id).text;
    const lines = text
      .split('\n')
      .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 40)), 0);
    details.getRow(index + 5).height = Math.min(409, Math.max(48, lines * 14 + 8));
  });
  const last = Math.max(5, report.matches.length + 4);
  const quotedName = `'${detailsName.replace(/'/g, "''")}'`;
  const delays = `${quotedName}!$G$5:$G$${last}`;
  const effectiveDelays = `${quotedName}!$M$5:$M$${last}`;
  const flags = `${quotedName}!$H$5:$H$${last}`;
  const emails = `${quotedName}!$B$5:$B$${last}`;
  const yes = localized('Yes').replace(/"/g, '""');
  const byEmail = new Map<string, typeof report.matches>();
  for (const match of report.matches) {
    if (!byEmail.has(match.correspondent)) byEmail.set(match.correspondent, []);
    byEmail.get(match.correspondent).push(match);
  }
  const recipientRows = [...byEmail]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([email, matches], index) => {
      const durations = matches.filter((m) => m.first).map((m) => m.elapsedSeconds / HOURS);
      const effective = matches.filter((m) => m.first).map(effectiveHours);
      const row = index + 5;
      return [
        email,
        [...new Set(matches.map((m) => m.sent.accountEmail))].join('; '),
        { formula: `COUNTIFS(${emails},A${row},${flags},"${yes}")`, result: durations.length },
        {
          formula: `IF(C${row}=0,"",AVERAGEIFS(${delays},${emails},A${row},${flags},"${yes}"))`,
          result: durations.reduce((a, b) => a + b, 0) / durations.length,
        },
        Math.min(...durations),
        Math.max(...durations),
        matches.length,
        weekendReviewers.has(email) ? localized('Yes') : localized('No'),
        matches.some((m) => [0, 6].includes(new Date(m.reply.timestamp * 1000).getDay()))
          ? localized('Yes')
          : localized('No'),
        {
          formula: `IF(C${row}=0,"",AVERAGEIFS(${effectiveDelays},${emails},A${row},${flags},"${yes}"))`,
          result: effective.reduce((a, b) => a + b, 0) / effective.length,
        },
      ];
    });
  const recipients = tableSheet(
    workbook,
    localized('Reply Times by Email'),
    [
      localized('Replying Email'),
      localized('Sending Accounts'),
      localized('First Reply Samples'),
      localized('Average Reply Delay (Hours)'),
      localized('Fastest Reply (Hours)'),
      localized('Slowest Reply (Hours)'),
      localized('Matched Reply Count'),
      localized('Reviews on Weekends'),
      localized('Has Replied on Weekends'),
      localized('Average Effective Review Delay (Hours)'),
    ],
    recipientRows,
    [30, 45, 18, 23, 23, 23, 20, 22, 23, 27]
  );
  for (const col of [4, 5, 6, 10]) recipients.getColumn(col).numFmt = '0.00';
  recipients.getCell('A3').value = localized(
    'Change the yellow Weekend Review cells to Yes or No to recalculate effective averages. Weekend replies are evidence only, not an automatic setting.'
  );
  recipientRows.forEach((_, index) => {
    const cell = recipients.getCell(`H${index + 5}`);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0C2' } };
    cell.dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${localized('Yes')},${localized('No')}"`],
      showErrorMessage: true,
      errorTitle: localized('Reviews on Weekends'),
      error: localized('Choose Yes or No.'),
    };
  });

  const unmatchedParts = Math.max(
    1,
    ...report.unmatched.map((m) => bodyParts(contentFor(m.reply.id).fullText).length)
  );
  const unpaired = tableSheet(
    workbook,
    localized('Unmatched Replies'),
    [
      localized('Account'),
      localized('Replying Email'),
      localized('Reply Subject'),
      localized('Reply Time'),
      localized('Not Included Because'),
      localized('Reply Body Status'),
      ...contentHeaders(unmatchedParts, true),
    ],
    report.unmatched.map((m) => {
      const body = contentFor(m.reply.id);
      return [
        m.reply.accountEmail,
        m.reply.from.join('; '),
        m.reply.subject,
        localExcelDate(m.reply.timestamp),
        reasonLabel(m.reason),
        bodyStatus(body),
        ...paddedParts(body.fullText, unmatchedParts),
      ];
    }),
    [26, 28, 55, 23, 48, 23, ...Array(unmatchedParts).fill(85)]
  );
  unpaired.getColumn(4).numFmt = 'yyyy-mm-dd hh:mm:ss';

  summary.getCell('A2').value = localized('Human Reply Time Report');
  summary.getCell('A2').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF203F68' } };
  const missingBodies = report.matches.filter((m) => !contentFor(m.reply.id).available).length;
  const firstEffective = report.matches.filter((m) => m.first).map(effectiveHours);
  const summaryRows = [
    [localized('Exported At'), exportedAt.toLocaleString()],
    [localized('Account Count'), accounts.length],
    [localized('Sent Messages Read (Before Filtering)'), report.sentCount],
    [localized('Received Messages Read (Before Filtering)'), report.receivedCount],
    [localized('Replies Excluded by Subject'), report.excludedCount],
    [localized('Unrelated Incoming Messages'), report.ignoredCount],
    [localized('Matched Reply Count'), report.matches.length],
    [
      localized('First Reply Samples'),
      { formula: `COUNTIF(${flags},"${yes}")`, result: report.firstReplyCount },
    ],
    [
      localized('Average Reply Delay (Hours)'),
      {
        formula: `IF(B11=0,"",AVERAGEIF(${flags},"${yes}",${delays}))`,
        result: report.averageSeconds == null ? '' : report.averageSeconds / HOURS,
      },
    ],
    [
      localized('Median Reply Delay (Hours)'),
      report.medianSeconds == null ? null : report.medianSeconds / HOURS,
    ],
    [
      localized('Average Effective Review Delay (Hours)'),
      {
        formula: `IF(B11=0,"",AVERAGEIF(${flags},"${yes}",${effectiveDelays}))`,
        result: firstEffective.length
          ? firstEffective.reduce((a, b) => a + b, 0) / firstEffective.length
          : '',
      },
    ],
    [localized('Unmatched Reply Count'), report.unmatched.length],
    [localized('Matched Replies Without Downloaded Bodies'), missingBodies],
    [localized('Excluded Subject Keywords'), report.exclusions.join(' / ')],
    [
      localized('Weekend Policy'),
      localized(
        'Effective review time excludes Saturdays and Sundays unless the replying email is marked as reviewing on weekends. Nights and public holidays are not excluded. Edit the yellow cells in Reply Times by Email; workbook changes do not change software preferences.'
      ),
    ],
    [
      localized('Calculation Method'),
      localized(
        'Elapsed calendar time from sending to the first qualifying reply per sent message and replying email; later replies are shown but excluded from averages.'
      ),
    ],
    [
      localized('Matching Method'),
      localized(
        'Reply reference headers take priority. Otherwise, require the same account and correspondent plus a unique earlier sent message with the same full subject or article title. Ambiguous matches are excluded.'
      ),
    ],
    [
      localized('Data Scope'),
      localized(
        'All configured accounts; locally synced messages only. Subject-based filtering follows your rules and does not verify whether a person wrote the message.'
      ),
    ],
    [
      localized('Time and Content'),
      localized(
        'Times use the computer time zone and email timestamps. Reply text is extracted without loading remote content; original text including quotes is also retained. Missing bodies are marked explicitly.'
      ),
    ],
  ];
  if (report.multipleSendingAccountsOnly) {
    summaryRows.push(
      [
        localized('Sending Account Filter'),
        localized(
          'Only replying emails whose matched replies involve at least two distinct sending email addresses are kept. This filter applies to correspondent statistics, reply details, unmatched replies and all averages.'
        ),
      ],
      [localized('Excluded Single-Account Replying Emails'), report.singleAccountEmailCount],
      [localized('Matched Replies Removed by Account Filter'), report.singleAccountReplyCount],
      [localized('Unmatched Replies Removed by Account Filter'), report.filteredUnmatchedCount]
    );
  }
  summaryRows.forEach((values, index) => {
    summary.getRow(index + 4).values = values;
  });
  summary.getColumn(1).width = 48;
  summary.getColumn(2).width = 115;
  summary.eachRow((row, index) => {
    if (index < 4) return;
    row.font = { name: 'Arial', size: 11, color: { argb: 'FF26344A' } };
    row.alignment = { vertical: 'top', wrapText: true };
    row.height = index >= 17 ? 58 : 28;
  });
  summary.getCell('B12').numFmt =
    summary.getCell('B13').numFmt =
    summary.getCell('B14').numFmt =
      '0.00';
  const accountHeaderRow = summaryRows.length + 6;
  summary.getRow(accountHeaderRow).values = [
    localized('Sending Account'),
    localized('Synced Sent Messages'),
  ];
  summary.getRow(accountHeaderRow).font = { name: 'Arial', size: 11, bold: true };
  accounts.forEach((a, i) => {
    summary.getRow(accountHeaderRow + 1 + i).values = [a.email, a.sentCount];
  });
  return workbook;
}
