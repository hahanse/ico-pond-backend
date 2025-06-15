# Gunakan Node.js image resmi
FROM node:18

# Buat direktori kerja
WORKDIR /app

# Salin file
COPY package*.json ./
RUN npm install

COPY . .

# Ekspos port
EXPOSE 8080

# Jalankan aplikasi
CMD ["npm", "start"]
