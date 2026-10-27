// 四柱推命(簡易実装)。年柱・月柱は立春/節気(太陽黄経)を基準に、
// 日柱はユリウス通日からの干支計算、時柱は五鼠遁の規則で算出する、
// 伝統的な計算手順に基づいた実装。

export type Pillar = { stem: string; branch: string; element: string };

export type BaziChart = {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar;
  dayMasterElement: string;
  elementCounts: Record<string, number>;
  hue: number;
  fortuneText: string;
  future: { label: string; text: string }[];
  scaleName: string;
  scaleFreqs: number[];
  bpm: number;
};

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const STEM_ELEMENT = ["木", "木", "火", "火", "土", "土", "金", "金", "水", "水"];
const BRANCH_ELEMENT = ["水", "土", "木", "木", "土", "火", "火", "土", "金", "金", "土", "水"];

export const ELEMENT_COLORS: Record<string, number> = {
  木: 0x9fd49a, 火: 0xf0917a, 土: 0xe0b06a, 金: 0xf0e8d8, 水: 0x9ab8e0,
};

const ELEMENT_TRAITS: Record<string, string> = {
  木: "まっすぐ伸びようとする、しなやかな成長の力を持つ",
  火: "瞬間に燃え上がる、熱量を隠し持っている",
  土: "すべてを受け止める、揺るがない重みを持つ",
  金: "磨かれるほど輝きを増す、芯の強さを持つ",
  水: "形を変えながら、どこまでも流れていく柔軟さを持つ",
};

const FUTURE_BY_ELEMENT: Record<string, { label: string; pool: string[] }[]> = {
  木: [
    { label: "数週間先", pool: ["新しい芽が、思わぬ場所から顔を出す", "伸ばしかけていた枝が、ふいに注目される"] },
    { label: "半年先", pool: ["根を張った場所で、確かな幹が育つ", "これまでの成長が、誰かの目に留まる"] },
    { label: "一年以上先", pool: ["小さな林が、いつしか森になっている", "まいた種が、思わぬ形で実を結ぶ"] },
  ],
  火: [
    { label: "数週間先", pool: ["小さな火花が、大きな熱を生む", "一瞬の閃きが、次の一歩を照らす"] },
    { label: "半年先", pool: ["燃やしてきた情熱が、誰かの心にも灯る", "静かだった炎が、再び勢いを増す"] },
    { label: "一年以上先", pool: ["ずっと灯してきた火が、道しるべになっている", "熱の残り火が、新しい何かを温めている"] },
  ],
  土: [
    { label: "数週間先", pool: ["積み上げてきた土台に、小さな石が足される", "揺らいだ地面が、静かに均されていく"] },
    { label: "半年先", pool: ["築いてきた場所に、誰かが根を下ろし始める", "耕してきた畑に、最初の芽が出る"] },
    { label: "一年以上先", pool: ["見渡す限りの土地が、豊かに実っている", "長い年月が、揺るがない基盤になっている"] },
  ],
  金: [
    { label: "数週間先", pool: ["磨いてきた何かが、ふいに輝きを放つ", "鋭さが、思わぬ場面で役に立つ"] },
    { label: "半年先", pool: ["削り続けた形が、ようやく定まってくる", "固く結んだ約束が、形になり始める"] },
    { label: "一年以上先", pool: ["長く磨かれた刃が、誰かを助けている", "積み重ねた精度が、揺るがない信頼になる"] },
  ],
  水: [
    { label: "数週間先", pool: ["小さな流れが、思わぬ場所にたどり着く", "滞っていた何かが、静かに動き出す"] },
    { label: "半年先", pool: ["合流した流れが、より大きな川になる", "低い場所に、自然と人が集まり始める"] },
    { label: "一年以上先", pool: ["巡り巡った水が、遠い海にたどり着いている", "流れ続けたことが、誰かの渇きを潤している"] },
  ],
};

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

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** 太陽の黄経(簡易近似式) */
function sunEclipticLongitude(utc: Date): number {
  const d = (utc.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const g = toRad(norm360(357.529 + 0.98560028 * d));
  const L = norm360(280.459 + 0.98564736 * d);
  return norm360(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
}

function gregorianToJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

const MONTH_START_STEM: Record<number, number> = {
  0: 2, 5: 2, // 甲/己年 -> 丙(2)から
  1: 4, 6: 4, // 乙/庚年 -> 戊(4)から
  2: 6, 7: 6, // 丙/辛年 -> 庚(6)から
  3: 8, 8: 8, // 丁/壬年 -> 壬(8)から
  4: 0, 9: 0, // 戊/癸年 -> 甲(0)から
};
const HOUR_START_STEM: Record<number, number> = {
  0: 0, 5: 0, // 甲/己日 -> 甲(0)から
  1: 2, 6: 2, // 乙/庚日 -> 丙(2)から
  2: 4, 7: 4, // 丙/辛日 -> 戊(4)から
  3: 6, 8: 6, // 丁/壬日 -> 庚(6)から
  4: 8, 9: 8, // 戊/癸日 -> 壬(8)から
};

function pillarFrom(stemIdx: number, branchIdx: number): Pillar {
  const s = ((stemIdx % 10) + 10) % 10;
  const b = ((branchIdx % 12) + 12) % 12;
  return { stem: STEMS[s], branch: BRANCHES[b], element: STEM_ELEMENT[s] };
}

export function computeBaziChart(dateStr: string, timeStr: string): BaziChart {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh] = (timeStr || "12:00").split(":").map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  // 年柱: 立春(おおよそ2/4)を年の境目とする簡易基準
  const baziYear = m < 2 || (m === 2 && d < 4) ? y - 1 : y;
  const yearStemIdx = ((baziYear - 4) % 10 + 10) % 10;
  const yearBranchIdx = ((baziYear - 4) % 12 + 12) % 12;
  const year = pillarFrom(yearStemIdx, yearBranchIdx);

  // 月柱: 太陽黄経から月支を決め、年干から五虎遁で月干を決める
  const sunLon = sunEclipticLongitude(utcNoon);
  const adjLon = norm360(sunLon - 315);
  const monthStep = Math.floor(adjLon / 30); // 0=寅,1=卯,...,11=丑
  const MONTH_BRANCH_ORDER = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1]; // 寅から始まる地支インデックス列
  const monthBranchIdx = MONTH_BRANCH_ORDER[monthStep];
  const monthStemStart = MONTH_START_STEM[yearStemIdx];
  const monthStemIdx = (monthStemStart + monthStep) % 10;
  const month = pillarFrom(monthStemIdx, monthBranchIdx);

  // 日柱: ユリウス通日からの六十干支計算
  const jdn = gregorianToJDN(y, m, d);
  const dayGanzhi = ((jdn + 49) % 60 + 60) % 60;
  const dayStemIdx = dayGanzhi % 10;
  const dayBranchIdx = dayGanzhi % 12;
  const day = pillarFrom(dayStemIdx, dayBranchIdx);

  // 時柱: 時刻から時支を、日干から五鼠遁で時干を決める
  const hourBranchIdx = Math.floor(((hh + 1) % 24) / 2);
  const hourStemStart = HOUR_START_STEM[dayStemIdx];
  const hourStemIdx = (hourStemStart + hourBranchIdx) % 10;
  const hour = pillarFrom(hourStemIdx, hourBranchIdx);

  const dayMasterElement = day.element;

  const elementCounts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const [sIdx, bIdx] of [
    [yearStemIdx, yearBranchIdx], [monthStemIdx, monthBranchIdx],
    [dayStemIdx, dayBranchIdx], [hourStemIdx, hourBranchIdx],
  ]) {
    elementCounts[STEM_ELEMENT[sIdx]]++;
    elementCounts[BRANCH_ELEMENT[bIdx]]++;
  }
  const dominant = Object.entries(elementCounts).sort((a, b) => b[1] - a[1])[0][0];

  const rand = mulberry32(hashString(`${dateStr}T${timeStr}#bazi`));
  const fortuneText =
    `四柱は『${year.stem}${year.branch} ${month.stem}${month.branch} ${day.stem}${day.branch} ${hour.stem}${hour.branch}』。\n` +
    `日主(あなたの核)は『${day.stem}』— ${ELEMENT_TRAITS[dayMasterElement]}。\n` +
    `八字の中でもっとも多いのは『${dominant}』の気。全体の調子を支えている。`;

  const futurePool = FUTURE_BY_ELEMENT[dayMasterElement];
  const future = futurePool.map((t) => ({ label: t.label, text: t.pool[Math.floor(rand() * t.pool.length)] }));

  const ELEMENT_HUE: Record<string, number> = { 木: 0.33, 火: 0.02, 土: 0.11, 金: 0.0, 水: 0.58 };
  const SCALES = [
    { name: "木のペンタトニック(Eマイナー)", freqs: [164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0] },
    { name: "火のペンタトニック(Cメジャー)", freqs: [130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25] },
    { name: "土のペンタトニック(Aマイナー)", freqs: [110.0, 130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33] },
    { name: "金のペンタトニック(Dマイナー)", freqs: [146.83, 164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 739.99] },
    { name: "水のペンタトニック(Gメジャー)", freqs: [196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0, 987.77] },
  ];
  const elementIndex = ["木", "火", "土", "金", "水"].indexOf(dayMasterElement);
  const scale = SCALES[elementIndex];
  const bpm = Math.round(76 + hourBranchIdx * 5);

  return {
    year, month, day, hour, dayMasterElement, elementCounts,
    hue: ELEMENT_HUE[dayMasterElement],
    fortuneText, future,
    scaleName: scale.name, scaleFreqs: scale.freqs, bpm,
  };
}
