// // src/pages/InvoicesPage.tsx
// import React, { useEffect, useMemo, useRef, useState } from "react";
// import {
//   Alert,
//   Box,
//   Button,
//   Chip,
//   CircularProgress,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   Divider,
//   IconButton,
//   Paper,
//   Stack,
//   TextField,
//   Typography,
//   MenuItem,
//   Snackbar,
// } from "@mui/material";
// import DeleteIcon from "@mui/icons-material/Delete";
// import EditIcon from "@mui/icons-material/Edit";
// import CloseIcon from "@mui/icons-material/Close";

// import type { InvoiceDetailDTO } from "../components/billing/invoiceApi";
// import Receipt80mm from "../components/billing/Receipt80mm";
// import axiosClient from "../components/axiosData/axiosClient";

// /* ✅ redux shop settings (same as PosPage) */
// import { useDispatch, useSelector } from "react-redux";
// import type { AppDispatch } from "../store/store";
// import { fetchCurrentSetting, selectCompanySetting } from "../store/settingsSlice";

// /* ---------------- helpers ---------------- */
// const pickData = (res: any) => res?.data?.data ?? res?.data;

// const money = (n: any) => Number(n || 0).toFixed(2);
// const pad2 = (n: number) => String(n).padStart(2, "0");

// // ✅ local date (NOT UTC)
// const yyyyMmDdLocal = (d: Date) => {
//   const y = d.getFullYear();
//   const m = pad2(d.getMonth() + 1);
//   const day = pad2(d.getDate());
//   return `${y}-${m}-${day}`;
// };

// type InvoiceRow = {
//   invoiceId: number;
//   invoiceNumber: string;
//   invoiceDate: string; // yyyy-MM-dd
//   netTotal: number;
//   payMethod: string;
//   payStatus: string;
//   customerName?: string | null;
//   customerPhone?: string | null;
// };

// /* =========================
//    EDIT TYPES (frontend)
// ========================= */
// type EditItem = {
//   productId: number;
//   productName?: string;
//   unitPrice?: number;
//   gstPercent?: number;
//   quantity: number;
// };

// type EditForm = {
//   payMethod: string;
//   payStatus: string;
//   discountValue: number;

//   customerId?: number | null;
//   customerName?: string | null;
//   customerPhone?: string | null;
//   customerEmail?: string | null;
//   customerAddress?: string | null;

//   items: EditItem[];
// };

// type Toast = { open: boolean; msg: string; type: "success" | "error" | "info" };

// export default function InvoicesPage() {
//   /* ✅ LOAD SHOP SETTINGS (same as PosPage) */
//   const dispatch = useDispatch<AppDispatch>();
//   const setting = useSelector(selectCompanySetting);

//   useEffect(() => {
//     dispatch(fetchCurrentSetting());
//   }, [dispatch]);

//   const SHOP = useMemo(() => {
//     const address = [setting?.address || "", setting?.city || ""].filter(Boolean).join(", ");
//     return {
//       name: setting?.companyName || "My Shop",
//       phone: setting?.phoneNumber || "9999999999",
//       address: address || "Main Road, City",
//       gst: setting?.gstNumber || "",
//       email: setting?.email || "",
//     };
//   }, [setting]);

//   // ✅ DEFAULT last 15 days (LOCAL)
//   const [from, setFrom] = useState(() => {
//     const d = new Date();
//     d.setDate(d.getDate() - 15);
//     return yyyyMmDdLocal(d);
//   });
//   const [to, setTo] = useState(() => yyyyMmDdLocal(new Date()));

//   const [rows, setRows] = useState<InvoiceRow[]>([]);
//   const [loading, setLoading] = useState(false);

//   // ✅ FILTER: show only pending / paid / canceled / all
//   // If you want DEFAULT only pending, set "PENDING" here
//   const [statusFilter, setStatusFilter] = useState<string>("ALL");

//   const filteredRows = useMemo(() => {
//     if (statusFilter === "ALL") return rows;
//     return rows.filter((r) => String(r.payStatus || "").toUpperCase() === statusFilter);
//   }, [rows, statusFilter]);

//   /* ============ VIEW/PRINT MODAL ============ */
//   const [detail, setDetail] = useState<InvoiceDetailDTO | null>(null);
//   const [open, setOpen] = useState(false);
//   const [openLoading, setOpenLoading] = useState(false);
//   const receiptWrapRef = useRef<HTMLDivElement | null>(null);

//   /* ============ DELETE ============ */
//   const [deletingId, setDeletingId] = useState<number | null>(null);

//   // ✅ confirm dialog for permanent delete
//   const [confirmOpen, setConfirmOpen] = useState(false);
//   const [confirmId, setConfirmId] = useState<number | null>(null);
//   const [confirmText, setConfirmText] = useState<string>("");

//   /* ============ EDIT ============ */
//   const [editOpen, setEditOpen] = useState(false);
//   const [editLoading, setEditLoading] = useState(false);
//   const [editSaving, setEditSaving] = useState(false);
//   const [editInvoiceId, setEditInvoiceId] = useState<number | null>(null);
//   const [editInvoiceNumber, setEditInvoiceNumber] = useState<string>("");

//   const [form, setForm] = useState<EditForm>({
//     payMethod: "CASH",
//     payStatus: "PAID",
//     discountValue: 0,
//     customerId: null,
//     customerName: "",
//     customerPhone: "",
//     customerEmail: "",
//     customerAddress: "",
//     items: [],
//   });

//   /* ============ SNACKBAR ============ */
//   const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "info" });
//   const showToast = (type: Toast["type"], msg: string) => setToast({ open: true, type, msg });

//   const load = async () => {
//     setLoading(true);
//     try {
//       const res = await axiosClient.get(`/sales-invoice/list`, {
//         params: { fromDate: from, toDate: to },
//       });
//       const list = pickData(res);
//       setRows(Array.isArray(list) ? (list as InvoiceRow[]) : []);
//     } catch (e: any) {
//       showToast("error", e?.response?.data?.message || e?.message || "Load failed");
//       setRows([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     load();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   /* =========================
//       VIEW / PRINT
//   ========================= */
//   const openInvoice = async (invoiceId: number) => {
//     setOpen(true);
//     setOpenLoading(true);
//     setDetail(null);

//     try {
//       const res = await axiosClient.get(`/sales-invoice/invoice/${invoiceId}`);
//       setDetail(pickData(res) as InvoiceDetailDTO);
//     } catch (e: any) {
//       showToast("error", e?.response?.data?.message || e?.message || "Failed to fetch invoice");
//       setOpen(false);
//     } finally {
//       setOpenLoading(false);
//     }
//   };

//   const browserPrint = () => setTimeout(() => window.print(), 100);

//   /* =========================
//       DELETE (PERMANENT)
//   ========================= */
//   const askDelete = (invoiceId: number, invoiceNumber?: string) => {
//     setConfirmId(invoiceId);
//     setConfirmText(invoiceNumber ? `Delete ${invoiceNumber} permanently?` : "Delete invoice permanently?");
//     setConfirmOpen(true);
//   };

//   const doDelete = async () => {
//     if (!confirmId) return;
//     const invoiceId = confirmId;

//     setConfirmOpen(false);
//     setDeletingId(invoiceId);

//     try {
//       await axiosClient.delete(`/sales-invoice/delete/${invoiceId}`);
//       showToast("success", "Invoice deleted");
//       await load(0);
//     } catch (e: any) {
//       showToast("error", e?.response?.data?.message || e?.message || "Delete failed");
//     } finally {
//       setDeletingId(null);
//       setConfirmId(null);
//       setConfirmText("");
//     }
//   };

//   /* =========================
//       EDIT: OPEN + LOAD DETAIL
//   ========================= */
//   const openEdit = async (invoiceId: number) => {
//     setEditOpen(true);
//     setEditLoading(true);
//     setEditSaving(false);
//     setEditInvoiceId(invoiceId);
//     setEditInvoiceNumber("");

//     try {
//       const res = await axiosClient.get(`/sales-invoice/invoice/${invoiceId}`);
//       const d = pickData(res) as any;

//       setEditInvoiceNumber(d?.invoiceNumber || "");

//       setForm({
//         payMethod: String(d?.payMethod || "CASH"),
//         payStatus: String(d?.payStatus || "PAID"),
//         discountValue: Number(d?.discountValue || 0),

//         customerId: d?.customerId ?? null,
//         customerName: d?.customerName ?? "",
//         customerPhone: d?.customerPhone ?? "",
//         customerEmail: d?.customerEmail ?? "",
//         customerAddress: d?.customerAddress ?? "",

//         items: Array.isArray(d?.items)
//           ? d.items.map((it: any) => ({
//               productId: Number(it.productId),
//               productName: it.productName,
//               unitPrice: Number(it.unitPrice ?? 0),
//               gstPercent: Number(it.gstPercent ?? 0),
//               quantity: Number(it.quantity ?? 1),
//             }))
//           : [],
//       });
//     } catch (e: any) {
//       showToast("error", e?.response?.data?.message || e?.message || "Failed to load invoice for edit");
//       setEditOpen(false);
//     } finally {
//       setEditLoading(false);
//     }
//   };

//   /* =========================
//       EDIT: UPDATE INVOICE
//   ========================= */
//   const updateInvoice = async () => {
//     if (!editInvoiceId) return;

//     if (!form.items || form.items.length === 0) return showToast("error", "At least 1 item required");
//     for (const it of form.items) {
//       if (!Number.isFinite(it.productId) || it.productId <= 0) return showToast("error", "Invalid productId in items");
//       if (!Number.isFinite(it.quantity) || it.quantity <= 0) return showToast("error", "Quantity must be > 0");
//     }

//     setEditSaving(true);
//     try {
//       const payload = {
//         payMethod: form.payMethod,
//         payStatus: form.payStatus,
//         discountValue: Number(form.discountValue || 0),

//         customerId: form.customerId ?? null,
//         customerName: form.customerName ?? null,
//         customerPhone: form.customerPhone ?? null,
//         customerEmail: form.customerEmail ?? null,
//         customerAddress: form.customerAddress ?? null,

//         items: form.items.map((x) => ({
//           productId: Number(x.productId),
//           quantity: Number(x.quantity),
//         })),
//       };

//       await axiosClient.put(`/sales-invoice/update/${editInvoiceId}`, payload);

//       showToast("success", "Invoice updated");
//       setEditOpen(false);
//       await load(0);
//     } catch (e: any) {
//       showToast("error", e?.response?.data?.message || e?.message || "Update failed");
//     } finally {
//       setEditSaving(false);
//     }
//   };

//   /* =========================
//       EDIT: ITEM HELPERS
//   ========================= */
//   const updateItemQty = (idx: number, qty: number) => {
//     setForm((p) => {
//       const items = [...p.items];
//       items[idx] = { ...items[idx], quantity: qty };
//       return { ...p, items };
//     });
//   };

//   const removeItemAt = (idx: number) => {
//     setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
//   };

//   const addBlankItem = () => {
//     setForm((p) => ({
//       ...p,
//       items: [...p.items, { productId: 0, quantity: 1 }],
//     }));
//   };

//   const updateItemProductId = (idx: number, productId: number) => {
//     setForm((p) => {
//       const items = [...p.items];
//       items[idx] = { ...items[idx], productId };
//       return { ...p, items };
//     });
//   };

//   /* =========================
//       TOTAL (based on filter)
//   ========================= */
//   const total = useMemo(
//     () => filteredRows.reduce((s, r) => s + (Number(r.netTotal) || 0), 0),
//     [filteredRows]
//   );

//   return (
//     <Box sx={{ p: 2 }}>
//       <Paper sx={{ p: 2, borderRadius: 3 }}>
//         <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
//           <Box>
//             <Typography variant="h6" sx={{ fontWeight: 900 }}>
//               Invoices
//             </Typography>
//             <Typography variant="body2" color="text.secondary">
//               Default last 15 days • View + Reprint • Edit 
//             </Typography>
//           </Box>

//           <Chip
//             label={loading ? "Loading..." : `Count: ${filteredRows.length}`}
//             size="small"
//             sx={{ fontWeight: 900 }}
//           />
//         </Stack>

//         <Divider sx={{ my: 2 }} />

//         {/* filters row */}
//         <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems={{ xs: "stretch", sm: "center" }}>
//           <TextField
//             type="date"
//             label="From"
//             value={from}
//             onChange={(e) => setFrom(e.target.value)}
//             InputLabelProps={{ shrink: true }}
//             size="small"
//           />
//           <TextField
//             type="date"
//             label="To"
//             value={to}
//             onChange={(e) => setTo(e.target.value)}
//             InputLabelProps={{ shrink: true }}
//             size="small"
//           />

//           {/* ✅ status filter dropdown */}
//           <TextField
//             select
//             label="Status"
//             size="small"
//             value={statusFilter}
//             onChange={(e) => setStatusFilter(e.target.value)}
//             sx={{ minWidth: 180 }}
//           >
//             <MenuItem value="ALL">ALL</MenuItem>
//             <MenuItem value="PENDING">PENDING</MenuItem>
//             <MenuItem value="PAID">PAID</MenuItem>
//             <MenuItem value="CANCELED">CANCELED</MenuItem>
//           </TextField>

//           <Button
//             variant="contained"
//             onClick={load}
//             disabled={loading}
//             sx={{ borderRadius: 2, fontWeight: 900, minWidth: 120 }}
//             startIcon={loading ? <CircularProgress size={18} /> : undefined}
//           >
//             Apply
//           </Button>

//           <Box sx={{ flex: 1 }} />

//           <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: "left", sm: "right" } }}>
//             Total: <b>₹{money(total)}</b>
//           </Typography>
//         </Stack>

//         <Divider sx={{ my: 2 }} />

//         {/* list */}
//         {filteredRows.length === 0 ? (
//           <Typography color="text.secondary">{loading ? "Loading..." : "No invoices found"}</Typography>
//         ) : (
//           <Stack spacing={1}>
//             {filteredRows.map((r) => (
//               <Paper key={r.invoiceId} variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
//                 <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
//                   <Box sx={{ minWidth: 0 }}>
//                     <Typography sx={{ fontWeight: 900 }} noWrap>
//                       {r.invoiceNumber} — ₹{money(r.netTotal)}
//                     </Typography>

//                     <Typography variant="caption" color="text.secondary">
//                       Date: {r.invoiceDate} • {r.payMethod} / {r.payStatus}
//                     </Typography>

//                     {(r.customerName || r.customerPhone) && (
//                       <Typography variant="caption" color="text.secondary" display="block">
//                         Customer: <b>{r.customerName || "NA"}</b>
//                         {r.customerPhone ? ` • ${r.customerPhone}` : ""}
//                       </Typography>
//                     )}
//                   </Box>

//                   <Stack
//                     direction="row"
//                     spacing={1}
//                     alignItems="center"
//                     sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}
//                   >
//                     <Button variant="outlined" onClick={() => openInvoice(r.invoiceId)} sx={{ whiteSpace: "nowrap" }}>
//                       View / Print
//                     </Button>

//                     <Button
//                       variant="contained"
//                       startIcon={<EditIcon />}
//                       onClick={() => openEdit(r.invoiceId)}
//                       sx={{ whiteSpace: "nowrap", borderRadius: 999 }}
//                     >
//                       Edit
//                     </Button>
//                   </Stack>
//                 </Stack>
//               </Paper>
//             ))}
//           </Stack>
//         )}
//       </Paper>

//       {/* ===================== VIEW/PRINT MODAL ===================== */}
//       <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
//         <DialogTitle sx={{ fontWeight: 900 }}>Invoice Receipt</DialogTitle>

//         <DialogContent dividers>
//           <Box ref={receiptWrapRef}>
//             {openLoading ? (
//               <Stack alignItems="center" sx={{ py: 6 }}>
//                 <CircularProgress />
//                 <Typography sx={{ mt: 2 }} color="text.secondary">
//                   Loading invoice...
//                 </Typography>
//               </Stack>
//             ) : detail ? (
//               <Receipt80mm shop={SHOP as any} invoice={detail} />
//             ) : (
//               <Typography color="text.secondary">No invoice loaded.</Typography>
//             )}
//           </Box>
//         </DialogContent>

//         <DialogActions sx={{ p: 2 }}>
//           <Button
//             variant="contained"
//             onClick={() => setTimeout(() => window.print(), 100)}
//             sx={{ borderRadius: 999, fontWeight: 900 }}
//             disabled={!detail}
//           >
//             Print (Browser)
//           </Button>
//           <Button onClick={() => setOpen(false)}>Close</Button>
//         </DialogActions>
//       </Dialog>

//       {/* ===================== EDIT MODAL ===================== */}
//       <Dialog open={editOpen} onClose={() => (editSaving ? null : setEditOpen(false))} fullWidth maxWidth="md">
//         <DialogTitle sx={{ fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//           Edit Invoice {editInvoiceNumber ? `• ${editInvoiceNumber}` : ""}
//           <IconButton onClick={() => setEditOpen(false)} disabled={editSaving}>
//             <CloseIcon />
//           </IconButton>
//         </DialogTitle>

//         <DialogContent dividers>
//           {editLoading ? (
//             <Stack alignItems="center" sx={{ py: 6 }}>
//               <CircularProgress />
//               <Typography sx={{ mt: 2 }} color="text.secondary">
//                 Loading invoice for edit...
//               </Typography>
//             </Stack>
//           ) : (
//             <Stack spacing={2}>
//               <Alert severity="info" sx={{ borderRadius: 2 }}>
//                 Edit me items/pay/discount/customer snapshot update hoga. Customer record delete nahi hoga.
//               </Alert>

//               {/* pay + discount */}
//               <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
//                 <TextField
//                   select
//                   label="Pay Method"
//                   size="small"
//                   value={form.payMethod}
//                   onChange={(e) => setForm((p) => ({ ...p, payMethod: e.target.value }))}
//                   fullWidth
//                 >
//                   <MenuItem value="CASH">CASH</MenuItem>
//                   <MenuItem value="CARD">CARD</MenuItem>
//                   <MenuItem value="UPI">UPI</MenuItem>
//                 </TextField>

//                 <TextField
//                   select
//                   label="Pay Status"
//                   size="small"
//                   value={form.payStatus}
//                   onChange={(e) => setForm((p) => ({ ...p, payStatus: e.target.value }))}
//                   fullWidth
//                 >
//                   <MenuItem value="PAID">PAID</MenuItem>
//                   <MenuItem value="PENDING">PENDING</MenuItem>
//                   <MenuItem value="CANCELED">CANCELED</MenuItem>
//                 </TextField>

//                 <TextField
//                   label="Discount"
//                   size="small"
//                   value={form.discountValue}
//                   onChange={(e) => setForm((p) => ({ ...p, discountValue: Number(e.target.value || 0) }))}
//                   fullWidth
//                   inputProps={{ inputMode: "numeric" }}
//                 />
//               </Stack>

//               {/* customer snapshot */}
//               <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
//                 <Typography sx={{ fontWeight: 900, mb: 1 }}>Customer Snapshot (optional)</Typography>

//                 <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
//                   <TextField
//                     label="Customer Name"
//                     size="small"
//                     value={form.customerName ?? ""}
//                     onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
//                     fullWidth
//                   />
//                   <TextField
//                     label="Phone"
//                     size="small"
//                     value={form.customerPhone ?? ""}
//                     onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))}
//                     fullWidth
//                   />
//                 </Stack>

//                 <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ mt: 1.2 }}>
//                   <TextField
//                     label="Email"
//                     size="small"
//                     value={form.customerEmail ?? ""}
//                     onChange={(e) => setForm((p) => ({ ...p, customerEmail: e.target.value }))}
//                     fullWidth
//                   />
//                   <TextField
//                     label="Address"
//                     size="small"
//                     value={form.customerAddress ?? ""}
//                     onChange={(e) => setForm((p) => ({ ...p, customerAddress: e.target.value }))}
//                     fullWidth
//                   />
//                 </Stack>
//               </Paper>

//               {/* items editor */}
//               <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
//                 <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
//                   <Typography sx={{ fontWeight: 900 }}>Items</Typography>
//                   <Button variant="outlined" size="small" onClick={addBlankItem} sx={{ borderRadius: 999 }}>
//                     + Add Item
//                   </Button>
//                 </Stack>

//                 {form.items.length === 0 ? (
//                   <Typography color="text.secondary">No items</Typography>
//                 ) : (
//                   <Stack spacing={1}>
//                     {form.items.map((it, idx) => (
//                       <Paper key={idx} variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
//                         <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems="center">
//                           <TextField
//                             label="Product ID"
//                             size="small"
//                             value={it.productId}
//                             onChange={(e) => updateItemProductId(idx, Number(e.target.value || 0))}
//                             inputProps={{ inputMode: "numeric" }}
//                             sx={{ width: { xs: "100%", sm: 180 } }}
//                           />
//                           <TextField
//                             label="Qty"
//                             size="small"
//                             value={it.quantity}
//                             onChange={(e) => updateItemQty(idx, Number(e.target.value || 1))}
//                             inputProps={{ inputMode: "numeric", min: 1 }}
//                             sx={{ width: { xs: "100%", sm: 120 } }}
//                           />

//                           <Box sx={{ flex: 1, width: "100%" }}>
//                             <Typography sx={{ fontWeight: 800 }} noWrap>
//                               {it.productName || "Product snapshot will come from backend"}
//                             </Typography>
//                             <Typography variant="caption" color="text.secondary">
//                               Price: ₹{money(it.unitPrice)} • GST: {Number(it.gstPercent || 0)}%
//                             </Typography>
//                           </Box>

//                           <Button
//                             color="error"
//                             variant="outlined"
//                             onClick={() => removeItemAt(idx)}
//                             sx={{ borderRadius: 999 }}
//                           >
//                             Remove
//                           </Button>
//                         </Stack>
//                       </Paper>
//                     ))}
//                   </Stack>
//                 )}
//               </Paper>

//               <Alert severity="warning" sx={{ borderRadius: 2 }}>
//                 New items me productId correct do. Product not found / stock issue aaya to update fail hoga.
//               </Alert>
//             </Stack>
//           )}
//         </DialogContent>

//         <DialogActions sx={{ p: 2 }}>
//           <Button onClick={() => setEditOpen(false)} disabled={editSaving}>
//             Cancel
//           </Button>
//           <Button
//             variant="contained"
//             onClick={updateInvoice}
//             disabled={editLoading || editSaving}
//             startIcon={editSaving ? <CircularProgress size={18} /> : <EditIcon />}
//             sx={{ borderRadius: 999, fontWeight: 900 }}
//           >
//             Update
//           </Button>
//         </DialogActions>
//       </Dialog>

//       {/* ===================== CONFIRM DELETE DIALOG ===================== */}
//       <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
//         <DialogTitle sx={{ fontWeight: 900 }}>Confirm Delete</DialogTitle>
//         <DialogContent dividers>
//           <Alert severity="error" sx={{ borderRadius: 2 }}>
//             {confirmText || "Delete invoice permanently?"}
//             <br />
//             <b>This cannot be undone.</b>
//           </Alert>
//         </DialogContent>
//         <DialogActions sx={{ p: 2 }}>
//           <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
//           <Button
//             variant="contained"
//             color="error"
//             onClick={doDelete}
//             startIcon={<DeleteIcon />}
//             sx={{ borderRadius: 999, fontWeight: 900 }}
//           >
//             Delete
//           </Button>
//         </DialogActions>
//       </Dialog>

//       {/* ===================== SNACKBAR ===================== */}
//       <Snackbar
//         open={toast.open}
//         autoHideDuration={2500}
//         onClose={() => setToast((p) => ({ ...p, open: false }))}
//         anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
//       >
//         <Alert
//           severity={toast.type}
//           variant="filled"
//           onClose={() => setToast((p) => ({ ...p, open: false }))}
//           sx={{ width: "100%", borderRadius: 2 }}
//         >
//           {toast.msg}
//         </Alert>
//       </Snackbar>

//       {/* ✅ Print CSS (prints only #receipt-print-area) */}
//       <style>
//         {`
//           @media print {
//             @page { margin: 0; }
//             html, body {
//               margin: 0 !important;
//               padding: 0 !important;
//               width: 80mm !important;
//               height: auto !important;
//               overflow: visible !important;
//             }
//             body * { visibility: hidden !important; }
//             #receipt-print-area, #receipt-print-area * { visibility: visible !important; }
//             #receipt-print-area {
//               position: static !important;
//               width: 80mm !important;
//               margin: 0 auto !important;
//               padding: 0 !important;
//               page-break-inside: avoid !important;
//               break-inside: avoid !important;
//               overflow: visible !important;
//             }
//           }
//         `}
//       </style>
//     </Box>
//   );
// }




// src/pages/InvoicesPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
  Paper,
  Stack,
  TextField,
  Typography,
  MenuItem,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

import type { InvoiceDetailDTO } from "../components/billing/invoiceApi";
import Receipt80mm from "../components/billing/Receipt80mm";
import axiosClient from "../components/axiosData/axiosClient";
import { downloadAuthenticatedFile, printPdfBlob } from "../utils/downloadFile";

/* ✅ redux shop settings (same as PosPage) */
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../store/store";
import { fetchCurrentSetting, selectCompanySetting } from "../store/settingsSlice";

/* ---------------- helpers ---------------- */
const pickData = (res: any) => res?.data?.data ?? res?.data;

const money = (n: any) => Number(n || 0).toFixed(2);
const pad2 = (n: number) => String(n).padStart(2, "0");

// ✅ local date (NOT UTC)
const yyyyMmDdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
};

// ✅ pretty datetime (works for "2026-01-22T23:10:12" etc.)
const fmtDateTime = (s?: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleString();
};

type InvoiceRow = {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string; // yyyy-MM-dd
  netTotal: number;
  payMethod: string;
  payStatus: string;
  customerName?: string | null;
  customerPhone?: string | null;

  // ✅ if you later add in list api (optional)
  updatedBy?: string | null;
  updatedAt?: string | null;
};

/* =========================
   EDIT TYPES (frontend)
========================= */
type EditItem = {
  productId: number;
  productName?: string;
  unitPrice?: number;
  gstPercent?: number;
  quantity: number;
};

type EditForm = {
  payMethod: string;
  payStatus: string;
  discountValue: number;

  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;

  items: EditItem[];
};

type Toast = { open: boolean; msg: string; type: "success" | "error" | "info" };

export default function InvoicesPage() {
  /* ✅ LOAD SHOP SETTINGS (same as PosPage) */
  const dispatch = useDispatch<AppDispatch>();
  const setting = useSelector(selectCompanySetting);

  useEffect(() => {
    dispatch(fetchCurrentSetting());
  }, [dispatch]);

  const SHOP = useMemo(() => {
    const address = [setting?.address || "", setting?.city || ""].filter(Boolean).join(", ");
    return {
      name: setting?.companyName || "My Shop",
      phone: setting?.phoneNumber || "9999999999",
      address: address || "Main Road, City",
      gst: setting?.gstNumber || "",
      email: setting?.email || "",
    };
  }, [setting]);

  // ✅ DEFAULT last 15 days (LOCAL)
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return yyyyMmDdLocal(d);
  });
  const [to, setTo] = useState(() => yyyyMmDdLocal(new Date()));

  // ✅ Server-side pagination state. `rows` only ever holds the page(s) fetched
  // so far -- the old version called /sales-invoice/list, which returns EVERY
  // invoice in the date range in one shot and then filtered status/payMethod
  // on the client. That's what made this page slow once a shop had a long
  // history: a 6-month date range downloaded and rendered every single
  // invoice at once. /sales-invoice/search (already used by the CSV export)
  // does the date/status/method/search filtering AND paging in the DB query.
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false); // first page of a fresh query
  const [loadingMore, setLoadingMore] = useState(false); // "Load more" click
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  // ✅ grand total across ALL matching invoices (every page), from the
  // backend's aggregate -- NOT just whatever happens to be loaded client-side.
  const [totalNetAmount, setTotalNetAmount] = useState(0);
  const INVOICES_PAGE_SIZE = 25;

  // ✅ FILTER: show only pending / paid / canceled / all
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  // ✅ FILTER: show by payment method (All / Cash / UPI / Card)
  const [payMethodFilter, setPayMethodFilter] = useState<string>("ALL");

  // Both filters are now sent to the backend (search's payStatus/payMethod
  // params), so `rows` is already the filtered set -- no client-side pass needed.
  const filteredRows = rows;

  /* ============ VIEW/PRINT MODAL ============ */
  const [detail, setDetail] = useState<InvoiceDetailDTO | null>(null);
  const [open, setOpen] = useState(false);
  const [openInvoiceId, setOpenInvoiceId] = useState<number | null>(null);
  const [viewPrintFormat, setViewPrintFormat] = useState<"THERMAL" | "A4">("THERMAL");
  const [printingA4, setPrintingA4] = useState(false);
  const [openLoading, setOpenLoading] = useState(false);
  const receiptWrapRef = useRef<HTMLDivElement | null>(null);

  /* ============ DELETE ============ */
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ✅ confirm dialog for permanent delete
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState<string>("");

  /* ============ EDIT ============ */
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState<number | null>(null);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState<string>("");

  const [form, setForm] = useState<EditForm>({
    payMethod: "CASH",
    payStatus: "PAID",
    discountValue: 0,
    customerId: null,
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerAddress: "",
    items: [],
  });

  /* ============ SNACKBAR ============ */
  const [toast, setToast] = useState<Toast>({ open: false, msg: "", type: "info" });
  const showToast = (type: Toast["type"], msg: string) => setToast({ open: true, type, msg });

  const load = async (pageToLoad: number) => {
    const isFirst = pageToLoad === 0;
    if (isFirst) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await axiosClient.get(`/sales-invoice/search`, {
        params: {
          page: pageToLoad,
          size: INVOICES_PAGE_SIZE,
          fromDate: from,
          toDate: to,
          payStatus: statusFilter !== "ALL" ? statusFilter : undefined,
          payMethod: payMethodFilter !== "ALL" ? payMethodFilter : undefined,
          sort: "invoiceDate,desc",
        },
      });
      const data = pickData(res) ?? {};
      const list = Array.isArray(data.content) ? (data.content as InvoiceRow[]) : [];
      setRows((prev) => (isFirst ? list : [...prev, ...list]));
      setTotalElements(Number(data.totalElements ?? 0));
      setTotalNetAmount(Number(data.totalNetAmount ?? 0));
      setPage(Number(data.page ?? pageToLoad));
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Load failed");
      if (isFirst) {
        setRows([]);
        setTotalElements(0);
        setTotalNetAmount(0);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => load(page + 1);

  // Re-query from page 0 whenever a filter changes (date range via "Apply",
  // or the status/payment dropdowns), rather than filtering already-loaded rows.
  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, payMethodFilter]);

  /* =========================
      VIEW / PRINT
  ========================= */
  const openInvoice = async (invoiceId: number) => {
    setOpen(true);
    setOpenLoading(true);
    setDetail(null);
    setOpenInvoiceId(invoiceId);
    setViewPrintFormat("THERMAL");

    try {
      const res = await axiosClient.get(`/sales-invoice/invoice/${invoiceId}`);
      setDetail(pickData(res) as InvoiceDetailDTO);
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to fetch invoice");
      setOpen(false);
    } finally {
      setOpenLoading(false);
    }
  };

  const printA4View = async () => {
    if (!openInvoiceId) return showToast("error", "No invoice loaded");
    setPrintingA4(true);
    try {
      const res = await axiosClient.get(`/sales-invoice/${openInvoiceId}/pdf`, { responseType: "blob" });
      printPdfBlob(res.data as Blob);
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to load A4 invoice");
    } finally {
      setPrintingA4(false);
    }
  };

  /* =========================
      DELETE (PERMANENT)
  ========================= */
  const askDelete = (invoiceId: number, invoiceNumber?: string) => {
    setConfirmId(invoiceId);
    setConfirmText(invoiceNumber ? `Void ${invoiceNumber}? The record is kept and it stops counting in sales.` : "Void this invoice?");
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    if (!confirmId) return;
    const invoiceId = confirmId;

    setConfirmOpen(false);
    setDeletingId(invoiceId);

    try {
      const reason = (window.prompt("Reason for voiding this invoice (required):") || "").trim();
      if (!reason) { showToast("error", "A reason is required to void an invoice"); return; }
      await axiosClient.delete(`/sales-invoice/delete/${invoiceId}`, { params: { reason } });
      showToast("success", "Invoice voided (record kept)");
      await load(0);
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Delete failed");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
      setConfirmText("");
    }
  };

  /* =========================
      EDIT: OPEN + LOAD DETAIL
  ========================= */
  const openEdit = async (invoiceId: number) => {
    setEditOpen(true);
    setEditLoading(true);
    setEditSaving(false);
    setEditInvoiceId(invoiceId);
    setEditInvoiceNumber("");

    try {
      const res = await axiosClient.get(`/sales-invoice/invoice/${invoiceId}`);
      const d = pickData(res) as any;

      setEditInvoiceNumber(d?.invoiceNumber || "");

      setForm({
        payMethod: String(d?.payMethod || "CASH"),
        payStatus: String(d?.payStatus || "PAID"),
        discountValue: Number(d?.discountValue || 0),

        customerId: d?.customerId ?? null,
        customerName: d?.customerName ?? "",
        customerPhone: d?.customerPhone ?? "",
        customerEmail: d?.customerEmail ?? "",
        customerAddress: d?.customerAddress ?? "",

        items: Array.isArray(d?.items)
          ? d.items.map((it: any) => ({
              productId: Number(it.productId),
              productName: it.productName,
              unitPrice: Number(it.unitPrice ?? 0),
              gstPercent: Number(it.gstPercent ?? 0),
              quantity: Number(it.quantity ?? 1),
            }))
          : [],
      });
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Failed to load invoice for edit");
      setEditOpen(false);
    } finally {
      setEditLoading(false);
    }
  };

  /* =========================
      EDIT: UPDATE INVOICE
  ========================= */
  const updateInvoice = async () => {
    if (!editInvoiceId) return;

    if (!form.items || form.items.length === 0) return showToast("error", "At least 1 item required");
    for (const it of form.items) {
      if (!Number.isFinite(it.productId) || it.productId <= 0) return showToast("error", "Invalid productId in items");
      if (!Number.isFinite(it.quantity) || it.quantity <= 0) return showToast("error", "Quantity must be > 0");
    }

    setEditSaving(true);
    try {
      const payload = {
        payMethod: form.payMethod,
        payStatus: form.payStatus,
        discountValue: Number(form.discountValue || 0),

        customerId: form.customerId ?? null,
        customerName: form.customerName ?? null,
        customerPhone: form.customerPhone ?? null,
        customerEmail: form.customerEmail ?? null,
        customerAddress: form.customerAddress ?? null,

        items: form.items.map((x) => ({
          productId: Number(x.productId),
          quantity: Number(x.quantity),
        })),
      };

      await axiosClient.put(`/sales-invoice/update/${editInvoiceId}`, payload);

      showToast("success", "Invoice updated");
      setEditOpen(false);

      await load(0);
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || e?.message || "Update failed");
    } finally {
      setEditSaving(false);
    }
  };

  /* =========================
      EDIT: ITEM HELPERS
  ========================= */
  const updateItemQty = (idx: number, qty: number) => {
    setForm((p) => {
      const items = [...p.items];
      items[idx] = { ...items[idx], quantity: qty };
      return { ...p, items };
    });
  };

  const removeItemAt = (idx: number) => {
    setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  };

  const addBlankItem = () => {
    setForm((p) => ({
      ...p,
      items: [...p.items, { productId: 0, quantity: 1 }],
    }));
  };

  const updateItemProductId = (idx: number, productId: number) => {
    setForm((p) => {
      const items = [...p.items];
      items[idx] = { ...items[idx], productId };
      return { ...p, items };
    });
  };

  /* =========================
      TOTAL (based on filter) -- now the backend's aggregate across every
      matching invoice, not just the rows currently loaded on screen.
  ========================= */
  const total = totalNetAmount;

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Invoices
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Default last 15 days • View + Reprint • Edit • (Audit: Created/Updated By)
            </Typography>
          </Box>

          <Chip
            label={loading ? "Loading..." : `Count: ${totalElements}`}
            size="small"
            sx={{ fontWeight: 900 }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() =>
              downloadAuthenticatedFile("/sales-invoice/export", "invoices.csv", { fromDate: from, toDate: to })
            }
          >
            Export CSV
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* filters row */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems={{ xs: "stretch", sm: "center" }}>
          <TextField
            type="date"
            label="From"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <TextField
            type="date"
            label="To"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />

          <TextField
            select
            label="Status"
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="ALL">ALL</MenuItem>
            <MenuItem value="PENDING">PENDING</MenuItem>
            <MenuItem value="PAID">PAID</MenuItem>
            <MenuItem value="CANCELED">CANCELED</MenuItem>
          </TextField>

          <TextField
            select
            label="Payment"
            size="small"
            value={payMethodFilter}
            onChange={(e) => setPayMethodFilter(e.target.value)}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="CASH">Cash</MenuItem>
            <MenuItem value="UPI">UPI</MenuItem>
            <MenuItem value="CARD">Card</MenuItem>
            <MenuItem value="SPLIT">Split (Cash + Online)</MenuItem>
          </TextField>

          <Button
            variant="contained"
            onClick={() => load(0)}
            disabled={loading}
            sx={{ borderRadius: 2, fontWeight: 900, minWidth: 120 }}
            startIcon={loading ? <CircularProgress size={18} /> : undefined}
          >
            Apply
          </Button>

          <Box sx={{ flex: 1 }} />

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: "left", sm: "right" } }}>
            Total: <b>₹{money(total)}</b>
          </Typography>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* list */}
        {filteredRows.length === 0 ? (
          <Typography color="text.secondary">{loading ? "Loading..." : "No invoices found"}</Typography>
        ) : (
          <Stack spacing={1}>
            {filteredRows.map((r) => (
              <Paper key={r.invoiceId} variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }} noWrap>
                      {r.invoiceNumber} — ₹{money(r.netTotal)}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      Date: {r.invoiceDate} • {r.payMethod} / {r.payStatus}
                    </Typography>

                    {(r.customerName || r.customerPhone) && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Customer: <b>{r.customerName || "NA"}</b>
                        {r.customerPhone ? ` • ${r.customerPhone}` : ""}
                      </Typography>
                    )}
                  </Box>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Button variant="outlined" onClick={() => openInvoice(r.invoiceId)} sx={{ whiteSpace: "nowrap" }}>
                      View / Print
                    </Button>

                    <Button
                      variant="outlined"
                      startIcon={<PictureAsPdfIcon />}
                      onClick={() =>
                        downloadAuthenticatedFile(`/sales-invoice/${r.invoiceId}/pdf`, `invoice-${r.invoiceNumber}.pdf`)
                      }
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      PDF
                    </Button>

                    <Button
                      variant="contained"
                      startIcon={<EditIcon />}
                      onClick={() => openEdit(r.invoiceId)}
                      sx={{ whiteSpace: "nowrap", borderRadius: 999 }}
                    >
                      Edit
                    </Button>

                    <Button
                      color="error"
                      variant="outlined"
                      startIcon={deletingId === r.invoiceId ? <CircularProgress size={16} /> : <DeleteIcon />}
                      onClick={() => askDelete(r.invoiceId, r.invoiceNumber)}
                      disabled={deletingId === r.invoiceId}
                      sx={{ whiteSpace: "nowrap", borderRadius: 999 }}
                    >
                      Void
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
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
      </Paper>

      {/* ===================== VIEW/PRINT MODAL ===================== */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Invoice Receipt
          <IconButton onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {openLoading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }} color="text.secondary">
                Loading invoice...
              </Typography>
            </Stack>
          ) : detail ? (
            <Stack spacing={1.2}>
              {/* ✅ AUDIT DISPLAY */}
              <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Created By: <b>{detail.createdBy || "NA"}</b>
                  {detail.createdAt ? ` • ${fmtDateTime(detail.createdAt)}` : ""}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Updated By: <b>{detail.updatedBy || "NA"}</b>
                  {detail.updatedAt ? ` • ${fmtDateTime(detail.updatedAt)}` : ""}
                </Typography>
              </Paper>

              <ToggleButtonGroup
                value={viewPrintFormat}
                exclusive
                onChange={(_, v) => v && setViewPrintFormat(v)}
                size="small"
              >
                <ToggleButton value="THERMAL">Thermal (80mm)</ToggleButton>
                <ToggleButton value="A4">A4 (Full Page)</ToggleButton>
              </ToggleButtonGroup>

              {viewPrintFormat === "THERMAL" ? (
                <Box ref={receiptWrapRef}>
                  <Receipt80mm shop={SHOP as any} invoice={detail} />
                </Box>
              ) : (
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, textAlign: "center" }}>
                  <PictureAsPdfIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1 }} />
                  <Typography sx={{ fontWeight: 900 }}>A4 Tax Invoice</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Click <strong>Print</strong> to open the full-page invoice in a new tab and send it to your A4 printer.
                  </Typography>
                </Paper>
              )}
            </Stack>
          ) : (
            <Typography color="text.secondary">No invoice loaded.</Typography>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          {viewPrintFormat === "THERMAL" ? (
            <Button
              variant="contained"
              onClick={() => setTimeout(() => window.print(), 100)}
              sx={{ borderRadius: 999, fontWeight: 900 }}
              disabled={!detail}
            >
              Print (Browser)
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={printA4View}
              startIcon={printingA4 ? <CircularProgress size={18} /> : <PictureAsPdfIcon />}
              sx={{ borderRadius: 999, fontWeight: 900 }}
              disabled={!detail || printingA4}
            >
              Print A4
            </Button>
          )}
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ===================== EDIT MODAL ===================== */}
      <Dialog open={editOpen} onClose={() => (editSaving ? null : setEditOpen(false))} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Edit Invoice {editInvoiceNumber ? `• ${editInvoiceNumber}` : ""}
          <IconButton onClick={() => setEditOpen(false)} disabled={editSaving}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {editLoading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }} color="text.secondary">
                Loading invoice for edit...
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Edit me items/pay/discount/customer snapshot update hoga. Customer record delete nahi hoga.
              </Alert>

              {/* pay + discount */}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                <TextField
                  select
                  label="Pay Method"
                  size="small"
                  value={form.payMethod}
                  onChange={(e) => setForm((p) => ({ ...p, payMethod: e.target.value }))}
                  fullWidth
                >
                  <MenuItem value="CASH">CASH</MenuItem>
                  <MenuItem value="CARD">CARD</MenuItem>
                  <MenuItem value="UPI">UPI</MenuItem>
                </TextField>

                <TextField
                  select
                  label="Pay Status"
                  size="small"
                  value={form.payStatus}
                  onChange={(e) => setForm((p) => ({ ...p, payStatus: e.target.value }))}
                  fullWidth
                >
                  <MenuItem value="PAID">PAID</MenuItem>
                  <MenuItem value="PENDING">PENDING</MenuItem>
                  <MenuItem value="CANCELED">CANCELED</MenuItem>
                </TextField>

                <TextField
                  label="Discount"
                  size="small"
                  value={form.discountValue}
                  onChange={(e) => setForm((p) => ({ ...p, discountValue: Number(e.target.value || 0) }))}
                  fullWidth
                  inputProps={{ inputMode: "numeric" }}
                />
              </Stack>

              {/* customer snapshot */}
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Typography sx={{ fontWeight: 900, mb: 1 }}>Customer Snapshot (optional)</Typography>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                  <TextField
                    label="Customer Name"
                    size="small"
                    value={form.customerName ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Phone"
                    size="small"
                    value={form.customerPhone ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))}
                    fullWidth
                  />
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ mt: 1.2 }}>
                  <TextField
                    label="Email"
                    size="small"
                    value={form.customerEmail ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, customerEmail: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Address"
                    size="small"
                    value={form.customerAddress ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, customerAddress: e.target.value }))}
                    fullWidth
                  />
                </Stack>
              </Paper>

              {/* items editor */}
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography sx={{ fontWeight: 900 }}>Items</Typography>
                  <Button variant="outlined" size="small" onClick={addBlankItem} sx={{ borderRadius: 999 }}>
                    + Add Item
                  </Button>
                </Stack>

                {form.items.length === 0 ? (
                  <Typography color="text.secondary">No items</Typography>
                ) : (
                  <Stack spacing={1}>
                    {form.items.map((it, idx) => (
                      <Paper key={idx} variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems="center">
                          <TextField
                            label="Product ID"
                            size="small"
                            value={it.productId}
                            onChange={(e) => updateItemProductId(idx, Number(e.target.value || 0))}
                            inputProps={{ inputMode: "numeric" }}
                            sx={{ width: { xs: "100%", sm: 180 } }}
                          />
                          <TextField
                            label="Qty"
                            size="small"
                            value={it.quantity}
                            onChange={(e) => updateItemQty(idx, Number(e.target.value || 1))}
                            inputProps={{ inputMode: "numeric", min: 1 }}
                            sx={{ width: { xs: "100%", sm: 120 } }}
                          />

                          <Box sx={{ flex: 1, width: "100%" }}>
                            <Typography sx={{ fontWeight: 800 }} noWrap>
                              {it.productName || "Product snapshot will come from backend"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Price: ₹{money(it.unitPrice)} • GST: {Number(it.gstPercent || 0)}%
                            </Typography>
                          </Box>

                          <Button color="error" variant="outlined" onClick={() => removeItemAt(idx)} sx={{ borderRadius: 999 }}>
                            Remove
                          </Button>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Paper>

              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                New items me productId correct do. Product not found / stock issue aaya to update fail hoga.
              </Alert>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditOpen(false)} disabled={editSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={updateInvoice}
            disabled={editLoading || editSaving}
            startIcon={editSaving ? <CircularProgress size={18} /> : <EditIcon />}
            sx={{ borderRadius: 999, fontWeight: 900 }}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================== CONFIRM DELETE DIALOG ===================== */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Confirm Void</DialogTitle>
        <DialogContent dividers>
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            {confirmText || "Void this invoice?"}
            <br />
            <b>This cannot be undone.</b>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={doDelete}
            startIcon={<DeleteIcon />}
            sx={{ borderRadius: 999, fontWeight: 900 }}
          >
            Void
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================== SNACKBAR ===================== */}
      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast.type}
          variant="filled"
          onClose={() => setToast((p) => ({ ...p, open: false }))}
          sx={{ width: "100%", borderRadius: 2 }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>

      {/* ✅ Print CSS (same as PosPage – receipt centered, 80mm, black) */}
      <style>
        {`
          @media print {
            @page { margin: 0 !important; padding: 0 !important; size: 80mm auto; }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              min-height: 0 !important;
              overflow: visible !important;
              display: flex !important;
              justify-content: center !important;
              align-items: flex-start !important;
            }
            body * { visibility: hidden !important; }
            #receipt-print-area, #receipt-print-area * { visibility: visible !important; }
            #receipt-print-area {
              position: static !important;
              width: 80mm !important;
              max-width: 80mm !important;
              min-width: 80mm !important;
              margin: 0 auto !important;
              padding: 0 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: visible !important;
              color: #000 !important;
              font-weight: 700 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              -webkit-font-smoothing: none !important;
              font-smoothing: none !important;
              font-size: 14px !important;
            }
            #receipt-print-area * {
              color: #000 !important;
              font-weight: 700 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>
    </Box>
  );
}
