import React, { useCallback, useEffect, useState } from "react";
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
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { qrApi, type QrPendingRequest } from "./qrApi";
import { setVisibleInterval } from "../../utils/visibleInterval";

/**
 * Customer orders waiting for a waiter. Accepting one opens the table's real order, adds the items and
 * sends the kitchen ticket -- that is the moment a QR scan turns into real occupancy. Rejecting releases
 * the table's hold (use it for scans from people who aren't actually at the table).
 */
export default function QrRequestsDialog({
  open,
  onClose,
  canManage,
  onChanged,
  refreshKey,
}: {
  open: boolean;
  onClose: () => void;
  canManage: boolean;
  /** called after accept/reject so the tables board can refresh */
  onChanged: () => void;
  /** bump to force a reload (e.g. when the board pushes a new snapshot) */
  refreshKey: number;
}) {
  const [items, setItems] = useState<QrPendingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState<QrPendingRequest | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await qrApi.pending());
      setError("");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to load QR orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
    const t = setVisibleInterval(load, 10_000);
    return () => clearInterval(t);
  }, [open, load, refreshKey]);

  const approve = async (r: QrPendingRequest) => {
    setBusyId(r.requestId);
    try {
      await qrApi.approve(r.requestId);
      setError("");
      await load();
      onChanged();
    } catch (e: any) {
      // e.g. an item ran out meanwhile -- nothing was half-applied, the request stays pending
      setError(e?.response?.data?.message || e?.message || "Could not accept this order");
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.requestId);
    try {
      await qrApi.reject(rejecting.requestId, reason.trim() || undefined);
      setRejecting(null);
      setReason("");
      await load();
      onChanged();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Could not reject");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>QR orders waiting</DialogTitle>
        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          {loading && items.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : items.length === 0 ? (
            <Alert severity="info">No customer orders are waiting right now.</Alert>
          ) : (
            <Stack spacing={2}>
              {items.map((r) => (
                <Paper key={r.requestId} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                    <Typography sx={{ fontWeight: 900 }}>Table {r.tableName}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip
                        size="small"
                        color={r.tableAlreadyOrdering ? "info" : "warning"}
                        label={r.tableAlreadyOrdering ? "Adding to running order" : "New table"}
                      />
                      <Chip size="small" variant="outlined" label={`${Math.max(0, Math.round(r.ageSeconds / 60))} min ago`} />
                    </Stack>
                  </Stack>
                  {!r.tableAlreadyOrdering && (
                    <Typography variant="caption" color="text.secondary">
                      Nobody has been served here yet. Check that a guest is actually seated before accepting.
                    </Typography>
                  )}
                  <Divider sx={{ my: 1 }} />
                  {r.lines.map((l, i) => (
                    <Box key={i} sx={{ mb: 0.5 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">
                          {l.quantity} × {l.name}
                          {l.variantName ? ` (${l.variantName})` : ""}
                        </Typography>
                        <Typography variant="body2">₹{l.lineTotal.toFixed(2)}</Typography>
                      </Stack>
                      {l.optionsText && (
                        <Typography variant="caption" color="text.secondary">
                          + {l.optionsText}
                        </Typography>
                      )}
                      {l.notes && (
                        <Typography variant="caption" color="warning.main" display="block">
                          Note: {l.notes}
                        </Typography>
                      )}
                    </Box>
                  ))}
                  {r.customerNote && (
                    <Typography variant="body2" sx={{ mt: 0.5, fontStyle: "italic" }}>
                      “{r.customerNote}”
                    </Typography>
                  )}
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                    <Typography sx={{ fontWeight: 800 }}>Total ₹{r.total.toFixed(2)}</Typography>
                    {canManage && (
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          disabled={busyId === r.requestId}
                          onClick={() => {
                            setRejecting(r);
                            setReason("");
                          }}
                        >
                          Reject
                        </Button>
                        <Button size="small" variant="contained" disabled={busyId === r.requestId} onClick={() => approve(r)}>
                          {busyId === r.requestId ? "Working…" : "Accept & send to kitchen"}
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!rejecting} onClose={() => setRejecting(null)} fullWidth maxWidth="xs">
        <DialogTitle>Reject order from {rejecting?.tableName}?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            The table's hold is released and the customer sees that staff couldn't accept it. Repeated rejected scans from
            the same phone get it blocked for a while.
          </Typography>
          <TextField
            label="Reason (optional, shown to customer)"
            fullWidth
            size="small"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejecting(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmReject} disabled={busyId !== null}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
