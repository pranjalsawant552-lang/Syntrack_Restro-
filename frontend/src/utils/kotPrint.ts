import type { Kot } from "../components/kot/kotApi";

/**
 * Thermal KOT (kitchen order ticket) printing.
 *
 * Why device-level settings: a hotel with ONE device at the counter needs that device to print KOTs for the
 * kitchen; a hotel with a separate kitchen screen must NOT print. The same login can be open on both kinds of
 * device, so "print KOTs here" is remembered per device (localStorage), not per hotel account.
 */
export type KotPrintMode = "OFF" | "AUTO";
export type KotPrintSettings = {
  mode: KotPrintMode; // AUTO = every new KOT prints on this device the moment it is created (by anyone / QR orders too)
  paperMm: 58 | 80;
  copies: number; // 1-3 slips per ticket
  shopName: string; // optional header line
};

const SETTINGS_KEY = "kotPrint.settings.v1";
const PRINTED_KEY = "kotPrint.printed.v1";

export const defaultKotPrintSettings: KotPrintSettings = { mode: "OFF", paperMm: 80, copies: 1, shopName: "" };

export function loadKotPrintSettings(): KotPrintSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultKotPrintSettings };
    const p = JSON.parse(raw);
    return {
      mode: p.mode === "AUTO" ? "AUTO" : "OFF",
      paperMm: p.paperMm === 58 ? 58 : 80,
      copies: Math.min(3, Math.max(1, Number(p.copies) || 1)),
      shopName: typeof p.shopName === "string" ? p.shopName : "",
    };
  } catch {
    return { ...defaultKotPrintSettings };
  }
}

export function saveKotPrintSettings(s: KotPrintSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("kotPrint:settings"));
}

/* ---------- which KOTs this device has already printed (survives refresh / reopening the app) ---------- */
type PrintedMap = Record<string, number>; // kotId -> printedAt (ms)

function readPrinted(): PrintedMap {
  try {
    return JSON.parse(localStorage.getItem(PRINTED_KEY) || "{}") as PrintedMap;
  } catch {
    return {};
  }
}
function writePrinted(m: PrintedMap) {
  // keep 3 days at most so the map never grows forever
  const cutoff = Date.now() - 3 * 24 * 3600 * 1000;
  const trimmed = Object.fromEntries(Object.entries(m).filter(([, t]) => t > cutoff));
  try {
    localStorage.setItem(PRINTED_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full / blocked: worst case a ticket may print twice */
  }
}
export const isKotPrinted = (kotId: number) => kotId in readPrinted();
export function markKotsPrinted(ids: number[]) {
  const m = readPrinted();
  const now = Date.now();
  ids.forEach((id) => (m[String(id)] = now));
  writePrinted(m);
}

/* ---------- slip layout ---------- */
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const typeLabel = (t: string) => (t === "DINE_IN" ? "DINE-IN" : t === "PARCEL" ? "PARCEL" : t === "ONLINE" ? "ONLINE" : t);

function slipHtml(k: Kot, s: KotPrintSettings, reprint: boolean, copyNo: number, copies: number): string {
  const d = new Date(k.createdAt);
  const time = isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
  const items = k.items.filter((i) => i.status !== "VOIDED");
  const totalQty = items.reduce((n, i) => n + i.quantity, 0);
  return `
  <section class="slip">
    ${s.shopName ? `<div class="c small">${esc(s.shopName)}</div>` : ""}
    <div class="c big">KOT ${esc(k.kotNumber)}</div>
    <div class="c station">${esc(k.stationName)}</div>
    ${reprint ? `<div class="c tag">*** REPRINT ***</div>` : ""}
    <div class="line"></div>
    <div class="row"><span class="table">${esc(k.tableLabel)}</span><span>${esc(typeLabel(k.orderType))}</span></div>
    <div class="row small"><span>Order #${esc(k.orderId)}</span><span>${esc(time)}</span></div>
    ${k.waiterName ? `<div class="small">Waiter: ${esc(k.waiterName)}</div>` : ""}
    <div class="line"></div>
    ${items
      .map(
        (i) => `
      <div class="item"><span class="qty">${esc(i.quantity)}</span><span class="name">${esc(i.productName)}</span></div>
      ${i.notes ? `<div class="note">&gt;&gt; ${esc(i.notes)}</div>` : ""}`
      )
      .join("")}
    <div class="line"></div>
    <div class="row small"><span>Items: ${items.length}</span><span>Total qty: ${totalQty}</span></div>
    ${copies > 1 ? `<div class="c small">Copy ${copyNo}/${copies}</div>` : ""}
  </section>`;
}

export function buildKotDocument(kots: Kot[], s: KotPrintSettings, reprint: boolean): string {
  const w = s.paperMm;
  const slips = kots.flatMap((k) =>
    Array.from({ length: s.copies }, (_, c) => slipHtml(k, s, reprint, c + 1, s.copies))
  );
  return `<!doctype html><html><head><meta charset="utf-8"><title>KOT</title>
<style>
  @page { size: ${w}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { width: ${w}mm; font-family: 'Courier New', Courier, monospace; font-weight: 700; font-size: ${w === 58 ? 13 : 15}px; }
  .slip { width: ${w}mm; padding: 2mm ${w === 58 ? 1.5 : 3}mm 6mm; page-break-after: always; break-after: page; }
  .slip:last-child { page-break-after: auto; break-after: auto; }
  .c { text-align: center; }
  .big { font-size: ${w === 58 ? 20 : 24}px; font-weight: 900; }
  .station { font-size: ${w === 58 ? 15 : 17}px; text-transform: uppercase; letter-spacing: 1px; }
  .tag { font-size: 14px; margin-top: 2px; }
  .small { font-size: ${w === 58 ? 11 : 12}px; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .table { font-size: ${w === 58 ? 18 : 22}px; font-weight: 900; }
  .line { border-top: 2px dashed #000; margin: 6px 0; }
  .item { display: flex; gap: 8px; align-items: flex-start; margin: 5px 0 1px; font-size: ${w === 58 ? 16 : 19}px; font-weight: 900; line-height: 1.15; }
  .qty { min-width: ${w === 58 ? 26 : 32}px; }
  .name { flex: 1; word-break: break-word; }
  .note { margin: 0 0 3px ${w === 58 ? 26 : 40}px; font-size: ${w === 58 ? 13 : 15}px; font-style: italic; }
</style></head><body>${slips.join("")}</body></html>`;
}

/* ---------- print through a hidden iframe (no popup window, independent of the app's own print styles) ---------- */
let queue: Promise<void> = Promise.resolve();

function printHtml(html: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", opacity: "0" });
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      setTimeout(() => {
        iframe.remove();
        resolve();
      }, 1500); // let the print job finish spooling before we drop the frame
    };
    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) return cleanup();
      win.onafterprint = cleanup;
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          /* ignore */
        }
        // some browsers never fire afterprint (e.g. kiosk printing) -- don't hold the queue forever
        setTimeout(cleanup, 8000);
      }, 250);
    };
    document.body.appendChild(iframe);
    iframe.srcdoc = html;
  });
}

/** Prints the tickets one after another (one print job per call; queued so two tickets never collide). */
export function printKots(kots: Kot[], opts: { reprint?: boolean; settings?: KotPrintSettings } = {}): Promise<void> {
  const list = kots.filter((k) => k.items.some((i) => i.status !== "VOIDED"));
  if (list.length === 0) return Promise.resolve();
  const s = opts.settings ?? loadKotPrintSettings();
  const html = buildKotDocument(list, s, !!opts.reprint);
  queue = queue.then(() => printHtml(html)).catch(() => {});
  return queue;
}

/** Sample ticket for the settings screen so the paper width / darkness can be checked without a real order. */
export function printTestKot(s: KotPrintSettings) {
  const now = new Date().toISOString();
  const sample: Kot = {
    kotId: 0,
    kotNumber: "TEST-001",
    orderId: 0,
    stationId: 0,
    stationName: "Kitchen",
    tableLabel: "Table 1",
    orderType: "DINE_IN",
    waiterName: "Test",
    status: "NEW",
    createdAt: now,
    elapsedSeconds: 0,
    items: [
      { kotItemId: 1, orderItemId: 1, productName: "Paneer Butter Masala", quantity: 2, notes: "less spicy", status: "NEW" },
      { kotItemId: 2, orderItemId: 2, productName: "Butter Naan", quantity: 4, notes: null, status: "NEW" },
    ],
  };
  return printKots([sample], { settings: s });
}
