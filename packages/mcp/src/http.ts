/**
 * KRO-156 (F4) — entrada del MCP de Kromia por HTTP (Streamable HTTP).
 * Lanzar: `pnpm --filter @kromia/mcp start:http` (= tsx src/http.ts).
 * Env: `KROMIA_MCP_PORT` (default 8790) · `KROMIA_MCP_AUTH_TOKEN` (opcional).
 */
import { createKromiaHttpServer } from './http-server.js';

const port = Number(process.env.KROMIA_MCP_PORT ?? 8790);
const server = createKromiaHttpServer();

server.listen(port, () => {
  const auth = process.env.KROMIA_MCP_AUTH_TOKEN ? 'con Bearer' : 'SIN auth (dev)';
  console.error(`kromia-mcp (HTTP/streamable) escuchando en http://127.0.0.1:${port}/mcp — ${auth}`);
});
