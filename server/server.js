import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.post("/session", async (req, res) => {
  try {
    const model = "gpt-4o-realtime-preview";
    const voice = "verse";
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, voice }),
    });

    const data = await r.json();
    res.json({ client_secret: data.client_secret, model, voice });
  } catch (err) {
    console.error("Session error:", err);
    res.status(500).send("Failed to create session");
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
