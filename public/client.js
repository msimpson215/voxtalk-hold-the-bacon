const pttBtn = document.getElementById("pttBtn");
const answerEl = document.getElementById("answer");
const rtAudio = document.getElementById("remote");

let talking = false, dc;

function appendLine(role, text) {
  if (answerEl.querySelector(".muted")) answerEl.innerHTML = "";
  const div = document.createElement("div");
  div.className = "line";
  div.innerHTML = `<span class="${role}">${role==="me" ? "You:" : "AI:"}</span>
                   <span class="text">${text}</span>`;
  answerEl.appendChild(div);
  answerEl.scrollTop = answerEl.scrollHeight;
}

async function initRealtime() {
  // 1. Get session info from server
  const s = await fetch("/session", { method: "POST" });
  const { client_secret, model, voice, deepgramKey } = await s.json();
  console.log("SESSION DATA:", { client_secret, model, voice, deepgramKey });

  // 2. --- OpenAI Realtime (voice output) ---
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
  pc.ontrack = (ev) => { 
    console.log("📡 Got remote audio track from OpenAI");
    rtAudio.srcObject = ev.streams[0]; 
  };

  dc = pc.createDataChannel("events");
  dc.onopen = () => {
    console.log("✅ DataChannel open to OpenAI");
    // 🔧 Force English audio-only replies
    dc.send(JSON.stringify({
      type:"session.update",
      session:{
        instructions: "Always respond in English with spoken audio only. Do not transcribe or send background noises. Talk directly to the user.",
        voice:"verse",
        modalities:["audio"] // no transcripts, just audio
      }
    }));
  };

  dc.onmessage = (e) => {
    console.log("📩 RAW MESSAGE FROM OPENAI:", e.data);
    try {
      const evt = JSON.parse(e.data);
      if (evt.type === "response.message.delta") {
        const chunk = evt.delta.map(d => d.content?.[0]?.text || "").join("");
        if (chunk) {
          console.log("📝 OpenAI text delta:", chunk);
          appendLine("ai", chunk);
        }
      }
    } catch (err) {
      console.error("Message parse error:", err);
    }
  };

  const offer = await pc.createOffer({ offerToReceiveAudio:true });
  await pc.setLocalDescription(offer);

  const r = await fetch(
    `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}&voice=${voice}`,
    {
      method:"POST",
      headers:{
        "Authorization":`Bearer ${client_secret.value}`,
        "Content-Type":"application/sdp"
      },
      body: offer.sdp
    }
  );
  const answer = { type:"answer", sdp: await r.text() };
  await pc.setRemoteDescription(answer);

  // 3. --- Mic → Deepgram ---
  const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
  const dgSocket = new WebSocket(
    "wss://api.deepgram.com/v1/listen?model=nova&language=en",
    ["token", deepgramKey]
  );

  const mediaRecorder = new MediaRecorder(stream, { mimeType:"audio/webm;codecs=opus" });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0 && dgSocket.readyState === WebSocket.OPEN) {
      dgSocket.send(e.data);
    }
  };
  mediaRecorder.start(250);

  dgSocket.onopen = () => console.log("✅ Deepgram socket open");
  dgSocket.onmessage = (msg) => {
    console.log("📩 RAW FROM DEEPGRAM:", msg.data);
    try {
      const data = JSON.parse(msg.data);
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      if (transcript && transcript.length > 0) {
        console.log("🎤 Deepgram transcript:", transcript);
        appendLine("me", transcript);
        dc.send(JSON.stringify({
          type:"response.create",
          response:{ instructions: transcript }
        }));
      }
    } catch (err) {
      console.error("Deepgram parse error:", err);
    }
  };
}

// Button handler (simple, no pulsing mic)
pttBtn.onclick = () => {
  talking = !talking;
  appendLine("me", talking ? "(Listening…)" : "(Stopped)");
};

// Start
async function init() {
  try {
    await initRealtime();
  } catch (err) {
    console.error("Init error:", err);
  }
}
init();
