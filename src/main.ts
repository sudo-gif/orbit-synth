import { startScene } from "./scene";

const app = document.getElementById("app");
if (!app) throw new Error("#app not found");

startScene(app);
