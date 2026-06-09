/**
 * `options.ts` — KRO-75. Catálogos de opciones de personalización
 * disponibles al publisher en el editor de composición visual.
 *
 * Estos catálogos son **metadata del modelo del KRP**: definen qué valores
 * son válidos para las propiedades de personalización (shape, aspect,
 * alignment, action, etc.) y qué label se muestra en el editor para
 * cada uno. Studio y Flutter consumen ambos desde aquí — la paridad de
 * dropdowns + validación entre plataformas es estructural.
 *
 * **No incluido aquí** (queda en Studio):
 *  - JSX icons (lucide-react `<Circle/>`, `<AlignLeft/>`, etc.) — son
 *    React components, viven en Studio. Studio mapea `id → icon` en
 *    runtime cuando construye el segmented control.
 *  - WIDTHS / WIDTH_DESCRIPTIONS — UI-only del editor de tabla, no del
 *    modelo del KRP.
 *  - SIZE_REL_WIDTH ratios — específico del Studio AppPreview rendering.
 *  - Separators del composable (' · ', ' | ', etc.) — UX choice del
 *    publisher, no catálogo cerrado.
 *
 * Historia: catálogos extraídos de `kromia-studio/src/components/album/
 * recipes/ViewCompositionEditor.tsx`, `CardFieldsBuilder.tsx`, y
 * `src/lib/card-format.ts` en KRO-75.
 */

import type { ActionId, SlotAppearance } from './types';
import type { AppearanceProp } from './registries/slot-kinds';

// ─────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────

/**
 * Opción genérica de un catálogo. `id` es el valor que se persiste; `label`
 * y `tooltip` son metadata para el editor. Studio enriquece con JSX icons
 * cuando aplica (mapping local).
 */
export interface CatalogOption {
  id:       string;
  label?:   string;
  tooltip?: string;
}

/**
 * Preset compuesto para appearance. Combina varios campos de appearance
 * en un solo click ergonómico ("Banner ancho" = rounded + 16:9).
 */
export interface AppearancePreset {
  id:     string;
  label:  string;
  desc:   string;
  shape:  NonNullable<SlotAppearance['shape']>;
  aspect: NonNullable<SlotAppearance['aspect']>;
}

/** Aspect ratio cerrado para la carta del álbum. */
export const CARD_ASPECTS = ['2:3', '3:2', '1:1', '16:9'] as const;
export type CardAspect = typeof CARD_ASPECTS[number];

/** Tamaño físico cerrado para la carta del álbum. */
export const CARD_SIZES = ['mini', 'standard', 'large', 'poster'] as const;
export type CardSize = typeof CARD_SIZES[number];

/** Formato persistido de la carta del álbum. */
export interface CardFormat {
  aspect: CardAspect;
  size:   CardSize;
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Action labels — labels es-ES para el dropdown de "acción al tocar"
// ─────────────────────────────────────────────────────────────────────────

/**
 * Label visible es-ES para cada `ActionId`. El editor lo muestra en el
 * dropdown del slot's action. Flutter puede usar el mismo map para
 * localizar UI futura si lee el JSON contract.
 */
export const OPTIONS_ACTION_LABELS: Record<ActionId, string> = {
  none:               'Informativo (sin acción)',
  navigate_to_detail: 'Abrir detalle',
  modal:              'Abrir en overlay',
  expand_inline:      'Desplegar in-line (accordion)',
  external_link:      'Abrir enlace externo',
};

// ─────────────────────────────────────────────────────────────────────────
// 2. Appearance options — catálogos cerrados por propiedad
// ─────────────────────────────────────────────────────────────────────────

/** Forma del clip de un image-slot. */
export const OPTIONS_APPEARANCE_SHAPE: ReadonlyArray<CatalogOption> = [
  { id: 'circle',  tooltip: 'Círculo' },
  { id: 'square',  tooltip: 'Cuadrado' },
  { id: 'rounded', tooltip: 'Redondeado' },
];

/** Aspect ratio del wrapper. */
export const OPTIONS_APPEARANCE_ASPECT: ReadonlyArray<CatalogOption> = [
  { id: '1:1',  tooltip: '1:1 (cuadrado)' },
  { id: '16:9', tooltip: '16:9 (banner ancho)' },
  { id: '4:3',  tooltip: '4:3 (paisaje clásico)' },
  { id: '3:4',  tooltip: '3:4 (retrato)' },
  { id: '9:16', tooltip: '9:16 (Story / Reel)' },
  { id: 'free', tooltip: 'Libre (sin forzar)' },
];

/** Alineación horizontal del contenido del slot. */
export const OPTIONS_APPEARANCE_ALIGN: ReadonlyArray<CatalogOption> = [
  { id: 'left',   tooltip: 'Izquierda' },
  { id: 'center', tooltip: 'Centro' },
  { id: 'right',  tooltip: 'Derecha' },
];

/** Peso tipográfico. */
export const OPTIONS_APPEARANCE_WEIGHT: ReadonlyArray<CatalogOption> = [
  { id: 'regular',  label: 'Reg',  tooltip: 'Regular' },
  { id: 'semibold', label: 'Semi', tooltip: 'Seminegrita' },
  { id: 'bold',     label: 'Bold', tooltip: 'Negrita' },
];

/** Transformación del texto (KRO-133). */
export const OPTIONS_APPEARANCE_TEXT_TRANSFORM: ReadonlyArray<CatalogOption> = [
  { id: 'none',      label: 'Aa',  tooltip: 'Normal (sin cambio)' },
  { id: 'uppercase', label: 'AA',  tooltip: 'MAYÚSCULAS con tracking ancho (estilo etiqueta/meta)' },
];

/** Tamaño relativo al default del manifest. */
export const OPTIONS_APPEARANCE_SIZE: ReadonlyArray<CatalogOption> = [
  { id: 'sm', label: 'S',  tooltip: 'Pequeño' },
  { id: 'md', label: 'M',  tooltip: 'Medio' },
  { id: 'lg', label: 'L',  tooltip: 'Grande' },
  { id: 'xl', label: 'XL', tooltip: 'Extra grande' },
];

/** Truncado de texto por número de líneas. */
export const OPTIONS_APPEARANCE_TRUNCATE: ReadonlyArray<CatalogOption> = [
  { id: '1',    label: '1L', tooltip: '1 línea' },
  { id: '2',    label: '2L', tooltip: '2 líneas' },
  { id: '3',    label: '3L', tooltip: '3 líneas' },
  { id: 'none', label: '∞',  tooltip: 'Sin cortar' },
];

/** Padding vertical del wrapper del slot. */
export const OPTIONS_APPEARANCE_PADDING_Y: ReadonlyArray<CatalogOption> = [
  { id: 'none', label: '0', tooltip: 'Sin padding' },
  { id: 'sm',   label: 'S', tooltip: 'Pequeño' },
  { id: 'md',   label: 'M', tooltip: 'Medio' },
  { id: 'lg',   label: 'L', tooltip: 'Grande' },
];

/** Posición del border accent. */
export const OPTIONS_APPEARANCE_ACCENT_POSITION: ReadonlyArray<CatalogOption> = [
  { id: 'auto',   label: 'Auto', tooltip: 'Posición default por receta (típicamente arriba en cards / detail, izquierda en accordion)' },
  { id: 'top',    label: '▲',    tooltip: 'Arriba' },
  { id: 'left',   label: '◀',    tooltip: 'Izquierda' },
  { id: 'right',  label: '▶',    tooltip: 'Derecha' },
  { id: 'bottom', label: '▼',    tooltip: 'Abajo' },
  { id: 'none',   label: '∅',    tooltip: 'Desactivar (solo swatch en este slot, sin border)' },
];

/** Label legible para cada appearance prop (header del editor). */
export const OPTIONS_APPEARANCE_LABELS: Record<AppearanceProp, string> = {
  shape:          'Forma',
  aspect:         'Ratio',
  imageFocus:     'Encuadre',
  align:          'Alinear',
  weight:         'Peso',
  textTransform:  'Mayús.',
  size:           'Tamaño',
  truncate:       'Truncar',
  truncateChars:  'Caracteres',
  accentPosition: 'Tinte',
  paddingY:       'Padding',
};

/** Tooltip explicando qué hace cada prop — visible al hover del label. */
export const OPTIONS_APPEARANCE_DESCRIPTIONS: Record<AppearanceProp, string> = {
  shape:          'Forma del clip: círculo, cuadrado o redondeado.',
  aspect:         'Aspect ratio del wrapper. ∞ = sin forzar.',
  imageFocus:     'Punto focal de la imagen + zoom dentro del crop.',
  align:          'Alineación horizontal: izquierda, centro o derecha.',
  weight:         'Peso tipográfico: Regular, Seminegrita o Negrita.',
  textTransform:  'MAYÚSCULAS con tracking ancho (estilo etiqueta) o normal.',
  size:           'Tamaño relativo al default del manifest.',
  truncate:       'Cortar texto largo con "…". 1L/2L/3L = N líneas máximas, ∞ = texto completo.',
  truncateChars:  'Cortar por número de caracteres (slice JS). Predecible, independiente del ancho.',
  accentPosition: 'Posición de la línea de color que rodea la tarjeta. "Auto" usa la posición default por receta; "∅" desactiva la línea.',
  paddingY:       'Padding vertical del wrapper del slot — separación con vecinos.',
};

// ─────────────────────────────────────────────────────────────────────────
// 3. Appearance presets — combinaciones one-click de shape + aspect
// ─────────────────────────────────────────────────────────────────────────

export const APPEARANCE_PRESETS: ReadonlyArray<AppearancePreset> = [
  { id: 'avatar',   label: 'Avatar redondo', desc: 'Círculo 1:1 — fotos de perfil, escudos, banderas',  shape: 'circle',  aspect: '1:1'  },
  { id: 'square',   label: 'Cuadrado',       desc: 'Cuadrado 1:1 — íconos, tiles uniformes',            shape: 'square',  aspect: '1:1'  },
  { id: 'portrait', label: 'Retrato carta',  desc: 'Redondeado 3:4 — cromos verticales tipo Magic',     shape: 'rounded', aspect: '3:4'  },
  { id: 'banner',   label: 'Banner ancho',   desc: 'Redondeado 16:9 — cabeceras, covers panorámicos',   shape: 'rounded', aspect: '16:9' },
  { id: 'story',    label: 'Story / Reel',   desc: 'Redondeado 9:16 — vertical mobile-first',           shape: 'rounded', aspect: '9:16' },
  { id: 'polaroid', label: 'Polaroid',       desc: 'Redondeado 4:3 — paisaje clásico nostálgico',       shape: 'rounded', aspect: '4:3'  },
];

/**
 * Detecta si la appearance actual coincide exactamente con algún preset.
 * Devuelve el id del preset, o undefined si no hay match.
 */
export function detectActivePreset(
  appearance: { shape?: string; aspect?: string } | undefined,
): string | undefined {
  if (!appearance?.shape || !appearance?.aspect) return undefined;
  return APPEARANCE_PRESETS.find(p =>
    p.shape === appearance.shape && p.aspect === appearance.aspect,
  )?.id;
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Card format — aspect/size de la carta + labels es-ES
// ─────────────────────────────────────────────────────────────────────────

export const DEFAULT_CARD_FORMAT: CardFormat = {
  aspect: '2:3',
  size:   'standard',
};

export const OPTIONS_CARD_ASPECT_LABELS: Record<CardAspect, string> = {
  '2:3':  'Vertical · 2:3 (Magic, Pokémon)',
  '3:2':  'Horizontal · 3:2 (Topps baseball)',
  '1:1':  'Cuadrada · 1:1 (mini-cromo, Instagram)',
  '16:9': 'Panorámica · 16:9 (momentos, especiales)',
};

export const OPTIONS_CARD_SIZE_LABELS: Record<CardSize, string> = {
  mini:     'Mini (~50×75 mm)',
  standard: 'Estándar (~63×88 mm) · default',
  large:    'Grande (~75×100 mm)',
  poster:   'Póster (A5+)',
};

/** Razón W/H del aspect (útil para CSS `aspect-ratio` o cálculo Flutter). */
export function aspectToRatio(a: CardAspect): number {
  const [w, h] = a.split(':').map(Number);
  return w / h;
}

/**
 * KRO-78 — Multiplicador de columnas para el grid de mini-cards relacionadas
 * (MiniCardRefs) según el tamaño físico del cardFormat. Cards más grandes
 * ocupan más → menos columnas por fila.
 *
 * Vive en `@kromia/core` (no en `@kromia/react`) para que el renderer React y
 * el futuro `@kromia/flutter` deriven EXACTAMENTE las mismas columnas — sin
 * número mágico duplicado por plataforma (anti-drift, pattern KRO-75/76).
 */
export const MINI_REF_GRID_SIZE_MULTIPLIER: Record<CardSize, number> = {
  mini:     1.3,
  standard: 1.0,
  large:    0.7,
  poster:   0.4,
};

/**
 * KRO-78 — Nº de columnas del grid de mini-cards relacionadas, derivado del
 * `cardFormat` del álbum (aspect + size). Reemplaza el `grid-cols-4` a fuego.
 *
 * Lógica (clamp 1-6):
 *   baseCols = aspect panorámico/horizontal (ratio > 1.2) ? 2 : 3
 *   cols     = round(baseCols × multiplicador-por-size)
 *
 * Matriz resultante:
 *                mini   standard   large   poster
 *   2:3 / 1:1     4       3          2       1
 *   3:2 / 16:9    3       2          1       1
 *
 * Pensado para el ancho del PhoneFrame del AppPreview (y el viewport móvil de
 * Flutter): un nº de columnas fijo y legible por tier, no un auto-fit que se
 * descuadra en frames estrechos.
 */
export function miniRefGridColumns(cardFormat: CardFormat): number {
  const isWide         = aspectToRatio(cardFormat.aspect) > 1.2;
  const baseCols       = isWide ? 2 : 3;
  const sizeMultiplier = MINI_REF_GRID_SIZE_MULTIPLIER[cardFormat.size] ?? 1;
  return Math.max(1, Math.min(6, Math.round(baseCols * sizeMultiplier)));
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Field type descriptions — descripciones es-ES por field type id
// ─────────────────────────────────────────────────────────────────────────
//
// Las descripciones por tipo viven YA en `FieldTypeDefinition.description`
// de cada entry en `registries/field-types.ts`. Para conveniencia del
// editor (que las consulta por id como un Record), exportamos un helper.

export function getFieldTypeDescriptions(
  fieldTypes: ReadonlyArray<{ id: string; description: string }>,
): Record<string, string> {
  return Object.fromEntries(fieldTypes.map(t => [t.id, t.description]));
}
