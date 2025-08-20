export default async function handler(req, res) {
  // === FIX CORS ===
  res.setHeader("Access-Control-Allow-Origin", "https://warung-hallu-1850.web.app"); 
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // === API LOGIC ===
  if (req.method === "POST") {
    try {
      const { message } = req.body;

      // 🔹 sementara dummy reply dulu
      let reply = "Halo! Saya chatbot Warung Halu.";
      if (message?.toLowerCase().includes("buka")) {
        reply = "Ya, Warung Halu buka setiap hari jam 10:00 - 22:00 🍜";
      } else if (message?.toLowerCase().includes("menu")) {
        reply = "Menu favorit kami: Nasi Goreng, Ayam Geprek, dan Chili Oil 🌶️";
      }

      return res.status(200).json({ reply });
    } catch (err) {
      console.error("API Error:", err);
      return res.status(500).json({ error: "Terjadi kesalahan pada server" });
    }
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
