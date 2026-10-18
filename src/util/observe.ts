/**
 * Calls `onMatch` once for every element matching `selector`, now and whenever
 * GitHub adds one later (Turbo navigation, lazily loaded fragments).
 */
export function observe<E extends Element>(selector: string, onMatch: (el: E) => void, signal?: AbortSignal): void {
  const seen = new WeakSet<Element>();
  let scheduled = false;

  const scan = () => {
    scheduled = false;
    let found: NodeListOf<E>;
    try {
      found = document.querySelectorAll<E>(selector);
    } catch {
      return;
    }
    for (const el of found) {
      if (seen.has(el)) continue;
      seen.add(el);
      try {
        onMatch(el);
      } catch (e) {
        console.warn('[Yardmaster]', e);
      }
    }
  };

  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(scan);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  signal?.addEventListener('abort', () => observer.disconnect());
  scan();
}
