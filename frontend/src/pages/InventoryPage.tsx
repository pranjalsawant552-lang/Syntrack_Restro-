import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useIncrementalList } from "../hooks/useIncrementalList";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper,
  Snackbar, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs,
  TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useAppSelector } from "../store/hooks";
import { hasPermission } from "../utils/permissions";
import {
  errMsg, inventoryApi, UNITS_FOR_BASE,
  type Alerts, type Batch, type Ingredient, type Movement,
} from "../components/inventory/inventoryApi";

type Toast = { open: boolean; msg: string; type: "success" | "error" };
type Action = { kind: "receive" | "wastage" | "count"; ing: Ingredient } | null;

const fmt = (n: number | null | undefined, d = 2) =>
  n == null ? "-" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: d });

const statusColor = (s: Ingredient["status"]) =>
  s === "OK" ? "success" : s === "LOW" ? "warning" : "error";

export default function InventoryPage() {
  const user = useAppSelector((s) => s.auth.user);
  const canManage = hasPermission(user, "INVENTORY_MANAGE");
  const canAdjust = hasPermission(user, "INVENTORY_ADJUST");

  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [moves, setMoves] = useState<Movement[]>([]);
  const [moveType, setMoveType] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "success" });
  const [action, setAction] = useState<Action>(null);
  const [editing, setEditing] = useState<Ingredient | "new" | null>(null);
  const [batchesFor, setBatchesFor] = useState<{ ing: Ingredient; rows: Batch[] } | null>(null);

  const say = (msg: string, type: Toast["type"] = "success") => setToast({ open: true, msg, type });

  const loadItems = useCallback(async () => {
    setLoading(true);
    try { setItems(await inventoryApi.listIngredients(search || undefined)); }
    catch (e) { say(errMsg(e, "Failed to load ingredients"), "error"); }
    finally { setLoading(false); }
  }, [search]);

  const loadAlerts = useCallback(async () => {
    try { setAlerts(await inventoryApi.alerts(7)); } catch (e) { say(errMsg(e), "error"); }
  }, []);

  const loadMoves = useCallback(async () => {
    try { setMoves(await inventoryApi.movements({ type: moveType || undefined })); }
    catch (e) { say(errMsg(e), "error"); }
  }, [moveType]);

  useEffect(() => { const t = setTimeout(loadItems, 250); return () => clearTimeout(t); }, [loadItems]);
  useEffect(() => { if (tab === 1) loadAlerts(); }, [tab, loadAlerts]);
  useEffect(() => { if (tab === 2) loadMoves(); }, [tab, loadMoves]);

  // long ingredient lists: draw the first rows, add more while scrolling
  const { count: shownCount, hasMore, sentinel } = useIncrementalList(items.length, `${search}|${items.length}`, 40);

  const alertCount = useMemo(
    () => items.filter((i) => i.status !== "OK").length, [items]);

  const refreshAll = async () => { await loadItems(); if (tab === 1) await loadAlerts(); if (tab === 2) await loadMoves(); };

  const openBatches = async (ing: Ingredient) => {
    try { setBatchesFor({ ing, rows: await inventoryApi.batches(ing.ingredientId) }); }
    catch (e) { say(errMsg(e), "error"); }
  };

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1} sx={{ mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Ingredients &amp; Stock</Typography>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing("new")}>New ingredient</Button>
        )}
      </Stack>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
          <Tab label="Ingredients" />
          <Tab label={`Alerts${alertCount ? ` (${alertCount})` : ""}`} />
          <Tab label="Stock ledger" />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Paper sx={{ p: 2 }}>
          <TextField size="small" label="Search ingredient" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2, minWidth: 260 }} />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ingredient</TableCell>
                  <TableCell align="right">In stock</TableCell>
                  <TableCell align="right">Reorder at</TableCell>
                  <TableCell align="right">Avg cost / unit</TableCell>
                  <TableCell align="right">Value (₹)</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.slice(0, shownCount).map((i) => (
                  <TableRow key={i.ingredientId} hover sx={{ opacity: i.active ? 1 : 0.5 }}>
                    <TableCell sx={{ fontWeight: 600 }}>{i.name}</TableCell>
                    <TableCell align="right">{fmt(i.currentQty, 3)} {i.baseUnit}</TableCell>
                    <TableCell align="right">{fmt(i.reorderLevel, 3)} {i.baseUnit}</TableCell>
                    <TableCell align="right">{fmt(i.avgCost, 4)}</TableCell>
                    <TableCell align="right">{fmt(i.stockValue)}</TableCell>
                    <TableCell><Chip size="small" color={statusColor(i.status)} label={i.status} /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                        {canManage && <Button size="small" onClick={() => setAction({ kind: "receive", ing: i })}>Receive</Button>}
                        {canAdjust && <Button size="small" color="warning" onClick={() => setAction({ kind: "wastage", ing: i })}>Wastage</Button>}
                        {canAdjust && <Button size="small" onClick={() => setAction({ kind: "count", ing: i })}>Count</Button>}
                        <Button size="small" onClick={() => openBatches(i)}>Batches</Button>
                        {canManage && <Button size="small" onClick={() => setEditing(i)}>Edit</Button>}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!items.length && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    {loading ? "Loading…" : "No ingredients yet. Add one, then receive stock."}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {sentinel}
          {hasMore && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", pt: 1 }}>
              Showing {shownCount} of {items.length} — scroll for more
            </Typography>
          )}
        </Paper>
      )}

      {tab === 1 && alerts && <AlertsPanel alerts={alerts} />}

      {tab === 2 && (
        <Paper sx={{ p: 2 }}>
          <TextField select size="small" label="Type" value={moveType} onChange={(e) => setMoveType(e.target.value)} sx={{ mb: 2, minWidth: 180 }}>
            <MenuItem value="">All (last 30 days)</MenuItem>
            {["PURCHASE", "CONSUMPTION", "WASTAGE", "ADJUSTMENT", "RETURN"].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell><TableCell>Ingredient</TableCell><TableCell>Type</TableCell>
                  <TableCell align="right">Qty</TableCell><TableCell align="right">Balance</TableCell>
                  <TableCell>Reason / ref</TableCell><TableCell>By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {moves.map((m) => (
                  <TableRow key={m.movementId}>
                    <TableCell>{new Date(m.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{m.ingredientName}</TableCell>
                    <TableCell><Chip size="small" label={m.type} /></TableCell>
                    <TableCell align="right" sx={{ color: m.qty < 0 ? "error.main" : "success.main", fontWeight: 600 }}>
                      {m.qty > 0 ? "+" : ""}{fmt(m.qty, 3)} {m.baseUnit}
                    </TableCell>
                    <TableCell align="right">{fmt(m.balanceAfter, 3)}</TableCell>
                    <TableCell>{m.reason || (m.refType ? `${m.refType} ${m.refId ?? ""}` : "")}</TableCell>
                    <TableCell>{m.actionUser}</TableCell>
                  </TableRow>
                ))}
                {!moves.length && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>No movements</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {editing && (
        <IngredientDialog
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={async (m) => { setEditing(null); say(m); await refreshAll(); }}
          onError={(m) => say(m, "error")}
        />
      )}
      {action && (
        <StockDialog
          action={action}
          onClose={() => setAction(null)}
          onDone={async (m) => { setAction(null); say(m); await refreshAll(); }}
          onError={(m) => say(m, "error")}
        />
      )}
      {batchesFor && (
        <Dialog open onClose={() => setBatchesFor(null)} fullWidth maxWidth="sm">
          <DialogTitle>Batches — {batchesFor.ing.name}</DialogTitle>
          <DialogContent>
            <Table size="small">
              <TableHead><TableRow><TableCell>Batch</TableCell><TableCell>Expiry</TableCell><TableCell align="right">Remaining</TableCell><TableCell align="right">Cost/unit</TableCell></TableRow></TableHead>
              <TableBody>
                {batchesFor.rows.map((b) => (
                  <TableRow key={b.batchId}>
                    <TableCell>{b.batchNo || `#${b.batchId}`}</TableCell>
                    <TableCell>{b.expiryDate || "—"}</TableCell>
                    <TableCell align="right">{fmt(b.qtyRemaining, 3)} {batchesFor.ing.baseUnit}</TableCell>
                    <TableCell align="right">{fmt(b.unitCost, 4)}</TableCell>
                  </TableRow>
                ))}
                {!batchesFor.rows.length && <TableRow><TableCell colSpan={4} align="center">No open batches</TableCell></TableRow>}
              </TableBody>
            </Table>
          </DialogContent>
          <DialogActions><Button onClick={() => setBatchesFor(null)}>Close</Button></DialogActions>
        </Dialog>
      )}

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast((t) => ({ ...t, open: false }))}>
        <Alert severity={toast.type} variant="filled">{toast.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

function AlertsPanel({ alerts }: { alerts: Alerts }) {
  const empty = !alerts.lowStock.length && !alerts.outOfStock.length && !alerts.negativeStock.length &&
    !alerts.expiringSoon.length && !alerts.expired.length;
  const section = (title: string, color: "error" | "warning", rows: React.ReactNode[]) =>
    rows.length ? (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography sx={{ fontWeight: 700, mb: 1 }} color={`${color}.main`}>{title} ({rows.length})</Typography>
        <Stack spacing={0.5}>{rows}</Stack>
      </Paper>
    ) : null;
  return (
    <Box>
      {empty && <Alert severity="success">All good — no stock or expiry alerts.</Alert>}
      {section("Negative stock (recount needed)", "error", alerts.negativeStock.map((i) =>
        <Typography key={i.ingredientId}>{i.name}: {fmt(i.currentQty, 3)} {i.baseUnit}</Typography>))}
      {section("Expired batches", "error", alerts.expired.map((b) =>
        <Typography key={b.batchId}>{b.ingredientName} {b.batchNo ? `(${b.batchNo})` : ""}: {fmt(b.qtyRemaining, 3)} {b.baseUnit} expired {b.expiryDate}</Typography>))}
      {section("Out of stock", "error", alerts.outOfStock.map((i) =>
        <Typography key={i.ingredientId}>{i.name}</Typography>))}
      {section("Low stock", "warning", alerts.lowStock.map((i) =>
        <Typography key={i.ingredientId}>{i.name}: {fmt(i.currentQty, 3)} {i.baseUnit} (reorder at {fmt(i.reorderLevel, 3)})</Typography>))}
      {section("Expiring within 7 days", "warning", alerts.expiringSoon.map((b) =>
        <Typography key={b.batchId}>{b.ingredientName} {b.batchNo ? `(${b.batchNo})` : ""}: {fmt(b.qtyRemaining, 3)} {b.baseUnit} — {b.daysLeft === 0 ? "today" : `${b.daysLeft} day(s)`} ({b.expiryDate})</Typography>))}
    </Box>
  );
}

function IngredientDialog({ initial, onClose, onDone, onError }: {
  initial: Ingredient | null; onClose: () => void; onDone: (m: string) => void; onError: (m: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [baseUnit, setBaseUnit] = useState<string>(initial?.baseUnit ?? "G");
  const [reorder, setReorder] = useState(initial ? String(initial.reorderLevel) : "0");
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return onError("Name is required");
    setBusy(true);
    try {
      const body = { name: name.trim(), baseUnit, reorderLevel: Number(reorder) || 0, active };
      if (initial) await inventoryApi.updateIngredient(initial.ingredientId, body);
      else await inventoryApi.createIngredient(body);
      onDone(initial ? "Ingredient updated" : "Ingredient added");
    } catch (e) { onError(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{initial ? "Edit ingredient" : "New ingredient"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <TextField select label="Stock unit" value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)}
            helperText="Stock is tracked in this unit. Grams for solids, ML for liquids, PCS for counted items.">
            <MenuItem value="G">Grams (G)</MenuItem>
            <MenuItem value="ML">Millilitres (ML)</MenuItem>
            <MenuItem value="PCS">Pieces (PCS)</MenuItem>
          </TextField>
          <TextField label={`Reorder level (${baseUnit})`} type="number" value={reorder} onChange={(e) => setReorder(e.target.value)} />
          {initial && (
            <TextField select label="Status" value={active ? "1" : "0"} onChange={(e) => setActive(e.target.value === "1")}>
              <MenuItem value="1">Active</MenuItem><MenuItem value="0">Inactive</MenuItem>
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={busy}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function StockDialog({ action, onClose, onDone, onError }: {
  action: NonNullable<Action>; onClose: () => void; onDone: (m: string) => void; onError: (m: string) => void;
}) {
  const { ing, kind } = action;
  const units = UNITS_FOR_BASE[ing.baseUnit] ?? [ing.baseUnit];
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState(units[units.length > 1 ? 1 : 0]); // KG / L / DOZEN by default
  const [cost, setCost] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [expiry, setExpiry] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const title = kind === "receive" ? "Receive stock" : kind === "wastage" ? "Record wastage" : "Stock count";

  const submit = async () => {
    const q = Number(qty);
    if (!(q >= 0) || (kind !== "count" && q <= 0)) return onError("Enter a valid quantity");
    if (kind === "receive" && !(Number(cost) >= 0 && cost !== "")) return onError("Enter the cost per " + unit);
    if (kind !== "receive" && !reason.trim()) return onError("A reason is required");
    setBusy(true);
    try {
      if (kind === "receive") {
        await inventoryApi.receive({
          ingredientId: ing.ingredientId, qty: q, unit, costPerUnit: Number(cost),
          batchNo: batchNo || undefined, expiryDate: expiry || undefined, invoiceRef: invoiceRef || undefined,
        });
        onDone(`Received ${q} ${unit} of ${ing.name}`);
      } else if (kind === "wastage") {
        await inventoryApi.wastage({ ingredientId: ing.ingredientId, qty: q, unit, reason: reason.trim() });
        onDone(`Wastage recorded for ${ing.name}`);
      } else {
        await inventoryApi.adjust({ ingredientId: ing.ingredientId, countedQty: q, unit, reason: reason.trim() });
        onDone(`${ing.name} stock corrected`);
      }
    } catch (e) { onError(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title} — {ing.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {kind === "count" && <Typography variant="body2" color="text.secondary">System shows {fmt(ing.currentQty, 3)} {ing.baseUnit}. Enter what is physically on the shelf.</Typography>}
          <Stack direction="row" spacing={1}>
            <TextField label={kind === "count" ? "Counted quantity" : "Quantity"} type="number" value={qty} onChange={(e) => setQty(e.target.value)} fullWidth autoFocus />
            <TextField select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} sx={{ minWidth: 110 }}>
              {units.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </TextField>
          </Stack>
          {kind === "receive" && (
            <>
              <TextField label={`Cost per ${unit} (₹)`} type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
              <TextField label="Batch no. (optional)" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
              <TextField label="Expiry date (optional)" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField label="Supplier invoice no. (optional)" value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} />
            </>
          )}
          {kind !== "receive" && (
            <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={kind === "wastage" ? "e.g. spoiled, spilled, staff meal" : "e.g. monthly stock count"} />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
