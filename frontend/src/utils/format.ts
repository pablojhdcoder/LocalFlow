export function formatAddedDate(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Live playback position — floors seconds so the label never runs ahead of the bar. */
export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
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
