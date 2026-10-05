import * as THREE from 'three';
import { createChibiSoldierModel, createChibiSoldierLookDevLights, frameChibiSoldierCamera,
         createChibiSoldierInspectControls } from './createObjectModel';
// Flat cartoon look: bright neutral light, no tone mapping (the generated 'reference' light mode is dim/warm).
const LIGHT_SCALE = 0.92;
const w = 760, h = 640;
const r = new THREE.WebGLRenderer({ antialias: true });
r.setSize(w, h); r.toneMapping = THREE.NoToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('view')!.appendChild(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1e1e1e);
const model = createChibiSoldierModel(); scene.add(model);
const lights = createChibiSoldierLookDevLights('neutral');
lights.traverse((o: any) => { if (o.isLight) o.intensity *= LIGHT_SCALE; });
scene.add(lights); scene.add(new THREE.AmbientLight(0xffffff, 1.6 * LIGHT_SCALE));
const cam = new THREE.PerspectiveCamera(30, w / h, 0.01, 100);
frameChibiSoldierCamera(cam, model, { azimuthDeg: 0, elevationDeg: 4, margin: 1.1 });
const controls = createChibiSoldierInspectControls(cam, r.domElement);
controls.target.copy(new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3())); controls.update();
(function loop() { requestAnimationFrame(loop); controls.update(); r.render(scene, cam); })();
