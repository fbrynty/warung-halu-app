// api/chat.js

require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OWNER_WHATSAPP_NUMBER = process.env.OWNER_WHATSAPP_NUMBER;
const ADMIN_WHATSAPP_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER; 
let genAI;
let model;

// --- Bagian Perbaikan: Memastikan API Key ada sebelum inisialisasi ---
if (GEMINI_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    } catch (error) {
        console.error("Error saat inisialisasi GoogleGenerativeAI:", error);
    }
}

// Konfigurasi CORS untuk mengizinkan permintaan dari domain frontend Anda
// Ganti 'https://warung-halu-app.vercel.app' dengan domain frontend Anda yang benar
const corsOptions = {
  origin: 'https://warung-halu-app.vercel.app', 
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

app.post('/api/chat', async (req, res) => {
    const { customer, message, history } = req.body;

    if (!model) {
        console.error('Error: Model AI tidak dapat diinisialisasi. Kemungkinan GEMINI_API_KEY tidak valid.');
        return res.status(500).json({ error: 'Layanan chatbot saat ini tidak tersedia. Silakan coba lagi nanti.' });
    }

    try {
        let conversationContext = "";
        if (history && history.length > 0) {
            history.forEach(chatTurn => {
                const sender = chatTurn.sender === 'user' ? 'Pelanggan' : 'Chatbot';
                conversationContext += `${sender}: ${chatTurn.text}\n`;
            });
        }

        const prompt = `Anda adalah Virtual Assistant untuk Warung Halu. Warung Halu menyajikan makanan pedas seperti Mie Jebew dan Cibayyy.
        Informasi pelanggan saat ini:
        Nama: ${customer.nama || 'Tidak diketahui'}
        Whatsapp: ${customer.whatsapp || 'Tidak diketahui'}
        Alamat: ${customer.alamat || '-'}
        Catatan Pesanan: ${customer.catatan || '-'}
        Riwayat Percakapan Sebelumnya:
        ${conversationContext || 'Belum ada riwayat percakapan.'}

        Pesan Terbaru dari Pelanggan: ${message}

        Tanggapi pesan pelanggan dengan ramah dan informatif, seolah-olah Anda adalah bagian dari Warung Halu.
        Gunakan konteks percakapan sebelumnya dan detail pesanan jika relevan untuk memberikan jawaban yang koheren.
        Berikan informasi menu yang hanya tertera pada menu.
        Berikan informasi Lokasi warung halu pada pelanggan jika bertanya atau arahkan ke halaman lokasi kami, untuk lokasi warung halu: Prempu 1 belakang Balai Desa, Eretan Wetan.
        Level hanya tersedia dari 0-3, untuk cibayyy, cimset dan mie ayam tidak memiliki level.
        Jika pelanggan bertanya tentang level pedas, berikan informasi yang sesuai dengan menu yang tersedia.
        Jika pelanggan bertanya tentang harga, berikan informasi harga yang sesuai dengan menu yang tersedia.
        Tolak pemesanan jika lebih dari harga Rp. 150.000, hanya menampilkan pesan untuk hubungi owner melalui WhatsApp ${OWNER_WHATSAPP_NUMBER} atau ${ADMIN_WHATSAPP_NUMBER} untuk konfirmasi lebih lanjut.
        Jika memungkinkan, tawarkan informasi terkait menu atau cara pemesanan, atau tindak lanjut terkait pesanan yang sudah dikonfirmasi.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        res.json({ reply: responseText });
    } catch (error) {
        console.error('Error with Gemini API in /chat endpoint:', error);
        res.status(500).json({ error: 'Failed to get response from general chatbot. Detailed error: ' + error.message });
    }
});

module.exports = app;
