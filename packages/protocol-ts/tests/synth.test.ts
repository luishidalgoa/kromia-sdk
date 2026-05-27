/**
 * Tests del synth — KRO-72.
 *
 * Captura el comportamiento del `synthSectionItems` como ground truth
 * **cross-language**: si en el futuro un SDK Dart genera previews con la
 * misma firma, debe producir los mismos outputs para los mismos seeds.
 *
 * Estos snapshots son el ESPEJO de `kromia-studio/tests/app-preview-baseline.test.ts`.
 * Si divergen, hay drift entre la copia thin re-exportada en Studio y la
 * fuente del SDK — algo está mal.
 */

import { describe, it, expect } from 'vitest';
import {
  synthSectionItems,
  type SynthSourceSection,
} from '../src/synth';

// ── Helpers de construcción ─────────────────────────────────────────

function makeSection(fields: SynthSourceSection['fields']): SynthSourceSection {
  return { fields };
}

// ── Casos canónicos ─────────────────────────────────────────────────

const playersSection = makeSection([
  { key: 'nombre',   type: 'text' },
  { key: 'pais',     type: 'text' },
  { key: 'edad',     type: 'number' },
  { key: 'rating',   type: 'number',       behavior: 'rating' },
  { key: 'avatar',   type: 'image' },
  { key: 'website',  type: 'text',         behavior: 'url' },
  { key: 'color',    type: 'text',         behavior: 'color_hex' },
  { key: 'galeria',  type: 'array<image>', behavior: 'gallery' },
]);

const editorialSection = makeSection([
  { key: 'titulo',   type: 'text' },
  { key: 'cover',    type: 'image' },
  { key: 'fecha',    type: 'text',          behavior: 'iso_date' },
  { key: 'cuerpo',   type: 'textarea',      behavior: 'markdown' },
  { key: 'precio',   type: 'number',        behavior: 'currency' },
  { key: 'tags',     type: 'array<string>', behavior: 'enum' },
]);

const momentSection = makeSection([
  { key: 'year',     type: 'number',       behavior: 'year' },
  { key: 'title',    type: 'text' },
  { key: 'subtitle', type: 'text' },
  { key: 'fotos',    type: 'array<image>', behavior: 'slideshow' },
]);

describe('synthSectionItems — comportamiento básico', () => {
  it('determinístico: mismo input → mismo output siempre (3 runs)', () => {
    const a = synthSectionItems('players', playersSection, 3);
    const b = synthSectionItems('players', playersSection, 3);
    const c = synthSectionItems('players', playersSection, 3);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('genera N items según el count', () => {
    expect(synthSectionItems('x', playersSection, 1)).toHaveLength(1);
    expect(synthSectionItems('x', playersSection, 3)).toHaveLength(3);
    expect(synthSectionItems('x', playersSection, 10)).toHaveLength(10);
  });

  it('items contienen una key por cada field de la sección', () => {
    const items = synthSectionItems('players', playersSection, 1);
    const keys = Object.keys(items[0]);
    expect(keys.sort()).toEqual(playersSection.fields.map(f => f.key).sort());
  });

  it('sectionKey distinto → outputs distintos (no colisión entre secciones)', () => {
    const a = synthSectionItems('foo', playersSection, 3);
    const b = synthSectionItems('bar', playersSection, 3);
    expect(a).not.toEqual(b);
  });
});

describe('synthSectionItems — snapshots canónicos (cross-language ground truth)', () => {
  it('snapshot: 3 jugadores', () => {
    const items = synthSectionItems('players', playersSection, 3);
    expect(items).toMatchInlineSnapshot(`
      [
        {
          "avatar": "Bajo el palio, el silencio se hizo respeto.",
          "color": "#42d7be",
          "edad": 96,
          "galeria": [
            "https://picsum.photos/seed/kromia-0/400/300",
            "https://picsum.photos/seed/kromia-1/400/300",
            "https://picsum.photos/seed/kromia-2/400/300",
          ],
          "nombre": "Andrés López",
          "pais": "Francia",
          "rating": 4,
          "website": "https://kromia.app",
        },
        {
          "avatar": "El compás marcaba el ritmo del corazón.",
          "color": "#7d42d7",
          "edad": 20,
          "galeria": [
            "https://picsum.photos/seed/kromia-44/400/300",
            "https://picsum.photos/seed/kromia-45/400/300",
            "https://picsum.photos/seed/kromia-46/400/300",
          ],
          "nombre": "Elena Pérez",
          "pais": "España",
          "rating": 5,
          "website": "https://example.com/page",
        },
        {
          "avatar": "El compás marcaba el ritmo del corazón.",
          "color": "#d7b442",
          "edad": 32,
          "galeria": [
            "https://picsum.photos/seed/kromia-56/400/300",
            "https://picsum.photos/seed/kromia-57/400/300",
            "https://picsum.photos/seed/kromia-58/400/300",
          ],
          "nombre": "Carmen Romero",
          "pais": "España",
          "rating": 4,
          "website": "https://kromia.app",
        },
      ]
    `);
  });

  it('snapshot: 3 momentos', () => {
    const items = synthSectionItems('moments', momentSection, 3);
    expect(items).toMatchInlineSnapshot(`
      [
        {
          "fotos": [
            "https://picsum.photos/seed/kromia-56/400/300",
            "https://picsum.photos/seed/kromia-57/400/300",
            "https://picsum.photos/seed/kromia-58/400/300",
          ],
          "subtitle": "Sofía Hidalgo",
          "title": "Lucía García",
          "year": 2013,
        },
        {
          "fotos": [
            "https://picsum.photos/seed/kromia-36/400/300",
            "https://picsum.photos/seed/kromia-37/400/300",
            "https://picsum.photos/seed/kromia-38/400/300",
          ],
          "subtitle": "Elena Pérez",
          "title": "Sofía Romero",
          "year": 2014,
        },
        {
          "fotos": [
            "https://picsum.photos/seed/kromia-16/400/300",
            "https://picsum.photos/seed/kromia-17/400/300",
            "https://picsum.photos/seed/kromia-18/400/300",
          ],
          "subtitle": "Elena Castro",
          "title": "Lucía Pérez",
          "year": 1985,
        },
      ]
    `);
  });

  it('snapshot: 3 editoriales', () => {
    const items = synthSectionItems('editorial', editorialSection, 3);
    expect(items).toMatchInlineSnapshot(`
      [
        {
          "cover": "Caminamos hasta el amanecer entre cánticos.",
          "cuerpo": "Era una noche oscura y tormentosa. El viento azotaba las ventanas mientras escribíamos esta crónica.",
          "fecha": "2024-01-04",
          "precio": 24,
          "tags": [
            "Cádiz",
            "Barcelona",
            "Cádiz",
          ],
          "titulo": "Andrés Romero",
        },
        {
          "cover": "La emoción del primer paso fue inolvidable.",
          "cuerpo": "En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero.",
          "fecha": "2024-02-11",
          "precio": 76,
          "tags": [
            "Cádiz",
            "Barcelona",
            "Cádiz",
          ],
          "titulo": "Carmen Hidalgo",
        },
        {
          "cover": "Caminamos hasta el amanecer entre cánticos.",
          "cuerpo": "Era una noche oscura y tormentosa. El viento azotaba las ventanas mientras escribíamos esta crónica.",
          "fecha": "2024-03-18",
          "precio": 56,
          "tags": [
            "Cádiz",
            "Sevilla",
            "Cádiz",
          ],
          "titulo": "Andrés Ortiz",
        },
      ]
    `);
  });
});

describe('synthSectionItems — formato por behavior', () => {
  // Matchers liberales: el SHAPE/TYPE del valor debe mantenerse aunque
  // el valor concreto cambie en futuras versiones.

  const sec = makeSection([
    { key: 'year',    type: 'number',         behavior: 'year' },
    { key: 'date',    type: 'text',           behavior: 'iso_date' },
    { key: 'color',   type: 'text',           behavior: 'color_hex' },
    { key: 'url',     type: 'text',           behavior: 'url' },
    { key: 'email',   type: 'text',           behavior: 'email' },
    { key: 'phone',   type: 'text',           behavior: 'phone' },
    { key: 'rating',  type: 'number',         behavior: 'rating' },
    { key: 'cards',   type: 'array<number>',  behavior: 'card_index_list' },
    { key: 'codes',   type: 'array<string>',  behavior: 'card_code_list' },
    { key: 'gallery', type: 'array<image>',   behavior: 'gallery' },
    { key: 'avatar',  type: 'image',          behavior: 'avatar' },
    { key: 'banner',  type: 'image',          behavior: 'banner' },
  ]);

  const item = synthSectionItems('mix', sec, 1)[0];

  it('year: número 1980-2025', () => {
    expect(item.year).toBeTypeOf('number');
    expect(item.year as number).toBeGreaterThanOrEqual(1980);
    expect(item.year as number).toBeLessThanOrEqual(2025);
  });

  it('iso_date: string formato YYYY-MM-DD', () => {
    expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('color_hex: string formato #rrggbb', () => {
    expect(item.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('url: string que parece URL', () => {
    expect(item.url).toMatch(/^https?:\/\//);
  });

  it('email: string que parece email', () => {
    expect(item.email).toMatch(/^[\w.]+@[\w.]+$/);
  });

  it('phone: string que parece teléfono', () => {
    expect(item.phone).toMatch(/^\+?\d/);
  });

  it('rating: número 1-5', () => {
    expect(item.rating).toBeTypeOf('number');
    expect(item.rating as number).toBeGreaterThanOrEqual(1);
    expect(item.rating as number).toBeLessThanOrEqual(5);
  });

  it('card_index_list: array de números', () => {
    expect(Array.isArray(item.cards)).toBe(true);
    (item.cards as unknown[]).forEach(c => expect(c).toBeTypeOf('number'));
  });

  it('card_code_list: array de strings tipo "C-xxx"', () => {
    expect(Array.isArray(item.codes)).toBe(true);
    (item.codes as unknown[]).forEach(c => {
      expect(c).toBeTypeOf('string');
      expect(c as string).toMatch(/^C-\d+$/);
    });
  });

  it('gallery: array de URLs picsum', () => {
    expect(Array.isArray(item.gallery)).toBe(true);
    (item.gallery as unknown[]).forEach(g => {
      expect(g as string).toMatch(/^https:\/\/picsum\.photos\/seed\/kromia-\d+/);
    });
  });

  it('avatar: URL picsum 200x200', () => {
    expect(item.avatar as string).toMatch(/^https:\/\/picsum\.photos\/seed\/kromia-\d+\/200\/200$/);
  });

  it('banner: URL picsum 600x200', () => {
    expect(item.banner as string).toMatch(/^https:\/\/picsum\.photos\/seed\/kromia-\d+\/600\/200$/);
  });
});

describe('synthSectionItems — heurística por nombre de key', () => {
  it('key=nombre → "Nombre Apellido" del corpus', () => {
    const sec = makeSection([{ key: 'nombre', type: 'text' }]);
    const items = synthSectionItems('s', sec, 5);
    items.forEach(it => {
      expect(it.nombre).toBeTypeOf('string');
      expect((it.nombre as string).split(' ').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('key=pais → país del corpus', () => {
    const sec = makeSection([{ key: 'pais', type: 'text' }]);
    const items = synthSectionItems('s', sec, 3);
    const known = ['España', 'Brasil', 'Argentina', 'México', 'Francia', 'Italia', 'Alemania', 'Portugal'];
    items.forEach(it => {
      expect(known).toContain(it.pais);
    });
  });

  it('key=team → "Ciudad Nombre" combinación del corpus', () => {
    const sec = makeSection([{ key: 'team', type: 'text' }]);
    const items = synthSectionItems('s', sec, 3);
    items.forEach(it => {
      expect((it.team as string).split(' ')).toHaveLength(2);
    });
  });
});

describe('synthSectionItems — select con options', () => {
  it('itera por opciones en orden (no random) para garantizar visibilidad', () => {
    const sec = makeSection([
      { key: 'rareza', type: 'select', options: ['Común', 'Rara', 'Épica'] },
    ]);
    const items = synthSectionItems('s', sec, 6);
    // Con 6 items y 3 opciones, cada opción debe aparecer >= 1 vez.
    const values = items.map(it => it.rareza);
    expect(values).toEqual(['Común', 'Rara', 'Épica', 'Común', 'Rara', 'Épica']);
  });

  it('select sin options usa BADGE_VALUES por defecto', () => {
    const sec = makeSection([{ key: 'rareza', type: 'select' }]);
    const items = synthSectionItems('s', sec, 3);
    const badges = ['Común', 'Rara', 'Épica', 'Legendaria', 'Mítica'];
    items.forEach(it => {
      expect(badges).toContain(it.rareza);
    });
  });
});
