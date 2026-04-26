require("dotenv").config();

const express = require("express");
const { neon } = require("@neondatabase/serverless");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL が .env に設定されていません。");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname)));

async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS checker_state (
      id VARCHAR(50) PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
}

app.get("/api/state", async (req, res) => {
  try {
    const rows = await sql`SELECT state FROM checker_state WHERE id = 'default'`;
    res.json(rows.length > 0 ? rows[0].state : {});
  } catch (err) {
    console.error("GET /api/state error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

app.post("/api/state", async (req, res) => {
  try {
    const state = req.body;
    if (typeof state !== "object" || state === null || Array.isArray(state)) {
      return res.status(400).json({ error: "Invalid state" });
    }
    await sql`
      INSERT INTO checker_state (id, state, updated_at)
      VALUES ('default', ${JSON.stringify(state)}, NOW())
      ON CONFLICT (id) DO UPDATE
        SET state = EXCLUDED.state,
            updated_at = NOW()
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/state error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

const PORT = process.env.PORT || 3000;

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB 初期化失敗:", err);
    process.exit(1);
  });
