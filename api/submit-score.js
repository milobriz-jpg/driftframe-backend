// POST /api/submit-score
// Upserts a player score in JSONBin (one best score per pid).
// Also handles rename-only calls — always updates name regardless of score.
// Master key never leaves the server.
//
// Expected JSON body:
//   { name: string, pid: string, score: number, diff: string, ts: number }
//
// Required Vercel env vars:
//   JSONBIN_MASTER_KEY  — your JSONBin X-Master-Key
//   JSONBIN_BIN_ID      — your bin ID

const MAX_ENTRIES = 50;
const MAX_NAME    = 30;

// Vercel does NOT auto-parse JSON — we do it ourselves.
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end',  () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const masterKey = process.env.JSONBIN_MASTER_KEY;
  const binId     = process.env.JSONBIN_BIN_ID;

  if (!masterKey || !binId) {
    console.error('[submit-score] Missing env vars');
    return res.status(500).json({ error: 'Server not configured — check Vercel env vars' });
  }

  // Parse body
  let body;
  try {
    body = await parseBody(req);
  } catch (e) {
    console.error('[submit-score] Body parse error:', e.message);
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { name, pid, score, diff, ts } = body;
  console.log('[submit-score] Received:', { name, pid, score, diff });

  // Validate
  if (typeof name  !== 'string' || !name.trim())
    return res.status(400).json({ error: 'Invalid name' });
  if (typeof pid   !== 'string' || !pid.trim())
    return res.status(400).json({ error: 'Invalid pid' });
  if (typeof score !== 'number' || !isFinite(score) || score < 0)
    return res.status(400).json({ error: 'Invalid score' });

  const entry = {
    name:  name.toUpperCase().trim().slice(0, MAX_NAME),
    pid:   pid.slice(0, 64),
    score: Math.floor(score),
    diff:  typeof diff === 'string' ? diff.slice(0, 10) : 'normal',
    ts:    typeof ts === 'number' ? ts : Date.now(),
  };

  const binBase = `https://api.jsonbin.io/v3/b/${binId}`;

  try {
    // ── 1. Read current leaderboard ───────────────
    console.log('[submit-score] Reading bin:', binBase + '/latest');
    const r1 = await fetch(`${binBase}/latest`, {
      headers: { 'X-Master-Key': masterKey, 'X-Bin-Meta': 'false' },
    });
    const text1 = await r1.text();
    console.log('[submit-score] Read status:', r1.status, text1.slice(0, 200));
    if (!r1.ok) throw new Error('JSONBin read failed: HTTP ' + r1.status + ' — ' + text1.slice(0, 100));

    const j      = JSON.parse(text1);
    const scores = Array.isArray(j.scores) ? [...j.scores] : [];

    // ── 2. Upsert — one entry per pid ────────────
    const idx = scores.findIndex(e => e.pid === entry.pid);
    if (idx >= 0) {
      const existing = scores[idx];
      console.log('[submit-score] Found existing entry:', existing.name, existing.score);
      // Always update the name (handles rename case)
      // Only update score if new score is strictly higher
      if (entry.score > existing.score) {
        scores[idx] = entry;
        console.log('[submit-score] Updated score + name');
      } else {
        scores[idx] = { ...existing, name: entry.name, ts: entry.ts };
        console.log('[submit-score] Updated name only (score unchanged)');
      }
    } else {
      scores.push(entry);
      console.log('[submit-score] New entry added');
    }

    scores.sort((a, b) => b.score - a.score);
    const trimmed = scores.slice(0, MAX_ENTRIES);

    // ── 3. Write back ─────────────────────────────
    console.log('[submit-score] Writing', trimmed.length, 'entries back to bin');
    const r2 = await fetch(binBase, {
      method:  'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': masterKey,
      },
      body: JSON.stringify({ scores: trimmed }),
    });
    const text2 = await r2.text();
    console.log('[submit-score] Write status:', r2.status, text2.slice(0, 200));
    if (!r2.ok) throw new Error('JSONBin write failed: HTTP ' + r2.status + ' — ' + text2.slice(0, 100));

    console.log('[submit-score] Success');
    return res.status(200).json({ ok: true, scores: trimmed });

  } catch (err) {
    console.error('[submit-score] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
