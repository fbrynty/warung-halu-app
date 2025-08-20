require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OWNER_WHATSAPP_NUMBER = process.env.OWNER_WHATSAPP_NUMBER;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);


app.use(express.json());
app.use(express.static(__dirname)); 
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/initiate-order-chat', async (req, res) => {
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

app.post('/chat', async (req, res) => {
    const { customer, message, history } = req.body;

    if (!GEMINI_API_KEY) {
        console.error('Error: GEMINI_API_KEY tidak diatur di variabel lingkungan untuk endpoint /chat.');
        return res.status(500).json({ error: 'GEMINI_API_KEY belum diatur di server.' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

app.listen(port, () => {
    console.log(`Server Warung Halu berjalan di http://localhost:${port}`);
});
