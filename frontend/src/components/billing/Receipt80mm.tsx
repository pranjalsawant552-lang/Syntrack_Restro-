import React from "react";
import { Box, Divider, Typography } from "@mui/material";
import type { InvoiceDetailDTO } from "./invoiceApi";

const money = (n: number) => Number(n || 0).toFixed(2);

type Props = {
  shop: { name: string; phone: string; address: string };
  invoice: InvoiceDetailDTO;
};

export default function Receipt80mm({ shop, invoice }: Props) {
  const invDate = invoice.invoiceDate || new Date().toISOString().slice(0, 10);

  // optional fields (backend me add karoge tab automatically show ho jayega)
  const customerLine =
    (invoice as any).customerName ||
    (invoice as any).customerPhone ||
    (invoice as any).customerEmail ||
    (invoice as any).customerAddress;

  return (
    <Box
      id="receipt-print-area"
      sx={{
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: 14,
        width: "80mm",
        mx: "auto",
        p: 1,
        border: "1px dashed #ddd",
        borderRadius: 1,
        color: "#000",
        "@media print": {
          border: "none",
          fontSize: "14px !important",
          color: "#000 !important",
          fontWeight: "700 !important",
          marginLeft: "auto !important",
          marginRight: "auto !important",
          "&, & *": {
            color: "#000 !important",
            fontWeight: "700 !important",
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          },
          "& .MuiDivider-root": { borderColor: "#000 !important" },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ textAlign: "center" }}>
        <Typography sx={{ fontWeight: 900, fontSize: 18, color: "#000" }}>{shop.name}</Typography>
        <Typography variant="caption" sx={{ color: "#000", fontSize: 13 }}>{shop.address}</Typography>
        <Typography variant="caption" sx={{ color: "#000", fontSize: 13 }}>Ph: {shop.phone}</Typography>
      </Box>

      <Divider sx={{ my: 1, borderColor: "#333", "@media print": { borderColor: "#000 !important" } }} />

      {/* Invoice meta */}
      <Typography>
        Invoice: <b>{invoice.invoiceNumber}</b>
      </Typography>
      <Typography>Date: {invDate}</Typography>
      <Typography>
        Pay: {invoice.payMethod} / {invoice.payStatus}
      </Typography>

      {/* Split payment breakdown (only when payMethod === SPLIT) */}
      {(invoice as any).payMethod === "SPLIT" && (
        <Box sx={{ mt: 0.2 }}>
          <Typography>&nbsp;&nbsp;Cash: {money((invoice as any).cashAmount)}</Typography>
          <Typography>
            &nbsp;&nbsp;{(invoice as any).onlinePayMethod || "Online"}: {money((invoice as any).onlineAmount)}
          </Typography>
        </Box>
      )}

      {/* Customer block (optional) */}
      {customerLine && (
        <Box sx={{ mt: 0.5 }}>
          {(invoice as any).customerName && (
            <Typography>
              Customer: <b>{(invoice as any).customerName}</b>
            </Typography>
          )}
          {(invoice as any).customerPhone && <Typography>Mobile: {(invoice as any).customerPhone}</Typography>}
          {(invoice as any).customerEmail && <Typography>Email: {(invoice as any).customerEmail}</Typography>}
          {(invoice as any).customerAddress && <Typography>Address: {(invoice as any).customerAddress}</Typography>}
        </Box>
      )}

      <Divider sx={{ my: 1, borderColor: "#333", "@media print": { borderColor: "#000 !important" } }} />

      {/* Items header */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 40px 60px", gap: 1 }}>
        <Typography sx={{ fontWeight: 900 }}>ITEM</Typography>
        <Typography sx={{ fontWeight: 900, textAlign: "right" }}>QTY</Typography>
        <Typography sx={{ fontWeight: 900, textAlign: "right" }}>AMT</Typography>
      </Box>

      <Divider sx={{ my: 0.5, borderColor: "#333", "@media print": { borderColor: "#000 !important" } }} />

      {/* Items */}
      {(invoice.items ?? []).map((it, idx) => {
        const amt = it.totalAmountOfProd ?? (it as any).totalAmount ?? 0;
        return (
          <Box
            key={idx}
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 40px 60px",
              gap: 1,
              py: 0.2,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.productName}
                {(it as any).variantName ? ` (${(it as any).variantName})` : ""}
              </Typography>
              {(it as any).optionsText && (
                <Typography sx={{ fontSize: 12, pl: 1 }}>+ {(it as any).optionsText}</Typography>
              )}
            </Box>
            <Typography sx={{ textAlign: "right" }}>{it.quantity}</Typography>
            <Typography sx={{ textAlign: "right" }}>{money(amt)}</Typography>
          </Box>
        );
      })}

      <Divider sx={{ my: 1, borderColor: "#333", "@media print": { borderColor: "#000 !important" } }} />

      {/* Totals */}
      <Box sx={{ textAlign: "right" }}>
        <Typography>SubTotal: {money(invoice.subTotal)}</Typography>
        <Typography>GST: {money(invoice.gstTotal)}</Typography>
        <Typography>Discount: {money(invoice.discountValue)}</Typography>
        <Typography sx={{ fontWeight: 900 }}>TOTAL: {money(invoice.netTotal)}</Typography>
      </Box>

      <Divider sx={{ my: 1, borderColor: "#333", "@media print": { borderColor: "#000 !important" } }} />
      <Typography sx={{ textAlign: "center" }}>Thank you! Visit again.</Typography>
    </Box>
  );
}
