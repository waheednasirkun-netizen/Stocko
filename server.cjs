const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// ── CORS: allow the print agent to call your site ──
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── Supabase (service role key — keep secret) ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── 1. Agent Registration ──
app.post("/agents/register", async (req, res) => {
  try {
    const { agentId, branchId, version, hostname, platform, registeredAt } = req.body;

    const { error } = await supabase
      .from("agents")
      .upsert({
        agent_id: agentId,
        branch_id: branchId,
        version,
        hostname,
        platform,
        registered_at: registeredAt,
        is_online: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "agent_id" });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("[Agent] Register error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 2. Heartbeat ──
app.post("/agents/heartbeat", async (req, res) => {
  try {
    const { agentId, branchId, timestamp, version, uptime, queue, printers } = req.body;

    const { error } = await supabase
      .from("agents")
      .upsert({
        agent_id: agentId,
        branch_id: branchId,
        version,
        last_heartbeat_at: timestamp,
        is_online: true,
        queue_pending: queue?.pending || 0,
        queue_failed: queue?.failed || 0,
        queue_dead: queue?.dead || 0,
        printer_receipt: printers?.receipt || null,
        printer_dispatch: printers?.dispatch || null,
        printer_label: printers?.label || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "agent_id" });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("[Agent] Heartbeat error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 3. Offline ──
app.post("/agents/offline", async (req, res) => {
  try {
    const { agentId, timestamp } = req.body;

    const { error } = await supabase
      .from("agents")
      .update({ is_online: false, updated_at: timestamp })
      .eq("agent_id", agentId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("[Agent] Offline error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Health check ──
app.get("/", (req, res) => {
  res.send("Stocko Cloud API OK");
});

// ── Start ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Cloud] Agent API running on port ${PORT}`);
});