      micSocket.onmessage = (event) => {
        const { text } = JSON.parse(event.data);
        if (text) {
          appendLine("me", text);
          dc.send(JSON.stringify({
            type:"response.create",
            response:{ instructions:text, modalities:["audio","text"] }
          }));
        }
      };

      // Capture mic audio
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

      // Button toggle
      pttBtn.onclick = ()=>{
        talking = !talking;
        pttBtn.classList.toggle("listening", talking);
        appendLine("me", talking ? "(Listening…)" : "(Stopped)");
      };
    }
    initRealtime();
  </script>
</body>
</html>
