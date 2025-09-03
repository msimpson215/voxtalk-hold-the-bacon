import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Pull Deepgram key from ENV
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
if (!DEEPGRAM_API_KEY) {
  console.error("❌ Missing DEEPGRAM_API_KEY");
  process.exit(1);
}

// WebSocket server: browser -> proxy -> Deepgram
const server = app.listen(PORT, () => {
  console.log(`✅ HoldTheBacon server running at http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", async (client) => {
  console.log("🌐 New client streaming to Deepgram…");

  // Connect to Deepgram streaming API (English-only model)
  const dgWs = new WebSocket(
    "wss://api.deepgram.com/v1/listen?model=nova-2&language=en",
    { headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` } }
  );

  // Deepgram -> Browser
  dgWs.on("message", (msg) => client.send(msg.toString()));

  // Browser -> Deepgram
  client.on("message", (msg) => dgWs.send(msg));

  client.on("close", () => dgWs.close());
});

// Session for OpenAI Realtime
app.post("/session", (req, res) => {
  res.json({
    client_secret: { value: process.env.OPENAI_API_KEY || "fake-token" },
    model: "gpt-4o-realtime-preview",
    voice: "verse",
    language: "en-US"
  });
});
