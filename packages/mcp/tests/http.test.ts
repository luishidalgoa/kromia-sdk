import { describe, it, expect } from 'vitest';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createKromiaHttpServer } from '../src/http-server.js';

/** Arranca el server en un puerto efímero y devuelve el puerto. */
async function listen(server: Server): Promise<number> {
  await new Promise<void>(res => server.listen(0, '127.0.0.1', res));
  return (server.address() as { port: number }).port;
}

describe('kromia MCP server (F4 — Streamable HTTP)', () => {
  it('sirve las tools por HTTP a un Client remoto', async () => {
    const server = createKromiaHttpServer();
    const port = await listen(server);
    const client = new Client({ name: 'test-http', version: '0' });
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      const names = tools.map(t => t.name);
      expect(names).toContain('validate_composition');
      expect(names).toContain('auto_compose');
      expect(names).toContain('apply_composition');
    } finally {
      await client.close();
      await new Promise<void>(res => server.close(() => res()));
    }
  });

  it('con authToken rechaza sin Bearer (401)', async () => {
    const server = createKromiaHttpServer({ authToken: 'secret' });
    const port = await listen(server);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      });
      expect(res.status).toBe(401);
    } finally {
      await new Promise<void>(res => server.close(() => res()));
    }
  });
});
