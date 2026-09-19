import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { dialog, getCurrentWindow } from '@electron/remote';
import { shell } from 'electron';
import { AccountStore, Actions, DatabaseStore, localized } from 'mailspring-exports';
import {
  analyzeHumanReplies,
  keepMultiAccountReplyEmails,
  DEFAULT_REPLY_EXCLUSIONS,
  REPLY_REPORT_QUERY,
  replyMessageFromRow,
  ReplyReportMessage,
} from '../../../src/human-reply-report';
import {
  createHumanReplyWorkbook,
  extractReplyContent,
  ReplyBodyContent,
} from '../../../src/services/human-reply-workbook';

let exporting = false;

async function loadBodies(messages: ReplyReportMessage[], downloadIds: Set<string>) {
  const bodies = new Map<string, ReplyBodyContent>();
  const read = async (ids: string[]) => {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const rows = await DatabaseStore._query(
        `SELECT id, value FROM MessageBody WHERE id IN (${chunk.map(() => '?').join(',')})`,
        chunk,
        true
      );
      for (const row of rows) bodies.set(row.id, extractReplyContent(row.value));
    }
  };
  await read(messages.map((m) => m.id));
  const missing = messages.filter((m) => downloadIds.has(m.id) && !bodies.get(m.id)?.available);
  if (missing.length) {
    Actions.fetchBodies(missing.map((m) => ({ id: m.id, accountId: m.accountId })));
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const pending = missing.filter((m) => !bodies.get(m.id)?.available);
      if (!pending.length) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await read(pending.map((m) => m.id));
    }
  }
  return bodies;
}

export async function exportHumanReplyTimes() {
  if (exporting) return;
  exporting = true;
  let temporaryPath: string;
  const window = getCurrentWindow();
  try {
    const accounts = AccountStore.accounts();
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const raw = await DatabaseStore._query(REPLY_REPORT_QUERY, [], true);
    const messages = raw
      .filter((r) => accountMap.has(r.accountId))
      .map((r) =>
        replyMessageFromRow(
          { id: r.id, accountId: r.accountId, data: r.data, isSent: r.isSent },
          accountMap.get(r.accountId).emailAddress
        )
      );
    const configured = AppEnv.config.get('core.reading.silentReadSubjectKeywords');
    const exclusions = [
      ...new Set([
        ...DEFAULT_REPLY_EXCLUSIONS,
        ...(Array.isArray(configured)
          ? configured.filter((s) => typeof s === 'string' && s.trim())
          : []),
      ]),
    ];
    const aliases = accounts.flatMap((a) => a.aliases.map((alias) => a.meUsingAlias(alias).email));
    const report = keepMultiAccountReplyEmails(analyzeHumanReplies(messages, exclusions, aliases));
    const weekendReviewEmails = AppEnv.config.get('core.replyReports.weekendReviewEmails') || [];
    if (!messages.length) {
      await dialog.showMessageBox({
        type: 'info',
        message: localized('No synced messages to analyze. Sync your accounts and try again.'),
      });
      return;
    }
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: localized('Export Human Reply Times'),
      message: localized(
        '%@ accounts, %@ first reply samples, %@ unmatched replies.',
        accounts.length,
        report.firstReplyCount,
        report.unmatched.length
      ),
      detail: [
        report.averageSeconds == null
          ? localized('No qualifying matched replies; the average will be left blank.')
          : localized(
              'Average first reply delay: %@ hours.',
              (report.averageSeconds / 3600).toFixed(2)
            ),
        localized('Excluded subject keywords: %@', report.exclusions.join(' / ')),
        localized(
          'Only replying emails with matched replies involving at least two distinct sending email addresses are included. Removed %@ single-account replying emails and %@ matched replies.',
          report.singleAccountEmailCount,
          report.singleAccountReplyCount
        ),
        localized(
          'Effective review time excludes weekends by default. Set weekend-reviewing emails in Preferences > General > Reply Reports, or change their yellow cells in the exported workbook.'
        ),
        localized(
          'Later replies are included in details but do not increase the first-reply average.'
        ),
        localized(
          'Exports all accounts using locally synced messages. Ambiguous matches are excluded from averages and listed separately.'
        ),
        localized(
          'Missing matched reply bodies will be downloaded for up to 45 seconds. Any remaining missing bodies will be marked in the workbook.'
        ),
      ].join('\n\n'),
      buttons: [localized('Export Excel'), localized('Cancel')],
      defaultId: 0,
      cancelId: 1,
    });
    if (response !== 0) return;
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: localized('Export Human Reply Times'),
      defaultPath: `${localized('Human Reply Time Report')}.xlsx`,
      buttonLabel: localized('Export'),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (canceled || !filePath) return;
    window.setProgressBar(2);
    const replyMessages = [
      ...report.matches.map((m) => m.reply),
      ...report.unmatched.map((m) => m.reply),
    ];
    const bodies = await loadBodies(replyMessages, new Set(report.matches.map((m) => m.reply.id)));
    const sentCounts = new Map<string, number>();
    for (const message of messages.filter((m) => m.sent))
      sentCounts.set(message.accountId, (sentCounts.get(message.accountId) || 0) + 1);
    const workbook = createHumanReplyWorkbook(
      report,
      bodies,
      accounts.map((a) => ({ email: a.emailAddress, sentCount: sentCounts.get(a.id) || 0 })),
      new Date(),
      weekendReviewEmails
    );
    temporaryPath = path.join(
      path.dirname(filePath),
      `.human-replies-${randomBytes(8).toString('hex')}.tmp`
    );
    await fs.promises.writeFile(temporaryPath, Buffer.from(await workbook.xlsx.writeBuffer()), {
      mode: 0o600,
      flag: 'wx',
    });
    await fs.promises.rename(temporaryPath, filePath);
    temporaryPath = null;
    shell.showItemInFolder(filePath);
  } catch (error) {
    AppEnv.showErrorDialog(localized('Could not export human reply times. Please try again.'));
  } finally {
    if (temporaryPath) await fs.promises.unlink(temporaryPath).catch(() => {});
    if (!window.isDestroyed()) window.setProgressBar(-1);
    exporting = false;
  }
}
