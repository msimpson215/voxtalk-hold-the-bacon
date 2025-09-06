// --- Mic → Deepgram ---
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// Create Deepgram WebSocket with token auth
const dgSocket = new WebSocket(
  "wss://api.deepgram.com/v1/listen?model=nova&language=en",
  ["token", deepgramKey]  // 👈 This attaches your key
);

// Send mic audio to Deepgram
const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
mediaRecorder.ondataavailable = (e) => {
  if (e.data.size > 0 && dgSocket.readyState === WebSocket.OPEN) {
    dgSocket.send(e.data);
  }
};
mediaRecorder.start(250); // send chunks every 250ms

// Handle Deepgram transcripts
dgSocket.onmessage = (msg) => {
  try {
    const data = JSON.parse(msg.data);
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    if (transcript && transcript.length > 0) {
      appendLine("me", transcript);
      dc.send(JSON.stringify({
        type: "response.create",
        response: { instructions: transcript }
      }));
    }
  } catch (err) {
    console.error("Deepgram error:", err);
  }
};
