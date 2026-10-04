import React, { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { qrApi, qrFullUrl, type QrApprovalMode, type QrSettings, type QrTableInfo } from "./qrApi";
import type { TableBoardRow } from "./restaurantApi";

const fmt = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.max(0, secs % 60)).padStart(2, "0")}`;

async function makeQrDataUrl(url: string, width = 360): Promise<string> {
  return QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width });
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Opens a print-ready sheet of table-tent cards (one per table, two per row on A4). */
async function printCards(tables: QrTableInfo[], restaurantName: string, sessionMinutes: number) {
  const cards = await Promise.all(
    tables.map(async (t) => {
      const img = await makeQrDataUrl(qrFullUrl(t.path), 600);
      return `<div class="card">
        <div class="brand">${escapeHtml(restaurantName)}</div>
        <img src="${img}" />
        <div class="scan">Scan to order</div>
        <div class="table">Table ${escapeHtml(t.tableName)}</div>
        <div class="hint">Order from your phone. Pay at the counter / to our staff.</div>
      </div>`;
    })
  );
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><title>Table QR codes</title><style>
    @page { size: A4; margin: 10mm; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
    .card { border: 2px dashed #999; border-radius: 6mm; padding: 6mm; text-align: center; page-break-inside: avoid; }
    .brand { font-size: 16pt; font-weight: 800; }
    img { width: 62mm; height: 62mm; margin: 3mm 0; }
    .scan { font-size: 15pt; font-weight: 700; }
    .table { font-size: 22pt; font-weight: 900; margin-top: 2mm; }
    .hint { font-size: 9pt; color: #555; margin-top: 3mm; }
  </style></head><body><div class="grid">${cards.join("")}</div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
  </body></html>`);
  w.document.close();
  void sessionMinutes;
  return true;
}

export default function QrManagerDialog({
  open,
  onClose,
  canManage,
  canEditSettings,
  restaurantName,
  boardRows,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  canEditSettings: boolean;
  restaurantName: string;
  boardRows: TableBoardRow[];
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<"live" | "codes" | "settings">("codes");
  const [tables, setTables] = useState<QrTableInfo[]>([]);
  const [qrImages, setQrImages] = useState<Record<number, string>>({});
  const [settings, setSettings] = useState<QrSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rotateTarget, setRotateTarget] = useState<QrTableInfo | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([qrApi.tables(), qrApi.settings()]);
      setTables(t);
      setSettings(s);
      const entries = await Promise.all(t.map(async (x) => [x.tableId, await makeQrDataUrl(qrFullUrl(x.path))] as const));
      setQrImages(Object.fromEntries(entries));
    } catch (e: any) {
      setMsg({ type: "error", text: e?.response?.data?.message || e?.message || "Failed to load QR codes" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const liveRows = useMemo(() => boardRows.filter((r) => r.qrState), [boardRows]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg({ type: "success", text: ok });
      onChanged();
    } catch (e: any) {
      setMsg({ type: "error", text: e?.response?.data?.message || e?.message || "Action failed" });
    }
  };

  const downloadPng = (t: QrTableInfo) => {
    const a = document.createElement("a");
    a.href = qrImages[t.tableId];
    a.download = `table-${t.tableName.replace(/[^a-z0-9]+/gi, "-")}-qr.png`;
    a.click();
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      setSettings(await qrApi.updateSettings(settings));
      setMsg({ type: "success", text: "QR settings saved" });
    } catch (e: any) {
      setMsg({ type: "error", text: e?.response?.data?.message || e?.message || "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const doRotate = async () => {
    if (!rotateTarget) return;
    const t = rotateTarget;
    setRotateTarget(null);
    await run(async () => {
      await qrApi.rotate(t.tableId);
      await load();
    }, `New QR generated for ${t.tableName}. Print and replace the old one.`);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>QR ordering</DialogTitle>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab value="codes" label="Table QR codes" />
          <Tab value="live" label={`Live sessions${liveRows.length ? ` (${liveRows.length})` : ""}`} />
          <Tab value="settings" label="Settings" />
        </Tabs>
        <DialogContent dividers>
          {msg && (
            <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>
              {msg.text}
            </Alert>
          )}
          {loading && tables.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : tab === "codes" ? (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Stick each QR on its table. A customer scans it, taps <b>Start ordering</b>, and orders from their phone.
                Bills are always settled by your staff. If a QR photo is shared online, use <b>New QR</b> to invalidate it.
              </Alert>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
                <Typography variant="body2" color="text.secondary">
                  QR links point to: <b>{qrFullUrl("")}</b>
                </Typography>
                <Button
                  variant="contained"
                  disabled={tables.length === 0}
                  onClick={async () => {
                    const ok = await printCards(tables, restaurantName, settings?.sessionMinutes ?? 120);
                    if (!ok) setMsg({ type: "error", text: "Allow pop-ups to print the QR sheet" });
                  }}
                >
                  Print all
                </Button>
              </Stack>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
                {tables.map((t) => (
                  <Paper key={t.tableId} variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
                    <Typography sx={{ fontWeight: 900 }}>Table {t.tableName}</Typography>
                    {t.section && (
                      <Typography variant="caption" color="text.secondary">
                        {t.section}
                      </Typography>
                    )}
                    {qrImages[t.tableId] ? (
                      <Box component="img" src={qrImages[t.tableId]} alt={`QR for table ${t.tableName}`} sx={{ width: "100%", maxWidth: 200, display: "block", mx: "auto" }} />
                    ) : (
                      <CircularProgress size={20} />
                    )}
                    <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" sx={{ mt: 0.5 }}>
                      <Button size="small" onClick={() => downloadPng(t)}>
                        PNG
                      </Button>
                      <Button size="small" onClick={() => printCards([t], restaurantName, settings?.sessionMinutes ?? 120)}>
                        Print
                      </Button>
                      {canManage && (
                        <Button size="small" color="warning" onClick={() => setRotateTarget(t)}>
                          New QR
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </>
          ) : tab === "live" ? (
            liveRows.length === 0 ? (
              <Alert severity="info">No customer is using a QR session right now.</Alert>
            ) : (
              <Stack spacing={1.5}>
                {liveRows.map((r) => (
                  <Paper key={r.tableId} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                      <Box>
                        <Typography sx={{ fontWeight: 900 }}>Table {r.tableName}</Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap">
                          <Chip
                            size="small"
                            color={r.qrState === "ACTIVE" ? "success" : "warning"}
                            label={r.qrState === "ACTIVE" ? "Customer ordering" : "Scanned – not confirmed"}
                          />
                          {r.qrSecondsLeft != null && (
                            <Chip size="small" variant="outlined" label={`${fmt(r.qrSecondsLeft)} left`} />
                          )}
                          {r.qrBillRequested && <Chip size="small" color="error" label="Bill requested" />}
                        </Stack>
                      </Box>
                      {canManage && (
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {r.qrBillRequested && (
                            <Button size="small" onClick={() => run(() => qrApi.dismissBillRequest(r.tableId), "Bill request cleared")}>
                              Clear bill request
                            </Button>
                          )}
                          <Button size="small" variant="outlined" onClick={() => run(() => qrApi.extend(r.tableId, 30), "Added 30 minutes")}>
                            +30 min
                          </Button>
                          <Button size="small" color="error" variant="outlined" onClick={() => run(() => qrApi.end(r.tableId), "QR session ended")}>
                            End QR session
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                ))}
                <Typography variant="caption" color="text.secondary">
                  Ending a session only stops the customer from ordering more on their phone. Their order stays on the table
                  and is settled by you as usual.
                </Typography>
              </Stack>
            )
          ) : settings ? (
            <Stack spacing={2.5}>
              {!canEditSettings && <Alert severity="info">You can view these settings; only an admin can change them.</Alert>}
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.enabled}
                    disabled={!canEditSettings}
                    onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  />
                }
                label="QR ordering is ON (switch off to stop all customers ordering from their phones)"
              />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                  Staff approval (protects against fake table occupancy)
                </Typography>
                <Select
                  size="small"
                  fullWidth
                  disabled={!canEditSettings}
                  value={settings.approvalMode}
                  onChange={(e) => setSettings({ ...settings, approvalMode: e.target.value as QrApprovalMode })}
                >
                  <MenuItem value="FIRST_ORDER">Recommended – a waiter accepts the FIRST order of each table</MenuItem>
                  <MenuItem value="EVERY_ORDER">Strict – a waiter accepts EVERY order</MenuItem>
                  <MenuItem value="NONE">Off – orders go straight to the kitchen (a fake scan could send food to an empty table)</MenuItem>
                </Select>
              </Box>
              <Divider />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Hold after scan (minutes)"
                  type="number"
                  size="small"
                  fullWidth
                  disabled={!canEditSettings}
                  helperText="A scan that never turns into an order releases the table after this long (1–30)."
                  value={settings.holdMinutes}
                  onChange={(e) => setSettings({ ...settings, holdMinutes: Number(e.target.value) })}
                />
                <TextField
                  label="Ordering session length (minutes)"
                  type="number"
                  size="small"
                  fullWidth
                  disabled={!canEditSettings}
                  helperText="How long a customer can keep ordering once their table is accepted (15–480). You can extend it per table."
                  value={settings.sessionMinutes}
                  onChange={(e) => setSettings({ ...settings, sessionMinutes: Number(e.target.value) })}
                />
              </Stack>
              {canEditSettings && (
                <Box>
                  <Button variant="contained" onClick={saveSettings} disabled={saving}>
                    {saving ? "Saving…" : "Save settings"}
                  </Button>
                </Box>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!rotateTarget} onClose={() => setRotateTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Generate a new QR for table {rotateTarget?.tableName}?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            The old printed QR stops working immediately and any customer session on this table is ended (their order stays
            on the table). Print the new QR and replace the sticker.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRotateTarget(null)}>Cancel</Button>
          <Button color="warning" variant="contained" onClick={doRotate}>
            Generate new QR
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
