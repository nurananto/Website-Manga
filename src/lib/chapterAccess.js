export function chapterAccessLevel(chapter, now = Date.now()) {
  if (!chapter?.unlockDate) return 'public';
  const unlockAt = new Date(chapter.unlockDate).getTime();
  if (!Number.isFinite(unlockAt)) return 'public';
  if (now < unlockAt) return 'supporter';
  return 'public';
}

export function chapterNextAccessDate(chapter, now = Date.now()) {
  const level = chapterAccessLevel(chapter, now);
  if (level === 'supporter') return new Date(chapter.unlockDate).getTime();
  return null;
}

export function canReadChapter(chapter, { isSupporter }, now = Date.now()) {
  const level = chapterAccessLevel(chapter, now);
  if (level === 'supporter') return !!isSupporter;
  return true;
}
