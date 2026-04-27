require("dotenv").config();

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { neon } = require("@neondatabase/serverless");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL が .env に設定されていません。");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname)));

async function initDB() {
  // ユーザーテーブル
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // ユーザーごとのチェック状態
  await sql`
    CREATE TABLE IF NOT EXISTS user_state (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      state JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  // 現行のチェック状態: 1行1項目の boolean 管理
  await sql`
    CREATE TABLE IF NOT EXISTS user_check_states (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id VARCHAR(100) NOT NULL,
      is_checked BOOLEAN NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (user_id, item_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_user_check_states_user_id
    ON user_check_states (user_id)
  `;

  // 互換性のため古いテーブルにもアクセス可能にする（必要に応じて）
  await sql`
    CREATE TABLE IF NOT EXISTS checker_state (
      id VARCHAR(50) PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
}

function buildStateObject(rows) {
  const state = {};
  for (const row of rows) {
    state[row.item_id] = Boolean(row.is_checked);
  }
  return state;
}

async function migrateLegacyUserState(userId) {
  const legacyRows = await sql`
    SELECT state
    FROM user_state
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  if (legacyRows.length === 0) {
    return false;
  }

  await sql`
    WITH legacy AS (
      SELECT state
      FROM user_state
      WHERE user_id = ${userId}
      LIMIT 1
    ),
    incoming AS (
      SELECT
        key AS item_id,
        CASE
          WHEN lower(value) = 'true' THEN true
          WHEN lower(value) = 'false' THEN false
          ELSE false
        END AS is_checked
      FROM legacy, jsonb_each_text(legacy.state)
    )
    INSERT INTO user_check_states (user_id, item_id, is_checked, updated_at)
    SELECT ${userId}, item_id, is_checked, NOW()
    FROM incoming
    ON CONFLICT (user_id, item_id)
    DO UPDATE SET
      is_checked = EXCLUDED.is_checked,
      updated_at = NOW()
  `;

  return true;
}

async function loadUserState(userId) {
  let rows = await sql`
    SELECT item_id, is_checked
    FROM user_check_states
    WHERE user_id = ${userId}
  `;

  if (rows.length === 0) {
    const migrated = await migrateLegacyUserState(userId);
    if (migrated) {
      rows = await sql`
        SELECT item_id, is_checked
        FROM user_check_states
        WHERE user_id = ${userId}
      `;
    }
  }

  return buildStateObject(rows);
}

async function saveUserState(userId, state) {
  const normalizedState = Object.fromEntries(
    Object.entries(state).filter(([, value]) => typeof value === "boolean")
  );
  const stateJson = JSON.stringify(normalizedState);

  await sql`
    WITH incoming AS (
      SELECT
        key AS item_id,
        CASE
          WHEN lower(value) = 'true' THEN true
          WHEN lower(value) = 'false' THEN false
          ELSE false
        END AS is_checked
      FROM jsonb_each_text(${stateJson}::jsonb)
    ),
    upserted AS (
      INSERT INTO user_check_states (user_id, item_id, is_checked, updated_at)
      SELECT ${userId}, item_id, is_checked, NOW()
      FROM incoming
      ON CONFLICT (user_id, item_id)
      DO UPDATE SET
        is_checked = EXCLUDED.is_checked,
        updated_at = NOW()
      RETURNING item_id
    )
    DELETE FROM user_check_states ucs
    WHERE ucs.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM incoming WHERE incoming.item_id = ucs.item_id
      )
  `;
}

// JWT認証ミドルウェア
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ error: "Token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

// ユーザー登録
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // パスワードハッシュ化
    const passwordHash = await bcrypt.hash(password, 10);

    // ユーザー作成
    const result = await sql`
      INSERT INTO users (username, password_hash)
      VALUES (${username}, ${passwordHash})
      RETURNING id, username
    `;

    res.json({ ok: true, user: result[0] });
  } catch (err) {
    console.error("POST /api/register error:", err);
    if (err.message && err.message.includes("unique")) {
      return res.status(400).json({ error: "Username already exists" });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

// ログイン
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Missing username or password" });
    }

    // ユーザー検索
    const users = await sql`SELECT id, username, password_hash FROM users WHERE username = ${username}`;
    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = users[0];

    // パスワード検証
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // トークン生成
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "7d"
    });

    res.json({ ok: true, token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error("POST /api/login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// 現在のユーザー情報
app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const users = await sql`SELECT id, username FROM users WHERE id = ${req.user.id}`;
    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(users[0]);
  } catch (err) {
    console.error("GET /api/me error:", err);
    res.status(500).json({ error: "Failed to get user info" });
  }
});

// ユーザーの状態取得（認証必須）
app.get("/api/state", authenticateToken, async (req, res) => {
  try {
    const state = await loadUserState(req.user.id);
    res.json(state);
  } catch (err) {
    console.error("GET /api/state error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// ユーザーの状態保存（認証必須）
app.post("/api/state", authenticateToken, async (req, res) => {
  try {
    const state = req.body;
    if (typeof state !== "object" || state === null || Array.isArray(state)) {
      return res.status(400).json({ error: "Invalid state" });
    }

    await saveUserState(req.user.id, state);

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
