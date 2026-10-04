// src/pages/ProductsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import MenuOptionsDialog from "../components/menu/MenuOptionsDialog";
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
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import DownloadIcon from "@mui/icons-material/Download";

import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store/store";
import { fetchCurrentSetting } from "../store/settingsSlice";

import type { Category, ProductDTO, Product } from "../utils/types";
import { categoryApi } from "../components/category/categoryApi";
import { productApi } from "../components/product/productApi";
import { useCompanyShop } from "../store/useCompanyShop";
import StickerDownloadButton from "../components/common/StickerDownloadButton";
import { downloadAuthenticatedFile } from "../utils/downloadFile";

type Toast = { open: boolean; msg: string; type: "success" | "error" | "info" };

const normalize = (v: any) => String(v ?? "").trim();

// ✅ NEW: order categories parent-then-children (so sub-categories render right
// under their parent) and label sub-categories with an indent, for both the
// filter dropdown and the Add/Edit product form dropdown below. Categories
// without a parentCategoryId (i.e. every category that existed before
// sub-categories were added) are unaffected -- they just render as before.
function buildCategoryOptions(categories: Category[]): Array<{ id: number; label: string; isActive?: boolean }> {
  const topLevel = categories.filter((c: any) => !c.parentCategoryId);
  const childrenByParent = new Map<number, Category[]>();
  categories.forEach((c: any) => {
    if (c.parentCategoryId) {
      const arr = childrenByParent.get(c.parentCategoryId) || [];
      arr.push(c);
      childrenByParent.set(c.parentCategoryId, arr);
    }
  });

  const options: Array<{ id: number; label: string; isActive?: boolean }> = [];
  topLevel.forEach((top: any) => {
    options.push({ id: top.categoryId, label: top.categoryName, isActive: top.isActive });
    (childrenByParent.get(top.categoryId) || []).forEach((child: any) => {
      options.push({ id: child.categoryId, label: `\u00A0\u00A0\u00A0↳ ${child.categoryName}`, isActive: child.isActive });
    });
  });
  return options;
}

const money = (n: any) => {
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : "0.00";
};

const gstLabel = (n: any) => {
  const x = Number(n);
  return Number.isFinite(x) ? `${x}%` : "0%";
};

// ✅ HARDEN: backend may return 1/0 or true/false
const toBool = (v: any) => v === true || v === 1 || v === "1";

// ✅ regex/UX numeric input: allow "" and decimals
const numInput = (raw: string, maxDecimals = 2) => {
  if (raw === "") return "";
  let v = raw.replace(/[^\d.]/g, "");
  const parts = v.split(".");
  if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
  const [a, b] = v.split(".");
  if (b != null) v = a + "." + b.slice(0, maxDecimals);
  // avoid "00012" (but keep "0." case)
  if (v.startsWith("00") && !v.startsWith("0.")) {
    const n = Number(v);
    v = Number.isFinite(n) ? String(n) : "";
  }
  return v;
};

const toNumberOr0 = (v: any) => {
  if (v === "" || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function ProductsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // ✅ shop settings (redux)
  const dispatch = useDispatch<AppDispatch>();
  const shop = useCompanyShop();

  const [categories, setCategories] = useState<Category[]>([]);
  const [cateId, setCateId] = useState<number | "all">("all");

  // ✅ Server-side pagination state. `rows` only ever holds the pages fetched
  // so far (not the whole catalog) -- see fetchPage below.
  const [rows, setRows] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(false); // first page of a fresh query
  const [loadingMore, setLoadingMore] = useState(false); // "Load more" click
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const PRODUCTS_PAGE_SIZE = 40;

  // `search` is the debounced value actually sent to the backend; `searchInput`
  // is what the text field is bound to, so typing stays snappy while the
  // network request itself only fires ~350ms after the user stops typing.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [openForm, setOpenForm] = useState(false);
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [formCateId, setFormCateId] = useState<number | "all">("all");
  const [formProdId, setFormProdId] = useState<number | null>(null);

  // ✅ Keep prodPrice/prodGST/prodBuyPrice as string for good UX (no default 0)
  const [form, setForm] = useState<any>({
    productName: "",
    prodPrice: "",
    prodGST: "",
    prodBuyPrice: "",
    isActive: true,
    barcode: "",
    categoryId: undefined,
    categoryName: undefined,
    isVeg: null as boolean | null, // null = not set (fine for non-food/retail items)
    itemType: "MENU" as "MENU" | "STOCK" | "COMBO", // MENU = no stock to maintain, STOCK = quantity tracked
  });

  // "Options" dialog (sizes / add-ons / combo contents)
  const [optionsFor, setOptionsFor] = useState<{ id: number; name: string; combo: boolean } | null>(null);

  const [openDelete, setOpenDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ cateId: number; prod: ProductDTO } | null>(null);

  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "info" });
  const showToast = (type: Toast["type"], msg: string) => setToast({ open: true, type, msg });

  const fetchCategories = async () => {
    try {
      const data = await categoryApi.list(true); // includeInactive optional
      setCategories(Array.isArray(data) ? data : []);
    } catch (e: any) {
      showToast("error", e?.message || "Failed to load categories");
    }
  };

  // ✅ Fetches ONE page from the backend's /product/search endpoint (server-side
  // paging, filtering and searching) instead of downloading the whole catalog.
  // `pageToLoad = 0` (a fresh category/search) replaces `rows`; any later page
  // (from "Load more") appends to it.
  const fetchPage = async (pageToLoad: number, opts?: { silent?: boolean }) => {
    const isFirst = pageToLoad === 0;
    if (isFirst && !opts?.silent) setLoading(true);
    if (!isFirst) setLoadingMore(true);
    try {
      const res = await productApi.search({
        page: pageToLoad,
        size: PRODUCTS_PAGE_SIZE,
        search: normalize(search) || undefined,
        categoryId: cateId === "all" ? undefined : Number(cateId),
        sort: "productName,asc",
      });

      // ✅ normalize boolean in UI
      const normalized = (res.content ?? []).map((p: any) => ({
        ...p,
        isActive: toBool(p?.isActive ?? p?.active),
      }));

      setRows((prev) => (isFirst ? normalized : [...prev, ...normalized]));
      setTotalElements(res.totalElements ?? 0);
      setPage(res.page ?? pageToLoad);
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to load products");
      if (isFirst) {
        setRows([]);
        setTotalElements(0);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => fetchPage(page + 1);

  // ✅ load shop setting once (for sticker shop name)
  useEffect(() => {
    dispatch(fetchCurrentSetting());
  }, [dispatch]);

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce free-text input -> only fire a request ~350ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any change to the effective search term or category filter re-queries the
  // backend from page 0 (fresh result set), rather than filtering whatever
  // happened to already be loaded on the client.
  useEffect(() => {
    fetchPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, cateId]);

  const visibleProducts = rows;

  // ✅ NEW: category dropdown options, parent categories followed by their
  // (indented) sub-categories -- see buildCategoryOptions above.
  const categoryOptions = useMemo(() => buildCategoryOptions(categories), [categories]);

  const validate = (v: any) => {
    const name = normalize(v.productName);
    if (!name) return "Product name is required";
    if (name.length < 2) return "Min 2 characters";
    if (name.length > 80) return "Max 80 characters";

    const price = toNumberOr0(v.prodPrice);
    if (!Number.isFinite(price) || price < 0) return "Price must be 0 or greater";

    const gst = toNumberOr0(v.prodGST);
    if (!Number.isFinite(gst) || gst < 0 || gst > 100) return "GST must be between 0 to 100";

    const buyPrice = toNumberOr0(v.prodBuyPrice);
    if (!Number.isFinite(buyPrice) || buyPrice < 0) return "Buy price must be 0 or greater";

    if (v.barcode != null && String(v.barcode).length > 32) return "Barcode max length = 32";
    return "";
  };

  const formError = validate(form);

  const openAdd = () => {
    setMode("add");
    setFormProdId(null);
    setFormCateId(cateId === "all" ? "all" : cateId);
    setForm({
      productName: "",
      prodPrice: "",
      prodGST: "",
      prodBuyPrice: "",
      isActive: true,
      barcode: "",
      isVeg: null,
      itemType: "MENU",
    });
    setOpenForm(true);
  };

  const openEdit = (prod: ProductDTO) => {
    setMode("edit");
    setFormProdId(Number((prod as any).productId));
    setForm({
      productName: (prod as any).productName ?? "",
      prodPrice: String((prod as any).prodPrice ?? ""),
      prodGST: String((prod as any).prodGST ?? ""),
      prodBuyPrice: (prod as any).prodBuyPrice != null ? String((prod as any).prodBuyPrice) : "",
      isActive: toBool((prod as any).isActive ?? (prod as any).active),
      barcode: (prod as any).barcode ?? "",
      categoryId: (prod as any).categoryId,
      categoryName: (prod as any).categoryName,
      isVeg: (prod as any).isVeg ?? null,
      itemType: (prod as any).combo ? "COMBO" : (prod as any).trackStock === false ? "MENU" : "STOCK",
    });

    if (cateId !== "all") setFormCateId(cateId);
    else if ((prod as any).categoryId) setFormCateId(Number((prod as any).categoryId));
    else setFormCateId("all");

    setOpenForm(true);
  };

  const submit = async () => {
    const err = validate(form);
    if (err) return showToast("error", err);
    if (formCateId === "all") return showToast("error", "Please select Category");

    const payload: any = {
      ...form,
      productName: normalize(form.productName),
      prodPrice: toNumberOr0(form.prodPrice),
      prodGST: toNumberOr0(form.prodGST),
      prodBuyPrice: toNumberOr0(form.prodBuyPrice),
      isActive: toBool(form.isActive),
      barcode: normalize(form.barcode),
      trackStock: form.itemType === "STOCK",
      combo: form.itemType === "COMBO",
    };
    delete payload.itemType;

    // ✅ send empty barcode as null (backend can auto-generate)
    if (!payload.barcode) payload.barcode = null;

    setSaving(true);
    try {
      if (mode === "add") {
        // backend may return string or json; ignore return and reload list
        await productApi.create(Number(formCateId), payload);
        showToast("success", "Product added");
      } else {
        if (!formProdId) throw new Error("Invalid product id");
        await productApi.update(Number(formCateId), formProdId, payload);
        showToast("success", "Product updated");
      }
      setOpenForm(false);
      await fetchPage(0, { silent: true });
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.response?.data || e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (prod: ProductDTO) => {
    const cid = cateId !== "all" ? Number(cateId) : (prod as any).categoryId ? Number((prod as any).categoryId) : null;
    if (!cid) return showToast("error", "Select Category or ensure categoryId present in response");
    setDeleteTarget({ cateId: cid, prod });
    setOpenDelete(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.prod || !(deleteTarget.prod as any).productId) return;
    setSaving(true);
    try {
      await productApi.remove(deleteTarget.cateId, Number((deleteTarget.prod as any).productId));
      showToast("success", "Product deactivated (soft delete)");
      setOpenDelete(false);
      setDeleteTarget(null);
      await fetchPage(0, { silent: true });
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.response?.data || e?.message || "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (prod: ProductDTO, next: boolean) => {
    const cid = cateId !== "all" ? Number(cateId) : (prod as any).categoryId ? Number((prod as any).categoryId) : null;
    if (!cid || !(prod as any).productId) return showToast("error", "Missing categoryId/productId");

    // optimistic
    setRows((prev) =>
      prev.map((p: any) => ((p as any).productId === (prod as any).productId ? { ...p, isActive: next } : p))
    );

    try {
      await productApi.setStatus(cid, Number((prod as any).productId), next);
      showToast("success", `Product ${next ? "activated" : "deactivated"}`);
    } catch (e: any) {
      setRows((prev) =>
        prev.map((p: any) => ((p as any).productId === (prod as any).productId ? { ...p, isActive: !next } : p))
      );
      showToast("error", e?.response?.data?.message || e?.response?.data || e?.message || "Status update failed");
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Inventory2OutlinedIcon />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                Menu
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active/Inactive + barcode + sticker PNG download
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <IconButton onClick={() => fetchPage(0)} disabled={loading}>
              <RefreshIcon />
            </IconButton>
            <Button
              onClick={() => downloadAuthenticatedFile("/product/export", "products.csv")}
              variant="outlined"
              startIcon={<DownloadIcon />}
              sx={{ borderRadius: 999 }}
            >
              Export CSV
            </Button>
            <Button onClick={openAdd} variant="contained" startIcon={<AddIcon />} sx={{ borderRadius: 999 }}>
              Add Product
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ flex: 1 }}>
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <Select value={cateId} onChange={(e) => setCateId(e.target.value as any)} displayEmpty>
                <MenuItem value="all">All Categories</MenuItem>
                {categoryOptions.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.label}
                    {c.isActive === false ? " (Inactive)" : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search product..."
              size="small"
              fullWidth={isMobile}
              sx={{ maxWidth: { xs: "100%", md: 420 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>

          <Typography variant="body2" color="text.secondary">
            Total: <b>{totalElements}</b>
          </Typography>
        </Stack>

        <Box sx={{ mt: 2 }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }} color="text.secondary">
                Loading products...
              </Typography>
            </Stack>
          ) : rows.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <Typography sx={{ fontWeight: 800 }}>No products found</Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(3, 1fr)",
                  lg: "repeat(4, 1fr)",
                },
              }}
            >
              {visibleProducts.map((p: any) => {
                const active = toBool(p?.isActive ?? p?.active);

                // ✅ Product type needed for StickerDownloadButton
                const prodForSticker: Product = {
                  productId: Number(p.productId),
                  barcode: p.barcode ?? "",
                  productName: p.productName ?? "",
                  prodPrice: Number(p.prodPrice ?? 0),
                  prodGST: Number(p.prodGST ?? 0),
                  active: active,
                  isActive: active,
                  createdAt: p.createdAt,
                  updatedAt: p.updatedAt,
                  categoryId: p.categoryId,
                  categoryName: p.categoryName,
                };

                return (
                  <Card key={p.productId} variant="outlined" sx={{ borderRadius: 3 }}>
                    <CardContent sx={{ pb: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ pr: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            ID: {p.productId}
                            {p.categoryName ? ` • ${p.categoryName}` : ""}
                          </Typography>

                          <Typography variant="subtitle1" sx={{ fontWeight: 900, mt: 0.5 }}>
                            {p.productName}
                          </Typography>

                          {p.barcode ? (
                            <Typography variant="caption" color="text.secondary">
                              Barcode: <b>{p.barcode}</b>
                            </Typography>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              Barcode: <b>NA</b>
                            </Typography>
                          )}
                        </Box>

                        <Stack spacing={0.5} alignItems="flex-end">
                        <Chip
                          size="small"
                          variant="outlined"
                          color={p.combo ? "secondary" : p.trackStock === false ? "info" : "warning"}
                          label={p.combo ? "Combo" : p.trackStock === false ? "Menu item" : "Stock product"}
                        />
                        <Chip
                          size="small"
                          label={active ? "Active" : "Inactive"}
                          color={active ? "success" : "default"}
                          variant={active ? "filled" : "outlined"}
                        />
                        </Stack>
                      </Stack>

                      <Divider sx={{ my: 1.2 }} />

                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          Sell / Buy
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          ₹ {money(p.prodPrice)} / ₹ {money((p as any).prodBuyPrice ?? 0)}
                        </Typography>
                      </Stack>

                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.6 }}>
                        <Typography variant="body2" color="text.secondary">
                          GST
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {gstLabel(p.prodGST)}
                        </Typography>
                      </Stack>

                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }} alignItems="center">
                        <Typography variant="body2" color="text.secondary">
                          Status
                        </Typography>
                        <Switch size="small" checked={active} onChange={(e) => toggleActive(p, e.target.checked)} />
                      </Stack>
                    </CardContent>

                    {/* ✅ Sticker download button in list itself */}
                    <CardActions sx={{ justifyContent: "space-between", pt: 0 }}>
                      <StickerDownloadButton shop={shop} product={prodForSticker} widthMm={48} heightMm={24} dpi={203} />

                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={() => setOptionsFor({ id: Number(p.productId), name: p.productName, combo: !!p.combo })}>
                          Options
                        </Button>
                        <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEdit(p)}>
                          Edit
                        </Button>
                        <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => askDelete(p)}>
                          Delete
                        </Button>
                      </Stack>
                    </CardActions>
                  </Card>
                );
              })}
            </Box>
          )}

          {!loading && rows.length < totalElements && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={loadMore}
                disabled={loadingMore}
                startIcon={loadingMore ? <CircularProgress size={16} /> : undefined}
                sx={{ borderRadius: 999 }}
              >
                Load more ({rows.length} of {totalElements})
              </Button>
            </Box>
          )}
        </Box>
      </Paper>

      {optionsFor && (
        <MenuOptionsDialog
          open
          onClose={() => setOptionsFor(null)}
          productId={optionsFor.id}
          productName={optionsFor.name}
          isCombo={optionsFor.combo}
        />
      )}

      {/* ADD/EDIT DIALOG */}
      <Dialog open={openForm} onClose={() => (saving ? null : setOpenForm(false))} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>{mode === "add" ? "Add Product" : "Edit Product"}</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={1.5}>
            <FormControl size="small" fullWidth>
              <Typography variant="caption" sx={{ mb: 0.5 }} color="text.secondary">
                What is this?
              </Typography>
              <Select value={form.itemType} onChange={(e) => setForm((p: any) => ({ ...p, itemType: e.target.value }))}>
                <MenuItem value="MENU">Menu item — no stock to maintain (dishes, drinks made to order)</MenuItem>
                <MenuItem value="STOCK">Stock product — quantity tracked (bottled drinks, packaged items)</MenuItem>
                <MenuItem value="COMBO">Combo — a meal deal made of other items</MenuItem>
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                {form.itemType === "MENU" && "Sells freely. If you give it a recipe, its ingredients are deducted instead."}
                {form.itemType === "STOCK" && "Add quantity from the Inventory page; it reduces on every sale and blocks selling when empty."}
                {form.itemType === "COMBO" && "Save first, then use Options → Combo contents to pick what is included."}
              </Typography>
            </FormControl>

            <FormControl size="small" fullWidth>
              <Typography variant="caption" sx={{ mb: 0.5 }} color="text.secondary">
                Category
              </Typography>
              <Select value={formCateId} onChange={(e) => setFormCateId(e.target.value as any)} displayEmpty>
                <MenuItem value="all">Select Category</MenuItem>
                {categoryOptions.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {mode === "edit" && (
              <TextField label="Product ID" value={formProdId ?? ""} InputProps={{ readOnly: true }} size="small" />
            )}

            <TextField
              label="Product Name"
              value={form.productName}
              onChange={(e) => setForm((p: any) => ({ ...p, productName: e.target.value }))}
              size="small"
              inputProps={{ maxLength: 80 }}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="Sell Price (₹)"
                value={form.prodPrice ?? ""}
                onChange={(e) => setForm((p: any) => ({ ...p, prodPrice: numInput(e.target.value, 2) }))}
                size="small"
                fullWidth
                inputMode="decimal"
                placeholder="e.g. 99.50"
              />

              <TextField
                label="Buy Price (₹)"
                value={form.prodBuyPrice ?? ""}
                onChange={(e) => setForm((p: any) => ({ ...p, prodBuyPrice: numInput(e.target.value, 2) }))}
                size="small"
                fullWidth
                inputMode="decimal"
                placeholder="Cost price for profit"
              />

              <TextField
                label="GST (%)"
                value={form.prodGST ?? ""}
                onChange={(e) => setForm((p: any) => ({ ...p, prodGST: numInput(e.target.value, 2) }))}
                size="small"
                fullWidth
                inputMode="decimal"
                placeholder="e.g. 5"
              />
            </Stack>

          

            <FormControlLabel
              control={
                <Switch
                  checked={toBool(form.isActive)}
                  onChange={(e) => setForm((p: any) => ({ ...p, isActive: e.target.checked }))}
                />
              }
              label="Active"
            />

            {/* ✅ Restaurant menu flag -- purely informational, doesn't affect billing.
                Leave "Not set" for retail products where veg/non-veg has no meaning. */}
            <Select
              size="small"
              value={form.isVeg === null || form.isVeg === undefined ? "unset" : form.isVeg ? "veg" : "nonveg"}
              onChange={(e) =>
                setForm((p: any) => ({
                  ...p,
                  isVeg: e.target.value === "unset" ? null : e.target.value === "veg",
                }))
              }
            >
              <MenuItem value="unset">Menu type: not set</MenuItem>
              <MenuItem value="veg">🟢 Veg</MenuItem>
              <MenuItem value="nonveg">🔴 Non-veg</MenuItem>
            </Select>

            {formError ? <Alert severity="warning">{formError}</Alert> : <Box sx={{ height: 4 }} />}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenForm(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={saving || !!formError || formCateId === "all"}
            startIcon={saving ? <CircularProgress size={18} /> : undefined}
          >
            {mode === "add" ? "Save" : "Update"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog open={openDelete} onClose={() => (saving ? null : setOpenDelete(false))} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900 }}>Delete Product</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Delete <b>{deleteTarget?.prod && (deleteTarget.prod as any).productName}</b> ?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will soft-delete (inactive).
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDelete(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmDelete}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} /> : <DeleteOutlineIcon />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* TOAST */}
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
