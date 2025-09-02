import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const FIXED_VOICE = "verse";
const FIXED_LANG = "en-US";

app.use(express.json({ limit: "10mb" }));
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

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`✅ Hold-the-Bacon running on http://localhost:${PORT}`);
});

// 🔹 WebSocket for mic → Deepgram → Realtime
const wss = new WebSocketServer({ server });

wss.on("connection", async (client) => {
  console.log("🎤 Client connected to VoxTalk mic stream");

  // Connect to Deepgram streaming API
  const dgSocket = new WebSocket(
    "wss://api.deepgram.com/v1/listen?language=en-US&punctuate=true",
    {
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
    }
  );

  dgSocket.on("open", () => {
    console.log("🔗 Connected to Deepgram ASR");
  });

  // Forward mic audio to Deepgram
  client.on("message", (msg) => {
    dgSocket.send(msg);
  });

  client.on("close", () => {
    console.log("❌ Client mic closed");
    dgSocket.close();
  });

  // Deepgram transcription results → send back to browser
  dgSocket.on("message", (data) => {
    try {
      const dgResp = JSON.parse(data.toString());
      if (dgResp.channel?.alternatives?.[0]?.transcript) {
        const text = dgResp.channel.alternatives[0].transcript.trim();
        if (text) {
          // Send transcription to client (browser)
          client.send(JSON.stringify({ text }));

          // Optionally: inject text straight into OpenAI Realtime here
          // (For now we just send back to browser for injection via DC)
        }
      }
    } catch (err) {
      console.error("Deepgram parse error:", err);
    }
  });
});
