import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { dialog } from '@electron/remote';
import { shell } from 'electron';
import { AccountStore, DatabaseStore, localized } from 'mailspring-exports';
import {
  groupSentRecipients,
  sentRecipientCSV,
  SENT_RECIPIENT_QUERY,
  SentRecipientRecord,
} from '../../../src/sent-recipient-export';

let exporting = false;

export async function exportSentRecipients() {
  if (exporting) return;
  exporting = true;
  let temporaryPath: string;
  try {
    const accounts = AccountStore.accounts();
    const accountMap = new Map(accounts.map((account) => [account.id, account.emailAddress]));
    const rows = await DatabaseStore._query(SENT_RECIPIENT_QUERY, [], true);
    const records: SentRecipientRecord[] = rows
      .filter((row) => accountMap.has(row.accountId))
      .map((row) => {
        const message = JSON.parse(row.data);
        const addresses = (contacts) => (contacts || []).map((c) => c.email || '').filter(Boolean);
        return {
          id: row.id,
          accountId: row.accountId,
          sender: accountMap.get(row.accountId),
          subject: message.subject || '',
          to: addresses(message.to),
          cc: addresses(message.cc),
          bcc: addresses(message.bcc),
        };
      });
    if (!records.length) {
      await dialog.showMessageBox({
        type: 'info',
        message: localized('No synced sent messages to export. Sync your accounts and try again.'),
      });
      return;
    }
    const groups = groupSentRecipients(records);
    const counts = new Map<string, number>();
    for (const record of records)
      counts.set(record.accountId, (counts.get(record.accountId) || 0) + 1);
    const summary = accounts.map((a) => `${a.emailAddress}: ${counts.get(a.id) || 0}`).join('\n');
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: localized('Export Sent Recipients by Article'),
      message: localized(
        '%@ accounts, %@ sent messages, %@ grouped rows.',
        accounts.length,
        records.length,
        groups.length
      ),
      detail: [
        localized('All accounts are included, regardless of the selected mailbox.'),
        localized(
          'Each article has one row with unique To, Cc and Bcc addresses separated by semicolons.'
        ),
        localized(
          'This exports locally synced sent messages. Messages not yet synced are not included.'
        ),
        localized(
          '%@ rows could not be identified as an article and keep their original subjects.',
          groups.filter((g) => !g.recognized).length
        ),
        '',
        summary,
      ].join('\n'),
      buttons: [localized('Export CSV'), localized('Cancel')],
      defaultId: 0,
      cancelId: 1,
    });
    if (response !== 0) return;
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: localized('Export Sent Recipients by Article'),
      defaultPath: `${localized('Sent Recipients by Article')}.csv`,
      buttonLabel: localized('Export'),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (canceled || !filePath) return;
    const csv = sentRecipientCSV([
      [
        localized('Article / Original Subject'),
        localized('Recipient Emails (To, Cc, Bcc)'),
        localized('Unique Recipients'),
        localized('Sending Accounts'),
        localized('Sent Message Count'),
        localized('Subject Variants'),
        localized('Grouping Method'),
        localized('Subject Examples'),
      ],
      ...groups.map((g) => [
        g.title || localized('(No Subject)'),
        g.recipients.join('; '),
        g.recipients.length,
        g.senders.join('; '),
        g.messageCount,
        g.subjectCount,
        g.recognized
          ? localized('Article Title')
          : localized('Original subject (unrecognized article)'),
        g.subjectExamples.join('\n'),
      ]),
    ]);
    temporaryPath = path.join(
      path.dirname(filePath),
      `.sent-recipients-${randomBytes(8).toString('hex')}.tmp`
    );
    await fs.promises.writeFile(temporaryPath, csv, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await fs.promises.rename(temporaryPath, filePath);
    temporaryPath = null;
    shell.showItemInFolder(filePath);
  } catch (error) {
    AppEnv.showErrorDialog(localized('Could not export sent recipients. Please try again.'));
  } finally {
    if (temporaryPath) await fs.promises.unlink(temporaryPath).catch(() => {});
    exporting = false;
  }
}
