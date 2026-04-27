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
  try {
    // 既存テーブルをドロップ（email カラム削除のため）
    await sql`DROP TABLE IF EXISTS user_state CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;
  } catch (err) {
    console.log("Drop tables (if existed):", err.message);
  }

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

  // 互換性のため古いテーブルにもアクセス可能にする（必要に応じて）
  await sql`
    CREATE TABLE IF NOT EXISTS checker_state (
      id VARCHAR(50) PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    const rows = await sql`
      SELECT state FROM user_state 
      WHERE user_id = ${req.user.id}
      LIMIT 1
    `;
    res.json(rows.length > 0 ? rows[0].state : {});
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

    // upsert: 既存なら更新、なければ作成
    const existing = await sql`
      SELECT id FROM user_state WHERE user_id = ${req.user.id}
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE user_state 
        SET state = ${JSON.stringify(state)}, updated_at = NOW()
        WHERE user_id = ${req.user.id}
      `;
    } else {
      await sql`
        INSERT INTO user_state (user_id, state, updated_at)
        VALUES (${req.user.id}, ${JSON.stringify(state)}, NOW())
      `;
    }

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
