// src/utils/discountCalc.ts
export type DiscountMode = "RS" | "PCT";

export type CartLine = {
  productId: number;
  name: string;
  qty: number;
  price: number;      // taxable/unit price (GST excluded)
  gstPercent: number; // GST %
};

const n = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : 0);

export function calcTotalsWithDiscount(items: CartLine[], mode: DiscountMode, valueRaw: any) {
  const value = Math.max(0, n(valueRaw));

  const subTotal = items.reduce((s, it) => s + n(it.price) * n(it.qty), 0);

  if (subTotal <= 0) {
    return {
      subTotal: 0,
      discountBase: 0,       // rupees
      subAfterDiscount: 0,   // taxable after discount
      gstTotal: 0,
      grandTotal: 0,         // payable
      perItem: [] as Array<{
        productId: number;
        base: number;
        discountOnLine: number;
        baseAfterDiscount: number;
        gst: number;
        lineTotal: number;
      }>,
    };
  }

  // ✅ discount applies on taxable base (before GST)
  let discountBase = 0; // rupees only

  if (mode === "PCT") {
    const pct = Math.min(100, value);
    discountBase = (subTotal * pct) / 100;
  } else {
    discountBase = Math.min(subTotal, value);
  }

  const subAfterDiscount = Math.max(0, subTotal - discountBase);

  // ✅ split discount proportionally across items, then GST on discounted base
  const perItem = items.map((it) => {
    const base = n(it.price) * n(it.qty);
    const share = base / subTotal;
    const discountOnLine = discountBase * share;
    const baseAfterDiscount = Math.max(0, base - discountOnLine);
    const gst = (baseAfterDiscount * n(it.gstPercent)) / 100;
    const lineTotal = baseAfterDiscount + gst;
    return { productId: it.productId, base, discountOnLine, baseAfterDiscount, gst, lineTotal };
  });

  const gstTotal = perItem.reduce((s, x) => s + x.gst, 0);
  const grandTotal = perItem.reduce((s, x) => s + x.lineTotal, 0);

  return { subTotal, discountBase, subAfterDiscount, gstTotal, grandTotal, perItem };
}
