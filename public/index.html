import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Fixed voice + language
const FIXED_VOICE = "verse";
const FIXED_LANG  = "en-US";

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// 🟢 Whisper transcription route
app.post("/transcribe", async (req, res) => {
  try {
    const audioBuffer = Buffer.from(req.body.audio, "base64"); // client sends mic audio as base64
    const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: (() => {
        const form = new FormData();
        form.append("file", audioBuffer, "speech.wav");
        form.append("model", "whisper-1");
        form.append("language", "en"); // 🔒 English-only transcription
        return form;
      })()
    });

    const data = await whisperResp.json();
    res.json({ text: data.text });
  } catch (err) {
    console.error("Whisper transcription failed:", err);
    res.status(500).json({ error: "Transcription failed" });
  }
});

// Session init for Realtime
app.post("/session", (req, res) => {
  res.json({
    client_secret: { value: process.env.OPENAI_API_KEY || "fake-token" },
    model: "gpt-4o-realtime-preview",
    voice: FIXED_VOICE,
    language: FIXED_LANG
  });
});

app.listen(PORT, () => {
  console.log(`✅ Hold-the-Bacon server running on http://localhost:${PORT}`);
});
