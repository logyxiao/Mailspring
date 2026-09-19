import { Account } from 'mailspring-exports';

export const QQ_MAIL_HELP_URL = 'https://service.mail.qq.com/detail/0/75';

export function normalizeQQEmail(value: string, allowNumber = false) {
  const cleaned = (value || '').trim().replace(/\\@/g, '@').replace(/＠/g, '@');
  if (allowNumber && /^\d+$/.test(cleaned)) return `${cleaned}@qq.com`;
  return cleaned.replace(/@(qq|foxmail)\.com$/i, (domain) => domain.toLowerCase());
}

export function isQQMailAddress(value: string) {
  return /^[^\s@]+@(qq|foxmail)\.com$/i.test(normalizeQQEmail(value));
}

export function isQQMailAccount(account: Account) {
  return account.provider === 'qq' || isQQMailAddress(account.emailAddress);
}

export function normalizeQQAuthorizationCode(value: string) {
  return (value || '').replace(/\s+/g, '');
}

export function prepareQQAccount(account: Account) {
  const result = account.clone();
  result.emailAddress = normalizeQQEmail(result.emailAddress, result.provider === 'qq');
  result.name = result.name?.trim() || result.emailAddress.split('@')[0];
  const code = normalizeQQAuthorizationCode(result.settings.imap_password);
  result.settings = {
    ...result.settings,
    imap_host: 'imap.qq.com',
    imap_port: 993,
    imap_security: 'SSL / TLS',
    smtp_host: 'smtp.qq.com',
    smtp_port: 465,
    smtp_security: 'SSL / TLS',
    imap_username: result.emailAddress,
    smtp_username: result.emailAddress,
    imap_password: code,
    smtp_password: code,
    imap_allow_insecure_ssl: false,
    smtp_allow_insecure_ssl: false,
  };
  return result;
}
