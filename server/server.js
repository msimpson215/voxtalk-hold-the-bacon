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

app.use(express.static(path.join(__dirname, "../public")));

app.get("/health", (req, res) => {
  res.send("OK");
});

app.post("/session", async (req, res) => {
  try {
    const model = "gpt-4o-realtime-preview";
    const voice = "verse";
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

   //  NOTE!! MARTY:  Directly below I commented out this section and added a change to it down below: the system instruction which tells OpenAI to never relpy in Spanish. See if this works.
   //  you can revert this if it's breaking anything.  - Tim 

   // const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
   //   method: "POST",
   //   headers: {
   //    Authorization: `Bearer ${openaiKey}`,
   //     "Content-Type": "application/json"
   //   },
   //   body: JSON.stringify({ model, voice })
   // });

    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        voice,
        instructions: "You are an AI voice assistant. ALWAYS respond in English. Never default to Spanish. If the user speaks another language, translate it and reply only in English."
      })
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
