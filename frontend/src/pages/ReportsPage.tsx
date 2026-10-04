import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import dayjs from "dayjs";
import { reportApi, type GstSummary, type InventoryReport } from "../components/reports/reportApi";
import { downloadAuthenticatedFile } from "../utils/downloadFile";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary">
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(dayjs().subtract(30, "day").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [slowMovingDays, setSlowMovingDays] = useState(30);

  const [gst, setGst] = useState<GstSummary | null>(null);
  const [inventory, setInventory] = useState<InventoryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, inv] = await Promise.all([
        reportApi.gstSummary(fromDate, toDate),
        reportApi.inventoryReport(slowMovingDays),
      ]);
      setGst(g);
      setInventory(inv);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 900, mb: 2 }}>
        Reports
      </Typography>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
            <TextField
              label="From"
              type="date"
              size="small"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Select size="small" value={slowMovingDays} onChange={(e) => setSlowMovingDays(Number(e.target.value))}>
              <MenuItem value={7}>Slow-moving: 7+ days</MenuItem>
              <MenuItem value={30}>Slow-moving: 30+ days</MenuItem>
              <MenuItem value={60}>Slow-moving: 60+ days</MenuItem>
              <MenuItem value={90}>Slow-moving: 90+ days</MenuItem>
            </Select>
            <Button variant="contained" onClick={load} disabled={loading}>
              {loading ? <CircularProgress size={20} color="inherit" /> : "Refresh"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* ---------- Sales & GST ---------- */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ReceiptLongIcon />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Sales & GST Summary
          </Typography>
        </Stack>
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => downloadAuthenticatedFile("/reports/gst-summary/export", "gst-summary.csv", { fromDate, toDate })}
        >
          Export CSV
        </Button>
      </Stack>

      {gst && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard label="Sales (Net Total)" value={`₹${gst.salesNetTotal.toFixed(2)}`} sub={`${gst.salesInvoiceCount} invoices`} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard label="GST Collected (Sales)" value={`₹${gst.salesGstCollected.toFixed(2)}`} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard label="GST Paid (Purchases)" value={`₹${gst.purchaseGstPaid.toFixed(2)}`} sub={`${gst.purchaseCount} purchases`} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              label="Net GST Payable"
              value={`₹${gst.netGstPayable.toFixed(2)}`}
              sub={gst.netGstPayable >= 0 ? "You owe this to the tax authority" : "Refundable input credit"}
            />
          </Grid>
        </Grid>
      )}

      {/* ---------- Inventory ---------- */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Inventory2Icon />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Inventory
          </Typography>
        </Stack>
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => downloadAuthenticatedFile("/reports/inventory/export", "slow-moving-inventory.csv", { slowMovingDays })}
        >
          Export CSV
        </Button>
      </Stack>

      {inventory && (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label="Total Stock Value" value={`₹${inventory.totalInventoryValue.toFixed(2)}`} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                label="Slow-Moving Items"
                value={String(inventory.slowMovingCount)}
                sub={`No sales in ${inventory.slowMovingDays}+ days`}
              />
            </Grid>
          </Grid>

          <TableContainer component={Card} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Barcode</TableCell>
                  <TableCell align="right">Qty on Hand</TableCell>
                  <TableCell align="right">Stock Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inventory.slowMovingItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ color: "text.secondary", py: 3 }}>
                      No slow-moving items — good sign!
                    </TableCell>
                  </TableRow>
                ) : (
                  inventory.slowMovingItems.map((item) => (
                    <TableRow key={item.productId} hover>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell>{item.barcode || "—"}</TableCell>
                      <TableCell align="right">
                        <Chip size="small" label={item.qty} />
                      </TableCell>
                      <TableCell align="right">₹{item.stockValue.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
