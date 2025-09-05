const pttBtn = document.getElementById("pttBtn");
const answerEl = document.getElementById("answer");
const rtAudio = document.getElementById("remote");

let talking = false, dc;

function appendLine(role, text) {
  if (answerEl.querySelector(".muted")) answerEl.innerHTML = "";
  const div = document.createElement("div");
  div.className = "line";
  div.innerHTML = `<span class="${role}">${role==="me"?"You:":"AI:"}</span>
                   <span class="text">${text}</span>`;
  answerEl.appendChild(div);
  answerEl.scrollTop = answerEl.scrollHeight;
}

async function initRealtime() {
  // Get session info from server (OpenAI + Deepgram keys)
  const s = await fetch("/session", { method:"POST" });
  const { client_secret, model, voice, deepgramKey } = await s.json();

  // --- OpenAI Realtime (voice output) ---
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
  pc.ontrack = (ev) => { rtAudio.srcObject = ev.streams[0]; };

  dc = pc.createDataChannel("events");
  dc.onmessage = (e) => {
    try {
      const evt = JSON.parse(e.data);
      if (evt.type==="response.message.delta") {
        const chunk = evt.delta.map(d=>d.content?.[0]?.text||"").join("");
        if (chunk) appendLine("ai", chunk);
      }
    } catch {}
  };

  const offer = await pc.createOffer({ offerToReceiveAudio:true });
  await pc.setLocalDescription(offer);

  const r = await fetch(
    `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}&voice=${voice}&language=en-US`,
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

  dc.onopen = () => {
    dc.send(JSON.stringify({
      type:"session.update",
      session:{
        instructions:"Always respond ONLY in English. If user speaks another language, reply: 'Sorry, English only.'",
        voice, language:"en-US"
      }
    }));
  };

  // --- Mic → Deepgram ---
  const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
  const dgSocket = new WebSocket(
    "wss://api.deepgram.com/v1/listen?model=nova&language=en",
    ["token", deepgramKey]
  );

  const mediaRecorder = new MediaRecorder(stream, { mimeType:"audio/webm" });
  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0 && dgSocket.readyState === 1) {
      dgSocket.send(e.data);
    }
  };
  mediaRecorder.start(250);

  dgSocket.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    if (transcript && transcript.length > 0) {
      appendLine("me", transcript);
      dc.send(JSON.stringify({
        type:"response.create",
        response:{ instructions: transcript }
      }));
    }
  };
}

pttBtn.onclick = () => {
  talking = !talking;
  pttBtn.classList.toggle("listening", talking);
  appendLine("me", talking ? "(Listening…)" : "(Stopped)");
};

initRealtime();

