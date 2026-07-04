/**
 * KRO-156 — entrada del servidor MCP de Kromia por STDIO (para Claude Desktop/Code).
 * Lanzar con: `tsx src/index.ts` (o `pnpm --filter @kromia/mcp start`).
 * Config de cliente MCP: command `tsx`, args `[<ruta>/packages/mcp/src/index.ts]`.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createKromiaMcpServer } from './server.js';

async function main() {
  const server = createKromiaMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio: no imprimir en stdout (rompería el protocolo). Log a stderr.
  console.error('kromia-mcp listo (stdio).');
}

main().catch((err) => {
  console.error('kromia-mcp error fatal:', err);
  process.exit(1);
});
