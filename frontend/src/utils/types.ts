

// export type ProductCode = {
//   codeId: number;
//   productId: number;
//   barcode?: string;   // unique
//   qrCode?: string;    // unique
//   createdAt: string;
// };

// export type Stock = {
//   stockId: number;
//   productId: number;
//   locationId: number;
//   qty: number;
//   updatedAt: string;
// };



// export type StockMovement = {
//   movementId: number;
//   productId: number;
//   movementType: StockMovementType;
//   qty: number;
//   referenceId?: string; // invoice number etc
//   createdAt: string;
// };

// export type PaymentMethod = "CASH" | "CARD" | "UPI";
// export type InvoiceStatus = "PAID" | "PENDING" | "CANCELED";

// export type SalesInvoice = {
//   invoiceId: number;
//   invoiceNumber: string;
//   invoiceDate: string;
//   subTotal: number;
//   gstTotal: number;
//   discount: number;
//   grandTotal: number;
//   paymentMethod: PaymentMethod;
//   status: InvoiceStatus;
//   createdAt: string;
// };

// export type SalesInvoiceItem = {
//   itemId: number;
//   invoiceId: number;
//   productId: number;
//   qty: number;
//   price: number;
//   gstPercent: number;
//   gstAmt: number;
//   totalAmt: number;
// };

// export type LowStockAlertConfig = {
//   alertId: number;
//   productId: number;
//   thresholdQty: number;
//   isAlertEnabled: boolean;
// };



// export type Product = {
//   productId: number;
//   barcode?: string;
//   productName: string;
//   prodPrice: number;
//   prodGST: number;
//   active?: boolean;      // some backends send "active"
//   isActive?: boolean;    // your entity has isActive
//   createdAt?: string;
//   updatedAt?: string;
// };








// export type SettingMaster = {
//   settingId?: number;
//   companyName: string;
//   address: string;
//   city: string;
//   phoneNumber: string;
//   email: string;
//   gstNumber: string;
// };


// export type ProductStockRow = Product & {
//   stockQty: number;
// };


// export type StockMovementType = "IN" | "OUT" | "SALE" | "ADJUSTMENT" | "RETURN";

// // ✅ backend projection DTO (now includes extra fields too)
// export type StockMovTypeDTO = {
//   movementId: number;
//   movType: StockMovementType;
//   stkMovmentQty: number;
//   referneceId?: string;
//   createdAt?: string;

//   reason?: string | null;
//   invoiceNum?: string | null;
//   actionUser?: string | null;
// };




// export type Category = {
//   categoryId: number;
//   categoryName: string;
//   isActive?: boolean;
// };

// export type ProductDTO = {
//   productId?: number;
//   productName: string;
//   prodPrice: number;
//   prodGST: number;

//   isActive: boolean;     // ✅ must match backend JSON
//   barcode?: string;

//   categoryId?: number;
//   categoryName?: string;
// };



export type ProductCode = {
  codeId: number;
  productId: number;
  barcode?: string; // unique
  qrCode?: string; // unique
  createdAt: string;
};

export type Stock = {
  stockId: number;
  productId: number;
  locationId: number;
  qty: number;
  updatedAt: string;
};

export type StockMovementType = "IN" | "OUT" | "SALE" | "ADJUSTMENT" | "RETURN";

export type StockMovement = {
  movementId: number;
  productId: number;
  movementType: StockMovementType;
  qty: number;
  referenceId?: string; // invoice number etc
  createdAt: string;
};

export type PaymentMethod = "CASH" | "CARD" | "UPI";
export type InvoiceStatus = "PAID" | "PENDING" | "CANCELED";

export type SalesInvoice = {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  subTotal: number;
  gstTotal: number;
  discount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  status: InvoiceStatus;
  createdAt: string;
};

export type SalesInvoiceItem = {
  itemId: number;
  invoiceId: number;
  productId: number;
  qty: number;
  price: number;
  gstPercent: number;
  gstAmt: number;
  totalAmt: number;
};

export type LowStockAlertConfig = {
  alertId: number;
  productId: number;
  thresholdQty: number;
  isAlertEnabled: boolean;
};

export type Product = {
  productId: number;
  barcode?: string;
  productName: string;
  prodPrice: number;
  prodGST: number;
  prodBuyPrice?: number; // cost/buy price for profit calculation
  active?: boolean; // some backends send "active"
  isActive?: boolean; // your entity has isActive
  createdAt?: string;
  updatedAt?: string;

  // optional category
  categoryId?: number;
  categoryName?: string;

  // restaurant menu flags
  isVeg?: boolean | null;
  temporarilyUnavailable?: boolean;

  /** true = stock product (quantity tracked); false = menu item (no quantity to maintain). */
  trackStock?: boolean;
  /** true = combo / meal deal made of other products. */
  combo?: boolean;
};

export type SettingMaster = {
  settingId?: number;
  companyName: string;
  address: string;
  city: string;
  phoneNumber: string;
  email: string;
  gstNumber: string;
};

export type ProductStockRow = Product & {
  stockQty: number;
};

// ✅ backend projection DTO
export type StockMovTypeDTO = {
  movementId: number;
  movType: StockMovementType;
  stkMovmentQty: number;
  referneceId?: string;
  createdAt?: string;
  reason?: string | null;
  invoiceNum?: string | null;
  actionUser?: string | null;
};

export type Category = {
  categoryId: number;
  categoryName: string;
  isActive?: boolean;

  // ✅ NEW: sub-categories (null/undefined = top-level category)
  parentCategoryId?: number | null;
  parentCategoryName?: string | null;
  isSubCategory?: boolean;
};

export type ProductDTO = {
  productId?: number;
  productName: string;
  prodPrice: number;
  prodGST: number;
  prodBuyPrice?: number; // cost/buy price for profit calculation
  isActive: boolean;
  barcode?: string;
  categoryId?: number;
  categoryName?: string;
  isVeg?: boolean | null;
  trackStock?: boolean;
  combo?: boolean;
};



export type Customer = {
  customerId: number;
  customerName: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
  createdAt?: string;
};