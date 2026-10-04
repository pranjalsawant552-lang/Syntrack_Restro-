import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  Drawer,
  LinearProgress,
  useMediaQuery,
  useTheme,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Radio,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import PrintIcon from "@mui/icons-material/Print";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import CallMergeIcon from "@mui/icons-material/CallMerge";
import BlockIcon from "@mui/icons-material/Block";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import TakeoutDiningIcon from "@mui/icons-material/TakeoutDining";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import QrCode2Icon from "@mui/icons-material/QrCode2";

import { restaurantApi, type TableBoardRow, type RestaurantOrder } from "../../components/restaurant/restaurantApi";
import { kotApi, type Kot } from "../../components/kot/kotApi";
import { productApi } from "../../components/product/productApi";
import MenuPicker from "../../components/restaurant/MenuPicker";
import OrderCartPanel from "../../components/restaurant/OrderCartPanel";
import { menuOptionsApi, type ProductOptions } from "../../components/menu/menuOptionsApi";
import BillDialog from "../../components/billing/BillDialog";
import { useNavigate } from "react-router-dom";
import QrManagerDialog from "../../components/restaurant/QrManagerDialog";
import QrRequestsDialog from "../../components/restaurant/QrRequestsDialog";
import { selectBranding } from "../../store/brandingSlice";
import type { Product } from "../../utils/types";
import { useAppSelector } from "../../store/hooks";
import { hasPermission } from "../../utils/permissions";
import { useRestaurantSocket } from "../../utils/useRestaurantSocket";
import { setVisibleInterval } from "../../utils/visibleInterval";
import { useIncrementalList } from "../../hooks/useIncrementalList";
import {
  isKotPrinted,
  loadKotPrintSettings,
  markKotsPrinted,
  printKots,
  saveKotPrintSettings,
} from "../../utils/kotPrint";

type Toast = { open: boolean; msg: string; type: "success" | "error" | "info" };

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "#2e7d32",
  OCCUPIED: "#c62828",
  RESERVED: "#1565c0",
  CLEANING: "#757575",
};

type Chosen = { variantId: number | null; modifierIds: number[]; quantity: number; notes?: string };

// Asks for the size / add-ons of an item that has them, and shows the resulting price live.
// The server re-validates and re-prices everything -- this is only for the waiter's convenience.
function OptionChooserDialog({
  product,
  options,
  onCancel,
  onConfirm,
}: {
  product: Product | null;
  options: ProductOptions | null;
  onCancel: () => void;
  onConfirm: (c: Chosen) => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [variantId, setVariantId] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    setVariantId(null);
    setPicked([]);
    setQty(1);
    setNote("");
  }, [product?.productId]);

  if (!product || !options) return null;

  const variant = options.variants.find((v) => v.variantId === variantId);
  const base = variant ? variant.price : product.prodPrice;
  const extras = options.groups.flatMap((g) => g.options).filter((o) => picked.includes(o.optionId)).reduce((s, o) => s + o.price, 0);

  const needsVariant = options.variants.length > 0 && variantId === null;
  const groupProblem = options.groups.find((g) => {
    const n = g.options.filter((o) => picked.includes(o.optionId)).length;
    const min = g.required ? Math.max(1, g.minSelect) : g.minSelect;
    return n < min || (g.maxSelect > 0 && n > g.maxSelect);
  });

  const toggle = (groupId: number, optionId: number, maxSelect: number) => {
    const g = options.groups.find((x) => x.groupId === groupId)!;
    const ids = g.options.map((o) => o.optionId);
    setPicked((prev) => {
      if (prev.includes(optionId)) return prev.filter((x) => x !== optionId);
      if (maxSelect === 1) return [...prev.filter((x) => !ids.includes(x)), optionId];
      const inGroup = prev.filter((x) => ids.includes(x)).length;
      if (maxSelect > 1 && inGroup >= maxSelect) return prev; // at the limit
      return [...prev, optionId];
    });
  };

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <DialogTitle sx={{ fontWeight: 900 }}>{product.productName}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {options.variants.length > 0 && (
            <Box>
              <Typography sx={{ fontWeight: 800 }}>Size <span style={{ color: "#c62828", fontSize: 12 }}>(required)</span></Typography>
              {options.variants.map((v) => (
                <FormControlLabel
                  key={v.variantId}
                  sx={{ display: "flex", mr: 0 }}
                  control={<Radio checked={variantId === v.variantId} onChange={() => setVariantId(v.variantId)} />}
                  label={
                    <Stack direction="row" justifyContent="space-between" sx={{ width: "100%", minWidth: 220 }}>
                      <span>{v.name}</span>
                      <b>₹{v.price.toFixed(2)}</b>
                    </Stack>
                  }
                />
              ))}
            </Box>
          )}
          {options.groups.map((g) => (
            <Box key={g.groupId}>
              <Typography sx={{ fontWeight: 800 }}>
                {g.name}{" "}
                <span style={{ fontSize: 12, color: g.required ? "#c62828" : "#757575" }}>
                  {g.required ? "(required)" : "(optional)"}
                  {g.maxSelect === 1 ? " · pick one" : g.maxSelect > 1 ? ` · up to ${g.maxSelect}` : ""}
                </span>
              </Typography>
              {g.options.map((o) => (
                <FormControlLabel
                  key={o.optionId}
                  sx={{ display: "flex", mr: 0 }}
                  control={
                    g.maxSelect === 1 ? (
                      <Radio checked={picked.includes(o.optionId)} onClick={() => toggle(g.groupId, o.optionId, g.maxSelect)} />
                    ) : (
                      <Checkbox checked={picked.includes(o.optionId)} onChange={() => toggle(g.groupId, o.optionId, g.maxSelect)} />
                    )
                  }
                  label={
                    <Stack direction="row" justifyContent="space-between" sx={{ width: "100%", minWidth: 220 }}>
                      <span>{o.name}</span>
                      {o.price > 0 && <span>+₹{o.price.toFixed(2)}</span>}
                    </Stack>
                  }
                />
              ))}
            </Box>
          ))}
          {options.comboItems.length > 0 && (
            <Alert severity="info" icon={false}>
              Includes: {options.comboItems.map((c) => `${c.quantity}× ${c.componentName}`).join(", ")}
            </Alert>
          )}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Stack direction="row" alignItems="center" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <Button size="small" sx={{ minWidth: 36 }} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</Button>
              <Typography sx={{ minWidth: 28, textAlign: "center", fontWeight: 800 }}>{qty}</Typography>
              <Button size="small" sx={{ minWidth: 36 }} onClick={() => setQty((q) => q + 1)}>+</Button>
            </Stack>
            <TextField size="small" fullWidth label="Notes (e.g. no onion)" value={note} onChange={(e) => setNote(e.target.value)} />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between", px: 2 }}>
        <Typography sx={{ fontWeight: 900 }}>₹{((base + extras) * qty).toFixed(2)}{qty > 1 ? ` (${qty} × ₹${(base + extras).toFixed(2)})` : ""}</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="contained" disabled={needsVariant || !!groupProblem} onClick={() => onConfirm({ variantId, modifierIds: picked, quantity: qty, notes: note.trim() || undefined })}>
            Add
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

export default function TablesBoardPage() {
  const navigate = useNavigate();
  const currentUser = useAppSelector((s) => s.auth.user);
  const canManage = hasPermission(currentUser, "RESTAURANT_MANAGE");

  const [viewTab, setViewTab] = useState<"tables" | "counter">("tables");

  // QR self-ordering: manager (codes / live sessions / settings) + waiter approval queue
  const branding = useAppSelector(selectBranding);
  const canEditSettings = hasPermission(currentUser, "SETTINGS_EDIT");
  const [qrManagerOpen, setQrManagerOpen] = useState(false);
  const [qrRequestsOpen, setQrRequestsOpen] = useState(false);
  const [qrRefreshKey, setQrRefreshKey] = useState(0);

  const [tables, setTables] = useState<TableBoardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "success" });
  const showToast = (type: Toast["type"], msg: string) => setToast({ open: true, type, msg });

  // ✅ Parcel (walk-in takeaway) / Online (delivery platform) orders -- these
  // don't have a table, so they get their own list instead of a grid tile.
  const [counterOrders, setCounterOrders] = useState<RestaurantOrder[]>([]);
  const [counterLoading, setCounterLoading] = useState(false);
  const loadCounterOrders = async () => {
    setCounterLoading(true);
    try {
      setCounterOrders(await restaurantApi.listCounterOrders());
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to load counter orders");
    } finally {
      setCounterLoading(false);
    }
  };

  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [quickOrderType, setQuickOrderType] = useState<"PARCEL" | "ONLINE">("PARCEL");
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerPhone, setQuickCustomerPhone] = useState("");
  const [quickOrderSource, setQuickOrderSource] = useState("");

  const [eightySixed, setEightySixed] = useState<Product[]>([]);
  const loadEightySixed = () => productApi.list86().then(setEightySixed).catch(() => {});

  const [addTableOpen, setAddTableOpen] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState<number | "">("");
  const [newTableSection, setNewTableSection] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [cartSheetOpen, setCartSheetOpen] = useState(false); // phones: the order list slides up as a sheet
  const [mutating, setMutating] = useState(false); // an add / qty / remove request is in flight
  const [openingTableId, setOpeningTableId] = useState<number | null>(null);
  // the logged-in user is the waiter unless someone says otherwise -- no more "seat table" form
  const defaultWaiter = `${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`.trim();

  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [order, setOrder] = useState<RestaurantOrder | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  // orderItemId -> kitchen-side status (NEW / PREPARING / READY / SERVED / VOIDED) from the KOT tickets
  const [kitchenStatus, setKitchenStatus] = useState<Record<number, string>>({});
  const [voidTarget, setVoidTarget] = useState<{ itemId: number; name: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidEmail, setVoidEmail] = useState("");
  const [voidPassword, setVoidPassword] = useState("");
  const [voiding, setVoiding] = useState(false);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [merging, setMerging] = useState(false);

  const [settleOpen, setSettleOpen] = useState(false);
  const [settlePayMethod, setSettlePayMethod] = useState<"CASH" | "CARD" | "UPI" | "SPLIT">("CASH");
  const [settlePayStatus, setSettlePayStatus] = useState<"PAID" | "PENDING">("PAID");
  const [settleDiscount, setSettleDiscount] = useState<number>(0);
  const [settling, setSettling] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  // split-payment / customer details on the settle dialog
  const [settleCash, setSettleCash] = useState<string>("");
  const [settleTendered, setSettleTendered] = useState<string>(""); // cash handed over -> shows the change to return
  const [settleMore, setSettleMore] = useState(false); // discount / customer / split-by-items live under "More options"
  const [boardFilter, setBoardFilter] = useState<"ALL" | "AVAILABLE" | "OCCUPIED" | "BILL">("ALL");
  const [sectionFilter, setSectionFilter] = useState<string>("ALL");
  const [newTableCount, setNewTableCount] = useState<number | "">(1);
  const [settleOnlineMethod, setSettleOnlineMethod] = useState<"CARD" | "UPI">("UPI");
  const [settleCustName, setSettleCustName] = useState("");
  const [settleCustPhone, setSettleCustPhone] = useState("");
  // the final bill shown right after settling
  const [billInvoiceId, setBillInvoiceId] = useState<number | null>(null);
  // option chooser (size / add-ons) for the item being added
  const [chooserProduct, setChooserProduct] = useState<Product | null>(null);
  const [chooserOptions, setChooserOptions] = useState<ProductOptions | null>(null);

  const loadTables = async () => {
    setLoading(true);
    try {
      setTables(await restaurantApi.listTables());
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to load tables");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
    loadCounterOrders();
    loadEightySixed();
    // ✅ Kept as a slow safety-net fallback -- the WebSocket subscription below
    // is what actually keeps this live second-to-second; if a tablet's Wi-Fi
    // drops the socket and reconnection is momentarily stuck, this 30s poll
    // still keeps things from going fully stale.
    const t = setVisibleInterval(() => {
      loadTables();
      loadCounterOrders();
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  // ✅ Live push: another waiter/tablet opening a table, sending a KOT, or
  // settling a bill shows up here within a second, no manual refresh needed.
  // Counter orders ride the same "tables" topic (see RestaurantServiceImpl) --
  // simplest way to keep one broadcast covering both boards.
  useRestaurantSocket<TableBoardRow[]>("tables", (rows) => {
    setTables(rows);
    setQrRefreshKey((k) => k + 1); // a customer may have just submitted an order -- refresh the approval list
    loadCounterOrders();
  });

  // QR countdowns: the server sends "seconds left" with each snapshot; tick it down locally between snapshots.
  useEffect(() => {
    const t = setInterval(() => {
      setTables((prev) =>
        prev.some((r) => r.qrState && (r.qrSecondsLeft ?? 0) > 0)
          ? prev.map((r) =>
              r.qrState && (r.qrSecondsLeft ?? 0) > 0 ? { ...r, qrSecondsLeft: (r.qrSecondsLeft ?? 0) - 1 } : r
            )
          : prev
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useRestaurantSocket("menu", () => {
    loadEightySixed();
  });

  // ✅ Kitchen progress (Preparing / Ready) for the order currently open in the dialog.
  const openOrderId = orderDrawerOpen ? order?.orderId : undefined;
  const loadKitchenStatus = async (orderId: number) => {
    try {
      const kots = await kotApi.forOrder(orderId);
      const map: Record<number, string> = {};
      kots.forEach((k) => k.items.forEach((i) => (map[i.orderItemId] = i.status)));
      setKitchenStatus(map);
    } catch {
      // non-critical: chips just fall back to "Sent to kitchen"
    }
  };

  useEffect(() => {
    if (!openOrderId) {
      setKitchenStatus({});
      return;
    }
    loadKitchenStatus(openOrderId);
    const t = setVisibleInterval(() => loadKitchenStatus(openOrderId), 5000); // safety net if the socket drops
    return () => window.clearInterval(t);
  }, [openOrderId]);

  // Live: kitchen taps Start / Ready on the KDS -> the open order dialog updates immediately.
  useRestaurantSocket<Kot[]>("kots", () => {
    if (openOrderId) loadKitchenStatus(openOrderId);
  });

  const confirmQuickOrder = async () => {
    try {
      const created = await restaurantApi.openQuickOrder({
        orderType: quickOrderType,
        customerName: quickCustomerName || undefined,
        customerPhone: quickCustomerPhone || undefined,
        orderSource: quickOrderType === "ONLINE" ? quickOrderSource || undefined : undefined,
      });
      setQuickOrderOpen(false);
      setQuickCustomerName("");
      setQuickCustomerPhone("");
      setQuickOrderSource("");
      await loadCounterOrders();
      setOrder({ ...created, items: created.items ?? [] });
      setSelectedItemIds([]);
      showWorkspace();
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to open order");
    }
  };

  const activeOrderItems = useMemo(() => (order?.items ?? []).filter((i) => !i.billed), [order]);

  const orderTotal = useMemo(() => {
    return activeOrderItems.reduce((s, i) => s + i.unitPrice * i.quantity * (1 + i.gstPercent / 100), 0);
  }, [activeOrderItems]);

  const selectedTotal = useMemo(() => {
    return activeOrderItems
      .filter((i) => selectedItemIds.includes(i.orderItemId))
      .reduce((s, i) => s + i.unitPrice * i.quantity * (1 + i.gstPercent / 100), 0);
  }, [activeOrderItems, selectedItemIds]);

  // The order screen is a full page. Push a history entry while it is open so the phone's Back button
  // (or browser Back) closes the order screen instead of leaving the app.
  const historyPushed = useRef(false);
  const showWorkspace = () => {
    if (!historyPushed.current) {
      window.history.pushState({ ...(window.history.state ?? {}), orderWorkspace: true }, "");
      historyPushed.current = true;
    }
    setCartSheetOpen(false);
    setOrderDrawerOpen(true);
  };
  const closeWorkspace = () => {
    setOrderDrawerOpen(false);
    setCartSheetOpen(false);
    if (historyPushed.current) {
      historyPushed.current = false;
      window.history.back();
    }
    loadTables();
    loadCounterOrders();
  };
  useEffect(() => {
    const onPop = () => {
      if (historyPushed.current) {
        historyPushed.current = false;
        setOrderDrawerOpen(false);
        setCartSheetOpen(false);
        loadTables();
        loadCounterOrders();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Tapping a free table opens its order straight away (no seat form); tapping a busy one resumes it.
  const handleTableClick = async (row: TableBoardRow) => {
    if (row.status === "AVAILABLE") {
      if (openingTableId !== null) return; // ignore double taps
      setOpeningTableId(row.tableId);
      try {
        const created = await restaurantApi.openOrder(row.tableId, defaultWaiter || undefined, undefined);
        setOrder({ ...created, items: created.items ?? [] });
        setSelectedItemIds([]);
        showWorkspace();
        loadTables();
      } catch (e: any) {
        showToast("error", e?.response?.data?.message || e?.response?.data || e?.message || "Failed to open order");
        loadTables();
      } finally {
        setOpeningTableId(null);
      }
      return;
    }
    if (row.orderId) {
      openExistingOrder(row.orderId);
    }
  };

  const openExistingOrder = async (orderId: number) => {
    setOrderLoading(true);
    showWorkspace();
    try {
      const o = await restaurantApi.getOrder(orderId);
      const items = o.items ?? [];
      setOrder({ ...o, items });
      setSelectedItemIds(items.filter((i) => !i.billed).map((i) => i.orderItemId)); // default: everyone (unbilled) selected
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to load order");
      closeWorkspace();
    } finally {
      setOrderLoading(false);
    }
  };

  const refreshOrder = async () => {
    if (!order) return;
    const o = await restaurantApi.getOrder(order.orderId);
    const items = o.items ?? [];
    setOrder({ ...o, items });
    setSelectedItemIds(items.filter((i) => !i.billed).map((i) => i.orderItemId));
    loadKitchenStatus(order.orderId);
  };

  const errText = (e: any, fallback: string) =>
    e?.response?.data?.message || (typeof e?.response?.data === "string" ? e.response.data : "") || e?.message || fallback;

  // one place for "change the order, then reload it" so taps can't overlap and show stale quantities
  const mutate = async (fn: () => Promise<unknown>, fallback: string) => {
    if (!order || mutating) return;
    setMutating(true);
    try {
      await fn();
      await refreshOrder();
    } catch (e: any) {
      showToast("error", errText(e, fallback));
    } finally {
      setMutating(false);
    }
  };

  const submitItem = async (product: Product, chosen?: Chosen) => {
    if (!order) return;
    await mutate(async () => {
      await restaurantApi.addItem(
        order.orderId,
        product.productId,
        chosen?.quantity ?? 1,
        chosen?.notes,
        chosen?.variantId,
        chosen?.modifierIds
      );
      setChooserProduct(null);
      setChooserOptions(null);
    }, "Failed to add item");
  };

  // Tap a dish = add one. Items with sizes / add-ons / combo contents ask first; a plain dish that is already
  // on the order (not yet sent to the kitchen) just gets its quantity bumped instead of creating a duplicate line.
  const addMenuItem = async (product: Product) => {
    if (!order || mutating) return;
    try {
      const opts = await menuOptionsApi.forProduct(product.productId, true);
      if (opts.variants.length > 0 || opts.groups.length > 0 || opts.comboItems.length > 0) {
        setChooserProduct(product);
        setChooserOptions(opts);
        return;
      }
    } catch {
      // if the options lookup fails, fall through and let the server decide (it re-validates anyway)
    }
    const existing = activeOrderItems.find(
      (i) =>
        i.status === "PENDING" &&
        i.product?.productId === product.productId &&
        !i.variantId &&
        !i.optionsText &&
        !i.notes
    );
    if (existing) {
      await mutate(() => restaurantApi.updateItem(order.orderId, existing.orderItemId, { quantity: existing.quantity + 1 }), "Failed to add item");
    } else {
      await submitItem(product);
    }
  };

  const changeQty = (item: { orderItemId: number }, qty: number) => {
    if (!order) return;
    if (qty <= 0) return removeItem(item.orderItemId);
    return mutate(() => restaurantApi.updateItem(order.orderId, item.orderItemId, { quantity: qty }), "Failed to change quantity");
  };

  const saveNote = (item: { orderItemId: number }, note: string) => {
    if (!order) return;
    return mutate(() => restaurantApi.updateItem(order.orderId, item.orderItemId, { notes: note }), "Failed to save note");
  };

  const removeItem = (itemId: number) => {
    if (!order) return;
    return mutate(() => restaurantApi.removeItem(order.orderId, itemId), "Failed to remove item");
  };

  const confirmVoid = async () => {
    if (!order || !voidTarget) return;
    setVoiding(true);
    try {
      await restaurantApi.voidItem(order.orderId, voidTarget.itemId, {
        reason: voidReason.trim(),
        approverEmail: voidEmail.trim(),
        approverPassword: voidPassword,
      });
      showToast("success", "Item voided");
      setVoidTarget(null);
      setVoidReason("");
      setVoidEmail("");
      setVoidPassword("");
      await refreshOrder();
      loadKitchenStatus(order.orderId);
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.response?.data?.error || e?.message || "Failed to void item");
    } finally {
      setVoiding(false);
    }
  };

  // Thermal KOT slip: for hotels with a single counter device (no kitchen screen). Tickets are claimed on this device
  // once (see KotAutoPrinter) so the live push and this path can never print the same KOT twice.
  const [kotPrintOn, setKotPrintOn] = useState(() => loadKotPrintSettings().mode === "AUTO");
  useEffect(() => {
    const sync = () => setKotPrintOn(loadKotPrintSettings().mode === "AUTO");
    window.addEventListener("kotPrint:settings", sync);
    return () => window.removeEventListener("kotPrint:settings", sync);
  }, []);
  const toggleKotPrint = () => {
    const cur = loadKotPrintSettings();
    const next = { ...cur, mode: cur.mode === "AUTO" ? ("OFF" as const) : ("AUTO" as const) };
    saveKotPrintSettings(next);
    showToast("info", next.mode === "AUTO" ? "KOTs will print on this device" : "KOT printing is off on this device");
  };

  const printNewKots = async (orderId: number) => {
    const settings = loadKotPrintSettings();
    if (settings.mode !== "AUTO") return;
    try {
      const fresh = (await kotApi.forOrder(orderId)).filter((k) => k.status !== "CANCELLED" && !isKotPrinted(k.kotId));
      if (fresh.length === 0) return;
      markKotsPrinted(fresh.map((k) => k.kotId));
      await printKots(fresh, { settings });
    } catch {
      showToast("error", "Sent to kitchen, but the KOT could not be printed — use “Reprint KOT”");
    }
  };

  // Reprint the most recent batch (all stations sent together) for this order -- e.g. paper jam / slip lost.
  const reprintKot = async () => {
    if (!order) return;
    try {
      const all = (await kotApi.forOrder(order.orderId)).filter((k) => k.status !== "CANCELLED");
      if (all.length === 0) return showToast("info", "Nothing has been sent to the kitchen yet");
      const latest = Math.max(...all.map((k) => new Date(k.createdAt).getTime()));
      const batch = all.filter((k) => latest - new Date(k.createdAt).getTime() <= 30_000);
      await printKots(batch, { reprint: true });
    } catch (e: any) {
      showToast("error", errText(e, "Could not reprint the KOT"));
    }
  };

  // Mark food as delivered to the guest. This is the only status step a single-device hotel needs (nobody taps
  // Preparing / Ready on a kitchen screen); with a kitchen screen it is the waiter's final step after "Ready".
  const serveItems = (ids: number[]) =>
    mutate(async () => {
      for (const id of ids) await restaurantApi.markServed(id);
    }, "Failed to mark served");

  const sendKot = async () => {
    if (!order) return;
    try {
      await restaurantApi.sendKot(order.orderId);
      showToast("success", kotPrintOn ? "Sent to kitchen — printing KOT" : "Sent to kitchen");
      await refreshOrder();
      void printNewKots(order.orderId);
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Nothing new to send");
    }
  };

  const cancelOrder = async () => {
    if (!order) return;
    if (!window.confirm("Cancel this order? The table will be freed and nothing will be billed.")) return;
    try {
      await restaurantApi.cancelOrder(order.orderId);
      showToast("success", "Order cancelled");
      closeWorkspace();
      setOrder(null);
      await loadTables();
      await loadCounterOrders();
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to cancel");
    }
  };

  const doSettle = async () => {
    if (!order) return;
    if (selectedItemIds.length === 0) return showToast("error", "Select at least one item to bill");

    const discount = Math.max(0, settleDiscount || 0);
    const payable = Math.max(0, Math.round((selectedTotal - discount) * 100) / 100);

    let split: { cashAmount?: number; onlineAmount?: number; onlinePayMethod?: "CARD" | "UPI" } = {};
    if (settlePayMethod === "SPLIT") {
      const cash = Math.round((parseFloat(settleCash) || 0) * 100) / 100;
      const online = Math.round((payable - cash) * 100) / 100;
      if (cash < 0 || online < 0) return showToast("error", "Cash amount can't be more than the bill");
      split = { cashAmount: cash, onlineAmount: online, onlinePayMethod: settleOnlineMethod };
    }

    setSettling(true);
    try {
      const billingEverything = selectedItemIds.length === activeOrderItems.length;
      const result = await restaurantApi.settleOrder(order.orderId, {
        payMethod: settlePayMethod,
        payStatus: settlePayStatus,
        discountValue: discount,
        itemIds: billingEverything ? undefined : selectedItemIds,
        customerName: settleCustName.trim() || undefined,
        customerPhone: settleCustPhone.trim() || undefined,
        ...split,
      });
      showToast(
        "success",
        billingEverything ? `Bill settled — ${result.invoiceNumber}` : `Split bill ${result.invoiceNumber} — remaining items still open`
      );
      setSettleOpen(false);
      setSettleDiscount(0);
      setSettleCash("");
      setSettleTendered("");
      setSettleMore(false);
      setBillInvoiceId(result.invoiceId); // open the final bill for printing
      if (billingEverything) {
        closeWorkspace();
        setOrder(null);
      } else {
        await refreshOrder();
      }
      await loadTables();
      await loadCounterOrders();
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.response?.data || e?.message || "Settle failed");
    } finally {
      setSettling(false);
    }
  };

  const doMerge = async (sourceOrderId: number) => {
    if (!order) return;
    setMerging(true);
    try {
      await restaurantApi.mergeOrders(sourceOrderId, order.orderId);
      showToast("success", "Tables merged");
      setMergeOpen(false);
      await refreshOrder();
      await loadTables();
      await loadCounterOrders();
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  // Guard against double submit: the dialog used to stay clickable while tables were being created one by one,
  // so a second click started a second loop and every table was created twice.
  const creatingTablesRef = useRef(false);
  const [creatingTables, setCreatingTables] = useState(false);

  const createTable = async () => {
    if (creatingTablesRef.current) return;
    const base = newTableName.trim();
    if (!base) return showToast("error", "Table name is required");
    const count = Math.min(50, Math.max(1, Number(newTableCount) || 1));

    // Bulk: continue numbering after the highest existing "<name> N" instead of starting at 1 again.
    const prefix = `${base.toLowerCase()} `;
    const start =
      tables.reduce((max, t) => {
        const n = t.tableName.trim().toLowerCase();
        if (!n.startsWith(prefix)) return max;
        const rest = n.slice(prefix.length);
        return /^\d+$/.test(rest) ? Math.max(max, parseInt(rest, 10)) : max;
      }, 0) + 1;
    const taken = new Set(tables.map((t) => t.tableName.trim().toLowerCase()));
    const names = count > 1 ? Array.from({ length: count }, (_, i) => `${base} ${start + i}`) : [base];
    const toCreate = names.filter((n) => !taken.has(n.toLowerCase()));
    if (toCreate.length === 0) return showToast("error", `Table "${base}" already exists`);

    creatingTablesRef.current = true;
    setCreatingTables(true);
    let created = 0;
    try {
      for (const name of toCreate) {
        try {
          await restaurantApi.createTable(
            name,
            newTableCapacity === "" ? undefined : Number(newTableCapacity),
            newTableSection || undefined
          );
          created += 1;
        } catch (e: any) {
          if (e?.response?.status === 409) continue; // already exists (server-side check) -> skip it
          throw e;
        }
      }
      setAddTableOpen(false);
      setNewTableName("");
      setNewTableCapacity("");
      setNewTableSection("");
      setNewTableCount(1);
      showToast("success", created > 1 ? `${created} tables added` : created === 1 ? "Table added" : "Those tables already exist");
    } catch (e: any) {
      showToast("error", errText(e, "Failed to add table"));
    } finally {
      creatingTablesRef.current = false;
      setCreatingTables(false);
      await loadTables();
      await loadCounterOrders();
    }
  };

  // Remove a FREE table from the board (hidden, not erased: its past orders and bills stay intact).
  const removeTable = async (row: TableBoardRow) => {
    if (row.status !== "AVAILABLE" || row.orderId) return showToast("error", "Only a free table can be removed");
    if (!window.confirm(`Remove "${row.tableName}" from the board?`)) return;
    try {
      await restaurantApi.updateTable(row.tableId, { active: false });
      showToast("success", `${row.tableName} removed`);
    } catch (e: any) {
      showToast("error", errText(e, "Failed to remove table"));
    }
    loadTables();
  };

  // Tables that share a name (created twice earlier): keep one of each, remove the extra FREE copies.
  const duplicateExtras = useMemo(() => {
    const groups = new Map<string, TableBoardRow[]>();
    tables.forEach((t) => {
      const k = t.tableName.trim().toLowerCase();
      groups.set(k, [...(groups.get(k) ?? []), t]);
    });
    const extras: TableBoardRow[] = [];
    groups.forEach((rows) => {
      if (rows.length < 2) return;
      // keep the one that is in use; otherwise the oldest
      const keep = rows.find((r) => r.status !== "AVAILABLE" || r.orderId) ?? [...rows].sort((a, b) => a.tableId - b.tableId)[0];
      rows.forEach((r) => {
        if (r !== keep && r.status === "AVAILABLE" && !r.orderId) extras.push(r);
      });
    });
    return extras;
  }, [tables]);

  const removeDuplicates = async () => {
    if (!window.confirm(`Remove ${duplicateExtras.length} duplicate table(s)? One table of each name is kept.`)) return;
    try {
      for (const t of duplicateExtras) await restaurantApi.updateTable(t.tableId, { active: false });
      showToast("success", `${duplicateExtras.length} duplicate table(s) removed`);
    } catch (e: any) {
      showToast("error", errText(e, "Failed to remove duplicates"));
    }
    loadTables();
  };

  const clearAll86s = async () => {
    try {
      await productApi.clearAll86s();
      showToast("success", "86 list cleared");
      await loadEightySixed();
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to clear");
    }
  };

  const restore86 = async (p: Product) => {
    try {
      await productApi.toggle86(p.productId, false);
      await loadEightySixed();
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to restore");
    }
  };

  const qrPendingTotal = tables.reduce((n, t) => n + (t.qrPendingRequests ?? 0), 0);
  const fmtLeft = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.max(0, secs % 60)).padStart(2, "0")}`;

  // other occupied tables the current order could pull items in from
  const mergeCandidates = tables.filter(
    (t) => t.status === "OCCUPIED" && t.orderId && t.orderId !== order?.orderId
  );

  const orderClosed = order?.status === "SETTLED" || order?.status === "CANCELLED";
  const canAddItems = canManage && !!order && !orderClosed;
  const orderTitle =
    (order?.table?.tableName ||
      (order?.orderType === "ONLINE"
        ? `Online${order.orderSource ? ` (${order.orderSource})` : ""}`
        : order?.orderType === "PARCEL"
        ? "Parcel"
        : "")) + (order?.customerName ? ` — ${order.customerName}` : "");
  // Big floors: filter by section (AC / Garden / Rooftop ...) and draw the tables in batches while scrolling.
  const sections = useMemo(
    () => Array.from(new Set(tables.map((t) => (t.section ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [tables]
  );
  const activeSection = sectionFilter !== "ALL" && sections.includes(sectionFilter) ? sectionFilter : "ALL";
  const boardTables = useMemo(
    () =>
      tables.filter(
        (t) =>
          (boardFilter === "ALL" || (boardFilter === "BILL" ? !!t.qrBillRequested : t.status === boardFilter)) &&
          (activeSection === "ALL" || (t.section ?? "").trim() === activeSection)
      ),
    [tables, boardFilter, activeSection]
  );
  const { count: tablesShown, sentinel: tablesSentinel } = useIncrementalList(
    boardTables.length,
    `${boardFilter}|${activeSection}`,
    60
  );

  const payableNow = Math.max(0, Math.round((selectedTotal - (settleDiscount || 0)) * 100) / 100);
  const changeDue = Math.round(((parseFloat(settleTendered) || 0) - payableNow) * 100) / 100;
  const cartQty = activeOrderItems.reduce((n, i) => n + i.quantity, 0);
  const orderedQty = activeOrderItems.reduce<Record<string, number>>((m, i) => {
    m[i.productName] = (m[i.productName] ?? 0) + i.quantity;
    return m;
  }, {});

  const cartPanel = order ? (
    <OrderCartPanel
      order={order}
      items={activeOrderItems}
      kitchenStatus={kitchenStatus}
      canEdit={canManage}
      closed={!!orderClosed}
      busy={mutating}
      onQty={changeQty}
      onRemove={(it) => removeItem(it.orderItemId)}
      onVoid={(it) => setVoidTarget({ itemId: it.orderItemId, name: `${it.quantity} × ${it.productName}` })}
      onNote={saveNote}
      onSendKot={sendKot}
      onReprintKot={reprintKot}
      onServe={(it) => serveItems([it.orderItemId])}
      onServeAll={() => serveItems(activeOrderItems.filter((i) => i.status === "SENT_TO_KITCHEN").map((i) => i.orderItemId))}
      onSettle={() => {
        setSelectedItemIds(activeOrderItems.map((i) => i.orderItemId));
        setSettlePayMethod("CASH");
        setSettlePayStatus("PAID");
        setSettleDiscount(0);
        setSettleCash("");
        setSettleTendered("");
        setSettleMore(false);
        setSettleOpen(true);
      }}
      onCancel={cancelOrder}
    />
  ) : null;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Orders
        </Typography>
        <Stack direction="row" spacing={1}>
          <IconButton onClick={() => (viewTab === "tables" ? loadTables() : loadCounterOrders())} disabled={loading || counterLoading}>
            <RefreshIcon />
          </IconButton>
          <Button variant="outlined" startIcon={<BlockIcon />} onClick={() => navigate("/menu-availability")}>
            Availability
          </Button>
          {viewTab === "tables" && (
            <Button
              variant={qrPendingTotal > 0 ? "contained" : "outlined"}
              color={qrPendingTotal > 0 ? "warning" : "primary"}
              startIcon={<QrCode2Icon />}
              onClick={() => (qrPendingTotal > 0 ? setQrRequestsOpen(true) : setQrManagerOpen(true))}
            >
              {qrPendingTotal > 0 ? `${qrPendingTotal} QR order${qrPendingTotal > 1 ? "s" : ""} waiting` : "QR ordering"}
            </Button>
          )}
          {viewTab === "tables" && qrPendingTotal > 0 && (
            <Button variant="outlined" onClick={() => setQrManagerOpen(true)}>
              QR settings
            </Button>
          )}
          {canManage && viewTab === "tables" && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddTableOpen(true)}>
              Add table
            </Button>
          )}
          {canManage && viewTab === "counter" && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setQuickOrderOpen(true)}>
              New parcel/online order
            </Button>
          )}
        </Stack>
      </Stack>

      <Tabs value={viewTab} onChange={(_, v) => setViewTab(v)} sx={{ mb: 2 }}>
        <Tab value="tables" label="Tables" icon={<TableRestaurantIcon />} iconPosition="start" />
        <Tab
          value="counter"
          label={`Parcel / Online${counterOrders.length ? ` (${counterOrders.length})` : ""}`}
          icon={<TakeoutDiningIcon />}
          iconPosition="start"
        />
      </Tabs>

      {eightySixed.length > 0 && (
        <Alert
          severity="warning"
          icon={<BlockIcon />}
          sx={{ mb: 2 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button color="inherit" size="small" onClick={() => navigate("/menu-availability")}>
                Manage
              </Button>
              {canManage && (
                <Button color="inherit" size="small" onClick={clearAll86s}>
                  Clear all
                </Button>
              )}
            </Stack>
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Out for today ({eightySixed.length}):
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {eightySixed.map((p) => (
              <Chip
                key={p.productId}
                size="small"
                label={p.productName}
                onDelete={canManage ? () => restore86(p) : undefined}
                deleteIcon={<RestaurantIcon fontSize="small" />}
                title="Click the icon to bring it back"
              />
            ))}
          </Stack>
        </Alert>
      )}

      {viewTab === "tables" ? (
      loading && tables.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : tables.length === 0 ? (
        <Alert severity="info">No tables yet. Add your first table to get started.</Alert>
      ) : (
        <>
        <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: "auto" }}>
          {([
            ["ALL", "All", tables.length],
            ["AVAILABLE", "Free", tables.filter((t) => t.status === "AVAILABLE").length],
            ["OCCUPIED", "Occupied", tables.filter((t) => t.status === "OCCUPIED").length],
            ["BILL", "Bill requested", tables.filter((t) => t.qrBillRequested).length],
          ] as const).map(([key, label, n]) => (
            <Chip
              key={key}
              label={`${label} (${n})`}
              color={boardFilter === key ? "primary" : "default"}
              onClick={() => setBoardFilter(key)}
              sx={{ fontWeight: 700, flexShrink: 0 }}
            />
          ))}
          {canManage && duplicateExtras.length > 0 && (
            <Chip
              color="warning"
              variant="outlined"
              icon={<DeleteOutlineIcon />}
              label={`Remove ${duplicateExtras.length} duplicate table${duplicateExtras.length === 1 ? "" : "s"}`}
              onClick={removeDuplicates}
              sx={{ fontWeight: 700, flexShrink: 0 }}
            />
          )}
        </Stack>
        {sections.length > 1 && (
          <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: "auto" }}>
            <Chip size="small" label="All sections" color={activeSection === "ALL" ? "primary" : "default"} onClick={() => setSectionFilter("ALL")} sx={{ flexShrink: 0 }} />
            {sections.map((sec) => (
              <Chip key={sec} size="small" label={`${sec} (${tables.filter((t) => (t.section ?? "").trim() === sec).length})`} color={activeSection === sec ? "primary" : "default"} onClick={() => setSectionFilter(sec)} sx={{ flexShrink: 0 }} />
            ))}
          </Stack>
        )}
        <Grid container spacing={2}>
          {boardTables.slice(0, tablesShown).map((row) => (
            <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={row.tableId}>
              <Card
                variant="outlined"
                sx={{
                  position: "relative",
                  borderTop: `4px solid ${STATUS_COLOR[row.status] || "#999"}`,
                  opacity: row.status === "CLEANING" ? 0.6 : 1,
                }}
              >
                {canManage && row.status === "AVAILABLE" && !row.orderId && (
                  <IconButton
                    size="small"
                    title="Remove this table"
                    onClick={() => removeTable(row)}
                    sx={{ position: "absolute", top: 4, right: 4, zIndex: 1, opacity: 0.6, "&:hover": { opacity: 1 } }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                )}
                <CardActionArea onClick={() => handleTableClick(row)} disabled={openingTableId === row.tableId} sx={{ p: 1.5 }}>
                  <CardContent sx={{ p: 0.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {row.tableName}
                    </Typography>
                    {row.section && (
                      <Typography variant="caption" color="text.secondary">
                        {row.section}
                      </Typography>
                    )}
                    <Chip
                      size="small"
                      label={row.status}
                      sx={{ mt: 1, bgcolor: STATUS_COLOR[row.status], color: "#fff", fontWeight: 700 }}
                    />
                    {(row.qrPendingRequests ?? 0) > 0 && (
                      <Chip
                        size="small"
                        color="warning"
                        icon={<QrCode2Icon />}
                        label={`${row.qrPendingRequests} to accept`}
                        sx={{ mt: 1, ml: 0.5, fontWeight: 700 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setQrRequestsOpen(true);
                        }}
                      />
                    )}
                    {row.qrState === "HOLD" && (row.qrPendingRequests ?? 0) === 0 && (
                      <Chip
                        size="small"
                        variant="outlined"
                        color="warning"
                        icon={<QrCode2Icon />}
                        label={`Scanned ${fmtLeft(row.qrSecondsLeft ?? 0)}`}
                        sx={{ mt: 1, ml: 0.5 }}
                        title="A customer scanned this table's QR but hasn't ordered yet. It releases automatically."
                      />
                    )}
                    {row.qrState === "ACTIVE" && (
                      <Chip
                        size="small"
                        variant="outlined"
                        color="info"
                        icon={<QrCode2Icon />}
                        label={`QR ${fmtLeft(row.qrSecondsLeft ?? 0)}`}
                        sx={{ mt: 1, ml: 0.5 }}
                        title="Customer can order from their phone until this runs out"
                      />
                    )}
                    {row.qrBillRequested && (
                      <Chip size="small" color="error" label="Bill requested" sx={{ mt: 1, ml: 0.5, fontWeight: 700 }} />
                    )}
                    {row.orderId && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2">{row.itemCount} item(s)</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          ₹{(row.runningTotal ?? 0).toFixed(2)}
                        </Typography>
                        {row.waiterName && (
                          <Typography variant="caption" color="text.secondary">
                            {row.waiterName}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
        {tablesSentinel}
        </>
      )
      ) : counterLoading && counterOrders.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : counterOrders.length === 0 ? (
        <Alert severity="info">No parcel or online orders right now.</Alert>
      ) : (
        <Grid container spacing={2}>
          {counterOrders.map((o) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={o.orderId}>
              <Card variant="outlined" sx={{ borderTop: `4px solid ${o.orderType === "ONLINE" ? "#6a1b9a" : "#ef6c00"}` }}>
                <CardActionArea onClick={() => openExistingOrder(o.orderId)} sx={{ p: 1.5 }}>
                  <CardContent sx={{ p: 0.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                          {o.customerName || `Order #${o.orderId}`}
                        </Typography>
                        {o.customerPhone && (
                          <Typography variant="caption" color="text.secondary">
                            {o.customerPhone}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        size="small"
                        icon={<TakeoutDiningIcon fontSize="small" />}
                        label={o.orderType === "ONLINE" ? o.orderSource || "Online" : "Parcel"}
                        sx={{ fontWeight: 700 }}
                      />
                    </Stack>
                    <Chip size="small" label={o.status} sx={{ mt: 1 }} color={o.status === "KOT_SENT" ? "info" : "default"} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {(o.items ?? []).filter((i) => !i.billed).length} item(s)
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ADD TABLE */}
      <QrManagerDialog
        open={qrManagerOpen}
        onClose={() => setQrManagerOpen(false)}
        canManage={canManage}
        canEditSettings={canEditSettings}
        restaurantName={branding.appName || "Restaurant"}
        boardRows={tables}
        onChanged={loadTables}
      />
      <QrRequestsDialog
        open={qrRequestsOpen}
        onClose={() => setQrRequestsOpen(false)}
        canManage={canManage}
        onChanged={loadTables}
        refreshKey={qrRefreshKey}
      />

      <Dialog open={addTableOpen} onClose={() => !creatingTables && setAddTableOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add table</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={Number(newTableCount) > 1 ? "Name prefix (e.g. Table)" : "Table name"}
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              autoFocus
              helperText={Number(newTableCount) > 1 ? `Creates ${newTableName.trim() || "Table"} 1 … ${newTableName.trim() || "Table"} ${Math.min(50, Number(newTableCount))}` : undefined}
            />
            <TextField
              label="How many tables?"
              type="number"
              value={newTableCount}
              onChange={(e) => setNewTableCount(e.target.value === "" ? "" : Math.min(50, Math.max(1, Number(e.target.value))))}
              helperText="Set up a whole floor in one go"
            />
            <TextField
              label="Capacity"
              type="number"
              value={newTableCapacity}
              onChange={(e) => setNewTableCapacity(e.target.value === "" ? "" : Number(e.target.value))}
            />
            <TextField label="Section (optional)" value={newTableSection} onChange={(e) => setNewTableSection(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddTableOpen(false)} disabled={creatingTables}>Cancel</Button>
          <Button variant="contained" onClick={createTable} disabled={creatingTables}>
            {creatingTables ? <CircularProgress size={20} /> : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* NEW PARCEL / ONLINE ORDER */}
      <Dialog open={quickOrderOpen} onClose={() => setQuickOrderOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New parcel / online order</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Select value={quickOrderType} onChange={(e) => setQuickOrderType(e.target.value as any)}>
              <MenuItem value="PARCEL">Parcel (walk-in takeaway)</MenuItem>
              <MenuItem value="ONLINE">Online (delivery platform)</MenuItem>
            </Select>
            {quickOrderType === "ONLINE" && (
              <TextField
                label="Platform (e.g. Zomato, Swiggy, Website)"
                value={quickOrderSource}
                onChange={(e) => setQuickOrderSource(e.target.value)}
              />
            )}
            <TextField
              label="Customer name (optional)"
              value={quickCustomerName}
              onChange={(e) => setQuickCustomerName(e.target.value)}
              autoFocus
            />
            <TextField
              label="Customer phone (optional)"
              value={quickCustomerPhone}
              onChange={(e) => setQuickCustomerPhone(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickOrderOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={confirmQuickOrder}>
            Start order
          </Button>
        </DialogActions>
      </Dialog>

      {/* ORDER SCREEN -- a full page: menu (search + filters pinned on top) on the left, the running order on the right.
          On phones the order list is a bottom sheet opened from the sticky "View order" bar. */}
      <Dialog
        fullScreen
        open={orderDrawerOpen}
        onClose={closeWorkspace}
        slotProps={{ paper: { sx: { bgcolor: "#f7f7f7" } } }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: { xs: 0.5, md: 2 },
              py: 0.75,
              bgcolor: "background.paper",
              borderBottom: "1px solid",
              borderColor: "divider",
              flexShrink: 0,
            }}
          >
            <IconButton onClick={closeWorkspace} title="Back to tables">
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }} noWrap>
                {orderTitle}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                Order #{order?.orderId}
                {order?.waiterName ? ` · ${order.waiterName}` : ""}
                {order?.guestCount ? ` · ${order.guestCount} guests` : ""}
              </Typography>
            </Box>
            {order && (
              <Chip
                size="small"
                label={order.status}
                sx={{ fontWeight: 700 }}
                color={order.status === "SETTLED" ? "success" : order.status === "CANCELLED" ? "default" : "warning"}
              />
            )}
            {canManage && order?.orderType === "DINE_IN" && !orderClosed && mergeCandidates.length > 0 && (
              <Button size="small" startIcon={<CallMergeIcon />} onClick={() => setMergeOpen(true)}>
                {isMobile ? "Merge" : "Merge another table in"}
              </Button>
            )}
            <Chip
              size="small"
              icon={<PrintIcon />}
              label={isMobile ? (kotPrintOn ? "KOT ✓" : "KOT") : kotPrintOn ? "KOT print: ON" : "KOT print: OFF"}
              color={kotPrintOn ? "success" : "default"}
              variant={kotPrintOn ? "filled" : "outlined"}
              onClick={toggleKotPrint}
              title="Print a thermal KOT slip on this device when items are sent to the kitchen"
            />
            <IconButton title="Refresh" onClick={() => order && refreshOrder()}>
              <RefreshIcon />
            </IconButton>
          </Box>
          {(mutating || orderLoading) && <LinearProgress sx={{ flexShrink: 0 }} />}

          {orderLoading || !order ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
                {canAddItems ? (
                  <Box sx={{ flex: 1, minWidth: 0, p: { xs: 1, md: 2 }, pb: { xs: 0, md: 2 } }}>
                    <MenuPicker
                      onPick={addMenuItem}
                      canManage={canManage}
                      busy={mutating}
                      orderedQty={orderedQty}
                    />
                  </Box>
                ) : null}
                {(!isMobile || !canAddItems) && (
                  <Box
                    sx={{
                      width: canAddItems ? { md: 380, lg: 420 } : "100%",
                      maxWidth: canAddItems ? undefined : 640,
                      mx: canAddItems ? 0 : "auto",
                      flexShrink: 0,
                      borderLeft: canAddItems ? "1px solid" : 0,
                      borderColor: "divider",
                      minHeight: 0,
                    }}
                  >
                    {cartPanel}
                  </Box>
                )}
              </Box>

              {isMobile && canAddItems && (
                <Box sx={{ p: 1, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider", flexShrink: 0 }}>
                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    onClick={() => setCartSheetOpen(true)}
                    startIcon={
                      <Badge badgeContent={cartQty} color="secondary" showZero>
                        <ShoppingCartIcon />
                      </Badge>
                    }
                    sx={{ justifyContent: "space-between", px: 2 }}
                  >
                    <span>View order</span>
                    <span>₹{orderTotal.toFixed(2)}</span>
                  </Button>
                </Box>
              )}
            </>
          )}
        </Box>

        <Drawer
          anchor="bottom"
          open={isMobile && cartSheetOpen}
          onClose={() => setCartSheetOpen(false)}
          sx={{ zIndex: (t) => t.zIndex.modal + 1 }}
          slotProps={{ paper: { sx: { height: "88vh", borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: "hidden" } } }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1 }}>
            <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "divider", mx: "auto", position: "absolute", left: 0, right: 0, top: 6 }} />
            <Box />
            <IconButton onClick={() => setCartSheetOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <Box sx={{ flex: 1, minHeight: 0 }}>{cartPanel}</Box>
        </Drawer>
      </Dialog>

      {/* VOID ITEM (already sent to kitchen) */}
      <Dialog open={!!voidTarget} onClose={() => !voiding && setVoidTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Void {voidTarget?.name}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              This item is already with the kitchen, so removing it needs a manager/admin's approval.
            </Typography>
            <TextField label="Reason" size="small" fullWidth value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
            <TextField label="Manager email" size="small" fullWidth value={voidEmail} onChange={(e) => setVoidEmail(e.target.value)} />
            <TextField label="Manager password" type="password" size="small" fullWidth value={voidPassword} onChange={(e) => setVoidPassword(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoidTarget(null)} disabled={voiding}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={confirmVoid}
            disabled={voiding || !voidReason.trim() || !voidEmail.trim() || !voidPassword}
          >
            Void item
          </Button>
        </DialogActions>
      </Dialog>

      {/* MERGE TABLES */}
      <Dialog open={mergeOpen} onClose={() => setMergeOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Merge a table into {order?.table?.tableName}</DialogTitle>
        <DialogContent dividers>
          {mergeCandidates.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              No other occupied tables right now.
            </Typography>
          ) : (
            <List>
              {mergeCandidates.map((t) => (
                <ListItemButton key={t.tableId} onClick={() => doMerge(t.orderId!)} disabled={merging}>
                  <ListItemText
                    primary={t.tableName}
                    secondary={`${t.itemCount ?? 0} item(s) · ₹${(t.runningTotal ?? 0).toFixed(2)}`}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* SETTLE -- the common case (whole bill, paid, no discount) is one tap: pick how they paid, press Collect.
          Discount / customer / part-paying-by-items / pay-later are tucked under "More options". */}
      <Dialog open={settleOpen} onClose={() => setSettleOpen(false)} fullWidth maxWidth="xs" fullScreen={isMobile && settleMore}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Amount to collect
          </Typography>
          <Typography sx={{ fontWeight: 900, fontSize: 34, lineHeight: 1.1 }}>
            ₹{payableNow.toFixed(2)}
          </Typography>
          {(settleDiscount || 0) > 0 && (
            <Typography variant="caption" color="text.secondary">
              ₹{selectedTotal.toFixed(2)} − ₹{Number(settleDiscount).toFixed(2)} discount
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <ToggleButtonGroup
              fullWidth
              exclusive
              color="primary"
              value={settlePayMethod}
              onChange={(_, v) => v && setSettlePayMethod(v)}
            >
              <ToggleButton value="CASH" sx={{ py: 1.5, fontWeight: 800 }}>Cash</ToggleButton>
              <ToggleButton value="UPI" sx={{ py: 1.5, fontWeight: 800 }}>UPI</ToggleButton>
              <ToggleButton value="CARD" sx={{ py: 1.5, fontWeight: 800 }}>Card</ToggleButton>
              <ToggleButton value="SPLIT" sx={{ py: 1.5, fontWeight: 800 }}>Split</ToggleButton>
            </ToggleButtonGroup>

            {settlePayMethod === "CASH" && settlePayStatus === "PAID" && (
              <Box>
                <TextField
                  label="Cash received (optional)"
                  size="small"
                  fullWidth
                  inputMode="decimal"
                  value={settleTendered}
                  onChange={(e) => setSettleTendered(e.target.value.replace(/[^0-9.]/g, ""))}
                />
                <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label="Exact" onClick={() => setSettleTendered(String(payableNow))} />
                  {[100, 200, 500, 2000].filter((n) => n >= payableNow).slice(0, 3).map((n) => (
                    <Chip key={n} size="small" label={`₹${n}`} onClick={() => setSettleTendered(String(n))} />
                  ))}
                </Stack>
                {(parseFloat(settleTendered) || 0) > 0 && (
                  <Typography sx={{ mt: 1, fontWeight: 800 }} color={changeDue >= 0 ? "success.main" : "error.main"}>
                    {changeDue >= 0 ? `Return change: ₹${changeDue.toFixed(2)}` : `Short by ₹${Math.abs(changeDue).toFixed(2)}`}
                  </Typography>
                )}
              </Box>
            )}

            {settlePayMethod === "SPLIT" && (
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Cash received"
                  size="small"
                  fullWidth
                  inputMode="decimal"
                  value={settleCash}
                  onChange={(e) => setSettleCash(e.target.value.replace(/[^0-9.]/g, ""))}
                  helperText={`${settleOnlineMethod}: ₹${Math.max(0, Math.round((payableNow - (parseFloat(settleCash) || 0)) * 100) / 100).toFixed(2)}`}
                />
                <Select size="small" value={settleOnlineMethod} onChange={(e) => setSettleOnlineMethod(e.target.value as any)} sx={{ minWidth: 90 }}>
                  <MenuItem value="UPI">UPI</MenuItem>
                  <MenuItem value="CARD">Card</MenuItem>
                </Select>
              </Stack>
            )}

            <Button size="small" onClick={() => setSettleMore((m) => !m)} sx={{ alignSelf: "flex-start" }}>
              {settleMore ? "Fewer options" : "More options (discount, customer, pay later, split by items)"}
            </Button>

            <Collapse in={settleMore} unmountOnExit>
              <Stack spacing={2}>
                <Box>
                  <TextField
                    label="Discount (₹)"
                    type="number"
                    size="small"
                    fullWidth
                    value={settleDiscount || ""}
                    onChange={(e) => setSettleDiscount(Math.min(selectedTotal, Math.max(0, parseFloat(e.target.value) || 0)))}
                  />
                  <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }}>
                    {[5, 10, 15].map((pct) => (
                      <Chip key={pct} size="small" label={`${pct}%`} onClick={() => setSettleDiscount(Math.round(selectedTotal * pct) / 100)} />
                    ))}
                    <Chip size="small" variant="outlined" label="Clear" onClick={() => setSettleDiscount(0)} />
                  </Stack>
                </Box>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={settlePayStatus === "PENDING"}
                      onChange={(e) => setSettlePayStatus(e.target.checked ? "PENDING" : "PAID")}
                    />
                  }
                  label="Pay later (bill as pending)"
                />

                <Stack direction="row" spacing={1}>
                  <TextField label="Customer name" size="small" fullWidth value={settleCustName} onChange={(e) => setSettleCustName(e.target.value)} />
                  <TextField label="Phone" size="small" fullWidth value={settleCustPhone} onChange={(e) => setSettleCustPhone(e.target.value)} />
                </Stack>

                {activeOrderItems.length > 1 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Splitting the bill? Uncheck the items that belong to a separate payment.
                    </Typography>
                    <Stack sx={{ mt: 1 }} divider={<Divider />}>
                      {activeOrderItems.map((it) => (
                        <Stack key={it.orderItemId} direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" alignItems="center">
                            <Checkbox
                              size="small"
                              checked={selectedItemIds.includes(it.orderItemId)}
                              onChange={(e) =>
                                setSelectedItemIds((prev) =>
                                  e.target.checked ? [...prev, it.orderItemId] : prev.filter((id) => id !== it.orderItemId)
                                )
                              }
                            />
                            <Typography variant="body2">
                              {it.quantity} × {it.productName}
                              {it.variantName ? ` (${it.variantName})` : ""}
                            </Typography>
                          </Stack>
                          <Typography variant="body2">₹{(it.unitPrice * it.quantity).toFixed(2)}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Collapse>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setSettleOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            size="large"
            sx={{ flex: 1, fontWeight: 900 }}
            onClick={doSettle}
            disabled={settling || selectedItemIds.length === 0}
          >
            {settling ? (
              <CircularProgress size={22} />
            ) : settlePayStatus === "PENDING" ? (
              "Bill as pending"
            ) : (
              `Collect ₹${payableNow.toFixed(2)}`
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <OptionChooserDialog
        product={chooserProduct}
        options={chooserOptions}
        onCancel={() => {
          setChooserProduct(null);
          setChooserOptions(null);
        }}
        onConfirm={(c) => chooserProduct && submitItem(chooserProduct, c)}
      />

      <BillDialog open={billInvoiceId !== null} invoiceId={billInvoiceId} onClose={() => setBillInvoiceId(null)} />

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.type} variant="filled">
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
