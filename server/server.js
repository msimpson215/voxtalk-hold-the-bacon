import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const FIXED_VOICE = "verse";
const FIXED_LANG = "en-US";

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// 🔹 Session for OpenAI Realtime
app.post("/session", (req, res) => {
  res.json({
    client_secret: { value: process.env.OPENAI_API_KEY || "fake-token" },
    model: "gpt-4o-realtime-preview",
    voice: FIXED_VOICE,
    language: FIXED_LANG,
  });
});

const server = app.listen(PORT, () => {
  console.log(`✅ VoxTalk running on http://localhost:${PORT}`);
});

// 🔹 WebSocket: Mic → Deepgram → Filter → Browser
const wss = new WebSocketServer({ server });

wss.on("connection", async (client) => {
  console.log("🎤 Client connected");

  // Force English transcription
  const dgSocket = new WebSocket(
    "wss://api.deepgram.com/v1/listen?language=en-US&punctuate=true",
    {
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
    }
  );

  dgSocket.on("open", () => console.log("🔗 Connected to Deepgram"));

  client.on("message", (msg) => {
    dgSocket.send(msg); // raw audio forwarded
  });

  client.on("close", () => {
    dgSocket.close();
    console.log("❌ Mic closed");
  });

  dgSocket.on("message", (data) => {
    try {
      const dgResp = JSON.parse(data.toString());
      const text = dgResp.channel?.alternatives?.[0]?.transcript?.trim();
      if (!text) return;

      // 🔎 English filter: block non-English or "Spanish"
      const isEnglish = /^[\x00-\x7F]+$/.test(text); // ASCII-only = English-ish
      const mentionsSpanish = /spanish/i.test(text);

      if (isEnglish && !mentionsSpanish) {
        client.send(JSON.stringify({ text })); // safe → forward to browser
      } else {
        console.log(`⚠️ Blocked non-English transcript: "${text}"`);
      }
    } catch (err) {
      console.error("Deepgram parse error:", err);
    }
  });
});
