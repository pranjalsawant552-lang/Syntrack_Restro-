// src/pages/StockManagementPage.tsx
import { useIncrementalList } from "../hooks/useIncrementalList";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
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
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import HistoryIcon from "@mui/icons-material/History";

import type { Category, Product } from "../utils/types";
import { categoryApi } from "../components/category/categoryApi";
import { stockApi } from "../components/Stock/stockApi";
import { stockMovementApi, type MovementType, type StockMovTypeDTO } from "../components/Stock/stockMovementApi";

type Toast = { open: boolean; msg: string; type: "success" | "error" | "info" };
const normalize = (v: any) => String(v ?? "").trim();

type ProductStockRow = Product & { stockQty: number };

const MODE_LABEL: Record<MovementType, string> = {
  IN: "IN (Add Stock)",
  OUT: "OUT (Remove with reason)",
  SALE: "SALE (Sell / Reduce) - invoice required",
  RETURN: "RETURN (Back to store) - invoice required",
  ADJUSTMENT: "ADJUSTMENT (Set final qty) - user required",
};

function requiresReason(mode: MovementType) {
  return mode === "OUT";
}

// ✅ FIX: SALE also needs invoiceNum (backend requires invoiceNum for SALE)
function requiresInvoice(mode: MovementType) {
  return mode === "RETURN" || mode === "SALE";
}

function requiresUser(mode: MovementType) {
  return mode === "ADJUSTMENT";
}

function movChipColor(t: MovementType) {
  if (t === "IN" || t === "RETURN") return "success";
  if (t === "OUT" || t === "SALE") return "error";
  return "warning";
}

// ✅ Helpers for default last 30 days
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYYYYMMDD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function minusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export default function StockManagementPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ProductStockRow[]>([]);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");

  // manage modal
  const [openModal, setOpenModal] = useState(false);
  const [selected, setSelected] = useState<ProductStockRow | null>(null);
  const [mode, setMode] = useState<MovementType>("IN");

  const [qty, setQty] = useState<string>("");
  const [reason, setReason] = useState("");
  const [invoiceNum, setInvoiceNum] = useState("");
  const [user, setUser] = useState("");

  const [saving, setSaving] = useState(false);

  // history modal
  const [openHistory, setOpenHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<StockMovTypeDTO[]>([]);
  // movement history can be long (server sends the newest 500): draw 40 rows, more while scrolling
  const { count: historyShown, hasMore: historyHasMore, sentinel: historySentinel } = useIncrementalList(historyRows.length, `${historyRows.length}`, 40);

  // ✅ Date filters (default last 30 days)
  const [fromDate, setFromDate] = useState<string>(() => toYYYYMMDD(minusDays(30)));
  const [toDate, setToDate] = useState<string>(() => toYYYYMMDD(new Date()));

  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "info" });
  const showToast = (type: Toast["type"], msg: string) => setToast({ open: true, type, msg });

  // ✅ NEW: order categories parent-then-children (indented sub-categories) so
  // they don't show up mixed alphabetically with top-level ones in the filter --
  // same treatment as ProductsPage/PosPage's category dropdowns.
  const categoryOptions = useMemo(() => {
    const topLevel = categories.filter((c: any) => !c.parentCategoryId);
    const childrenByParent = new Map<number, Category[]>();
    categories.forEach((c: any) => {
      if (c.parentCategoryId) {
        const arr = childrenByParent.get(c.parentCategoryId) || [];
        arr.push(c);
        childrenByParent.set(c.parentCategoryId, arr);
      }
    });

    const ordered: Array<{ id: number; label: string }> = [];
    topLevel.forEach((top: any) => {
      ordered.push({ id: top.categoryId, label: top.categoryName ?? `Category ${top.categoryId}` });
      (childrenByParent.get(top.categoryId) || []).forEach((child: any) => {
        ordered.push({ id: child.categoryId, label: `\u00A0\u00A0\u00A0↳ ${child.categoryName}` });
      });
    });
    return ordered;
  }, [categories]);

  const filtered = useMemo(() => {
    let list = rows;
    // Category filter
    if (categoryFilter !== "all") {
      list = list.filter((r) => (r as Product).categoryId === categoryFilter);
    }
    // Search filter
    const q = normalize(search).toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const idStr = String(r.productId);
      const name = normalize(r.productName).toLowerCase();
      const bc = normalize((r as any).barcode).toLowerCase();
      return idStr.includes(q) || name.includes(q) || bc.includes(q);
    });
  }, [rows, search, categoryFilter]);

  // ✅ Only render a bounded number of rows at a time -- with a large catalog,
  // rendering every matching product as a Card/TableRow at once is what makes
  // the screen feel slow, more than the fetch itself. "Load more" reveals
  // additional batches without re-fetching anything. Same treatment as PosPage.
  const STOCK_PAGE_SIZE = 100;
  const [visibleCount, setVisibleCount] = useState(STOCK_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(STOCK_PAGE_SIZE);
  }, [search, categoryFilter]);

  const visibleRows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const products: Product[] = await stockApi.listProducts();

      // ✅ one request for every product's stock, instead of one request PER
      // product (see stockApi.getAllStockQuantities for why that was slow).
      const qtyByProductId = await stockApi.getAllStockQuantities();

      // Menu items / combos have no quantity to maintain -- only stock products belong on this screen.
      const stockProducts = (products ?? []).filter((p: any) => p.trackStock !== false && !p.combo);

      const merged: ProductStockRow[] = stockProducts.map((p) => ({
        ...p,
        stockQty: Number(qtyByProductId[String(p.productId)] ?? 0),
      }));

      merged.sort((a, b) => normalize(a.productName).localeCompare(normalize(b.productName)));
      setRows(merged);
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to load stock list");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await categoryApi.list(true);
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openManage = (row: ProductStockRow) => {
    setSelected(row);
    setMode("IN");
    setQty("");
    setReason("");
    setInvoiceNum("");
    setUser("");
    setOpenModal(true);
  };

  const validateQty = (v: string) => {
    const n = Number(v);
    if (!String(v).trim()) return "Quantity is required";
    if (!Number.isFinite(n)) return "Invalid quantity";
    if (!Number.isInteger(n)) return "Quantity must be an integer";
    if (n < 0) return "Quantity cannot be negative";
    if (n > 100000000) return "Quantity too large";
    if (mode !== "ADJUSTMENT" && n <= 0) return "Quantity must be > 0";
    if (mode === "ADJUSTMENT" && n < 0) return "Final quantity cannot be negative";
    return "";
  };

  const qtyError = validateQty(qty);

  const extraError = useMemo(() => {
    if (requiresReason(mode) && !normalize(reason)) return "Reason is required";
    if (requiresInvoice(mode) && !normalize(invoiceNum)) return "Invoice number is required";
    if (requiresUser(mode) && !normalize(user)) return "User is required";
    return "";
  }, [mode, reason, invoiceNum, user]);

  const previewAfter = useMemo(() => {
    const current = selected?.stockQty ?? 0;
    const n = Number(qty);
    if (!Number.isFinite(n)) return current;

    if (mode === "IN" || mode === "RETURN") return current + n;
    if (mode === "OUT" || mode === "SALE") return Math.max(0, current - n);
    if (mode === "ADJUSTMENT") return n;
    return current;
  }, [mode, qty, selected]);

  const onSubmit = async () => {
    if (!selected) return;

    const errQty = validateQty(qty);
    if (errQty) return showToast("error", errQty);
    if (extraError) return showToast("error", extraError);

    const nQty = Number(qty);

    setSaving(true);
    try {
      if (mode === "IN") {
        await stockMovementApi.in(selected.productId, nQty);
        showToast("success", `IN: +${nQty} added to ${selected.productName}`);
      } else if (mode === "OUT") {
        await stockMovementApi.out(selected.productId, nQty, reason.trim());
        showToast("success", `OUT: -${nQty} from ${selected.productName}`);
      } else if (mode === "SALE") {
        // ✅ FIX: invoice required
        await stockMovementApi.sale(selected.productId, nQty, invoiceNum.trim());
        showToast("success", `SALE: -${nQty} from ${selected.productName}`);
      } else if (mode === "RETURN") {
        await stockMovementApi.ret(selected.productId, nQty, invoiceNum.trim());
        showToast("success", `RETURN: +${nQty} to ${selected.productName}`);
      } else if (mode === "ADJUSTMENT") {
        await stockMovementApi.adjustment(selected.productId, nQty, user.trim());
        showToast("success", `ADJUST: Set ${selected.productName} stock to ${nQty}`);
      }

      setOpenModal(false);
      setSelected(null);
      await fetchAll();
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  // ✅ Load history using date filter endpoint
  const loadHistory = async (prodId: number, from: string, to: string) => {
    setHistoryLoading(true);
    try {
      const list = await stockMovementApi.movementsByProductDate(prodId, from, to);

      const sorted = [...(list ?? [])].sort((a: any, b: any) => {
        const da = new Date(a.createdAt ?? 0).getTime();
        const db = new Date(b.createdAt ?? 0).getTime();
        if (db !== da) return db - da;
        return (b.movementId ?? 0) - (a.movementId ?? 0);
      });

      setHistoryRows(sorted);
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to load movement history");
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ✅ Open movements modal => default last 30 days load
  const openMovements = async (row: ProductStockRow) => {
    setSelected(row);

    const defFrom = toYYYYMMDD(minusDays(30));
    const defTo = toYYYYMMDD(new Date());
    setFromDate(defFrom);
    setToDate(defTo);

    setOpenHistory(true);
    await loadHistory(row.productId, defFrom, defTo);
  };

  // ✅ validate date range
  const dateError = useMemo(() => {
    if (!fromDate || !toDate) return "Select both dates";
    const f = new Date(fromDate).getTime();
    const t = new Date(toDate).getTime();
    if (!Number.isFinite(f) || !Number.isFinite(t)) return "Invalid date";
    if (f > t) return "From date cannot be after To date";
    return "";
  }, [fromDate, toDate]);

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
        {/* Header */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Inventory2Icon />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                Stock Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                IN / OUT / SALE / RETURN / ADJUSTMENT (single screen)
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <IconButton onClick={fetchAll} disabled={loading} aria-label="refresh">
              <RefreshIcon />
            </IconButton>
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Category filter + Search + Count */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          flexWrap="wrap"
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 180 } }}>
              <InputLabel id="stock-category-filter-label">Category</InputLabel>
              <Select
                labelId="stock-category-filter-label"
                value={categoryFilter}
                label="Category"
                onChange={(e) =>
                  setCategoryFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                }
              >
                <MenuItem value="all">All categories</MenuItem>
                {categoryOptions.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name / ID / barcode..."
              size="small"
              fullWidth={isMobile}
              sx={{ maxWidth: { xs: "100%", sm: 320 }, flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
            Total: <b>{filtered.length}</b>
          </Typography>
        </Stack>

        <Box sx={{ mt: 2 }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }} color="text.secondary">
                Loading stock...
              </Typography>
            </Stack>
          ) : filtered.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <Typography sx={{ fontWeight: 800 }}>No products found</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                Try clearing search or refresh.
              </Typography>
            </Box>
          ) : isMobile ? (
            // Mobile cards
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "1fr" }}>
              {visibleRows.map((row) => (
                <Card key={row.productId} variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent sx={{ pb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      ID: {row.productId} • Barcode: <b>{normalize((row as any).barcode) || "NA"}</b>
                    </Typography>

                    <Typography variant="subtitle1" sx={{ fontWeight: 900, mt: 0.5 }}>
                      {row.productName}
                    </Typography>

                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Current Stock
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        {row.stockQty}
                      </Typography>
                    </Box>
                  </CardContent>

                  <CardActions sx={{ justifyContent: "flex-end", pt: 0 }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<TuneIcon />}
                      onClick={() => openManage(row)}
                      sx={{ borderRadius: 999 }}
                    >
                      Manage
                    </Button>
                    <Button size="small" startIcon={<HistoryIcon />} onClick={() => openMovements(row)}>
                      Movements
                    </Button>
                  </CardActions>
                </Card>
              ))}
            </Box>
          ) : (
            // Desktop table
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 900 }}>Product ID</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Product Name</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Barcode</TableCell>
                    <TableCell sx={{ fontWeight: 900 }} align="right">
                      Stock Qty
                    </TableCell>
                    <TableCell sx={{ fontWeight: 900 }} align="right">
                      Action
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {visibleRows.map((row) => (
                    <TableRow key={row.productId} hover>
                      <TableCell>{row.productId}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{row.productName}</TableCell>
                      <TableCell>{normalize((row as any).barcode) || "NA"}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900 }}>
                        {row.stockQty}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<TuneIcon />}
                            onClick={() => openManage(row)}
                            sx={{ borderRadius: 999 }}
                          >
                            Manage
                          </Button>
                          <Button size="small" startIcon={<HistoryIcon />} onClick={() => openMovements(row)}>
                            Movements
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {!loading && filtered.length > visibleRows.length && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setVisibleCount((n) => n + STOCK_PAGE_SIZE)}
                sx={{ borderRadius: 999 }}
              >
                Load more ({visibleRows.length} of {filtered.length})
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Manage Stock Modal */}
      <Dialog open={openModal} onClose={() => (saving ? null : setOpenModal(false))} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Manage Stock</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={1.5}>
            <TextField label="Product ID" value={selected?.productId ?? ""} InputProps={{ readOnly: true }} size="small" />
            <TextField label="Product Name" value={selected?.productName ?? ""} InputProps={{ readOnly: true }} size="small" />

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.8 }}>
                Movement Type
              </Typography>

              <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => v && setMode(v)} size="small" fullWidth>
                <ToggleButton value="IN">IN</ToggleButton>
                <ToggleButton value="OUT">OUT</ToggleButton>
                <ToggleButton value="SALE">SALE</ToggleButton>
                <ToggleButton value="RETURN">RETURN</ToggleButton>
                <ToggleButton value="ADJUSTMENT">ADJ</ToggleButton>
              </ToggleButtonGroup>

              <Typography variant="caption" color="text.secondary">
                {MODE_LABEL[mode]}
              </Typography>
            </Box>

            <Alert severity={mode === "ADJUSTMENT" ? "warning" : mode === "OUT" || mode === "SALE" ? "error" : "info"}>
              {mode === "IN" && "IN will ADD stock."}
              {mode === "RETURN" && "RETURN will ADD stock back to store (invoice linked)."}
              {mode === "OUT" && "OUT will REMOVE stock (reason required)."}
              {mode === "SALE" && "SALE will REMOVE stock for billing (invoice required)."}
              {mode === "ADJUSTMENT" && "ADJUSTMENT will SET final stock to the entered value (system logs the difference)."}
            </Alert>

            <TextField
              label={mode === "ADJUSTMENT" ? "Final Quantity (Set)" : "Quantity"}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              size="small"
              autoFocus
              error={!!qtyError}
              helperText={qtyError || " "}
              inputProps={{ inputMode: "numeric" }}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            />

            {requiresReason(mode) && (
              <TextField
                label="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                size="small"
                error={!!extraError}
                helperText={extraError || " "}
              />
            )}

            {/* ✅ Invoice for SALE + RETURN */}
            {requiresInvoice(mode) && (
              <TextField
                label="Invoice Number"
                value={invoiceNum}
                onChange={(e) => setInvoiceNum(e.target.value)}
                size="small"
                error={!!extraError}
                helperText={extraError || " "}
              />
            )}

            {requiresUser(mode) && (
              <TextField
                label="User"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                size="small"
                error={!!extraError}
                helperText={extraError || " "}
              />
            )}

            <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.2 }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Current
                </Typography>
                <Typography sx={{ fontWeight: 900 }}>{selected?.stockQty ?? 0}</Typography>
              </Stack>

              <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  After
                </Typography>
                <Typography sx={{ fontWeight: 900 }}>{previewAfter}</Typography>
              </Stack>
            </Paper>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenModal(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            variant="contained"
            disabled={saving || !!qtyError || !!extraError}
            startIcon={saving ? <CircularProgress size={18} /> : undefined}
            sx={{ borderRadius: 999 }}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      {/* Movement History Modal */}
      <Dialog open={openHistory} onClose={() => setOpenHistory(false)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontWeight: 900 }}>
          Movements: {selected?.productName} (ID: {selected?.productId})
        </DialogTitle>

        <DialogContent dividers>
          {/* Date Filter Bar */}
          <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2, mb: 1.5 }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.2}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                <TextField
                  label="From"
                  type="date"
                  size="small"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: { xs: "100%", sm: 200 } }}
                />
                <TextField
                  label="To"
                  type="date"
                  size="small"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: { xs: "100%", sm: 200 } }}
                />

                <Button
                  variant="contained"
                  disabled={!!dateError || historyLoading || !selected}
                  onClick={() => selected && loadHistory(selected.productId, fromDate, toDate)}
                  sx={{ borderRadius: 999, height: 40 }}
                >
                  Apply Filter
                </Button>

                <Button
                  variant="text"
                  disabled={historyLoading || !selected}
                  onClick={() => {
                    const defFrom = toYYYYMMDD(minusDays(30));
                    const defTo = toYYYYMMDD(new Date());
                    setFromDate(defFrom);
                    setToDate(defTo);
                    if (selected) loadHistory(selected.productId, defFrom, defTo);
                  }}
                >
                  Reset 30 days
                </Button>
              </Stack>

              <Typography variant="caption" color="text.secondary">
                {dateError ? <span style={{ color: "#d32f2f" }}>{dateError}</span> : "Showing movements for selected range"}
              </Typography>
            </Stack>
          </Paper>

          {historyLoading ? (
            <Stack alignItems="center" sx={{ py: 5 }}>
              <CircularProgress />
              <Typography sx={{ mt: 1 }} color="text.secondary">
                Loading movements...
              </Typography>
            </Stack>
          ) : historyRows.length === 0 ? (
            <Typography color="text.secondary">No movements found in selected date range.</Typography>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 900 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 900 }} align="right">
                      Qty (diff)
                    </TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Ref</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Reason</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Invoice</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>User</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Time</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {historyRows.slice(0, historyShown).map((r) => (
                    <TableRow key={r.movementId} hover>
                      <TableCell>{r.movementId}</TableCell>

                      <TableCell>
                        <Chip size="small" label={r.movType} color={movChipColor(r.movType)} />
                      </TableCell>

                      <TableCell align="right" sx={{ fontWeight: 900 }}>
                        {r.stkMovmentQty}
                      </TableCell>

                      <TableCell>{normalize(r.referneceId) || "-"}</TableCell>
                      <TableCell>{normalize(r.reason) || "-"}</TableCell>
                      <TableCell>{normalize(r.invoiceNum) || "-"}</TableCell>
                      <TableCell>{normalize(r.actionUser) || "-"}</TableCell>

                      <TableCell>{r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {historySentinel}
              {historyHasMore && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", py: 1 }}>
                  Showing {historyShown} of {historyRows.length} — scroll for more
                </Typography>
              )}
            </Paper>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenHistory(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast.type}
          onClose={() => setToast((p) => ({ ...p, open: false }))}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Container>
  );
}
