const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;

// Aマイナーペンタトニック(常に心地よく響く) — デフォルト/占い未入力時の調べ
const DEFAULT_SCALE = [110.0, 130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
const DEFAULT_BPM = 112;

export class AudioEngine {
  private ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  private master = this.ctx.createGain();
  private reverb: ConvolverNode;
  private reverbSend = this.ctx.createGain();
  analyser = this.ctx.createAnalyser();
  private freqData: Uint8Array<ArrayBuffer>;

  private scale: number[] = DEFAULT_SCALE;
  private stepSeconds = 60 / DEFAULT_BPM / 4;

  private step = 0;
  private nextStepTime = 0;
  private schedulerId: number | null = null;

  constructor() {
    this.master.gain.value = 0.8;
    this.analyser.fftSize = 256;
    this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.makeImpulseResponse(2.5, 2.2);
    this.reverbSend.gain.value = 0.35;

    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.analyser);
  }

  /** 占いの結果などから、調べ(スケール)とテンポを差し替える */
  configure(scaleFreqs: number[], bpm: number): void {
    this.scale = scaleFreqs;
    this.stepSeconds = 60 / bpm / 4;
    this.step = 0;
  }

  private makeImpulseResponse(seconds: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const length = rate * seconds;
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  async resume(): Promise<void> {
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (this.schedulerId === null) this.startAutoBeat();
  }

  /** 音の強さ(0-1)。背景のオーディオリアクティブ表現に使う */
  getLevel(): number {
    this.analyser.getByteFrequencyData(this.freqData);
    let sum = 0;
    for (let i = 0; i < this.freqData.length; i++) sum += this.freqData[i];
    return sum / this.freqData.length / 255;
  }

  /** 低域・中域・高域の3バンドレベル(0-1)。背景の色分けに使う */
  getBands(): { low: number; mid: number; high: number } {
    this.analyser.getByteFrequencyData(this.freqData);
    const n = this.freqData.length;
    const avg = (from: number, to: number) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += this.freqData[i];
      return sum / (to - from) / 255;
    };
    return {
      low: avg(0, Math.floor(n * 0.15)),
      mid: avg(Math.floor(n * 0.15), Math.floor(n * 0.5)),
      high: avg(Math.floor(n * 0.5), n),
    };
  }

  /** 惑星が周回を1周したときに鳴る音。半径をスケールに量子化してピッチを決め、軌道の帯ごとに音色を変える */
  playNote(radius: number, minR: number, maxR: number): void {
    const t = this.ctx.currentTime;
    const norm = clamp01(1 - (radius - minR) / Math.max(0.001, maxR - minR)); // 内側ほど高音
    const idx = Math.round(norm * (this.scale.length - 1));
    const freq = this.scale[idx];

    const gain = this.ctx.createGain();
    gain.connect(this.master);
    gain.connect(this.reverbSend);

    if (norm > 0.66) {
      // 内側の軌道: ベルのようなプラック(倍音を重ねる)
      this.pluck(freq, gain, t, 0.5, 2.0);
      this.pluck(freq * 2, gain, t, 0.12, 0.6);
    } else if (norm > 0.33) {
      // 中間軌道: やわらかいパッド
      this.pad(freq, gain, t, 0.9);
    } else {
      // 外側軌道: 低く長いサブトーン
      this.pluck(freq, gain, t, 0.22, 1.4, "sine");
    }
  }

  private pluck(freq: number, out: GainNode, t: number, peak: number, dur: number, type: OscillatorType = "triangle"): void {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private pad(freq: number, out: GainNode, t: number, dur: number): void {
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.18, t + 0.15);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    env.connect(out);
    for (const detune of [-5, 0, 5]) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(env);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  private playKick(time: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc.connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  /** 1小節の頭でルート音をうっすら鳴らし、全体の調性をまとめる */
  private playRootDrone(time: number): void {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.06, time + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepSeconds * 16);
    gain.connect(this.master);
    gain.connect(this.reverbSend);
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = this.scale[0] / 2;
    osc.connect(gain);
    osc.start(time);
    osc.stop(time + this.stepSeconds * 16 + 0.1);
  }

  private startAutoBeat(): void {
    this.nextStepTime = this.ctx.currentTime;
    const tick = () => {
      while (this.nextStepTime < this.ctx.currentTime + SCHEDULE_AHEAD_SECONDS) {
        if (this.step % 4 === 0) this.playKick(this.nextStepTime); // 4つ打ち
        if (this.step === 0) this.playRootDrone(this.nextStepTime);
        this.nextStepTime += this.stepSeconds;
        this.step = (this.step + 1) % 16;
      }
      this.schedulerId = window.setTimeout(tick, LOOKAHEAD_MS);
    };
    tick();
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
