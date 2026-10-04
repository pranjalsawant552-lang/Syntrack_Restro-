import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Radio,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import type { ProductOptions } from "../../components/menu/menuOptionsApi";
import { setVisibleInterval } from "../../utils/visibleInterval";
import { useIncrementalList } from "../../hooks/useIncrementalList";
import {
  errorMessage,
  publicQrApi,
  type Landing,
  type MenuCategory,
  type MenuItem,
  type SessionView,
} from "../../components/public/publicQrApi";

/**
 * What a customer sees after scanning a table's QR. No login. Flow:
 *   landing (restaurant + table)  ->  "Start ordering" (short hold on the table)
 *   ->  browse menu, build cart, place order  ->  (staff accept the first order)  ->  keep ordering until the
 *   session timer ends  ->  "Request bill" (staff settle the bill; the customer never pays in the app).
 */

type CartLine = {
  key: string;
  product: MenuItem;
  quantity: number;
  notes: string;
  variantId: number | null;
  modifierIds: number[];
  label: string; // "Half · Extra cheese"
  unitPrice: number; // shown price only -- the server re-prices everything
};

const storageKey = (slug: string, qrToken: string) => `qr_session:${slug}:${qrToken}`;
const fmt = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.max(0, secs % 60)).padStart(2, "0")}`;
const rupee = (n: number) => `₹${n.toFixed(2)}`;

function VegDot({ veg }: { veg?: boolean | null }) {
  if (veg == null) return null;
  const c = veg ? "#2e7d32" : "#b71c1c";
  return (
    <Box component="span" sx={{ display: "inline-block", width: 14, height: 14, border: `2px solid ${c}`, borderRadius: "3px", position: "relative", mr: 1, verticalAlign: "middle" }}>
      <Box sx={{ position: "absolute", inset: 2, borderRadius: "50%", bgcolor: c }} />
    </Box>
  );
}

export default function QrOrderPage() {
  const { slug = "", qrToken = "" } = useParams();

  const [landing, setLanding] = useState<Landing | null>(null);
  const [fatal, setFatal] = useState("");
  const [token, setToken] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey(slug, qrToken)) || "";
    } catch {
      return "";
    }
  });
  const [session, setSession] = useState<SessionView | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  const [tab, setTab] = useState<"menu" | "order">("menu");
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [category, setCategory] = useState("ALL");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const clientRequestId = useRef<string>("");

  // options chooser
  const [chooser, setChooser] = useState<{ item: MenuItem; options: ProductOptions } | null>(null);
  const [chooserBusy, setChooserBusy] = useState<number | null>(null);

  const [secsLeft, setSecsLeft] = useState(0);

  /* ---- load landing, and resume an existing session for this table if this phone has one ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const l = await publicQrApi.landing(slug, qrToken);
        if (cancelled) return;
        setLanding(l);
        document.title = `${l.restaurantName} · Table ${l.tableName}`;
        if (token) {
          try {
            const s = await publicQrApi.session(slug, token);
            if (!cancelled) setSession(s);
          } catch {
            // stale/unknown token -> just show the landing page again
            if (!cancelled) {
              setToken("");
              try { localStorage.removeItem(storageKey(slug, qrToken)); } catch { /* ignore */ }
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) setFatal(errorMessage(e, "This QR code isn't valid any more. Please ask our staff for help."));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, qrToken]);

  const live = session?.state === "HOLD" || session?.state === "ACTIVE";

  /* ---- keep the session fresh: poll status; tick the timer locally in between ---- */
  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setSession(await publicQrApi.session(slug, token));
    } catch {
      /* transient -- next poll fixes it */
    }
  }, [slug, token]);

  useEffect(() => {
    if (!token || !session) return;
    if (!live) return;
    const waiting = session.requests.some((r) => r.status === "PENDING");
    const t = setVisibleInterval(refresh, waiting ? 4000 : 10000);
    return () => clearInterval(t);
  }, [token, session, live, refresh]);

  useEffect(() => {
    setSecsLeft(session?.secondsLeft ?? 0);
  }, [session?.secondsLeft, session?.state]);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [live]);
  useEffect(() => {
    // the local timer hit zero: ask the server so the page flips to "timed out" right away
    if (live && secsLeft === 0 && session && session.secondsLeft > 0) refresh();
  }, [secsLeft, live, session, refresh]);

  /* ---- menu (only once we have a live session) ---- */
  const reloadMenu = useCallback(
    async (silent: boolean) => {
      if (!token) return;
      try {
        const fresh = await publicQrApi.menu(slug, token);
        setMenu(fresh);
        // a dish that ran out while it was sitting in the cart: take it out and say so
        const ids = new Set(fresh.flatMap((c) => c.items.map((i) => i.productId)));
        setCart((prev) => {
          const gone = prev.filter((l) => !ids.has(l.product.productId));
          if (gone.length === 0) return prev;
          setNotice({
            type: "info",
            text: `${Array.from(new Set(gone.map((g) => g.product.name))).join(", ")} just became unavailable and was removed from your cart.`,
          });
          clientRequestId.current = "";
          return prev.filter((l) => ids.has(l.product.productId));
        });
      } catch (e: any) {
        if (!silent) setNotice({ type: "error", text: errorMessage(e) });
      }
    },
    [slug, token]
  );

  useEffect(() => {
    if (!token || !live || menu.length > 0) return;
    reloadMenu(false);
  }, [token, live, menu.length, reloadMenu]);

  // Kitchen may run out of something while the customer is browsing: refresh the menu every 45 s while it's on screen.
  useEffect(() => {
    if (!token || !live || tab !== "menu") return;
    const t = setVisibleInterval(() => reloadMenu(true), 45_000);
    return () => clearInterval(t);
  }, [token, live, tab, reloadMenu]);

  const start = async () => {
    setStarting(true);
    setStartError("");
    try {
      const res = await publicQrApi.start(slug, qrToken, token || undefined);
      setToken(res.sessionToken);
      try { localStorage.setItem(storageKey(slug, qrToken), res.sessionToken); } catch { /* ignore */ }
      setSession(res.session);
      setMenu([]);
    } catch (e: any) {
      setStartError(errorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  /* ---- cart ---- */
  const cartCount = cart.reduce((n, l) => n + l.quantity, 0);
  const cartTotal = cart.reduce((n, l) => n + l.unitPrice * l.quantity, 0);

  const addToCart = (item: MenuItem, variantId: number | null, modifierIds: number[], label: string, unitPrice: number) => {
    const key = `${item.productId}|${variantId ?? ""}|${[...modifierIds].sort().join(",")}`;
    setCart((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) return prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l));
      return [...prev, { key, product: item, quantity: 1, notes: "", variantId, modifierIds, label, unitPrice }];
    });
    clientRequestId.current = ""; // cart changed -> a new submit is a new order
  };

  const onAdd = async (item: MenuItem) => {
    if (!item.customisable && !item.combo) {
      addToCart(item, null, [], "", item.price);
      return;
    }
    setChooserBusy(item.productId);
    try {
      const options = await publicQrApi.options(slug, token, item.productId);
      if (options.variants.length === 0 && options.groups.length === 0) {
        addToCart(item, null, [], "", item.price); // combo with nothing to choose
      } else {
        setChooser({ item, options });
      }
    } catch (e: any) {
      setNotice({ type: "error", text: errorMessage(e) });
    } finally {
      setChooserBusy(null);
    }
  };

  const changeQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0 && l.quantity <= 20)
    );
    clientRequestId.current = "";
  };

  const placeOrder = async () => {
    if (placing || cart.length === 0) return;
    setPlacing(true);
    if (!clientRequestId.current) clientRequestId.current = (crypto as any)?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    try {
      const res = await publicQrApi.submit(
        slug,
        token,
        cart.map((l) => ({ productId: l.product.productId, quantity: l.quantity, notes: l.notes || undefined, variantId: l.variantId, modifierIds: l.modifierIds })),
        note.trim(),
        clientRequestId.current
      );
      setCart([]);
      setNote("");
      setCartOpen(false);
      clientRequestId.current = "";
      setNotice({ type: res.status === "APPROVED" ? "success" : "info", text: res.message });
      setTab("order");
      await refresh();
    } catch (e: any) {
      setNotice({ type: "error", text: errorMessage(e) });
      clientRequestId.current = ""; // a rejected submit can be retried as a fresh one
      reloadMenu(true); // most likely a dish just ran out -- show the current menu
    } finally {
      setPlacing(false);
    }
  };

  const requestBill = async () => {
    try {
      const r = await publicQrApi.requestBill(slug, token);
      setNotice({ type: "success", text: r.message });
      await refresh();
    } catch (e: any) {
      setNotice({ type: "error", text: errorMessage(e) });
    }
  };

  /* ---- derived menu ---- */
  const categories = useMemo(() => menu.map((m) => m.category), [menu]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu
      .filter((m) => category === "ALL" || m.category === category)
      .map((m) => ({ ...m, items: m.items.filter((i) => !q || i.name.toLowerCase().includes(q)) }))
      .filter((m) => m.items.length > 0);
  }, [menu, category, query]);

  // Customers browse on phones: draw the first dishes, add more while they scroll (hundreds of dishes stay smooth)
  const visibleCount = useMemo(() => visible.reduce((n, c) => n + c.items.length, 0), [visible]);
  const { count: shownCount, sentinel } = useIncrementalList(visibleCount, `${category}|${query}`, 30);
  const shownMenu = useMemo(() => {
    let budget = shownCount;
    const out: typeof visible = [];
    for (const c of visible) {
      if (budget <= 0) break;
      out.push({ ...c, items: c.items.slice(0, budget) });
      budget -= c.items.length;
    }
    return out;
  }, [visible, shownCount]);

  /* ===================== render ===================== */

  if (fatal) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Alert severity="error">{fatal}</Alert>
      </Container>
    );
  }
  if (!landing) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const Header = (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
      {landing.logoUrl ? <Box component="img" src={landing.logoUrl} alt="" sx={{ width: 44, height: 44, objectFit: "contain", borderRadius: 1 }} /> : null}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 900 }} noWrap>
          {landing.restaurantName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Table {landing.tableName}
        </Typography>
      </Box>
      {live && (
        <Chip size="small" color={secsLeft < 300 ? "warning" : "default"} label={`${fmt(secsLeft)} left`} title="Time left to order from this phone" />
      )}
    </Stack>
  );

  /* ---- session ended / never started ---- */
  if (!session || !live) {
    const settled = session?.closeReason === "SETTLED";
    const ended = session && !live;
    return (
      <Container maxWidth="sm" sx={{ py: 3 }}>
        {Header}
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
          {settled ? (
            <>
              <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>Thank you! 🙏</Typography>
              <Typography color="text.secondary">
                Your bill{session?.invoiceNumber ? ` (${session.invoiceNumber})` : ""} has been settled. We hope to see you again.
              </Typography>
            </>
          ) : ended ? (
            <>
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 1 }}>
                {session?.state === "EXPIRED"
                  ? "Your ordering time has ended"
                  : session?.state === "REJECTED"
                  ? "We couldn't confirm this table"
                  : "This table's session has ended"}
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {session?.state === "REJECTED"
                  ? "Please ask a team member to help you."
                  : "Your order (if any) is still with our staff. To order more, start again below or ask a team member."}
              </Typography>
              {!!startError && <Alert severity="error" sx={{ mb: 2 }}>{startError}</Alert>}
              {session?.state !== "REJECTED" && landing.enabled && (
                <Button variant="contained" size="large" onClick={start} disabled={starting}>
                  {starting ? "Starting…" : "Start again"}
                </Button>
              )}
            </>
          ) : !landing.enabled ? (
            <Alert severity="info">Ordering from your phone is switched off right now. Please ask our staff to take your order.</Alert>
          ) : (
            <>
              <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>Order from your phone</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Browse the menu and order straight to the kitchen. Our staff will confirm your first order. You pay at the
                table/counter, we never take payment here.
              </Typography>
              {!!startError && <Alert severity="error" sx={{ mb: 2 }}>{startError}</Alert>}
              <Button variant="contained" size="large" fullWidth onClick={start} disabled={starting}>
                {starting ? "Starting…" : "Start ordering"}
              </Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
                Only start if you're sitting at Table {landing.tableName}.
              </Typography>
            </>
          )}
        </Paper>
      </Container>
    );
  }

  /* ---- live session ---- */
  const pendingReqs = session.requests.filter((r) => r.status === "PENDING");
  const rejectedReqs = session.requests.filter((r) => r.status === "REJECTED");

  return (
    <Container maxWidth="sm" sx={{ py: 2, pb: 12 }}>
      {Header}

      {notice && (
        <Alert severity={notice.type} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      {session.state === "HOLD" && pendingReqs.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Your table is being held for you. Place your first order and our staff will confirm it.
        </Alert>
      )}
      {pendingReqs.length > 0 && (
        <Alert severity="warning" icon={<CircularProgress size={18} />} sx={{ mb: 2 }}>
          Waiting for our staff to confirm your order…
        </Alert>
      )}
      {rejectedReqs.slice(0, 1).map((r) => (
        <Alert severity="error" key={r.requestId} sx={{ mb: 2 }}>
          Our staff couldn't accept your last order{r.rejectReason ? `: ${r.rejectReason}` : ""}. Please ask a team member.
        </Alert>
      ))}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ mb: 2 }}>
        <Tab value="menu" label="Menu" />
        <Tab value="order" label={`My order${session.items.length ? ` (${session.items.length})` : ""}`} />
      </Tabs>

      {tab === "menu" ? (
        <>
          <TextField size="small" fullWidth placeholder="Search dishes" value={query} onChange={(e) => setQuery(e.target.value)} sx={{ mb: 1.5 }} />
          <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 1, mb: 1 }}>
            <Chip label="All" color={category === "ALL" ? "primary" : "default"} onClick={() => setCategory("ALL")} />
            {categories.map((c) => (
              <Chip key={c} label={c} color={category === c ? "primary" : "default"} onClick={() => setCategory(c)} />
            ))}
          </Stack>
          {menu.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
          ) : visible.length === 0 ? (
            <Alert severity="info">No dishes match your search.</Alert>
          ) : (
            <>
            {shownMenu.map((cat) => (
              <Box key={cat.category} sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 900, mb: 0.5 }}>{cat.category}</Typography>
                {cat.items.map((item) => (
                  <Paper key={item.productId} variant="outlined" sx={{ p: 1.5, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>
                        <VegDot veg={item.veg} />
                        {item.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.customisable ? "From " : ""}
                        {rupee(item.price)}
                        {item.combo ? " · Combo" : ""}
                      </Typography>
                    </Box>
                    <Button size="small" variant="outlined" onClick={() => onAdd(item)} disabled={chooserBusy === item.productId} startIcon={<AddIcon />}>
                      {item.customisable || item.combo ? "Choose" : "Add"}
                    </Button>
                  </Paper>
                ))}
              </Box>
            ))}
            {sentinel}
            </>
          )}
        </>
      ) : (
        <Stack spacing={2}>
          {session.items.length === 0 && pendingReqs.length === 0 ? (
            <Alert severity="info">Nothing ordered yet. Pick something from the menu.</Alert>
          ) : null}

          {pendingReqs.map((r) => (
            <Paper key={r.requestId} variant="outlined" sx={{ p: 1.5, borderColor: "warning.main" }}>
              <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Awaiting staff confirmation</Typography>
              {r.lines.map((l, i) => (
                <Typography key={i} variant="body2">
                  {l.quantity} × {l.name}
                  {l.variantName ? ` (${l.variantName})` : ""}
                </Typography>
              ))}
            </Paper>
          ))}

          {session.items.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              {session.items.map((i, idx) => (
                <Stack key={idx} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.5 }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {i.quantity} × {i.name}
                    </Typography>
                    <Typography variant="caption" color={i.status === "SERVED" ? "success.main" : "text.secondary"}>
                      {i.status === "SERVED" ? "Served" : i.status === "SENT_TO_KITCHEN" ? "In the kitchen" : "Waiting"}
                    </Typography>
                  </Box>
                  <Typography variant="body2">{rupee(i.lineTotal)}</Typography>
                </Stack>
              ))}
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontWeight: 900 }}>Total so far (incl. GST)</Typography>
                <Typography sx={{ fontWeight: 900 }}>{rupee(session.total)}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                The final bill is prepared and settled by our staff.
              </Typography>
            </Paper>
          )}

          {session.orderAccepted && (
            <Button variant="contained" color={session.billRequested ? "success" : "primary"} onClick={requestBill} disabled={session.billRequested}>
              {session.billRequested ? "Bill requested – staff are on their way" : "Request bill"}
            </Button>
          )}
        </Stack>
      )}

      {/* floating cart bar */}
      {tab === "menu" && cartCount > 0 && (
        <Box sx={{ position: "fixed", left: 0, right: 0, bottom: 0, p: 1.5, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" }}>
          <Container maxWidth="sm" disableGutters>
            <Button fullWidth variant="contained" size="large" onClick={() => setCartOpen(true)}
              startIcon={<Badge badgeContent={cartCount} color="secondary"><ShoppingCartIcon /></Badge>}>
              View cart · {rupee(cartTotal)}
            </Button>
          </Container>
        </Box>
      )}

      {/* cart dialog */}
      <Dialog open={cartOpen} onClose={() => setCartOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900 }}>Your cart</DialogTitle>
        <DialogContent dividers>
          {cart.map((l) => (
            <Box key={l.key} sx={{ mb: 1.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>{l.product.name}</Typography>
                  {l.label && <Typography variant="caption" color="text.secondary">{l.label}</Typography>}
                </Box>
                <Stack direction="row" alignItems="center">
                  <IconButton size="small" onClick={() => changeQty(l.key, -1)}><RemoveIcon fontSize="small" /></IconButton>
                  <Typography sx={{ minWidth: 20, textAlign: "center", fontWeight: 800 }}>{l.quantity}</Typography>
                  <IconButton size="small" onClick={() => changeQty(l.key, 1)} disabled={l.quantity >= 20}><AddIcon fontSize="small" /></IconButton>
                </Stack>
                <Typography sx={{ minWidth: 72, textAlign: "right" }}>{rupee(l.unitPrice * l.quantity)}</Typography>
              </Stack>
              <TextField size="small" fullWidth placeholder="Note for the kitchen (e.g. less spicy)" value={l.notes} inputProps={{ maxLength: 200 }}
                onChange={(e) => setCart((prev) => prev.map((x) => (x.key === l.key ? { ...x, notes: e.target.value } : x)))} sx={{ mt: 0.5 }} />
            </Box>
          ))}
          <TextField size="small" fullWidth label="Anything else for our staff? (optional)" value={note} inputProps={{ maxLength: 300 }} onChange={(e) => setNote(e.target.value)} sx={{ mt: 1 }} />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Prices shown exclude GST; the total so far on the “My order” tab includes it.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between", px: 2 }}>
          <Typography sx={{ fontWeight: 900 }}>{rupee(cartTotal)}</Typography>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setCartOpen(false)}>Back</Button>
            <Button variant="contained" onClick={placeOrder} disabled={placing || cart.length === 0}>
              {placing ? "Sending…" : "Place order"}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {chooser && (
        <OptionChooser
          item={chooser.item}
          options={chooser.options}
          onCancel={() => setChooser(null)}
          onConfirm={(variantId, modifierIds, label, price) => {
            addToCart(chooser.item, variantId, modifierIds, label, price);
            setChooser(null);
          }}
        />
      )}
    </Container>
  );
}

function OptionChooser({
  item,
  options,
  onCancel,
  onConfirm,
}: {
  item: MenuItem;
  options: ProductOptions;
  onCancel: () => void;
  onConfirm: (variantId: number | null, modifierIds: number[], label: string, unitPrice: number) => void;
}) {
  const [variantId, setVariantId] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);

  const variant = options.variants.find((v) => v.variantId === variantId);
  const base = variant ? variant.price : item.price;
  const allOptions = options.groups.flatMap((g) => g.options);
  const extras = allOptions.filter((o) => picked.includes(o.optionId)).reduce((s, o) => s + o.price, 0);

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
      if (maxSelect > 1 && inGroup >= maxSelect) return prev;
      return [...prev, optionId];
    });
  };

  const label = [variant?.name, ...allOptions.filter((o) => picked.includes(o.optionId)).map((o) => o.name)].filter(Boolean).join(" · ");

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 900 }}>{item.name}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {options.variants.length > 0 && (
            <Box>
              <Typography sx={{ fontWeight: 800 }}>
                Size <span style={{ color: "#c62828", fontSize: 12 }}>(required)</span>
              </Typography>
              {options.variants.map((v) => (
                <FormControlLabel
                  key={v.variantId}
                  sx={{ display: "flex", mr: 0 }}
                  control={<Radio checked={variantId === v.variantId} onChange={() => setVariantId(v.variantId)} />}
                  label={
                    <Stack direction="row" justifyContent="space-between" sx={{ width: "100%", minWidth: 200 }}>
                      <span>{v.name}</span>
                      <b>{rupee(v.price)}</b>
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
                    <Stack direction="row" justifyContent="space-between" sx={{ width: "100%", minWidth: 200 }}>
                      <span>{o.name}</span>
                      {o.price > 0 && <span>+{rupee(o.price)}</span>}
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
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between", px: 2 }}>
        <Typography sx={{ fontWeight: 900 }}>{rupee(base + extras)}</Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="contained" disabled={needsVariant || !!groupProblem} onClick={() => onConfirm(variantId, picked, label, base + extras)}>
            Add
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
