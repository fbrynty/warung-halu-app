# Gunakan image Node.js versi 18 sebagai basis
FROM node:18

# Buat dan pindah ke direktori kerja aplikasi
WORKDIR /app

# Salin package.json dan package-lock.json (jika ada)
COPY package*.json ./

# Instal dependensi aplikasi
RUN npm install

# Salin semua file proyek ke dalam kontainer
COPY . .

# Eksekusi server saat kontainer dijalankan
CMD ["npm", "start"]
