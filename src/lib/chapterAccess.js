export const MEMBER_ACCESS_MS = 7 * 24 * 60 * 60 * 1000;

export function chapterPublicDate(chapter) {
  if (!chapter?.memberAccess || !chapter?.unlockDate) return null;
  const explicit = chapter.publicDate ? new Date(chapter.publicDate).getTime() : NaN;
  if (Number.isFinite(explicit)) return explicit;
  const unlockAt = new Date(chapter.unlockDate).getTime();
  return Number.isFinite(unlockAt) ? unlockAt + MEMBER_ACCESS_MS : null;
}

export function chapterAccessLevel(chapter, now = Date.now()) {
  if (!chapter?.unlockDate) return 'public';
  const unlockAt = new Date(chapter.unlockDate).getTime();
  if (!Number.isFinite(unlockAt)) return 'public';
  if (now < unlockAt) return 'supporter';
  const publicAt = chapterPublicDate(chapter);
  if (publicAt && now < publicAt) return 'member';
  return 'public';
}

export function chapterNextAccessDate(chapter, now = Date.now()) {
  const level = chapterAccessLevel(chapter, now);
  if (level === 'supporter') return new Date(chapter.unlockDate).getTime();
  if (level === 'member') return chapterPublicDate(chapter);
  return null;
}

export function canReadChapter(chapter, { isLoggedIn, isSupporter }, now = Date.now()) {
  const level = chapterAccessLevel(chapter, now);
  if (level === 'supporter') return !!isSupporter;
  if (level === 'member') return !!isLoggedIn;
  return true;
}
