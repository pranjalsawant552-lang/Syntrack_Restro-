package com.pos.app.common.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.pos.app.Entity.SalesInvoiceItem;
import com.pos.app.Entity.SalesInvoiceMaster;
import com.pos.app.Entity.SettingMaster;
import com.pos.app.Enum.PaymentMethod;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Generates a professional A4 "Tax Invoice" PDF — used as the A4 print/download
 * option alongside the 80mm thermal receipt printed from the frontend. Both
 * represent the same invoice; this one is meant for a regular A4 printer /
 * emailing / filing, so it uses a full letterhead-style layout instead of the
 * narrow single-column thermal format.
 */
@Service
public class InvoicePdfService {

    private static final Color BRAND_DARK = new Color(33, 37, 60);
    private static final Color LIGHT_GREY = new Color(245, 246, 250);
    private static final Color BORDER_GREY = new Color(210, 212, 222);

    private static final Font BRAND_TITLE_FONT = new Font(Font.HELVETICA, 20, Font.BOLD, BRAND_DARK);
    private static final Font DOC_TITLE_FONT = new Font(Font.HELVETICA, 13, Font.BOLD, Color.WHITE);
    private static final Font SECTION_LABEL_FONT = new Font(Font.HELVETICA, 9, Font.BOLD, new Color(110, 110, 120));
    private static final Font HEADER_FONT = new Font(Font.HELVETICA, 10, Font.BOLD, Color.WHITE);
    private static final Font NORMAL_FONT = new Font(Font.HELVETICA, 10, Font.NORMAL, Color.BLACK);
    private static final Font BOLD_FONT = new Font(Font.HELVETICA, 10, Font.BOLD, Color.BLACK);
    private static final Font TOTAL_LABEL_FONT = new Font(Font.HELVETICA, 11, Font.BOLD, Color.BLACK);
    private static final Font GRAND_TOTAL_FONT = new Font(Font.HELVETICA, 13, Font.BOLD, Color.WHITE);
    private static final Font SMALL_FONT = new Font(Font.HELVETICA, 8, Font.ITALIC, Color.GRAY);
    private static final Font FOOTER_FONT = new Font(Font.HELVETICA, 9, Font.ITALIC, new Color(90, 90, 100));

    public byte[] generate(SalesInvoiceMaster invoice, SettingMaster settings) {
        try {
            Document doc = new Document(PageSize.A4, 36, 36, 30, 30);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            PdfWriter.getInstance(doc, out);
            doc.open();

            String companyName = (settings != null && settings.getCompanyName() != null && !settings.getCompanyName().isBlank())
                    ? settings.getCompanyName()
                    : (settings != null && settings.getAppName() != null ? settings.getAppName() : "");

            /* ============ LETTERHEAD ============ */
            doc.add(new Paragraph(companyName.isBlank() ? "Invoice" : companyName, BRAND_TITLE_FONT));

            if (settings != null) {
                StringBuilder line1 = new StringBuilder();
                if (settings.getAddress() != null && !settings.getAddress().isBlank()) line1.append(settings.getAddress());
                if (settings.getCity() != null && !settings.getCity().isBlank()) {
                    if (line1.length() > 0) line1.append(", ");
                    line1.append(settings.getCity());
                }
                if (line1.length() > 0) doc.add(new Paragraph(line1.toString(), NORMAL_FONT));

                StringBuilder line2 = new StringBuilder();
                if (settings.getPhoneNumber() != null && !settings.getPhoneNumber().isBlank())
                    line2.append("Ph: ").append(settings.getPhoneNumber());
                if (settings.getEmail() != null && !settings.getEmail().isBlank()) {
                    if (line2.length() > 0) line2.append("   |   ");
                    line2.append("Email: ").append(settings.getEmail());
                }
                if (settings.getGstNumber() != null && !settings.getGstNumber().isBlank()) {
                    if (line2.length() > 0) line2.append("   |   ");
                    line2.append("GSTIN: ").append(settings.getGstNumber());
                }
                if (line2.length() > 0) doc.add(new Paragraph(line2.toString(), NORMAL_FONT));
            }

            doc.add(new Chunk(new com.lowagie.text.pdf.draw.LineSeparator(1f, 100f, BRAND_DARK, Element.ALIGN_CENTER, -2)));
            doc.add(Chunk.NEWLINE);

            /* ============ "TAX INVOICE" BAR ============ */
            PdfPTable titleBar = new PdfPTable(1);
            titleBar.setWidthPercentage(100);
            PdfPCell titleCell = new PdfPCell(new Phrase("TAX INVOICE", DOC_TITLE_FONT));
            titleCell.setBackgroundColor(BRAND_DARK);
            titleCell.setPadding(8);
            titleCell.setBorder(Rectangle.NO_BORDER);
            titleBar.addCell(titleCell);
            doc.add(titleBar);
            doc.add(Chunk.NEWLINE);

            /* ============ INVOICE META  |  BILL TO (two columns) ============ */
            PdfPTable metaTable = new PdfPTable(new float[]{1f, 1f});
            metaTable.setWidthPercentage(100);

            PdfPCell metaLeft = new PdfPCell();
            metaLeft.setBorder(Rectangle.NO_BORDER);
            metaLeft.setPaddingRight(10);
            metaLeft.addElement(new Paragraph("INVOICE DETAILS", SECTION_LABEL_FONT));
            metaLeft.addElement(new Paragraph("Invoice #: " + safe(invoice.getInvoiceNumber()), BOLD_FONT));
            String dateStr = invoice.getInvoiceDate() != null
                    ? invoice.getInvoiceDate().format(DateTimeFormatter.ofPattern("dd MMM yyyy")) : "";
            metaLeft.addElement(new Paragraph("Date: " + dateStr, NORMAL_FONT));
            metaLeft.addElement(new Paragraph("Status: " + safe(invoice.getPayStatus() != null ? invoice.getPayStatus().name() : ""), NORMAL_FONT));
            metaTable.addCell(metaLeft);

            PdfPCell metaRight = new PdfPCell();
            metaRight.setBorder(Rectangle.NO_BORDER);
            metaRight.setPaddingLeft(10);
            boolean hasCustomer = invoice.getCustomerName() != null && !invoice.getCustomerName().isBlank();
            metaRight.addElement(new Paragraph("BILL TO", SECTION_LABEL_FONT));
            if (hasCustomer) {
                metaRight.addElement(new Paragraph(safe(invoice.getCustomerName()), BOLD_FONT));
                if (invoice.getCustomerPhone() != null && !invoice.getCustomerPhone().isBlank())
                    metaRight.addElement(new Paragraph(safe(invoice.getCustomerPhone()), NORMAL_FONT));
                if (invoice.getCustomerEmail() != null && !invoice.getCustomerEmail().isBlank())
                    metaRight.addElement(new Paragraph(safe(invoice.getCustomerEmail()), NORMAL_FONT));
                if (invoice.getCustomerAddress() != null && !invoice.getCustomerAddress().isBlank())
                    metaRight.addElement(new Paragraph(safe(invoice.getCustomerAddress()), NORMAL_FONT));
            } else {
                metaRight.addElement(new Paragraph("Walk-in Customer", NORMAL_FONT));
            }
            metaTable.addCell(metaRight);

            doc.add(metaTable);
            doc.add(Chunk.NEWLINE);

            /* ============ ITEMS TABLE ============ */
            PdfPTable table = new PdfPTable(new float[]{0.5f, 3f, 0.8f, 1.2f, 0.8f, 1.3f});
            table.setWidthPercentage(100);

            for (String h : new String[]{"#", "Item", "Qty", "Unit Price", "GST%", "Total"}) {
                PdfPCell cell = new PdfPCell(new Phrase(h, HEADER_FONT));
                cell.setBackgroundColor(BRAND_DARK);
                cell.setPadding(6);
                cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                table.addCell(cell);
            }

            int sr = 1;
            boolean alt = false;
            for (SalesInvoiceItem item : invoice.getItems()) {
                Color rowColor = alt ? LIGHT_GREY : Color.WHITE;

                table.addCell(rowCell(String.valueOf(sr++), NORMAL_FONT, Element.ALIGN_CENTER, rowColor));
                String itemLabel = safe(item.getProductName())
                        + (item.getVariantName() != null && !item.getVariantName().isBlank() ? " (" + safe(item.getVariantName()) + ")" : "")
                        + (item.getOptionsText() != null && !item.getOptionsText().isBlank() ? "\n+ " + safe(item.getOptionsText()) : "");
                table.addCell(rowCell(itemLabel, NORMAL_FONT, Element.ALIGN_LEFT, rowColor));
                table.addCell(rowCell(String.valueOf(item.getQuantity()), NORMAL_FONT, Element.ALIGN_CENTER, rowColor));
                table.addCell(rowCell(String.format("%.2f", item.getUnitPrice()), NORMAL_FONT, Element.ALIGN_RIGHT, rowColor));
                table.addCell(rowCell(String.format("%.1f%%", item.getGstPercent()), NORMAL_FONT, Element.ALIGN_CENTER, rowColor));
                table.addCell(rowCell(String.format("%.2f", item.getTotalAmountOfProd()), NORMAL_FONT, Element.ALIGN_RIGHT, rowColor));
                alt = !alt;
            }
            doc.add(table);
            doc.add(Chunk.NEWLINE);

            /* ============ PAYMENT INFO  |  TOTALS (two columns) ============ */
            PdfPTable bottomTable = new PdfPTable(new float[]{1.1f, 1f});
            bottomTable.setWidthPercentage(100);

            PdfPCell payCell = new PdfPCell();
            payCell.setBorder(Rectangle.NO_BORDER);
            payCell.setPaddingRight(10);
            payCell.addElement(new Paragraph("PAYMENT", SECTION_LABEL_FONT));
            PaymentMethod payMethod = invoice.getPayMethod();
            payCell.addElement(new Paragraph("Method: " + safe(payMethod != null ? payMethod.name() : ""), NORMAL_FONT));
            if (payMethod == PaymentMethod.SPLIT) {
                double cash = invoice.getCashAmount() != null ? invoice.getCashAmount() : 0;
                double online = invoice.getOnlineAmount() != null ? invoice.getOnlineAmount() : 0;
                String onlineMode = invoice.getOnlinePayMethod() != null ? invoice.getOnlinePayMethod().name() : "ONLINE";
                payCell.addElement(new Paragraph(String.format("  Cash: Rs. %.2f", cash), NORMAL_FONT));
                payCell.addElement(new Paragraph(String.format("  %s: Rs. %.2f", onlineMode, online), NORMAL_FONT));
            }
            bottomTable.addCell(payCell);

            PdfPCell totalsCell = new PdfPCell();
            totalsCell.setBorder(Rectangle.NO_BORDER);
            totalsCell.setPaddingLeft(10);

            PdfPTable totals = new PdfPTable(new float[]{2f, 1.3f});
            totals.setWidthPercentage(100);
            addTotalRow(totals, "Subtotal", invoice.getSubTotal(), false);
            addTotalRow(totals, "GST", invoice.getGstTotal(), false);
            addTotalRow(totals, "Discount", -invoice.getDiscountValue(), false);

            PdfPCell grandLabel = new PdfPCell(new Phrase("NET TOTAL", TOTAL_LABEL_FONT));
            grandLabel.setBackgroundColor(BRAND_DARK);
            grandLabel.setPadding(7);
            grandLabel.setBorderColor(BORDER_GREY);
            PdfPCell grandValue = new PdfPCell(new Phrase("Rs. " + String.format("%.2f", invoice.getNetTotal()), GRAND_TOTAL_FONT));
            grandValue.setBackgroundColor(BRAND_DARK);
            grandValue.setPadding(7);
            grandValue.setHorizontalAlignment(Element.ALIGN_RIGHT);
            grandValue.setBorderColor(BORDER_GREY);
            totals.addCell(grandLabel);
            totals.addCell(grandValue);

            totalsCell.addElement(totals);
            bottomTable.addCell(totalsCell);

            doc.add(bottomTable);

            doc.add(Chunk.NEWLINE);
            doc.add(new Chunk(new com.lowagie.text.pdf.draw.LineSeparator(0.5f, 100f, BORDER_GREY, Element.ALIGN_CENTER, -2)));
            Paragraph thanks = new Paragraph("Thank you for your business!", FOOTER_FONT);
            thanks.setAlignment(Element.ALIGN_CENTER);
            thanks.setSpacingBefore(8);
            doc.add(thanks);

            Paragraph generated = new Paragraph(
                    "Generated on " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a")),
                    SMALL_FONT);
            generated.setAlignment(Element.ALIGN_CENTER);
            doc.add(generated);

            doc.close();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate invoice PDF: " + e.getMessage(), e);
        }
    }

    private void addTotalRow(PdfPTable table, String label, double value, boolean bold) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, bold ? BOLD_FONT : NORMAL_FONT));
        labelCell.setBorder(Rectangle.NO_BORDER);
        labelCell.setPadding(4);
        table.addCell(labelCell);

        PdfPCell valCell = new PdfPCell(new Phrase(String.format("%.2f", value), bold ? BOLD_FONT : NORMAL_FONT));
        valCell.setBorder(Rectangle.NO_BORDER);
        valCell.setPadding(4);
        valCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(valCell);
    }

    private PdfPCell rowCell(String text, Font font, int align, Color bg) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(6);
        cell.setHorizontalAlignment(align);
        cell.setBackgroundColor(bg);
        cell.setBorderColor(BORDER_GREY);
        return cell;
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }
}
