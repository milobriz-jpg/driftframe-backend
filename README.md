# Drift Frame — Leaderboard Backend

Tiny Vercel serverless proxy that keeps your JSONBin master key
off the client entirely. The browser only ever talks to **your** domain.

---

## File structure

```
driftframe-backend/
├── api/
│   ├── leaderboard.js     GET  /api/leaderboard
│   └── submit-score.js    POST /api/submit-score
├── vercel.json
├── package.json
└── README.md
```

---

## Deploy to Vercel (5 minutes)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "init"
gh repo create driftframe-backend --public --push
```

### 2. Import into Vercel

1. Go to https://vercel.com/new
2. Import your `driftframe-backend` GitHub repo
3. Click **Deploy** (no build settings needed)

### 3. Add environment variables

In the Vercel dashboard → your project → **Settings → Environment Variables**, add:

| Name                  | Value                        |
|-----------------------|------------------------------|
| `JSONBIN_MASTER_KEY`  | `$2a$10$...` (your key)      |
| `JSONBIN_BIN_ID`      | `64abc123...` (your bin ID)  |

> ⚠️ Never put these in your code or commit them to git.

### 4. Update the game HTML

In `freeze-frame.html`, set `LB_API_BASE` to your Vercel URL:

```js
const LB_API_BASE = 'https://driftframe-backend.vercel.app';
```

---

## API reference

### `GET /api/leaderboard`
Returns the top 50 scores.

**Response**
```json
{ "scores": [ { "name": "SWIFT1234", "pid": "pid_...", "score": 174626, "diff": "normal", "ts": 1710000000000 } ] }
```

---

### `POST /api/submit-score`
Upserts a player's score (keeps best per `pid`).

**Body**
```json
{ "name": "SWIFT1234", "pid": "pid_abc123", "score": 174626, "diff": "normal", "ts": 1710000000000 }
```

**Response**
```json
{ "ok": true, "scores": [ ... ] }
```

---

## JSONBin initial setup

If your bin is empty or doesn't exist yet:

1. Log in at https://jsonbin.io
2. Create a new bin with this initial content:
   ```json
   { "scores": [] }
   ```
3. Copy the **Bin ID** from the URL bar and your **Master Key** from API Keys.
4. Add both to Vercel environment variables as shown above.

