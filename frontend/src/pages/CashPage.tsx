import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

import { cashApi, type CashShift } from "../components/cash/cashApi";
import { useAppSelector } from "../store/hooks";
import { hasPermission } from "../utils/permissions";
import { useIncrementalList } from "../hooks/useIncrementalList";

const inr = (n?: number | null) => `₹${Number(n ?? 0).toFixed(2)}`;
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

const NOTES = [500, 200, 100, 50, 20, 10, 5, 2, 1];

const errText = (e: any, fb: string) =>
  e?.response?.data?.message || e?.response?.data?.error || (typeof e?.response?.data === "string" ? e.response.data : "") || e?.message || fb;

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.4 }}>
      <Typography sx={{ fontWeight: bold ? 900 : 500 }}>{label}</Typography>
      <Typography sx={{ fontWeight: bold ? 900 : 700, color }}>{value}</Typography>
    </Stack>
  );
}

export default function CashPage() {
  const user = useAppSelector((s) => s.auth.user);
  const canManage = hasPermission(user, "CASH_MANAGE");

  const [shift, setShift] = useState<CashShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<CashShift[]>([]);
  const { count: shiftsShown, sentinel: shiftsSentinel } = useIncrementalList(history.length, `${history.length}`, 30); // long date ranges: draw 30 shifts, more while scrolling
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(todayStr());
  const [toast, setToast] = useState<{ open: boolean; msg: string; type: "success" | "error" }>({ open: false, msg: "", type: "success" });
  const say = (type: "success" | "error", msg: string) => setToast({ open: true, type, msg });

  // dialogs
  const [openDlg, setOpenDlg] = useState(false);
  const [floatAmt, setFloatAmt] = useState("");
  const [openNotes, setOpenNotes] = useState("");
  const [moveDlg, setMoveDlg] = useState(false);
  const [moveType, setMoveType] = useState<"IN" | "OUT">("OUT");
  const [moveAmt, setMoveAmt] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const [closeDlg, setCloseDlg] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [countedManual, setCountedManual] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewShift, setViewShift] = useState<CashShift | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setShift(await cashApi.current());
      setHistory((await cashApi.history(from, to)).filter((s) => s.status === "CLOSED"));
    } catch (e: any) {
      say("error", errText(e, "Failed to load cash shifts"));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  // if notes are entered by denomination, the total is their sum; otherwise the typed total is used
  const countedFromNotes = useMemo(
    () => NOTES.reduce((s, n) => s + n * (parseInt(counts[String(n)] || "0", 10) || 0), 0),
    [counts]
  );
  const usingNotes = Object.values(counts).some((v) => v && v !== "0");
  const counted = usingNotes ? countedFromNotes : parseFloat(countedManual);
  const variance = shift && Number.isFinite(counted) ? Math.round((counted - shift.expectedCash) * 100) / 100 : null;

  const doOpen = async () => {
    setBusy(true);
    try {
      await cashApi.open(parseFloat(floatAmt) || 0, openNotes || undefined);
      setOpenDlg(false);
      setFloatAmt("");
      setOpenNotes("");
      say("success", "Shift opened");
      await load();
    } catch (e: any) {
      say("error", errText(e, "Could not open shift"));
    } finally {
      setBusy(false);
    }
  };

  const doMove = async () => {
    if (!shift) return;
    setBusy(true);
    try {
      await cashApi.addMovement(shift.shiftId, moveType, parseFloat(moveAmt) || 0, moveReason);
      setMoveDlg(false);
      setMoveAmt("");
      setMoveReason("");
      say("success", "Recorded");
      await load();
    } catch (e: any) {
      say("error", errText(e, "Could not record"));
    } finally {
      setBusy(false);
    }
  };

  const doClose = async () => {
    if (!shift || !Number.isFinite(counted)) return say("error", "Enter the counted cash");
    setBusy(true);
    try {
      const denoms = usingNotes ? JSON.stringify(Object.fromEntries(Object.entries(counts).filter(([, v]) => v && v !== "0"))) : undefined;
      const closed = await cashApi.close(shift.shiftId, counted, closeNotes || undefined, denoms);
      setCloseDlg(false);
      setCounts({});
      setCountedManual("");
      setCloseNotes("");
      say("success", closed.variance === 0 ? "Shift closed — drawer matches exactly" : `Shift closed — variance ${inr(closed.variance)}`);
      setViewShift(closed);
      await load();
    } catch (e: any) {
      say("error", errText(e, "Could not close shift"));
    } finally {
      setBusy(false);
    }
  };

  const varColor = (v?: number | null) => (v == null || v === 0 ? "success.main" : v < 0 ? "error.main" : "warning.main");

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>Cash Drawer</Typography>
        <IconButton onClick={load} disabled={loading}><RefreshIcon /></IconButton>
      </Stack>

      {loading && !shift && <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>}

      {!loading && !shift && (
        <Alert
          severity="info"
          action={canManage && <Button color="inherit" size="small" onClick={() => setOpenDlg(true)}>Open shift</Button>}
          sx={{ mb: 3 }}
        >
          The till is closed. Open a shift with your starting cash (float) to begin tracking the drawer.
        </Alert>
      )}

      {shift && (
        <Card variant="outlined" sx={{ mb: 3, borderTop: "4px solid #2e7d32" }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>Shift #{shift.shiftId} <Chip size="small" color="success" label="OPEN" /></Typography>
                <Typography variant="body2" color="text.secondary">Opened {fmt(shift.openedAt)} by {shift.openedBy}</Typography>
              </Box>
              {canManage && (
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" onClick={() => setMoveDlg(true)}>Cash in / out</Button>
                  <Button variant="contained" color="error" onClick={() => setCloseDlg(true)}>Close shift</Button>
                </Stack>
              )}
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            <Row label="Opening float" value={inr(shift.openingFloat)} />
            <Row label={`Cash sales (${shift.invoiceCount} bills in shift)`} value={`+ ${inr(shift.cashSales)}`} />
            <Row label="Cash in" value={`+ ${inr(shift.cashIn)}`} />
            <Row label="Cash out" value={`− ${inr(shift.cashOut)}`} />
            <Divider sx={{ my: 1 }} />
            <Row label="Cash that should be in the drawer" value={inr(shift.expectedCash)} bold />
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary">Not in the drawer</Typography>
            <Row label="Card" value={inr(shift.cardSales)} />
            <Row label="UPI" value={inr(shift.upiSales)} />
            {shift.pendingSales > 0 && <Row label="Billed but unpaid (pending)" value={inr(shift.pendingSales)} />}

            {shift.movements.length > 0 && (
              <>
                <Divider sx={{ my: 1.5 }} />
                <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Cash in / out</Typography>
                {shift.movements.map((m) => (
                  <Stack key={m.movementId} direction="row" justifyContent="space-between">
                    <Typography variant="body2">
                      <Chip size="small" label={m.type} color={m.type === "IN" ? "success" : "warning"} sx={{ mr: 1 }} />
                      {m.reason} <span style={{ color: "#777" }}>· {m.createdBy} · {new Date(m.createdAt).toLocaleTimeString()}</span>
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{m.type === "IN" ? "+" : "−"} {inr(m.amount)}</Typography>
                  </Stack>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
          <Typography sx={{ fontWeight: 900, mr: 1 }}>Closed shifts</Typography>
          <TextField size="small" type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Stack>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell><TableCell>Opened</TableCell><TableCell>Closed by</TableCell>
                <TableCell align="right">Expected</TableCell><TableCell align="right">Counted</TableCell><TableCell align="right">Variance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.length === 0 && <TableRow><TableCell colSpan={6}><Typography color="text.secondary" variant="body2">No closed shifts in this range.</Typography></TableCell></TableRow>}
              {history.slice(0, shiftsShown).map((s) => (
                <TableRow key={s.shiftId} hover sx={{ cursor: "pointer" }} onClick={() => setViewShift(s)}>
                  <TableCell>{s.shiftId}</TableCell>
                  <TableCell>{fmt(s.openedAt)}</TableCell>
                  <TableCell>{s.closedBy}</TableCell>
                  <TableCell align="right">{inr(s.expectedCash)}</TableCell>
                  <TableCell align="right">{inr(s.countedCash)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: varColor(s.variance) }}>
                    {(s.variance ?? 0) > 0 ? "+" : ""}{inr(s.variance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        {shiftsSentinel}
      </Paper>

      {/* OPEN */}
      <Dialog open={openDlg} onClose={() => setOpenDlg(false)} fullWidth maxWidth="xs">
        <DialogTitle>Open cash shift</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Opening float (₹)" value={floatAmt} autoFocus inputMode="decimal" onChange={(e) => setFloatAmt(e.target.value.replace(/[^0-9.]/g, ""))} helperText="Cash already in the drawer for giving change" />
            <TextField label="Notes (optional)" value={openNotes} onChange={(e) => setOpenNotes(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={doOpen} disabled={busy}>Open shift</Button>
        </DialogActions>
      </Dialog>

      {/* MOVEMENT */}
      <Dialog open={moveDlg} onClose={() => setMoveDlg(false)} fullWidth maxWidth="xs">
        <DialogTitle>Cash in / out</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Select size="small" value={moveType} onChange={(e) => setMoveType(e.target.value as any)}>
              <MenuItem value="OUT">Cash taken out (petty cash, supplier payment...)</MenuItem>
              <MenuItem value="IN">Cash put in (change top-up...)</MenuItem>
            </Select>
            <TextField label="Amount (₹)" value={moveAmt} inputMode="decimal" onChange={(e) => setMoveAmt(e.target.value.replace(/[^0-9.]/g, ""))} />
            <TextField label="Reason (required)" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveDlg(false)}>Cancel</Button>
          <Button variant="contained" onClick={doMove} disabled={busy}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* CLOSE */}
      <Dialog open={closeDlg} onClose={() => setCloseDlg(false)} fullWidth maxWidth="xs">
        <DialogTitle>Close shift & count cash</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {shift && shift.runningOrders > 0 && (
              <Alert severity="warning">
                {shift.runningOrders} order(s) are still open. Anything settled after you close will fall into the next shift.
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary">Count the notes in the drawer (or type the total below).</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
              {NOTES.map((n) => (
                <TextField key={n} size="small" label={`₹${n} ×`} value={counts[String(n)] ?? ""} inputMode="numeric"
                  onChange={(e) => setCounts((c) => ({ ...c, [String(n)]: e.target.value.replace(/[^0-9]/g, "") }))} />
              ))}
            </Box>
            <TextField
              size="small"
              label="Total counted (₹)"
              value={usingNotes ? String(countedFromNotes) : countedManual}
              disabled={usingNotes}
              inputMode="decimal"
              onChange={(e) => setCountedManual(e.target.value.replace(/[^0-9.]/g, ""))}
              helperText={usingNotes ? "Calculated from the notes above" : undefined}
            />
            <Divider />
            <Row label="Expected" value={inr(shift?.expectedCash)} />
            <Row label="Counted" value={Number.isFinite(counted) ? inr(counted) : "—"} />
            <Row label={variance == null ? "Variance" : variance === 0 ? "Matches" : variance < 0 ? "Short by" : "Over by"}
              value={variance == null ? "—" : inr(Math.abs(variance))} bold color={variance == null ? undefined : variance === 0 ? "success.main" : variance < 0 ? "error.main" : "warning.main"} />
            {variance != null && variance !== 0 && (
              <TextField label="Explain the difference (required)" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} multiline minRows={2} />
            )}
            {(variance == null || variance === 0) && (
              <TextField size="small" label="Notes (optional)" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDlg(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={doClose}
            disabled={busy || !Number.isFinite(counted) || (variance != null && variance !== 0 && !closeNotes.trim())}>
            Close shift
          </Button>
        </DialogActions>
      </Dialog>

      {/* CLOSED SHIFT DETAIL */}
      <Dialog open={!!viewShift} onClose={() => setViewShift(null)} fullWidth maxWidth="xs">
        <DialogTitle>Shift #{viewShift?.shiftId} — summary</DialogTitle>
        <DialogContent dividers>
          {viewShift && (
            <>
              <Typography variant="body2" color="text.secondary">{fmt(viewShift.openedAt)} → {fmt(viewShift.closedAt)} · closed by {viewShift.closedBy}</Typography>
              <Divider sx={{ my: 1 }} />
              <Row label="Opening float" value={inr(viewShift.openingFloat)} />
              <Row label={`Cash sales (${viewShift.invoiceCount} bills)`} value={inr(viewShift.cashSales)} />
              <Row label="Cash in" value={inr(viewShift.cashIn)} />
              <Row label="Cash out" value={inr(viewShift.cashOut)} />
              <Row label="Expected cash" value={inr(viewShift.expectedCash)} bold />
              <Row label="Counted cash" value={inr(viewShift.countedCash)} bold />
              <Row label="Variance" value={inr(viewShift.variance)} bold color={(viewShift.variance ?? 0) === 0 ? "success.main" : (viewShift.variance ?? 0) < 0 ? "error.main" : "warning.main"} />
              <Divider sx={{ my: 1 }} />
              <Row label="Card" value={inr(viewShift.cardSales)} />
              <Row label="UPI" value={inr(viewShift.upiSales)} />
              {viewShift.closeNotes && <Alert severity="info" sx={{ mt: 1 }}>{viewShift.closeNotes}</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewShift(null)}>Close</Button></DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast((t) => ({ ...t, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast.type} variant="filled">{toast.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
