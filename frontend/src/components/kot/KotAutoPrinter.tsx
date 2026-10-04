import { useCallback, useEffect } from "react";
import { kotApi, type Kot } from "./kotApi";
import { useRestaurantSocket } from "../../utils/useRestaurantSocket";
import { isKotPrinted, loadKotPrintSettings, markKotsPrinted, printKots } from "../../utils/kotPrint";
import { useAppSelector } from "../../store/hooks";
import { hasPermission } from "../../utils/permissions";

const FRESH_MS = 15 * 60 * 1000; // only auto-print tickets created in the last 15 min (never dump an old backlog on start-up)

/**
 * Mounted once in the app shell. When "Print KOTs on this device" is ON, every brand-new KOT is printed here the
 * moment it is created -- whether the waiter tapped "Send to kitchen" on this screen, on another phone, or a
 * customer's QR order was accepted. Renders nothing.
 *
 * Duplicate protection: printed ticket ids are remembered on this device; a KOT is only ever auto-printed once here.
 */
export default function KotAutoPrinter() {
  const user = useAppSelector((s) => s.auth.user);
  const allowed =
    !!user &&
    !user.superAdmin &&
    (hasPermission(user, "KITCHEN_VIEW") || hasPermission(user, "RESTAURANT_MANAGE") || hasPermission(user, "RESTAURANT_VIEW"));
  // the "active tickets" endpoint needs KITCHEN_VIEW; without it the live socket push (and the print-on-send path) still work
  const canPoll = !!user && hasPermission(user, "KITCHEN_VIEW");

  const handle = useCallback(async (rows: Kot[]) => {
    const s = loadKotPrintSettings();
    if (s.mode !== "AUTO") return;
    const now = Date.now();
    const todo = rows
      .filter((k) => k.status !== "CANCELLED" && !isKotPrinted(k.kotId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (todo.length === 0) return;
    // Claim them synchronously BEFORE printing: two pushes (or the socket + the poll) can never print the same ticket.
    markKotsPrinted(todo.map((k) => k.kotId));
    // Tickets older than 15 minutes are only marked (never dumped on the printer after a restart).
    const fresh = todo.filter((k) => now - new Date(k.createdAt).getTime() <= FRESH_MS);
    if (fresh.length) await printKots(fresh, { settings: s });
  }, []);

  useRestaurantSocket<Kot[]>("kots", (rows) => {
    if (allowed && Array.isArray(rows)) handle(rows);
  });

  // safety net if the socket drops (same idea as the other screens' polling)
  useEffect(() => {
    if (!canPoll) return;
    const poll = () => {
      if (loadKotPrintSettings().mode !== "AUTO") return;
      kotApi.active().then(handle).catch(() => {});
    };
    poll();
    const t = setInterval(poll, 15_000);
    window.addEventListener("kotPrint:settings", poll);
    return () => {
      clearInterval(t);
      window.removeEventListener("kotPrint:settings", poll);
    };
  }, [canPoll, handle]);

  return null;
}
