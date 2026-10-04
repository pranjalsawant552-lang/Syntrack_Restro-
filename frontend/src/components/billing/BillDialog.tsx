import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PrintIcon from "@mui/icons-material/Print";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { useDispatch } from "react-redux";

import Receipt80mm from "./Receipt80mm";
import { invoiceApi, type InvoiceDetailDTO } from "./invoiceApi";
import { useCompanyShop } from "../../store/useCompanyShop";
import type { AppDispatch } from "../../store/store";
import { fetchCurrentSetting } from "../../store/settingsSlice";
import { printPdfBlob } from "../../utils/downloadFile";

type Props = {
  open: boolean;
  invoiceId: number | null;
  onClose: () => void;
  title?: string;
};

/**
 * The FINAL BILL for a settled order -- loaded from the saved invoice (never rebuilt on the client), so what
 * is printed is exactly what was invoiced. Used for table, parcel and online orders alike.
 * Thermal (80mm) prints the on-screen receipt; A4 opens the backend PDF.
 */
export default function BillDialog({ open, invoiceId, onClose, title = "Final bill" }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const shop = useCompanyShop();

  const [invoice, setInvoice] = useState<InvoiceDetailDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<"THERMAL" | "A4">("THERMAL");
  const [printingA4, setPrintingA4] = useState(false);

  useEffect(() => {
    dispatch(fetchCurrentSetting());
  }, [dispatch]);

  useEffect(() => {
    if (!open || !invoiceId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setInvoice(null);
    invoiceApi
      .getById(invoiceId)
      .then((inv) => !cancelled && setInvoice(inv))
      .catch((e: any) => !cancelled && setError(e?.response?.data?.message || e?.message || "Could not load the bill"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, invoiceId]);

  const printA4 = async () => {
    if (!invoiceId) return;
    setPrintingA4(true);
    try {
      printPdfBlob(await invoiceApi.getPdfBlob(invoiceId));
    } catch (e: any) {
      setError(e?.message || "Failed to load the A4 invoice");
    } finally {
      setPrintingA4(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {title}
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <ToggleButtonGroup value={format} exclusive size="small" sx={{ mb: 1.5 }} onChange={(_, v) => v && setFormat(v)}>
          <ToggleButton value="THERMAL">Thermal (80mm)</ToggleButton>
          <ToggleButton value="A4">A4 (Full page)</ToggleButton>
        </ToggleButtonGroup>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {invoice &&
          (format === "THERMAL" ? (
            <Receipt80mm shop={shop as any} invoice={invoice as any} />
          ) : (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <PictureAsPdfIcon sx={{ fontSize: 40, color: "text.secondary" }} />
              <Typography sx={{ fontWeight: 900 }}>A4 Tax Invoice</Typography>
              <Typography variant="body2" color="text.secondary">
                Press Print to open the full-page invoice and send it to your A4 printer.
              </Typography>
            </Box>
          ))}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose}>Done</Button>
        {format === "THERMAL" ? (
          <Button variant="contained" startIcon={<PrintIcon />} disabled={!invoice} onClick={() => setTimeout(() => window.print(), 100)}>
            Print
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={printingA4 ? <CircularProgress size={18} /> : <PictureAsPdfIcon />}
            disabled={!invoice || printingA4}
            onClick={printA4}
          >
            Print
          </Button>
        )}
      </DialogActions>

      {/* prints ONLY the receipt (Receipt80mm renders #receipt-print-area) */}
      <style>
        {`
          @media print {
            @page { margin: 0 !important; size: 80mm auto; }
            html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; overflow: visible !important;
              display: flex !important; justify-content: center !important; align-items: flex-start !important; }
            body * { visibility: hidden !important; }
            #receipt-print-area, #receipt-print-area * { visibility: visible !important; }
            #receipt-print-area { position: static !important; width: 80mm !important; max-width: 80mm !important;
              min-width: 80mm !important; margin: 0 auto !important; padding: 0 !important; page-break-inside: avoid;
              overflow: visible !important; color: #000 !important; font-weight: 700 !important; font-size: 14px !important;
              -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            #receipt-print-area * { color: #000 !important; font-weight: 700 !important; }
          }
        `}
      </style>
    </Dialog>
  );
}
