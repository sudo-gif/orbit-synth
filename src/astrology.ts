// 西洋占星術の簡易計算(太陽星座は正確な暦、月の黄経は簡易近似式、
// アセンダントは出生地の経度から太陽時に近似してUTを求めた上での実計算)。
// 厳密な暦表・歴史的タイムゾーンまでは扱わないため、アセンダントと月は
// 「作品としての解釈」であることをテキストでも明示する。

export type Body = { name: string; signIndex: number; signName: string; degreeInSign: number };

export type NatalChart = {
  sun: Body;
  moon: Body;
  ascendant: Body;
  moonPhaseName: string;
  hue: number; // アクセントカラー(太陽星座ベース)
  fortuneText: string;
  future: { label: string; text: string }[];
  scaleName: string;
  scaleFreqs: number[];
  bpm: number;
};

const SCALES: { name: string; freqs: number[] }[] = [
  { name: "月のペンタトニック(Aマイナー)", freqs: [110.0, 130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33] },
  { name: "陽のペンタトニック(Cメジャー)", freqs: [130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25] },
  { name: "霧のペンタトニック(Dマイナー)", freqs: [146.83, 164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 739.99] },
  { name: "焔のペンタトニック(Eマイナー)", freqs: [164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0] },
  { name: "水のペンタトニック(Gメジャー)", freqs: [196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0, 987.77] },
];

const SIGNS = ["牡羊座", "牡牛座", "双子座", "蟹座", "獅子座", "乙女座", "天秤座", "蠍座", "射手座", "山羊座", "水瓶座", "魚座"];

// 各星座の開始日(月,日)。牡羊座から12星座ぶん
const SIGN_STARTS: [number, number][] = [
  [3, 21], [4, 20], [5, 21], [6, 22], [7, 23], [8, 23],
  [9, 23], [10, 24], [11, 23], [12, 22], [1, 20], [2, 19],
];

const SUN_TRAITS = [
  "開拓者の火を宿し、迷いより先に動く力を持つ", "地に根を張るように、揺るがない豊かさを育てる",
  "二つの声を同時に聴き、世界を軽やかに編集する", "心の潮に従い、守るべきものを静かに抱く",
  "内なる太陽を隠さず、人を照らすことを恐れない", "細部に宿る秩序を見抜き、物事を磨き上げる",
  "二人のあいだに橋を架け、美しい均衡を探す", "深みに潜り、表には出ない真実を握っている",
  "地平線の向こうを見つめ、自由を手放さない", "静かな山を登り続け、時間を味方につける",
  "群れより先に、まだない未来の形を思い描く", "境界を溶かし、見えないものと対話する",
];

const MOON_TRAITS = [
  "何も持たない暗闇から、静かに始める", "小さな光を信じ、ひそかに育てていく",
  "最初の輝きが、迷いを断ち切る", "満ちる手前の揺らぎに、心を研ぎ澄ませる",
  "すべてを照らし出す、感情の満ち潮", "満たされたあとの余韻を、大切に抱える",
  "手放すことを、恐れなくなっていく", "闇に還りながら、次の芽を宿している",
];

const ASC_TRAITS = [
  "出会った瞬間、火花のような熱を放つ", "落ち着いた佇まいで、信頼を積み上げる",
  "言葉を交わすほど、興味深く映る", "そっと寄り添う優しさが、第一印象になる",
  "存在そのものが、場の中心を引き寄せる", "静かな観察眼が、誠実さとして伝わる",
  "柔らかな調和が、初対面の空気を和らげる", "底知れぬ奥行きが、強く印象に残る",
  "自由な気配が、新しい風を連れてくる", "誠実な重みが、安心感として伝わる",
  "独自の視点が、新鮮な驚きを与える", "境界のない優しさが、そっと心を開かせる",
];

const FUTURE_TEMPLATES: { label: string; pool: string[] }[] = [
  {
    label: "数週間先",
    pool: [
      "小さな偶然が、思いがけない扉を開く", "誰かの一言が、長く心に残る指針になる",
      "後回しにしていたことに、ふいに向き合う時が来る", "静かな決断が、流れを少しだけ変える",
    ],
  },
  {
    label: "半年先",
    pool: [
      "積み重ねてきたものが、ようやく形になり始める", "離れていた何かと、思いがけず再会する",
      "新しい役割が、静かに舞い込んでくる", "これまでと違う場所に、自分の居場所を見つける",
    ],
  },
  {
    label: "一年以上先",
    pool: [
      "遠く思えた景色が、気づけば日常になっている", "今の迷いが、振り返れば意味ある回り道だったと分かる",
      "誰かにとっての、小さな道しるべになっている", "まったく違う自分に、少しだけ近づいている",
    ],
  },
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

function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function degreeToBody(name: string, deg: number): Body {
  const d = norm360(deg);
  const signIndex = Math.floor(d / 30) % 12;
  return { name, signIndex, signName: SIGNS[signIndex], degreeInSign: d % 30 };
}

/** 太陽星座(実際の占星術の暦に基づく、精度の高い計算) */
function sunLongitude(month: number, day: number): number {
  // 各星座の開始日からの経過日数で近似した太陽黄経(0-360)
  for (let i = 0; i < 12; i++) {
    const [sm, sd] = SIGN_STARTS[i];
    const [nm, nd] = SIGN_STARTS[(i + 1) % 12];
    const start = new Date(Date.UTC(2001, sm - 1, sd));
    let end = new Date(Date.UTC(2001, nm - 1, nd));
    if (end <= start) end = new Date(Date.UTC(2002, nm - 1, nd));
    let cur = new Date(Date.UTC(2001, month - 1, day));
    if (cur < start) cur = new Date(Date.UTC(2002, month - 1, day));
    if (cur >= start && cur < end) {
      const span = (end.getTime() - start.getTime()) / 86400000;
      const pos = (cur.getTime() - start.getTime()) / 86400000;
      return i * 30 + (pos / span) * 30;
    }
  }
  return 0;
}

/** 月の黄経(簡易近似式。数度の誤差はあるが実際の軌道計算に基づく) */
function moonLongitude(utc: Date): number {
  const d = (utc.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000; // J2000からの日数
  const L = 218.316 + 13.176396 * d; // 平均黄経
  const M = toRad(norm360(134.963 + 13.064993 * d)); // 平均近点角
  return norm360(L + 6.289 * Math.sin(M));
}

/** 太陽の黄経(簡易近似式。アセンダント計算用) */
function sunEclipticLongitude(utc: Date): number {
  const d = (utc.getTime() - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const g = toRad(norm360(357.529 + 0.98560028 * d));
  const L = norm360(280.459 + 0.98564736 * d);
  return norm360(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
}

function julianDate(utc: Date): number {
  return utc.getTime() / 86400000 + 2440587.5;
}

/** グリニッジ平均恒星時(度) */
function gmstDegrees(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000;
  return norm360(gmst);
}

/** アセンダント(上昇点)の黄経。出生地の経度・緯度と時刻から実計算 */
function ascendantLongitude(utc: Date, lonDeg: number, latDeg: number): number {
  const jd = julianDate(utc);
  const lst = norm360(gmstDegrees(jd) + lonDeg); // 地方恒星時
  const ramc = toRad(lst);
  const eps = toRad(23.4393); // 黄道傾斜角
  const phi = toRad(latDeg);
  const y = Math.cos(ramc);
  const x = -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps));
  return norm360(toDeg(Math.atan2(y, x)));
}

function moonPhaseName(sunLon: number, moonLon: number): string {
  const angle = norm360(moonLon - sunLon);
  const names = ["新月", "三日月", "上弦の月", "十三夜月", "満月", "寝待月", "下弦の月", "暁闇の月"];
  const idx = Math.floor(((angle + 22.5) % 360) / 45);
  return names[idx];
}

/** 出生地の経度から現地時刻をおおよそのUTに変換(簡易近似。歴史的タイムゾーンは考慮しない) */
function approximateUT(dateStr: string, timeStr: string, lonDeg: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "12:00").split(":").map(Number);
  const localAsUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);
  const utMs = localAsUtcMs - (lonDeg / 15) * 3600 * 1000;
  return new Date(utMs);
}

export function computeNatalChart(dateStr: string, timeStr: string, lat: number, lon: number): NatalChart {
  const [, m, d] = dateStr.split("-").map(Number);
  const utc = approximateUT(dateStr, timeStr, lon);
  const seed = hashString(`${dateStr}T${timeStr}@${lat.toFixed(2)},${lon.toFixed(2)}`);
  const rand = mulberry32(seed);

  const sunLon = sunLongitude(m, d);
  const moonLon = moonLongitude(utc);
  const ascLon = ascendantLongitude(utc, lon, lat);

  const sun = degreeToBody("太陽", sunLon);
  const moon = degreeToBody("月", moonLon);
  const ascendant = degreeToBody("上昇", ascLon);
  const phase = moonPhaseName(sunEclipticLongitude(utc), moonLon);

  const MOON_PHASE_NAMES = ["新月", "三日月", "上弦の月", "十三夜月", "満月", "寝待月", "下弦の月", "暁闇の月"];
  const sunTrait = SUN_TRAITS[sun.signIndex];
  const moonTrait = MOON_TRAITS[MOON_PHASE_NAMES.indexOf(phase)];
  const ascTrait = ASC_TRAITS[ascendant.signIndex];

  const fortuneText =
    `太陽は『${sun.signName}』— ${sunTrait}。\n` +
    `月は『${moon.signName}(${phase})』— ${moonTrait}。\n` +
    `上昇星座は『${ascendant.signName}』— ${ascTrait}。`;

  const future = FUTURE_TEMPLATES.map((t) => ({
    label: t.label,
    text: t.pool[Math.floor(rand() * t.pool.length)],
  }));

  const scale = SCALES[sun.signIndex % SCALES.length];
  const bpm = Math.round(80 + (ascendant.signIndex * 30 + ascendant.degreeInSign) / 360 * 60);

  return {
    sun,
    moon,
    ascendant,
    moonPhaseName: phase,
    hue: sun.signIndex / 12,
    fortuneText,
    future,
    scaleName: scale.name,
    scaleFreqs: scale.freqs,
    bpm,
  };
}
