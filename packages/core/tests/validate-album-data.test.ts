/**
 * KRO-86 — Tests de `validateAlbumData`.
 *
 * Cubre los 12 errores reales del log del user (sesión 2026-05-29) + happy
 * path + edge cases. La estructura del input refleja exactamente lo que
 * Studio mandaría en `handleSubmit` antes del POST.
 */
import { describe, it, expect } from 'vitest';
import {
  validateAlbumData,
  type AlbumDataInput,
  type ValidatableField,
  type ValidatableSection,
} from '../src/validate-album-data';

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/** Construye un input mínimo con overrides selectivos. */
function build(overrides: Partial<AlbumDataInput> = {}): AlbumDataInput {
  return {
    cardFields: [],
    cards: [],
    sections: {},
    sectionsData: {},
    ...overrides,
  };
}

const fld = (
  key: string,
  type: string,
  extra: Partial<ValidatableField> = {},
): ValidatableField => ({ key, type, ...extra });

const sec = (
  fields: ValidatableField[],
  extra: Partial<ValidatableSection> = {},
): ValidatableSection => ({ fields, ...extra });

// ─────────────────────────────────────────────────────────────────────
// Los 12 errores del log real (sesión 2026-05-29 13:07:44)
// ─────────────────────────────────────────────────────────────────────

describe('validateAlbumData · 12 errores del log real (2026-05-29)', () => {
  it('error #1: cards.0.web (behavior url) — string no es URL http(s)', () => {
    const r = validateAlbumData(build({
      cardFields: [fld('web', 'text', { behavior: 'url' })],
      cards:      [{ web: 'foo' }],
    }));
    expect(r.ok).toBe(false);
    const err = r.errors.find(e => e.attribPath === 'body.data.cards.0.web');
    expect(err?.rule).toBe('behavior');
    expect(err?.message).toBe('Debe ser una URL http(s)://');
  });

  it('error #2: equipos.0.fundacion — type number recibió string', () => {
    const r = validateAlbumData(build({
      sections:     { equipos: sec([fld('fundacion', 'number', { behavior: 'year' })]) },
      sectionsData: { equipos: [{ fundacion: '1873' }] },
    }));
    expect(r.ok).toBe(false);
    const err = r.errors.find(e => e.attribPath === 'body.data.equipos.0.fundacion');
    expect(err?.rule).toBe('type');
    expect(err?.message).toMatch(/Expected number/);
  });

  it('error #3: equipos.0.color (behavior color_hex) — no es #RRGGBB', () => {
    const r = validateAlbumData(build({
      sections:     { equipos: sec([fld('color', 'text', { behavior: 'color_hex' })]) },
      sectionsData: { equipos: [{ color: 'verde' }] },
    }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toBe('Color hex inválido (formato #RRGGBB)');
  });

  it('error #4: equipos.0.altura_escudo — type number recibió string', () => {
    const r = validateAlbumData(build({
      sections:     { equipos: sec([fld('altura_escudo', 'number', { behavior: 'measurement' })]) },
      sectionsData: { equipos: [{ altura_escudo: '100' }] },
    }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].rule).toBe('type');
  });

  it('error #5: equipos.0.web (behavior url)', () => {
    const r = validateAlbumData(build({
      sections:     { equipos: sec([fld('web', 'text', { behavior: 'url' })]) },
      sectionsData: { equipos: [{ web: 'no-es-url' }] },
    }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toBe('Debe ser una URL http(s)://');
  });

  it('error #6: equipos.0.field_15 (select con options, valor vacío sin required)', () => {
    // Valor vacío SIN required: no es error (empty legítimo). Reproducimos
    // el caso del backend (valor '' con enum) marcando required: true.
    const r = validateAlbumData(build({
      sections: { equipos: sec([
        fld('field_15', 'select', { required: true, options: ['0', '1', '2'] }),
      ]) },
      sectionsData: { equipos: [{ field_15: '' }] },
    }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].rule).toBe('required');
  });

  it('error #7: momentos.0.fecha (behavior iso_date) — formato malo', () => {
    const r = validateAlbumData(build({
      sections: { momentos: sec([fld('fecha', 'text', { behavior: 'iso_date' })]) },
      sectionsData: { momentos: [{ fecha: '15/03/2025' }] },
    }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toBe('Fecha ISO inválida (YYYY-MM-DD)');
  });

  it('error #8: momentos.0.valoracion — type number recibió string', () => {
    const r = validateAlbumData(build({
      sections: { momentos: sec([fld('valoracion', 'number', { behavior: 'rating' })]) },
      sectionsData: { momentos: [{ valoracion: '5' }] },
    }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].rule).toBe('type');
  });

  it('error #9: momentos.0.completado — type number recibió string', () => {
    const r = validateAlbumData(build({
      sections: { momentos: sec([fld('completado', 'number')]) },
      sectionsData: { momentos: [{ completado: '1' }] },
    }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].rule).toBe('type');
  });

  it('error #10: contacto.0.slug (behavior slug) — contiene caracteres ilegales', () => {
    const r = validateAlbumData(build({
      sections: { contacto: sec([fld('slug', 'text', { behavior: 'slug' })]) },
      sectionsData: { contacto: [{ slug: 'Mi Album 2025' }] },
    }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toBe('Slug inválido (solo a-z, 0-9 y guiones)');
  });

  it('error #11: contacto.0.email (behavior email) — formato inválido', () => {
    const r = validateAlbumData(build({
      sections: { contacto: sec([fld('email', 'text', { behavior: 'email' })]) },
      sectionsData: { contacto: [{ email: 'no-es-email' }] },
    }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toBe('Email inválido (formato: usuario@dominio.tld)');
  });

  it('error #12: contacto.0.phone (behavior phone) — formato inválido', () => {
    const r = validateAlbumData(build({
      sections: { contacto: sec([fld('phone', 'text', { behavior: 'phone' })]) },
      sectionsData: { contacto: [{ phone: 'abc' }] },
    }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toBe('Teléfono inválido');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Happy paths
// ─────────────────────────────────────────────────────────────────────

describe('validateAlbumData · happy paths', () => {
  it('álbum vacío sin datos pasa (ok=true)', () => {
    expect(validateAlbumData(build()).ok).toBe(true);
  });

  it('cards con todos los valores válidos pasa', () => {
    const r = validateAlbumData(build({
      cardFields: [
        fld('name', 'text', { required: true }),
        fld('web', 'text', { behavior: 'url' }),
        fld('year', 'number', { behavior: 'year' }),
      ],
      cards: [
        { name: 'Real Betis', web: 'https://betis.es', year: 1907 },
      ],
    }));
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('sectionsData con tipos correctos pasa', () => {
    const r = validateAlbumData(build({
      sections: { equipos: sec([
        fld('nombre',    'text', { required: true }),
        fld('color',     'text', { behavior: 'color_hex' }),
        fld('fundacion', 'number', { behavior: 'year' }),
      ]) },
      sectionsData: { equipos: [
        { nombre: 'Sevilla FC', color: '#FFFFFF', fundacion: 1890 },
      ] },
    }));
    expect(r.ok).toBe(true);
  });

  it('valores vacíos en campos NO required → pasa', () => {
    const r = validateAlbumData(build({
      cardFields: [
        fld('opcional', 'text', { behavior: 'url' }),
      ],
      cards: [{ opcional: '' }],
    }));
    expect(r.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────

describe('validateAlbumData · edge cases', () => {
  it('required + valor null → error de required (no type)', () => {
    const r = validateAlbumData(build({
      cardFields: [fld('name', 'text', { required: true })],
      cards:      [{ name: null }],
    }));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].rule).toBe('required');
  });

  it('required + valor undefined → error de required', () => {
    const r = validateAlbumData(build({
      cardFields: [fld('name', 'text', { required: true })],
      cards:      [{}],
    }));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].rule).toBe('required');
  });

  it('required + array vacío → error de required', () => {
    const r = validateAlbumData(build({
      cardFields: [fld('tags', 'array<string>', { required: true })],
      cards:      [{ tags: [] }],
    }));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].rule).toBe('required');
  });

  it('required + string whitespace-only → error de required (trim aplica)', () => {
    const r = validateAlbumData(build({
      cardFields: [fld('name', 'text', { required: true })],
      cards:      [{ name: '   ' }],
    }));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].rule).toBe('required');
  });

  it('type error suprime behavior error (no acumula)', () => {
    // Si valoracion no es number, no aplica behavior rating. Solo error de type.
    const r = validateAlbumData(build({
      cardFields: [fld('valoracion', 'number', { behavior: 'rating' })],
      cards:      [{ valoracion: 'cinco' }],
    }));
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].rule).toBe('type');
  });

  it('iso_date rechaza fecha que parece válida pero no existe (2025-02-30)', () => {
    const r = validateAlbumData(build({
      cardFields: [fld('fecha', 'text', { behavior: 'iso_date' })],
      cards:      [{ fecha: '2025-02-30' }],
    }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toBe('Fecha ISO inválida (YYYY-MM-DD)');
  });

  it('email acepta caso simple válido', () => {
    const r = validateAlbumData(build({
      cardFields: [fld('email', 'text', { behavior: 'email' })],
      cards:      [{ email: 'user@example.com' }],
    }));
    expect(r.ok).toBe(true);
  });

  it('phone acepta formato internacional con separadores', () => {
    const r = validateAlbumData(build({
      cardFields: [fld('phone', 'text', { behavior: 'phone' })],
      cards:      [{ phone: '+34 911 22 33 44' }],
    }));
    expect(r.ok).toBe(true);
  });

  it('year acepta 1907, rechaza 99 y 99999', () => {
    expect(validateAlbumData(build({
      cardFields: [fld('y', 'number', { behavior: 'year' })],
      cards:      [{ y: 1907 }],
    })).ok).toBe(true);

    expect(validateAlbumData(build({
      cardFields: [fld('y', 'number', { behavior: 'year' })],
      cards:      [{ y: 99 }],
    })).ok).toBe(false);

    expect(validateAlbumData(build({
      cardFields: [fld('y', 'number', { behavior: 'year' })],
      cards:      [{ y: 99999 }],
    })).ok).toBe(false);
  });

  it('select sin behavior pero con options valida que el valor esté en options', () => {
    const r = validateAlbumData(build({
      cardFields: [fld('rareza', 'select', { options: ['comun', 'rara', 'mitica'] })],
      cards:      [{ rareza: 'legendaria' }],
    }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].rule).toBe('enum');
  });

  it('array<sectionRef:KEY> valida que cada ref exista en sectionsData[KEY]', () => {
    const r = validateAlbumData(build({
      cardFields: [fld('jugadores', 'array<sectionRef:jugadores>')],
      cards:      [{ jugadores: ['Messi', 'inexistente'] }],
      sections:   { jugadores: sec([fld('nombre', 'text')], { primaryKey: 'nombre' }) },
      sectionsData: { jugadores: [{ nombre: 'Messi' }, { nombre: 'Vinicius' }] },
    }));
    expect(r.ok).toBe(false);
    expect(r.errors[0].rule).toBe('sectionRef');
    expect(r.errors[0].message).toMatch(/inexistente/);
    expect(r.errors[0].attribPath).toMatch(/body\.data\.cards\.0\.jugadores\.1$/);
  });

  it('array<sectionRef:KEY> con todas las refs válidas → ok', () => {
    const r = validateAlbumData(build({
      cardFields: [fld('jugadores', 'array<sectionRef:jugadores>')],
      cards:      [{ jugadores: ['Messi'] }],
      sections:   { jugadores: sec([fld('nombre', 'text')], { primaryKey: 'nombre' }) },
      sectionsData: { jugadores: [{ nombre: 'Messi' }] },
    }));
    expect(r.ok).toBe(true);
  });

  it('dot-notation key lee bien valor anidado', () => {
    const r = validateAlbumData(build({
      cardFields: [fld('images.standard', 'image')],
      cards:      [{ images: { standard: 'https://cdn.com/x.jpg' } }],
    }));
    expect(r.ok).toBe(true);
  });

  it('color_hex acepta minúsculas y mayúsculas', () => {
    expect(validateAlbumData(build({
      cardFields: [fld('c', 'text', { behavior: 'color_hex' })],
      cards:      [{ c: '#abcdef' }],
    })).ok).toBe(true);

    expect(validateAlbumData(build({
      cardFields: [fld('c', 'text', { behavior: 'color_hex' })],
      cards:      [{ c: '#ABCDEF' }],
    })).ok).toBe(true);
  });

  it('múltiples errores en la misma carta acumulan', () => {
    const r = validateAlbumData(build({
      cardFields: [
        fld('web',   'text',   { behavior: 'url' }),
        fld('email', 'text',   { behavior: 'email' }),
        fld('year',  'number', { behavior: 'year' }),
      ],
      cards: [{ web: 'mal', email: 'mal', year: 50 }],
    }));
    expect(r.errors).toHaveLength(3);
  });

  it('attribPath sigue el formato del backend (body.data.cards.N.field)', () => {
    const r = validateAlbumData(build({
      cardFields: [fld('web', 'text', { behavior: 'url' })],
      cards:      [{ web: 'x' }, { web: 'y' }],
    }));
    expect(r.errors[0].attribPath).toBe('body.data.cards.0.web');
    expect(r.errors[1].attribPath).toBe('body.data.cards.1.web');
  });
});
