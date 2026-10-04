import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteIcon from "@mui/icons-material/Delete";
import BlockIcon from "@mui/icons-material/Block";
import CancelIcon from "@mui/icons-material/Cancel";
import RoomServiceIcon from "@mui/icons-material/RoomService";
import ReceiptIcon from "@mui/icons-material/Receipt";
import EditNoteIcon from "@mui/icons-material/EditNote";
import PrintIcon from "@mui/icons-material/Print";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";

import type { RestaurantOrder, RestaurantOrderItem } from "./restaurantApi";

const money = (n: number) => `₹${n.toFixed(2)}`;

/**
 * The running order: lines with +/- quantity, notes, kitchen status, totals and the action buttons.
 * Used as the right-hand column on tablets/desktops and inside a bottom sheet on phones.
 */
export default function OrderCartPanel({
  order,
  items,
  kitchenStatus,
  canEdit,
  closed,
  busy,
  onQty,
  onRemove,
  onVoid,
  onNote,
  onSendKot,
  onReprintKot,
  onServe,
  onServeAll,
  onSettle,
  onCancel,
}: {
  order: RestaurantOrder;
  /** the unbilled lines */
  items: RestaurantOrderItem[];
  kitchenStatus: Record<number, string>;
  canEdit: boolean;
  closed: boolean;
  busy?: boolean;
  onQty: (item: RestaurantOrderItem, qty: number) => void;
  onRemove: (item: RestaurantOrderItem) => void;
  onVoid: (item: RestaurantOrderItem) => void;
  onNote: (item: RestaurantOrderItem, note: string) => void;
  onSendKot: () => void;
  onReprintKot?: () => void;
  /** mark one sent line as served (works with or without a kitchen screen) */
  onServe?: (item: RestaurantOrderItem) => void;
  onServeAll?: () => void;
  onSettle: () => void;
  onCancel: () => void;
}) {
  const [noteTarget, setNoteTarget] = useState<RestaurantOrderItem | null>(null);
  const [noteText, setNoteText] = useState("");

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const total = items.reduce((s, i) => s + i.unitPrice * i.quantity * (1 + i.gstPercent / 100), 0);
  const unsent = items.filter((i) => i.status === "PENDING");
  const unsentCount = unsent.reduce((n, i) => n + i.quantity, 0);

  const statusChip = (it: RestaurantOrderItem) => {
    const ks = kitchenStatus[it.orderItemId];
    let label = "Not sent";
    let color: "default" | "info" | "warning" | "success" = "default";
    // Ready is the kitchen's final step -- it wins over any later "served" marking
    if (ks === "READY") { label = "Ready"; color = "success"; }
    else if (it.status === "SERVED" || ks === "SERVED") { label = "Served"; color = "success"; }
    else if (it.status === "SENT_TO_KITCHEN") {
      if (ks === "PREPARING") { label = "Preparing"; color = "warning"; }
      else { label = "Sent to kitchen"; color = "info"; }
    }
    return <Chip size="small" label={label} color={color} sx={{ fontWeight: 700, height: 22 }} />;
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, bgcolor: "background.paper" }}>
      <Box sx={{ px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 900 }}>
          Current order{" "}
          <Typography component="span" variant="body2" color="text.secondary">
            · {items.length} line{items.length === 1 ? "" : "s"}
          </Typography>
        </Typography>
      </Box>

      {/* lines */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2 }}>
        {items.length === 0 ? (
          <Typography color="text.secondary" variant="body2" sx={{ py: 4, textAlign: "center" }}>
            No items yet — tap a dish on the menu to add it.
          </Typography>
        ) : (
          <Stack divider={<Divider />}>
            {items.map((it) => {
              const pending = it.status === "PENDING";
              return (
                <Box key={it.orderItemId} sx={{ py: 1.25 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                        {it.productName}
                        {it.variantName ? ` (${it.variantName})` : ""}
                      </Typography>
                      {it.optionsText && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          + {it.optionsText}
                        </Typography>
                      )}
                      {it.notes && (
                        <Typography variant="caption" color="warning.dark" sx={{ display: "block", fontStyle: "italic" }}>
                          “{it.notes}”
                        </Typography>
                      )}
                    </Box>
                    <Typography sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>{money(it.unitPrice * it.quantity)}</Typography>
                  </Stack>

                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.75 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      {canEdit && pending ? (
                        <Stack
                          direction="row"
                          alignItems="center"
                          sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}
                        >
                          <IconButton size="small" disabled={busy} onClick={() => onQty(it, it.quantity - 1)}>
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                          <Typography sx={{ minWidth: 28, textAlign: "center", fontWeight: 800 }}>{it.quantity}</Typography>
                          <IconButton size="small" disabled={busy} onClick={() => onQty(it, it.quantity + 1)}>
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ) : (
                        <Typography sx={{ fontWeight: 800 }}>× {it.quantity}</Typography>
                      )}
                      {statusChip(it)}
                    </Stack>

                    <Stack direction="row" alignItems="center">
                      {canEdit && onServe && it.status === "SENT_TO_KITCHEN" && (
                        <Button
                          size="small"
                          variant={kitchenStatus[it.orderItemId] === "READY" ? "contained" : "outlined"}
                          color="success"
                          startIcon={<DoneIcon />}
                          disabled={busy}
                          onClick={() => onServe(it)}
                          sx={{ py: 0, minWidth: 0 }}
                        >
                          Served
                        </Button>
                      )}
                      {canEdit && pending && (
                        <IconButton
                          size="small"
                          title="Add / edit note"
                          onClick={() => {
                            setNoteTarget(it);
                            setNoteText(it.notes ?? "");
                          }}
                        >
                          <EditNoteIcon fontSize="small" />
                        </IconButton>
                      )}
                      {canEdit && pending && (
                        <IconButton size="small" title="Remove item" disabled={busy} onClick={() => onRemove(it)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                      {canEdit && !pending && !closed && (
                        <IconButton size="small" color="error" title="Void item (needs manager approval)" onClick={() => onVoid(it)}>
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* totals + actions */}
      <Box sx={{ borderTop: "1px solid", borderColor: "divider", p: 2, flexShrink: 0 }}>
        <Stack spacing={0.25} sx={{ mb: 1.5 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">Subtotal</Typography>
            <Typography variant="body2">{money(subtotal)}</Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">GST</Typography>
            <Typography variant="body2">{money(total - subtotal)}</Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.5 }}>
            <Typography sx={{ fontWeight: 900 }} variant="h6">Total (incl. GST)</Typography>
            <Typography sx={{ fontWeight: 900 }} variant="h6">{money(total)}</Typography>
          </Stack>
        </Stack>

        {canEdit && !closed && (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                size="large"
                startIcon={<RoomServiceIcon />}
                variant="outlined"
                onClick={onSendKot}
                disabled={busy || unsent.length === 0}
              >
                Send to kitchen{unsentCount > 0 ? ` (${unsentCount})` : ""}
              </Button>
              <Button fullWidth size="large" startIcon={<ReceiptIcon />} variant="contained" onClick={onSettle} disabled={busy || items.length === 0}>
                Settle bill
              </Button>
            </Stack>
            {onServeAll && items.some((i) => i.status === "SENT_TO_KITCHEN") && (
              <Button color="success" variant="outlined" startIcon={<DoneAllIcon />} onClick={onServeAll} disabled={busy}>
                Mark all served
              </Button>
            )}
            <Stack direction="row" justifyContent="space-between">
              <Button color="error" size="small" startIcon={<CancelIcon />} onClick={onCancel}>
                Cancel order
              </Button>
              {onReprintKot && items.some((i) => i.status !== "PENDING") && (
                <Button size="small" startIcon={<PrintIcon />} onClick={onReprintKot}>
                  Reprint KOT
                </Button>
              )}
            </Stack>
          </Stack>
        )}
      </Box>

      {/* note editor */}
      <Dialog open={!!noteTarget} onClose={() => setNoteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Note for {noteTarget?.productName}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="e.g. no onion, less spicy"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && noteTarget) {
                onNote(noteTarget, noteText.trim());
                setNoteTarget(null);
              }
            }}
          />
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {["No onion", "Less spicy", "Extra spicy", "No garlic", "Less oil", "Jain"].map((q) => (
              <Chip key={q} size="small" label={q} onClick={() => setNoteText((t) => (t ? `${t}, ${q.toLowerCase()}` : q))} />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (noteTarget) onNote(noteTarget, noteText.trim());
              setNoteTarget(null);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
