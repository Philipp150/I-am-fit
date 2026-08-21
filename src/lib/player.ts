export function nextStepIndex(
  index: number,
  length: number,
  loop: boolean,
): { index: number; finished: boolean } {
  if (length <= 0) return { index: 0, finished: true };
  if (index + 1 < length) return { index: index + 1, finished: false };
  if (loop) return { index: 0, finished: false };
  return { index, finished: true };
}
