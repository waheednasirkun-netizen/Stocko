import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { agentId, branchId, version, hostname, platform, registeredAt } = req.body;
    
    const { error } = await supabase
      .from('agents')
      .upsert({
        agent_id: agentId,
        branch_id: branchId,
        version,
        hostname,
        platform,
        registered_at: registeredAt,
        is_online: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'agent_id' });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}