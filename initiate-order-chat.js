import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OWNER_WHATSAPP_NUMBER = process.env.OWNER_WHATSAPP_NUMBER;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export default async function handler(req, res) {
  // --- CORS Fix ---
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "https://warung-hallu-1850.web.app"); 
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { customer, items, subtotal, total } = req.body;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY belum diatur." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 🔹 Format ringkasan pesanan
    let orderSummary = `Pesanan Baru dari ${customer.nama}:\n`;
    orderSummary += `No. HP/WhatsApp: ${customer.whatsapp}\n`;
    orderSummary += `Alamat: ${customer.alamat || '-'}\n`;
    orderSummary += `Catatan: ${customer.catatan || '-'}\n\n`;
    orderSummary += `Detail Pesanan:\n`;
    items.forEach(item => {
      orderSummary += `- ${item.nama} (${item.quantity}x) = Rp ${item.harga.toLocaleString("id-ID")}\n`;
    });
    const totalFormatted = total.toLocaleString("id-ID");
    orderSummary += `\nTotal Keseluruhan: Rp ${totalFormatted}`;

    if (total > 150000) {
      const ownerContactMessage = OWNER_WHATSAPP_NUMBER
        ? `Mohon maaf, total pesanan Anda melebihi Rp 150.000. Untuk konfirmasi lebih lanjut, silakan hubungi owner kami melalui WhatsApp di nomor ${OWNER_WHATSAPP_NUMBER}. Terima kasih!`
        : `Mohon maaf, total pesanan Anda melebihi Rp 150.000. Silakan hubungi kami untuk konfirmasi lebih lanjut.`;

      return res.json({ reply: ownerContactMessage });
    }

    // 🔹 Prompt untuk chatbot
    const promptToCustomer = `Anda adalah chatbot konfirmasi pesanan untuk Warung Halu.
Berikut adalah detail pesanan yang baru diterima:
${orderSummary}

Tanggapi pelanggan dengan ramah, berikan konfirmasi pesanan dan total harga keseluruhan. Informasikan bahwa pesanan sedang diproses.`;

    const result = await model.generateContent(promptToCustomer);
    const responseText = result.response.text();

    // Log untuk owner (simulasi WhatsApp)
    if (OWNER_WHATSAPP_NUMBER) {
      console.log("\n--- Pesan untuk Owner (Simulasi) ---");
      console.log(`*PESANAN BARU Warung Halu*\n\n${orderSummary}`);
      console.log("------------------------------------\n");
    }

    res.json({ reply: responseText });
  } catch (error) {
    console.error("Error di initiate-order-chat:", error);
    res.status(500).json({ error: error.message });
  }
}
