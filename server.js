const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Ganti dengan domain frontend kamu
    methods: ["GET", "POST"],
  },
});

// WebSocket connection
io.on("connection", (socket) => {
  console.log("Client terhubung:", socket.id);
});

// Endpoint kirim nilai pH dari ESP32
app.post("/ph", (req, res) => {
  const { ph } = req.body;
  console.log("pH diterima dari ESP32:", ph);
  io.emit("phUpdate", parseFloat(ph)); // Kirim update nilai pH ke frontend
  res.status(200).json({ message: "pH diterima" });
});

// Endpoint ambil 10 gambar terbaru dari Cloudinary
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

// Endpoint tampilkan data hama dalam bentuk tabel (opsional)
app.get("/hama", async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: "hama",
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

server.listen(3000, () => {
  console.log("Server berjalan di http://localhost:3000");
});
