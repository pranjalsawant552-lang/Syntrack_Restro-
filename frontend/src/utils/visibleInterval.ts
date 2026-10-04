/**
 * setInterval that does nothing while the browser tab is hidden or the screen is off.
 * Many tablets/phones stay logged in all day; without this every idle device keeps hitting the server on every tick.
 * (Live updates still arrive over the WebSocket, and the next tick after the tab is shown refreshes everything.)
 * Returns the normal interval id, so plain clearInterval(id) works.
 */
export function setVisibleInterval(fn: () => void, ms: number): number {
  return window.setInterval(() => {
    if (typeof document === "undefined" || !document.hidden) fn();
  }, ms);
}
