import axiosClient from "../components/axiosData/axiosClient";

/**
 * Downloads a file from an authenticated API endpoint (axios attaches the bearer
 * token automatically) and triggers a browser save via a blob URL. A plain <a href>
 * won't carry the Authorization header, so this is needed for anything gated by RBAC.
 */
export async function downloadAuthenticatedFile(url: string, filename: string, params?: Record<string, any>) {
  const res = await axiosClient.get(url, { responseType: "blob", params });
  const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

/**
 * Opens a PDF blob (already fetched, e.g. via invoiceApi.getPdfBlob) in a new tab
 * and triggers the browser print dialog once it has loaded. Used for the "Print A4"
 * option, where — unlike the 80mm thermal receipt — we let the backend-generated
 * PDF (with its own page size/margins) drive the print, rather than printing the
 * on-screen DOM.
 */
export function printPdfBlob(blob: Blob) {
  const blobUrl = window.URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, "_blank");
  if (!printWindow) {
    // popup blocked — fall back to a normal download so the user can still print manually
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "invoice.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
    return;
  }
  printWindow.addEventListener("load", () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  });
}
