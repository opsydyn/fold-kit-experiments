import {
  BoxGeometry,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

const canvas = document.createElement('canvas');
document.body.append(canvas);
const renderer = new WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(256, 256, false);
const scene = new Scene();
const camera = new PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 0, 4);
const light = new DirectionalLight(0xffffff, 3);
light.position.set(2, 3, 4);
scene.add(light);
const cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0x3366ff }));
cube.rotation.set(0.5, 0.7, 0);
scene.add(cube);
renderer.render(scene, camera);
Object.assign(globalThis, {
  __spike: {
    info: () => ({ ...renderer.info.memory }),
    dispose: () => {
      cube.geometry.dispose();
      cube.material.dispose();
    },
  },
});
document.title = 'ready';
