export const DEFAULT_REPLY_EXCLUSIONS = ['自动回复', 'AutoReply', 'AutoReplay', 'Re:'];

export function isExcludedReplySubject(subject: string, exclusions = DEFAULT_REPLY_EXCLUSIONS) {
  const lower = (subject || '').toLowerCase();
  return exclusions.some((value) => value.trim() && lower.includes(value.trim().toLowerCase()));
}
