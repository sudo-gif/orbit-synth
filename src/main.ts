import { startScene } from "./scene";
import { computeChart } from "./fortune";
import { log } from "./logger";

const app = document.getElementById("app");
if (!app) throw new Error("#app not found");

const controller = startScene(app);

const form = document.getElementById("fortuneForm") as HTMLFormElement;
const skipButton = document.getElementById("skipFortune") as HTMLButtonElement;
const dateInput = document.getElementById("birthDate") as HTMLInputElement;
const timeInput = document.getElementById("birthTime") as HTMLInputElement;
const resultEl = document.getElementById("fortuneResult") as HTMLDivElement;

window.setTimeout(() => form.classList.add("show"), 4200);

function closeForm(): void {
  form.classList.remove("show");
}

form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  if (!dateInput.value) return;
  const chart = computeChart(dateInput.value, timeInput.value);
  log("fortune_submitted", { date: dateInput.value, time: timeInput.value, sign: chart.signName, scale: chart.scaleName, bpm: chart.bpm });
  controller.applyChart(chart);
  closeForm();
  resultEl.textContent = chart.fortuneText;
  resultEl.classList.add("show");
  window.setTimeout(() => resultEl.classList.remove("show"), 9000);
});

skipButton.addEventListener("click", () => {
  log("fortune_skipped", {});
  closeForm();
});
