import { startScene } from "./scene";
import { computeNatalChart, type NatalChart } from "./astrology";
import { showGlobePicker } from "./globe";
import { log } from "./logger";

const app = document.getElementById("app");
if (!app) throw new Error("#app not found");

const controller = startScene(app);

const form = document.getElementById("fortuneForm") as HTMLFormElement;
const skipButton = document.getElementById("skipFortune") as HTMLButtonElement;
const dateInput = document.getElementById("birthDate") as HTMLInputElement;
const timeInput = document.getElementById("birthTime") as HTMLInputElement;
const resultEl = document.getElementById("fortuneResult") as HTMLDivElement;
const visionEl = document.getElementById("vision") as HTMLDivElement;
const visionLabel = visionEl.querySelector(".label") as HTMLDivElement;
const visionText = visionEl.querySelector(".text") as HTMLDivElement;

window.setTimeout(() => form.classList.add("show"), 4200);

function closeForm(): void {
  form.classList.remove("show");
}

async function runVisionSequence(chart: NatalChart): Promise<void> {
  for (const slide of chart.future) {
    visionLabel.textContent = slide.label;
    visionText.textContent = slide.text;
    visionEl.classList.add("show");
    await wait(4600);
    visionEl.classList.remove("show");
    await wait(1800);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function reveal(dateStr: string, timeStr: string, lat: number, lon: number, cityName: string): Promise<void> {
  const chart = computeNatalChart(dateStr, timeStr, lat, lon);
  log("fortune_submitted", {
    date: dateStr, time: timeStr, city: cityName,
    sun: chart.sun.signName, moon: chart.moon.signName, ascendant: chart.ascendant.signName,
  });
  controller.applyNatalChart(chart);
  resultEl.textContent = chart.fortuneText;
  resultEl.classList.add("show");
  await wait(9000);
  resultEl.classList.remove("show");
  await wait(1500);
  await runVisionSequence(chart);
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!dateInput.value) return;
  closeForm();
  const place = await showGlobePicker();
  await reveal(dateInput.value, timeInput.value, place.lat, place.lon, place.cityName);
});

skipButton.addEventListener("click", async () => {
  log("fortune_skipped", {});
  closeForm();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  await reveal(dateStr, timeStr, 35.68, 139.69, "東京");
});
