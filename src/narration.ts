const el = document.getElementById("narration")!;
const MIN_GAP_MS = 6000;

const lines = {
  reveal: ["星々が、あなたの位置を示した", "生まれた瞬間の空が、ここに描かれる"],
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
