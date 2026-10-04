import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import dayjs from "dayjs";

import {
  menuAvailabilityApi,
  type AvailabilityBoard,
  type AvailabilityRow,
  type OffDuration,
} from "../components/menuAvailability/menuAvailabilityApi";
import { useAppSelector } from "../store/hooks";
import { hasAnyPermission } from "../utils/permissions";
import { useRestaurantSocket } from "../utils/useRestaurantSocket";
import { setVisibleInterval } from "../utils/visibleInterval";
import { useIncrementalList } from "../hooks/useIncrementalList";

type Filter = "ALL" | "ON" | "OFF" | "BLOCKED" | "HIDDEN";
type Toast = { open: boolean; msg: string; type: "success" | "error" | "info" };

const hourLabel = (h: number) => dayjs().hour(h).minute(0).format("h:mm A");

function VegDot({ veg }: { veg?: boolean | null }) {
  if (veg == null) return null;
  const c = veg ? "#2e7d32" : "#b71c1c";
  return (
    <Box
      component="span"
      sx={{ display: "inline-block", width: 13, height: 13, border: `2px solid ${c}`, borderRadius: "3px", position: "relative", mr: 1, flexShrink: 0 }}
    >
      <Box sx={{ position: "absolute", inset: 2, borderRadius: "50%", bgcolor: c }} />
    </Box>
  );
}

/** "back on 4:00 AM tomorrow" / "back on 3:30 PM today" */
function offUntilText(iso: string | null | undefined): string {
  if (!iso) return "Off until you switch it on";
  const d = dayjs(iso);
  const now = dayjs();
  const day = d.isSame(now, "day") ? "today" : d.isSame(now.add(1, "day"), "day") ? "tomorrow" : d.format("D MMM");
  return `Back on ${d.format("h:mm A")} ${day}`;
}

export default function MenuAvailabilityPage() {
  const user = useAppSelector((s) => s.auth.user);
  const canTurnOff = hasAnyPermission(user, ["RESTAURANT_MANAGE", "PRODUCT_EDIT", "KITCHEN_VIEW"]);
  const canTurnOn = hasAnyPermission(user, ["RESTAURANT_MANAGE", "PRODUCT_EDIT"]);

  const [board, setBoard] = useState<AvailabilityBoard | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "success" });
  const showToast = (type: Toast["type"], msg: string) => setToast({ open: true, type, msg });

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [duration, setDuration] = useState<OffDuration>("END_OF_DAY");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState<null | { title: string; body: string; run: () => Promise<void> }>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setBoard(await menuAvailabilityApi.board());
    } catch (e: any) {
      if (!silent) showToast("error", e?.response?.data?.message || e?.message || "Failed to load the menu");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setVisibleInterval(() => load(true), 30_000); // safety net if the live push drops
    return () => clearInterval(t);
  }, [load]);

  // another device changed something (or an item switched itself back on)
  useRestaurantSocket("menu", () => load(true));

  const rows = board?.items ?? [];
  const stateOf = (r: AvailabilityRow): Filter => (!r.active ? "HIDDEN" : r.manualOff ? "OFF" : r.blockReason ? "BLOCKED" : "ON");

  const counts = useMemo(() => {
    const c = { ALL: 0, ON: 0, OFF: 0, BLOCKED: 0, HIDDEN: 0 };
    for (const r of rows) {
      const st = stateOf(r);
      c[st] += 1;
      if (st !== "HIDDEN") c.ALL += 1;
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const st = stateOf(r);
      if (filter === "ALL" ? st === "HIDDEN" : st !== filter) return false;
      if (q && !`${r.name} ${r.categoryName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, filter]);

  const groups = useMemo(() => {
    const m = new Map<string, { categoryId?: number | null; items: AvailabilityRow[] }>();
    for (const r of visible) {
      const g = m.get(r.categoryName) ?? { categoryId: r.categoryId, items: [] };
      g.items.push(r);
      m.set(r.categoryName, g);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  // Build only the first rows; the rest appear as you scroll (a 500-dish menu would otherwise draw ~3000 controls at once).
  const { count: shownCount, sentinel } = useIncrementalList(visible.length, `${query}|${filter}`, 40);
  const shownGroups = useMemo(() => {
    let budget = shownCount;
    const out: [string, { categoryId?: number | null; items: AvailabilityRow[] }, { categoryId?: number | null; items: AvailabilityRow[] }][] = [];
    for (const [cat, g] of groups) {
      if (budget <= 0) break;
      out.push([cat, { ...g, items: g.items.slice(0, budget) }, g]);
      budget -= g.items.length;
    }
    return out;
  }, [groups, shownCount]);

  // ---- actions ----
  const apply = async (payload: Parameters<typeof menuAvailabilityApi.set>[0], okMsg: string) => {
    setBusy(true);
    try {
      setBoard(await menuAvailabilityApi.set({ duration, ...payload }));
      showToast("success", okMsg);
      setSelected(new Set());
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Could not save the change");
      load(true);
    } finally {
      setBusy(false);
    }
  };

  const toggleOne = async (r: AvailabilityRow, on: boolean) => {
    // optimistic: flip instantly so the switch feels immediate on a slow Wi-Fi tablet
    setBoard((b) =>
      b ? { ...b, items: b.items.map((x) => (x.productId === r.productId ? { ...x, manualOff: !on, offUntil: on ? null : x.offUntil } : x)) } : b
    );
    try {
      setBoard(await menuAvailabilityApi.set({ productIds: [r.productId], available: on, duration }));
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Could not save the change");
      load(true);
    }
  };

  const durationHint =
    duration === "MANUAL"
      ? "stays off until you switch it back on"
      : duration === "END_OF_DAY"
      ? `comes back on by itself at ${hourLabel(board?.dayCutoverHour ?? 4)}`
      : duration === "H1"
      ? "comes back on by itself in 1 hour"
      : "comes back on by itself in 2 hours";

  const selIds = Array.from(selected);
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.productId));
  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const onlyThese = () => {
    const keep = new Set(selIds);
    const others = rows.filter((r) => r.active && !keep.has(r.productId) && !r.manualOff).map((r) => r.productId);
    setConfirm({
      title: "Only keep these available?",
      body: `${selIds.length} selected item(s) will be switched ON. ${others.length} other item(s) will be switched OFF (${durationHint}). Handy for a special / rotating menu.`,
      run: async () => {
        await menuAvailabilityApi.set({ productIds: selIds, available: true });
        await apply({ productIds: others.length ? others : undefined, available: false }, "Menu updated");
      },
    });
  };

  const resetAll = () =>
    setConfirm({
      title: "Turn everything back on?",
      body: `All ${counts.OFF} item(s) you switched off will be available again right now.`,
      run: async () => {
        setBusy(true);
        try {
          const r = await menuAvailabilityApi.reset();
          setBoard(r.board);
          showToast("success", `${r.restored} item(s) turned back on`);
        } catch (e: any) {
          showToast("error", e?.response?.data?.message || e?.message || "Could not reset");
        } finally {
          setBusy(false);
        }
      },
    });

  const filterChip = (key: Filter, label: string, color?: "success" | "default" | "warning" | "error") => (
    <Chip
      key={key}
      label={`${label} (${counts[key]})`}
      color={filter === key ? (color && color !== "default" ? color : "primary") : "default"}
      variant={filter === key ? "filled" : "outlined"}
      onClick={() => setFilter(key)}
    />
  );

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, pb: selected.size > 0 ? 14 : 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Menu availability
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Switch dishes on or off. Off dishes disappear from waiters' order screen and the customer QR menu straight away.
          </Typography>
        </Box>
        {canTurnOn && counts.OFF > 0 && (
          <Button variant="outlined" onClick={resetAll} disabled={busy}>
            Turn everything on ({counts.OFF} off)
          </Button>
        )}
      </Stack>

      {/* how long an "off" lasts */}
      {canTurnOff && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              When I switch a dish off:
            </Typography>
            <Select size="small" value={duration} onChange={(e) => setDuration(e.target.value as OffDuration)} sx={{ minWidth: 260 }}>
              <MenuItem value="END_OF_DAY">Rest of today (auto back on at {hourLabel(board?.dayCutoverHour ?? 4)})</MenuItem>
              <MenuItem value="H1">For 1 hour</MenuItem>
              <MenuItem value="H2">For 2 hours</MenuItem>
              <MenuItem value="MANUAL">Until I switch it back on</MenuItem>
            </Select>
            <Typography variant="caption" color="text.secondary">
              → it {durationHint}.
            </Typography>
          </Stack>
        </Paper>
      )}

      {counts.BLOCKED > 0 && filter !== "BLOCKED" && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setFilter("BLOCKED")}>
              Show
            </Button>
          }
        >
          {counts.BLOCKED} dish(es) can't be ordered because an ingredient or stock ran out. Restock them and they come back on their own.
        </Alert>
      )}

      <TextField
        size="small"
        fullWidth
        placeholder="Search dishes or categories"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ mb: 1.5 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />
      <Stack direction="row" spacing={1} sx={{ mb: 1, overflowX: "auto", pb: 0.5 }} alignItems="center">
        {filterChip("ALL", "All")}
        {filterChip("ON", "Available", "success")}
        {filterChip("OFF", "Switched off", "warning")}
        {filterChip("BLOCKED", "Can't make", "error")}
        {counts.HIDDEN > 0 && filterChip("HIDDEN", "Hidden on Menu page")}
      </Stack>

      {canTurnOff && visible.length > 0 && (
        <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
          <Checkbox
            size="small"
            checked={allVisibleSelected}
            indeterminate={!allVisibleSelected && visible.some((r) => selected.has(r.productId))}
            onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((r) => r.productId)) : new Set())}
          />
          <Typography variant="body2" color="text.secondary">
            Select all shown ({visible.length})
          </Typography>
        </Stack>
      )}

      {loading && !board ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : groups.length === 0 ? (
        <Alert severity="info">
          {rows.length === 0 ? "No menu items yet. Add dishes on the Menu page first." : "No dishes match this filter."}
        </Alert>
      ) : (
        <>
        {shownGroups.map(([cat, g, full]) => {
          const on = full.items.filter((r) => r.sellable).length;
          return (
            <Paper key={cat} variant="outlined" sx={{ mb: 2, overflow: "hidden" }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1, bgcolor: "action.hover" }} flexWrap="wrap" gap={1}>
                <Typography sx={{ fontWeight: 900 }}>
                  {cat}{" "}
                  <Typography component="span" variant="body2" color="text.secondary">
                    · {on}/{full.items.length} available
                  </Typography>
                </Typography>
                {canTurnOff && g.categoryId != null && filter !== "HIDDEN" && (
                  <Stack direction="row" spacing={1}>
                    {canTurnOn && (
                      <Button
                        size="small"
                        disabled={busy}
                        onClick={() => apply({ categoryIds: [g.categoryId as number], available: true }, `${cat}: all switched on`)}
                      >
                        All on
                      </Button>
                    )}
                    <Button
                      size="small"
                      color="warning"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({
                          title: `Switch off all of "${cat}"?`,
                          body: `Every dish in this category will be switched off — ${durationHint}.`,
                          run: () => apply({ categoryIds: [g.categoryId as number], available: false }, `${cat}: all switched off`),
                        })
                      }
                    >
                      All off
                    </Button>
                  </Stack>
                )}
              </Stack>

              {g.items.map((r) => {
                const st = stateOf(r);
                const disabled = !r.active || busy || (r.manualOff ? !canTurnOn : !canTurnOff);
                return (
                  <Stack
                    key={r.productId}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ px: 1, py: 0.75, borderTop: "1px solid", borderColor: "divider", opacity: st === "OFF" || st === "HIDDEN" ? 0.75 : 1 }}
                  >
                    {canTurnOff && (
                      <Checkbox size="small" checked={selected.has(r.productId)} onChange={() => toggleSelect(r.productId)} />
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center">
                        <VegDot veg={r.veg} />
                        <Typography sx={{ fontWeight: 700 }} noWrap>
                          {r.name}
                        </Typography>
                        {r.combo && <Chip size="small" label="Combo" variant="outlined" sx={{ ml: 1 }} />}
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mt: 0.25 }}>
                        <Typography variant="caption" color="text.secondary">
                          ₹{r.price.toFixed(2)}
                        </Typography>
                        {st === "OFF" && <Chip size="small" color="warning" label={offUntilText(r.offUntil)} />}
                        {r.blockReason && st !== "HIDDEN" && (
                          <Chip size="small" color="error" variant="outlined" label={`Can't make: ${r.blockReason}`} />
                        )}
                        {st === "ON" && r.portionsLeft != null && (
                          <Chip size="small" variant="outlined" color={r.portionsLeft <= 3 ? "error" : r.portionsLeft <= 8 ? "warning" : "success"} label={`${r.portionsLeft} left`} />
                        )}
                        {st === "ON" && r.shelfQty != null && r.shelfQty <= 5 && (
                          <Chip size="small" variant="outlined" color="warning" label={`${r.shelfQty} in stock`} />
                        )}
                        {st === "HIDDEN" && <Chip size="small" label="Inactive — enable it on the Menu page" />}
                      </Stack>
                    </Box>
                    <Tooltip
                      title={
                        !r.active
                          ? "Hidden from the menu (Menu page)"
                          : disabled && !busy
                          ? r.manualOff
                            ? "Only a manager can switch this back on"
                            : "You can't change availability"
                          : r.manualOff
                          ? "Switch on"
                          : "Switch off"
                      }
                    >
                      <span>
                        <Switch
                          checked={!r.manualOff && r.active}
                          disabled={disabled}
                          color={r.blockReason ? "warning" : "success"}
                          onChange={(_, checked) => toggleOne(r, checked)}
                        />
                      </span>
                    </Tooltip>
                  </Stack>
                );
              })}
            </Paper>
          );
        })}
        {sentinel}
        </>
      )}

      {/* bulk bar */}
      {selected.size > 0 && (
        <Paper
          elevation={8}
          sx={{ position: "fixed", left: { xs: 8, md: "auto" }, right: 8, bottom: { xs: 72, md: 16 }, p: 1.5, zIndex: 1250, maxWidth: { md: 720 }, ml: { md: "auto" } }}
        >
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontWeight: 800, mr: 1 }}>{selected.size} selected</Typography>
            {canTurnOn && (
              <Button variant="contained" color="success" size="small" disabled={busy} onClick={() => apply({ productIds: selIds, available: true }, "Switched on")}>
                Switch on
              </Button>
            )}
            <Button variant="contained" color="warning" size="small" disabled={busy} onClick={() => apply({ productIds: selIds, available: false }, "Switched off")}>
              Switch off
            </Button>
            {canTurnOn && (
              <Button variant="outlined" size="small" disabled={busy} onClick={onlyThese}>
                Only these on
              </Button>
            )}
            <Button size="small" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </Stack>
        </Paper>
      )}

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900 }}>{confirm?.title}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">{confirm?.body}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={async () => {
              const c = confirm;
              setConfirm(null);
              await c?.run();
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3500} onClose={() => setToast((t) => ({ ...t, open: false }))} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert severity={toast.type} onClose={() => setToast((t) => ({ ...t, open: false }))} sx={{ width: "100%" }}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
