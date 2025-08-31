(function(){
  const BASE = (window.VT_BASE || location.origin);  // works standalone or when embedded elsewhere

  // ---- Shadow UI (prevents CSS clashes) ----
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = host.attachShadow({mode:'open'});
  const css = document.createElement('style');
  css.textContent = `
    .vt-launcher{position:fixed;right:18px;bottom:18px;z-index:9999999}
    .vt-btn{all:unset;cursor:pointer;padding:12px 14px;border-radius:999px;background:#1f6feb;color:#fff;
      box-shadow:0 8px 20px rgba(0,0,0,.15);font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
    .vt-panel{position:fixed;right:18px;bottom:78px;width:320px;max-width:95vw;background:#fff;color:#111;border-radius:16px;
      box-shadow:0 16px 40px rgba(0,0,0,.2);padding:14px;display:none}
    .vt-row{display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap}
    .vt-answer{white-space:pre-wrap;font-size:14px;background:#f6f8fa;border-radius:10px;padding:10px;min-height:52px}
    .vt-mini{font-size:12px;opacity:.8}
    .vt-primary,.vt-ghost,.vt-danger{all:unset;cursor:pointer;padding:10px 12px;border-radius:10px}
    .vt-primary{background:#1f6feb;color:#fff}
    .vt-ghost{background:#e6eefc;color:#0b3d91}
    .vt-danger{background:#fee2e2;color:#991b1b}
  `;
  root.appendChild(css);

  const panel = document.createElement('div');
  panel.className = 'vt-panel';
  panel.innerHTML = `
    <div class="vt-row" style="justify-content:space-between">
      <div style="font-weight:600">AI Assistant</div>
      <button id="x" class="vt-ghost">✕</button>
    </div>
    <div id="s" class="vt-mini">Tap Speak. First time will ask for mic permission.</div>
    <div class="vt-row">
      <button id="speak" class="vt-primary">🎙️ Speak</button>
      <button id="stop" class="vt-danger" style="display:none">⏹ Stop</button>
      <button id="resume" class="vt-ghost" style="display:none">▶️ Resume</button>
    </div>
    <div class="vt-row"><button id="typeDemo" class="vt-ghost">Ask “What is Lightship RV?”</button></div>
    <div id="a" class="vt-answer" style="margin-top:10px;"></div>
  `;
  root.appendChild(panel);

  const launcher = document.createElement('div');
  launcher.className = 'vt-launcher';
  launcher.innerHTML = `<button id="open" class="vt-btn">💬 Talk to our AI</button>`;
  root.appendChild(launcher);

  // ---- Logic ----
  const $ = id => panel.querySelector('#'+id);
  const btnOpen = launcher.querySelector('#open');
  const btnClose = $('x');
  const btnSpeak = $('speak');
  const btnStop = $('stop');
  const btnResume = $('resume');
  const btnTypeDemo = $('typeDemo');
  const statusEl = $('s');
  const answerEl = $('a');

  const player = new Audio();
  let rec = null, fetchAbort = null, audioPrimed = false;

  function showPanel(v){ panel.style.display = v ? 'block' : 'none'; }
  btnOpen.onclick = () => showPanel(true);
  btnClose.onclick = () => showPanel(false);

  async function primeAudio(){
    if (audioPrimed) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1,1,22050);
      src.connect(ctx.destination);
      src.start();
      audioPrimed = true;
    } catch {}
  }

  function setBusy(msg){ statusEl.textContent = msg; }

  function stopSpeech(keepPos=true){
    if (fetchAbort) { try{fetchAbort.abort();}catch{} fetchAbort=null; }
    try { player.pause(); } catch {}
    if (!keepPos) player.currentTime = 0;
    btnStop.style.display = 'none';
    btnResume.style.display = 'inline-block';
    setBusy('Paused.');
  }
  btnStop.onclick = () => stopSpeech(true);
  btnResume.onclick = async () => {
    try { await player.play(); btnStop.style.display='inline-block'; btnResume.style.display='none'; setBusy('Speaking…'); } catch {}
  };
  player.onended = () => { btnStop.style.display='none'; btnResume.style.display='none'; setBusy('Ready.'); };

  function initRecognition(){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR) return null;
    const r = new SR();
    r.lang='en-US'; r.interimResults=false; r.continuous=false; r.maxAlternatives=1;
    r.onstart  = () => setBusy('Listening…');
    r.onerror  = e => setBusy('Mic error: ' + (e?.error || e));
    r.onresult = async (e)=>{
      const said = e.results?.[0]?.[0]?.transcript || '';
      if (!said.trim()) { setBusy('No speech detected.'); return; }
      await askAndSpeak(said);
    };
    return r;
  }

  async function speakText(text){
    await primeAudio();
    // keep short for fast TTS start
    const short = text.split(/(?<=[.!?])\s+/).slice(0,2).join(' ').slice(0,380) || text;
    try{
      fetchAbort = new AbortController();
      btnStop.style.display='inline-block'; btnResume.style.display='none';
      setBusy('Generating speech…');
      const r = await fetch(`${BASE}/tts`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text: short }),
        signal: fetchAbort.signal
      });
      if(!r.ok){ const t = await r.text().catch(()=> ''); throw new Error(`TTS ${r.status} ${t}`); }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      player.src = url;
      await player.play();
      setBusy('Speaking…');
    } catch(e){
      if (e.name === 'AbortError') setBusy('Stopped.');
      else { setBusy('TTS error'); console.error(e); }
    } finally { fetchAbort = null; }
  }

  async function askAndSpeak(message){
    setBusy('Thinking…');
    answerEl.textContent = '';
    try{
      const r = await fetch(`${BASE}/chat`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message, concise:true })
      });
      const data = await r.json();
      const text = data?.choices?.[0]?.message?.content || data?.error || JSON.stringify(data,null,2);
      answerEl.textContent = text;
      setBusy('Answer ready.');
      await speakText(text);
    } catch(e){
      answerEl.textContent = 'Error: ' + (e?.message || e);
      setBusy('Error.');
    }
  }

  btnSpeak.onclick = async () => {
    await primeAudio();
    if (!rec) rec = initRecognition();
    if (!rec) { setBusy('Speech recognition not supported.'); return; }
    try { rec.start(); } catch { setBusy('Could not start mic.'); }
  };

  btnTypeDemo.onclick = () => askAndSpeak('What is Lightship RV?');

  // Minimal API to open/close from page links
  window.VT_WIDGET = { open(){ showPanel(true); }, close(){ showPanel(false); } };
})();
