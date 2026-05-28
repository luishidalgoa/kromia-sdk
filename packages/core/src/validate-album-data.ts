/**
 * KRO-86 — `validateAlbumData`: validador puro de cartas + entries.
 *
 * Aplica las reglas de tipo + behavior + required + enum + sectionRef
 * que el backend (`Kromia_NodeJS/.../cardsZodBuilder.ts`) impone con
 * Zod. Reimplementado en vanilla TypeScript (sin Zod) para que:
 *
 *   1. `@kromia/core` siga sin dependencias externas (Flutter futuro
 *      no tiene Zod en Dart).
 *   2. Studio y Backend importen EXACTAMENTE el mismo validador
 *      (paridad estricta cliente↔server, pattern KRO-80).
 *   3. Versiones distintas de Zod en consumers (3.x backend, 4.x
 *      Studio) no rompan compat.
 *
 * Función pura, sin side effects. Devuelve lista plana de errores
 * tipados para que el consumer renderice modal de errores agrupados,
 * highlights en celdas, o lo que necesite.
 *
 * Cobertura V1 (los 12 errores reales del log del user 2026-05-29):
 *  - text + behavior url     → regex http(s)://
 *  - text + behavior email   → regex usuario@dominio.tld
 *  - text + behavior phone   → regex E.164 flexible
 *  - text + behavior slug    → regex a-z0-9-
 *  - text + behavior color_hex → regex #RRGGBB
 *  - text + behavior iso_date  → regex YYYY-MM-DD + Date válido
 *  - text + behavior ordinal_enum → valor ∈ options
 *  - number puro             → typeof === 'number' (rechaza coerción)
 *  - number + behavior year  → int 1000-3000
 *  - number + behavior rating → int 0-max (default 5)
 *  - number + behavior percentage → 0-100
 *  - number + behavior currency / measurement → ≥ 0
 *  - select sin behavior     → ∈ options (si options definidas)
 *  - array<string> + enum    → cada item ∈ options
 *  - array<image>            → cada item URL http(s) o ''
 *  - array<number> + card_index_list / year_list → cada item rango
 *  - array<sectionRef:KEY>   → cada elem existe como PK en sectionsData[KEY]
 *  - required                → no null, no '', no [], no undefined
 *
 * No cubre:
 *  - Validación de TIPOS Mongoose (eso vive en el backend con su
 *    schema CRUD, independiente del modelo dinámico).
 *  - Compatibility entre fields + viewComposition (eso es
 *    `validateComposition`, KRO-79).
 */

import type { FieldDefLike } from './types';

// ─────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────

/** Field definition que el validador acepta. Subset del CardFieldDefinition de Studio. */
export interface ValidatableField {
  /** dot-notation OK: 'name', 'images.standard' */
  key: string;
  /** Tipo base: text, number, image, select, textarea, array<image>, array<sectionRef:KEY>, … */
  type: string;
  /** Para select / enum / ordinal_enum: lista cerrada de valores válidos. */
  options?: ReadonlyArray<string>;
  /** Si true, el valor no puede ser null/''/[] */
  required?: boolean;
  /** Behavior id (year, url, color_hex, iso_date, …) */
  behavior?: string;
  /** Config opcional del behavior (rating.max, measurement.unit, …) */
  behaviorConfig?: Record<string, unknown>;
}

/** Sección con fields + opcionalmente primaryKey para validación de sectionRef. */
export interface ValidatableSection {
  /** Display name (solo para mensajes de error). */
  displayName?: string;
  /** PK que el sectionRef debe matchear contra los items de esta sección. */
  primaryKey?: string;
  /** Fields que cada item de la sección lleva. */
  fields: ReadonlyArray<ValidatableField>;
}

/** Input completo para validar un álbum entero antes del POST. */
export interface AlbumDataInput {
  /** Esquema de las cartas (campos principales). */
  cardFields: ReadonlyArray<ValidatableField>;
  /** Datos de las cartas. */
  cards: ReadonlyArray<Record<string, unknown>>;
  /** Esquema de cada sección (campos). Keyed por sectionKey. */
  sections: Readonly<Record<string, ValidatableSection>>;
  /** Datos de cada sección (entries). Keyed por sectionKey. */
  sectionsData: Readonly<Record<string, ReadonlyArray<Record<string, unknown>>>>;
}

/** Categoría del error — útil para agrupar en la UI. */
export type ValidationRule =
  | 'type'         // typeof incorrecto (number recibido string)
  | 'behavior'     // regex / rango específico del behavior
  | 'required'    // campo obligatorio vacío
  | 'enum'         // valor no está en options
  | 'sectionRef';  // referencia a sección no existe

/** Error individual con metadata para jump-to-error en la UI. */
export interface ValidationError {
  /** ¿El error está en cards[] o en sectionsData[xxx]? */
  scope: 'card' | 'section';
  /** Para scope='section': clave de la sección. Undefined para 'card'. */
  sectionKey?: string;
  /** Índice del item dentro de cards / sectionsData[sectionKey]. 0-based. */
  itemIndex: number;
  /** Key del field (dot-notation si aplica). */
  fieldKey: string;
  /** Tipo de regla incumplida. */
  rule: ValidationRule;
  /** Mensaje legible es-ES (mismo formato que el backend cuando aplica). */
  message: string;
  /** Path tipo `body.data.cards.0.web` — compatible con el `attrib` del backend. */
  attribPath: string;
}

/** Resultado completo del validador. */
export interface ValidationResult {
  /** True si no hay errores. */
  ok: boolean;
  /** Lista plana de errores. Vacío si ok=true. */
  errors: ValidationError[];
}

// ─────────────────────────────────────────────────────────────────────
// Validadores por type base
// ─────────────────────────────────────────────────────────────────────

const SECTION_REF_RE = /^array<sectionRef:[a-zA-Z_][a-zA-Z0-9_]*>$/;
const SECTION_REF_KEY_RE = /^array<sectionRef:(.+)>$/;

/**
 * Devuelve un error si el valor no satisface el TYPE base del field
 * (sin contar el behavior). Si el tipo es desconocido, no valida.
 */
function checkType(value: unknown, field: ValidatableField): string | null {
  const t = field.type;

  // ── Primitivos ────────────────────────────────────────────────────
  if (t === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return `Expected number, received ${typeOf(value)}`;
    }
    return null;
  }
  if (t === 'text' || t === 'textarea') {
    if (typeof value !== 'string') {
      return `Expected string, received ${typeOf(value)}`;
    }
    return null;
  }
  if (t === 'image') {
    if (typeof value !== 'string') {
      return `Expected string (URL or empty), received ${typeOf(value)}`;
    }
    if (value !== '' && !/^https?:\/\//.test(value)) {
      return 'URL de imagen inválida (debe empezar por http(s):// o estar vacía)';
    }
    return null;
  }
  if (t === 'select') {
    if (typeof value !== 'string') {
      return `Expected string, received ${typeOf(value)}`;
    }
    // El check de "valor ∈ options" lo hace checkEnum por separado.
    return null;
  }
  if (t === 'cardRef') {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return `Expected string|number (cardRef), received ${typeOf(value)}`;
    }
    return null;
  }

  // ── Arrays ────────────────────────────────────────────────────────
  if (t === 'array<image>') {
    if (!Array.isArray(value)) return `Expected array, received ${typeOf(value)}`;
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (typeof v !== 'string') return `array<image>[${i}]: expected string`;
      if (v !== '' && !/^https?:\/\//.test(v)) {
        return `array<image>[${i}]: URL inválida (debe empezar por http(s)://)`;
      }
    }
    return null;
  }
  if (t === 'array<number>') {
    if (!Array.isArray(value)) return `Expected array, received ${typeOf(value)}`;
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (typeof v !== 'number' || Number.isNaN(v)) {
        return `array<number>[${i}]: expected number`;
      }
    }
    return null;
  }
  if (t === 'array<string>') {
    if (!Array.isArray(value)) return `Expected array, received ${typeOf(value)}`;
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'string') return `array<string>[${i}]: expected string`;
    }
    return null;
  }

  // ── Paramétrico array<sectionRef:KEY> ─────────────────────────────
  if (SECTION_REF_RE.test(t)) {
    if (!Array.isArray(value)) return `Expected array, received ${typeOf(value)}`;
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (typeof v !== 'string' && typeof v !== 'number') {
        return `array<sectionRef>[${i}]: expected string|number`;
      }
    }
    return null;
  }

  // Tipo desconocido / no soportado → silencioso (no validamos para no
  // romper schemas en proceso de modelado).
  return null;
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

// ─────────────────────────────────────────────────────────────────────
// Validadores por behavior
// ─────────────────────────────────────────────────────────────────────

/**
 * Tabla de validadores específicos del behavior. Cada función recibe el
 * valor (ya con type validado por checkType) + el field, y devuelve un
 * mensaje de error o null si pasa.
 *
 * Sincronizado con `Kromia_NodeJS/.../cardsZodBuilder.ts` BEHAVIOR_VALIDATORS
 * — al añadir behavior nuevo, ambos archivos deben actualizarse hasta que
 * la Fase 5 de KRO-86 reduzca el backend a thin wrapper de éste.
 */
const BEHAVIOR_VALIDATORS: Record<
  string,
  (value: unknown, field: ValidatableField) => string | null
> = {
  // ── text-based ────────────────────────────────────────────────────
  url(value) {
    if (typeof value !== 'string') return null; // type ya validó
    if (!/^https?:\/\//.test(value)) {
      return 'Debe ser una URL http(s)://';
    }
    return null;
  },
  email(value) {
    if (typeof value !== 'string') return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Email inválido (formato: usuario@dominio.tld)';
    }
    return null;
  },
  phone(value) {
    if (typeof value !== 'string') return null;
    const re = /^\+?[0-9 ()\-.]{7,}$/;
    const enoughDigits = /\d{7,}/.test(value.replace(/\D/g, ''));
    if (!re.test(value) || !enoughDigits) {
      return 'Teléfono inválido';
    }
    return null;
  },
  slug(value) {
    if (typeof value !== 'string') return null;
    if (!/^[a-z0-9-]+$/.test(value)) {
      return 'Slug inválido (solo a-z, 0-9 y guiones)';
    }
    return null;
  },
  color_hex(value) {
    if (typeof value !== 'string') return null;
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
      return 'Color hex inválido (formato #RRGGBB)';
    }
    return null;
  },
  iso_date(value) {
    if (typeof value !== 'string') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return 'Fecha ISO inválida (YYYY-MM-DD)';
    }
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() + 1 !== m ||
      dt.getUTCDate() !== d
    ) {
      return 'Fecha ISO inválida (YYYY-MM-DD)';
    }
    return null;
  },
  ordinal_enum(value, field) {
    if (typeof value !== 'string') return null;
    if (!field.options || field.options.length === 0) return null;
    if (!field.options.includes(value)) {
      return `Valor inválido (debe ser una de: ${field.options.join(', ')})`;
    }
    return null;
  },

  // ── number-based ──────────────────────────────────────────────────
  year(value) {
    if (typeof value !== 'number') return null;
    if (!Number.isInteger(value) || value < 1000 || value > 3000) {
      return 'Año fuera de rango (1000-3000)';
    }
    return null;
  },
  currency(value) {
    if (typeof value !== 'number') return null;
    if (value < 0) return 'Precio no puede ser negativo';
    return null;
  },
  percentage(value) {
    if (typeof value !== 'number') return null;
    if (value < 0 || value > 100) return 'Porcentaje fuera de rango (0-100)';
    return null;
  },
  rating(value, field) {
    if (typeof value !== 'number') return null;
    const max =
      typeof field.behaviorConfig?.max === 'number'
        ? field.behaviorConfig.max
        : 5;
    if (!Number.isInteger(value) || value < 0 || value > max) {
      return `Valoración fuera de rango (0-${max})`;
    }
    return null;
  },
  measurement(value) {
    if (typeof value !== 'number') return null;
    if (value < 0) return 'Medida no puede ser negativa';
    return null;
  },
  incremental(value) {
    if (typeof value !== 'number') return null;
    if (!Number.isInteger(value) || value < 0) {
      return 'Contador debe ser entero no negativo';
    }
    return null;
  },

  // ── array<string> ─────────────────────────────────────────────────
  enum(value, field) {
    if (!Array.isArray(value)) return null;
    if (!field.options || field.options.length === 0) return null;
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'string' || !field.options.includes(value[i] as string)) {
        return `Item ${i}: valor inválido (debe ser una de: ${field.options.join(', ')})`;
      }
    }
    return null;
  },
  url_list(value) {
    if (!Array.isArray(value)) return null;
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (typeof v !== 'string' || !/^https?:\/\//i.test(v)) {
        return `Item ${i}: URL inválida (debe empezar por http(s)://)`;
      }
    }
    return null;
  },
  email_list(value) {
    if (!Array.isArray(value)) return null;
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (typeof v !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        return `Item ${i}: email inválido (formato: usuario@dominio.tld)`;
      }
    }
    return null;
  },

  // ── array<number> ─────────────────────────────────────────────────
  card_index_list(value) {
    if (!Array.isArray(value)) return null;
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
        return `Item ${i}: debe ser entero ≥ 0`;
      }
    }
    return null;
  },
  year_list(value) {
    if (!Array.isArray(value)) return null;
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (
        typeof v !== 'number' ||
        !Number.isInteger(v) ||
        v < 1000 ||
        v > 3000
      ) {
        return `Item ${i}: año fuera de rango (1000-3000)`;
      }
    }
    return null;
  },

  // ── Pass-through (sin validación extra, type base ya validó) ──────
  // Ver `PASS_THROUGH_BEHAVIORS` abajo — exportada para que el test de
  // cobertura sepa que NO añadirlos a BEHAVIOR_VALIDATORS es deliberado.
};

/**
 * Behaviors que NO necesitan validator específico porque el `type` base
 * ya cubre la validación necesaria (o porque son metadata UI sin reglas
 * server-side adicionales). Lista cerrada — añadir entry nueva aquí
 * requiere justificación documentada.
 *
 * El test `validate-album-data-coverage.test.ts` cruza el registry de
 * behaviors con BEHAVIOR_VALIDATORS + PASS_THROUGH_BEHAVIORS — si
 * alguien añade behavior nuevo al registry pero olvida darle validator
 * (o marcarlo como pass-through), el test falla en CI. Red de seguridad
 * contra drift entre el registry y este validador.
 *
 * Sincronizado con `Kromia_NodeJS/.../cardsZodBuilder.ts` donde los
 * mismos behaviors son pass-through (el backend tampoco les aplica
 * validación extra). Si se hace Fase 5 de KRO-86 (backend usa el SDK),
 * esta lista deja de necesitar sincronización manual.
 */
export const PASS_THROUGH_BEHAVIORS = new Set([
  'tags',            // array<string> base ya valida cada item
  'markdown',        // textarea base ya valida string
  'notes',           // textarea base ya valida string
  'code',            // textarea base ya valida string
  'html',            // textarea base ya valida string (sanitización en render)
  'gallery',         // array<image> base ya valida cada item
  'card_multiview',  // array<image> base ya valida cada item
  'slideshow',       // array<image> base ya valida cada item
  'card_code_list',  // array<string> — validación de existencia en capa servicio
  // KRO-69 nota: avatar / banner / cover / thumbnail YA NO están aquí
  // porque se eliminaron del registry del SDK (la forma/aspect viven en
  // SlotAppearance). El backend NodeJS aún los registra por compat con
  // álbumes existentes — drift documentado, se cerrará en Fase 5 cuando
  // backend importe del SDK.
]);

/**
 * Re-export del map de validators — útil para el test de cobertura.
 * NO USAR desde código de producción: usa `validateAlbumData()` que es
 * la API pública. Este export es para introspección/tests.
 */
export const _BEHAVIOR_VALIDATORS_INTERNAL = BEHAVIOR_VALIDATORS;

// ─────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────

/** Lee un valor con dot-notation: `images.standard` → obj.images.standard */
function readDot(obj: unknown, key: string): unknown {
  return key.split('.').reduce<any>((acc, k) => acc?.[k], obj);
}

/** ¿Está el valor "vacío" según las reglas de required? */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Valida un field individual contra su valor. Devuelve TODOS los errores
 * que aplique (puede haber type + behavior + enum simultáneos).
 */
function validateField(
  value: unknown,
  field: ValidatableField,
  ctx: {
    scope: 'card' | 'section';
    sectionKey?: string;
    itemIndex: number;
    attribPathBase: string;
    /** Para resolver sectionRef en card.fields. */
    sectionsData: AlbumDataInput['sectionsData'];
    sections: AlbumDataInput['sections'];
  },
): ValidationError[] {
  const errors: ValidationError[] = [];
  const attribPath = `${ctx.attribPathBase}.${field.key}`;

  // 1. Required
  if (field.required && isEmpty(value)) {
    errors.push({
      scope: ctx.scope,
      sectionKey: ctx.sectionKey,
      itemIndex: ctx.itemIndex,
      fieldKey: field.key,
      rule: 'required',
      message: 'Campo obligatorio no puede estar vacío',
      attribPath,
    });
    // Si está vacío y es required, no seguimos validando type/behavior
    // (esos errores son consecuencia, no causa).
    return errors;
  }

  // Si está vacío pero NO es required, salta type/behavior (vacío legítimo).
  if (isEmpty(value)) return errors;

  // 2. Type base
  const typeError = checkType(value, field);
  if (typeError) {
    errors.push({
      scope: ctx.scope,
      sectionKey: ctx.sectionKey,
      itemIndex: ctx.itemIndex,
      fieldKey: field.key,
      rule: 'type',
      message: typeError,
      attribPath,
    });
    // Si el type falló, no aplicamos behavior (no tiene sentido validar
    // regex sobre algo que no es string).
    return errors;
  }

  // 3. Behavior específico
  if (field.behavior) {
    const validator = BEHAVIOR_VALIDATORS[field.behavior];
    if (validator) {
      const behaviorError = validator(value, field);
      if (behaviorError) {
        errors.push({
          scope: ctx.scope,
          sectionKey: ctx.sectionKey,
          itemIndex: ctx.itemIndex,
          fieldKey: field.key,
          rule: 'behavior',
          message: behaviorError,
          attribPath,
        });
      }
    }
  }

  // 4. Enum (cuando type es 'select' y hay options, sin requerir behavior)
  if (
    field.type === 'select' &&
    field.options &&
    field.options.length > 0 &&
    typeof value === 'string'
  ) {
    if (!field.options.includes(value)) {
      errors.push({
        scope: ctx.scope,
        sectionKey: ctx.sectionKey,
        itemIndex: ctx.itemIndex,
        fieldKey: field.key,
        rule: 'enum',
        message: `Valor inválido (debe ser una de: ${field.options.join(', ')})`,
        attribPath,
      });
    }
  }

  // 5. SectionRef — verificar que los IDs apunten a PKs reales de la sección target
  const sectionRefMatch = SECTION_REF_KEY_RE.exec(field.type);
  if (sectionRefMatch && Array.isArray(value)) {
    const targetKey = sectionRefMatch[1];
    const targetSection = ctx.sections[targetKey];
    const targetData = ctx.sectionsData[targetKey] ?? [];
    if (targetSection?.primaryKey) {
      const validPKs = new Set<string | number>(
        targetData
          .map(item => item[targetSection.primaryKey!] as string | number)
          .filter(v => v != null && v !== ''),
      );
      for (let i = 0; i < value.length; i++) {
        const ref = value[i];
        if (!validPKs.has(ref as string | number)) {
          errors.push({
            scope: ctx.scope,
            sectionKey: ctx.sectionKey,
            itemIndex: ctx.itemIndex,
            fieldKey: field.key,
            rule: 'sectionRef',
            message: `Referencia "${ref}" no existe en sección "${targetKey}"`,
            attribPath: `${attribPath}.${i}`,
          });
        }
      }
    }
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────

/**
 * Valida el dataset completo de un álbum antes del POST. Recorre cards +
 * sectionsData aplicando type + behavior + required + enum + sectionRef
 * por cada field declarado en `cardFields` y `sections[*].fields`.
 *
 * @returns ValidationResult con `ok: true` si no hay errores, o `ok: false`
 *          con la lista plana de errores tipados para que la UI los muestre.
 *
 * @example
 *   const result = validateAlbumData({ cardFields, cards, sections, sectionsData });
 *   if (!result.ok) {
 *     console.error(`${result.errors.length} errores antes del POST`);
 *     // Mostrar modal de errores agrupados, jump-to-error, etc.
 *   }
 */
export function validateAlbumData(input: AlbumDataInput): ValidationResult {
  const errors: ValidationError[] = [];

  // ── 1. Cards ──────────────────────────────────────────────────────
  for (let i = 0; i < input.cards.length; i++) {
    const card = input.cards[i];
    for (const field of input.cardFields) {
      const value = readDot(card, field.key);
      errors.push(
        ...validateField(value, field, {
          scope: 'card',
          itemIndex: i,
          attribPathBase: `body.data.cards.${i}`,
          sectionsData: input.sectionsData,
          sections: input.sections,
        }),
      );
    }
  }

  // ── 2. SectionsData ───────────────────────────────────────────────
  for (const [sectionKey, section] of Object.entries(input.sections)) {
    const entries = input.sectionsData[sectionKey] ?? [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      for (const field of section.fields) {
        const value = readDot(entry, field.key);
        errors.push(
          ...validateField(value, field, {
            scope: 'section',
            sectionKey,
            itemIndex: i,
            attribPathBase: `body.data.${sectionKey}.${i}`,
            sectionsData: input.sectionsData,
            sections: input.sections,
          }),
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// Re-export FieldDefLike por conveniencia (algunos consumers tipan con esto).
export type { FieldDefLike };
