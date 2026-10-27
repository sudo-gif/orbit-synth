import { startScene } from "./scene";
import { computeNatalChart } from "./astrology";
import { computeBaziChart } from "./bazi";
import { computeNumerologyChart } from "./numerology";
import { showGlobePicker } from "./globe";
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

let selectedMethod: Method = "astrology";

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

async function runVisionSequence(future: { label: string; text: string }[]): Promise<void> {
  for (const slide of future) {
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
  let chart: AnyChart;
  if (selectedMethod === "astrology") {
    chart = computeNatalChart(dateStr, timeStr, lat, lon);
    controller.applyAstrologyChart(chart);
  } else if (selectedMethod === "bazi") {
    chart = computeBaziChart(dateStr, timeStr);
    controller.applyBaziChart(chart);
  } else {
    chart = computeNumerologyChart(dateStr, timeStr, nameInput.value);
    controller.applyNumerologyChart(chart);
  }

  log("fortune_submitted", { method: selectedMethod, date: dateStr, time: timeStr, city: cityName });
  resultEl.textContent = chart.fortuneText;
  resultEl.classList.add("show");
  await wait(9000);
  resultEl.classList.remove("show");
  await wait(1500);
  await runVisionSequence(chart.future);
}

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
