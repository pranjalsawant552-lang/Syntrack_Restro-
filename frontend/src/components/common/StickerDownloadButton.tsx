import React, { useCallback, useMemo, useRef, useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import JsBarcode from "jsbarcode";
import type { Product } from "../../utils/types";
import type { ShopInfo } from "../../store/useCompanyShop";

type Props = {
  shop: ShopInfo;
  product: Product;

  widthMm?: number;   // default 50
  heightMm?: number;  // default 30
  dpi?: number;       // default 203
};

const mmToPx = (mm: number, dpi: number) => Math.round((mm * dpi) / 25.4);
const money = (n: number) => Number(n || 0).toFixed(2);

export default function StickerDownloadButton({
  shop,
  product,
  widthMm = 48,
  heightMm = 24,
  dpi = 203,
}: Props) {
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const size = useMemo(() => {
    return { w: mmToPx(widthMm, dpi), h: mmToPx(heightMm, dpi) };
  }, [widthMm, heightMm, dpi]);

  const drawSticker = useCallback(() => {
    const canvas = canvasRef.current!;
    canvas.width = size.w;
    canvas.height = size.h;

    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size.w, size.h);

    // border
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size.w - 2, size.h - 2);

    const pad = Math.max(8, Math.round(size.w * 0.03));
    let y = pad;
    const x = pad;

    const titleFont = Math.max(14, Math.round(size.h * 0.14));
    const midFont = Math.max(12, Math.round(size.h * 0.12));
    const smallFont = Math.max(10, Math.round(size.h * 0.10));

    // SHOP NAME
    ctx.fillStyle = "#000";
    ctx.font = `bold ${titleFont}px Arial`;
    ctx.textBaseline = "top";
    ctx.fillText((shop.name || "My Shop").slice(0, 28), x, y);
    y += titleFont + 4;

    // PRODUCT NAME (1 line ellipsis)
    const prodName = (product.productName || "").trim();
    const maxChars = Math.floor((size.w - pad * 2) / (midFont * 0.55));
    const prodLine =
      prodName.length > maxChars
        ? prodName.slice(0, Math.max(0, maxChars - 2)) + ".."
        : prodName;

    ctx.font = `bold ${midFont}px Arial`;
    ctx.fillText(prodLine, x, y);
    y += midFont + 4;

    // PRICE ONLY (GST removed ✅)
    ctx.font = `${smallFont}px Arial`;
    const priceStr = `MRP: ₹${money(product.prodPrice)}`;
    ctx.fillText(priceStr, x, y);
    y += smallFont + 6;

    // BARCODE
    const code = (product.barcode || "").trim();
    if (!code) {
      ctx.font = `bold ${midFont}px Arial`;
      ctx.fillText("BARCODE: NA", x, y + 4);
      return;
    }

    const bcCanvas = document.createElement("canvas");
    JsBarcode(bcCanvas, code, {
      format: "CODE128",
      displayValue: true,
      font: "Arial",
      fontSize: Math.max(10, Math.round(size.h * 0.10)),
      textMargin: 2,
      margin: 0,
      height: Math.max(40, Math.round((size.h - y - pad) * 0.75)),
    });

    const targetW = size.w - pad * 2;
    const scale = Math.min(1, targetW / bcCanvas.width);
    const drawW = Math.round(bcCanvas.width * scale);
    const drawH = Math.round(bcCanvas.height * scale);

    const dx = Math.round((size.w - drawW) / 2);
    ctx.drawImage(bcCanvas, dx, y, drawW, drawH);

    // GSTIN small (optional)
    const gstNo = (shop.gst || "").trim();
    if (gstNo) {
      ctx.font = `${Math.max(9, Math.round(size.h * 0.085))}px Arial`;
      ctx.fillText(
        `GSTIN: ${gstNo}`,
        x,
        size.h - pad - Math.max(10, Math.round(size.h * 0.10))
      );
    }
  }, [product.barcode, product.prodPrice, product.productName, shop.gst, shop.name, size.h, size.w]);

  const download = useCallback(async () => {
    setBusy(true);
    try {
      if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
      drawSticker();

      const canvas = canvasRef.current!;
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png")
      );

      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const fileName =
        `${(shop.name || "SHOP").replace(/\s+/g, "_")}_` +
        `${(product.productName || "PRODUCT").replace(/\s+/g, "_").slice(0, 18)}_` +
        `${product.productId}.png`;

      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }, [drawSticker, product.productId, product.productName, shop.name]);

  return (
    <>
      {/* hidden */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <Button
        size="small"
        variant="outlined"
        onClick={download}
        disabled={busy}
        sx={{ borderRadius: 2, fontWeight: 900 }}
      >
        {busy ? <CircularProgress size={16} /> : "Sticker"}
      </Button>
    </>
  );
}
