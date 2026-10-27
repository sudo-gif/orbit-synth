export type Chart = {
  signName: string;
  scaleName: string;
  scaleFreqs: number[];
  bpm: number;
  planetSeeds: number[];
  hue: number; // 0-1, アクセントカラー
  fortuneText: string;
};

// 誕生月に対応する12の宇宙サイン(現実の占星術ではなく、この作品独自のもの)
const SIGNS = [
  "氷河の目", "深紅の獅子", "静寂の梟", "黄金の麦穂",
  "蒼炎の魚", "銀糸の蜘蛛", "満月の兎", "漆黒の鴉",
  "朝霧の鹿", "砂漠の狐", "深海の鯨", "極光の狼",
];

const SCALES: { name: string; freqs: number[] }[] = [
  { name: "月のペンタトニック(Aマイナー)", freqs: [110.0, 130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33] },
  { name: "陽のペンタトニック(Cメジャー)", freqs: [130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25] },
  { name: "霧のペンタトニック(Dマイナー)", freqs: [146.83, 164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 739.99] },
  { name: "焔のペンタトニック(Eマイナー)", freqs: [164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0] },
  { name: "水のペンタトニック(Gメジャー)", freqs: [196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0, 987.77] },
];

const TRAITS = [
  "直感が鋭く、静かな閃きを信じる", "情熱を内に秘めた、ゆるやかな炎を持つ",
  "言葉より先に、感覚で世界を掴む", "ひとつの軌道に、深くこだわる",
  "絶えず揺れながら、均衡を探している", "遠くの光に、心を寄せやすい",
  "小さな音にも、宇宙を聴き取る", "誰かと響き合うことで、満ちていく",
];

const TIME_MOODS: { range: [number, number]; mood: string; note: string }[] = [
  { range: [0, 5], mood: "夜明け前の静寂", note: "まだ誰も知らない時間に生まれ、物事の始まりを見通す力を持つ" },
  { range: [5, 11], mood: "光が満ちる朝", note: "朝に生まれ、新しいことを始める勇気にあふれている" },
  { range: [11, 17], mood: "太陽が高く昇る昼", note: "昼に生まれ、まわりを照らす強さを持つ" },
  { range: [17, 21], mood: "夕暮れの境界", note: "夕暮れに生まれ、ふたつの世界をつなぐ感受性を持つ" },
  { range: [21, 24], mood: "星が目覚める夜", note: "夜に生まれ、静けさの中でこそ本当の声を持つ" },
];

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

export function computeChart(dateStr: string, timeStr: string): Chart {
  const safeTime = timeStr || "12:00";
  const date = new Date(`${dateStr}T${safeTime}:00`);
  const valid = !isNaN(date.getTime());
  const month = valid ? date.getMonth() : 0;
  const hour = valid ? date.getHours() : 12;

  const rand = mulberry32(hashString(`${dateStr}T${safeTime}`));

  const signName = SIGNS[month % 12];
  const scale = SCALES[Math.floor(rand() * SCALES.length)];
  const bpm = Math.round(84 + rand() * 56); // 84-140
  const planetCount = 3 + Math.floor(rand() * 4); // 3-6
  const planetSeeds = Array.from({ length: planetCount }, () => rand());
  const trait = TRAITS[Math.floor(rand() * TRAITS.length)];
  const timeMood = TIME_MOODS.find((m) => hour >= m.range[0] && hour < m.range[1]) ?? TIME_MOODS[2];
  const hue = (month / 12 + rand() * 0.08) % 1;

  const fortuneText =
    `あなたは『${signName}』の下、${timeMood.mood}に生まれた。\n` +
    `${timeMood.note}。${trait}。\n` +
    `今のあなたに合う調べは「${scale.name}」。`;

  return { signName, scaleName: scale.name, scaleFreqs: scale.freqs, bpm, planetSeeds, hue, fortuneText };
}
