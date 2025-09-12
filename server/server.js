dgSocket.onmessage = (msg) => {
  console.log("📩 Deepgram raw:", msg.data);
  try {
    const data = JSON.parse(msg.data);
    const alt = data.channel?.alternatives?.[0];
    const transcript = alt?.transcript;
    if (transcript && transcript.length > 0 && data.is_final) {
      appendLine("me", transcript);
      dc.send(JSON.stringify({
        type:"response.create",
        response:{ instructions: transcript }
      }));
    }
  } catch (err) {
    console.error("Parse error:", err);
  }
};
