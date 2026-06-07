/**
 * Tests de la capa de medios por-álbum — KRO-132.
 *
 * **Ground truth cross-language**: el backend, Studio y un futuro port Dart
 * deben derivar EXACTAMENTE la misma ruta de bucket y el mismo slug para las
 * mismas entradas. Si cambias el algoritmo, estos tests son la spec a actualizar.
 */

import { describe, it, expect } from 'vitest';
import {
  slugify,
  slugifyAlbumName,
  albumMediaNamespace,
  albumMediaPrefix,
  ALBUM_MEDIA_QUOTA_BYTES,
  OWNER_MEDIA_ALBUM_ALLOWANCE,
  OWNER_MEDIA_QUOTA_BYTES,
} from '../src/media-path';

describe('slugify — determinista y sin acentos', () => {
  it('minúsculas, espacios → guion', () => {
    expect(slugify('Semana Santa Cordoba')).toBe('semana-santa-cordoba');
  });

  it('elimina acentos (NFD + Diacritic)', () => {
    expect(slugify('Córdoba')).toBe('cordoba');
    expect(slugify('España')).toBe('espana');
    expect(slugify('Mêlée Pingüino')).toBe('melee-pinguino');
  });

  it('colapsa puntuación y runs de no-alfanuméricos en un solo guion', () => {
    expect(slugify('  ¡Hola,   Mundo!  ')).toBe('hola-mundo');
    expect(slugify('a___b...c')).toBe('a-b-c');
  });

  it('recorta guiones de los extremos', () => {
    expect(slugify('---hola---')).toBe('hola');
    expect(slugify('2025')).toBe('2025');
  });

  it('cadena sin alfanuméricos → vacío', () => {
    expect(slugify('¡!¿?')).toBe('');
    expect(slugify('★')).toBe('');
  });
});

describe('slugifyAlbumName — nombre/edición (edición como sub-carpeta)', () => {
  it('la edición es una sub-carpeta del nombre', () => {
    expect(slugifyAlbumName('Semana Santa Córdoba', '2025')).toBe('semana-santa-cordoba/2025');
    expect(slugifyAlbumName('Liga', '2024-25')).toBe('liga/2024-25');
  });

  it('edición ausente/vacía → solo el nombre (1 segmento)', () => {
    expect(slugifyAlbumName('Bestiario')).toBe('bestiario');
    expect(slugifyAlbumName('Bestiario', '')).toBe('bestiario');
    expect(slugifyAlbumName('Bestiario', '   ')).toBe('bestiario');
  });

  it('fallback a "album" cuando el nombre no es slugificable', () => {
    expect(slugifyAlbumName('★', '')).toBe('album');
    expect(slugifyAlbumName('', '')).toBe('album');
    expect(slugifyAlbumName('★', '2025')).toBe('album/2025');
  });
});

describe('albumMediaNamespace — la organización gana la raíz', () => {
  it('independiente → username del dueño', () => {
    expect(albumMediaNamespace({ ownerUsername: 'ana' })).toBe('ana');
    expect(albumMediaNamespace({ ownerUsername: 'ana', orgSlug: null })).toBe('ana');
    expect(albumMediaNamespace({ ownerUsername: 'ana', orgSlug: '' })).toBe('ana');
    expect(albumMediaNamespace({ ownerUsername: 'ana', orgSlug: '   ' })).toBe('ana');
  });

  it('de organización → slug de la org', () => {
    expect(albumMediaNamespace({ ownerUsername: 'ana', orgSlug: 'kromia' })).toBe('kromia');
  });

  it('KRO-130 — PRESERVA el case del username (el prefijo real se persiste por álbum)', () => {
    // El case del username se respeta tal cual (storage es case-sensitive y lo
    // admite). La consistencia write↔read la da `Album.mediaPrefix` persistido,
    // no normalizar aquí.
    expect(albumMediaNamespace({ ownerUsername: 'Kromia' })).toBe('Kromia');
    expect(albumMediaNamespace({ ownerUsername: 'LuisHidalgo' })).toBe('LuisHidalgo');
    // El orgSlug gana la raíz y ya viene en minúscula (slugify).
    expect(albumMediaNamespace({ ownerUsername: 'Kromia', orgSlug: 'kromia' })).toBe('kromia');
    expect(albumMediaNamespace({ ownerUsername: 'Kromia', orgSlug: '' })).toBe('Kromia');
  });
});

describe('albumMediaPrefix — prefijo canónico con / final', () => {
  it('álbum independiente', () => {
    expect(albumMediaPrefix({ ownerUsername: 'ana', albumSlug: 'liga-2025' }))
      .toBe('ana/liga-2025/');
  });

  it('álbum de organización', () => {
    expect(albumMediaPrefix({ ownerUsername: 'ana', orgSlug: 'kromia', albumSlug: 'liga-2025' }))
      .toBe('kromia/liga-2025/');
  });
});

describe('constantes de cuota', () => {
  it('400 MB por álbum', () => {
    expect(ALBUM_MEDIA_QUOTA_BYTES).toBe(419_430_400); // 400 * 1024 * 1024
  });

  it('agregado por dueño = 6 × 400 MB ≈ 2,4 GB', () => {
    expect(OWNER_MEDIA_ALBUM_ALLOWANCE).toBe(6);
    expect(OWNER_MEDIA_QUOTA_BYTES).toBe(ALBUM_MEDIA_QUOTA_BYTES * 6);
    expect(OWNER_MEDIA_QUOTA_BYTES).toBe(2_516_582_400);
  });
});
