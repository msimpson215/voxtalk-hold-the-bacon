import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.static("public"));
app.use(express.json());

app.post("/session", async (req, res) => {
  try {
    const model = process.env.OPENAI_MODEL || "gpt-4o-realtime-preview";
    const voice = process.env.OPENAI_VOICE || "verse";
    const deepgramKey = process.env.DEEPGRAM_API_KEY;

    // Create a short-lived client_secret for OpenAI Realtime
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model, voice })
    });
    const data = await r.json();

    res.json({
      client_secret: data.client_secret,
      model,
      voice,
      deepgramKey
    });
  } catch (err) {
    console.error("Session error:", err);
    res.status(500).send("Failed to create session");
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
