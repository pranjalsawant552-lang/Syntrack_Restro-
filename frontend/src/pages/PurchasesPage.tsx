import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import CancelIcon from "@mui/icons-material/Cancel";
import PaginatedTable from "../components/common/PaginatedTable";
import { usePaginatedList } from "../hooks/usePaginatedList";
import { purchaseApi, type CreatePurchasePayload, type PurchaseItemInput, type PurchaseListRow } from "../components/purchase/purchaseApi";
import { supplierApi, type Supplier } from "../components/supplier/supplierApi";
import { productApi } from "../components/product/productApi";
import { inventoryApi, UNITS_FOR_BASE, type Ingredient } from "../components/inventory/inventoryApi";
import type { Product } from "../utils/types";
import { downloadAuthenticatedFile } from "../utils/downloadFile";
import { useAppSelector } from "../store/hooks";
import { hasPermission } from "../utils/permissions";

type Toast = { open: boolean; msg: string; type: "success" | "error" };

// LineItem now carries the picked `product` object itself (from the
// searchable picker below) instead of relying on a full preloaded product
// list to look it up by id -- see ProductPicker.
type LineItem = PurchaseItemInput & {
  key: string;
  kind: "product" | "ingredient";
  productName?: string;
  product?: Product | null;
  ingredient?: Ingredient | null;
};

const errText = (e: any, fallback: string): string => {
  const d = e?.response?.data;
  if (typeof d === "string" && d) return d;
  return d?.message || d?.error || fallback;
};

const newProductLine = (): LineItem => ({ key: crypto.randomUUID(), kind: "product", productId: 0, quantity: 1 });
const newIngredientLine = (): LineItem => ({ key: crypto.randomUUID(), kind: "ingredient", ingredientQty: 1 });

// ✅ Searchable, per-row product picker -- replaces the old single
// `productApi.listAll()` call that downloaded the ENTIRE catalog into one
// Autocomplete's `options` on page load (the exact anti-pattern the Sep 2026
// speed report flagged: fine with a few hundred products, painful and slow
// to scroll/render once a shop's catalog grows into the thousands). Options
// are now fetched from the paginated /product/search endpoint, debounced as
// the user types, exactly like ProductsPage's own search box.
function ProductPicker({
  value,
  onChange,
}: {
  value: Product | null | undefined;
  onChange: (p: Product | null) => void;
}) {
  const [inputValue, setInputValue] = useState(value?.productName ?? "");
  const [options, setOptions] = useState<Product[]>(value ? [value] : []);
  const [loading, setLoading] = useState(false);

  // Keep the currently-selected product visible in the option list even if
  // a later search's results don't happen to include it.
  useEffect(() => {
    if (value && !options.some((o) => o.productId === value.productId)) {
      setOptions((prev) => [value, ...prev]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const q = inputValue.trim();
    if (q.length < 2) return; // avoid a network hit for a single keystroke
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await productApi.search({ page: 0, size: 20, search: q, active: true, sort: "productName,asc" });
        if (!cancelled) setOptions(res.content);
      } catch {
        // keep whatever options were already showing
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [inputValue]);

  return (
    <Autocomplete
      sx={{ flex: 3 }}
      options={options}
      loading={loading}
      filterOptions={(x) => x} // server already filtered these
      getOptionLabel={(p) => p.productName}
      isOptionEqualToValue={(o, v) => o.productId === v.productId}
      value={value ?? null}
      inputValue={inputValue}
      onInputChange={(_, newInput) => setInputValue(newInput)}
      onChange={(_, val) => onChange(val)}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Product (type to search)"
          size="small"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

export default function PurchasesPage() {
  const currentUser = useAppSelector((s) => s.auth.user);
  const canCreate = hasPermission(currentUser, "PURCHASE_CREATE");
  const canCancel = hasPermission(currentUser, "PURCHASE_CANCEL");

  const list = usePaginatedList<PurchaseListRow>(
    (args) =>
      purchaseApi.search({
        page: args.page,
        size: args.size,
        search: args.search,
        sort: args.sort || "purchaseDate,desc",
        fromDate: args.filters?.fromDate,
        toDate: args.filters?.toDate,
        payStatus: args.filters?.payStatus,
        payMethod: args.filters?.payMethod,
      }),
    { initialSize: 10 }
  );

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "success" });

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [billNumber, setBillNumber] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "CARD" | "UPI">("CASH");
  const [payStatus, setPayStatus] = useState<"PAID" | "PENDING" | "CANCELLED">("PAID");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  useEffect(() => {
    supplierApi.listAll().then(setSuppliers).catch(() => setSuppliers([]));
    // Ingredient list is small; load once. Users without INVENTORY_VIEW just won't get ingredient options.
    inventoryApi.listIngredients(undefined, true).then(setIngredients).catch(() => setIngredients([]));
  }, []);

  const onStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    list.setFilter("payStatus", val === "all" ? undefined : val);
  };

  const openCreate = () => {
    setSelectedSupplier(null);
    setBillNumber("");
    setPayMethod("CASH");
    setPayStatus("PAID");
    setDiscountValue(0);
    setLineItems([newProductLine()]);
    setDialogOpen(true);
  };

  const addLineItem = (kind: "product" | "ingredient" = "product") => {
    setLineItems((prev) => [...prev, kind === "ingredient" ? newIngredientLine() : newProductLine()]);
  };

  const switchKind = (key: string, kind: "product" | "ingredient") => {
    setLineItems((prev) => prev.map((i) => (i.key === key ? { ...(kind === "ingredient" ? newIngredientLine() : newProductLine()), key } : i)));
  };

  const removeLineItem = (key: string) => {
    setLineItems((prev) => prev.filter((i) => i.key !== key));
  };

  const updateLineItem = (key: string, patch: Partial<LineItem>) => {
    setLineItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  };

  const totals = useMemo(() => {
    let subTotal = 0;
    let gstTotal = 0;
    for (const item of lineItems) {
      const isIng = item.kind === "ingredient";
      const unitCost = item.unitCost ?? (isIng ? 0 : item.product?.prodBuyPrice ?? 0);
      const gstPercent = item.gstPercent ?? (isIng ? 0 : item.product?.prodGST ?? 0);
      const taxable = unitCost * (isIng ? item.ingredientQty || 0 : item.quantity || 0);
      subTotal += taxable;
      gstTotal += (taxable * gstPercent) / 100;
    }
    const gross = subTotal + gstTotal;
    const discount = Math.min(discountValue || 0, gross);
    return { subTotal, gstTotal, gross, netTotal: gross - discount };
  }, [lineItems, discountValue]);

  const handleSubmit = async () => {
    const validItems = lineItems.filter((i) =>
      i.kind === "ingredient" ? i.ingredientId && (i.ingredientQty ?? 0) > 0 : i.productId && (i.quantity ?? 0) > 0
    );
    if (validItems.length === 0) {
      setToast({ open: true, msg: "Add at least one valid item", type: "error" });
      return;
    }
    const noCost = validItems.find((i) => i.kind === "ingredient" && (i.unitCost === undefined || i.unitCost < 0));
    if (noCost) {
      setToast({ open: true, msg: `Enter the cost per ${noCost.unit} for ${noCost.ingredient?.name ?? "each ingredient"}`, type: "error" });
      return;
    }
    setSaving(true);
    try {
      const payload: CreatePurchasePayload = {
        payMethod,
        payStatus,
        discountValue: discountValue || 0,
        supplierBillNumber: billNumber || undefined,
        items: validItems.map((i) =>
          i.kind === "ingredient"
            ? {
                ingredientId: i.ingredientId,
                ingredientQty: i.ingredientQty,
                unit: i.unit,
                unitCost: i.unitCost,
                gstPercent: i.gstPercent ?? 0,
                batchNo: i.batchNo || undefined,
                expiryDate: i.expiryDate || undefined,
              }
            : { productId: i.productId, quantity: i.quantity, unitCost: i.unitCost, gstPercent: i.gstPercent }
        ),
        supplierId: selectedSupplier?.supplierId,
        supplierName: selectedSupplier?.supplierName,
        supplierPhone: selectedSupplier?.phone,
        supplierAddress: selectedSupplier?.address,
        updateProductBuyPrice: true,
      };
      await purchaseApi.create(payload);
      setToast({ open: true, msg: "Purchase recorded, stock updated", type: "success" });
      setDialogOpen(false);
      list.reload();
    } catch (e: any) {
      setToast({ open: true, msg: errText(e, "Failed to record purchase"), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (row: PurchaseListRow) => {
    if (!window.confirm(`Cancel purchase ${row.purchaseNumber}? This will reverse the stock it added.`)) return;
    try {
      await purchaseApi.cancel(row.purchaseId);
      setToast({ open: true, msg: "Purchase cancelled, stock reverted", type: "success" });
      list.reload();
    } catch (e: any) {
      setToast({ open: true, msg: errText(e, "Failed to cancel purchase"), type: "error" });
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Purchases
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => downloadAuthenticatedFile("/purchase/export", "purchases.csv")}>
            Export CSV
          </Button>
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              New Purchase
            </Button>
          )}
        </Stack>
      </Stack>

      <PaginatedTable<PurchaseListRow>
        searchInput={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Search by purchase #, bill #, or supplier..."
        filtersSlot={
          <Select size="small" value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} sx={{ minWidth: 130 }}>
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="PAID">Paid</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
          </Select>
        }
        headerCells={
          <>
            <TableCell>Purchase #</TableCell>
            <TableCell>Bill #</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Supplier</TableCell>
            <TableCell>Net Total</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </>
        }
        rows={list.rows}
        renderRow={(p) => (
          <TableRow key={p.purchaseId} hover>
            <TableCell sx={{ fontWeight: 700 }}>{p.purchaseNumber}</TableCell>
            <TableCell>{p.supplierBillNumber || "—"}</TableCell>
            <TableCell>{p.purchaseDate}</TableCell>
            <TableCell>{p.supplierName || "—"}</TableCell>
            <TableCell>₹{p.netTotal.toFixed(2)}</TableCell>
            <TableCell>
              <Chip size="small" label={p.payStatus} color={p.payStatus === "PAID" ? "success" : "warning"} />
            </TableCell>
            <TableCell align="right">
              {canCancel && (
                <Button size="small" color="error" startIcon={<CancelIcon />} onClick={() => handleCancel(p)}>
                  Cancel
                </Button>
              )}
            </TableCell>
          </TableRow>
        )}
        loading={list.loading}
        error={list.error}
        page={list.page}
        size={list.size}
        totalElements={list.totalElements}
        onPageChange={list.setPage}
        onSizeChange={list.setSize}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>New Purchase</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <Autocomplete
                fullWidth
                options={suppliers}
                getOptionLabel={(s) => s.supplierName}
                value={selectedSupplier}
                onChange={(_, val) => setSelectedSupplier(val)}
                renderInput={(params) => <TextField {...params} label="Supplier (optional)" />}
              />
              <TextField label="Supplier bill #" fullWidth value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
            </Stack>

            <Divider>Items</Divider>

            {lineItems.map((item) => {
              const isIng = item.kind === "ingredient";
              const unitChoices = item.ingredient ? UNITS_FOR_BASE[item.ingredient.baseUnit] ?? [item.ingredient.baseUnit] : [];
              return (
                <Stack spacing={1} key={item.key} sx={{ p: 1, border: 1, borderColor: "divider", borderRadius: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={item.kind}
                      onChange={(_, v) => v && v !== item.kind && switchKind(item.key, v)}
                    >
                      <ToggleButton value="product">Product</ToggleButton>
                      <ToggleButton value="ingredient">Ingredient</ToggleButton>
                    </ToggleButtonGroup>

                    {!isIng ? (
                      <ProductPicker
                        value={item.product}
                        onChange={(val) =>
                          updateLineItem(item.key, {
                            productId: val?.productId ?? 0,
                            unitCost: val?.prodBuyPrice,
                            gstPercent: val?.prodGST,
                            product: val,
                            productName: val?.productName,
                          })
                        }
                      />
                    ) : (
                      <Autocomplete
                        sx={{ flex: 3, minWidth: 200 }}
                        size="small"
                        options={ingredients}
                        getOptionLabel={(i) => `${i.name} (${i.baseUnit})`}
                        isOptionEqualToValue={(o, v) => o.ingredientId === v.ingredientId}
                        value={item.ingredient ?? null}
                        noOptionsText="No ingredients — add them on the Ingredients page first"
                        onChange={(_, val) => {
                          const choices = val ? UNITS_FOR_BASE[val.baseUnit] ?? [val.baseUnit] : [];
                          updateLineItem(item.key, {
                            ingredient: val,
                            ingredientId: val?.ingredientId,
                            productName: val?.name,
                            unit: val ? choices[choices.length > 1 ? 1 : 0] : undefined, // KG / L / DOZEN by default
                          });
                        }}
                        renderInput={(params) => <TextField {...params} label="Ingredient" size="small" />}
                      />
                    )}

                    <IconButton onClick={() => removeLineItem(item.key)} disabled={lineItems.length === 1}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {!isIng ? (
                      <TextField
                        sx={{ flex: 1, minWidth: 90 }}
                        label="Qty"
                        type="number"
                        size="small"
                        value={item.quantity ?? ""}
                        onChange={(e) => updateLineItem(item.key, { quantity: parseInt(e.target.value, 10) || 0 })}
                      />
                    ) : (
                      <>
                        <TextField
                          sx={{ flex: 1, minWidth: 90 }}
                          label="Qty"
                          type="number"
                          size="small"
                          inputProps={{ step: "any", min: 0 }}
                          value={item.ingredientQty ?? ""}
                          onChange={(e) => updateLineItem(item.key, { ingredientQty: parseFloat(e.target.value) || 0 })}
                        />
                        <TextField
                          select
                          sx={{ width: 100 }}
                          label="Unit"
                          size="small"
                          value={item.unit ?? ""}
                          disabled={!item.ingredient}
                          onChange={(e) => updateLineItem(item.key, { unit: e.target.value })}
                        >
                          {unitChoices.map((u) => (
                            <MenuItem key={u} value={u}>{u}</MenuItem>
                          ))}
                        </TextField>
                      </>
                    )}
                    <TextField
                      sx={{ flex: 1, minWidth: 110 }}
                      label={isIng ? `Cost per ${item.unit || "unit"}` : "Unit cost"}
                      type="number"
                      size="small"
                      inputProps={{ step: "any", min: 0 }}
                      value={item.unitCost ?? (isIng ? "" : item.product?.prodBuyPrice ?? "")}
                      onChange={(e) => updateLineItem(item.key, { unitCost: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                    />
                    <TextField
                      sx={{ flex: 1, minWidth: 80 }}
                      label="GST %"
                      type="number"
                      size="small"
                      value={item.gstPercent ?? (isIng ? 0 : item.product?.prodGST ?? "")}
                      onChange={(e) => updateLineItem(item.key, { gstPercent: parseFloat(e.target.value) || 0 })}
                    />
                    {isIng && (
                      <>
                        <TextField
                          sx={{ flex: 1, minWidth: 110 }}
                          label="Batch no. (optional)"
                          size="small"
                          value={item.batchNo ?? ""}
                          onChange={(e) => updateLineItem(item.key, { batchNo: e.target.value })}
                        />
                        <TextField
                          sx={{ flex: 1, minWidth: 140 }}
                          label="Expiry (optional)"
                          type="date"
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          value={item.expiryDate ?? ""}
                          onChange={(e) => updateLineItem(item.key, { expiryDate: e.target.value })}
                        />
                      </>
                    )}
                  </Stack>
                </Stack>
              );
            })}
            <Stack direction="row" spacing={1}>
              <Button size="small" startIcon={<AddIcon />} onClick={() => addLineItem("product")}>
                Add product
              </Button>
              <Button size="small" startIcon={<AddIcon />} onClick={() => addLineItem("ingredient")}>
                Add ingredient
              </Button>
            </Stack>

            <Divider />

            <Stack direction="row" spacing={2}>
              <Select size="small" fullWidth value={payMethod} onChange={(e) => setPayMethod(e.target.value as any)}>
                <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="CARD">Card</MenuItem>
                <MenuItem value="UPI">UPI</MenuItem>
              </Select>
              <Select size="small" fullWidth value={payStatus} onChange={(e) => setPayStatus(e.target.value as any)}>
                <MenuItem value="PAID">Paid</MenuItem>
                <MenuItem value="PENDING">Pending</MenuItem>
              </Select>
              <TextField
                size="small"
                fullWidth
                label="Discount"
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
              />
            </Stack>

            <Stack alignItems="flex-end" spacing={0.5}>
              <Typography variant="body2">Subtotal: ₹{totals.subTotal.toFixed(2)}</Typography>
              <Typography variant="body2">GST: ₹{totals.gstTotal.toFixed(2)}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Net Total: ₹{totals.netTotal.toFixed(2)}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : "Record Purchase"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3500} onClose={() => setToast({ ...toast, open: false })} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast.type} onClose={() => setToast({ ...toast, open: false })}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
