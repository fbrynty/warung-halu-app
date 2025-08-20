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
    const { customer, message, history } = req.body;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY belum diatur." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let conversationContext = "";
    if (history && history.length > 0) {
      history.forEach(chatTurn => {
        const sender = chatTurn.sender === "user" ? "Pelanggan" : "Chatbot";
        conversationContext += `${sender}: ${chatTurn.text}\n`;
      });
    }

    // 🔹 Prompt untuk chatbot percakapan umum
    const prompt = `Anda adalah chatbot untuk Warung Halu. Warung Halu menyajikan makanan pedas seperti Mie Jebew dan Cibayyy.

Informasi pelanggan:
Nama: ${customer.nama || "-"}
Whatsapp: ${customer.whatsapp || "-"}
Alamat: ${customer.alamat || "-"}
Catatan Pesanan: ${customer.catatan || "-"}

Riwayat Percakapan:
${conversationContext || "Belum ada riwayat percakapan."}

Pesan terbaru dari pelanggan: ${message}

Tanggapi pesan pelanggan dengan ramah dan informatif, gunakan konteks percakapan. 
Berikan info menu sesuai daftar resmi. Level pedas hanya 0-3 untuk Mie Jebew. 
Tolak pemesanan jika total > Rp150.000 dan arahkan ke owner di WhatsApp ${OWNER_WHATSAPP_NUMBER}.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    res.json({ reply: responseText });
  } catch (error) {
    console.error("Error di chat.js:", error);
    res.status(500).json({ error: error.message });
  }
}
