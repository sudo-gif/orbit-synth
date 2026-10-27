// 数秘術(ピタゴラス式)。生年月日からライフパスナンバーを、
// 任意で入力した名前(アルファベット)からディスティニーナンバーを算出する。

export type NumerologyChart = {
  lifePath: number;
  isMasterLifePath: boolean;
  destiny: number | null;
  hue: number;
  color: number;
  vertices: number; // 幾何学模様の頂点数
  fortuneText: string;
  future: { label: string; text: string }[];
  scaleName: string;
  scaleFreqs: number[];
  bpm: number;
};

const NUMBER_COLORS: Record<number, number> = {
  1: 0xff4d4d, 2: 0xff9a4d, 3: 0xffe14d, 4: 0x6dff4d, 5: 0x4dd9ff,
  6: 0x6a4dff, 7: 0xb44dff, 8: 0xff4dc8, 9: 0xffffff, 11: 0xd0d0ff, 22: 0xffe6a8, 33: 0xffffff,
};

const NUMBER_TRAITS: Record<number, string> = {
  1: "何もない場所に、最初の一歩を刻む力を持つ",
  2: "ふたつのものをつなぎ、静かな調和を生み出す",
  3: "内にある輝きを、表現せずにいられない",
  4: "揺るがない土台を、こつこつと積み上げる",
  5: "自由を求め、変化そのものを生きる糧にする",
  6: "誰かを守り、育てることに喜びを見出す",
  7: "表面の奥にある真実を、静かに探し続ける",
  8: "目に見える形で、物事を動かす力を持つ",
  9: "個を超えて、大きな流れに心を寄せる",
  11: "直感という名の光を、人より強く放つ",
  22: "大きな夢を、現実の形に変えていく力を持つ",
  33: "惜しみない愛を、世界に差し出す器を持つ",
};

const FUTURE_TEMPLATES: Record<number, { label: string; pool: string[] }[]> = {};
function defaultFuture(n: number): { label: string; pool: string[] }[] {
  return [
    { label: "数週間先", pool: [`『${n}』の気配が、日常の中にふと現れる`, "何気ない選択が、意外な意味を持ち始める"] },
    { label: "半年先", pool: [`『${n}』らしさが、誰かの目にも見えるようになる`, "続けてきたことに、形が伴い始める"] },
    { label: "一年以上先", pool: [`『${n}』の物語が、ひとつの区切りを迎える`, "巡り巡って、最初の問いへの答えが見つかる"] },
  ];
}
for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33]) FUTURE_TEMPLATES[n] = defaultFuture(n);

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function digitSum(n: number): number {
  return String(Math.abs(n))
    .split("")
    .reduce((sum, ch) => sum + Number(ch), 0);
}

/** マスターナンバー(11/22/33)は途中で止める簡約 */
function reduceToLifePathNumber(n: number): number {
  let v = n;
  while (v > 9 && v !== 11 && v !== 22 && v !== 33) {
    v = digitSum(v);
  }
  return v;
}

const LETTER_VALUES: Record<string, number> = {
  a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9,
  j: 1, k: 2, l: 3, m: 4, n: 5, o: 6, p: 7, q: 8, r: 9,
  s: 1, t: 2, u: 3, v: 4, w: 5, x: 6, y: 7, z: 8,
};

function computeDestinyNumber(name: string): number | null {
  const letters = name.toLowerCase().replace(/[^a-z]/g, "");
  if (!letters) return null;
  let sum = 0;
  for (const ch of letters) sum += LETTER_VALUES[ch] ?? 0;
  return reduceToLifePathNumber(sum);
}

export function computeNumerologyChart(dateStr: string, timeStr: string, name: string): NumerologyChart {
  const digits = dateStr.replace(/-/g, "");
  const rawSum = digits.split("").reduce((s, ch) => s + Number(ch), 0);
  const lifePath = reduceToLifePathNumber(rawSum);
  const isMasterLifePath = lifePath === 11 || lifePath === 22 || lifePath === 33;
  const destiny = computeDestinyNumber(name);

  const rand = mulberry32(hashString(`${dateStr}T${timeStr}#${name}`));
  const color = NUMBER_COLORS[lifePath];
  const hue = isMasterLifePath ? 0.65 : ((lifePath - 1) / 9) * 0.9;

  const lines = [
    `あなたのライフパスナンバーは『${lifePath}』。`,
    `${NUMBER_TRAITS[lifePath]}。`,
  ];
  if (destiny !== null) {
    lines.push(`名前から導かれるディスティニーナンバーは『${destiny}』。`);
    lines.push(`${NUMBER_TRAITS[destiny]}。`);
  }
  const fortuneText = lines.join("\n");

  const future = FUTURE_TEMPLATES[lifePath].map((t) => ({ label: t.label, text: t.pool[Math.floor(rand() * t.pool.length)] }));

  const SCALES = [
    { name: "一のペンタトニック(Aマイナー)", freqs: [110.0, 130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33] },
    { name: "二のペンタトニック(Cメジャー)", freqs: [130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25] },
    { name: "三のペンタトニック(Dマイナー)", freqs: [146.83, 164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 739.99] },
    { name: "四のペンタトニック(Eマイナー)", freqs: [164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0] },
    { name: "五のペンタトニック(Gメジャー)", freqs: [196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0, 987.77] },
  ];
  const scale = SCALES[lifePath % SCALES.length];
  const bpm = Math.round(80 + (isMasterLifePath ? lifePath : lifePath * 6));

  const vertices = isMasterLifePath ? Math.min(12, lifePath / 2) : Math.max(3, lifePath);

  return { lifePath, isMasterLifePath, destiny, hue, color, vertices, fortuneText, future, scaleName: scale.name, scaleFreqs: scale.freqs, bpm };
}
