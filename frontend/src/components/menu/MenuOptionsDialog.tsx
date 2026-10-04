import React, { useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

import {
  menuOptionsApi,
  type GroupInput,
  type GroupView,
  type ProductOptions,
} from "./menuOptionsApi";
import { productApi } from "../product/productApi";
import type { Product } from "../../utils/types";

type Props = {
  open: boolean;
  onClose: () => void;
  productId: number;
  productName: string;
  isCombo: boolean;
  onSaved?: () => void;
};

const errMsg = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.response?.data?.error || (typeof e?.response?.data === "string" ? e.response.data : "") || e?.message || fallback;

type VariantRow = { name: string; price: string; recipeFactor: string; active: boolean };
type ComboRow = { product: Product | null; quantity: string };
type OptionRow = { name: string; price: string; active: boolean };

const emptyGroup = () => ({
  groupId: null as number | null,
  name: "",
  required: false,
  maxSelect: "0",
  active: true,
  options: [{ name: "", price: "0", active: true }] as OptionRow[],
});

/**
 * One place to set up everything customisable about a menu item:
 *  - Sizes (Half / Full ...) each with its own price
 *  - Add-on groups (Spice level, Extras ...) -- shared, reusable across items
 *  - Combo contents (for items marked as a combo)
 */
export default function MenuOptionsDialog({ open, onClose, productId, productName, isCombo, onSaved }: Props) {
  const [tab, setTab] = useState<"variants" | "modifiers" | "combo">(isCombo ? "combo" : "variants");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [allGroups, setAllGroups] = useState<GroupView[]>([]);
  const [assigned, setAssigned] = useState<number[]>([]);
  const [comboRows, setComboRows] = useState<ComboRow[]>([]);
  const [productChoices, setProductChoices] = useState<Product[]>([]);

  const [editingGroup, setEditingGroup] = useState<ReturnType<typeof emptyGroup> | null>(null);

  const apply = (o: ProductOptions) => {
    setVariants(o.variants.map((v) => ({ name: v.name, price: String(v.price), recipeFactor: String(v.recipeFactor), active: v.active })));
    setAssigned(o.groups.map((g) => g.groupId));
    setComboRows(
      o.comboItems.map((c) => ({
        product: { productId: c.componentProductId, productName: c.componentName } as Product,
        quantity: String(c.quantity),
      }))
    );
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, groups] = await Promise.all([menuOptionsApi.forProduct(productId, false), menuOptionsApi.listGroups()]);
      apply(o);
      setAllGroups(groups);
    } catch (e: any) {
      setError(errMsg(e, "Failed to load options"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setTab(isCombo ? "combo" : "variants");
    setInfo(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  // Combo components: search the menu as you type (20 matches at a time). The old version loaded only the first 100
  // dishes, so with a bigger menu the rest could never be added to a combo.
  const [comboQuery, setComboQuery] = useState("");
  useEffect(() => {
    if (!open || !isCombo) return;
    const t = setTimeout(
      () => {
        productApi
          .search({ page: 0, size: 20, search: comboQuery.trim() || undefined, active: true, sort: "productName,asc" })
          .then((r) => setProductChoices(r.content.filter((p) => !p.combo && p.productId !== productId)))
          .catch(() => {});
      },
      comboQuery ? 250 : 0
    );
    return () => clearTimeout(t);
  }, [open, isCombo, comboQuery, productId]);

  const run = async (fn: () => Promise<ProductOptions | void>, okMsg: string) => {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const o = await fn();
      if (o) apply(o);
      setInfo(okMsg);
      onSaved?.();
    } catch (e: any) {
      setError(errMsg(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const saveVariants = () =>
    run(
      () =>
        menuOptionsApi.setVariants(
          productId,
          variants
            .filter((v) => v.name.trim() !== "" || v.price !== "")
            .map((v) => ({
              name: v.name.trim(),
              price: Number(v.price),
              recipeFactor: v.recipeFactor === "" ? 1 : Number(v.recipeFactor),
              active: v.active,
            }))
        ),
      "Sizes saved"
    );

  const saveAssigned = () => run(() => menuOptionsApi.setModifierGroups(productId, assigned), "Add-on groups saved");

  const saveCombo = () =>
    run(
      () =>
        menuOptionsApi.setCombo(
          productId,
          comboRows
            .filter((r) => r.product)
            .map((r) => ({ componentProductId: r.product!.productId, quantity: Math.max(1, Number(r.quantity) || 1) }))
        ),
      "Combo saved"
    );

  const saveGroup = async () => {
    if (!editingGroup) return;
    const payload: GroupInput = {
      name: editingGroup.name.trim(),
      required: editingGroup.required,
      minSelect: editingGroup.required ? 1 : 0,
      maxSelect: Math.max(0, Number(editingGroup.maxSelect) || 0),
      active: editingGroup.active,
      options: editingGroup.options
        .filter((o) => o.name.trim() !== "")
        .map((o) => ({ name: o.name.trim(), price: Number(o.price) || 0, active: o.active })),
    };
    setSaving(true);
    setError(null);
    try {
      let saved: GroupView;
      if (editingGroup.groupId) saved = await menuOptionsApi.updateGroup(editingGroup.groupId, payload);
      else saved = await menuOptionsApi.createGroup(payload);
      setAllGroups(await menuOptionsApi.listGroups());
      if (!editingGroup.groupId) setAssigned((a) => (a.includes(saved.groupId) ? a : [...a, saved.groupId]));
      setEditingGroup(null);
      setInfo("Group saved -- press 'Save add-on groups' to attach it to this item");
    } catch (e: any) {
      setError(errMsg(e, "Group save failed"));
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (g: GroupView) => {
    if (!window.confirm(`Delete the group "${g.name}"? It will be removed from every menu item that uses it.`)) return;
    try {
      await menuOptionsApi.deleteGroup(g.groupId);
      setAssigned((a) => a.filter((x) => x !== g.groupId));
      setAllGroups(await menuOptionsApi.listGroups());
    } catch (e: any) {
      setError(errMsg(e, "Delete failed"));
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>Options — {productName}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
            {info && <Alert severity="success" onClose={() => setInfo(null)}>{info}</Alert>}

            <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
              {!isCombo && <Tab value="variants" label="Sizes" />}
              {!isCombo && <Tab value="modifiers" label="Add-ons" />}
              {isCombo && <Tab value="combo" label="Combo contents" />}
            </Tabs>

            {/* ---------------- SIZES ---------------- */}
            {tab === "variants" && (
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  Sell this item in sizes (e.g. Half / Full). Each size has its own full price. The waiter must pick one.
                  “Recipe portion” is how much of the recipe a size uses (Half = 0.5) so ingredient stock stays correct.
                  Leave the list empty for a single-price item.
                </Typography>
                {variants.map((v, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="center">
                    <TextField size="small" label="Size name" value={v.name} sx={{ flex: 2 }}
                      onChange={(e) => setVariants((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />
                    <TextField size="small" label="Price ₹" value={v.price} sx={{ flex: 1 }} inputMode="decimal"
                      onChange={(e) => setVariants((rows) => rows.map((r, j) => (j === i ? { ...r, price: e.target.value.replace(/[^0-9.]/g, "") } : r)))} />
                    <TextField size="small" label="Recipe portion" value={v.recipeFactor} sx={{ flex: 1 }} inputMode="decimal"
                      onChange={(e) => setVariants((rows) => rows.map((r, j) => (j === i ? { ...r, recipeFactor: e.target.value.replace(/[^0-9.]/g, "") } : r)))} />
                    <IconButton size="small" onClick={() => setVariants((rows) => rows.filter((_, j) => j !== i))}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                <Box>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setVariants((r) => [...r, { name: "", price: "", recipeFactor: "1", active: true }])}>
                    Add size
                  </Button>
                </Box>
              </Stack>
            )}

            {/* ---------------- ADD-ONS ---------------- */}
            {tab === "modifiers" && !editingGroup && (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Add-on groups are reusable choices like “Spice level” or “Extras”. Tick the ones this item offers.
                  Option prices are added on top of the item price.
                </Typography>
                {allGroups.length === 0 && <Alert severity="info">No add-on groups yet. Create the first one below.</Alert>}
                {allGroups.map((g) => (
                  <Stack key={g.groupId} direction="row" alignItems="center" justifyContent="space-between">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={assigned.includes(g.groupId)}
                          onChange={(e) => setAssigned((a) => (e.target.checked ? [...a, g.groupId] : a.filter((x) => x !== g.groupId)))}
                        />
                      }
                      label={
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>
                            {g.name} {g.required && <span style={{ color: "#c62828", fontSize: 12 }}>(required)</span>}
                            {!g.active && <span style={{ color: "#757575", fontSize: 12 }}> (inactive)</span>}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {g.options.map((o) => (o.price > 0 ? `${o.name} +₹${o.price}` : o.name)).join(", ")}
                            {g.maxSelect === 1 ? " · pick one" : g.maxSelect > 1 ? ` · up to ${g.maxSelect}` : ""}
                          </Typography>
                        </Box>
                      }
                    />
                    <Stack direction="row">
                      <IconButton size="small" onClick={() => setEditingGroup({
                        groupId: g.groupId, name: g.name, required: g.required, maxSelect: String(g.maxSelect), active: g.active,
                        options: g.options.map((o) => ({ name: o.name, price: String(o.price), active: o.active })),
                      })}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => deleteGroup(g)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                ))}
                <Box>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setEditingGroup(emptyGroup())}>
                    New add-on group
                  </Button>
                </Box>
              </Stack>
            )}

            {tab === "modifiers" && editingGroup && (
              <Stack spacing={1.5}>
                <Typography sx={{ fontWeight: 800 }}>{editingGroup.groupId ? "Edit group" : "New group"}</Typography>
                <TextField size="small" label="Group name (e.g. Spice level, Extras)" value={editingGroup.name}
                  onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })} />
                <Stack direction="row" spacing={2} alignItems="center">
                  <FormControlLabel control={<Switch checked={editingGroup.required} onChange={(e) => setEditingGroup({ ...editingGroup, required: e.target.checked })} />} label="Must choose" />
                  <TextField size="small" label="Max choices (0 = any)" value={editingGroup.maxSelect} sx={{ width: 170 }} inputMode="numeric"
                    onChange={(e) => setEditingGroup({ ...editingGroup, maxSelect: e.target.value.replace(/[^0-9]/g, "") })} />
                  <FormControlLabel control={<Switch checked={editingGroup.active} onChange={(e) => setEditingGroup({ ...editingGroup, active: e.target.checked })} />} label="Active" />
                </Stack>
                <Divider />
                {editingGroup.options.map((o, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="center">
                    <TextField size="small" label="Option" value={o.name} sx={{ flex: 2 }}
                      onChange={(e) => setEditingGroup({ ...editingGroup, options: editingGroup.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <TextField size="small" label="Extra ₹" value={o.price} sx={{ flex: 1 }} inputMode="decimal"
                      onChange={(e) => setEditingGroup({ ...editingGroup, options: editingGroup.options.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/[^0-9.]/g, "") } : x)) })} />
                    <IconButton size="small" onClick={() => setEditingGroup({ ...editingGroup, options: editingGroup.options.filter((_, j) => j !== i) })}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                <Box>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setEditingGroup({ ...editingGroup, options: [...editingGroup.options, { name: "", price: "0", active: true }] })}>
                    Add option
                  </Button>
                </Box>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button onClick={() => setEditingGroup(null)} disabled={saving}>Back</Button>
                  <Button variant="contained" onClick={saveGroup} disabled={saving}>Save group</Button>
                </Stack>
              </Stack>
            )}

            {/* ---------------- COMBO ---------------- */}
            {tab === "combo" && (
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  What this combo includes. It is sold as ONE line at the combo’s own price; each component’s stock (or
                  ingredients) is deducted automatically and the kitchen ticket lists the contents.
                </Typography>
                {comboRows.map((r, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="center">
                    <Autocomplete
                      sx={{ flex: 3 }}
                      size="small"
                      options={[
                        ...productChoices,
                        ...comboRows.map((x) => x.product).filter((p): p is Product => !!p && !productChoices.some((c) => c.productId === p.productId)),
                      ]}
                      filterOptions={(opts) => opts /* the server already filtered by what you typed */}
                      onInputChange={(_, v, reason) => reason === "input" && setComboQuery(v)}
                      value={r.product}
                      isOptionEqualToValue={(a, b) => a.productId === b.productId}
                      getOptionLabel={(p) => p.productName}
                      onChange={(_, val) => setComboRows((rows) => rows.map((x, j) => (j === i ? { ...x, product: val } : x)))}
                      renderInput={(params) => <TextField {...params} label="Item" />}
                    />
                    <TextField size="small" label="Qty" value={r.quantity} sx={{ width: 80 }} inputMode="numeric"
                      onChange={(e) => setComboRows((rows) => rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value.replace(/[^0-9]/g, "") } : x)))} />
                    <IconButton size="small" onClick={() => setComboRows((rows) => rows.filter((_, j) => j !== i))}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                <Box>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setComboRows((r) => [...r, { product: null, quantity: "1" }])}>
                    Add item to combo
                  </Button>
                </Box>
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={saving}>Close</Button>
        {tab === "variants" && <Button variant="contained" onClick={saveVariants} disabled={saving || loading}>Save sizes</Button>}
        {tab === "modifiers" && !editingGroup && <Button variant="contained" onClick={saveAssigned} disabled={saving || loading}>Save add-on groups</Button>}
        {tab === "combo" && <Button variant="contained" onClick={saveCombo} disabled={saving || loading}>Save combo</Button>}
      </DialogActions>
    </Dialog>
  );
}
