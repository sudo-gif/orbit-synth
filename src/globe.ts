import * as THREE from "three";

export type Place = { lat: number; lon: number; cityName: string };

const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: "東京", lat: 35.68, lon: 139.69 }, { name: "大阪", lat: 34.69, lon: 135.5 },
  { name: "札幌", lat: 43.07, lon: 141.35 }, { name: "福岡", lat: 33.59, lon: 130.4 },
  { name: "ソウル", lat: 37.57, lon: 126.98 }, { name: "北京", lat: 39.9, lon: 116.41 },
  { name: "上海", lat: 31.23, lon: 121.47 }, { name: "香港", lat: 22.32, lon: 114.17 },
  { name: "台北", lat: 25.03, lon: 121.57 }, { name: "バンコク", lat: 13.75, lon: 100.5 },
  { name: "シンガポール", lat: 1.35, lon: 103.82 }, { name: "ジャカルタ", lat: -6.21, lon: 106.85 },
  { name: "マニラ", lat: 14.6, lon: 120.98 }, { name: "デリー", lat: 28.61, lon: 77.21 },
  { name: "ムンバイ", lat: 19.08, lon: 72.88 }, { name: "ドバイ", lat: 25.2, lon: 55.27 },
  { name: "イスタンブール", lat: 41.01, lon: 28.98 }, { name: "モスクワ", lat: 55.76, lon: 37.62 },
  { name: "カイロ", lat: 30.04, lon: 31.24 }, { name: "ナイロビ", lat: -1.29, lon: 36.82 },
  { name: "ヨハネスブルグ", lat: -26.2, lon: 28.05 }, { name: "ロンドン", lat: 51.51, lon: -0.13 },
  { name: "パリ", lat: 48.86, lon: 2.35 }, { name: "ベルリン", lat: 52.52, lon: 13.4 },
  { name: "ローマ", lat: 41.9, lon: 12.5 }, { name: "マドリード", lat: 40.42, lon: -3.7 },
  { name: "アムステルダム", lat: 52.37, lon: 4.9 }, { name: "ストックホルム", lat: 59.33, lon: 18.07 },
  { name: "アテネ", lat: 37.98, lon: 23.73 }, { name: "ニューヨーク", lat: 40.71, lon: -74.01 },
  { name: "ロサンゼルス", lat: 34.05, lon: -118.24 }, { name: "シカゴ", lat: 41.88, lon: -87.63 },
  { name: "トロント", lat: 43.65, lon: -79.38 }, { name: "メキシコシティ", lat: 19.43, lon: -99.13 },
  { name: "サンパウロ", lat: -23.55, lon: -46.63 }, { name: "ブエノスアイレス", lat: -34.6, lon: -58.38 },
  { name: "リマ", lat: -12.05, lon: -77.04 }, { name: "ボゴタ", lat: 4.71, lon: -74.07 },
  { name: "シドニー", lat: -33.87, lon: 151.21 }, { name: "メルボルン", lat: -37.81, lon: 144.96 },
  { name: "オークランド", lat: -36.85, lon: 174.76 }, { name: "ホノルル", lat: 21.31, lon: -157.86 },
];

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export function showGlobePicker(): Promise<Place> {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:fixed;inset:0;z-index:22;background:rgba(0,0,0,0.25);opacity:0;transition:opacity 1.4s ease;";
    document.body.appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => (wrap.style.opacity = "1")));

    const label = document.createElement("div");
    label.style.cssText =
      "position:absolute;left:50%;top:12%;transform:translateX(-50%);color:#d8e0ff;" +
      "font:300 15px/1.9 'Hiragino Mincho ProN','Yu Mincho',serif;letter-spacing:0.15em;text-align:center;" +
      "text-shadow:0 0 16px rgba(140,160,255,0.6);pointer-events:none;white-space:nowrap;";
    label.textContent = "ドラッグで地球を回し、生まれた場所に近い光をクリックしてください";
    wrap.appendChild(label);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 6);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    wrap.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    globeGroup.rotation.x = -0.2;
    globeGroup.rotation.y = 0.4;
    scene.add(globeGroup);

    globeGroup.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1.97, 32, 24),
        new THREE.MeshBasicMaterial({ color: 0x0a1030, transparent: true, opacity: 0.7 })
      )
    );
    globeGroup.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(2, 28, 20),
        new THREE.MeshBasicMaterial({ color: 0x4a5fc0, wireframe: true, transparent: true, opacity: 0.3 })
      )
    );

    const markerGeo = new THREE.SphereGeometry(0.07, 10, 10);
    const markers: { mesh: THREE.Mesh; city: (typeof CITIES)[0] }[] = [];
    for (const city of CITIES) {
      const mesh = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0x9fc0ff }));
      mesh.position.copy(latLonToVector3(city.lat, city.lon, 2.03));
      globeGroup.add(mesh);
      markers.push({ mesh, city });
    }

    scene.add(new THREE.PointLight(0xffffff, 1.1, 20).translateX(5).translateY(3).translateZ(5));
    scene.add(new THREE.AmbientLight(0x4050a0, 0.7));

    let dragging = false;
    let lastX = 0, lastY = 0, moved = 0;
    renderer.domElement.addEventListener("pointerdown", (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY; moved = 0;
    });
    window.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      globeGroup.rotation.y += (e.clientX - lastX) * 0.005;
      globeGroup.rotation.x = THREE.MathUtils.clamp(globeGroup.rotation.x + (e.clientY - lastY) * 0.005, -1.4, 1.4);
      moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY;
    });
    window.addEventListener("pointerup", (e) => {
      dragging = false;
      if (moved > 6) return; // ドラッグ扱い。クリック判定しない
      const rect = renderer.domElement.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right) return;
      const pointer = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(markers.map((m) => m.mesh))[0];
      if (hit) {
        const found = markers.find((m) => m.mesh === hit.object)!;
        finish(found.city);
      }
    });
    function finish(city: { name: string; lat: number; lon: number }) {
      cancelAnimationFrame(raf);
      wrap.style.opacity = "0";
      window.setTimeout(() => {
        renderer.dispose();
        document.body.removeChild(wrap);
      }, 1400);
      resolve({ lat: city.lat, lon: city.lon, cityName: city.name });
    }

    let raf = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  });
}
