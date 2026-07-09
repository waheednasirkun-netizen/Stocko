
import { useState, useMemo, useCallback, useEffect, memo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts";

import { useApp } from "../context/AppContext";
import { Ic, Btn, Card, EmptyState } from "../components/ui";
import { fmtNum } from "../lib/constants";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const CHART_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#06b6d4"];

const REPORT_TYPES = [
  { key: "stock",     label: "Stock Movement",      icon: "ArrowLeftRight", color: "#2563eb" },
  { key: "requests",  label: "Request Fulfillment", icon: "Package",        color: "#16a34a" },
  { key: "inventory", label: "Inventory Summary",   icon: "Boxes",          color: "#7c3aed" },
];

const DATE_PRESETS = [
  { label: "Today",       days: 0 },
  { label: "Yesterday",   days: 1 },
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days",days: 30 },
  { label: "This Week",   type: "week" },
  { label: "This Month",  type: "month" },
  { label: "Last Month",  type: "lastMonth" },
  { label: "This Year",   type: "year" },
  { label: "Custom Range",type: "custom" },
];

const STOCK_MOVEMENT_TYPES = ["All", "Stock IN", "Stock OUT", "Wastage", "Fulfillment"];

const REQUEST_STATUSES = ["All", "Pending", "Approved", "Partially Fulfilled", "Completed", "Rejected"];

const STATUS_STYLES = {
  "Stock IN":            { bg: "#dcfce7", color: "#166534" },
  "Stock OUT":           { bg: "#fee2e2", color: "#991b1b" },
  "Wastage":             { bg: "#fef9c3", color: "#854d0e" },
  "Fulfillment":         { bg: "#f3e8ff", color: "#7c3aed" },
  "Completed":           { bg: "#dcfce7", color: "#166534" },
  "Pending":             { bg: "#fef9c3", color: "#854d0e" },
  "Approved":            { bg: "#dbeafe", color: "#1e40af" },
  "Partially Fulfilled": { bg: "#ede9fe", color: "#7c3aed" },
  "Rejected":            { bg: "#fee2e2", color: "#991b1b" },
  "OK":                  { bg: "#dcfce7", color: "#166534" },
  "Low Stock":           { bg: "#fee2e2", color: "#991b1b" },
  "Critical":            { bg: "#fee2e2", color: "#991b1b" },
  "High":                { bg: "#fef9c3", color: "#854d0e" },
  "Medium":              { bg: "#dbeafe", color: "#1e40af" },
  "Low":                 { bg: "#dcfce7", color: "#166534" },
};

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

const fmtDate = (str) => {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const fmtDateShort = (date) => {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const fmtDateTime = (str) => {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const fmtAgo = (str) => {
  if (!str) return "—";
  const diff = Date.now() - new Date(str).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return fmtDate(str);
};

function downloadCSV(filename, rows) {
  if (!rows?.length) return false;
  try {
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h] ?? "";
            const s = String(val).replace(/"/g, '""');
            return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
          })
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error("[Reports] CSV export failed:", err);
    return false;
  }
}

const getPresetDates = (preset) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  switch (preset.type || "days") {
    case "days": {
      const end = new Date(today);
      const start = new Date(today);
      start.setDate(start.getDate() - preset.days);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "week": {
      const end = new Date(today);
      const start = new Date(today);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "month": {
      const end = new Date(today);
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "lastMonth": {
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "year": {
      const end = new Date(today);
      const start = new Date(today.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    default:
      return { start: new Date(today.getTime() - 30 * 86400000), end: today };
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   MEMOIZED SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const StatusBadge = memo(({ value }) => {
  const style = STATUS_STYLES[value] || { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: style.bg, color: style.color, whiteSpace: "nowrap", display: "inline-block",
    }}>
      {value}
    </span>
  );
});
StatusBadge.displayName = "StatusBadge";

const SummaryCard = memo(({ label, value, color, bg, icon }) => (
  <Card style={{ padding: "18px 20px", borderRadius: 14, borderLeft: `4px solid ${color}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#111827", lineHeight: 1 }}>
          {value}
        </div>
      </div>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Ic n={icon} size={18} color={color} />
      </div>
    </div>
  </Card>
));
SummaryCard.displayName = "SummaryCard";

const ActivityRow = memo(({ act }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid #f3f4f6` }}>
    <div style={{ width: 36, height: 36, borderRadius: 10, background: act.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Ic n={act.icon} size={16} color={act.color} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, color: "#111827", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {act.title}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{act.desc}</div>
      {act.detail && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{act.detail}</div>}
      {act.user && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>By: {act.user}</div>}
    </div>
    <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", flexShrink: 0, textAlign: "right" }}>
      {fmtAgo(act.date)}
    </div>
  </div>
));
ActivityRow.displayName = "ActivityRow";

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN REPORTS COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Reports() {
  const { transactions = [], requests = [], inventory = [], theme, showToast } = useApp();

  // ── Tabs ────────────────────────────────────────────────────────────────
  const [reportType, setReportType] = useState("stock");

  // ── Date range ──────────────────────────────────────────────────────────
  const [datePreset, setDatePreset] = useState("Last 30 Days");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [endDate, setEndDate] = useState(new Date());

  // ── Filters ───────────────────────────────────────────────────────────────
  const [itemFilter, setItemFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [search, setSearch] = useState("");

  // ── Reset filters on tab change ───────────────────────────────────────────
  useEffect(() => {
    setItemFilter("All");
    setTypeFilter("All");
    setStatusFilter("All");
    setDeptFilter("All");
    setSearch("");
  }, [reportType]);

  // ── Date preset handler ─────────────────────────────────────────────────
  const handleDatePresetChange = useCallback((presetLabel) => {
    setDatePreset(presetLabel);
    const preset = DATE_PRESETS.find((p) => p.label === presetLabel);
    if (preset && preset.type !== "custom") {
      const { start, end } = getPresetDates(preset);
      setStartDate(start);
      setEndDate(end);
    }
  }, []);

  const inDateRange = useCallback(
    (dateStr) => {
      if (!dateStr) return true;
      const d = new Date(dateStr).getTime();
      return d >= startDate.getTime() && d <= endDate.getTime();
    },
    [startDate, endDate]
  );

  // ── Unique values for dropdowns ───────────────────────────────────────────
  const uniqueItems = useMemo(() => {
    const set = new Set();
    if (reportType === "stock") {
      transactions.forEach((t) => { if (t.item_name || t.item) set.add(t.item_name || t.item); });
    } else if (reportType === "requests") {
      requests.forEach((r) => {
        (r.request_items || []).forEach((ri) => { if (ri.name) set.add(ri.name); });
      });
    } else if (reportType === "inventory") {
      inventory.forEach((i) => { if (i.name) set.add(i.name); });
    }
    return ["All", ...Array.from(set).sort()];
  }, [reportType, transactions, requests, inventory]);

  const uniqueDepts = useMemo(() => {
    const set = new Set();
    requests.forEach((r) => { if (r.department) set.add(r.department); });
    return ["All", ...Array.from(set).sort()];
  }, [requests]);

  // ── Filtered transactions (stock movement) ──────────────────────────────
  const filteredTransactions = useMemo(() => {
    return (transactions || [])
      .filter((t) => inDateRange(t.created_at || t.date))
      .filter((t) => itemFilter === "All" || (t.item_name || t.item) === itemFilter)
      .filter((t) => typeFilter === "All" || t.type === typeFilter)
      .filter((t) => !search || (t.item_name || t.item || "").toLowerCase().includes(search.toLowerCase()))
      .filter((t) => ["Stock IN", "Stock OUT", "Wastage", "Fulfillment"].includes(t.type));
  }, [transactions, inDateRange, itemFilter, typeFilter, search]);

  // ── Stock calculations ────────────────────────────────────────────────────
  const stockInTotal = useMemo(() =>
    filteredTransactions
      .filter((t) => t.type === "Stock IN")
      .reduce((sum, t) => sum + Math.abs(Number(t.quantity || t.qty || 0)), 0),
    [filteredTransactions]
  );

  const stockOutTotal = useMemo(() =>
    filteredTransactions
      .filter((t) => ["Stock OUT", "Wastage", "Fulfillment"].includes(t.type))
      .reduce((sum, t) => sum + Math.abs(Number(t.quantity || t.qty || 0)), 0),
    [filteredTransactions]
  );

  // ── Filtered data for table ─────────────────────────────────────────────
  const filteredData = useMemo(() => {
    let data = [];

    if (reportType === "stock") {
      data = filteredTransactions.map((t) => ({
        Date: fmtDateTime(t.created_at || t.date),
        "Movement Type": t.type || "—",
        Item: t.item_name || t.item || "—",
        Department: t.department || "—",
        Quantity: fmtNum(Math.abs(Number(t.quantity || t.qty || 0))),
        Unit: t.unit || "—",
        User: t.recorded_by_name || t.created_by_name || "—",
        Reference: t.reference || t.source || "—",
        Status: t.status || "Completed",
        Notes: t.notes || "",
      }));
    }

    else if (reportType === "requests") {
      const rows = [];
      (requests || []).forEach((req) => {
        if (!inDateRange(req.created_at || req.createdAt)) return;
        if (statusFilter !== "All" && req.status !== statusFilter) return;
        if (deptFilter !== "All" && req.department !== deptFilter) return;

        const items = req.request_items || [];
        if (items.length === 0) {
          if (itemFilter !== "All" && req.item_name !== itemFilter && req.name !== itemFilter) return;
          if (search && !(req.item_name || req.name || "").toLowerCase().includes(search.toLowerCase())) return;
          rows.push({
            Date: fmtDateTime(req.created_at || req.createdAt),
            Department: req.department || "—",
            Item: req.item_name || req.name || "—",
            Requested: fmtNum(Number(req.quantity || req.qty || 0)),
            Fulfilled: fmtNum(Number(req.fulfilled_qty || req.fulfilledQty || 0)),
            Unit: req.unit || "pcs",
            Status: req.status || "Pending",
            Priority: req.priority || "Medium",
            By: req.created_by_name || req.createdBy || "—",
            Notes: req.notes || "",
          });
        } else {
          items.forEach((ri) => {
            if (itemFilter !== "All" && ri.name !== itemFilter) return;
            if (search && !(ri.name || "").toLowerCase().includes(search.toLowerCase())) return;
            rows.push({
              Date: fmtDateTime(req.created_at || req.createdAt),
              Department: req.department || "—",
              Item: ri.name || "—",
              Requested: fmtNum(Number(ri.qty || 0)),
              Fulfilled: fmtNum(Number(ri.fulfilled_qty || 0)),
              Unit: ri.unit || "pcs",
              Status: req.status || "Pending",
              Priority: req.priority || "Medium",
              By: req.created_by_name || req.createdBy || "—",
              Notes: ri.notes || req.notes || "",
            });
          });
        }
      });
      data = rows;
    }

    else if (reportType === "inventory") {
      data = (inventory || [])
        .filter((i) => !search || (i.name || "").toLowerCase().includes(search.toLowerCase()))
        .filter((i) => itemFilter === "All" || i.name === itemFilter)
        .map((i) => ({
          Item: i.name || "—",
          Category: i.category || "—",
          Quantity: fmtNum(Number(i.quantity || 0)),
          Unit: i.unit || "pcs",
          Threshold: fmtNum(Number(i.threshold || i.min_stock || i.min_threshold || 0)),
          Status: (i.quantity || 0) <= (i.threshold || i.min_stock || i.min_threshold || 0) && (i.threshold || i.min_stock || i.min_threshold) > 0 ? "Low Stock" : "OK",
        }));
    }

    return data;
  }, [reportType, filteredTransactions, requests, inventory, inDateRange, itemFilter, statusFilter, deptFilter, search]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    if (reportType === "stock") {
      const stockInQty = filteredData
        .filter((r) => r["Movement Type"] === "Stock IN")
        .reduce((s, r) => s + Number(r.Quantity.replace(/,/g, "") || 0), 0);
      const stockOutQty = filteredData
        .filter((r) => r["Movement Type"] === "Stock OUT")
        .reduce((s, r) => s + Number(r.Quantity.replace(/,/g, "") || 0), 0);
      const wastageQty = filteredData
        .filter((r) => r["Movement Type"] === "Wastage")
        .reduce((s, r) => s + Number(r.Quantity.replace(/,/g, "") || 0), 0);
      const fulfillmentQty = filteredData
        .filter((r) => r["Movement Type"] === "Fulfillment")
        .reduce((s, r) => s + Number(r.Quantity.replace(/,/g, "") || 0), 0);
      return [
        { label: "Stock IN",    value: fmtNum(stockInQty),     color: "#22c55e", bg: "#dcfce7", icon: "PackagePlus" },
        { label: "Stock OUT",   value: fmtNum(stockOutQty),    color: "#3b82f6", bg: "#dbeafe", icon: "PackageMinus" },
        { label: "Wastage",     value: fmtNum(wastageQty),     color: "#ca8a04", bg: "#fef9c3", icon: "AlertTriangle" },
        { label: "Fulfillment", value: fmtNum(fulfillmentQty), color: "#7c3aed", bg: "#ede9fe", icon: "CheckCircle" },
      ];
    }
    if (reportType === "requests") {
      const pending = filteredData.filter((r) => r.Status === "Pending").length;
      const completed = filteredData.filter((r) => r.Status === "Completed").length;
      const rejected = filteredData.filter((r) => r.Status === "Rejected").length;
      const partial = filteredData.filter((r) => r.Status === "Partially Fulfilled").length;
      return [
        { label: "Pending",   value: pending,   color: "#ca8a04", bg: "#fef9c3", icon: "Clock" },
        { label: "Completed", value: completed, color: "#16a34a", bg: "#dcfce7", icon: "CheckCircle" },
        { label: "Rejected",  value: rejected,  color: "#dc2626", bg: "#fee2e2", icon: "XCircle" },
        { label: "Partial",   value: partial,   color: "#7c3aed", bg: "#ede9fe", icon: "PieChart" },
      ];
    }
    if (reportType === "inventory") {
      const totalItems = filteredData.length;
      const lowStock = filteredData.filter((r) => r.Status === "Low Stock").length;
      const totalQty = filteredData.reduce((s, r) => s + Number(r.Quantity.replace(/,/g, "") || 0), 0);
      return [
        { label: "Total Items", value: totalItems, color: "#2563eb", bg: "#dbeafe", icon: "Boxes" },
        { label: "Low Stock",   value: lowStock,   color: "#dc2626", bg: "#fee2e2", icon: "AlertTriangle" },
        { label: "Total Qty",   value: fmtNum(totalQty), color: "#16a34a", bg: "#dcfce7", icon: "Package" },
        { label: "Categories",  value: new Set(filteredData.map((r) => r.Category)).size, color: "#7c3aed", bg: "#ede9fe", icon: "Layers" },
      ];
    }
    return [];
  }, [reportType, filteredData]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const stockTrendData = useMemo(() => {
    if (reportType !== "stock") return [];
    const map = new Map();
    const days = 7;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      map.set(key, { date: key, in: 0, out: 0 });
    }
    filteredTransactions.forEach((t) => {
      const d = new Date(t.created_at || t.date);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (map.has(key)) {
        const entry = map.get(key);
        const qty = Math.abs(Number(t.quantity || t.qty || 0));
        if (t.type === "Stock IN") entry.in += qty;
        else if (["Stock OUT", "Wastage", "Fulfillment"].includes(t.type)) entry.out += qty;
      }
    });
    return Array.from(map.values());
  }, [reportType, filteredTransactions]);

  const requestStatusData = useMemo(() => {
    if (reportType !== "requests") return [];
    const counts = { Pending: 0, Approved: 0, "Partially Fulfilled": 0, Completed: 0, Rejected: 0 };
    (requests || []).forEach((r) => { if (counts[r.status] !== undefined) counts[r.status]++; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [reportType, requests]);

  const topItemsData = useMemo(() => {
    if (reportType !== "stock") return [];
    const map = {};
    filteredTransactions.forEach((t) => {
      const name = t.item_name || t.item || "Unknown";
      map[name] = (map[name] || 0) + Math.abs(Number(t.quantity || t.qty || 0));
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [reportType, filteredTransactions]);

  const categoryData = useMemo(() => {
    if (reportType !== "inventory") return [];
    const map = {};
    (inventory || []).forEach((i) => {
      const cat = i.category || "Uncategorized";
      map[cat] = (map[cat] || 0) + Number(i.quantity || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [reportType, inventory]);

  // ── Activity feeds ──────────────────────────────────────────────────────
  const stockInActivity = useMemo(() =>
    (transactions || [])
      .filter((t) => inDateRange(t.created_at || t.date))
      .filter((t) => t.type === "Stock IN")
      .filter((t) => itemFilter === "All" || (t.item_name || t.item) === itemFilter)
      .filter((t) => !search || (t.item_name || t.item || "").toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
      .slice(0, 8)
      .map((t) => ({
        title: t.item_name || t.item || "Unknown",
        desc: `Stock In — ${fmtNum(Math.abs(Number(t.quantity || t.qty || 0)))} ${t.unit || "pcs"}`,
        detail: t.warehouse || t.location || "Main Store",
        user: t.recorded_by_name || t.created_by_name || "—",
        date: t.created_at || t.date,
        icon: "ArrowDown",
        color: "#16a34a",
        bg: "#dcfce7",
      })),
    [transactions, inDateRange, itemFilter, search]
  );

  const stockOutActivity = useMemo(() =>
    (transactions || [])
      .filter((t) => inDateRange(t.created_at || t.date))
      .filter((t) => ["Stock OUT", "Wastage", "Fulfillment"].includes(t.type))
      .filter((t) => itemFilter === "All" || (t.item_name || t.item) === itemFilter)
      .filter((t) => !search || (t.item_name || t.item || "").toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
      .slice(0, 8)
      .map((t) => ({
        title: t.item_name || t.item || "Unknown",
        desc: `${t.type} — ${fmtNum(Math.abs(Number(t.quantity || t.qty || 0)))} ${t.unit || "pcs"}`,
        detail: t.department || t.destination || "—",
        user: t.recorded_by_name || t.created_by_name || "—",
        date: t.created_at || t.date,
        icon: "ArrowUp",
        color: t.type === "Fulfillment" ? "#7c3aed" : "#3b82f6",
        bg: t.type === "Fulfillment" ? "#ede9fe" : "#dbeafe",
      })),
    [transactions, inDateRange, itemFilter, search]
  );

  // ── Low stock alerts ────────────────────────────────────────────────────
  const lowStockList = useMemo(() =>
    (inventory || [])
      .filter((i) => {
        const qty = i.quantity || 0;
        const threshold = i.threshold || i.min_stock || i.min_threshold || 0;
        return threshold > 0 && qty <= threshold;
      })
      .sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
      .slice(0, 6),
    [inventory]
  );

  // ── Export & Reset ────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    if (!filteredData.length) {
      showToast("error", "Nothing to export", "No data matches your filters");
      return;
    }
    const typeLabel = REPORT_TYPES.find((r) => r.key === reportType)?.label || "Report";
    const filename = `${typeLabel.replace(/\s+/g, "_")}_${startDate.toISOString().split("T")[0]}_to_${endDate.toISOString().split("T")[0]}.csv`;
    const success = downloadCSV(filename, filteredData);
    if (success) {
      showToast("success", "Exported", `${filteredData.length} rows exported to CSV`);
    } else {
      showToast("error", "Export Failed", "Could not generate CSV file");
    }
  }, [filteredData, reportType, startDate, endDate, showToast]);

  const handleResetFilters = useCallback(() => {
    setDatePreset("Last 30 Days");
    const { start, end } = getPresetDates(DATE_PRESETS.find((p) => p.label === "Last 30 Days"));
    setStartDate(start);
    setEndDate(end);
    setItemFilter("All");
    setTypeFilter("All");
    setStatusFilter("All");
    setDeptFilter("All");
    setSearch("");
  }, []);

  const hasActiveFilters =
    datePreset !== "Last 30 Days" ||
    itemFilter !== "All" ||
    typeFilter !== "All" ||
    statusFilter !== "All" ||
    deptFilter !== "All" ||
    search;

  const columns = useMemo(() => {
    if (!filteredData.length) return [];
    return Object.keys(filteredData[0]);
  }, [filteredData]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 16, marginBottom: 24,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: theme.text, letterSpacing: -0.5 }}>
            Reports
          </h1>
          <p style={{ margin: "6px 0 0 0", color: theme.textMuted, fontSize: 14 }}>
            {filteredData.length} records · {fmtDateShort(startDate)} – {fmtDateShort(endDate)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="outline" onClick={() => window.print()}>
            <Ic n="Printer" size={14} /> Print
          </Btn>
          <Btn variant="primary" onClick={handleExportCSV}>
            <Ic n="Download" size={14} color="white" /> Export CSV
          </Btn>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto" }}>
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.key}
            onClick={() => setReportType(rt.key)}
            style={{
              padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700,
              border: "none", cursor: "pointer", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 8,
              background: reportType === rt.key ? rt.color : theme.bg,
              color: reportType === rt.key ? "#fff" : theme.textMuted,
              boxShadow: reportType === rt.key ? `0 4px 12px ${rt.color}40` : `0 1px 3px ${theme.border}`,
              transition: "all 0.2s ease",
            }}
          >
            <Ic n={rt.icon} size={15} color={reportType === rt.key ? "#fff" : theme.textMuted} />
            {rt.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        {summary.map((s, i) => <SummaryCard key={`${reportType}-${i}`} {...s} />)}
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 20, padding: "16px 20px", borderRadius: 14 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "end" }}>
          {/* Date Preset */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>
              Date Range
            </label>
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              style={{ padding: "9px 12px", border: `1px solid ${theme.inputBorder}`, borderRadius: 10, fontSize: 13, background: theme.inputBg, color: theme.text, minWidth: 160, fontFamily: "inherit" }}
            >
              {DATE_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>

          {/* Custom Date Range */}
          {datePreset === "Custom Range" && (
            <>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>From</label>
                <DatePicker
                  selected={startDate}
                  onChange={setStartDate}
                  dateFormat="dd MMM yyyy"
                  maxDate={endDate}
                  className="rs-datepicker"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>To</label>
                <DatePicker
                  selected={endDate}
                  onChange={setEndDate}
                  dateFormat="dd MMM yyyy"
                  minDate={startDate}
                  className="rs-datepicker"
                />
              </div>
            </>
          )}

          {/* Item Filter */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>Item</label>
            <select
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
              style={{ padding: "9px 12px", border: `1px solid ${theme.inputBorder}`, borderRadius: 10, fontSize: 13, background: theme.inputBg, color: theme.text, minWidth: 150, fontFamily: "inherit" }}
            >
              {uniqueItems.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          {/* Movement Type (stock only) */}
          {reportType === "stock" && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>Movement Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ padding: "9px 12px", border: `1px solid ${theme.inputBorder}`, borderRadius: 10, fontSize: 13, background: theme.inputBg, color: theme.text, minWidth: 150, fontFamily: "inherit" }}
              >
                {STOCK_MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {/* Status (requests only) */}
          {reportType === "requests" && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: "9px 12px", border: `1px solid ${theme.inputBorder}`, borderRadius: 10, fontSize: 13, background: theme.inputBg, color: theme.text, minWidth: 150, fontFamily: "inherit" }}
              >
                {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Dept (requests only) */}
          {reportType === "requests" && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>Department</label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                style={{ padding: "9px 12px", border: `1px solid ${theme.inputBorder}`, borderRadius: 10, fontSize: 13, background: theme.inputBg, color: theme.text, minWidth: 150, fontFamily: "inherit" }}
              >
                {uniqueDepts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          {/* Search */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>Search</label>
            <div style={{ position: "relative" }}>
              <Ic n="Search" size={14} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search records..."
                style={{
                  width: "100%", padding: "9px 12px 9px 36px", border: `1px solid ${theme.inputBorder}`,
                  borderRadius: 10, fontSize: 13, background: theme.inputBg, color: theme.text,
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              style={{ padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "#2563eb", background: "transparent", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </Card>

      {/* Charts */}
      {reportType === "stock" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, marginBottom: 18 }}>
          {/* Stock Trend */}
          <Card style={{ padding: 22, borderRadius: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
                <Ic n="Activity" size={16} color={theme.text} /> Stock Movement Trend
              </h2>
              <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#22c55e", fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} /> Stock In
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#3b82f6", fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} /> Stock Out
                </span>
              </div>
            </div>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <AreaChart data={stockTrendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12, color: theme.text }} />
                  <Area type="monotone" dataKey="in" name="Stock In" stroke="#22c55e" strokeWidth={2} fill="url(#colorIn)" dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="out" name="Stock Out" stroke="#3b82f6" strokeWidth={2} fill="url(#colorOut)" dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Quick Insights */}
          <Card style={{ padding: 22, borderRadius: 14 }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
              <Ic n="Zap" size={16} color={theme.text} /> Quick Insights
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 10, background: "#dcfce7" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>🟢 Stock In</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e" }}>{fmtNum(stockInTotal)}</div>
                <div style={{ fontSize: 12, color: "#16a34a", marginTop: 2 }}>Total Quantity</div>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: "#dbeafe" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>🔵 Stock Out</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#3b82f6" }}>{fmtNum(stockOutTotal)}</div>
                <div style={{ fontSize: 12, color: "#2563eb", marginTop: 2 }}>Total Quantity</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {reportType === "requests" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, marginBottom: 18 }}>
          <Card style={{ padding: 22, borderRadius: 14 }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
              <Ic n="BarChart" size={16} color={theme.text} /> Request Status Breakdown
            </h2>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={requestStatusData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: theme.text }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12, color: theme.text }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                    {requestStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={
                        entry.name === "Completed" ? "#16a34a" :
                        entry.name === "Pending" ? "#f59e0b" :
                        entry.name === "Approved" ? "#2563eb" :
                        entry.name === "Rejected" ? "#dc2626" : "#7c3aed"
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card style={{ padding: 22, borderRadius: 14 }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
              <Ic n="Zap" size={16} color={theme.text} /> Quick Insights
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Pending", value: requestStatusData.find((d) => d.name === "Pending")?.value || 0, color: "#f59e0b", bg: "#fef9c3" },
                { label: "Completed", value: requestStatusData.find((d) => d.name === "Completed")?.value || 0, color: "#16a34a", bg: "#dcfce7" },
                { label: "Rejected", value: requestStatusData.find((d) => d.name === "Rejected")?.value || 0, color: "#dc2626", bg: "#fee2e2" },
              ].map((ins) => (
                <div key={ins.label} style={{ padding: 14, borderRadius: 10, background: ins.bg }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ins.color, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>{ins.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: ins.color }}>{ins.value}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {reportType === "inventory" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, marginBottom: 18 }}>
          <Card style={{ padding: 22, borderRadius: 14 }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
              <Ic n="Layers" size={16} color={theme.text} /> Inventory by Category
            </h2>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: theme.text }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12, color: theme.text }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#7c3aed" barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card style={{ padding: 22, borderRadius: 14 }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
              <Ic n="AlertTriangle" size={16} color="#ef4444" /> Low Stock Alerts
            </h2>
            {lowStockList.length === 0 ? (
              <EmptyState message="All items are well stocked." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {lowStockList.map((item, idx) => {
                  const threshold = item.threshold || item.min_stock || item.min_threshold || 1;
                  const pct = Math.min(100, Math.round(((item.quantity || 0) / threshold) * 100));
                  return (
                    <div key={item.id || idx} style={{ padding: "10px 0", borderBottom: idx < lowStockList.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ fontWeight: 600, color: theme.text, fontSize: 13 }}>{item.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: pct < 30 ? "#dc2626" : "#f59e0b" }}>
                          {fmtNum(item.quantity || 0)} / {fmtNum(threshold)}
                        </div>
                      </div>
                      <div style={{ height: 5, borderRadius: 10, background: "#f1f5f9", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 10, background: pct < 30 ? "#dc2626" : "#f59e0b", transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Stock Activity + Top Items */}
      {reportType === "stock" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginBottom: 20 }}>
          {/* Stock In Activity */}
          <Card style={{ padding: 22, borderRadius: 14 }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
              <Ic n="PackagePlus" size={16} color="#16a34a" /> Stock In Activity
            </h2>
            {stockInActivity.length === 0 ? (
              <EmptyState message="No stock in activity." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {stockInActivity.map((act, idx) => <ActivityRow key={`in-${idx}`} act={act} />)}
              </div>
            )}
          </Card>

          {/* Stock Out Activity */}
          <Card style={{ padding: 22, borderRadius: 14 }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
              <Ic n="PackageMinus" size={16} color="#3b82f6" /> Stock Out Activity
            </h2>
            {stockOutActivity.length === 0 ? (
              <EmptyState message="No stock out activity." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {stockOutActivity.map((act, idx) => <ActivityRow key={`out-${idx}`} act={act} />)}
              </div>
            )}
          </Card>

          {/* Top Moving Items */}
          <Card style={{ padding: 22, borderRadius: 14 }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
              <Ic n="TrendingUp" size={16} color={theme.text} /> Top Moving Items
            </h2>
            {topItemsData.length === 0 && <EmptyState message="No item movement found." />}
            {topItemsData.map((item, idx) => (
              <div key={item.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: idx < topItemsData.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: idx < 3 ? "#fef3c7" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: idx < 3 ? "#d97706" : "#94a3b8", flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  <div style={{ fontWeight: 600, color: theme.text, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
                </div>
                <div style={{ fontWeight: 700, color: theme.text, fontSize: 13, whiteSpace: "nowrap", marginLeft: 8 }}>{fmtNum(item.value)}</div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Data Table */}
      <Card style={{ padding: 0, borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
            <Ic n="List" size={16} color={theme.text} /> {REPORT_TYPES.find((r) => r.key === reportType)?.label}
          </h2>
          <span style={{ fontSize: 12, color: theme.textMuted }}>{filteredData.length} records</span>
        </div>

        {filteredData.length === 0 ? (
          <EmptyState icon="FileText" title="No records found" message="Try adjusting your date range or filters." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: theme.bg }}>
                  {columns.map((col) => (
                    <th key={col} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: "nowrap", letterSpacing: 0.5, textTransform: "uppercase" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => (
                  <tr key={row.id || `row-${idx}`} style={{ borderBottom: `1px solid ${theme.border}`, background: idx % 2 === 0 ? "transparent" : theme.bg }}>
                    {columns.map((col) => (
                      <td key={col} style={{ padding: "10px 16px", color: theme.text, fontWeight: col === "Item" ? 600 : 400, whiteSpace: "nowrap" }}>
                        {col === "Status" || col === "Priority" || col === "Movement Type" ? <StatusBadge value={row[col]} /> : row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "16px 0", color: theme.textMuted, fontSize: 12 }}>
        Stocko Reports • Auto-generated from inventory data
      </div>
    </div>
  );
}
