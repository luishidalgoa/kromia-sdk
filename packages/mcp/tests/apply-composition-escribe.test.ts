/**
 * KRO-156 — la rama que ESCRIBE.
 *
 * `apply_composition` con `confirm:true` es lo único del servidor MCP que
 * modifica datos del publisher, y era lo único sin nada que lo ejercitara. Los
 * tres casos que ya existían cubren las tres formas de NO escribir —dry-run,
 * composición inválida, falta de token— y ninguno llega a la petición. Todo lo
 * que pasa a partir de ahí (la URL que se arma, la cabecera que lleva, qué se
 * hace con la respuesta) estaba sin sujetar: un `apply_composition` apuntando a
 * la ruta equivocada habría pasado la suite entera en verde.
 *
 * ## Por qué se mockea `fetch` y no se levanta el backend
 *
 * Lo que hay que fijar aquí es el CONTRATO que el MCP emite, no que el backend
 * lo atienda — eso ya lo prueba su propia suite. Mezclarlos haría que un fallo
 * de cualquiera de los dos se leyera como fallo del otro, y este servidor es
 * `@kromia/core` puro: no debe necesitar una base de datos para probarse.
 *
 * ## Por qué en fichero aparte
 *
 * `server.test.ts` tiene un caso que BORRA `KROMIA_API_URL`/`KROMIA_TOKEN` del
 * proceso para comprobar que sin credenciales no se escribe. Estos las necesitan
 * puestas. Compartir fichero haría que el resultado dependiera del orden.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createKromiaMcpServer } from '../src/server.js';

async function connect(): Promise<Client> {
  const server = createKromiaMcpServer();
  const client = new Client({ name: 'test', version: '0' });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return client;
}

const textOf = (r: any) => JSON.parse(r.content[0].text);
const textoCrudo = (r: any) => r.content[0].text as string;

describe('KRO-156 · apply_composition escribe de verdad', () => {
  const fetchOriginal = globalThis.fetch;
  const envOriginal = { url: process.env.KROMIA_API_URL, token: process.env.KROMIA_TOKEN };
  let llamadas: Array<{ url: string; init: any }> = [];

  /** Un `fetch` de mentira que apunta lo que le piden y contesta lo que se le diga. */
  const mockFetch = (respuesta: { ok: boolean; status?: number; body?: any }) => {
    llamadas = [];
    globalThis.fetch = (async (url: any, init: any) => {
      llamadas.push({ url: String(url), init });
      return {
        ok: respuesta.ok,
        status: respuesta.status ?? (respuesta.ok ? 200 : 500),
        json: async () => respuesta.body ?? {},
      };
    }) as any;
  };

  /** Una composición válida de verdad, generada por el propio servidor. */
  const composicionValida = async (client: Client) =>
    textOf(await client.callTool({
      name: 'auto_compose',
      arguments: { kind: 'list', fields: [{ key: 'name', type: 'text', behavior: 'title' }] },
    })).composition;

  const aplicar = (client: Client, args: Record<string, unknown>) =>
    client.callTool({ name: 'apply_composition', arguments: args as any });

  beforeEach(() => {
    process.env.KROMIA_API_URL = 'https://api.kromia.test/api';
    process.env.KROMIA_TOKEN = 'tok-secreto';
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    if (envOriginal.url) process.env.KROMIA_API_URL = envOriginal.url;
    else delete process.env.KROMIA_API_URL;
    if (envOriginal.token) process.env.KROMIA_TOKEN = envOriginal.token;
    else delete process.env.KROMIA_TOKEN;
  });

  it('manda un PATCH a la ruta de la sección, con el Bearer y la composición', async () => {
    mockFetch({ ok: true, body: { _id: 'schema-NUEVO' } });
    const client = await connect();
    const comp = await composicionValida(client);

    const out = textOf(await aplicar(client, {
      schemaId: 'sch-1', sectionKey: 'principal', composition: comp, confirm: true,
    }));

    expect(llamadas).toHaveLength(1);
    const [{ url, init }] = llamadas;
    expect(url).toBe('https://api.kromia.test/api/card-schemas/sch-1/sections/principal/composition');
    expect(init.method).toBe('PATCH');
    expect(init.headers.Authorization).toBe('Bearer tok-secreto');
    // El backend hace el splice; el cliente manda SOLO la composición. Si aquí
    // se colara el schemaId o la sección, habría dos fuentes para lo mismo y
    // una de las dos acabaría mandando.
    expect(JSON.parse(init.body)).toEqual({ composition: comp });
    expect(out.applied).toBe(true);
  });

  it('devuelve la respuesta del backend, donde viene el id NUEVO del schema', async () => {
    // El backend VERSIONA: aplicar crea una versión nueva, así que el id que
    // vuelve no es el que se mandó. Si la tool se limitara a decir
    // `applied:true`, el agente seguiría trabajando contra la versión vieja sin
    // saberlo — y sus cambios siguientes irían a un documento que ya no manda.
    mockFetch({ ok: true, body: { _id: 'schema-v2' } });
    const client = await connect();
    const comp = await composicionValida(client);

    const out = textOf(await aplicar(client, {
      schemaId: 'schema-v1', sectionKey: 'principal', composition: comp, confirm: true,
    }));

    expect(out.result._id).toBe('schema-v2');
    expect(out.result._id).not.toBe('schema-v1');
  });

  it('una barra de más en KROMIA_API_URL no parte la ruta en dos', async () => {
    // `https://host/api/` + `/card-schemas` da `//card-schemas`, que para
    // muchos proxys es otra ruta. Es un fallo de configuración del user, no de
    // código, y justo por eso tiene que absorberse aquí.
    process.env.KROMIA_API_URL = 'https://api.kromia.test/api/';
    mockFetch({ ok: true, body: {} });
    const client = await connect();
    const comp = await composicionValida(client);

    await aplicar(client, { schemaId: 'sch-1', sectionKey: 'principal', composition: comp, confirm: true });

    expect(llamadas[0].url).toBe('https://api.kromia.test/api/card-schemas/sch-1/sections/principal/composition');
  });

  it('lo que llega por parámetro no arma ruta: una barra se escapa', async () => {
    // Sin escapar, `sectionKey: "a/b"` sale como `/sections/a/b/composition` y
    // pega en OTRO endpoint del backend.
    mockFetch({ ok: true, body: {} });
    const client = await connect();
    const comp = await composicionValida(client);

    await aplicar(client, { schemaId: 'sch/1', sectionKey: 'a/b', composition: comp, confirm: true });

    expect(llamadas[0].url).toBe('https://api.kromia.test/api/card-schemas/sch%2F1/sections/a%2Fb/composition');
  });

  it('si el backend rechaza, marca isError y NO dice que se aplicó', async () => {
    // La mitad que importa es la segunda: un `applied:true` sobre un 403 le hace
    // creer al agente que el diseño está puesto, y seguirá construyendo encima.
    mockFetch({ ok: false, status: 403, body: { message: 'sin permiso' } });
    const client = await connect();
    const comp = await composicionValida(client);

    const r: any = await aplicar(client, {
      schemaId: 'sch-1', sectionKey: 'principal', composition: comp, confirm: true,
    });

    expect(r.isError).toBe(true);
    expect(textoCrudo(r)).toContain('403');
    expect(textoCrudo(r)).not.toContain('applied');
  });

  it('y si la red se cae, tampoco se traga el error', async () => {
    globalThis.fetch = (async () => { throw new Error('ECONNREFUSED'); }) as any;
    const client = await connect();
    const comp = await composicionValida(client);

    const r: any = await aplicar(client, {
      schemaId: 'sch-1', sectionKey: 'principal', composition: comp, confirm: true,
    });

    expect(r.isError).toBe(true);
    expect(textoCrudo(r)).toContain('ECONNREFUSED');
  });

  it('el dry-run sigue sin tocar la red AUNQUE las credenciales estén puestas', async () => {
    // El control que da valor a todos los de arriba: si el dry-run escribiera
    // cuando hay token, «por defecto no escribe» sería falso exactamente en la
    // máquina del user, que es la única donde hay credenciales. El caso que ya
    // existía corre sin ellas, así que no puede distinguirlo.
    mockFetch({ ok: true, body: {} });
    const client = await connect();
    const comp = await composicionValida(client);

    const out = textOf(await aplicar(client, {
      schemaId: 'sch-1', sectionKey: 'principal', composition: comp,
    }));

    expect(llamadas).toHaveLength(0);
    expect(out.applied).toBe(false);
    expect(out.dryRun).toBe(true);
  });

  it('y una composición inválida no llega a la red ni con confirm:true', async () => {
    // Lo mismo por el otro lado: la validación local es lo que impide gastar una
    // versión del schema en un diseño que el backend va a rechazar igual.
    mockFetch({ ok: true, body: {} });
    const client = await connect();

    const out = textOf(await aplicar(client, {
      schemaId: 'sch-1', sectionKey: 'principal', composition: { recipe: '__nope__' }, confirm: true,
    }));

    expect(llamadas).toHaveLength(0);
    expect(out.applied).toBe(false);
    expect(out.validation.valid).toBe(false);
  });
});
