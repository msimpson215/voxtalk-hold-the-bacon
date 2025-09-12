let micTrack; // keep a reference

async function initRealtime() {
  // ... session + peer connection setup ...

  // Get mic once, add track once
  const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
  micTrack = stream.getTracks()[0];
  pc.addTrack(micTrack, stream);  // only add once
  micTrack.enabled = false;       // start muted
  console.log("🎙️ Mic ready (press spacebar to enable)");
}

function startTalking() {
  if (micTrack) {
    micTrack.enabled = true;
    console.log("🎙️ Talking...");
    timeoutId = setTimeout(stopTalking, 30000); // auto-stop after 30s
  }
}

function stopTalking() {
  if (micTrack) {
    micTrack.enabled = false;
    console.log("🔇 Mic stopped");
    if (timeoutId) clearTimeout(timeoutId);
  }
}
