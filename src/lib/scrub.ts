/** Map a client X through the visible rail to 0..1 across the whole melody. */
export function melodyProgress(clientX: number, railLeft: number, railWidth: number): number {
  if (railWidth <= 0) return 0;
  return Math.min(1, Math.max(0, (clientX - railLeft) / railWidth));
}

/** Scroll offset that places `progress` under the finger on an overflowing tape. */
export function scrollForProgress(progress: number, scrollWidth: number, clientWidth: number): number {
  const max = Math.max(0, scrollWidth - clientWidth);
  return Math.min(1, Math.max(0, progress)) * max;
}
