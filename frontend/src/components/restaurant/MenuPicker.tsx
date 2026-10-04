import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import BlockIcon from "@mui/icons-material/Block";
import RestoreIcon from "@mui/icons-material/Restore";

import { productApi } from "../product/productApi";
import { stockApi } from "../Stock/stockApi";
import { recipeApi, type AvailabilityRow } from "../inventory/inventoryApi";
import { useRestaurantSocket } from "../../utils/useRestaurantSocket";
import type { Product } from "../../utils/types";
import { useAppSelector } from "../../store/hooks";
import { useIncrementalList } from "../../hooks/useIncrementalList";

// A small veg/non-veg dot, the familiar Indian-menu convention (green = veg, red = non-veg).
export function VegDot({ isVeg }: { isVeg?: boolean | null }) {
  if (isVeg === null || isVeg === undefined) return null;
  const c = isVeg ? "#2e7d32" : "#c62828";
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        width: 10,
        height: 10,
        border: `2px solid ${c}`,
        borderRadius: "2px",
        mr: 0.75,
        verticalAlign: "middle",
        "&::after": { content: '""', display: "block", width: 4, height: 4, margin: "1px", borderRadius: "50%", bgcolor: c },
      }}
    />
  );
}

type Unavailable = "OUT_TODAY" | "NO_INGREDIENTS" | "NO_STOCK";
const REASON_LABEL: Record<Unavailable, string> = {
  OUT_TODAY: "Out for today",
  NO_INGREDIENTS: "No ingredients",
  NO_STOCK: "Out of stock",
};

/* ---------- shared snapshot: opening a second order shows the menu instantly instead of re-downloading it ---------- */
type Snapshot = {
  key: string; // login token: never show one hotel's menu to another login in the same browser tab
  at: number;
  products: Product[];
  avail: Record<number, AvailabilityRow>;
  shelf: Record<string, number>;
};
let snapshot: Snapshot | null = null;
const FRESH_MS = 20_000;

type CardProps = {
  p: Product;
  added: number;
  left?: AvailabilityRow;
  shelfQty: number;
  reason: Unavailable | null;
  canManage: boolean;
  onPick: (p: Product) => void;
  onSetOut: (e: React.MouseEvent, p: Product, out: boolean) => void;
};

// One dish tile. memo: adding an item re-renders only the tile whose count changed, not the whole (possibly
// thousand-item) menu.
const MenuCard = memo(function MenuCard({ p, added, left, shelfQty, reason, canManage, onPick, onSetOut }: CardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        position: "relative",
        borderColor: added ? "primary.main" : undefined,
        borderWidth: added ? 2 : 1,
        opacity: reason ? 0.55 : 1,
        bgcolor: reason ? "action.hover" : "background.paper",
        // the browser skips layout/paint for tiles that are scrolled out of view
        contentVisibility: "auto",
        containIntrinsicSize: "auto 100px",
      }}
    >
      <CardActionArea
        disabled={!!reason}
        onClick={() => onPick(p)}
        sx={{ p: 1.25, height: "100%", minHeight: 96, display: "flex", alignItems: "stretch", justifyContent: "flex-start" }}
      >
        <Stack spacing={0.5} sx={{ width: "100%" }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 800,
              lineHeight: 1.25,
              pr: canManage ? 3 : 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            <VegDot isVeg={p.isVeg} />
            {p.productName}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 900, mt: "auto !important" }}>
            ₹{Number(p.prodPrice).toFixed(2)}
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {reason && <Chip size="small" color="error" variant="outlined" label={REASON_LABEL[reason]} />}
            {!reason && p.combo && <Chip size="small" variant="outlined" color="secondary" label="Combo" />}
            {!reason && left?.hasRecipe && (
              <Chip
                size="small"
                variant="outlined"
                color={(left.availablePortions ?? 0) <= 3 ? "error" : (left.availablePortions ?? 0) <= 8 ? "warning" : "success"}
                label={`${left.availablePortions ?? 0} left`}
                title={left.limitingIngredient ? `Limited by ${left.limitingIngredient}` : undefined}
              />
            )}
            {!reason && p.trackStock !== false && !p.combo && !left?.hasRecipe && (
              <Chip size="small" variant="outlined" color={shelfQty <= 5 ? "warning" : "default"} label={`${shelfQty} in stock`} />
            )}
          </Stack>
        </Stack>
      </CardActionArea>
      {added > 0 && (
        <Chip
          size="small"
          color="primary"
          label={`× ${added}`}
          sx={{ position: "absolute", right: 6, bottom: 6, fontWeight: 800, pointerEvents: "none" }}
        />
      )}
      {canManage && (
        <IconButton
          size="small"
          title={p.temporarilyUnavailable ? "Bring back" : "Mark out for today (86)"}
          onClick={(e) => onSetOut(e, p, !p.temporarilyUnavailable)}
          sx={{ position: "absolute", top: 2, right: 2 }}
        >
          {p.temporarilyUnavailable ? <RestoreIcon fontSize="small" color="success" /> : <BlockIcon fontSize="small" color="warning" />}
        </IconButton>
      )}
    </Card>
  );
});

/**
 * Full-height menu picker for the order screen.
 * - search + veg filter + category chips are pinned at the top and never scroll away
 * - the item grid below fills ALL the remaining space and scrolls on its own
 * - tap a card = add one; tapping again adds more (the order panel handles quantities)
 * - items that can't be sold right now are hidden by default, but can be revealed (dimmed, with the reason)
 */
export default function MenuPicker({
  onPick,
  canManage,
  orderedQty,
}: {
  onPick: (p: Product) => void;
  canManage: boolean;
  /** productName -> quantity already on this (unbilled) order, shown as a badge on the card */
  orderedQty: Record<string, number>;
  /** kept for callers; tiles no longer need it (the parent ignores taps while a request is in flight) */
  busy?: boolean;
}) {
  const token = useAppSelector((st) => st.auth.token) ?? "";
  const cached = snapshot && snapshot.key === token ? snapshot : null;

  const [products, setProducts] = useState<Product[]>(cached?.products ?? []);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query); // typing stays instant even on a huge menu
  const [category, setCategory] = useState<string>("ALL");
  const [vegFilter, setVegFilter] = useState<"ALL" | "VEG" | "NONVEG">("ALL");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [availByProduct, setAvailByProduct] = useState<Record<number, AvailabilityRow>>(cached?.avail ?? {});
  const [shelfQty, setShelfQty] = useState<Record<string, number>>(cached?.shelf ?? {});
  const searchRef = useRef<HTMLInputElement>(null);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    try {
      // the three sources are independent: fetch them at the same time (was one after the other)
      const productsP = (async () => {
        // whole active menu, page by page so nothing is silently cut off
        const all: Product[] = [];
        let page = 0;
        let totalPages = 1;
        do {
          const res = await productApi.search({ page, size: 500, active: true, sort: "productName,asc" });
          all.push(...res.content);
          totalPages = res.totalPages || 1;
          page += 1;
        } while (page < totalPages && page < 20);
        return all;
      })();
      const [all, avail, qty] = await Promise.all([
        productsP,
        recipeApi.availability().catch(() => [] as AvailabilityRow[]),
        stockApi.getAllStockQuantities().catch(() => ({} as Record<string, number>)),
      ]);
      const availMap = Object.fromEntries(avail.map((r) => [r.productId, r]));
      snapshot = { key: token, at: Date.now(), products: all, avail: availMap, shelf: qty };
      setAvailByProduct(availMap);
      setShelfQty(qty);
      setProducts(all);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // Fresh copy from a moment ago (e.g. the previous order screen): use it as is. Older: show it, refresh quietly.
    if (cached && Date.now() - cached.at < FRESH_MS) return;
    loadMenu();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A dish was switched off/on elsewhere: refresh so the waiter never adds something that just ran out.
  // Bursts of pushes (several dishes toggled at once) are merged into one reload.
  const reloadTimer = useRef<number | undefined>(undefined);
  useRestaurantSocket("menu", () => {
    window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(loadMenu, 400);
  });
  useEffect(() => () => window.clearTimeout(reloadTimer.current), []);

  // "/" jumps to the search box on desktop keyboards
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // one pass over the menu decides "why can't this be sold" for every dish (was recomputed several times per render)
  const reasons = useMemo(() => {
    const m = new Map<number, Unavailable | null>();
    for (const p of products) {
      let r: Unavailable | null = null;
      if (p.temporarilyUnavailable) r = "OUT_TODAY";
      else if (availByProduct[p.productId]?.outOfStock) r = "NO_INGREDIENTS";
      else {
        const isShelf = p.trackStock !== false && !p.combo && !availByProduct[p.productId]?.hasRecipe;
        if (isShelf && (shelfQty[String(p.productId)] ?? 0) <= 0) r = "NO_STOCK";
      }
      m.set(p.productId, r);
    }
    return m;
  }, [products, availByProduct, shelfQty]);
  const unavailableReason = (p: Product): Unavailable | null => reasons.get(p.productId) ?? null;

  const unavailableCount = useMemo(() => products.filter((p) => reasons.get(p.productId)).length, [products, reasons]);

  const pool = useMemo(
    () => (showUnavailable ? products : products.filter((p) => !reasons.get(p.productId))),
    [products, showUnavailable, reasons]
  );

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    pool.forEach((p) => m.set(p.categoryName || "Other", (m.get(p.categoryName || "Other") ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pool]);

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return pool.filter((p) => {
      if (category !== "ALL" && (p.categoryName || "Other") !== category) return false;
      if (vegFilter === "VEG" && p.isVeg !== true) return false;
      if (vegFilter === "NONVEG" && p.isVeg !== false) return false;
      if (q && !`${p.productName} ${p.categoryName ?? ""} ${p.barcode ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pool, deferredQuery, category, vegFilter]);

  // grouped by category (unavailable ones sink to the bottom of their group)
  const groups = useMemo(() => {
    const m = new Map<string, Product[]>();
    visible.forEach((p) => {
      const k = p.categoryName || "Other";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    });
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, items]) => [name, [...items].sort((a, b) => Number(!!reasons.get(a.productId)) - Number(!!reasons.get(b.productId)))] as const);
  }, [visible, reasons]);

  // Only the first screenful of tiles is built; more are added as the waiter scrolls (see useIncrementalList).
  // Search / filter changes jump back to the top chunk, so a 500-item menu opens and filters instantly.
  const { count: shownCount, sentinel } = useIncrementalList(
    visible.length,
    `${deferredQuery}|${category}|${vegFilter}|${showUnavailable}`
  );
  const shownGroups = useMemo(() => {
    let budget = shownCount;
    const out: { name: string; items: Product[]; total: number }[] = [];
    for (const [name, items] of groups) {
      if (budget <= 0) break;
      out.push({ name, items: items.slice(0, budget), total: items.length });
      budget -= items.length;
    }
    return out;
  }, [groups, shownCount]);

  // stable identities (the parent re-creates its handlers on every render, which would defeat MenuCard's memo)
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const pick = useCallback((p: Product) => onPickRef.current(p), []);

  const setOut = useCallback(async (e: React.MouseEvent, product: Product, out: boolean) => {
    e.stopPropagation();
    try {
      await productApi.toggle86(product.productId, out);
      setProducts((prev) => prev.map((p) => (p.productId === product.productId ? { ...p, temporarilyUnavailable: out } : p)));
    } catch {
      // ignore -- worst case the item just stays as it was
    }
  }, []);

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && visible.length === 1 && !unavailableReason(visible[0])) {
      onPick(visible[0]);
      setQuery("");
    }
    if (e.key === "Escape") setQuery("");
  };

  const renderCard = (p: Product) => (
    <MenuCard
      key={p.productId}
      p={p}
      added={orderedQty[p.productName] ?? 0}
      left={availByProduct[p.productId]}
      shelfQty={shelfQty[String(p.productId)] ?? 0}
      reason={reasons.get(p.productId) ?? null}
      canManage={canManage}
      onPick={pick}
      onSetOut={setOut}
    />
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* ---------- pinned top: search + filters ---------- */}
      <Stack spacing={1} sx={{ pb: 1, flexShrink: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            inputRef={searchRef}
            placeholder="Search dish, category or barcode…   ( / )"
            size="small"
            fullWidth
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: query ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setQuery("")}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
            sx={{ bgcolor: "background.paper" }}
          />
          {loading && <CircularProgress size={18} />}
          <IconButton title="Reload menu" onClick={loadMenu} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ overflowX: "auto" }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={vegFilter}
            onChange={(_, v) => v && setVegFilter(v)}
            sx={{ bgcolor: "background.paper", flexShrink: 0 }}
          >
            <ToggleButton value="ALL" sx={{ px: 1.5 }}>All</ToggleButton>
            <ToggleButton value="VEG" sx={{ px: 1.5 }}><VegDot isVeg /> Veg</ToggleButton>
            <ToggleButton value="NONVEG" sx={{ px: 1.5 }}><VegDot isVeg={false} /> Non-veg</ToggleButton>
          </ToggleButtonGroup>
          {unavailableCount > 0 && (
            <Chip
              size="small"
              variant={showUnavailable ? "filled" : "outlined"}
              color="warning"
              label={`${showUnavailable ? "Hide" : "Show"} unavailable (${unavailableCount})`}
              onClick={() => setShowUnavailable((s) => !s)}
              sx={{ flexShrink: 0 }}
            />
          )}
        </Stack>

        <Stack direction="row" spacing={0.75} sx={{ overflowX: "auto", pb: 0.5 }}>
          <Chip label={`All (${pool.length})`} color={category === "ALL" ? "primary" : "default"} onClick={() => setCategory("ALL")} sx={{ flexShrink: 0, fontWeight: 700 }} />
          {categoryCounts.map(([c, n]) => (
            <Chip
              key={c}
              label={`${c} (${n})`}
              color={category === c ? "primary" : "default"}
              onClick={() => setCategory(c)}
              sx={{ flexShrink: 0, fontWeight: 700 }}
            />
          ))}
        </Stack>
      </Stack>

      {/* ---------- item grid: takes the whole remaining height ---------- */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5, pb: 2 }}>
        {shownGroups.map(({ name, items, total }) => (
          <Box key={name} sx={{ mb: 2 }}>
            {category === "ALL" && (
              <Typography
                variant="overline"
                sx={{ fontWeight: 900, display: "block", position: "sticky", top: 0, zIndex: 1, bgcolor: "#f7f7f7", py: 0.25 }}
              >
                {name} · {total}
              </Typography>
            )}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 1 }}>
              {items.map(renderCard)}
            </Box>
          </Box>
        ))}
        {sentinel}

        {!loading && visible.length === 0 && (
          <Box sx={{ textAlign: "center", py: 6, px: 2 }}>
            <Typography sx={{ fontWeight: 800 }}>No menu items match.</Typography>
            {products.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                The menu is empty — add items under Menu first.
              </Typography>
            ) : unavailableCount > 0 && !showUnavailable ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {unavailableCount} item(s) are hidden because they're out of stock or marked out for today.
                </Typography>
                <Button size="small" variant="outlined" onClick={() => setShowUnavailable(true)}>
                  Show them
                </Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Try a different search or filter.
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
