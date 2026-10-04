import React, { useEffect, useRef, useState } from "react";

/**
 * "Render as you scroll" for long client-side lists (300+ menu items, ingredients, recipes ...).
 *
 * Only the first `step` rows are put on screen; a tiny sentinel at the bottom adds the next `step` when it comes
 * within ~600px of the visible area, so scrolling never stalls. The browser therefore builds ~50 tiles instead of 500:
 * opening a screen, typing in a search box and toggling filters stay instant however long the menu is.
 * The count returns to `step` whenever `resetKey` changes (new search / filter), so results always start at the top.
 *
 *   const { count, hasMore, sentinel } = useIncrementalList(items.length, `${query}|${category}`);
 *   items.slice(0, count).map(...)   ...   {sentinel}
 */
export function useIncrementalList(total: number, resetKey: string, step = 48) {
  // the count is stored together with the key it belongs to: a new key silently means "start again at step"
  const [state, setState] = useState({ key: resetKey, count: step });
  const count = state.key === resetKey ? state.count : step;
  const hasMore = count < total;
  const nodeRef = useRef<HTMLDivElement | null>(null);

  // The observer is re-created after every chunk. A new IntersectionObserver reports the sentinel's current position
  // straight away, so on a tall screen chunks keep arriving until the sentinel is far below the fold.
  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !hasMore || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setState((s) => {
          const cur = s.key === resetKey ? s.count : step;
          return cur < total ? { key: resetKey, count: cur + step } : s;
        });
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [count, hasMore, total, resetKey, step]);

  const sentinel = hasMore ? <div ref={nodeRef} style={{ height: 1 }} aria-hidden /> : null;
  return { count: Math.min(count, Math.max(total, 0)), hasMore, sentinel };
}
