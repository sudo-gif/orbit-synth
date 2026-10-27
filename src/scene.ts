import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { AudioEngine } from "./audio";
import { log } from "./logger";
import { narrate } from "./narration";
import type { Chart } from "./fortune";

const MIN_RADIUS = 1.5;
const MAX_RADIUS = 7;
const TRAIL_LENGTH = 50;

type Planet = {
  mesh: THREE.Mesh;
  radius: number;
  angle: number;
  angularSpeed: number; // rad/sec
  id: string;
  trail: THREE.Vector3[];
  trailPoints: THREE.Points;
  color: THREE.Color;
};

function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.5)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export type SceneController = {
  applyChart: (chart: Chart) => void;
};

export function startScene(container: HTMLElement): SceneController {
  const audio = new AudioEngine();
  const glowTexture = makeGlowTexture();

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02020a, 0.025);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  const baseCamPos = new THREE.Vector3(0, 10, 11);
  camera.position.copy(baseCamPos);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.1,
    0.65,
    0.15
  );
  composer.addPass(bloomPass);

  // --- 太陽 ---
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe08a })
  );
  scene.add(sun);
  const sunLight = new THREE.PointLight(0xffe08a, 3, 30);
  scene.add(sunLight);

  // --- 軌道ガイド ---
  const orbitGroup = new THREE.Group();
  scene.add(orbitGroup);
  function addOrbitRing(radius: number) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.01, radius + 0.01, 128),
      new THREE.MeshBasicMaterial({ color: 0x3a4a8a, side: THREE.DoubleSide, transparent: true, opacity: 0.3 })
    );
    ring.rotation.x = -Math.PI / 2;
    orbitGroup.add(ring);
  }

  // --- 星(瞬くシェーダー) ---
  const starCount = 1800;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starPhase = new Float32Array(starCount);
  const starSize = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const r = 20 + Math.random() * 40;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
    starPhase[i] = Math.random() * Math.PI * 2;
    starSize[i] = 1.2 + Math.random() * 1.8;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute("aPhase", new THREE.BufferAttribute(starPhase, 1));
  starGeo.setAttribute("aSize", new THREE.BufferAttribute(starSize, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uColor: { value: new THREE.Color(0x9fb4ff) },
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime;
      uniform float uLevel;
      varying float vTwinkle;
      void main() {
        vTwinkle = 0.5 + 0.5 * sin(uTime * 1.4 + aPhase);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (0.6 + 0.4 * vTwinkle) * (1.0 + uLevel * 0.6) * (40.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float alpha = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor * (0.6 + 0.4 * vTwinkle), alpha * (0.35 + 0.5 * vTwinkle));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- 星雲(音の帯域で色が変わる背景のもや) ---
  const nebulaCount = 220;
  const nebulaGeo = new THREE.BufferGeometry();
  const nebulaPos = new Float32Array(nebulaCount * 3);
  for (let i = 0; i < nebulaCount; i++) {
    const r = 18 + Math.random() * 30;
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 16;
    nebulaPos[i * 3] = Math.cos(theta) * r;
    nebulaPos[i * 3 + 1] = y;
    nebulaPos[i * 3 + 2] = Math.sin(theta) * r;
  }
  nebulaGeo.setAttribute("position", new THREE.BufferAttribute(nebulaPos, 3));
  const nebulaMat = new THREE.PointsMaterial({
    map: glowTexture,
    size: 4,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: 0x6655ff,
  });
  const nebula = new THREE.Points(nebulaGeo, nebulaMat);
  scene.add(nebula);

  // --- 惑星 ---
  const planets: Planet[] = [];
  const planetGeo = new THREE.SphereGeometry(0.35, 24, 24);

  function pitchColor(radius: number): THREE.Color {
    const norm = 1 - (radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS);
    const hue = 0.55 + norm * 0.35; // 水色〜紫
    return new THREE.Color().setHSL(hue, 0.7, 0.6);
  }

  function makeTrailPoints(): THREE.Points {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_LENGTH * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(TRAIL_LENGTH * 3), 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({
      size: 0.4,
      map: glowTexture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return points;
  }

  function addPlanet(radius: number, angle: number, angularSpeed: number) {
    const color = pitchColor(radius);
    const mesh = new THREE.Mesh(
      planetGeo,
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 })
    );
    scene.add(mesh);
    addOrbitRing(radius);
    const planet: Planet = {
      mesh,
      radius,
      angle,
      angularSpeed,
      id: crypto.randomUUID(),
      trail: [],
      trailPoints: makeTrailPoints(),
      color,
    };
    planets.push(planet);
    log("planet_added", { id: planet.id, radius, angularSpeed });
    if (!isInitial) {
      if (planets.length === 4) narrate("firstPlanet");
      else if (planets.length === 6) narrate("fewPlanets");
      else if (planets.length >= 9) narrate("manyPlanets");
    }
    return planet;
  }

  // 初期惑星を3つ配置(ナレーションは発生させない)
  let isInitial = true;
  addPlanet(2.5, 0, 0.9);
  addPlanet(4.2, Math.PI * 0.6, 0.55);
  addPlanet(6, Math.PI * 1.3, 0.35);
  isInitial = false;

  let chartHue = 0.6;

  /** 占いの結果を反映: 惑星配置と調べ・テンポを入れ替える */
  function applyChart(chart: Chart) {
    for (const p of [...planets]) {
      scene.remove(p.mesh);
      scene.remove(p.trailPoints);
      p.trailPoints.geometry.dispose();
      (p.trailPoints.material as THREE.Material).dispose();
    }
    planets.length = 0;
    orbitGroup.clear();

    audio.configure(chart.scaleFreqs, chart.bpm);
    chartHue = chart.hue;

    isInitial = true;
    chart.planetSeeds.forEach((seed, i) => {
      const radius = MIN_RADIUS + seed * (MAX_RADIUS - MIN_RADIUS);
      const angle = seed * Math.PI * 2 * (i + 1.3);
      const speed = 0.3 + ((seed * 7) % 1) * 1.2;
      addPlanet(radius, angle, speed);
    });
    isInitial = false;
  }

  // --- 入力(ドラッグで半径変更、ホイールで速度変更、ダブルクリックで削除) ---
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let dragging: Planet | null = null;
  let interacting = false;

  function toPointer(ev: { clientX: number; clientY: number }) {
    pointer.x = (ev.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(ev.clientY / window.innerHeight) * 2 + 1;
  }

  function intersectGround(): THREE.Vector3 | null {
    raycaster.setFromCamera(pointer, camera);
    const point = new THREE.Vector3();
    return raycaster.ray.intersectPlane(groundPlane, point) ? point : null;
  }

  renderer.domElement.addEventListener("pointerdown", (ev) => {
    audio.resume();
    interacting = true;
    toPointer(ev);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(planets.map((p) => p.mesh))[0];
    if (hit) {
      dragging = planets.find((p) => p.mesh === hit.object) ?? null;
    } else {
      const point = intersectGround();
      if (point) {
        const radius = THREE.MathUtils.clamp(point.length(), MIN_RADIUS, MAX_RADIUS);
        const angle = Math.atan2(point.z, point.x);
        addPlanet(radius, angle, 0.5 + Math.random() * 0.4);
      }
    }
  });

  renderer.domElement.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    toPointer(ev);
    const point = intersectGround();
    if (point) {
      dragging.radius = THREE.MathUtils.clamp(point.length(), MIN_RADIUS, MAX_RADIUS);
      dragging.angle = Math.atan2(point.z, point.x);
      dragging.color = pitchColor(dragging.radius);
      const mat = dragging.mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(dragging.color);
      mat.emissive.copy(dragging.color);
    }
  });

  window.addEventListener("pointerup", () => {
    interacting = false;
    if (dragging) {
      log("planet_moved", { id: dragging.id, radius: dragging.radius });
      dragging = null;
    }
  });

  renderer.domElement.addEventListener("wheel", (ev) => {
    toPointer(ev);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(planets.map((p) => p.mesh))[0];
    if (!hit) return;
    const planet = planets.find((p) => p.mesh === hit.object);
    if (!planet) return;
    ev.preventDefault();
    planet.angularSpeed = THREE.MathUtils.clamp(planet.angularSpeed - ev.deltaY * 0.001, 0.05, 2.5);
    log("planet_speed_changed", { id: planet.id, angularSpeed: planet.angularSpeed });
    if (planet.angularSpeed > 1.8) narrate("fast");
    else if (planet.angularSpeed < 0.15) narrate("slow");
  }, { passive: false });

  renderer.domElement.addEventListener("dblclick", (ev) => {
    toPointer(ev);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(planets.map((p) => p.mesh))[0];
    if (!hit) return;
    const idx = planets.findIndex((p) => p.mesh === hit.object);
    if (idx === -1) return;
    const [planet] = planets.splice(idx, 1);
    scene.remove(planet.mesh);
    scene.remove(planet.trailPoints);
    log("planet_removed", { id: planet.id });
    narrate("removed");
  });

  // --- 流れ星 ---
  type ShootingStar = { line: THREE.Line; start: THREE.Vector3; end: THREE.Vector3; t: number; duration: number };
  const shootingStars: ShootingStar[] = [];
  function spawnShootingStar() {
    const r = 35;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    const start = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi) * 0.6 + 0.3,
      Math.sin(phi) * Math.sin(theta)
    ).multiplyScalar(r);
    const dir = start.clone().multiplyScalar(-1)
      .add(new THREE.Vector3((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 24))
      .normalize();
    const end = start.clone().addScaledVector(dir, 22);

    const geo = new THREE.BufferGeometry().setFromPoints([start, start]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    shootingStars.push({ line, start, end, t: 0, duration: 0.7 + Math.random() * 0.5 });
  }
  let nextShootingStarAt = 4 + Math.random() * 6;

  // --- オープニング演出 ---
  window.setTimeout(() => document.getElementById("intro")?.classList.add("fade"), 3800);
  window.setTimeout(() => document.getElementById("hint")?.classList.add("show"), 4600);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- アニメーションループ ---
  const clock = new THREE.Clock();
  let elapsed = 0;
  let camAngle = 0;
  const tmpColor = new THREE.Color();
  const lowColor = new THREE.Color(0xff5a33);
  const midColor = new THREE.Color(0x33ffa0);
  const highColor = new THREE.Color(0x8a66ff);
  const accentColor = new THREE.Color();

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    elapsed += dt;

    for (const planet of planets) {
      const prevAngle = planet.angle;
      planet.angle += planet.angularSpeed * dt;
      if (Math.floor(planet.angle / (Math.PI * 2)) !== Math.floor(prevAngle / (Math.PI * 2))) {
        audio.playNote(planet.radius, MIN_RADIUS, MAX_RADIUS);
      }
      planet.mesh.position.set(
        Math.cos(planet.angle) * planet.radius,
        0,
        Math.sin(planet.angle) * planet.radius
      );

      // 光の尾を更新
      planet.trail.unshift(planet.mesh.position.clone());
      if (planet.trail.length > TRAIL_LENGTH) planet.trail.pop();
      const posAttr = planet.trailPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
      const colAttr = planet.trailPoints.geometry.getAttribute("color") as THREE.BufferAttribute;
      for (let i = 0; i < planet.trail.length; i++) {
        const p = planet.trail[i];
        posAttr.setXYZ(i, p.x, p.y, p.z);
        const fade = 1 - i / TRAIL_LENGTH;
        tmpColor.copy(planet.color).multiplyScalar(fade * fade * 1.4);
        colAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      planet.trailPoints.geometry.setDrawRange(0, planet.trail.length);
    }

    const level = audio.getLevel();
    const bands = audio.getBands();

    starMat.uniforms.uTime.value = elapsed;
    starMat.uniforms.uLevel.value = level;
    sunLight.intensity = 2 + level * 4;
    sun.scale.setScalar(1 + level * 0.3);

    tmpColor
      .copy(lowColor).multiplyScalar(bands.low)
      .add(tmpColor.clone().copy(midColor).multiplyScalar(bands.mid))
      .add(tmpColor.clone().copy(highColor).multiplyScalar(bands.high));
    accentColor.setHSL(chartHue, 0.6, 0.55);
    nebulaMat.color.copy(tmpColor).lerp(accentColor, 0.35);
    nebulaMat.opacity = 0.1 + ((bands.low + bands.mid + bands.high) / 3) * 0.35;
    nebula.rotation.y += dt * 0.02;

    bloomPass.strength = 0.9 + level * 1.4;

    // 流れ星の生成と更新
    if (elapsed > nextShootingStarAt) {
      spawnShootingStar();
      nextShootingStarAt = elapsed + 6 + Math.random() * 10;
    }
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const s = shootingStars[i];
      s.t += dt;
      const progress = Math.min(1, s.t / s.duration);
      const head = s.start.clone().lerp(s.end, progress);
      const tail = s.start.clone().lerp(s.end, Math.max(0, progress - 0.12));
      const posAttr = s.line.geometry.getAttribute("position") as THREE.BufferAttribute;
      posAttr.setXYZ(0, tail.x, tail.y, tail.z);
      posAttr.setXYZ(1, head.x, head.y, head.z);
      posAttr.needsUpdate = true;
      (s.line.material as THREE.LineBasicMaterial).opacity = 0.95 * (1 - progress);
      if (s.t >= s.duration) {
        scene.remove(s.line);
        s.line.geometry.dispose();
        (s.line.material as THREE.Material).dispose();
        shootingStars.splice(i, 1);
      }
    }

    if (!interacting) {
      camAngle += dt * 0.03;
      camera.position.x = Math.sin(camAngle) * baseCamPos.length() * 0.95;
      camera.position.z = Math.cos(camAngle) * baseCamPos.length() * 0.95;
      camera.position.y = baseCamPos.y + Math.sin(camAngle * 0.5) * 0.6;
      camera.lookAt(0, 0, 0);
    }

    composer.render();
  }
  animate();

  return { applyChart };
}
