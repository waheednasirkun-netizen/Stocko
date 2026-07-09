
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from "recharts";
import { useApp } from "../context/AppContext";
import { Ic, Card, EmptyState, Btn } from "../components/ui";
import { fmtNum } from "../lib/constants";

/* ═══════════════════════════════════════════════════════════
   COLOR SYSTEM
═══════════════════════════════════════════════════════════ */
const COLORS = {
  primary: "#2563EB",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
  purple: "#7C3AED",
  pink: "#EC4899",
  teal: "#14B8A6",
  slate: "#64748B",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
};

const STATUS_COLORS = {
  Pending: { bg: "#FEF3C7", color: "#92400E", dot: "#F59E0B" },
  Approved: { bg: "#DBEAFE", color: "#1E40AF", dot: "#3B82F6" },
  "Partially Fulfilled": { bg: "#EDE9FE", color: "#5B21B6", dot: "#7C3AED" },
  Completed: { bg: "#D1FAE5", color: "#065F46", dot: "#22C55E" },
  Rejected: { bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
  Critical: { bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
  High: { bg: "#FEF9C3", color: "#854D0E", dot: "#F59E0B" },
  Medium: { bg: "#DBEAFE", color: "#1E40AF", dot: "#3B82F6" },
  Low: { bg: "#DCFEE7", color: "#166534", dot: "#22C55E" },
  Good: { bg: "#D1FAE5", color: "#065F46", dot: "#22C55E" },
  "Low Stock": { bg: "#FEF3C7", color: "#92400E", dot: "#F59E0B" },
  "Out of Stock": { bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
};

/* ═══════════════════════════════════════════════════════════
   SPARKLINE COMPONENT (mini line chart for KPI cards)
═══════════════════════════════════════════════════════════ */
function Sparkline({ data, color = COLORS.primary, width = 80, height = 30 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * height,
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={2.5} fill={color} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   STATUS BADGE COMPONENT
═══════════════════════════════════════════════════════════ */
function StatusBadge({ status, size = "sm" }) {
  const style = STATUS_COLORS[status] || STATUS_COLORS["Pending"];
  const padding = size === "sm" ? "2px 8px" : "4px 12px";
  const fontSize = size === "sm" ? 11 : 12;
  return (
    <span style={{
      padding,
      borderRadius: 6,
      fontSize,
      fontWeight: 600,
      background: style.bg,
      color: style.color,
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: style.dot, display: "inline-block" }} />
      {status}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   ANIMATED COUNTER
═══════════════════════════════════════════════════════════ */
function AnimatedCounter({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
    if (isNaN(target)) { setDisplay(value); return; }
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);
  return <span>{typeof value === "string" && value.includes(",") ? fmtNum(display) : display}</span>;
}

/* ═══════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const {
    requests = [],
    inventory = [],
    transactions = [],
    theme,
    user,
    setTab,
    showToast,
  } = useApp();

  const [timeRange, setTimeRange] = useState("7d");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  /* ── Time calculations ── */
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const daysBack = useMemo(() => ({ "24h": 1, "7d": 7, "30d": 30, "90d": 90 }[timeRange] || 7), [timeRange]);
  const cutoffDate = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - daysBack); return d; }, [daysBack]);

  /* ── Filtered data ── */
  const todayTxns = useMemo(() => (transactions || []).filter(t => {
    const d = new Date(t.created_at || t.date);
    return d >= todayStart && d <= todayEnd;
  }), [transactions]);

  const recentTxns = useMemo(() => (transactions || []).filter(t => {
    const d = new Date(t.created_at || t.date);
    return d >= cutoffDate;
  }), [transactions, cutoffDate]);

  const pendingReqs = useMemo(() => (requests || []).filter(r => r.status === "Pending" || r.status === "Approved" || r.status === "Partially Fulfilled"), [requests]);
  const completedReqs = useMemo(() => (requests || []).filter(r => r.status === "Completed"), [requests]);
  const rejectedReqs = useMemo(() => (requests || []).filter(r => r.status === "Rejected"), [requests]);

  const lowStock = useMemo(() => (inventory || []).filter(i => i.status === "Low Stock" || ((i.quantity || 0) <= (i.threshold || i.min_stock || 0) && (i.quantity || 0) > 0)), [inventory]);
  const criticalStock = useMemo(() => (inventory || []).filter(i => i.status === "Critical" || (i.quantity || 0) === 0), [inventory]);
  const outOfStock = useMemo(() => (inventory || []).filter(i => (i.quantity || 0) === 0), [inventory]);

  /* ── KPI Data ── */
  const kpiData = useMemo(() => {
    const stockInToday = todayTxns.filter(t => t.type === "Stock IN").reduce((s, t) => s + Math.abs(Number(t.quantity || t.qty || 0)), 0);
    const stockOutToday = todayTxns.filter(t => t.type === "Stock OUT" || t.type === "Wastage").reduce((s, t) => s + Math.abs(Number(t.quantity || t.qty || 0)), 0);
    const totalItems = (inventory || []).length;
    const totalQty = (inventory || []).reduce((s, i) => s + Number(i.quantity || 0), 0);

    // Generate sparkline data from recent transactions
    const sparkData = (type) => {
      const map = new Map();
      for (let i = daysBack - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        map.set(d.toDateString(), 0);
      }
      recentTxns.filter(t => t.type === type).forEach(t => {
        const d = new Date(t.created_at || t.date);
        const key = d.toDateString();
        if (map.has(key)) map.set(key, map.get(key) + Math.abs(Number(t.quantity || t.qty || 0)));
      });
      return Array.from(map.values());
    };

    return [
      { label: "Items In Stock", value: totalItems, sub: `${fmtNum(totalQty)} total units`, icon: "Boxes", color: COLORS.primary, bg: "#EFF6FF", spark: sparkData("Stock IN"), trend: "up" },
      { label: "Low Stock", value: lowStock.length, sub: "need reorder", icon: "AlertTriangle", color: COLORS.warning, bg: "#FEF9C3", spark: null, trend: "alert" },
      { label: "Out of Stock", value: outOfStock.length, sub: "critical", icon: "XCircle", color: COLORS.danger, bg: "#FEE2E2", spark: null, trend: "down" },
      { label: "Pending Requests", value: pendingReqs.length, sub: "need action", icon: "Clock", color: COLORS.warning, bg: "#FEF3C7", spark: null, trend: "alert" },
      { label: "Completed Today", value: completedReqs.filter(r => { const d = new Date(r.created_at || r.createdAt); return d >= todayStart; }).length, sub: "requests fulfilled", icon: "CheckCircle", color: COLORS.success, bg: "#D1FAE5", spark: null, trend: "up" },
      { label: "Stock IN Today", value: stockInToday, sub: "units received", icon: "ArrowDown", color: COLORS.success, bg: "#DCFEE7", spark: sparkData("Stock IN"), trend: "up" },
      { label: "Stock OUT Today", value: stockOutToday, sub: "units dispatched", icon: "ArrowUp", color: COLORS.danger, bg: "#FEE2E2", spark: sparkData("Stock OUT"), trend: "down" },
      { label: "Rejected", value: rejectedReqs.length, sub: "requests denied", icon: "Ban", color: COLORS.slate, bg: "#F3F4F6", spark: null, trend: "neutral" },
    ];
  }, [inventory, todayTxns, recentTxns, pendingReqs, completedReqs, rejectedReqs, lowStock, outOfStock, daysBack]);

  /* ── Inventory Health ── */
  const healthData = useMemo(() => {
    const total = (inventory || []).length || 1;
    const good = (inventory || []).filter(i => (i.quantity || 0) > (i.threshold || i.min_stock || 0)).length;
    const low = lowStock.length;
    const critical = criticalStock.length;
    const out = outOfStock.length;
    return [
      { label: "Healthy", value: good, pct: Math.round((good / total) * 100), color: COLORS.success },
      { label: "Low Stock", value: low, pct: Math.round((low / total) * 100), color: COLORS.warning },
      { label: "Critical", value: critical, pct: Math.round((critical / total) * 100), color: COLORS.danger },
      { label: "Out of Stock", value: out, pct: Math.round((out / total) * 100), color: "#7F1D1D" },
    ];
  }, [inventory, lowStock, criticalStock, outOfStock]);

  /* ── Chart Data: Stock Trend ── */
  const stockTrendData = useMemo(() => {
    const map = new Map();
    for (let i = daysBack - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      map.set(key, { date: key, in: 0, out: 0 });
    }
    recentTxns.forEach(t => {
      const d = new Date(t.created_at || t.date);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (map.has(key)) {
        const qty = Math.abs(Number(t.quantity || t.qty || 0));
        if (t.type === "Stock IN") map.get(key).in += qty;
        else if (t.type === "Stock OUT" || t.type === "Wastage") map.get(key).out += qty;
      }
    });
    return Array.from(map.values());
  }, [recentTxns, daysBack]);

  /* ── Chart Data: Category Distribution ── */
  const categoryData = useMemo(() => {
    const map = {};
    (inventory || []).forEach(i => {
      const cat = i.category || "Uncategorized";
      map[cat] = (map[cat] || 0) + Number(i.quantity || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
  }, [inventory]);

  /* ── Chart Data: Request Status ── */
  const requestStatusData = useMemo(() => {
    const counts = { Pending: 0, Approved: 0, "Partially Fulfilled": 0, Completed: 0, Rejected: 0 };
    (requests || []).forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [requests]);

  /* ── Chart Data: Top Requested Items ── */
  const topRequestedData = useMemo(() => {
    const map = {};
    (requests || []).forEach(r => {
      (r.request_items || []).forEach(ri => {
        const name = ri.name || r.item_name || r.name || "Unknown";
        map[name] = (map[name] || 0) + Number(ri.qty || r.quantity || r.qty || 0);
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [requests]);

  /* ── Recent Activity ── */
  const activityFeed = useMemo(() => {
    const items = [
      ...(transactions || []).map(t => ({
        type: "transaction",
        title: t.type,
        desc: `${t.item_name || t.item || "Item"} — ${fmtNum(Math.abs(Number(t.quantity || t.qty || 0)))} ${t.unit || ""}`,
        time: t.created_at || t.date,
        icon: t.type === "Stock IN" ? "ArrowDown" : t.type === "Stock OUT" ? "ArrowUp" : "AlertTriangle",
        color: t.type === "Stock IN" ? COLORS.success : t.type === "Stock OUT" ? COLORS.danger : COLORS.warning,
        bg: t.type === "Stock IN" ? "#DCFEE7" : t.type === "Stock OUT" ? "#FEE2E2" : "#FEF9C3",
      })),
      ...(requests || []).map(r => ({
        type: "request",
        title: `Request ${r.status}`,
        desc: `${r.department || "Dept"} — ${r.item_name || r.name || "Item"}`,
        time: r.created_at || r.createdAt,
        icon: r.status === "Completed" ? "CheckCircle" : r.status === "Rejected" ? "XCircle" : "Clock",
        color: r.status === "Completed" ? COLORS.success : r.status === "Rejected" ? COLORS.danger : COLORS.warning,
        bg: r.status === "Completed" ? "#DCFEE7" : r.status === "Rejected" ? "#FEE2E2" : "#FEF3C7",
      })),
    ];
    return items.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);
  }, [transactions, requests]);

  /* ── Quick Actions ── */
  const quickActions = [
    {
      label: "Create Demand",
      icon: "Plus",
      color: COLORS.primary,
      onClick: () => setTab("demands"),
    },
    {
      label: "Stock IN",
      icon: "ArrowDown",
      color: COLORS.success,
      onClick: () => setTab("stock-movement"),
    },
    {
      label: "Stock OUT",
      icon: "ArrowUp",
      color: COLORS.danger,
      onClick: () => setTab("stock-movement"),
    },
    {
      label: "View Reports",
      icon: "BarChart",
      color: COLORS.purple,
      onClick: () => setTab("reports"),
    },
    {
      label: "Fulfillment",
      icon: "Package",
      color: COLORS.teal,
      onClick: () => setTab("fulfillment-center"),  // ← FIXED
    },
    {
      label: "Inventory",
      icon: "Boxes",
      color: COLORS.info,
      onClick: () => setTab("inventory"),
    },
  ];

  /* ── Format helpers ── */
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
    return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1440, margin: "0 auto" }}>
      {/* ═══════════════════════════════════════════════════
            HEADER / WELCOME
      ═══════════════════════════════════════════════════ */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        flexWrap: "wrap", gap: 20, marginBottom: 28, padding: "0 4px"
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: theme.text, letterSpacing: -0.8 }}>
            {greeting()}, {user?.name || user?.email?.split("@")[0] || "Officer"}
          </h1>
          <p style={{ margin: "6px 0 0 0", color: theme.textMuted, fontSize: 14, fontWeight: 500 }}>
            {user?.role || "Inventory Officer"} · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Time Range */}
          <div style={{
            display: "flex", gap: 2, padding: 3, background: theme.bg,
            borderRadius: 10, border: `1px solid ${theme.border}`
          }}>
            {[
              { key: "24h", label: "24H" },
              { key: "7d", label: "7D" },
              { key: "30d", label: "30D" },
              { key: "90d", label: "90D" },
            ].map(r => (
              <button key={r.key} onClick={() => setTimeRange(r.key)} style={{
                padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12,
                fontWeight: 700, cursor: "pointer", background: timeRange === r.key ? COLORS.primary : "transparent",
                color: timeRange === r.key ? "#fff" : theme.textMuted, transition: "all 0.15s ease",
              }}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
            QUICK ACTIONS
      ═══════════════════════════════════════════════════ */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 10, marginBottom: 24, padding: "0 4px"
      }}>
        {quickActions.map((action, i) => (
          <button key={i} onClick={action.onClick} style={{
            padding: "14px 16px", borderRadius: 12, border: `1px solid ${theme.border}`,
            background: theme.card, cursor: "pointer", display: "flex", alignItems: "center",
            gap: 10, transition: "all 0.2s ease", fontFamily: "inherit",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = action.color; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${action.color}20`; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: `${action.color}15`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Ic n={action.icon} size={16} color={action.color} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{action.label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════
            KPI CARDS
      ═══════════════════════════════════════════════════ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 16, marginBottom: 24, padding: "0 4px"
      }}>
        {kpiData.map((kpi, i) => (
          <Card key={kpi.label} style={{
            padding: "20px 22px", borderRadius: 14, border: `1px solid ${theme.border}`,
            opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)",
            transition: `all 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.06}s`,
            cursor: "pointer", position: "relative", overflow: "hidden",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = kpi.color; e.currentTarget.style.boxShadow = `0 4px 20px ${kpi.color}15`; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.boxShadow = "none"; }}
          >
            {/* Top accent line */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: `linear-gradient(90deg, ${kpi.color}, ${kpi.color}60)`, borderRadius: "14px 14px 0 0",
            }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, color: theme.text, lineHeight: 1, letterSpacing: -0.5 }}>
                  <AnimatedCounter value={kpi.value} />
                </div>
                {kpi.sub && (
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 6, fontWeight: 500 }}>
                    {kpi.sub}
                  </div>
                )}
              </div>
              <div style={{
                width: 42, height: 42, borderRadius: 10, background: kpi.bg,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Ic n={kpi.icon} size={20} color={kpi.color} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              {kpi.trend && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                  background: kpi.trend === "up" ? "#DCFEE7" : kpi.trend === "down" ? "#FEE2E2" : kpi.trend === "alert" ? "#FEF3C7" : "#F3F4F6",
                  color: kpi.trend === "up" ? "#166534" : kpi.trend === "down" ? "#991B1B" : kpi.trend === "alert" ? "#92400E" : "#374151",
                }}>
                  {kpi.trend === "up" ? "▲" : kpi.trend === "down" ? "▼" : kpi.trend === "alert" ? "!" : "•"} {kpi.trend === "up" ? "Rising" : kpi.trend === "down" ? "Falling" : kpi.trend === "alert" ? "Alert" : "Stable"}
                </span>
              )}
              {kpi.spark && kpi.spark.length > 1 && (
                <Sparkline data={kpi.spark} color={kpi.color} />
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════
            MAIN GRID: CHARTS + SIDE PANELS
      ═══════════════════════════════════════════════════ */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 340px", gap: 20,
        marginBottom: 20, padding: "0 4px"
      }} className="dashboard-grid">

        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Stock Trend Chart */}
          <Card style={{ padding: 24, borderRadius: 14, border: `1px solid ${theme.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
                <Ic n="Activity" size={18} color={theme.text} /> Stock Movement Trend
              </h2>
              <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, color: COLORS.success, fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.success }} /> Stock IN
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, color: COLORS.danger, fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.danger }} /> Stock OUT
                </span>
              </div>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <AreaChart data={stockTrendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.danger} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={COLORS.danger} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{
                    background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10,
                    fontSize: 12, color: theme.text, boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }} />
                  <Area type="monotone" dataKey="in" stroke={COLORS.success} strokeWidth={2.5} fill="url(#gradIn)" dot={{ r: 3, fill: COLORS.success, strokeWidth: 0 }} activeDot={{ r: 5, stroke: COLORS.success, strokeWidth: 2, fill: "#fff" }} />
                  <Area type="monotone" dataKey="out" stroke={COLORS.danger} strokeWidth={2.5} fill="url(#gradOut)" dot={{ r: 3, fill: COLORS.danger, strokeWidth: 0 }} activeDot={{ r: 5, stroke: COLORS.danger, strokeWidth: 2, fill: "#fff" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Bottom Row: Request Status + Top Items */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Request Status */}
            <Card style={{ padding: 24, borderRadius: 14, border: `1px solid ${theme.border}` }}>
              <h2 style={{ margin: "0 0 18px 0", fontSize: 16, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
                <Ic n="BarChart" size={18} color={theme.text} /> Request Status
              </h2>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={requestStatusData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.border} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: theme.text }} axisLine={false} tickLine={false} width={120} />
                    <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12, color: theme.text }} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                      {requestStatusData.map((entry, index) => (
                        <Cell key={index} fill={
                          entry.name === "Completed" ? COLORS.success :
                          entry.name === "Pending" ? COLORS.warning :
                          entry.name === "Approved" ? COLORS.primary :
                          entry.name === "Rejected" ? COLORS.danger : COLORS.purple
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Top Requested Items */}
            <Card style={{ padding: 24, borderRadius: 14, border: `1px solid ${theme.border}` }}>
              <h2 style={{ margin: "0 0 18px 0", fontSize: 16, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
                <Ic n="TrendingUp" size={18} color={theme.text} /> Top Requested
              </h2>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={topRequestedData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: theme.textMuted }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={45} />
                    <YAxis tick={{ fontSize: 11, fill: theme.textMuted }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12, color: theme.text }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} fill={COLORS.primary} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Pending Requests Table */}
          <Card style={{ padding: 0, borderRadius: 14, border: `1px solid ${theme.border}`, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
                <Ic n="Clock" size={18} color={theme.text} /> Pending Requests
                <span style={{
                  marginLeft: 6, padding: "2px 8px", borderRadius: 10, fontSize: 11,
                  fontWeight: 700, background: COLORS.warning + "20", color: COLORS.warning,
                }}>{pendingReqs.length}</span>
              </h2>
              <button onClick={() => setTab("fulfillment")} style={{
                fontSize: 12, color: COLORS.primary, background: "none", border: "none",
                cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
              }}>
                View all <Ic n="ArrowRight" size={12} color={COLORS.primary} />
              </button>
            </div>
            {pendingReqs.length === 0 ? (
              <EmptyState icon="Inbox" title="No pending requests" message="All caught up!" />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: theme.bg }}>
                      {["Department", "Item", "Qty", "Priority", "Status", "Time"].map(h => (
                        <th key={h} style={{
                          padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700,
                          color: theme.textMuted, borderBottom: `1px solid ${theme.border}`,
                          whiteSpace: "nowrap", letterSpacing: 0.5, textTransform: "uppercase",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingReqs.slice(0, 6).map((req, idx) => {
                      const itemName = req.item_name || req.name || "—";
                      const qty = req.quantity || req.qty || 0;
                      const unit = req.unit || "pcs";
                      return (
                        <tr key={req.id || idx} style={{
                          borderBottom: `1px solid ${theme.border}`,
                          background: idx % 2 === 0 ? "transparent" : theme.bg,
                          transition: "background 0.1s ease",
                        }}>
                          <td style={{ padding: "10px 16px", color: theme.text, fontWeight: 600, whiteSpace: "nowrap" }}>{req.department || "—"}</td>
                          <td style={{ padding: "10px 16px", color: theme.text, whiteSpace: "nowrap" }}>{itemName}</td>
                          <td style={{ padding: "10px 16px", color: theme.text, fontWeight: 600, whiteSpace: "nowrap" }}>{fmtNum(qty)} {unit}</td>
                          <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}><StatusBadge status={req.priority || "Medium"} /></td>
                          <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}><StatusBadge status={req.status || "Pending"} /></td>
                          <td style={{ padding: "10px 16px", color: theme.textMuted, fontSize: 12, whiteSpace: "nowrap" }}>{fmtAgo(req.created_at || req.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Inventory Health */}
          <Card style={{ padding: 24, borderRadius: 14, border: `1px solid ${theme.border}` }}>
            <h2 style={{ margin: "0 0 18px 0", fontSize: 16, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
              <Ic n="Heart" size={18} color={theme.text} /> Inventory Health
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {healthData.map((h, i) => (
                <div key={h.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: h.color, display: "inline-block" }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{h.label}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: h.color }}>{h.value} ({h.pct}%)</div>
                  </div>
                  <div style={{ height: 8, borderRadius: 10, background: "#F1F5F9", overflow: "hidden" }}>
                    <div style={{
                      width: `${h.pct}%`, height: "100%", borderRadius: 10, background: h.color,
                      transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Category Distribution */}
          <Card style={{ padding: 24, borderRadius: 14, border: `1px solid ${theme.border}` }}>
            <h2 style={{ margin: "0 0 18px 0", fontSize: 16, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
              <Ic n="PieChart" size={18} color={theme.text} /> By Category
            </h2>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                    {categoryData.map((entry, index) => (
                      <Cell key={index} fill={[COLORS.primary, COLORS.success, COLORS.warning, COLORS.purple, COLORS.teal][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12, color: theme.text }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", marginTop: 8, justifyContent: "center" }}>
              {categoryData.map((cat, i) => (
                <div key={cat.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: theme.textMuted }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: [COLORS.primary, COLORS.success, COLORS.warning, COLORS.purple, COLORS.teal][i % 5] }} />
                  {cat.name}
                </div>
              ))}
            </div>
          </Card>

          {/* Low Stock Alerts */}
          <Card style={{ padding: 24, borderRadius: 14, border: `1px solid ${theme.border}` }}>
            <h2 style={{ margin: "0 0 14px 0", fontSize: 16, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
              <Ic n="AlertTriangle" size={18} color={COLORS.danger} /> Low Stock
            </h2>
            {lowStock.length === 0 && criticalStock.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 13, color: COLORS.success, fontWeight: 600 }}>All items well-stocked ✓</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {[...criticalStock, ...lowStock].slice(0, 6).map((item, idx) => {
                  const max = item.threshold || item.min_stock || 1;
                  const current = item.quantity || 0;
                  const pct = Math.max(0, Math.min(100, Math.round((current / max) * 100)));
                  const isCritical = current === 0 || (current / max) < 0.3;
                  return (
                    <div key={item.id || idx} style={{ padding: "10px 0", borderBottom: idx < 5 ? `1px solid ${theme.border}` : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{item.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: isCritical ? COLORS.danger : COLORS.warning }}>
                          {fmtNum(current)} / {fmtNum(max)}
                        </span>
                      </div>
                      <div style={{ height: 5, borderRadius: 10, background: "#F1F5F9", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 10, background: isCritical ? COLORS.danger : COLORS.warning, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
            ACTIVITY TIMELINE
      ═══════════════════════════════════════════════════ */}
      <Card style={{ padding: 24, borderRadius: 14, border: `1px solid ${theme.border}`, marginBottom: 20, margin: "0 4px 20px 4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", gap: 8 }}>
            <Ic n="Clock" size={18} color={theme.text} /> Recent Activity
          </h2>
          <button onClick={() => setTab("reports")} style={{
            fontSize: 12, color: COLORS.primary, background: "none", border: "none",
            cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
          }}>
            View all <Ic n="ArrowRight" size={12} color={COLORS.primary} />
          </button>
        </div>
        {activityFeed.length === 0 ? (
          <EmptyState icon="Clock" title="No recent activity" message="Activity will appear here." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {activityFeed.map((act, idx) => (
              <div key={idx} style={{
                display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 10,
                background: theme.bg, border: `1px solid ${theme.border}`, transition: "all 0.2s ease",
                cursor: "default",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = act.color; e.currentTarget.style.transform = "translateX(4px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.transform = "translateX(0)"; }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: act.bg,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Ic n={act.icon} size={18} color={act.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: theme.text, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {act.title}
                  </div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {act.desc}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: theme.textMuted, whiteSpace: "nowrap", flexShrink: 0, fontWeight: 500 }}>
                  {fmtAgo(act.time)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
