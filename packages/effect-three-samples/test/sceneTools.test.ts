/**
 * The scene MCP server's tools (`scripts/sceneTools.ts`): a scene described, checked,
 * previewed and diffed from a file, from text, or from a running app's Model, with a
 * stand-in for the Foldkit DevTools MCP server answering as it does.
 */
import { expect, test } from 'bun:test';

import {
  ambientLight,
  basic,
  box,
  behave,
  mesh,
  perspectiveCamera,
  scene,
  sphere,
  SceneFile,
} from '@opsydyn/effect-three';

import { callTool, type DevTools, tools } from '../scripts/sceneTools.ts';

const crate = mesh({
  key: 'crate',
  position: [1, 0.5, 0],
  geometry: box(),
  material: basic({ color: 0xff0000 }),
});
const ball = mesh({
  key: 'ball',
  position: [-1, 0.5, 0],
  geometry: sphere({ radius: 0.5 }),
  material: basic({ color: 0x0000ff }),
});
const camera = perspectiveCamera({ position: [0, 3, 6], lookAt: [0, 0.5, 0] });
const room = scene({ camera, children: [ambientLight({ key: 'sky' }), crate, ball] });

/** What the DevTools server says for a Model path, as `foldkit_get_model` answers. */
const runningApp =
  (model: ReadonlyMap<string, string>): DevTools =>
  async (tool, args) => {
    if (tool === 'foldkit_list_runtimes')
      return '{"_tag":"ResponseRuntimes","runtimes":[{"connectionId":"r-1","title":"Editor"}]}';
    const value = model.get(String(args['path']));
    return value === undefined
      ? `Error: no value at ${String(args['path'])}`
      : `{"_tag":"ResponseModel","value":${value}}`;
  };

const noApp: DevTools = async () => 'Error: Not connected to a Foldkit dev server.';

test('the tools are listed with their inputs', () => {
  expect(tools.map((tool) => tool.name)).toEqual([
    'scene_runtimes',
    'scene_describe',
    'scene_check',
    'scene_preview',
    'scene_diff',
  ]);
});

test('a scene is described from a saved file, its text, or a bare description', async () => {
  const path = `${import.meta.dir}/../coverage/room.scene.json`;
  await Bun.write(path, SceneFile.save(room));
  const fromFile = await callTool(noApp, 'scene_describe', { file: path });
  expect(fromFile).toContain('Things (2)');
  expect(fromFile).toContain('crate');
  expect(await callTool(noApp, 'scene_describe', { text: SceneFile.save(room) })).toBe(fromFile);
  // Bare nodes, with only what they say: the rest of the scene at its defaults.
  const bare = JSON.stringify({ children: [crate] });
  expect(await callTool(noApp, 'scene_describe', { text: bare })).toContain('Things (1)');
});

test('a running app’s scene is read at its Model path and described, camera and all', async () => {
  const app = runningApp(
    new Map([
      ['root.nodes', JSON.stringify(room.children)],
      ['root.camera', JSON.stringify(camera)],
    ]),
  );
  expect(await callTool(app, 'scene_runtimes', {})).toContain('r-1');
  const described = await callTool(app, 'scene_describe', {
    runtime_id: 'r-1',
    camera_path: 'root.camera',
  });
  expect(described).toContain('Things (2)');
  expect(described).toContain('Camera: perspective at (0, 3, 6)');
  // A path that holds no scene says why.
  const missing = await callTool(app, 'scene_describe', {
    runtime_id: 'r-1',
    nodes_path: 'root.x',
  });
  expect(missing).toContain('no value at root.x');
});

test('a check finds what the schemas refuse, what the scene’s rules refuse, and names behaviours', async () => {
  expect(await callTool(noApp, 'scene_check', { text: SceneFile.save(room) })).toBe(
    'Valid: 3 top-level nodes.',
  );
  const twice = scene({ children: [crate, crate] });
  expect(await callTool(noApp, 'scene_check', { text: SceneFile.save(twice) })).toContain(
    'DuplicateKey',
  );
  const floating = scene({ children: [mesh({ ...crate, behaviour: behave('bob') })] });
  expect(await callTool(noApp, 'scene_check', { text: SceneFile.save(floating) })).toContain(
    'Uses behaviours the app must register: bob.',
  );
  const broken = await callTool(noApp, 'scene_check', {
    text: JSON.stringify({ children: [{ _tag: 'Mesh', key: 1 }] }),
  });
  expect(broken).toContain('is neither a scene file');
  expect(broken).toContain('["children"][0]["key"]');
});

test('a preview is SVG of the size asked for', async () => {
  const svg = await callTool(noApp, 'scene_preview', {
    text: SceneFile.save(room),
    width: 200,
    height: 100,
  });
  expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"');
});

test('a diff names what changed between two scenes, from any two sources', async () => {
  const moved = scene({ camera, children: [ambientLight({ key: 'sky' }), crate] });
  const diff = await callTool(noApp, 'scene_diff', {
    before: { text: SceneFile.save(room) },
    after: { text: SceneFile.save(moved) },
  });
  expect(diff).toContain('ball');
  expect(
    await callTool(noApp, 'scene_diff', {
      before: { text: SceneFile.save(room) },
      after: { text: SceneFile.save(room) },
    }),
  ).toBe('No changes.');
});

test('without a scene, or with what is not one, the tools say so', async () => {
  expect(await callTool(noApp, 'scene_describe', {})).toContain('Name a scene');
  expect(await callTool(noApp, 'scene_describe', { text: 'not json' })).toContain(
    'Expected a valid JSON string',
  );
  expect(await callTool(noApp, 'scene_describe', { file: '/nowhere.json' })).toContain(
    'There is no file at /nowhere.json',
  );
  expect(await callTool(noApp, 'scene_describe', { runtime_id: 'r-1' })).toContain('Not connected');
  expect(await callTool(noApp, 'scene_unknown', {})).toBe('No tool named scene_unknown.');
});
