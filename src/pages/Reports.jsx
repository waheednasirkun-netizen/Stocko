import { useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import {
  PieChart,
  Pie,
 Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useApp } from "../context/AppContext";
import { Card, Ic, EmptyState } from "../components/ui";
import { fmtNum, fmtPKR } from "../lib/constants";

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
];

export default function Reports() {

  const {
  transactions = [],
  demands = [],
  financialTransactions = [],
  theme,
} = useApp();

  /* ============================
      DATE FILTER
  ============================ */

  const [startDate, setStartDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30))
  );

  const [endDate, setEndDate] = useState(
    new Date()
  );

  /* ============================
      FILTER TRANSACTIONS
  ============================ */

 const filteredTransactions = useMemo(() => {
  return (transactions ?? []).filter((t) => {
    if (!t?.date) return false;

    const txDate = new Date(t.date);

    return (
      txDate >= startDate &&
      txDate <= endDate
    );
  });
}, [transactions, startDate, endDate]);

  /* ============================
      SUMMARY
  ============================ */

  const stockIn = filteredTransactions.filter(
    t => t.type === "Stock IN"
  );

  const stockOut = filteredTransactions.filter(
    t =>
      t.type === "Stock OUT" ||
      t.type === "Wastage"
  );

  const totalSpend =
    financialTransactions
      .filter(f => f.type === "purchase")
      .reduce(
        (sum, f) =>
          sum +
          Number(
            f.total_amount ||
            f.totalAmount ||
            0
          ),
        0
      );

  const unpaid =
    financialTransactions
      .filter(
        f =>
          f.payment_status === "unpaid" ||
          f.paymentStatus === "unpaid"
      )
      .reduce(
        (sum, f) =>
          sum +
          Number(
            f.total_amount ||
            f.totalAmount ||
            0
          ),
        0
      );

  /* ============================
      PIE CHART
  ============================ */

  const pieData = [
    {
      name: "Stock IN",
      value: stockIn.length,
    },
    {
      name: "Stock OUT",
      value: stockOut.length,
    },
    {
      name: "Demand",
      value: demands.length,
    },
  ];

  /* ============================
      DASHBOARD CARDS
  ============================ */

  const stats = [

    {
      label: "Transactions",
      value: filteredTransactions.length,
      icon: "ArrowLeftRight",
      bg: "#dbeafe",
      color: "#2563eb",
    },

    {
      label: "Stock IN",
      value: stockIn.length,
      icon: "TrendingUp",
      bg: "#dcfce7",
      color: "#16a34a",
    },

    {
      label: "Stock OUT",
      value: stockOut.length,
      icon: "TrendingDown",
      bg: "#fef3c7",
      color: "#d97706",
    },

  

  ];

  /* ============================
      TOP ITEMS
  ============================ */

  const topItems = useMemo(() => {

    const counts = {};

    filteredTransactions.forEach((t) => {

      const key =
        t.item_name ||
        t.item ||
        "";

      if (!key) return;

      counts[key] =
        (counts[key] || 0) +
        Math.abs(
          Number(
            t.quantity ||
            t.qty ||
            0
          )
        );

    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

  }, [filteredTransactions]);

  /* ============================
      EXPORT CSV
  ============================ */

  const exportCSV = () => {

    if (!filteredTransactions.length) {

      alert("No records found.");

      return;

    }

    const rows =
      filteredTransactions.map((t) => ({

        Item:
          t.item_name ||
          t.item,

        Type:
          t.type,

        Quantity:
          t.quantity ||
          t.qty,

        Date:
          t.date,

      }));

    const csv = [

      Object.keys(rows[0]).join(","),

      ...rows.map((r) =>
        Object.values(r).join(",")
      ),

    ].join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      "Inventory_Report.csv";

    a.click();

    URL.revokeObjectURL(url);

  };

  return (
    <div className="animate-fade-in">
      {/* ==========================
            HEADER
      ========================== */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 20,
          marginBottom: 30,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 800,
              color: theme.text,
            }}
          >
            📊 Reports Dashboard
          </h1>

          <p
            style={{
              marginTop: 8,
              color: theme.textMuted,
              fontSize: 15,
            }}
          >
            Monitor inventory activity, stock movement and financial performance.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 15,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Date Filter */}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 15,
              padding: "10px 18px",
              borderRadius: 14,
              background: theme.card,
              border: `1px solid ${theme.border}`,
              boxShadow: "0 4px 15px rgba(0,0,0,.05)",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: theme.textMuted,
                  marginBottom: 4,
                }}
              >
                From
              </div>

              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                dateFormat="dd MMM yyyy"
              />
            </div>

            <div
              style={{
                fontSize: 20,
                color: "#94a3b8",
              }}
            >
              →
            </div>

            <div>
              <div
                style={{
                  fontSize: 11,
                  color: theme.textMuted,
                  marginBottom: 4,
                }}
              >
                To
              </div>

              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                dateFormat="dd MMM yyyy"
              />
            </div>
          </div>

          {/* Export Button */}

          <button
            onClick={exportCSV}
            style={{
              border: "none",
              background: "#2563eb",
              color: "#fff",
              padding: "12px 22px",
              borderRadius: 14,
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 15,
              boxShadow: "0 10px 25px rgba(37,99,235,.25)",
            }}
          >
            ⬇ Export Report
          </button>
        </div>
      </div>

      {/* ==========================
            STAT CARDS
      ========================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 20,
          marginBottom: 35,
        }}
      >
        {stats.map((card) => (
          <Card
            key={card.label}
            style={{
              padding: 24,
              borderRadius: 18,
              transition: ".25s",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    color: theme.textMuted,
                    fontSize: 13,
                    marginBottom: 10,
                  }}
                >
                  {card.label}
                </div>

                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: theme.text,
                  }}
                >
                  {card.value}
                </div>
              </div>

              <div
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 18,
                  background: card.bg,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ic
                  n={card.icon}
                  size={28}
                  color={card.color}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                height: 8,
                borderRadius: 30,
                background: "#edf2f7",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${50 + Math.random() * 45}%`,
                  height: "100%",
                  background: card.color,
                  borderRadius: 30,
                }}
              />
            </div>
          </Card>
        ))}
      </div>
            {/* ==========================
            RECENT ACTIVITY
      ========================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 20,
          marginBottom: 35,
        }}
      >
        {/* Recent Transactions */}
        <Card
          style={{
            padding: 20,
            borderRadius: 18,
          }}
        >
          <h2
            style={{
              marginBottom: 15,
              fontSize: 18,
              fontWeight: 700,
              color: theme.text,
            }}
          >
            🕒 Recent Activity
          </h2>

          {filteredTransactions.length === 0 ? (
            <EmptyState message="No activity found in this date range." />
          ) : (
            filteredTransactions
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.date) - new Date(a.date)
              )
              .slice(0, 10)
              .map((t, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: `1px solid ${theme.border}`,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: theme.text,
                        fontSize: 14,
                      }}
                    >
                      {t.item_name || t.item || "Unknown Item"}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: theme.textMuted,
                        marginTop: 4,
                      }}
                    >
                      {t.type} • {new Date(t.date).toLocaleDateString()}
                    </div>
                  </div>

                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color:
                        t.type === "Stock IN"
                          ? "#16a34a"
                          : t.type === "Stock OUT"
                          ? "#dc2626"
                          : "#f59e0b",
                    }}
                  >
                    {t.quantity || t.qty}
                  </div>
                </div>
              ))
          )}
        </Card>

        {/* Top Moving Items */}
        <Card
          style={{
            padding: 20,
            borderRadius: 18,
          }}
        >
          <h2
            style={{
              marginBottom: 15,
              fontSize: 18,
              fontWeight: 700,
              color: theme.text,
            }}
          >
            🔥 Top Moving Items
          </h2>

          {topItems.length === 0 ? (
            <EmptyState message="No item movement found." />
          ) : (
            topItems.map(([name, qty], index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderBottom: `1px solid ${theme.border}`,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "#e0f2fe",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#0369a1",
                    }}
                  >
                    {index + 1}
                  </div>

                  <div
                    style={{
                      fontWeight: 600,
                      color: theme.text,
                      fontSize: 14,
                    }}
                  >
                    {name}
                  </div>
                </div>

                <div
                  style={{
                    fontWeight: 800,
                    color: theme.text,
                    fontSize: 14,
                  }}
                >
                  {qty}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
            {/* ==========================
            PIE CHART + SUMMARY
      ========================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 20,
          marginBottom: 40,
        }}
      >
        {/* PIE CHART */}
        <Card
          style={{
            padding: 20,
            borderRadius: 18,
          }}
        >
          <h2
            style={{
              marginBottom: 15,
              fontSize: 18,
              fontWeight: 700,
              color: theme.text,
            }}
          >
            📊 Stock Distribution
          </h2>

          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>

                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* QUICK INSIGHT PANEL */}
        <Card
          style={{
            padding: 20,
            borderRadius: 18,
          }}
        >
          <h2
            style={{
              marginBottom: 15,
              fontSize: 18,
              fontWeight: 700,
              color: theme.text,
            }}
          >
            ⚡ Quick Insights
          </h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 15,
            }}
          >
            <div
              style={{
                padding: 15,
                borderRadius: 14,
                background: "#f1f5f9",
              }}
            >
              <div style={{ fontSize: 13, color: theme.textMuted }}>
                Total Stock IN
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#16a34a",
                }}
              >
                {stockIn.length}
              </div>
            </div>

            <div
              style={{
                padding: 15,
                borderRadius: 14,
                background: "#fef3c7",
              }}
            >
              <div style={{ fontSize: 13, color: theme.textMuted }}>
                Total Stock OUT
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#d97706",
                }}
              >
                {stockOut.length}
              </div>
            </div>

            <div
              style={{
                padding: 15,
                borderRadius: 14,
                background: "#fee2e2",
              }}
            >
              <div style={{ fontSize: 13, color: theme.textMuted }}>
                Unpaid Amount
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#dc2626",
                }}
              >
                {fmtPKR(unpaid)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ==========================
            END SECTION
      ========================== */}

      <div
        style={{
          textAlign: "center",
          padding: "20px 0",
          color: theme.textMuted,
          fontSize: 13,
        }}
      >
        Inventory Reports • Auto-generated insights based on selected date range
      </div>
    </div>
  );
}