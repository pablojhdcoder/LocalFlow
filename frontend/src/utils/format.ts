export function formatDurationSeconds(durationSeconds: number | undefined): string | null {
  if (durationSeconds === undefined || Number.isNaN(durationSeconds)) return null;

  const totalSeconds = Math.max(0, Math.round(durationSeconds));
  const nf2 = new Intl.NumberFormat('en', {
    minimumIntegerDigits: 2,
    maximumFractionDigits: 0,
  });

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    const nfHours = new Intl.NumberFormat('en', { minimumIntegerDigits: 1, maximumFractionDigits: 0 });
    return `${nfHours.format(hours)}:${nf2.format(minutes)}:${nf2.format(seconds)}`;
  }

  return `${nf2.format(minutes)}:${nf2.format(seconds)}`;
}
