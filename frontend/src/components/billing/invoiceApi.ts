import axiosClient from "../axiosData/axiosClient";
const pickData = (res: any) => res?.data?.data ?? res?.data;

export type PayMethod = "CASH" | "CARD" | "UPI" | "SPLIT";
export type PayStatus = "PAID" | "PENDING" | "CANCELED";

export type InvoiceItemRequestDTO = {
  productId: number;
  quantity: number;
};

export type InvoiceRequestDTO = {
  payMethod: PayMethod;
  payStatus: PayStatus;
  discountValue: number;
  items: InvoiceItemRequestDTO[];

  // ✅ NEW
  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;

  // ✅ split payment — only required when payMethod === "SPLIT"
  cashAmount?: number | null;
  onlineAmount?: number | null;
  onlinePayMethod?: "CARD" | "UPI" | null;
};

export type InvoiceCreateResponseDTO = {
  invoiceId: number;
  invoiceNumber: string;
  message: string;
};


export type InvoiceItemResponseDTO = {
  itemId: number;
  productId: number;
  productName: string;
  unitPrice: number;
  gstPercent: number;
  quantity: number;
  taxableAmount: number;
  gstAmount: number;
  totalAmountOfProd: number;
  variantName?: string | null;
  optionsText?: string | null;
};

export type InvoiceDetailDTO = {
  invoiceNumber: string;
  invoiceDate: string; // yyyy-MM-dd (backend LocalDate -> string)

  subTotal: number;
  gstTotal: number;
  discountValue: number;
  netTotal: number;

  payMethod: "CASH" | "CARD" | "UPI" | "SPLIT";
  payStatus: "PAID" | "PENDING" | "CANCELED";

  // ✅ split payment (only set when payMethod === "SPLIT")
  cashAmount?: number | null;
  onlineAmount?: number | null;
  onlinePayMethod?: "CARD" | "UPI" | null;

  customerId?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;

  items: InvoiceItemResponseDTO[];

  // ✅ AUDIT (NEW)
  createdBy?: string | null;
  createdAt?: string | null;  // LocalDateTime -> ISO-ish string
  updatedBy?: string | null;
  updatedAt?: string | null;
};


export const invoiceApi = {
  create: async (payload: InvoiceRequestDTO): Promise<InvoiceCreateResponseDTO> => {
    const res = await axiosClient.post(`/sales-invoice/create`, payload);
    return pickData(res) as InvoiceCreateResponseDTO;
  },

  getById: async (invoiceId: number): Promise<InvoiceDetailDTO> => {
    const res = await axiosClient.get(`/sales-invoice/invoice/${invoiceId}`);
    return pickData(res) as InvoiceDetailDTO;
  },

  // ✅ A4 professional invoice PDF (same document used for download on InvoicesPage)
  getPdfBlob: async (invoiceId: number): Promise<Blob> => {
    const res = await axiosClient.get(`/sales-invoice/${invoiceId}/pdf`, { responseType: "blob" });
    return res.data as Blob;
  },
};
