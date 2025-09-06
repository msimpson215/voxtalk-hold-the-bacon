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
  // 1. Get session info from server (OpenAI + Deepgram keys)
  const s = await fetch("/session", { method: "POST" });
  const { client_secret, model, voice, deepgramKey } = await s.json();

  // 2. --- OpenAI Realtime (voice output) ---
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
  pc.ontrack = (ev) => { rtAudio.srcObject = ev.streams[0]; };

  dc = pc.createDataChannel("events");
  dc.onmessage = (e) => {
    try {
      const evt = JSON.parse(e.data);
      if (evt.type === "response.message.delta") {
        const chunk = evt.delta.map(d => d.content?.[0]?.text || "").join("");
        if (chunk) appendLine("ai", chunk);
      }
    } catch {}
  };

  const offer = await pc.createOffer({ offerToReceiveAudio: true });
  await pc.setLocalDescription(offer);

  const r = await fetch(
    `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}&voice=${voice}&language=en-US`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${client_secret.value}`,
        "Content-Type": "application/sdp"
      },
      body: offer.sdp
    }
  );
  const answer = { type: "answer", sdp: await r.text() };
  await pc.setRemoteDescription(answer);

  dc.onopen = () => {
    dc.send(JSON.stringify({
      type: "session.update",
      session: {
        instructions: "Always respond ONLY in English. If user speaks another language, reply: 'Sorry, English only.'",
        voice, language: "en-US"
      }
    }));
  };

  // 3. --- Mic → Deepgram ---
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const dgSocket = new WebSocket(
    "wss://api.deepgram.com/v1/listen?model=nova&language=en",
    ["token", deepgramKey] // 👈 attaches your Deepgram key
  );

  // Force audio codec to opus
  const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0 && dgSocket.readyState === WebSocket.OPEN) {
      dgSocket.send(e.data);
    }
  };
  mediaRecorder.start(250); // send chunks every 250ms

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
}

// 4. Button handler
pttBtn.onclick = () => {
  talking = !talking;
  pttBtn.classList.toggle("listening", talking);
  appendLine("me", talking ? "(Listening…)" : "(Stopped)");
};

// 5. Start everything
async function init() {
  try {
    await initRealtime();
  } catch (err) {
    console.error("Init error:", err);
  }
}
init();
