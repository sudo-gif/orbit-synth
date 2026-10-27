import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { AudioEngine } from "./audio";
import { log } from "./logger";
import { narrate } from "./narration";
import type { NatalChart } from "./astrology";
import type { BaziChart } from "./bazi";
import { ELEMENT_COLORS } from "./bazi";
import type { NumerologyChart } from "./numerology";

const MIN_RADIUS = 1.5;
const MAX_RADIUS = 7;
const TRAIL_LENGTH = 50;

type Body = {
  mesh: THREE.Mesh;
  halo: THREE.Mesh;
  radius: number;
  baseAngle: number; // natalGroup内でのローカル角度(黄経に対応)
  trail: THREE.Vector3[];
  trailPoints: THREE.Points;
  color: THREE.Color;
};

/** フェルトのような、縁がふわっと光るフレネル質感のハロー */
function makeFuzzHalo(bodyRadius: number, color: THREE.Color): THREE.Mesh {
  const geo = new THREE.SphereGeometry(bodyRadius * 1.4, 20, 20);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 2.4);
        gl_FragColor = vec4(uColor, fresnel * 0.85);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
  });
  return new THREE.Mesh(geo, mat);
}

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
  applyAstrologyChart: (chart: NatalChart) => void;
  applyBaziChart: (chart: BaziChart) => void;
  applyNumerologyChart: (chart: NumerologyChart) => void;
};

export function startScene(container: HTMLElement): SceneController {
  const audio = new AudioEngine();
  const glowTexture = makeGlowTexture();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x241b30);
  scene.fog = new THREE.FogExp2(0x241b30, 0.02);

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
    0.35,
    0.8,
    0.35
  );
  composer.addPass(bloomPass);

  // --- 中心核(データとは独立した視覚上の中心、毛糸玉のような温かい光) ---
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xf5dcae, emissive: 0xf5dcae, emissiveIntensity: 0.3, roughness: 1, metalness: 0 })
  );
  scene.add(core);
  core.add(makeFuzzHalo(0.7, new THREE.Color(0xf5dcae)));
  const coreLight = new THREE.PointLight(0xf5dcae, 1.8, 30);
  scene.add(coreLight);
  scene.add(new THREE.AmbientLight(0x4a3a5a, 0.8));

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
      uColor: { value: new THREE.Color(0xf5e3c2) },
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
        float alpha = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(uColor * (0.7 + 0.3 * vTwinkle), alpha * (0.3 + 0.4 * vTwinkle));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- 星雲(音の帯域+占星術のアクセントカラーで色が変わる背景のもや) ---
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
    size: 5,
    transparent: true,
    opacity: 0.12,
    blending: THREE.NormalBlending,
    depthWrite: false,
    color: 0xcba8d8,
  });
  const nebula = new THREE.Points(nebulaGeo, nebulaMat);
  scene.add(nebula);

  // --- ネイタルチャート(占星術の結果を表示する回転する環) ---
  const natalGroup = new THREE.Group();
  scene.add(natalGroup);
  const zodiacTickGroup = new THREE.Group();
  natalGroup.add(zodiacTickGroup);

  const bodyGeo = new THREE.SphereGeometry(0.35, 24, 24);
  const bodies: Body[] = [];

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

  function addBody(radius: number, angleDeg: number, color: THREE.Color): Body {
    const mesh = new THREE.Mesh(
      bodyGeo,
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.22, roughness: 1, metalness: 0 })
    );
    const baseAngle = THREE.MathUtils.degToRad(angleDeg);
    mesh.position.set(Math.cos(baseAngle) * radius, 0, Math.sin(baseAngle) * radius);
    const halo = makeFuzzHalo(0.35, color);
    mesh.add(halo);
    natalGroup.add(mesh);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.01, radius + 0.01, 128),
      new THREE.MeshBasicMaterial({ color: 0xcf9f72, side: THREE.DoubleSide, transparent: true, opacity: 0.3 })
    );
    ring.rotation.x = -Math.PI / 2;
    natalGroup.add(ring);

    const body: Body = { mesh, halo, radius, baseAngle, trail: [], trailPoints: makeTrailPoints(), color };
    bodies.push(body);
    return body;
  }

  function buildZodiacTicks() {
    const tickRadius = 7.3;
    for (let i = 0; i < 12; i++) {
      const a1 = THREE.MathUtils.degToRad(i * 30 - 0.6);
      const a2 = THREE.MathUtils.degToRad(i * 30 + 0.6);
      const pts = [
        new THREE.Vector3(Math.cos(a1) * tickRadius, 0, Math.sin(a1) * tickRadius),
        new THREE.Vector3(Math.cos(a2) * tickRadius, 0, Math.sin(a2) * tickRadius),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xe0b97a, transparent: true, opacity: 0.6 });
      zodiacTickGroup.add(new THREE.Line(geo, mat));
    }
    const outline = new THREE.Mesh(
      new THREE.RingGeometry(tickRadius - 0.01, tickRadius + 0.01, 128),
      new THREE.MeshBasicMaterial({ color: 0xcf9f72, side: THREE.DoubleSide, transparent: true, opacity: 0.25 })
    );
    outline.rotation.x = -Math.PI / 2;
    zodiacTickGroup.add(outline);
  }
  buildZodiacTicks();

  const extraGroup = new THREE.Group();
  natalGroup.add(extraGroup);

  let chartHue = 0.6;
  const legendEl = document.getElementById("chartLegend");

  function clearChart() {
    for (const b of [...bodies]) {
      natalGroup.remove(b.mesh);
      scene.remove(b.trailPoints);
      b.trailPoints.geometry.dispose();
      (b.trailPoints.material as THREE.Material).dispose();
      b.halo.geometry.dispose();
      (b.halo.material as THREE.Material).dispose();
      (b.mesh.material as THREE.Material).dispose();
    }
    bodies.length = 0;
    for (const child of [...extraGroup.children]) {
      extraGroup.remove(child);
      if ((child as THREE.Line).geometry) (child as THREE.Line).geometry.dispose();
      const mat = (child as THREE.Line).material;
      if (mat) (mat as THREE.Material).dispose();
    }
  }

  /** 西洋占星術: 太陽・月・上昇をそれぞれの黄経位置に配置する */
  function applyAstrologyChart(chart: NatalChart) {
    clearChart();
    zodiacTickGroup.visible = true;
    audio.configure(chart.scaleFreqs, chart.bpm);
    chartHue = chart.hue;

    const sunColor = new THREE.Color(0xf0b86e);
    const moonColor = new THREE.Color(0xd9c9f0);
    const ascColor = new THREE.Color(0xf0a8c0);

    addBody(2.6, chart.sun.signIndex * 30 + chart.sun.degreeInSign, sunColor);
    addBody(4.4, chart.moon.signIndex * 30 + chart.moon.degreeInSign, moonColor);
    addBody(6.2, chart.ascendant.signIndex * 30 + chart.ascendant.degreeInSign, ascColor);

    if (legendEl) {
      legendEl.innerHTML =
        `<span style="color:#f0b86e">☉ 太陽</span> ${chart.sun.signName}　` +
        `<span style="color:#d9c9f0">☽ 月</span> ${chart.moon.signName}(${chart.moonPhaseName})　` +
        `<span style="color:#f0a8c0">ASC 上昇</span> ${chart.ascendant.signName}`;
      legendEl.classList.add("show");
    }
    narrate("reveal");
    log("astrology_chart_applied", {
      sun: chart.sun.signName, moon: chart.moon.signName,
      ascendant: chart.ascendant.signName, moonPhase: chart.moonPhaseName,
    });
  }

  /** 四柱推命: 年・月・日・時の四柱を五行の色で四方に配置する */
  function applyBaziChart(chart: BaziChart) {
    clearChart();
    zodiacTickGroup.visible = false;
    audio.configure(chart.scaleFreqs, chart.bpm);
    chartHue = chart.hue;

    const pillars = [
      { label: "年柱", p: chart.year, radius: 3.2, angle: 0 },
      { label: "月柱", p: chart.month, radius: 4.2, angle: 90 },
      { label: "日柱", p: chart.day, radius: 5.2, angle: 180 },
      { label: "時柱", p: chart.hour, radius: 6.2, angle: 270 },
    ];
    for (const { p, radius, angle } of pillars) {
      addBody(radius, angle, new THREE.Color(ELEMENT_COLORS[p.element]));
    }

    if (legendEl) {
      legendEl.innerHTML = pillars
        .map(({ label, p }) => `<span style="color:#${ELEMENT_COLORS[p.element].toString(16).padStart(6, "0")}">${label} ${p.stem}${p.branch}</span>`)
        .join("　");
      legendEl.classList.add("show");
    }
    narrate("reveal");
    log("bazi_chart_applied", {
      year: `${chart.year.stem}${chart.year.branch}`, month: `${chart.month.stem}${chart.month.branch}`,
      day: `${chart.day.stem}${chart.day.branch}`, hour: `${chart.hour.stem}${chart.hour.branch}`,
      dayMasterElement: chart.dayMasterElement,
    });
  }

  /** 数秘術: ライフパスナンバーの数だけ頂点を持つ幾何学模様を描く */
  function applyNumerologyChart(chart: NumerologyChart) {
    clearChart();
    zodiacTickGroup.visible = false;
    audio.configure(chart.scaleFreqs, chart.bpm);
    chartHue = chart.hue;

    const radius = 4.8;
    const n = Math.max(3, Math.round(chart.vertices));
    const color = new THREE.Color(chart.color);
    const positions: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const angleDeg = (360 / n) * i;
      addBody(radius, angleDeg, color);
      const a = THREE.MathUtils.degToRad(angleDeg);
      positions.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const linePts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        linePts.push(positions[i], positions[j]);
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(linePts);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending });
    extraGroup.add(new THREE.LineSegments(geo, mat));

    if (legendEl) {
      const destinyText = chart.destiny !== null ? `　ディスティニー『${chart.destiny}』` : "";
      legendEl.innerHTML = `ライフパス『${chart.lifePath}』${destinyText}`;
      legendEl.classList.add("show");
    }
    narrate("reveal");
    log("numerology_chart_applied", { lifePath: chart.lifePath, destiny: chart.destiny });
  }

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

  window.addEventListener("pointerdown", () => audio.resume());

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
  const lowColor = new THREE.Color(0xf0a98a);
  const midColor = new THREE.Color(0xa8d9b8);
  const highColor = new THREE.Color(0xc9a8e8);
  const accentColor = new THREE.Color();
  const worldPos = new THREE.Vector3();
  let prevGroupAngle = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    elapsed += dt;

    natalGroup.rotation.y += dt * 0.025;
    const groupAngle = natalGroup.rotation.y;

    for (const body of bodies) {
      const prevAbs = body.baseAngle + prevGroupAngle;
      const curAbs = body.baseAngle + groupAngle;
      if (Math.floor(curAbs / (Math.PI * 2)) !== Math.floor(prevAbs / (Math.PI * 2))) {
        audio.playNote(body.radius, MIN_RADIUS, MAX_RADIUS);
      }

      body.mesh.getWorldPosition(worldPos);
      body.trail.unshift(worldPos.clone());
      if (body.trail.length > TRAIL_LENGTH) body.trail.pop();
      const posAttr = body.trailPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
      const colAttr = body.trailPoints.geometry.getAttribute("color") as THREE.BufferAttribute;
      for (let i = 0; i < body.trail.length; i++) {
        const p = body.trail[i];
        posAttr.setXYZ(i, p.x, p.y, p.z);
        const fade = 1 - i / TRAIL_LENGTH;
        tmpColor.copy(body.color).multiplyScalar(fade * fade * 1.1);
        colAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      body.trailPoints.geometry.setDrawRange(0, body.trail.length);
    }
    prevGroupAngle = groupAngle;

    const level = audio.getLevel();
    const bands = audio.getBands();

    starMat.uniforms.uTime.value = elapsed;
    starMat.uniforms.uLevel.value = level;
    coreLight.intensity = 1.8 + level * 3.5;
    core.scale.setScalar(1 + level * 0.3);

    tmpColor
      .copy(lowColor).multiplyScalar(bands.low)
      .add(tmpColor.clone().copy(midColor).multiplyScalar(bands.mid))
      .add(tmpColor.clone().copy(highColor).multiplyScalar(bands.high));
    accentColor.setHSL(chartHue, 0.6, 0.55);
    nebulaMat.color.copy(tmpColor).lerp(accentColor, 0.35);
    nebulaMat.opacity = 0.1 + ((bands.low + bands.mid + bands.high) / 3) * 0.35;
    nebula.rotation.y += dt * 0.02;

    bloomPass.strength = 0.3 + level * 0.5;

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

    camAngle += dt * 0.03;
    camera.position.x = Math.sin(camAngle) * baseCamPos.length() * 0.95;
    camera.position.z = Math.cos(camAngle) * baseCamPos.length() * 0.95;
    camera.position.y = baseCamPos.y + Math.sin(camAngle * 0.5) * 0.6;
    camera.lookAt(0, 0, 0);

    composer.render();
  }
  animate();

  return { applyAstrologyChart, applyBaziChart, applyNumerologyChart };
}
