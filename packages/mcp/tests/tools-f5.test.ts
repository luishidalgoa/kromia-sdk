/**
 * KRO-156 — las cinco tools de F5, que se dieron por probadas «a mano por stdio»
 * y no tenían un solo caso en la suite.
 *
 * Cada validador va con su PAREJA: un caso que tiene que fallar y otro que tiene
 * que pasar. Sin el segundo, un validador que dijera «no» a todo se leería
 * exactamente igual que uno que funciona — y para un agente que itera
 * propón→valida→corrige, un validador así no es un fallo silencioso: es un bucle
 * infinito, porque ninguna corrección lo contenta.
 *
 * También se fijan aquí dos cosas que hoy solo viven en la DESCRIPCIÓN de las
 * tools. Esa descripción es lo único que el agente lee antes de llamar, así que
 * es interfaz, no comentario: si promete algo que no ocurre, el agente construye
 * sobre una promesa falsa y nada se lo desmiente.
 */
import { describe, it, expect } from 'vitest';
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
const llamar = async (name: string, args: Record<string, unknown> = {}) => {
  const client = await connect();
  return textOf(await client.callTool({ name, arguments: args as any }));
};

describe('KRO-156 · list_behaviors', () => {
  it('devuelve los behaviors con lo que hace falta para elegir uno', async () => {
    const bs = await llamar('list_behaviors');
    expect(bs.length).toBeGreaterThan(3);
    // `applicableTypes` es lo que decide si un behavior vale para un campo, y
    // `renderAsSlotKind` lo que conecta con el layout. Sin esos dos la lista es
    // un menú de nombres.
    expect(bs[0]).toHaveProperty('id');
    expect(bs[0]).toHaveProperty('applicableTypes');
  });

  it('filtrar por un tipo base real devuelve un subconjunto, no la lista entera', async () => {
    const todos = await llamar('list_behaviors');
    const deNumero = await llamar('list_behaviors', { forType: 'number' });
    expect(deNumero.length).toBeGreaterThan(0);
    expect(deNumero.length).toBeLessThan(todos.length);
    expect(deNumero.every((b: any) => b.applicableTypes.includes('number'))).toBe(true);
  });

  it('y por «enum» devuelve vacío, tal y como avisa su propia descripción', async () => {
    // La ficha de la tool lo dice con todas las letras: «enum» NO es un tipo
    // base, es un behavior. Es la confusión más fácil de cometer, y el vacío
    // que devuelve se lee como «no hay ninguno» en vez de «has preguntado por
    // el eje que no era». Queda fijado aquí para que la advertencia de la ficha
    // y lo que ocurre no puedan separarse.
    expect(await llamar('list_behaviors', { forType: 'enum' })).toEqual([]);
  });
});

describe('KRO-156 · list_effects', () => {
  it('lista los efectos con su capa y cuántos parámetros tienen', async () => {
    const es = await llamar('list_effects');
    expect(es.length).toBeGreaterThan(0);
    for (const e of es) {
      expect(typeof e.id).toBe('string');
      expect(typeof e.paramCount).toBe('number');
    }
  });

  it('y el iridiscente sale con su montaña de parámetros, que es el motivo de la tool', async () => {
    // El agente inventaba ids y config porque nada le decía qué existe. Si este
    // efecto apareciera con dos parámetros, la tool estaría mirando otra cosa.
    const iri = (await llamar('list_effects')).find((e: any) => e.id === 'iridescent_foil');
    expect(iri, 'iridescent_foil no está en el catálogo').toBeDefined();
    expect(iri.paramCount).toBeGreaterThan(20);
  });
});

describe('KRO-156 · validate_tag_styles', () => {
  it('un efecto inventado no cuela, y dice por dónde', async () => {
    const r = await llamar('validate_tag_styles', {
      tagStyles: [{ value: 'rara', effect: '__no_existe__' }],
    });
    expect(r.valid).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
    // Sin `path` el agente no sabe qué corregir y vuelve a mandar lo mismo.
    expect(r.issues[0]).toHaveProperty('path');
  });

  it('pero una lista vacía es válida: no es un muro que diga que no a todo', async () => {
    const r = await llamar('validate_tag_styles', { tagStyles: [] });
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('y un efecto REAL sin config no se rechaza por no existir', async () => {
    const primero = (await llamar('list_effects'))[0];
    const r = await llamar('validate_tag_styles', {
      tagStyles: [{ value: 'rara', effect: primero.id }],
    });
    expect(
      r.issues.some((i: any) => /no existe|desconocid/i.test(i.message ?? '')),
      `«${primero.id}» está en el catálogo y el validador lo trata como inexistente`,
    ).toBe(false);
  });
});

describe('KRO-156 · validate_album_data', () => {
  const campos = [{ key: 'year', type: 'number' }, { key: 'name', type: 'text' }];

  it('caza el año escrito como texto, y señala la carta y el campo', async () => {
    // El caso exacto que motivó la tool: la composición puede estar valid:true
    // y las 200 cartas llevar el año como cadena.
    const r = await llamar('validate_album_data', {
      cardFields: campos,
      cards: [{ name: 'Uno', year: 1998 }, { name: 'Dos', year: 'mil novecientos' }],
      sections: {}, sectionsData: {},
    });
    expect(r.ok).toBe(false);
    const fallo = r.errors.find((e: any) => e.fieldKey === 'year');
    expect(fallo, 'no señala el campo que falla').toBeDefined();
    // El índice es lo que hace accionable un lote de 200: sin él hay que
    // revisarlas todas.
    expect(fallo.itemIndex).toBe(1);
  });

  it('y un lote correcto pasa', async () => {
    const r = await llamar('validate_album_data', {
      cardFields: campos,
      cards: [{ name: 'Uno', year: 1998 }],
      sections: {}, sectionsData: {},
    });
    expect(r.ok).toBe(true);
  });
});

describe('KRO-156 · validate_rarity_source', () => {
  const campoRating = [{ key: 'estrellas', type: 'number', behavior: 'rating' }];

  it('un field que no existe en el schema no puede ser la fuente de rareza', async () => {
    const r = await llamar('validate_rarity_source', {
      raritySource: { fieldKey: '__no_existe__', buckets: [{ value: 1, weight: 100 }] },
      fieldDefs: campoRating,
    });
    expect(r.valid).toBe(false);
    expect(r.issues.some((i: any) => i.path === 'raritySource.fieldKey')).toBe(true);
  });

  it('y una fuente bien formada sí vale', async () => {
    const r = await llamar('validate_rarity_source', {
      raritySource: { fieldKey: 'estrellas', buckets: [
        { range: [1, 3], weight: 70 }, { range: [4, 5], weight: 30 },
      ] },
      fieldDefs: campoRating,
    });
    expect(r.valid).toBe(true);
  });

  it('devuelve el reparto REAL cuando los pesos no suman 100', async () => {
    // Esto lo promete la propia ficha de la tool: «devuelve los pesos ya
    // NORMALIZADOS — que es el reparto real que va a ocurrir cuando los pesos
    // no suman 100». Un aviso que diga «se normalizarán» deja al agente con la
    // única cifra que NO va a ocurrir: la que él escribió. Y la diferencia no
    // es cosmética — con 30/10 el publisher cree que reparte 30 % y reparte 75.
    const r = await llamar('validate_rarity_source', {
      raritySource: { fieldKey: 'estrellas', buckets: [
        { range: [1, 3], weight: 30 }, { range: [4, 5], weight: 10 },
      ] },
      fieldDefs: campoRating,
    });
    expect(r.issues.some((i: any) => i.level === 'warn')).toBe(true);
    expect(r.normalizedBuckets).toBeDefined();
    expect(r.normalizedBuckets.map((b: any) => b.weight)).toEqual([75, 25]);
  });

  it('pero no se inventa un reparto cuando la fuente es inválida', async () => {
    // Normalizar unos buckets que el backend nunca va a aceptar sería darle al
    // agente una cifra con pinta de acordada sobre algo que no se va a aplicar.
    const r = await llamar('validate_rarity_source', {
      raritySource: { fieldKey: '__no_existe__', buckets: [{ value: 1, weight: 30 }] },
      fieldDefs: campoRating,
    });
    expect(r.valid).toBe(false);
    expect(r.normalizedBuckets).toBeUndefined();
  });
});
