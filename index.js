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