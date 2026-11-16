// An MCP server that answers agents with a scene's description rather than the raw Model
// (roadmap 3): describe, check, preview and diff scenes from saved files, text, or a
// running Foldkit app read through the Foldkit DevTools MCP server.
//
//   bun run scene-mcp
//
// It speaks MCP over stdio; the repository's `.mcp.json` registers it as
// `effect-three-scenes`. For running apps it starts `foldkit-devtools-mcp` itself, with
// this process's environment (`FOLDKIT_PROJECT_ROOT`, `FOLDKIT_DEVTOOLS_MCP_PORT`).
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { callTool, type DevTools, tools } from './sceneTools.ts';

/** The repository's `foldkit-devtools-mcp`, from this package's place in it. */
const devToolsBin = fileURLToPath(
  new URL('../../../node_modules/.bin/foldkit-devtools-mcp', import.meta.url),
);

/** The Foldkit DevTools MCP server, started on the first call that needs a running app. */
const devToolsClient = (): DevTools => {
  let connected: Promise<Client> | undefined;
  const connect = async (): Promise<Client> => {
    const client = new Client({ name: 'effect-three-scenes', version: '0.0.0' });
    const env = Object.fromEntries(
      Object.entries(process.env).flatMap(([key, value]) =>
        value === undefined ? [] : [[key, value]],
      ),
    );
    await client.connect(new StdioClientTransport({ command: devToolsBin, env }));
    return client;
  };
  return async (tool, args) => {
    connected ??= connect();
    const result = await (await connected).callTool({ name: tool, arguments: args });
    const parts = Array.isArray(result.content) ? result.content : [];
    return parts.map((part: { readonly text?: unknown }) => String(part.text ?? '')).join('\n');
  };
};

const devtools = devToolsClient();
const server = new Server(
  { name: 'effect-three-scenes', version: '0.0.0' },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [...tools] }));
server.setRequestHandler(CallToolRequestSchema, async (request) => ({
  content: [
    {
      type: 'text',
      text: await callTool(devtools, request.params.name, request.params.arguments ?? {}),
    },
  ],
}));
await server.connect(new StdioServerTransport());
