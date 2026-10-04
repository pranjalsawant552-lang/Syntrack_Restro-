import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useIncrementalList } from "../hooks/useIncrementalList";
import {
  Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  MenuItem, Paper, Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { useAppSelector } from "../store/hooks";
import { hasPermission } from "../utils/permissions";
import {
  errMsg, inventoryApi, recipeApi, UNITS_FOR_BASE,
  type CostingRow, type Ingredient,
} from "../components/inventory/inventoryApi";

type Toast = { open: boolean; msg: string; type: "success" | "error" };
type Line = { ingredientId: number | null; quantity: string; unit: string; wastagePercent: string };

const fmt = (n: number | null | undefined, d = 2) =>
  n == null ? "-" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: d });

export default function RecipesPage() {
  const user = useAppSelector((s) => s.auth.user);
  const canManage = hasPermission(user, "RECIPE_MANAGE");

  const [rows, setRows] = useState<CostingRow[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [filter, setFilter] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [editing, setEditing] = useState<CostingRow | null>(null);
  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "success" });
  const say = (msg: string, type: Toast["type"] = "success") => setToast({ open: true, msg, type });

  const load = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([recipeApi.costing(), inventoryApi.listIngredients(undefined, true).catch(() => [])]);
      setRows(c); setIngredients(i);
    } catch (e) { say(errMsg(e, "Failed to load recipes"), "error"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => rows.filter((r) =>
    r.active && (!onlyMissing || !r.hasRecipe) && r.productName.toLowerCase().includes(filter.toLowerCase())),
  [rows, filter, onlyMissing]);

  const missing = rows.filter((r) => r.active && !r.hasRecipe).length;
  // long menus: draw the first rows, add more while scrolling
  const { count: shownCount, hasMore, sentinel } = useIncrementalList(visible.length, `${filter}|${onlyMissing}`, 40);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Recipes &amp; Food Cost</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Link each menu item to the ingredients in one portion. Stock is deducted automatically when the KOT is sent.
      </Typography>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }} alignItems={{ sm: "center" }}>
          <TextField size="small" label="Search menu item" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Chip clickable color={onlyMissing ? "warning" : "default"} label={`Without recipe: ${missing}`} onClick={() => setOnlyMissing((v) => !v)} />
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Menu item</TableCell>
                <TableCell align="right">Price (₹)</TableCell>
                <TableCell align="right">Food cost (₹)</TableCell>
                <TableCell align="right">Food cost %</TableCell>
                <TableCell align="right">Margin (₹)</TableCell>
                <TableCell align="right"> </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.slice(0, shownCount).map((r) => (
                <TableRow key={r.productId} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{r.productName}</TableCell>
                  <TableCell align="right">{fmt(r.sellingPrice)}</TableCell>
                  {r.hasRecipe ? (
                    <>
                      <TableCell align="right">{fmt(r.foodCost)}</TableCell>
                      <TableCell align="right">
                        <Chip size="small" label={`${fmt(r.foodCostPercent, 1)}%`}
                          color={(r.foodCostPercent ?? 0) > 40 ? "error" : (r.foodCostPercent ?? 0) > 32 ? "warning" : "success"} />
                      </TableCell>
                      <TableCell align="right">{fmt(r.marginAmount)}</TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={3} align="center"><Chip size="small" variant="outlined" label="No recipe — stock not tracked" /></TableCell>
                  )}
                  <TableCell align="right">
                    <Button size="small" onClick={() => setEditing(r)}>{r.hasRecipe ? (canManage ? "Edit" : "View") : canManage ? "Add recipe" : ""}</Button>
                  </TableCell>
                </TableRow>
              ))}
              {!visible.length && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>No menu items</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        {sentinel}
        {hasMore && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", pt: 1 }}>
            Showing {shownCount} of {visible.length} — scroll for more
          </Typography>
        )}
      </Paper>

      {editing && (
        <RecipeDialog
          row={editing} ingredients={ingredients} canManage={canManage}
          onClose={() => setEditing(null)}
          onDone={async (m) => { setEditing(null); say(m); await load(); }}
          onError={(m) => say(m, "error")}
        />
      )}
      <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast((t) => ({ ...t, open: false }))}>
        <Alert severity={toast.type} variant="filled">{toast.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

function RecipeDialog({ row, ingredients, canManage, onClose, onDone, onError }: {
  row: CostingRow; ingredients: Ingredient[]; canManage: boolean;
  onClose: () => void; onDone: (m: string) => void; onError: (m: string) => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [cost, setCost] = useState<{ foodCost: number; marginAmount: number; marginPercent: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(ingredients.map((i) => [i.ingredientId, i])), [ingredients]);

  useEffect(() => {
    recipeApi.get(row.productId).then((r) => {
      setLines(r.lines.map((l) => ({
        ingredientId: l.ingredientId, quantity: String(l.quantity), unit: l.unit, wastagePercent: String(l.wastagePercent ?? 0),
      })));
      setCost({ foodCost: r.foodCost, marginAmount: r.marginAmount, marginPercent: r.marginPercent });
    }).catch((e) => onError(errMsg(e)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.productId]);

  const setLine = (idx: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const save = async () => {
    const clean = lines.filter((l) => l.ingredientId != null);
    if (!clean.length) return onError("Add at least one ingredient");
    for (const l of clean) if (!(Number(l.quantity) > 0)) return onError("Every ingredient needs a quantity above zero");
    setBusy(true);
    try {
      await recipeApi.save(row.productId, clean.map((l) => ({
        ingredientId: l.ingredientId as number, quantity: Number(l.quantity), unit: l.unit, wastagePercent: Number(l.wastagePercent) || 0,
      })));
      onDone(`Recipe saved for ${row.productName}`);
    } catch (e) { onError(errMsg(e)); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Remove the recipe for ${row.productName}? Past stock history is kept.`)) return;
    setBusy(true);
    try { await recipeApi.remove(row.productId); onDone("Recipe removed"); }
    catch (e) { onError(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Recipe — {row.productName} <Typography component="span" color="text.secondary">(per 1 portion)</Typography></DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {lines.map((l, idx) => {
            const ing = l.ingredientId != null ? byId.get(l.ingredientId) : undefined;
            const units = ing ? UNITS_FOR_BASE[ing.baseUnit] ?? [ing.baseUnit] : ["G", "KG", "ML", "L", "PCS"];
            return (
              <Stack key={idx} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                <Autocomplete
                  sx={{ flex: 2, minWidth: 220 }} size="small" disabled={!canManage}
                  options={ingredients} getOptionLabel={(o) => o.name}
                  value={ing ?? null}
                  onChange={(_, v) => setLine(idx, { ingredientId: v?.ingredientId ?? null, unit: v ? v.baseUnit : l.unit })}
                  renderInput={(p) => <TextField {...p} label="Ingredient" />}
                />
                <TextField size="small" label="Qty" type="number" value={l.quantity} disabled={!canManage}
                  onChange={(e) => setLine(idx, { quantity: e.target.value })} sx={{ width: 110 }} />
                <TextField size="small" select label="Unit" value={units.includes(l.unit) ? l.unit : units[0]} disabled={!canManage}
                  onChange={(e) => setLine(idx, { unit: e.target.value })} sx={{ width: 100 }}>
                  {units.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                </TextField>
                <TextField size="small" label="Prep loss %" type="number" value={l.wastagePercent} disabled={!canManage}
                  onChange={(e) => setLine(idx, { wastagePercent: e.target.value })} sx={{ width: 110 }} />
                {canManage && <IconButton onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}><DeleteIcon /></IconButton>}
              </Stack>
            );
          })}
          {canManage && (
            <Box><Button startIcon={<AddIcon />} onClick={() => setLines((ls) => [...ls, { ingredientId: null, quantity: "", unit: "G", wastagePercent: "0" }])}>Add ingredient</Button></Box>
          )}
          {cost && row.hasRecipe && (
            <Alert severity="info">
              Current food cost ₹{fmt(cost.foodCost)} · margin ₹{fmt(cost.marginAmount)} ({fmt(cost.marginPercent, 1)}%) — based on average purchase cost. Save to recalculate.
            </Alert>
          )}
          {!ingredients.length && <Alert severity="warning">No ingredients exist yet. Add them under Ingredients first.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        {canManage && row.hasRecipe && <Button color="error" onClick={remove} disabled={busy} sx={{ mr: "auto" }}>Remove recipe</Button>}
        <Button onClick={onClose}>Close</Button>
        {canManage && <Button variant="contained" onClick={save} disabled={busy}>Save recipe</Button>}
      </DialogActions>
    </Dialog>
  );
}
