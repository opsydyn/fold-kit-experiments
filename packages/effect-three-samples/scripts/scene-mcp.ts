// The scene tools read saved descriptions or the model of a local Effect UI app.
// This server speaks MCP over stdio and reads live sessions via Streamable HTTP.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { callTool, type DevTools, tools } from './sceneTools.ts';

const devToolsUrl = new URL('http://127.0.0.1:4774/mcp');

/** Open the local read session lazily. File and text tools work with the inspector stopped. */
const devToolsClient = (): DevTools => {
  let connected: Promise<Client> | undefined;
  const connect = async (): Promise<Client> => {
    const client = new Client({ name: 'effect-three-scenes', version: '0.0.0' });
    await client.connect(new StreamableHTTPClientTransport(devToolsUrl));
    return client;
  };
  return (tool, args) => {
    const pending = (connected ??= connect());
    return pending
      .then((client) => client.callTool({ name: tool, arguments: args }))
      .then((result) => {
        const parts = Array.isArray(result.content) ? result.content : [];
        return parts.map((part: { readonly text?: unknown }) => String(part.text ?? '')).join('\n');
      })
      .catch((error) => {
        if (connected === pending) {
          connected = undefined;
          void pending.then((client) => client.close()).catch(() => undefined);
        }
        return `Not connected to Effect UI DevTools at ${devToolsUrl.href}: ${String(error)}`;
      });
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
