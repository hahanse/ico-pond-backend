const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const cloudinary = require("cloudinary").v2;
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(
  cors({
    origin: "https://ico-pond.vercel.app",
  })
);
app.use(express.json({ limit: "10mb" }));

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://ico-pond.vercel.app",
    methods: ["GET", "POST"],
  },
});

const SHEET_API_URL =
  "https://script.google.com/macros/s/AKfycby3jl4dIBVaSv_Zk9yq7KVXXXNbX2OpEtTsPTkNCMrkRfajV9HjegNN427YaPK6uHua/exec";

// Socket.IO: client terhubung
io.on("connection", (socket) => {
  console.log("Client terhubung:", socket.id);
});

// Endpoint pH dari ESP32
app.post("/ph", async (req, res) => {
  const { ph } = req.body;
  console.log("pH diterima dari ESP32:", ph);

  // Kirim data pH ke client via Socket.IO
  io.emit("phUpdate", parseFloat(ph));

  // Tidak lagi mengirim POST ke frontend
  res.status(200).json({ message: "pH diterima" });
});

// Endpoint log servo pupuk/pakan
app.post("/servo/:source", async (req, res) => {
  const source = req.params.source; // 'manual' atau 'otomatis'
  const { jenis, waktu: waktuDariEsp32 } = req.body;

  if (!["pakan", "pupuk"].includes(jenis)) {
    return res.status(400).json({
      message: "Jenis servo tidak valid (harus 'pakan' atau 'pupuk')",
    });
  }

  const waktu =
    waktuDariEsp32 ||
    new Date().toLocaleString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const aksi = `Servo pemberi ${jenis} berjalan`;

  const payload = {
    waktu,
    jenis,
    source,
    aksi,
  };

  console.log("Data log servo:", payload);
  io.emit("servoLog", { waktu, jenis });

  try {
    await axios.post(SHEET_API_URL, payload);
    res.status(200).json({ message: "Log servo dikirim ke Google Sheets" });
  } catch (err) {
    console.error("Gagal kirim ke Google Sheets:", err.message);
    res.status(500).json({ message: "Gagal kirim log ke Google Sheets" });
  }
});

// Endpoint untuk menerima gambar baru hasil deteksi hama burung dan emit event ke client
app.post("/new-image", (req, res) => {
  const { url, timestamp } = req.body;

  if (!url || !timestamp) {
    return res.status(400).json({ message: "url dan timestamp wajib ada" });
  }

  console.log("Gambar deteksi hama burung baru:", { url, timestamp });
  io.emit("newImageUrl", { url, timestamp });

  res.status(200).json({ message: "Gambar baru dikirim ke client" });
});

// Endpoint ambil semua gambar dari Cloudinary
app.get("/", async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: "",
      max_results: 10,
      direction: "desc",
    });

    const imageUrls = result.resources.map((img) => ({
      url: img.secure_url,
      timestamp: img.created_at,
    }));

    res.status(200).json({ imageUrls });
  } catch (error) {
    console.error("Gagal mengambil gambar:", error);
    res.status(500).send("Terjadi kesalahan saat mengambil gambar.");
  }
});

// Endpoint curah hujan dari ESP32
app.post("/curah-hujan", (req, res) => {
  const { status } = req.body; // misal { status: "hujan" }

  if (!status) {
    return res.status(400).json({ message: "Field 'status' wajib diisi" });
  }

  console.log("Status curah hujan diterima:", status);

  // Emit event ke client (frontend) agar update UI
  io.emit("curahHujanUpdate", status);

  // Bisa juga simpan atau proses lebih lanjut di sini

  res.status(200).json({ message: "Status curah hujan diterima" });
});

// Jalankan server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
