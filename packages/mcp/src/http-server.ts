/**
 * KRO-156 (F4) — Transporte REMOTO del MCP de Kromia vía **Streamable HTTP**.
 *
 * Sirve el mismo `createKromiaMcpServer()` (F1+F2+F3) sobre HTTP para que agentes
 * o terceros lo consuman en remoto, no solo por stdio local. Stateful: cada
 * sesión (initialize) obtiene un `mcp-session-id`; las peticiones siguientes lo
 * reusan. Auth por Bearer OPCIONAL (`KROMIA_MCP_AUTH_TOKEN`): si está, se exige;
 * si no, abierto (dev local). Endpoint: `POST/GET/DELETE /mcp`.
 */
import { createServer, type Server, type IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createKromiaMcpServer } from './server.js';

export interface HttpServerOptions {
  /** Si se define, se exige `Authorization: Bearer <authToken>`. Default: env `KROMIA_MCP_AUTH_TOKEN`. */
  authToken?: string;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

/** Crea (sin escuchar) el `http.Server` que sirve el MCP por Streamable HTTP. */
export function createKromiaHttpServer(opts: HttpServerOptions = {}): Server {
  const authToken = opts.authToken ?? process.env.KROMIA_MCP_AUTH_TOKEN;
  const transports = new Map<string, StreamableHTTPServerTransport>();

  return createServer(async (req, res) => {
    try {
      if (!(req.url ?? '').startsWith('/mcp')) {
        res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'not found' }));
        return;
      }
      if (authToken && req.headers.authorization !== `Bearer ${authToken}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }

      const body = await readBody(req);
      const sid = req.headers['mcp-session-id'] as string | undefined;
      let transport = sid ? transports.get(sid) : undefined;

      if (!transport) {
        // Sesión nueva (debería ser un `initialize`). El transport genera el id.
        let mySid: string | undefined;
        const t = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => { mySid = id; transports.set(id, t); },
        });
        t.onclose = () => { if (mySid) transports.delete(mySid); };
        const server = createKromiaMcpServer();
        await server.connect(t);
        transport = t;
      }

      await transport.handleRequest(req, res, body);
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: String(e) }));
      }
    }
  });
}
