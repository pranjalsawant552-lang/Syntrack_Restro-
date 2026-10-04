  // // src/pages/DashboardPage.tsx
  // import React, { useEffect, useMemo, useState } from "react";
  // import {
  //   Alert,
  //   Box,
  //   Card,
  //   CardContent,
  //   CircularProgress,
  //   Container,
  //   Divider,
  //   MenuItem,
  //   Paper,
  //   Select,
  //   Stack,
  //   TextField,
  //   Typography,
  //   Button,
  //   Chip,
  // } from "@mui/material";
  // import RefreshIcon from "@mui/icons-material/Refresh";
  // import TrendingUpIcon from "@mui/icons-material/TrendingUp";
  // import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
  // import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
  // import WarningAmberIcon from "@mui/icons-material/WarningAmber";
  // import PersonIcon from "@mui/icons-material/Person";

  // import dayjs from "dayjs";
  // import ReactECharts from "echarts-for-react";
  // import axiosClient from "../components/axiosData/axiosClient";

  // /** ---------------- API ---------------- */
  // const dashboardApi = {
  //   kpis: (from: string, to: string, lowStockThreshold = 5) =>
  //     axiosClient
  //       .post(`/dashboard/kpis?lowStockThreshold=${lowStockThreshold}`, { from, to })
  //       .then((r) => r.data),

  //   trend: (from: string, to: string) =>
  //     axiosClient.post(`/dashboard/trend`, { from, to }).then((r) => r.data),

  //   topProductsRevenue: (from: string, to: string, limit = 10) =>
  //     axiosClient
  //       .post(`/dashboard/top-products/revenue?limit=${limit}`, { from, to })
  //       .then((r) => r.data),

  //   topProductsQty: (from: string, to: string, limit = 10) =>
  //     axiosClient
  //       .post(`/dashboard/top-products/qty?limit=${limit}`, { from, to })
  //       .then((r) => r.data),

  //   categorySales: (from: string, to: string) =>
  //     axiosClient.post(`/dashboard/category-sales`, { from, to }).then((r) => r.data),

  //   lowStock: (threshold = 5, limit = 50) =>
  //     axiosClient
  //       .get(`/dashboard/low-stock?threshold=${threshold}&limit=${limit}`)
  //       .then((r) => r.data),

  //   recentInvoices: (limit = 10) =>
  //     axiosClient.get(`/dashboard/recent-invoices?limit=${limit}`).then((r) => r.data),

  //   recentStockMovements: (limit = 20) =>
  //     axiosClient
  //       .get(`/dashboard/recent-stock-movements?limit=${limit}`)
  //       .then((r) => r.data),
  // };

  // /** ---------------- Types (matches your DTOs) ---------------- */
  // type DashboardKpiRes = {
  //   todaySales: number;
  //   todayTaxable: number;
  //   todayGst: number;
  //   todayDiscount: number;
  //   todayInvoices: number;

  //   monthSales: number;
  //   monthInvoices: number;

  //   rangeSales: number;
  //   rangeTaxable: number;
  //   rangeGst: number;
  //   rangeDiscount: number;
  //   rangeInvoices: number;

  //   activeProducts: number;
  //   inactiveProducts: number;

  //   activeCustomers: number;
  //   inactiveCustomers: number;

  //   lowStockCount: number;
  // };

  // type TrendPoint = { date: string; netTotal: number; invoices: number };

  // type TopProductRow = {
  //   productId: number;
  //   productName: string;
  //   qty: number;
  //   revenue: number;
  // };

  // type CategorySalesRow = {
  //   categoryId: number;
  //   categoryName: string;
  //   revenue: number;
  //   qty: number;
  // };

  // type LowStockRow = { productId: number; productName: string; barcode: string; qty: number };

  // type RecentInvoiceRow = {
  //   invoiceId: number;
  //   invoiceNumber: string;
  //   invoiceDate: string;
  //   netTotal: number;
  //   payMethod: string;
  //   payStatus: string;
  //   customerName: string;
  // };

  // const money = (n: any) => (Number.isFinite(Number(n)) ? Number(n).toFixed(2) : "0.00");
  // const n = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : 0);

  // /** ---------------- UI Small Components ---------------- */
  // function KpiCard({
  //   title,
  //   value,
  //   sub,
  //   icon,
  // }: {
  //   title: string;
  //   value: string;
  //   sub?: string;
  //   icon?: React.ReactNode;
  // }) {
  //   return (
  //     <Card variant="outlined" sx={{ borderRadius: 3 }}>
  //       <CardContent>
  //         <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
  //           <Box>
  //             <Typography variant="body2" color="text.secondary">
  //               {title}
  //             </Typography>
  //             <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>
  //               {value}
  //             </Typography>
  //             {sub ? (
  //               <Typography variant="caption" color="text.secondary">
  //                 {sub}
  //               </Typography>
  //             ) : null}
  //           </Box>
  //           <Box sx={{ opacity: 0.75 }}>{icon}</Box>
  //         </Stack>
  //       </CardContent>
  //     </Card>
  //   );
  // }

  // function TableCard({
  //   title,
  //   children,
  //   right,
  // }: {
  //   title: string;
  //   children: React.ReactNode;
  //   right?: React.ReactNode;
  // }) {
  //   return (
  //     <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
  //       <Box sx={{ p: 1.5 }}>
  //         <Stack direction="row" alignItems="center" justifyContent="space-between">
  //           <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
  //           {right}
  //         </Stack>
  //       </Box>
  //       <Divider />
  //       <Box sx={{ p: 1.5 }}>{children}</Box>
  //     </Paper>
  //   );
  // }

  // export default function DashboardPage() {
  //   // default: last 7 days
  //   const [preset, setPreset] = useState<"7d" | "30d" | "today" | "month" | "custom">("7d");
  //   const [from, setFrom] = useState<string>(dayjs().subtract(6, "day").format("YYYY-MM-DD"));
  //   const [to, setTo] = useState<string>(dayjs().format("YYYY-MM-DD"));
  //   const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);

  //   const [loading, setLoading] = useState(false);
  //   const [err, setErr] = useState<string>("");

  //   const [kpis, setKpis] = useState<DashboardKpiRes | null>(null);
  //   const [trend, setTrend] = useState<TrendPoint[]>([]);
  //   const [topRev, setTopRev] = useState<TopProductRow[]>([]);
  //   const [topQty, setTopQty] = useState<TopProductRow[]>([]);
  //   const [catSales, setCatSales] = useState<CategorySalesRow[]>([]);
  //   const [lowStock, setLowStock] = useState<LowStockRow[]>([]);
  //   const [recentInv, setRecentInv] = useState<RecentInvoiceRow[]>([]);

  //   // preset logic
  //   useEffect(() => {
  //     const today = dayjs();
  //     if (preset === "today") {
  //       setFrom(today.format("YYYY-MM-DD"));
  //       setTo(today.format("YYYY-MM-DD"));
  //     } else if (preset === "7d") {
  //       setFrom(today.subtract(6, "day").format("YYYY-MM-DD"));
  //       setTo(dayjs().format("YYYY-MM-DD"));
  //     } else if (preset === "30d") {
  //       setFrom(today.subtract(29, "day").format("YYYY-MM-DD"));
  //       setTo(dayjs().format("YYYY-MM-DD"));
  //     } else if (preset === "month") {
  //       setFrom(dayjs().startOf("month").format("YYYY-MM-DD"));
  //       setTo(dayjs().endOf("month").format("YYYY-MM-DD"));
  //     }
  //   }, [preset]);

  //   const loadAll = async () => {
  //     setLoading(true);
  //     setErr("");
  //     try {
  //       const [k, tr, tpr, tpq, cs, ls, ri] = await Promise.all([
  //         dashboardApi.kpis(from, to, lowStockThreshold),
  //         dashboardApi.trend(from, to),
  //         dashboardApi.topProductsRevenue(from, to, 10),
  //         dashboardApi.topProductsQty(from, to, 10),
  //         dashboardApi.categorySales(from, to),
  //         dashboardApi.lowStock(lowStockThreshold, 50),
  //         dashboardApi.recentInvoices(12),
  //       ]);

  //       setKpis(k);
  //       setTrend(Array.isArray(tr) ? tr : []);
  //       setTopRev(Array.isArray(tpr) ? tpr : []);
  //       setTopQty(Array.isArray(tpq) ? tpq : []);
  //       setCatSales(Array.isArray(cs) ? cs : []);
  //       setLowStock(Array.isArray(ls) ? ls : []);
  //       setRecentInv(Array.isArray(ri) ? ri : []);
  //     } catch (e: any) {
  //       setErr(e?.response?.data?.message || e?.message || "Failed to load dashboard");
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   useEffect(() => {
  //     loadAll();
  //     // eslint-disable-next-line react-hooks/exhaustive-deps
  //   }, []);

  //   // chart options
  //   const trendOption = useMemo(() => {
  //     const x = trend.map((p) => p.date);
  //     const y = trend.map((p) => n(p.netTotal));
  //     return {
  //       tooltip: { trigger: "axis" },
  //       grid: { left: 40, right: 16, top: 20, bottom: 40 },
  //       xAxis: { type: "category", data: x, axisLabel: { rotate: 35 } },
  //       yAxis: { type: "value" },
  //       series: [{ type: "line", data: y, smooth: true }],
  //     };
  //   }, [trend]);

  //   const topRevOption = useMemo(() => {
  //     const names = topRev.map((x) => x.productName).slice(0, 10);
  //     const vals = topRev.map((x) => n(x.revenue)).slice(0, 10);
  //     return {
  //       tooltip: { trigger: "axis" },
  //       grid: { left: 40, right: 16, top: 20, bottom: 90 },
  //       xAxis: { type: "category", data: names, axisLabel: { rotate: 45 } },
  //       yAxis: { type: "value" },
  //       series: [{ type: "bar", data: vals }],
  //     };
  //   }, [topRev]);

  //   const catOption = useMemo(() => {
  //     const names = catSales.map((x) => x.categoryName);
  //     const vals = catSales.map((x) => n(x.revenue));
  //     return {
  //       tooltip: { trigger: "axis" },
  //       grid: { left: 40, right: 16, top: 20, bottom: 90 },
  //       xAxis: { type: "category", data: names, axisLabel: { rotate: 45 } },
  //       yAxis: { type: "value" },
  //       series: [{ type: "bar", data: vals }],
  //     };
  //   }, [catSales]);

  //   return (
  //     <Container maxWidth="xl" sx={{ py: 2 }}>
  //       <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
  //         <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between">
  //           <Box>
  //             <Typography variant="h6" sx={{ fontWeight: 900 }}>
  //               Dashboard
  //             </Typography>
  //             <Typography variant="body2" color="text.secondary">
  //               Sales, Stock, Products, Customers
  //             </Typography>
  //           </Box>

  //           <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
  //             <Select
  //               size="small"
  //               value={preset}
  //               onChange={(e) => setPreset(e.target.value as any)}
  //               sx={{ minWidth: 160 }}
  //             >
  //               <MenuItem value="today">Today</MenuItem>
  //               <MenuItem value="7d">Last 7 days</MenuItem>
  //               <MenuItem value="30d">Last 30 days</MenuItem>
  //               <MenuItem value="month">This Month</MenuItem>
  //               <MenuItem value="custom">Custom</MenuItem>
  //             </Select>

  //             <TextField
  //               size="small"
  //               label="From"
  //               type="date"
  //               value={from}
  //               onChange={(e) => setFrom(e.target.value)}
  //               InputLabelProps={{ shrink: true }}
  //               disabled={preset !== "custom"}
  //               sx={{ minWidth: 160 }}
  //             />

  //             <TextField
  //               size="small"
  //               label="To"
  //               type="date"
  //               value={to}
  //               onChange={(e) => setTo(e.target.value)}
  //               InputLabelProps={{ shrink: true }}
  //               disabled={preset !== "custom"}
  //               sx={{ minWidth: 160 }}
  //             />

  //             <TextField
  //               size="small"
  //               label="Low Stock"
  //               type="number"
  //               value={lowStockThreshold}
  //               onChange={(e) => setLowStockThreshold(Number(e.target.value))}
  //               inputProps={{ min: 0 }}
  //               sx={{ width: 120 }}
  //             />

  //             <Button
  //               variant="contained"
  //               startIcon={loading ? <CircularProgress size={18} /> : <RefreshIcon />}
  //               onClick={loadAll}
  //               disabled={loading}
  //               sx={{ borderRadius: 999, fontWeight: 900 }}
  //             >
  //               Refresh
  //             </Button>
  //           </Stack>
  //         </Stack>

  //         {err ? (
  //           <Alert severity="error" sx={{ mt: 2 }}>
  //             {err}
  //           </Alert>
  //         ) : null}

  //         <Divider sx={{ my: 2 }} />

  //         {/* KPI CARDS */}
  //         <Box
  //           sx={{
  //             display: "grid",
  //             gap: 1.5,
  //             gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
  //           }}
  //         >
  //           <KpiCard
  //             title="Today Sales"
  //             value={`₹ ${money(kpis?.todaySales)}`}
  //             sub={`${kpis?.todayInvoices ?? 0} invoices`}
  //             icon={<TrendingUpIcon />}
  //           />
  //           <KpiCard
  //             title="This Month Sales"
  //             value={`₹ ${money(kpis?.monthSales)}`}
  //             sub={`${kpis?.monthInvoices ?? 0} invoices`}
  //             icon={<ReceiptLongIcon />}
  //           />
  //           <KpiCard
  //             title="Range Sales"
  //             value={`₹ ${money(kpis?.rangeSales)}`}
  //             sub={`${kpis?.rangeInvoices ?? 0} invoices`}
  //             icon={<TrendingUpIcon />}
  //           />
  //           <KpiCard
  //             title="Low Stock"
  //             value={`${kpis?.lowStockCount ?? 0}`}
  //             sub={`Threshold ≤ ${lowStockThreshold}`}
  //             icon={<WarningAmberIcon />}
  //           />

  //           <KpiCard
  //             title="Active Products"
  //             value={`${kpis?.activeProducts ?? 0}`}
  //             sub={`Inactive: ${kpis?.inactiveProducts ?? 0}`}
  //             icon={<Inventory2OutlinedIcon />}
  //           />
  //           <KpiCard
  //             title="Active Customers"
  //             value={`${kpis?.activeCustomers ?? 0}`}
  //             sub={`Inactive: ${kpis?.inactiveCustomers ?? 0}`}
  //             icon={<PersonIcon />}
  //           />
  //           <KpiCard
  //             title="Range GST"
  //             value={`₹ ${money(kpis?.rangeGst)}`}
  //             sub={`Discount: ₹ ${money(kpis?.rangeDiscount)}`}
  //             icon={<ReceiptLongIcon />}
  //           />
  //           <KpiCard
  //             title="Range Taxable"
  //             value={`₹ ${money(kpis?.rangeTaxable)}`}
  //             sub={`Net: ₹ ${money(kpis?.rangeSales)}`}
  //             icon={<TrendingUpIcon />}
  //           />
  //         </Box>

  //         <Divider sx={{ my: 2 }} />

  //         {/* CHARTS */}
  //         <Box
  //           sx={{
  //             display: "grid",
  //             gap: 1.5,
  //             gridTemplateColumns: { xs: "1fr", md: "1.3fr 1fr" },
  //           }}
  //         >
  //           <Paper variant="outlined" sx={{ borderRadius: 3, p: 1.5 }}>
  //             <Typography sx={{ fontWeight: 900, mb: 1 }}>Sales Trend</Typography>
  //             <ReactECharts option={trendOption} style={{ height: 320 }} />
  //           </Paper>

  //           <Paper variant="outlined" sx={{ borderRadius: 3, p: 1.5 }}>
  //             <Typography sx={{ fontWeight: 900, mb: 1 }}>Category Sales</Typography>
  //             <ReactECharts option={catOption} style={{ height: 320 }} />
  //           </Paper>
  //         </Box>

  //         <Box sx={{ height: 14 }} />

  //         <Box
  //           sx={{
  //             display: "grid",
  //             gap: 1.5,
  //             gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
  //           }}
  //         >
  //           <Paper variant="outlined" sx={{ borderRadius: 3, p: 1.5 }}>
  //             <Typography sx={{ fontWeight: 900, mb: 1 }}>Top Products (Revenue)</Typography>
  //             <ReactECharts option={topRevOption} style={{ height: 320 }} />
  //           </Paper>

  //           <TableCard
  //             title="Low Stock Items"
  //             right={<Chip label={`≤ ${lowStockThreshold}`} size="small" />}
  //           >
  //             {lowStock.length === 0 ? (
  //               <Typography variant="body2" color="text.secondary">
  //                 No low stock items
  //               </Typography>
  //             ) : (
  //               <Box sx={{ display: "grid", gap: 1 }}>
  //                 {lowStock.slice(0, 12).map((x) => (
  //                   <Paper key={x.productId} variant="outlined" sx={{ borderRadius: 2, p: 1 }}>
  //                     <Stack direction="row" justifyContent="space-between" alignItems="center">
  //                       <Box>
  //                         <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>{x.productName}</Typography>
  //                         <Typography variant="caption" color="text.secondary">
  //                           {x.barcode ? `Barcode: ${x.barcode}` : "Barcode: NA"}
  //                         </Typography>
  //                       </Box>
  //                       <Chip label={`Qty: ${x.qty}`} color={x.qty <= lowStockThreshold ? "warning" : "default"} />
  //                     </Stack>
  //                   </Paper>
  //                 ))}
  //               </Box>
  //             )}
  //           </TableCard>
  //         </Box>

  //         <Box sx={{ height: 14 }} />

  //         {/* RECENT INVOICES */}
  //         <TableCard title="Recent Invoices">
  //           {recentInv.length === 0 ? (
  //             <Typography variant="body2" color="text.secondary">
  //               No invoices
  //             </Typography>
  //           ) : (
  //             <Box sx={{ display: "grid", gap: 1 }}>
  //               {recentInv.map((x) => (
  //                 <Paper key={x.invoiceId} variant="outlined" sx={{ borderRadius: 2, p: 1 }}>
  //                   <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
  //                     <Box sx={{ minWidth: 0 }}>
  //                       <Typography sx={{ fontWeight: 900, lineHeight: 1.1 }}>
  //                         {x.invoiceNumber} • ₹ {money(x.netTotal)}
  //                       </Typography>
  //                       <Typography variant="caption" color="text.secondary">
  //                         {x.invoiceDate} • {x.customerName || "Walk-in"} • {x.payMethod}/{x.payStatus}
  //                       </Typography>
  //                     </Box>
  //                     <Chip size="small" label={x.payStatus} />
  //                   </Stack>
  //                 </Paper>
  //               ))}
  //             </Box>
  //           )}
  //         </TableCard>
  //       </Paper>
  //     </Container>
  //   );
  // }






  // src/pages/DashboardPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  Button,
  Chip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PersonIcon from "@mui/icons-material/Person";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";

import dayjs from "dayjs";
import ReactECharts from "echarts-for-react";
import axiosClient from "../components/axiosData/axiosClient";

/** ---------------- API ---------------- */
const dashboardApi = {
  kpis: (from: string, to: string, lowStockThreshold = 5) =>
    axiosClient
      .post(`/dashboard/kpis?lowStockThreshold=${lowStockThreshold}`, { from, to })
      .then((r) => r.data),

  trend: (from: string, to: string) =>
    axiosClient.post(`/dashboard/trend`, { from, to }).then((r) => r.data),

  topProductsRevenue: (from: string, to: string, limit = 10) =>
    axiosClient.post(`/dashboard/top-products/revenue?limit=${limit}`, { from, to }).then((r) => r.data),

  topProductsQty: (from: string, to: string, limit = 10) =>
    axiosClient.post(`/dashboard/top-products/qty?limit=${limit}`, { from, to }).then((r) => r.data),

  categorySales: (from: string, to: string) =>
    axiosClient.post(`/dashboard/category-sales`, { from, to }).then((r) => r.data),

  lowStock: (threshold = 5, limit = 50) =>
    axiosClient.get(`/dashboard/low-stock?threshold=${threshold}&limit=${limit}`).then((r) => r.data),

  recentInvoices: (limit = 10) =>
    axiosClient.get(`/dashboard/recent-invoices?limit=${limit}`).then((r) => r.data),

  recentStockMovements: (limit = 20) =>
    axiosClient.get(`/dashboard/recent-stock-movements?limit=${limit}`).then((r) => r.data),

  topProductsProfit: (from: string, to: string, limit = 10) =>
    axiosClient
      .post(`/dashboard/top-products/profit?limit=${limit}`, { from, to })
      .then((r) => r.data),
};

/** ---------------- Types (matches your DTOs) ---------------- */
type DashboardKpiRes = {
  todaySales: number;
  todayTaxable: number;
  todayGst: number;
  todayDiscount: number;
  todayInvoices: number;

  monthSales: number;
  monthInvoices: number;

  rangeSales: number;
  rangeTaxable: number;
  rangeGst: number;
  rangeDiscount: number;
  rangeInvoices: number;

  activeProducts: number;
  inactiveProducts: number;

  activeCustomers: number;
  inactiveCustomers: number;

  lowStockCount: number;

  // ✅ pending amounts
  todayPendingAmount: number;
  rangePendingAmount: number;
  allTimePendingAmount: number;

  // ✅ payment method totals
  todayCash: number;
  todayCard: number;
  todayUpi: number;

  rangeCash: number;
  rangeCard: number;
  rangeUpi: number;

  allTimeCash: number;
  allTimeCard: number;
  allTimeUpi: number;

  // ✅ all time totals (since start)
  allTimeSales: number;
  allTimeInvoices: number;
  allTimeGst: number;
  allTimeDiscount: number;
  allTimeTaxable: number;

  // ✅ profit (revenue after discount − cost)
  todayProfit: number;
  rangeProfit: number;
  allTimeProfit: number;
};

type TrendPoint = { date: string; netTotal: number; invoices: number };

type TopProductRow = {
  productId: number;
  productName: string;
  qty: number;
  revenue: number;
};

type ProductProfitRow = {
  productId: number;
  productName: string;
  profit: number;
};

type CategorySalesRow = {
  categoryId: number;
  categoryName: string;
  revenue: number;
  qty: number;
};

type LowStockRow = { productId: number; productName: string; barcode: string; qty: number };

type RecentInvoiceRow = {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  netTotal: number;
  payMethod: string;
  payStatus: string;
  customerName: string;
};

const money = (v: any) => (Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "0.00");
const num = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : 0);

/** ---------------- UI Small Components ---------------- */
function KpiCard({
  title,
  value,
  sub,
  icon,
}: {
  title: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>
              {value}
            </Typography>
            {sub ? (
              <Typography variant="caption" color="text.secondary">
                {sub}
              </Typography>
            ) : null}
          </Box>
          <Box sx={{ opacity: 0.75 }}>{icon}</Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function TableCard({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
      <Box sx={{ p: 1.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
          {right}
        </Stack>
      </Box>
      <Divider />
      <Box sx={{ p: 1.5 }}>{children}</Box>
    </Paper>
  );
}

function MethodChips({
  cash,
  card,
  upi,
  caption,
}: {
  cash: any;
  card: any;
  upi: any;
  caption?: string;
}) {
  return (
    <Stack spacing={1}>
      {caption ? (
        <Typography variant="caption" color="text.secondary">
          {caption}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
        <Chip label={`CASH: ₹ ${money(cash)}`} />
        <Chip label={`CARD: ₹ ${money(card)}`} />
        <Chip label={`UPI: ₹ ${money(upi)}`} />
      </Stack>
    </Stack>
  );
}

export default function DashboardPage() {
  // default: last 7 days
  const [preset, setPreset] = useState<"7d" | "30d" | "today" | "month" | "custom">("7d");
  const [from, setFrom] = useState<string>(dayjs().subtract(6, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(5);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const [kpis, setKpis] = useState<DashboardKpiRes | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [topRev, setTopRev] = useState<TopProductRow[]>([]);
  const [topQty, setTopQty] = useState<TopProductRow[]>([]);
  const [catSales, setCatSales] = useState<CategorySalesRow[]>([]);
  const [lowStock, setLowStock] = useState<LowStockRow[]>([]);
  const [recentInv, setRecentInv] = useState<RecentInvoiceRow[]>([]);
  const [topProfit, setTopProfit] = useState<ProductProfitRow[]>([]);

  // preset logic
  useEffect(() => {
    const today = dayjs();
    if (preset === "today") {
      setFrom(today.format("YYYY-MM-DD"));
      setTo(today.format("YYYY-MM-DD"));
    } else if (preset === "7d") {
      setFrom(today.subtract(6, "day").format("YYYY-MM-DD"));
      setTo(dayjs().format("YYYY-MM-DD"));
    } else if (preset === "30d") {
      setFrom(today.subtract(29, "day").format("YYYY-MM-DD"));
      setTo(dayjs().format("YYYY-MM-DD"));
    } else if (preset === "month") {
      setFrom(dayjs().startOf("month").format("YYYY-MM-DD"));
      setTo(dayjs().endOf("month").format("YYYY-MM-DD"));
    }
  }, [preset]);

  const loadAll = async () => {
    setLoading(true);
    setErr("");
    try {
      const [k, tr, tpr, tpq, cs, ls, ri, tprofit] = await Promise.all([
        dashboardApi.kpis(from, to, lowStockThreshold),
        dashboardApi.trend(from, to),
        dashboardApi.topProductsRevenue(from, to, 10),
        dashboardApi.topProductsQty(from, to, 10),
        dashboardApi.categorySales(from, to),
        dashboardApi.lowStock(lowStockThreshold, 50),
        dashboardApi.recentInvoices(12),
        dashboardApi.topProductsProfit(from, to, 10),
      ]);

      setKpis(k);
      setTrend(Array.isArray(tr) ? tr : []);
      setTopRev(Array.isArray(tpr) ? tpr : []);
      setTopQty(Array.isArray(tpq) ? tpq : []);
      setCatSales(Array.isArray(cs) ? cs : []);
      setLowStock(Array.isArray(ls) ? ls : []);
      setRecentInv(Array.isArray(ri) ? ri : []);
      setTopProfit(Array.isArray(tprofit) ? tprofit : []);
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // chart options
  const trendOption = useMemo(() => {
    const x = trend.map((p) => p.date);
    const y = trend.map((p) => num(p.netTotal));
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 16, top: 20, bottom: 40 },
      xAxis: { type: "category", data: x, axisLabel: { rotate: 35 } },
      yAxis: { type: "value" },
      series: [{ type: "line", data: y, smooth: true }],
    };
  }, [trend]);

  const topRevOption = useMemo(() => {
    const names = topRev.map((x) => x.productName).slice(0, 10);
    const vals = topRev.map((x) => num(x.revenue)).slice(0, 10);
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 16, top: 20, bottom: 90 },
      xAxis: { type: "category", data: names, axisLabel: { rotate: 45 } },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: vals }],
    };
  }, [topRev]);

  const catOption = useMemo(() => {
    const names = catSales.map((x) => x.categoryName);
    const vals = catSales.map((x) => num(x.revenue));
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 40, right: 16, top: 20, bottom: 90 },
      xAxis: { type: "category", data: names, axisLabel: { rotate: 45 } },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: vals }],
    };
  }, [catSales]);

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sales, Stock, Products, Customers
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
            <Select size="small" value={preset} onChange={(e) => setPreset(e.target.value as any)} sx={{ minWidth: 160 }}>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="month">This Month</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </Select>

            <TextField
              size="small"
              label="From"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              disabled={preset !== "custom"}
              sx={{ minWidth: 160 }}
            />

            <TextField
              size="small"
              label="To"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              disabled={preset !== "custom"}
              sx={{ minWidth: 160 }}
            />

            <TextField
              size="small"
              label="Low Stock"
              type="number"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(Number(e.target.value))}
              inputProps={{ min: 0 }}
              sx={{ width: 120 }}
            />

            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={18} /> : <RefreshIcon />}
              onClick={loadAll}
              disabled={loading}
              sx={{ borderRadius: 999, fontWeight: 900 }}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>

        {err ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {err}
          </Alert>
        ) : null}

        <Divider sx={{ my: 2 }} />

        {/* KPI CARDS */}
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          }}
        >
          <KpiCard
            title="Today Sales"
            value={`₹ ${money(kpis?.todaySales)}`}
            sub={`${kpis?.todayInvoices ?? 0} invoices`}
            icon={<TrendingUpIcon />}
          />
          <KpiCard
            title="This Month Sales"
            value={`₹ ${money(kpis?.monthSales)}`}
            sub={`${kpis?.monthInvoices ?? 0} invoices`}
            icon={<ReceiptLongIcon />}
          />
          <KpiCard
            title="Range Sales"
            value={`₹ ${money(kpis?.rangeSales)}`}
            sub={`${kpis?.rangeInvoices ?? 0} invoices`}
            icon={<TrendingUpIcon />}
          />
          <KpiCard
            title="Low Stock"
            value={`${kpis?.lowStockCount ?? 0}`}
            sub={`Threshold ≤ ${lowStockThreshold}`}
            icon={<WarningAmberIcon />}
          />

          <KpiCard
            title="Today Pending Amount"
            value={`₹ ${money(kpis?.todayPendingAmount)}`}
            sub="Pay Status: PENDING"
            icon={<WarningAmberIcon />}
          />
          <KpiCard
            title="Range Pending Amount"
            value={`₹ ${money(kpis?.rangePendingAmount)}`}
            sub={`${from} → ${to}`}
            icon={<WarningAmberIcon />}
          />
          <KpiCard
            title="All Time Pending"
            value={`₹ ${money(kpis?.allTimePendingAmount)}`}
            sub="Since start"
            icon={<WarningAmberIcon />}
          />

          <KpiCard
            title="All Time Sales"
            value={`₹ ${money(kpis?.allTimeSales)}`}
            sub={`${kpis?.allTimeInvoices ?? 0} invoices`}
            icon={<TrendingUpIcon />}
          />

          <KpiCard
            title="Active Products"
            value={`${kpis?.activeProducts ?? 0}`}
            sub={`Inactive: ${kpis?.inactiveProducts ?? 0}`}
            icon={<Inventory2OutlinedIcon />}
          />
          <KpiCard
            title="Active Customers"
            value={`${kpis?.activeCustomers ?? 0}`}
            sub={`Inactive: ${kpis?.inactiveCustomers ?? 0}`}
            icon={<PersonIcon />}
          />
          <KpiCard
            title="All Time GST"
            value={`₹ ${money(kpis?.allTimeGst)}`}
            sub={`Discount: ₹ ${money(kpis?.allTimeDiscount)}`}
            icon={<ReceiptLongIcon />}
          />
          <KpiCard
            title="All Time Taxable"
            value={`₹ ${money(kpis?.allTimeTaxable)}`}
            sub={`Net: ₹ ${money(kpis?.allTimeSales)}`}
            icon={<TrendingUpIcon />}
          />

          <KpiCard
            title="Today Profit"
            value={`₹ ${money(kpis?.todayProfit)}`}
            sub="After discount − cost"
            icon={<MonetizationOnIcon />}
          />
          <KpiCard
            title="Range Profit"
            value={`₹ ${money(kpis?.rangeProfit)}`}
            sub={`${from} → ${to}`}
            icon={<MonetizationOnIcon />}
          />
          <KpiCard
            title="All Time Profit"
            value={`₹ ${money(kpis?.allTimeProfit)}`}
            sub="After discount − cost"
            icon={<MonetizationOnIcon />}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Payment method wise cards */}
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
          }}
        >
          <TableCard title="Today Payment Split" right={<Chip size="small" label="CASH / CARD / UPI" />}>
            <MethodChips cash={kpis?.todayCash} card={kpis?.todayCard} upi={kpis?.todayUpi} caption="InvoiceDate: Today" />
          </TableCard>

          <TableCard title="Range Payment Split" right={<Chip size="small" label={`${from} → ${to}`} />}>
            <MethodChips
              cash={kpis?.rangeCash}
              card={kpis?.rangeCard}
              upi={kpis?.rangeUpi}
              caption="InvoiceDate: selected range"
            />
          </TableCard>

          <TableCard title="All Time Payment Split" right={<Chip size="small" label="Since start" />}>
            <MethodChips
              cash={kpis?.allTimeCash}
              card={kpis?.allTimeCard}
              upi={kpis?.allTimeUpi}
              caption="InvoiceDate: all time"
            />
          </TableCard>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* CHARTS */}
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", md: "1.3fr 1fr" },
          }}
        >
          <Paper variant="outlined" sx={{ borderRadius: 3, p: 1.5 }}>
            <Typography sx={{ fontWeight: 900, mb: 1 }}>Sales Trend</Typography>
            <ReactECharts option={trendOption} style={{ height: 320 }} />
          </Paper>

          <Paper variant="outlined" sx={{ borderRadius: 3, p: 1.5 }}>
            <Typography sx={{ fontWeight: 900, mb: 1 }}>Category Sales</Typography>
            <ReactECharts option={catOption} style={{ height: 320 }} />
          </Paper>
        </Box>

        <Box sx={{ height: 14 }} />

        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          <Paper variant="outlined" sx={{ borderRadius: 3, p: 1.5 }}>
            <Typography sx={{ fontWeight: 900, mb: 1 }}>Top Products (Revenue)</Typography>
            <ReactECharts option={topRevOption} style={{ height: 320 }} />
          </Paper>

          <TableCard title="Low Stock Items" right={<Chip label={`≤ ${lowStockThreshold}`} size="small" />}>
            {lowStock.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No low stock items
              </Typography>
            ) : (
              <Box sx={{ display: "grid", gap: 1 }}>
                {lowStock.slice(0, 12).map((x) => (
                  <Paper key={x.productId} variant="outlined" sx={{ borderRadius: 2, p: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>{x.productName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {x.barcode ? `Barcode: ${x.barcode}` : "Barcode: NA"}
                        </Typography>
                      </Box>
                      <Chip label={`Qty: ${x.qty}`} color={x.qty <= lowStockThreshold ? "warning" : "default"} />
                    </Stack>
                  </Paper>
                ))}
              </Box>
            )}
          </TableCard>
        </Box>

        {/* Product-wise Profit (after discount − cost) */}
        <Box sx={{ mt: 2 }}>
          <TableCard
            title="Product-wise Profit"
            right={<Chip size="small" label={`${from} → ${to} (after discount)`} />}
          >
            {topProfit.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No sales in range or add buy price to products to see profit
              </Typography>
            ) : (
              <Box sx={{ display: "grid", gap: 1 }}>
                {topProfit.map((x) => (
                  <Paper key={x.productId} variant="outlined" sx={{ borderRadius: 2, p: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }}>{x.productName}</Typography>
                      <Chip
                        label={`₹ ${money(x.profit)}`}
                        color={num(x.profit) >= 0 ? "success" : "error"}
                        size="small"
                      />
                    </Stack>
                  </Paper>
                ))}
              </Box>
            )}
          </TableCard>
        </Box>

        <Box sx={{ height: 14 }} />

        {/* RECENT INVOICES */}
        <TableCard title="Recent Invoices">
          {recentInv.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No invoices
            </Typography>
          ) : (
            <Box sx={{ display: "grid", gap: 1 }}>
              {recentInv.map((x) => (
                <Paper key={x.invoiceId} variant="outlined" sx={{ borderRadius: 2, p: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                        {x.invoiceNumber} • ₹ {money(x.netTotal)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {x.invoiceDate} • {x.customerName || "Walk-in"} • {x.payMethod}/{x.payStatus}
                      </Typography>
                    </Box>
                    <Chip size="small" label={x.payStatus} />
                  </Stack>
                </Paper>
              ))}
            </Box>
          )}
        </TableCard>
      </Paper>
    </Container>
  );
}
