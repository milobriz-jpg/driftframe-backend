// GET /api/leaderboard
// Returns top 50 scores from JSONBin. Master key never leaves the server.
//
// Required Vercel env vars:
//   JSONBIN_MASTER_KEY  — your JSONBin X-Master-Key
//   JSONBIN_BIN_ID      — your bin ID

module.exports = async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const masterKey = process.env.JSONBIN_MASTER_KEY;
  const binId     = process.env.JSONBIN_BIN_ID;

  if (!masterKey || !binId) {
    console.error('[leaderboard] Missing env vars: JSONBIN_MASTER_KEY or JSONBIN_BIN_ID');
    return res.status(500).json({ error: 'Server not configured — check Vercel env vars' });
  }

  const url = `https://api.jsonbin.io/v3/b/${binId}/latest`;
  console.log('[leaderboard] GET', url);

  try {
    const r = await fetch(url, {
      headers: {
        'X-Master-Key': masterKey,
        'X-Bin-Meta':   'false',
      },
    });

    const text = await r.text();
    console.log('[leaderboard] JSONBin status:', r.status, text.slice(0, 200));

    if (!r.ok) {
      return res.status(502).json({
        error:  'JSONBin upstream error',
        status: r.status,
        detail: text.slice(0, 200),
      });
    }

    const j      = JSON.parse(text);
    // JSONBin with X-Bin-Meta:false returns the raw object directly.
    // Guard against empty / malformed bins.
    const scores = Array.isArray(j.scores) ? j.scores : [];
    console.log('[leaderboard] Returning', scores.length, 'scores');
    return res.status(200).json({ scores: scores.slice(0, 50) });

  } catch (err) {
    console.error('[leaderboard] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};
