// 3D model of the house and addition, built from `state.model`.
// Plan coordinates (x east, y north, feet) map to three.js as (x, z = -y),
// with y up.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const WALL_T = 0.5;
const FRAMING_COLOR = "#c9a46a"; // sheathed framing before siding

const toV3 = ([x, y], h = 0) => new THREE.Vector3(x, h, -y);

function centroid(pts) {
  const c = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return [c[0] / pts.length, c[1] / pts.length];
}

// A flat panel along a footprint edge, from height y0 to y1 (above grade),
// with rectangular holes. Placed so its outer face sits `out` ft outside the
// footprint line and it extends `t` ft inward from there.
function edgePanel(p0, p1, inside, y0, y1, holes, t, out = 0) {
  const a = toV3(p0), b = toV3(p1);
  const len = a.distanceTo(b);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(len, 0); shape.lineTo(len, y1 - y0); shape.lineTo(0, y1 - y0); shape.lineTo(0, 0);
  for (const h of holes) {
    const hx0 = Math.max(0.05, h.x0), hx1 = Math.min(len - 0.05, h.x1);
    const hy0 = Math.max(0.05, h.y0 - y0), hy1 = Math.min(y1 - y0 - 0.05, h.y1 - y0);
    if (hx1 - hx0 < 0.1 || hy1 - hy0 < 0.1) continue;
    const p = new THREE.Path();
    p.moveTo(hx0, hy0); p.lineTo(hx0, hy1); p.lineTo(hx1, hy1); p.lineTo(hx1, hy0); p.lineTo(hx0, hy0);
    shape.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  const X = b.clone().sub(a).normalize();
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3().crossVectors(X, Y);
  const toInside = toV3(inside).sub(a);
  const zOut = Z.dot(toInside) < 0; // extrusion direction points outward
  const m = new THREE.Matrix4().makeBasis(X, Y, Z);
  const pos = a.clone().add(new THREE.Vector3(0, y0, 0));
  // Outer face at `out` outside the line; panel extends t inward.
  const outward = zOut ? Z.clone() : Z.clone().negate();
  if (zOut) pos.add(outward.clone().multiplyScalar(out - t));
  else pos.add(outward.clone().multiplyScalar(out));
  m.setPosition(pos);
  geo.applyMatrix4(m);
  return { geo, X, outward, a, len };
}

function hipRoofGeometry(eave, eaveZ, pitch) {
  const c = eave.map((p) => new THREE.Vector2(p[0], p[1]));
  const e01 = c[0].distanceTo(c[1]), e12 = c[1].distanceTo(c[2]);
  const longFirst = e01 >= e12;
  const L = Math.max(e01, e12), W = Math.min(e01, e12);
  const center = c[0].clone().add(c[2]).multiplyScalar(0.5);
  const axis = (longFirst ? c[1].clone().sub(c[0]) : c[2].clone().sub(c[1])).normalize();
  const half = (L - W) / 2;
  const rise = (W / 2) * (pitch / 12);
  const r1 = center.clone().addScaledVector(axis, -half);
  const r2 = center.clone().addScaledVector(axis, half);
  const ridgeFor = (p) => (p.distanceTo(r1) <= p.distanceTo(r2) ? r1 : r2);
  const P = (v, z) => new THREE.Vector3(v.x, z, -v.y);
  const tris = [];
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4];
    const ra = ridgeFor(a), rb = ridgeFor(b);
    const A = P(a, eaveZ), B = P(b, eaveZ), RA = P(ra, eaveZ + rise), RB = P(rb, eaveZ + rise);
    tris.push([A, B, RB]);
    if (ra !== rb) tris.push([A, RB, RA]);
  }
  // soffit
  const S = c.map((v) => P(v, eaveZ - 0.05));
  tris.push([S[0], S[2], S[1]], [S[0], S[3], S[2]]);
  const arr = [];
  for (const t of tris) for (const v of t) arr.push(v.x, v.y, v.z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
  geo.computeVertexNormals();
  return { geo, ridgeZ: eaveZ + rise };
}

// A room name label: wide canvas, sized to the text.
function labelSprite(text) {
  const cv = document.createElement("canvas");
  const g = cv.getContext("2d");
  const font = "600 44px system-ui, sans-serif";
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 36;
  cv.width = w; cv.height = 72;
  g.font = font;
  g.fillStyle = "rgba(255,255,255,0.86)";
  g.beginPath(); g.roundRect(0, 0, w, 72, 16); g.fill();
  g.fillStyle = "#2b2a27";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, w / 2, 38);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
  sp.scale.set((w / 72) * 1.5, 1.5, 1);
  sp.renderOrder = 10;
  return sp;
}

const FINISH_COLORS = { carpet: "#b9ab95", wood: "#a8794f", tile: "#d9d4ca", rubber: "#55524d" };

function textSprite(text, color = "#222") {
  const cv = document.createElement("canvas");
  cv.width = 128; cv.height = 128;
  const g = cv.getContext("2d");
  g.fillStyle = color;
  g.font = "bold 80px system-ui, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 64, 68);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
  sp.scale.set(6, 6, 1);
  return sp;
}

export function createModelView(container, tooltipEl) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minDistance = 8;
  controls.maxDistance = 600;
  controls.screenSpacePanning = true;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("aria-label", "3D model. Arrow keys pan when focused.");
  controls.listenToKeyEvents(renderer.domElement);
  controls.keyPanSpeed = 14;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d8a7c, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(-60, 110, 40); // afternoon sun from the southwest
  sun.castShadow = true;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 400 });
  scene.add(sun);

  const groundMat = new THREE.MeshStandardMaterial({ color: "#a7b48f", roughness: 1, transparent: true, opacity: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 96), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.ground = true;
  scene.add(ground);

  const north = textSprite("N", "#3a3a36");
  north.position.set(-55, 1, -40);
  scene.add(north);
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-55, 0.3, -28), 9, 0x3a3a36, 3, 2);
  scene.add(arrow);

  let group = new THREE.Group();
  scene.add(group);
  let parts = [];
  let opts = { mode: "finished", showExisting: true, xray: false, interior: false };
  let labels = [];
  let interiorCut = 8;
  let interiorCenter = null;
  let lastState = null, lastProgress = {};
  let center = new THREE.Vector3();
  let radius = 60;

  function mat(color, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, ...extra });
  }

  const edgeMat = new THREE.LineBasicMaterial({ color: 0x4a4a46, transparent: true, opacity: 0.55 });
  function add(mesh, info) {
    if (info.kind === "new") {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), edgeMat);
      edges.visible = false;
      edges.raycast = () => {};
      mesh.add(edges);
      info.edges = edges;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { ...info, baseColor: mesh.material.color.getHex(), baseOpacity: mesh.material.opacity };
    group.add(mesh);
    parts.push(mesh);
    return mesh;
  }

  // Interior partitions, floor finishes, fixtures and room labels.
  function buildInterior(int) {
    if (!int) return;
    const frames = int.frames || {};
    const toPlan = (frame, p) => {
      const f = frames[frame];
      if (!f) return p;
      return [f.origin[0] + p[0] * f.u[0] + p[1] * f.v[0], f.origin[1] + p[0] * f.u[1] + p[1] * f.v[1]];
    };
    const floor = int.floor ?? 0, ceil = int.ceiling ?? floor + 8, doorH = int.doorHeight ?? 6.67;
    interiorCut = int.cutHeight ?? floor + 5;
    const wallMat = mat("#eee8dd");
    const T = 0.4;

    const box = (a, b, y0, y1, m, info) => {
      // a box between plan points a and b (centerline), y0..y1 high
      const A = toV3(a), B = toV3(b);
      const len = A.distanceTo(B);
      if (len < 0.05 || y1 - y0 < 0.05) return;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, y1 - y0, T), m);
      mesh.position.copy(A.clone().add(B).multiplyScalar(0.5)).setY((y0 + y1) / 2);
      mesh.rotation.y = Math.atan2(-(B.z - A.z), B.x - A.x);
      add(mesh, info);
    };

    for (const w of int.walls || []) {
      const a = toPlan(w.frame, w.a), b = toPlan(w.frame, w.b);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const at = (t) => [a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len];
      const base = w.fire ? 0 : floor;
      const info = { kind: "new", phase: "framing", interior: true, label: w.fire ? "1-hour wall between house and garage" : "Interior wall" };
      const doors = [...(w.doors || [])].sort((x, y) => x[0] - y[0]);
      let t = 0;
      for (const [d0, d1] of doors) {
        box(at(t), at(d0), base, ceil, wallMat, info);
        box(at(d0), at(d1), floor + doorH, ceil, wallMat, { ...info, label: "Door opening" });
        t = d1;
      }
      box(at(t), at(len), base, ceil, wallMat, info);
    }

    for (const r of int.rooms || []) {
      const pts = r.poly.map((p) => toPlan(r.frame, p));
      const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, floor + 0.04, 0);
      const m = mat(FINISH_COLORS[r.finish] || "#ccc", { polygonOffset: true, polygonOffsetFactor: -1 });
      add(new THREE.Mesh(geo, m), { kind: "new", phase: "flooring", interior: true, label: `${r.name} · ${r.finish}` });
      const [cx, cy] = r.at ? toPlan(r.frame, r.at) : centroid(pts);
      const sp = labelSprite(r.name.replace(/ \(.*\)$/, ""));
      sp.position.set(cx, floor + 2.2, -cy);
      sp.visible = false;
      group.add(sp);
      labels.push(sp);
    }

    for (const f of int.fixtures || []) {
      const [[u0, v0], [u1, v1]] = f.box;
      const corners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map((p) => toPlan(f.frame, p));
      const info = { kind: "new", phase: "fixtures", interior: true, label: f.label };
      const m = f.glass
        ? mat("#9fc3d6", { transparent: true, opacity: 0.35, roughness: 0.1 })
        : mat(f.color || "#ddd");
      const extrude = (pts, y0, h) => {
        const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: h, bevelEnabled: false });
        g.rotateX(-Math.PI / 2);
        g.translate(0, y0, 0);
        add(new THREE.Mesh(g, m.clone()), info);
      };
      if (f.steps) {
        // risers climb from the garage slab (first edge) up to the house floor (far edge)
        const n = f.steps;
        for (let i = 0; i < n; i++) {
          const k0 = i / n, k1 = 1;
          const lerp = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
          const pts = [lerp(corners[0], corners[3], k0), lerp(corners[1], corners[2], k0), lerp(corners[1], corners[2], k1), lerp(corners[0], corners[3], k1)];
          extrude(pts, 0, (floor * (i + 1)) / (n + 1));
        }
      } else {
        extrude(corners, floor + 0.05, f.h);
      }
    }
    const all = (int.rooms || []).flatMap((r) => r.poly.map((p) => toPlan(r.frame, p)));
    if (all.length) {
      const [cx, cy] = centroid(all);
      interiorCenter = new THREE.Vector3(cx, floor, -cy);
    }
  }

  function build(model) {
    scene.remove(group);
    group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    group = new THREE.Group();
    parts = [];
    labels = [];
    scene.add(group);
    const M = model.materials || {};
    buildInterior(model.interior, M);

    for (const vol of model.volumes || []) {
      const pts = vol.footprint;
      const inside = centroid(pts);
      const isNew = vol.kind === "new";
      const shared = new Set(vol.sharedEdges || []);

      // Foundation / basement
      const fShape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const fBottom = isNew ? -(vol.basementDepth || 1.5) : -1;
      const fGeo = new THREE.ExtrudeGeometry(fShape, { depth: vol.floor - fBottom + 0.01, bevelEnabled: false });
      fGeo.rotateX(-Math.PI / 2);
      fGeo.translate(0, fBottom, 0);
      add(new THREE.Mesh(fGeo, mat(M.foundation || "#999")), { kind: vol.kind, phase: "foundation", label: `${vol.label}: foundation` });

      if (!isNew) {
        const wGeo = new THREE.ExtrudeGeometry(fShape, { depth: vol.plate - vol.floor, bevelEnabled: false });
        wGeo.rotateX(-Math.PI / 2);
        wGeo.translate(0, vol.floor, 0);
        add(new THREE.Mesh(wGeo, mat(M.existingWalls || "#bbb")), { kind: "existing", phase: "existing", label: vol.label });
        continue;
      }

      const openings = vol.openings || [];
      pts.forEach((p0, i) => {
        if (shared.has(i)) return;
        const p1 = pts[(i + 1) % pts.length];
        const holes = openings.filter((o) => o.edge === i).map((o) => ({
          x0: o.offset, x1: o.offset + o.width, y0: vol.floor + o.sill, y1: vol.floor + o.sill + o.height, o,
        }));
        const wall = edgePanel(p0, p1, inside, vol.floor, vol.plate, holes, WALL_T);
        add(new THREE.Mesh(wall.geo, mat(M.siding || "#ddd")), { kind: "new", phase: "framing", siding: true, label: vol.label });

        if (vol.wainscot) {
          const brick = edgePanel(p0, p1, inside, 0.4, vol.floor + vol.wainscot, holes, 0.15, 0.15);
          add(new THREE.Mesh(brick.geo, mat(M.brick || "#8a5a44")), { kind: "new", phase: "siding", label: "Brick veneer wainscot" });
        }

        for (const h of holes) {
          const o = h.o;
          const w = o.width, ht = o.height;
          const mid = wall.a.clone()
            .addScaledVector(wall.X, o.offset + w / 2)
            .add(new THREE.Vector3(0, h.y0 + ht / 2, 0))
            .addScaledVector(wall.outward, -WALL_T / 2);
          const rotY = Math.atan2(-wall.X.z, wall.X.x);
          const fill = o.type === "garage" ? mat(M.garageDoor || "#555")
            : o.type === "door" ? mat(M.trim || "#333")
            : mat(M.glass || "#8ab", { transparent: true, opacity: 0.55, metalness: 0.2, roughness: 0.15 });
          const pane = new THREE.Mesh(new THREE.BoxGeometry(w, ht, 0.12), fill);
          pane.position.copy(mid);
          pane.rotation.y = rotY;
          add(pane, { kind: "new", phase: "openings", label: o.label || o.type });
          // frame
          const fm = mat(M.trim || "#333");
          const bars = [
            [w + 0.4, 0.2, 0, ht / 2 + 0.1], [w + 0.4, 0.2, 0, -ht / 2 - 0.1],
            [0.2, ht, -w / 2 - 0.1, 0], [0.2, ht, w / 2 + 0.1, 0],
          ];
          if (o.type === "garage") for (let k = 1; k < 4; k++) bars.push([w, 0.08, 0, -ht / 2 + (k * ht) / 4]);
          for (const [bw, bh, dx, dy] of bars) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, WALL_T + 0.12), fm);
            bar.position.copy(mid).addScaledVector(wall.X, dx).add(new THREE.Vector3(0, dy, 0));
            bar.rotation.y = rotY;
            add(bar, { kind: "new", phase: "openings", label: o.label || o.type });
          }
        }
      });
    }

    let top = 0;
    for (const r of model.roofs || []) {
      const { geo, ridgeZ } = hipRoofGeometry(r.eave, r.eaveZ, r.pitch);
      top = Math.max(top, ridgeZ);
      const isNew = r.kind === "new";
      const m = isNew
        ? mat(M.roof || "#444", { metalness: 0.45, roughness: 0.45 })
        : mat(M.existingRoof || "#777");
      add(new THREE.Mesh(geo, m), { kind: r.kind, roof: true, phase: isNew ? "roof" : "existing", label: isNew ? `New roof (${r.pitch}/12 standing seam)` : "Existing roof" });
    }

    const box = new THREE.Box3();
    for (const p of parts) if (p.userData.kind === "new") box.expandByObject(p);
    if (box.isEmpty()) box.setFromObject(group);
    box.getCenter(center);
    radius = box.getSize(new THREE.Vector3()).length() / 2 || 60;
    return top;
  }

  function phaseStatus(phase) {
    const task = lastState?.model?.phases?.[phase];
    if (!task) return 100;
    return lastProgress[task] ?? 0;
  }

  function applyMode() {
    for (const p of parts) {
      const u = p.userData;
      const m = p.material;
      let visible = true, opacity = 1, color = u.baseColor, ghost = false;
      if (u.kind === "existing") {
        visible = opts.showExisting;
        opacity = opts.xray ? 0.35 : 1;
      } else if (opts.mode === "progress") {
        const pct = phaseStatus(u.phase);
        if (pct <= 0) { opacity = 0.06; ghost = true; }
        else if (pct < 100) opacity = 0.6;
        if (u.siding) {
          const s = phaseStatus("siding");
          const f = phaseStatus("framing");
          if (f > 0 && s < 100) color = new THREE.Color(FRAMING_COLOR).getHex();
        }
      }
      if (u.phase === "foundation" && opts.xray) opacity = Math.min(opacity, 0.85);
      if (opts.interior && u.roof) visible = false;
      p.visible = visible;
      m.color.setHex(color);
      if (u.edges) u.edges.visible = ghost;
      m.opacity = u.baseOpacity * opacity;
      m.transparent = m.opacity < 1;
      m.depthWrite = m.opacity >= 1;
      m.needsUpdate = true;
      p.castShadow = !ghost && opacity === 1;
      p.userData.ghost = ghost;
    }
    groundMat.opacity = opts.xray ? 0.35 : 1;
    groundMat.depthWrite = !opts.xray;
    // Inside: slice every wall at the cut height so rooms show from above
    renderer.clippingPlanes = opts.interior ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), interiorCut)] : [];
    sun.castShadow = !opts.interior;
    for (const l of labels) l.visible = opts.interior;
  }

  function setView(name) {
    const c = center;
    const r = radius * 1.6 * Math.max(1, 1.2 / (camera.aspect || 1));
    if (name === "inside" && interiorCenter) {
      const ic = interiorCenter;
      camera.position.set(ic.x - 26, ic.y + 52, ic.z + 30);
      controls.target.copy(ic);
      controls.update();
      return;
    }
    if (name === "top") camera.position.set(c.x, c.y + r * 2.6, c.z + 0.001);
    else if (name === "street") camera.position.set(c.x + 8, 5.5, c.z - r * 1.25);
    else camera.position.set(c.x - r * 0.8, c.y + r * 0.42, c.z - r * 0.8);
    controls.target.copy(c);
    controls.update();
  }

  // Button controls: pan, tilt, zoom, rotate
  function nudge(action) {
    const offset = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(offset);
    const step = sph.radius * 0.12;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
    let pan = null;
    switch (action) {
      case "zoom-in": sph.radius = Math.max(controls.minDistance, sph.radius * 0.8); break;
      case "zoom-out": sph.radius = Math.min(controls.maxDistance, sph.radius * 1.25); break;
      case "tilt-up": sph.phi = Math.max(0.05, sph.phi - 0.15); break;
      case "tilt-down": sph.phi = Math.min(controls.maxPolarAngle, sph.phi + 0.15); break;
      case "rot-left": sph.theta -= Math.PI / 12; break;
      case "rot-right": sph.theta += Math.PI / 12; break;
      case "pan-left": pan = right.multiplyScalar(-step); break;
      case "pan-right": pan = right.multiplyScalar(step); break;
      case "pan-up": pan = up.multiplyScalar(step); break;
      case "pan-down": pan = up.multiplyScalar(-step); break;
      case "pan-reset": controls.target.copy(center); break;
    }
    if (pan) controls.target.add(pan);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
    controls.update();
  }

  // Hover labels
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  renderer.domElement.addEventListener("pointermove", (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(parts.filter((p) => p.visible && !p.userData.ghost), false)[0];
    if (hit && tooltipEl) {
      tooltipEl.textContent = hit.object.userData.label;
      tooltipEl.style.left = `${e.clientX - rect.left + 14}px`;
      tooltipEl.style.top = `${e.clientY - rect.top + 14}px`;
      tooltipEl.hidden = false;
    } else if (tooltipEl) tooltipEl.hidden = true;
  });
  renderer.domElement.addEventListener("pointerleave", () => { if (tooltipEl) tooltipEl.hidden = true; });

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);

  let modelKey = "";
  let framed = false;
  function loop() {
    requestAnimationFrame(loop);
    if (!container.offsetParent) return; // hidden tab
    controls.update();
    renderer.render(scene, camera);
  }
  loop();

  return {
    update(state, progressByTask) {
      lastState = state;
      lastProgress = progressByTask;
      const key = JSON.stringify(state.model);
      if (key !== modelKey) {
        modelKey = key;
        build(state.model);
        if (!framed) { resize(); setView("3d"); framed = true; }
      }
      applyMode();
    },
    set(next) {
      Object.assign(opts, next);
      applyMode();
    },
    setView,
    nudge,
    snapshot() {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    },
  };
}
