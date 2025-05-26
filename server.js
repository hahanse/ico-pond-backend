const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Ubah jika frontend beda
    methods: ["GET", "POST"],
  },
});

// WebSocket connection
io.on("connection", (socket) => {
  console.log("Client terhubung:", socket.id);
});

// ✅ Endpoint kirim nilai pH dari ESP32
app.post("/ph", (req, res) => {
  const { ph } = req.body;
  console.log("pH diterima dari ESP32:", ph);
  io.emit("phUpdate", parseFloat(ph));
  res.status(200).json({ message: "pH diterima" });
});

// ✅ Endpoint log servo manual / otomatis dari ESP32
app.post("/servo/:source", (req, res) => {
  const source = req.params.source; // manual / otomatis
  const waktu = new Date().toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  console.log(`Servo dijalankan secara ${source} pada ${waktu}`);
  io.emit("servoLog", { source, waktu });

  // Simpan ke file (opsional)
  fs.appendFile("servo-log.txt", `${waktu} - ${source}\n`, (err) => {
    if (err) console.error("Gagal menyimpan log:", err);
  });

  res.status(200).json({ message: `Log servo dari '${source}' diterima` });
});

// ✅ Endpoint ambil 10 gambar terbaru dari Cloudinary
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

// ✅ Endpoint data hama dari Cloudinary prefix "hama/"
app.get("/hama", async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: "hama", // hanya folder "hama/"
      max_results: 10,
      direction: "desc",
    });

    const hamaData = result.resources.map((img, index) => {
      const waktu = new Date(img.created_at).toLocaleString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      return {
        no: index + 1,
        waktu,
        keterangan: "Terdeteksi gerakan hama",
        imageUrl: img.secure_url,
      };
    });

    res.status(200).json({ data: hamaData });
  } catch (error) {
    console.error("Gagal mengambil data hama:", error);
    res.status(500).send("Terjadi kesalahan saat mengambil data hama.");
  }
});

// ✅ Start server
server.listen(3000, () => {
  console.log("Server berjalan di http://localhost:3000");
});
