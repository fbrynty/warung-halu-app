// api/initiate-order-chat.js

require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OWNER_WHATSAPP_NUMBER = process.env.OWNER_WHATSAPP_NUMBER;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

app.use(cors());
app.use(express.json());

app.post('/api/initiate-order-chat', async (req, res) => {
    const { customer, items, subtotal, total } = req.body; 

    if (!GEMINI_API_KEY) {
        console.error('Error: GEMINI_API_KEY tidak diatur di variabel lingkungan.');
        return res.status(500).json({ error: 'GEMINI_API_KEY belum diatur di server.' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        let orderSummary = `Pesanan Baru dari ${customer.nama}:\n`;
        orderSummary += `No. HP/WhatsApp: ${customer.whatsapp}\n`;
        orderSummary += `Alamat: ${customer.alamat || '-'}\n`;
        orderSummary += `Catatan: ${customer.catatan || '-'}\n\n`;
        orderSummary += `Detail Pesanan:\n`;
        items.forEach(item => {
            const itemPriceFormatted = (item.harga).toLocaleString('id-ID'); 
            orderSummary += `- ${item.nama} (${item.quantity}x) = Rp ${itemPriceFormatted}\n`; 
        });
        const totalFormatted = (total).toLocaleString('id-ID'); 
        orderSummary += `\nTotal Keseluruhan: Rp ${totalFormatted}`;

        if (total > 150000) {
            console.log(`Pemesanan ditolak: Total Rp ${totalFormatted} melebihi batas Rp 150.000.`);
            const ownerContactMessage = OWNER_WHATSAPP_NUMBER 
                ? `Mohon maaf, total pesanan Anda melebihi Rp 150.000. Untuk konfirmasi lebih lanjut, silakan hubungi owner kami melalui WhatsApp di nomor ${OWNER_WHATSAPP_NUMBER}. Terima kasih!`
                : `Mohon maaf, total pesanan Anda melebihi Rp 150.000. Silakan hubungi kami untuk konfirmasi lebih lanjut.`;

            return res.json({ reply: ownerContactMessage });
        }

        // PROMPT DARI SERVER.CJS, DISALIN UTUH.
        const promptToCustomer = `Anda adalah Virtual Assistant konfirmasi pesanan untuk Warung Halu.
        Berikut adalah detail pesanan yang baru diterima:
        ${orderSummary}
        
        Tanggapi pelanggan dengan ramah, berikan konfirmasi pesanan dan total harga keseluruhan. Informasikan bahwa pesanan sedang diproses. Tekankan bahwa mereka bisa bertanya lebih lanjut tentang pesanan ini.
        
        Contoh: "Halo ${customer.nama}! Terima kasih telah memesan di Warung Halu. Pesanan Anda dengan total Rp ${totalFormatted} sudah kami terima dan sedang diproses. Anda bisa bertanya lebih lanjut tentang pesanan ini di sini."
        Jangan memberikan informasi kontak owner secara langsung kecuali jika diminta secara spesifik.`;

        const result = await model.generateContent(promptToCustomer);
        const responseText = result.response.text();

        if (OWNER_WHATSAPP_NUMBER) {
            const ownerMessage = `*PESANAN BARU Warung Halu*\n\n${orderSummary}\n\nMohon segera diproses.`;
            console.log("\n--- Pesan untuk Owner (Simulasi) ---");
            console.log(ownerMessage);
            console.log("------------------------------------\n");
        }

        res.json({ reply: responseText });

    } catch (error) {
        console.error('Error in /initiate-order-chat endpoint:', error);
        res.status(500).json({ error: 'Gagal memproses konfirmasi pesanan. Error: ' + error.message });
    }
});

module.exports = app;
