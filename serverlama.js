require("dotenv").config();
const express = require("express");
const cloudinary = require("cloudinary").v2;
const bodyParser = require("body-parser");
const http = require("http");
const socketIo = require("socket.io");
const app = express();

let currentPhValue = null; // Variabel global untuk menyimpan nilai pH terbaru

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Membuat server HTTP
const server = http.createServer(app);
const io = socketIo(server); // Menginisialisasi WebSocket dengan server

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.json());

// Endpoint utama untuk menampilkan gambar dan nilai pH pertama kali
app.get("/", async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: "",
      max_results: 1,
      direction: "desc",
    });

    const imageUrl = result.resources[0]?.secure_url || "";
    res.render("index", { imageUrl, phValue: currentPhValue });
  } catch (error) {
    console.error("Gagal mengambil gambar:", error);
    res.status(500).send("Terjadi kesalahan saat mengambil gambar.");
  }
});

// Endpoint untuk menerima nilai pH dari ESP32
app.post("/ph", (req, res) => {
  const { ph } = req.body;
  if (typeof ph === "number") {
    currentPhValue = ph;
    console.log("Nilai pH diterima:", ph);
    // Kirim nilai pH terbaru ke semua klien yang terhubung
    io.emit("phUpdate", currentPhValue);
    res.status(200).send("Nilai pH diterima");
  } else {
    res.status(400).send("Format data tidak valid");
  }
});

// Menjalankan server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
