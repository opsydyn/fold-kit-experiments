// What the scene MCP server (`scene-mcp.ts`) answers with: a scene's description, its
// problems, a still of it, or what changed between two. A scene comes from a saved file,
// from text, or from a running Foldkit app, read through the Foldkit DevTools MCP server
// at a Model path that holds scene nodes (the editor's `root.nodes`), so an agent asks
// about the scene rather than reading the raw Model.
import {
  describeScene,
  formatChanges,
  formatSummary,
  indexScene,
  previewSvg,
  scene,
  type SceneDescription,
  SceneFile,
  type SceneNode,
  SceneSchema,
  sceneChanges,
} from '@opsydyn/effect-three';
import { Option, Result, Schema } from 'effect';

/** Arguments the server passes on to a Foldkit DevTools MCP tool. */
export type DevToolsArgs = Readonly<Record<string, string | boolean>>;

/** Calls a Foldkit DevTools MCP tool and answers with its text. */
export type DevTools = (tool: string, args: DevToolsArgs) => Promise<string>;

/** Where a scene is: a file, text, or a running app's Model. */
const Source = Schema.Struct({
  file: Schema.optionalKey(Schema.String),
  text: Schema.optionalKey(Schema.String),
  runtime_id: Schema.optionalKey(Schema.String),
  /** The Model path holding the scene's nodes (default `root.nodes`). */
  nodes_path: Schema.optionalKey(Schema.String),
  /** The Model path holding its camera, if it keeps one. */
  camera_path: Schema.optionalKey(Schema.String),
});
export type SceneSource = typeof Source.Type;

const PreviewArgs = Schema.Struct({
  ...Source.fields,
  width: Schema.optionalKey(Schema.Finite),
  height: Schema.optionalKey(Schema.Finite),
  at: Schema.optionalKey(Schema.Finite),
});

const DiffArgs = Schema.Struct({ before: Source, after: Source });

/** A scene given as bare JSON: its nodes, and its camera if it says. */
const Bare = Schema.fromJsonString(
  Schema.Struct({
    children: Schema.Array(SceneSchema.SceneNode),
    camera: Schema.optionalKey(SceneSchema.Camera),
  }),
);

/** What `foldkit_get_model` answers for a path holding nodes, or a camera. */
const NodesAnswer = Schema.fromJsonString(
  Schema.Struct({ value: Schema.Array(SceneSchema.SceneNode) }),
);
const CameraAnswer = Schema.fromJsonString(Schema.Struct({ value: SceneSchema.Camera }));

/** The JSON Schema of a scene source, for the tools' inputs. */
const sourceSchema = {
  type: 'object',
  properties: {
    file: { type: 'string', description: 'A saved scene file (SceneFile.save), by path.' },
    text: {
      type: 'string',
      description:
        'A scene as JSON: a saved scene file, or { "children": [nodes], "camera"?: camera }.',
    },
    runtime_id: {
      type: 'string',
      description: 'A running app: its connectionId from scene_runtimes.',
    },
    nodes_path: {
      type: 'string',
      description: "The Model path of the app's scene nodes (default root.nodes).",
    },
    camera_path: {
      type: 'string',
      description: "The Model path of the app's camera (for example root.camera), if any.",
    },
  },
} as const;

/** The tools, as MCP lists them. */
export const tools = [
  {
    name: 'scene_runtimes',
    description:
      'The running Foldkit apps an agent can ask about, by runtime id (through the Foldkit DevTools MCP server).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'scene_describe',
    description:
      "What a scene contains, in a few lines: its camera, each thing's kind, size, colour and place, its lights, bounds and staging. From a file, text, or a running app's Model.",
    inputSchema: sourceSchema,
  },
  {
    name: 'scene_check',
    description:
      'Whether a scene is valid: its shape against the scene schemas, then its own rules (unique keys, known geometries and materials). Behaviours an app registers itself are named for you to confirm.',
    inputSchema: sourceSchema,
  },
  {
    name: 'scene_preview',
    description:
      'A flat-shaded SVG still of a scene, drawn without a browser (no textures, shadows or labels).',
    inputSchema: {
      ...sourceSchema,
      properties: {
        ...sourceSchema.properties,
        width: { type: 'number', description: 'Pixels (default 640).' },
        height: { type: 'number', description: 'Pixels (default 400).' },
        at: { type: 'number', description: 'Scene time shown, in seconds (default 0).' },
      },
    },
  },
  {
    name: 'scene_diff',
    description: 'What changed from one scene to another, a line per change.',
    inputSchema: {
      type: 'object',
      properties: { before: sourceSchema, after: sourceSchema },
      required: ['before', 'after'],
    },
  },
] as const;

type Read = Result.Result<SceneDescription, string>;

/** A scene in JSON: a saved scene file, or bare `{ children, camera? }`. */
const fromText = (text: string, where: string): Read =>
  Result.orElse(
    Result.mapError(SceneFile.read(text), (unreadable) => unreadable.issue),
    (asFile) =>
      Result.match(Schema.decodeUnknownResult(Bare)(text), {
        onSuccess: ({ children, camera }) =>
          Result.succeed(scene(camera === undefined ? { children } : { children, camera })),
        onFailure: (asBare) =>
          Result.fail(
            `${where} is neither a scene file (${asFile}) nor { children, camera } (${asBare.message}).`,
          ),
      }),
  );

/** A DevTools answer decoded by `schema`, or what it said if it is not what was asked. */
const decodedAnswer = <A>(
  schema: Schema.Codec<{ readonly value: A }, string>,
  answer: string,
  where: string,
): Result.Result<A, string> =>
  Result.match(Schema.decodeUnknownResult(schema)(answer), {
    onSuccess: ({ value }) => Result.succeed(value),
    onFailure: (error) =>
      Result.fail(answer.trimStart().startsWith('{') ? `${where}: ${error.message}` : answer),
  });

/** A running app's scene: its nodes (and camera) read from its Model. */
const fromRuntime = async (
  devtools: DevTools,
  runtime: string,
  source: SceneSource,
): Promise<Read> => {
  const nodesPath = source.nodes_path ?? 'root.nodes';
  const ask = (path: string) =>
    devtools('foldkit_get_model', { runtime_id: runtime, path, expand: true });
  const nodes = decodedAnswer(NodesAnswer, await ask(nodesPath), `${runtime} at ${nodesPath}`);
  const camera = Option.fromNullishOr(source.camera_path);
  const cameraAnswer = Option.isSome(camera)
    ? Option.some(
        decodedAnswer(CameraAnswer, await ask(camera.value), `${runtime} at ${camera.value}`),
      )
    : Option.none();
  return Result.flatMap(nodes, (children: ReadonlyArray<SceneNode>) =>
    Option.match(cameraAnswer, {
      onNone: () => Result.succeed(scene({ children })),
      onSome: (read) => Result.map(read, (found) => scene({ children, camera: found })),
    }),
  );
};

/** The scene a source names, or why it cannot be had. */
export const sceneFrom = async (devtools: DevTools, source: SceneSource): Promise<Read> => {
  if (source.file !== undefined) {
    const file = Bun.file(source.file);
    return (await file.exists())
      ? fromText(await file.text(), source.file)
      : Result.fail(`There is no file at ${source.file}.`);
  }
  if (source.text !== undefined) return fromText(source.text, 'The text given');
  if (source.runtime_id !== undefined) return fromRuntime(devtools, source.runtime_id, source);
  return Result.fail(
    "Name a scene: a `file`, its `text`, or a running app's `runtime_id` (see scene_runtimes) with the `nodes_path` of its scene nodes.",
  );
};

/** Every behaviour name a scene's nodes use, which the app must have registered. */
function behavioursIn(nodes: ReadonlyArray<SceneNode>): ReadonlyArray<string> {
  const named = nodes.flatMap((node) => [
    ...('behaviour' in node && node.behaviour !== null ? [node.behaviour.name] : []),
    ...('children' in node ? behavioursIn(node.children) : []),
  ]);
  return [...new Set(named)];
}

/** A scene's problems against its own rules, behaviours an app registers set aside. */
const check = (description: SceneDescription): string => {
  const behaviours = behavioursIn(description.children);
  const indexed = indexScene(description, new Set(behaviours));
  const valid =
    indexed._tag === 'Invalid'
      ? `Invalid: ${JSON.stringify(indexed.error)}`
      : `Valid: ${description.children.length} top-level nodes.`;
  return behaviours.length === 0
    ? valid
    : `${valid}\nUses behaviours the app must register: ${behaviours.join(', ')}.`;
};

const preview = (description: SceneDescription, args: typeof PreviewArgs.Type): string => {
  const result = previewSvg(description, {
    width: args.width ?? 640,
    height: args.height ?? 400,
    at: args.at ?? 0,
  });
  return result._tag === 'Preview' ? result.svg : `Invalid: ${JSON.stringify(result.error)}`;
};

const diff = (before: SceneDescription, after: SceneDescription): string => {
  const changes = sceneChanges(before, after);
  return changes._tag === 'Changes'
    ? formatChanges(changes.changes)
    : `After: invalid (${JSON.stringify(changes.error)}).`;
};

/** Text from a scene read: what `answer` makes of it, or why there is no scene. */
const answered = (read: Read, answer: (description: SceneDescription) => string): string =>
  Result.match(read, { onSuccess: answer, onFailure: (problem) => problem });

/** A tool call's arguments, as MCP passes them: JSON. */
export type ToolArgs = { readonly [key: string]: Json };
type Json = string | number | boolean | null | ReadonlyArray<Json> | ToolArgs;

/** Arguments decoded by `schema`, or why they are not what the tool takes. */
const argsOf = <A>(schema: Schema.Codec<A, unknown>, args: ToolArgs): Result.Result<A, string> =>
  Result.mapError(
    Schema.decodeUnknownResult(schema)(args),
    (error) => `Those arguments are not what the tool takes: ${error.message}`,
  );

/** A tool answering a scene from `args` through `answer`. */
const sceneTool =
  (answer: (description: SceneDescription) => string) =>
  async (devtools: DevTools, args: ToolArgs): Promise<string> => {
    const source = argsOf(Source, args);
    return Result.isFailure(source)
      ? source.failure
      : answered(await sceneFrom(devtools, source.success), answer);
  };

const runtimes = (devtools: DevTools): Promise<string> => devtools('foldkit_list_runtimes', {});

const previewTool = async (devtools: DevTools, args: ToolArgs): Promise<string> => {
  const decoded = argsOf(PreviewArgs, args);
  if (Result.isFailure(decoded)) return decoded.failure;
  const read = await sceneFrom(devtools, decoded.success);
  return answered(read, (description) => preview(description, decoded.success));
};

const diffTool = async (devtools: DevTools, args: ToolArgs): Promise<string> => {
  const decoded = argsOf(DiffArgs, args);
  if (Result.isFailure(decoded)) return decoded.failure;
  const was = await sceneFrom(devtools, decoded.success.before);
  const now = await sceneFrom(devtools, decoded.success.after);
  if (Result.isFailure(was)) return `Before: ${was.failure}`;
  if (Result.isFailure(now)) return `After: ${now.failure}`;
  return diff(was.success, now.success);
};

const describeTool = sceneTool((description) => formatSummary(describeScene(description)));
const checkTool = sceneTool(check);

/** The tool of each name. */
const handlers = new Map([
  ['scene_runtimes', runtimes],
  ['scene_describe', describeTool],
  ['scene_check', checkTool],
  ['scene_preview', previewTool],
  ['scene_diff', diffTool],
]);

/** Answers a tool call with text: what the tool says, or why it could not. */
export const callTool = (devtools: DevTools, name: string, args: ToolArgs): Promise<string> =>
  handlers.get(name)?.(devtools, args) ?? Promise.resolve(`No tool named ${name}.`);
