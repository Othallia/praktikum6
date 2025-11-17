const express = require("express");
const crypto = require("crypto");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Ini folder untuk file HTML nanti

// --- KONEKSI DATABASE ---
// Settingan sesuai punya kamu
const dbPool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "ookwlan24", 
  database: "api_key",   
  port: 3307,            
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

(async () => {
  try {
    await dbPool.query("SELECT 1");
    console.log("✅ Berhasil terhubung ke database MySQL (api_key)");
  } catch (err) {
    console.error("❌ GAGAL terhubung ke database:", err.message);
  }
})();

app.post("/generate-api-key", async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;

    if (!email || !firstName) {
      return res.status(400).json({ error: "Nama Depan dan Email wajib diisi!" });
    }

    // 1. Cek apakah user sudah ada?
    const [users] = await dbPool.query("SELECT id FROM users WHERE email = ?", [email]);
    let userId;

    if (users.length > 0) {
      userId = users[0].id; // User lama
    } else {
      // User baru -> Insert
      const [result] = await dbPool.query(
        "INSERT INTO users (first_name, last_name, email) VALUES (?, ?, ?)",
        [firstName, lastName, email]
      );
      userId = result.insertId;
    }

    // 2. Buat Key Random
    const apiKey = "sk_live_" + crypto.randomBytes(32).toString("hex");
    
    // 3. Atur Tanggal (Expired 30 hari)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); 

    // 4. Simpan Key ke Database
    await dbPool.query(
      "INSERT INTO api_keys (user_id, api_key, status, start_date, end_date) VALUES (?, ?, 'active', ?, ?)",
      [userId, apiKey, startDate, endDate]
    );

    console.log(`API Key dibuat untuk: ${email}`);
    res.json({ apiKey: apiKey });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal membuat key" });
  }
});

// ----------------------------------------------------
// ROUTE 2: VALIDASI / CEK KEY
// ----------------------------------------------------
app.post("/check", async (req, res) => {
  try {
    const { apikey } = req.body;
    if (!apikey) return res.status(400).json({ status: "error", message: "API key kosong" });

    // Join table biar tau siapa pemiliknya
    const query = `
      SELECT k.*, u.email, u.first_name 
      FROM api_keys k 
      JOIN users u ON k.user_id = u.id 
      WHERE k.api_key = ?
    `;

    const [rows] = await dbPool.query(query, [apikey]);

    if (rows.length > 0) {
      const data = rows[0];
      const now = new Date();
      const expiredDate = new Date(data.end_date);

      if (data.status !== 'active') return res.status(403).json({ status: "error", message: "Key Tidak Aktif" });
      if (now > expiredDate) return res.status(403).json({ status: "error", message: "Key Sudah Expired" });

      res.json({
        status: "sukses",
        message: "API key valid",
        owner: `${data.first_name} (${data.email})`,
        expires_at: data.end_date
      });
    } else {
      res.status(404).json({ status: "error", message: "Key tidak ditemukan" });
    }
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// ----------------------------------------------------
// ROUTE 3: ADMIN (Lihat Data & Hapus)
// ----------------------------------------------------
app.get("/admin/keys", async (req, res) => {
  try {
    const query = `
      SELECT api_keys.id, users.first_name, users.email, api_keys.api_key, api_keys.status 
      FROM api_keys 
      JOIN users ON api_keys.user_id = users.id
      ORDER BY api_keys.created_at DESC
    `;
    const [rows] = await dbPool.query(query);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Gagal ambil data" });
  }
});

app.delete("/admin/keys/:id", async (req, res) => {
  try {
    await dbPool.query("DELETE FROM api_keys WHERE id = ?", [req.params.id]);
    res.json({ message: "Berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: "Gagal hapus" });
  }
});

// JALANKAN SERVER
app.listen(port, () => {
  console.log(`🚀 Server jalan di http://localhost:${port}`);
});