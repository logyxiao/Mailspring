/** Subject matching is shared by auto-read processing and notifications so that
 * slow body downloads or queued read updates cannot produce a notification. */
export function shouldSilentlyReadSubject(subject: string | null | undefined): boolean {
  if (!subject) return false;
  const keywords = AppEnv.config.get('core.reading.silentReadSubjectKeywords');
  if (!Array.isArray(keywords)) return false;
  const normalizedSubject = subject.toLowerCase();
  return keywords.some(
    (keyword) =>
      typeof keyword === 'string' &&
      keyword.trim().length > 0 &&
      normalizedSubject.includes(keyword.trim().toLowerCase())
  );
}
