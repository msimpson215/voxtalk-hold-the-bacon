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
  // Create OpenAI session
  const s = await fetch("/session", { method:"POST" });
  const { client_secret, model, voice } = await s.json();

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

  // --- connect to OpenAI realtime ---
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

  // 🎙 Mic → Deepgram → Text → OpenAI
  const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
  // send audio to Deepgram WS
  const dg = new WebSocket("wss://api.deepgram.com/v1/listen?model=nova", {
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` }
  });

  dg.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.channel && data.channel.alternatives[0]) {
      const transcript = data.channel.alternatives[0].transcript;
      if (transcript && transcript.length > 0) {
        appendLine("me", transcript);
        dc.send(JSON.stringify({
          type:"response.create",
          response:{ instructions: transcript }
        }));
      }
    }
  };

  stream.getTracks().forEach(track => dg.send(track));
}

pttBtn.onclick = () => {
  talking = !talking;
  pttBtn.classList.toggle("listening", talking);
  appendLine("me", talking ? "(Listening…)" : "(Stopped)");
};

initRealtime();
