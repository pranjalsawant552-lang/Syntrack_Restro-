import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, IconButton,
  MenuItem, Snackbar, Stack, TextField, Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PrintIcon from "@mui/icons-material/Print";
import { printKots } from "../../utils/kotPrint";

import { kotApi, type Kot, type Station } from "../../components/kot/kotApi";
import { useRestaurantSocket } from "../../utils/useRestaurantSocket";
import { setVisibleInterval } from "../../utils/visibleInterval";
import { useNavigate } from "react-router-dom";

type Toast = { open: boolean; msg: string; type: "success" | "error" };

const STATUS_COLOR: Record<string, "default" | "warning" | "success"> = {
  NEW: "default", PREPARING: "warning", READY: "success",
};

function elapsedLabel(seconds: number) {
  const m = Math.floor(seconds / 60);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function KitchenDisplayPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Kot[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "success" });
  const showToast = (type: Toast["type"], msg: string) => setToast({ open: true, type, msg });

  const load = async () => {
    setLoading(true);
    try {
      setTickets(await kotApi.active(stationId === "" ? undefined : stationId));
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to load kitchen queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { kotApi.stations().then(setStations).catch(() => {}); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); const t = setVisibleInterval(load, 20_000); return () => clearInterval(t); }, [stationId]);
  const [, forceTick] = useState(0);
  useEffect(() => { const t = setInterval(() => forceTick((n) => n + 1), 15_000); return () => clearInterval(t); }, []);

  // Live push: a new/updated ticket lands the instant a waiter sends a KOT or the kitchen updates one.
  useRestaurantSocket<Kot[]>("kots", (rows) => setTickets(stationId === "" ? rows : rows.filter((k) => k.stationId === stationId)));

  const start = async (kotId: number) => {
    try { await kotApi.start(kotId); } catch (e: any) { showToast("error", e?.response?.data?.message || "Failed to start"); load(); }
  };
  const ready = async (kotId: number) => {
    try { await kotApi.ready(kotId); load(); /* ready = done: ticket leaves the screen */ } catch (e: any) { showToast("error", e?.response?.data?.message || "Failed to mark ready"); load(); }
  };

  const sorted = useMemo(() => [...tickets].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [tickets]);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>Kitchen Display</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" variant="outlined" color="warning" onClick={() => navigate("/menu-availability")}>
            Mark a dish out
          </Button>
          {stations.length > 1 && (
            <TextField select size="small" label="Station" value={stationId} onChange={(e) => setStationId(e.target.value === "" ? "" : Number(e.target.value))} sx={{ minWidth: 160 }}>
              <MenuItem value="">All stations</MenuItem>
              {stations.map((s) => <MenuItem key={s.stationId} value={s.stationId}>{s.name}</MenuItem>)}
            </TextField>
          )}
          <IconButton onClick={load} disabled={loading}><RefreshIcon /></IconButton>
        </Stack>
      </Stack>

      {loading && sorted.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
      ) : sorted.length === 0 ? (
        <Alert severity="success">Kitchen queue is clear — nothing waiting.</Alert>
      ) : (
        <Grid container spacing={2}>
          {sorted.map((k) => {
            const liveSeconds = k.elapsedSeconds;
            const borderColor = k.status === "READY" ? "#2e7d32" : k.status === "PREPARING" ? "#ed6c02" : "#1976d2";
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={k.kotId}>
                <Card variant="outlined" sx={{ borderTop: `4px solid ${borderColor}` }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{k.tableLabel}</Typography>
                        <Typography variant="caption" color="text.secondary">{k.kotNumber} · {k.stationName}{k.waiterName ? ` · ${k.waiterName}` : ""}</Typography>
                      </Box>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <IconButton size="small" title="Print this KOT" onClick={() => printKots([k], { reprint: true })}>
                          <PrintIcon fontSize="small" />
                        </IconButton>
                        <Chip size="small" color={k.elapsedSeconds > 900 ? "error" : "default"} label={elapsedLabel(liveSeconds)} />
                      </Stack>
                    </Stack>
                    <Stack spacing={1}>
                      {k.items.filter((i) => i.status !== "VOIDED").map((it) => (
                        <Stack key={it.kotItemId} direction="row" alignItems="center" justifyContent="space-between" sx={{ borderBottom: "1px dashed #ddd", pb: 1 }}>
                          <Box>
                            <Typography sx={{ fontWeight: 700, textDecoration: it.status === "SERVED" ? "line-through" : "none" }}>
                              {it.quantity} × {it.productName}
                            </Typography>
                            {it.notes && <Chip size="small" color="warning" variant="outlined" label={it.notes} sx={{ mt: 0.5 }} />}
                          </Box>
                          <Chip size="small" label={it.status} color={STATUS_COLOR[it.status] ?? "default"} />
                        </Stack>
                      ))}
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      {k.status === "NEW" && (
                        <Button fullWidth size="small" variant="contained" color="warning" startIcon={<PlayArrowIcon />} onClick={() => start(k.kotId)}>
                          Start preparing
                        </Button>
                      )}
                      {(k.status === "NEW" || k.status === "PREPARING") && (
                        <Button fullWidth size="small" variant="contained" color="success" startIcon={<CheckCircleIcon />} onClick={() => ready(k.kotId)}>
                          Mark ready
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast.type} variant="filled">{toast.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
