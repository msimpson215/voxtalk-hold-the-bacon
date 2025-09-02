<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>VoxTalk</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="data:,">
  <style>
    body {
      margin:0; font-family:system-ui,sans-serif;
      display:grid; place-items:center; min-height:100vh;
      background: radial-gradient(circle at 50% 20%, #dbeafe, #93c5fd 40%, #1e3a8a 90%);
    }
    .app { text-align:center; }
    h1 { margin:6px 0; font-size:22px; }
    #pttBtn {
      width:120px; height:120px;
      border-radius:50%; border:none; cursor:pointer;
      background: radial-gradient(circle at 30% 30%, #3b82f6, #1e40af);
      box-shadow:0 6px 18px rgba(37,99,235,.3);
      transition: transform 0.15s ease;
    }
    #pttBtn.listening {
      animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse {
      0%   { box-shadow:0 0 0 0 rgba(59,130,246,.7); }
      50%  { box-shadow:0 0 0 20px rgba(59,130,246,0); }
      100% { box-shadow:0 0 0 0 rgba(59,130,246,0); }
    }
  </style>
</head>
<body>
  <div class="app">
    <h1>Talk to VoxTalk</h1>
    <button id="pttBtn">🎤</button>
    <audio id="remote" autoplay playsinline></audio>
  </div>

  <script>
    const pttBtn = document.getElementById("pttBtn");
    const rtAudio = document.getElementById("remote");
    let wakeLock = null, talking = false, dc, micSocket;

    async function requestWakeLock() {
      try { wakeLock = await navigator.wakeLock.request("screen"); }
      catch {}
    }
    async function releaseWakeLock() {
      if (wakeLock) { await wakeLock.release(); wakeLock = null; }
    }

    async function initRealtime() {
      const s = await fetch("/session",{method:"POST"});
      const { client_secret, model, voice, language } = await s.json();

      const pc = new RTCPeerConnection();
      pc.ontrack = (ev)=>{ rtAudio.srcObject = ev.streams[0]; };

      dc = pc.createDataChannel("events");

      const offer = await pc.createOffer({ offerToReceiveAudio:true });
      await pc.setLocalDescription(offer);

      const r = await fetch(
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}&voice=${voice}&language=${language}`,
        {
          method:"POST",
          headers:{
            "Authorization":`Bearer ${client_secret.value}`,
            "Content-Type":"application/sdp"
          },
          body: offer.sdp
        }
      );
      const answer = {type:"answer", sdp: await r.text()};
      await pc.setRemoteDescription(answer);

      // lock English-only
      dc.onopen = () => {
        dc.send(JSON.stringify({
          type:"session.update",
          session:{
            instructions:"Always respond ONLY in English. Refuse other languages.",
            voice, language:"en-US"
          }
        }));
      };

      // 🔹 Connect mic socket to server
      micSocket = new WebSocket(`wss://${window.location.host}`);
      micSocket.onmessage = (event) => {
        const { text } = JSON.parse(event.data);
        if (text) {
          dc.send(JSON.stringify({ type:"response.create", response:{ instructions:text } }));
        }
      };

      // Capture mic → send PCM16
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (!talking || micSocket.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i=0; i<input.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
        }
        micSocket.send(pcm16.buffer);
      };

      // 🎤 Button toggle
      pttBtn.onclick = async ()=>{
        talking = !talking;
        pttBtn.classList.toggle("listening", talking);
        if (talking) {
          await requestWakeLock();
        } else {
          await releaseWakeLock();
        }
      };
    }
    initRealtime();
  </script>
</body>
</html>
