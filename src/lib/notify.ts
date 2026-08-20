const listeners = new Set<() => void>();

export function subscribeData(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyData(): void {
  for (const listener of listeners) listener();
}
