import { startScene } from "./scene";
import { computeNatalChart } from "./astrology";
import { computeBaziChart } from "./bazi";
import { computeNumerologyChart } from "./numerology";
import { showGlobePicker } from "./globe";
import { pickPowerSpot } from "./powerspots";
import { log } from "./logger";

type Method = "astrology" | "bazi" | "numerology";
type AnyChart =
  | ReturnType<typeof computeNatalChart>
  | ReturnType<typeof computeBaziChart>
  | ReturnType<typeof computeNumerologyChart>;

const app = document.getElementById("app");
if (!app) throw new Error("#app not found");

const controller = startScene(app);

const methodSelect = document.getElementById("methodSelect") as HTMLDivElement;
const form = document.getElementById("fortuneForm") as HTMLFormElement;
const skipButton = document.getElementById("skipFortune") as HTMLButtonElement;
const dateInput = document.getElementById("birthDate") as HTMLInputElement;
const timeInput = document.getElementById("birthTime") as HTMLInputElement;
const nameInput = document.getElementById("birthName") as HTMLInputElement;
const resultEl = document.getElementById("fortuneResult") as HTMLDivElement;
const visionEl = document.getElementById("vision") as HTMLDivElement;
const visionLabel = visionEl.querySelector(".label") as HTMLDivElement;
const visionText = visionEl.querySelector(".text") as HTMLDivElement;
const chartLegendEl = document.getElementById("chartLegend") as HTMLDivElement;
const powerSpotEl = document.getElementById("powerSpot") as HTMLDivElement;
const backButton = document.getElementById("backButton") as HTMLButtonElement;

let selectedMethod: Method = "astrology";
let sequenceId = 0;

window.setTimeout(() => methodSelect.classList.add("show"), 4200);

methodSelect.querySelectorAll<HTMLButtonElement>("button[data-method]").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedMethod = btn.dataset.method as Method;
    log("method_selected", { method: selectedMethod });
    methodSelect.classList.remove("show");
    form.classList.toggle("numerology", selectedMethod === "numerology");
    window.setTimeout(() => form.classList.add("show"), 1000);
  });
});

function closeForm(): void {
  form.classList.remove("show");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function runVisionSequence(future: { label: string; text: string }[], myId: number): Promise<void> {
  for (const slide of future) {
    if (myId !== sequenceId) return;
    visionLabel.textContent = slide.label;
    visionText.textContent = slide.text;
    visionEl.classList.add("show");
    await wait(4600);
    if (myId !== sequenceId) return;
    visionEl.classList.remove("show");
    await wait(1800);
  }
}

function showPowerSpot(tag: { element?: string; sign?: number; number?: number }, seedStr: string): void {
  const spot = pickPowerSpot(tag, seedStr);
  powerSpotEl.innerHTML =
    `<span class="spot-label">あなたに響くパワースポット</span>` +
    `<span class="spot-name">${spot.name}</span>　<span class="spot-place">${spot.place}</span>` +
    `<div class="spot-desc">${spot.description}</div>`;
  powerSpotEl.classList.add("show");
}

async function reveal(dateStr: string, timeStr: string, lat: number, lon: number, cityName: string): Promise<void> {
  const myId = ++sequenceId;
  let chart: AnyChart;
  if (selectedMethod === "astrology") {
    chart = computeNatalChart(dateStr, timeStr, lat, lon);
    controller.applyAstrologyChart(chart);
    showPowerSpot({ sign: chart.sun.signIndex }, `${dateStr}T${timeStr}`);
  } else if (selectedMethod === "bazi") {
    chart = computeBaziChart(dateStr, timeStr);
    controller.applyBaziChart(chart);
    showPowerSpot({ element: chart.dayMasterElement }, `${dateStr}T${timeStr}`);
  } else {
    chart = computeNumerologyChart(dateStr, timeStr, nameInput.value);
    controller.applyNumerologyChart(chart);
    showPowerSpot({ number: chart.lifePath }, `${dateStr}T${timeStr}`);
  }

  log("fortune_submitted", { method: selectedMethod, date: dateStr, time: timeStr, city: cityName });
  resultEl.textContent = chart.fortuneText;
  resultEl.classList.add("show");
  backButton.classList.add("show");
  await wait(9000);
  if (myId !== sequenceId) return;
  resultEl.classList.remove("show");
  await wait(1500);
  if (myId !== sequenceId) return;
  await runVisionSequence(chart.future, myId);
}

function restartToMethodSelect(): void {
  sequenceId++; // 実行中のビジョン演出を無効化
  log("restart_from_chart", { method: selectedMethod });
  resultEl.classList.remove("show");
  visionEl.classList.remove("show");
  chartLegendEl.classList.remove("show");
  powerSpotEl.classList.remove("show");
  backButton.classList.remove("show");
  form.classList.remove("show");
  methodSelect.classList.add("show");
}

backButton.addEventListener("click", restartToMethodSelect);

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!dateInput.value) return;
  closeForm();
  if (selectedMethod === "astrology") {
    const place = await showGlobePicker();
    await reveal(dateInput.value, timeInput.value, place.lat, place.lon, place.cityName);
  } else {
    await reveal(dateInput.value, timeInput.value, 0, 0, "");
  }
});

skipButton.addEventListener("click", async () => {
  log("fortune_skipped", { method: selectedMethod });
  closeForm();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  await reveal(dateStr, timeStr, 35.68, 139.69, "東京");
});
