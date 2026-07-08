// Sarvam AI's speech-to-text API only accepts mp3/wav/pcm-style audio
// — it rejects the webm/ogg/mp4 formats browsers' built-in
// MediaRecorder produces natively ("Invalid file type: None"). Rather
// than requiring an ffmpeg install on the server to convert formats
// after the fact, this records raw PCM directly via the Web Audio API
// and wraps it in a WAV header right in the browser, so what gets
// uploaded is already something Sarvam accepts.
export class WavRecorder {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private samples: Float32Array[] = [];
  private sampleRate = 16000;

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    // Some browsers ignore the requested sampleRate and use their own
    // hardware default instead — sampleRate is re-read from the actual
    // context below rather than assumed, so the WAV header always
    // matches what was really captured.
    this.audioContext = new AudioContextCtor({ sampleRate: this.sampleRate });
    this.sampleRate = this.audioContext.sampleRate;

    this.source = this.audioContext.createMediaStreamSource(this.stream);

    // ScriptProcessorNode is deprecated but has universal browser
    // support; AudioWorklet would need a separate worklet file loaded
    // over a URL, which is extra complexity this doesn't need for a
    // simple one-shot recording.
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.samples = [];

    this.processor.onaudioprocess = (event) => {
      const channelData = event.inputBuffer.getChannelData(0);
      this.samples.push(new Float32Array(channelData));
    };

    this.source.connect(this.processor);
    // Chrome requires the processor to be connected to a destination
    // for onaudioprocess to fire at all, even though we don't want to
    // actually play the audio back out loud.
    this.processor.connect(this.audioContext.destination);
  }

  stop(): Blob {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.audioContext?.close();

    const totalLength = this.samples.reduce((sum, s) => sum + s.length, 0);
    const merged = new Float32Array(totalLength);

    let offset = 0;
    for (const chunk of this.samples) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return encodeWav(merged, this.sampleRate);
  }

  get hasAudio() {
    return this.samples.length > 0;
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // Standard 44-byte WAV header for 16-bit mono PCM.
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}