import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import FormData from "form-data";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const FIXED_VOICE = "verse";
const FIXED_LANG  = "en-US";

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "../public")));

// 🔹 Streaming transcription endpoint (Whisper, locked to English)
app.post("/transcribe-stream", async (req, res) => {
  try {
    const audioBuffer = Buffer.from(req.body.audio, "base64");

    const form = new FormData();
    form.append("file", Readable.from(audioBuffer), {
      filename: "audio.wav",
      contentType: "audio/wav"
    });
    form.append("model", "whisper-1");
    form.append("language", "en"); // 🔒 force English transcription

    const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
    });

    const data = await whisperResp.json();
    res.json({ text: data.text });
  } catch (err) {
    console.error("❌ Whisper streaming failed:", err);
    res.status(500).json({ error: "Transcription failed" });
  }
});

// 🔹 Session for OpenAI Realtime
app.post("/session", (req, res) => {
  res.json({
    client_secret: { value: process.env.OPENAI_API_KEY || "fake-token" },
    model: "gpt-4o-realtime-preview",
    voice: FIXED_VOICE,
    language: FIXED_LANG
  });
});

app.listen(PORT, () => {
  console.log(`✅ Hold-the-Bacon running on http://localhost:${PORT}`);
});
