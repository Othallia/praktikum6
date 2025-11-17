const express = require("express");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// --- KONEKSI DATABASE ---
const dbPool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "ookwlan24", 
  database: "api_key",   
  port: 3307
});

(async () => {
  try {
    await dbPool.query("SELECT 1");
    console.log("✅ Berhasil terhubung ke database MySQL (api_key)");
  } catch (err) {
    console.error("❌ GAGAL terhubung ke database:", err.message);
  }
})();

// =================================================
// 1. GENERATE API KEY (Logika Sesuai DB Kamu)
// =================================================
app.post("/generate-api-key", async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;

    if (!email || !firstName) {
      return res.status(400).json({ error: "Nama dan Email wajib diisi!" });
    }

    const apiKeyString = "sk_live_" + crypto.randomBytes(32).toString("hex");
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    // Insert API KEY
    const [result] = await dbPool.query(
      "INSERT INTO apiKey (api_key, status, start_date, end_date) VALUES (?, 'active', ?, ?)",
      [apiKeyString, startDate, endDate]
    );

    const apiKeyId = result.insertId; // <--- PENTING

    // Insert User
    await dbPool.query(
      "INSERT INTO users (first_name, last_name, email, id_apikey) VALUES (?, ?, ?, ?)",
      [firstName, lastName, email, apiKeyId]
    );

    res.json({ apiKey: apiKeyString });

  } catch (error) {
    console.error("MYSQL ERROR:", error); // <--- TARO DI SINI

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Email sudah terdaftar!" });
    }

    res.status(500).json({ error: "Gagal memproses data." });
  }
});
// =================================================
// 2. ADMIN: LIST USERS
// =================================================
app.get("/admin/list-users", async (req, res) => {
  try {
    const [rows] = await dbPool.query("SELECT * FROM users");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Gagal ambil data users" });
  }
});

// =================================================
// 3. ADMIN: LIST APIKEYS
// =================================================
app.get("/admin/list-apikeys", async (req, res) => {
  try {
    const query = `
      SELECT 
        apiKey.id,
        apiKey.api_key,
        apiKey.status,
        apiKey.start_date,
        apiKey.end_date,
        users.email AS owner_email,
        users.first_name
      FROM apiKey
      LEFT JOIN users ON users.id_apikey = apiKey.id
    `;

    const [rows] = await dbPool.query(query);
    res.json(rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal ambil data keys" });
  }
});

// =================================================
// 4. ADMIN REGISTER & LOGIN
// =================================================
app.post("/admin/create", async (req, res) => {
  try {
    const { email, password } = req.body;
    await dbPool.query(
      "INSERT INTO admins (email, password) VALUES (?, ?)",
      [email, password]
    );
    res.json({ message: "Admin berhasil dibuat" });
  } catch (error) {
    res.status(500).json({ error: "Gagal membuat admin" });
  }
});

app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await dbPool.query(
      "SELECT * FROM admins WHERE email = ? AND password = ?",
      [email, password]
    );

    if (rows.length > 0) {
      res.json({ status: "success", message: "Login berhasil!" });
    } else {
      res.status(401).json({ status: "error", message: "Email/Password salah" });
    }

  } catch (error) {
    res.status(500).json({ error: "Error server" });
  }
});

// =================================================
// 5. DELETE API KEY
// =================================================
app.delete("/admin/delete-key/:id", async (req, res) => {
  try {
    await dbPool.query("DELETE FROM apiKey WHERE id = ?", [req.params.id]);
    res.json({ message: "Key berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: "Gagal hapus key" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server jalan di http://localhost:${PORT}`);
});