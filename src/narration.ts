const el = document.getElementById("narration")!;
const MIN_GAP_MS = 6000;

const lines = {
  firstPlanet: ["新しい光が、闇に生まれた", "静寂の中に、ひとつの軌道が生まれる"],
  fewPlanets: ["小さな星系が、歌い始める", "光たちが、互いの間合いを探っている"],
  manyPlanets: ["宇宙は、静かに満ちていく", "無数の軌道が、ひとつの調べになる"],
  fast: ["時が、加速する", "鼓動が、速くなっていく"],
  slow: ["時間が、ゆっくりと溶けていく", "永遠に近い、遅さ"],
  removed: ["一つの光が、闇に還る", "軌道は閉じ、静けさが戻る"],
  idle: [
    "星々は、言葉より古い調べを奏でる",
    "この宇宙に、終わりはない",
    "あなたの手が、小さな神話をつくる",
    "惑星たちは、記憶を周回している",
    "音は、光になって消えていく",
  ],
};

let lastShown = 0;
let idleTimer: number | null = null;

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function show(text: string): void {
  const now = Date.now();
  if (now - lastShown < MIN_GAP_MS) return;
  lastShown = now;
  el.textContent = text;
  el.classList.add("show");
  window.setTimeout(() => el.classList.remove("show"), 4500);
  resetIdleTimer();
}

function resetIdleTimer(): void {
  if (idleTimer !== null) window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    show(pick(lines.idle));
  }, 16000 + Math.random() * 10000);
}

export function narrate(key: keyof typeof lines): void {
  show(pick(lines[key]));
}

resetIdleTimer();
