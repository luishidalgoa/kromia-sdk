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

/** KRO-225 — redondeado de esquinas de la carta (cerrado). El render lo aplica
 *  al canto de la carta Y al marco del efecto (mismo radio → coherencia). */
export const CARD_CORNER_RADII = ['none', 'sm', 'md', 'lg', 'xl'] as const;
export type CardCornerRadius = typeof CARD_CORNER_RADII[number];

/** Formato persistido de la carta del álbum. */
export interface CardFormat {
  aspect: CardAspect;
  size:   CardSize;
  /** KRO-225 — redondeado de esquinas. Opcional (aditivo): ausente ⇒ 'md'. */
  cornerRadius?: CardCornerRadius;
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

/** Sombra del TEXTO para legibilidad sobre imágenes (KRO-155). */
export const OPTIONS_APPEARANCE_TEXTSHADOW: ReadonlyArray<CatalogOption> = [
  { id: 'none', label: '∅',     tooltip: 'Sin sombra' },
  { id: 'sm',   label: 'Suave', tooltip: 'Sombra sutil — texto sobre imágenes con algo de contraste' },
  { id: 'md',   label: 'Media', tooltip: 'Sombra marcada — texto claro sobre imágenes claras/ruidosas' },
];

/** Familia tipográfica del texto (KRO-162). `serif` = editorial/literario
 *  (la que usa la receta Editorial); `sans` = la UI por defecto. */
export const OPTIONS_APPEARANCE_FONT: ReadonlyArray<CatalogOption> = [
  { id: 'sans',       label: 'Sans',         tooltip: 'Sans (la tipografía de la app, Plus Jakarta)' },
  { id: 'serif',      label: 'Serif',        tooltip: 'Serif clásica (editorial, con remates)' },
  // KRO-198(5) — set curado de Google Fonts (paridad Flutter por `google_fonts`).
  { id: 'inter',      label: 'Inter',        tooltip: 'Sans neutra y muy legible (UI/datos)' },
  { id: 'manrope',    label: 'Manrope',      tooltip: 'Sans geométrica moderna' },
  { id: 'nunito',     label: 'Nunito',       tooltip: 'Sans redondeada y cálida (amable)' },
  { id: 'montserrat', label: 'Montserrat',   tooltip: 'Sans con carácter (títulos y cuerpo)' },
  { id: 'lora',       label: 'Lora',         tooltip: 'Serif elegante y muy legible (lore/texto)' },
  { id: 'playfair',   label: 'Playfair',     tooltip: 'Serif de alto contraste (display de lujo, títulos)' },
  { id: 'robotoslab', label: 'Roboto Slab',  tooltip: 'Serif de bloque (slab) — sólida y robusta' },
  { id: 'oswald',     label: 'Oswald',       tooltip: 'Condensada de impacto (rareza, etiquetas)' },
  { id: 'jetbrains',  label: 'JetBrains Mono', tooltip: 'Monoespaciada (códigos, stats alineadas)' },
];

/** KRO-147 F3 — interlineado (line-height) del texto. */
export const OPTIONS_APPEARANCE_LINE_HEIGHT: ReadonlyArray<CatalogOption> = [
  { id: 'tight',   label: 'Compacto', tooltip: 'Líneas juntas (títulos, datos densos)' },
  { id: 'normal',  label: 'Normal',   tooltip: 'El interlineado de la app (default)' },
  { id: 'relaxed', label: 'Aireado',  tooltip: 'Líneas separadas (párrafos largos)' },
];

/** KRO-147 F3 — espaciado entre letras (tracking). */
export const OPTIONS_APPEARANCE_TRACKING: ReadonlyArray<CatalogOption> = [
  { id: 'tight',  label: 'Apretado', tooltip: 'Letras juntas' },
  { id: 'normal', label: 'Normal',   tooltip: 'Tracking de la app (default)' },
  { id: 'wide',   label: 'Abierto',  tooltip: 'Letras separadas (estilo etiqueta)' },
];

/** KRO-169 — cómo se PRESENTA el valor del slot: texto plano o pill/chip
 *  (badge). Antes vivía hardcodeado solo en el editor de bloques. */
export const OPTIONS_APPEARANCE_DISPLAY: ReadonlyArray<CatalogOption> = [
  { id: 'text',  label: 'Texto', tooltip: 'Texto plano (default)' },
  { id: 'badge', label: 'Badge', tooltip: 'Pill/chip — rarezas, tipos, etiquetas' },
];

/**
 * KRO-198 — variante de RENDER de un slot COMPOSABLE (cómo se disponen sus
 * múltiples fields). Es meta de `SlotComposition.composableDisplay` (como
 * orientation/separator), NO una appearance-prop → su nombre NO lleva el prefijo
 * `OPTIONS_APPEARANCE_` para que `buildAppearance()` NO lo serialice en el
 * contrato KRP (no bumpea PROTOCOL_VERSION). El editor de Studio lo usa para el
 * selector "Disposición"; Flutter lo espeja desde el tipo.
 */
export const OPTIONS_COMPOSABLE_DISPLAY: ReadonlyArray<CatalogOption> = [
  { id: 'auto',   label: 'Auto',     tooltip: 'Según el tipo: tags→chips, enlaces→lista de links, resto unido por el separador' },
  { id: 'inline', label: 'En línea', tooltip: 'Todos los valores en una línea, unidos por el separador' },
  { id: 'list',   label: 'Lista',    tooltip: 'Un valor por línea (apilados)' },
  { id: 'chips',  label: 'Chips',    tooltip: 'Cada valor como una pastilla/badge' },
  { id: 'table',  label: 'Tabla',    tooltip: 'Filas etiqueta–valor (usa la etiqueta de cada campo)' },
  { id: 'stats',  label: 'Stats',    tooltip: 'Fila de estadísticas: valor grande + etiqueta debajo, en columnas (como el bloque stats del detalle)' },
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

/** KRO-147 F3 — ajuste de la imagen dentro de su caja. */
export const OPTIONS_APPEARANCE_OBJECT_FIT: ReadonlyArray<CatalogOption> = [
  { id: 'cover',   label: 'Recortar', tooltip: 'Rellena la caja recortando lo que sobra (con punto focal)' },
  { id: 'contain', label: 'Encajar',  tooltip: 'Encaja la imagen entera sin recortar (deja bandas)' },
];

/** KRO-147 F3 — opacidad del slot (efecto). */
export const OPTIONS_APPEARANCE_OPACITY: ReadonlyArray<CatalogOption> = [
  { id: '100', label: '100%', tooltip: 'Opaco (default)' },
  { id: '90',  label: '90%',  tooltip: 'Casi opaco' },
  { id: '75',  label: '75%',  tooltip: 'Translúcido' },
  { id: '50',  label: '50%',  tooltip: 'Medio transparente (marcas de agua)' },
];

/** KRO-147 F3 — sombra del slot (a nivel slot, no del contenedor). */
export const OPTIONS_APPEARANCE_SHADOW: ReadonlyArray<CatalogOption> = [
  { id: 'none', label: '0', tooltip: 'Sin sombra (default)' },
  { id: 'sm',   label: 'S', tooltip: 'Sombra sutil' },
  { id: 'md',   label: 'M', tooltip: 'Sombra media' },
  { id: 'lg',   label: 'L', tooltip: 'Sombra marcada (elevación)' },
];

/** Columnas de la rejilla de mini-cartas de un slot card-ref (KRO-133).
 *  Sin override = automático (derivado del formato de carta del álbum). */
export const OPTIONS_APPEARANCE_REF_COLUMNS: ReadonlyArray<CatalogOption> = [
  { id: '1', label: '1', tooltip: '1 columna (lista vertical de cartas)' },
  { id: '2', label: '2', tooltip: '2 columnas' },
  { id: '3', label: '3', tooltip: '3 columnas' },
  { id: '4', label: '4', tooltip: '4 columnas' },
];

/** Acción al TOCAR una mini-carta de referencias (KRO-133). */
export const OPTIONS_APPEARANCE_REF_TAP: ReadonlyArray<CatalogOption> = [
  { id: 'none',  label: '∅',     tooltip: 'No interactiva (solo se muestra)' },
  { id: 'focus', label: 'Focus', tooltip: 'Abre la carta real en modo focus (overlay protagonista)' },
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
  objectFit:      'Ajuste',
  imageFocus:     'Encuadre',
  align:          'Alinear',
  weight:         'Peso',
  italic:         'Cursiva',
  underline:      'Subrayado',
  textTransform:  'Mayús.',
  font:           'Tipografía',
  lineHeight:     'Interlineado',
  tracking:       'Tracking',
  textShadow:     'Sombra de texto',
  display:        'Mostrar como',
  textColor:      'Color del texto',
  bgColor:        'Fondo',
  size:           'Tamaño',
  truncate:       'Truncar',
  truncateChars:  'Caracteres',
  accentPosition: 'Tinte',
  refColumns:     'Columnas',
  refSize:        'Tamaño',
  refTap:         'Al tocar',
  paddingY:       'Padding',
  opacity:        'Opacidad',
  shadow:         'Sombra de la caja',
};

/** Tooltip explicando qué hace cada prop — visible al hover del label. */
export const OPTIONS_APPEARANCE_DESCRIPTIONS: Record<AppearanceProp, string> = {
  shape:          'Forma del clip: círculo, cuadrado o redondeado.',
  aspect:         'Aspect ratio del wrapper. ∞ = sin forzar.',
  objectFit:      'Ajuste de la imagen: recortar para rellenar (con punto focal) o encajar entera.',
  imageFocus:     'Punto focal de la imagen + zoom dentro del crop.',
  align:          'Alineación horizontal: izquierda, centro o derecha.',
  weight:         'Peso tipográfico: Regular, Seminegrita o Negrita.',
  italic:         'Cursiva (itálica) del texto del slot.',
  underline:      'Subrayado del texto del slot (con offset).',
  textTransform:  'MAYÚSCULAS con tracking ancho (estilo etiqueta) o normal.',
  font:           'Familia tipográfica: sans (app) o serif (editorial).',
  lineHeight:     'Interlineado (separación entre líneas): compacto, normal o aireado.',
  tracking:       'Espaciado entre letras: apretado, normal o abierto.',
  textShadow:     'Sombra bajo el texto para que se lea sobre imágenes claras.',
  display:        'Texto plano o pill/chip (badge) — rarezas, tipos, etiquetas.',
  textColor:      'Color del texto: paleta del tema o vinculado a un campo color del dato.',
  bgColor:        'Color de fondo del slot: paleta del tema o vinculado a un campo color.',
  size:           'Tamaño relativo al default del manifest.',
  truncate:       'Cortar texto largo con "…". 1L/2L/3L = N líneas máximas, ∞ = texto completo.',
  truncateChars:  'Cortar por número de caracteres (slice JS). Predecible, independiente del ancho. Coexiste con "Truncar líneas".',
  accentPosition: 'Posición de la línea de color que rodea la tarjeta. "Auto" usa la posición default por receta; "∅" desactiva la línea.',
  refColumns:     'Columnas de la rejilla de mini-cartas. Sin valor = automático según el formato de carta del álbum.',
  refSize:        'Tamaño de cada mini-carta: % del ancho disponible (ajuste fino numérico). En rejilla, 100 = llena su columna.',
  refTap:         'Qué pasa al tocar una mini-carta: nada, o abrirla en modo focus (overlay protagonista).',
  paddingY:       'Padding vertical del wrapper del slot — separación con vecinos.',
  opacity:        'Opacidad del slot: 100% opaco hasta 50% (marcas de agua, fondos sutiles).',
  shadow:         'Sombra del slot (elevación): ninguna, sutil, media o marcada.',
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
// 3b. Labels es-ES del EDITOR DE BLOQUES (KRO-172)
//
// Antes vivían hardcodeados en LayoutEditor.tsx (Studio) — drift silencioso
// con Flutter y bloqueo de i18n. Misma promesa que KRO-75: añadir una opción
// al modelo = su label vive AQUÍ y todos los editores la heredan.
// ─────────────────────────────────────────────────────────────────────────

/** Espaciado entre celdas del grid (LayoutGap). */
export const LAYOUT_GAP_LABELS: Readonly<Record<string, string>> = {
  none: 'Pegado', xs: 'XS', sm: 'S', md: 'M', lg: 'L',
};

/** Alineación de items (LayoutAlign). */
export const LAYOUT_ALIGN_LABELS: Readonly<Record<string, string>> = {
  start: 'Inicio', center: 'Centro', end: 'Final', stretch: 'Estirar',
};

/** Tamaños de pista (track sizing) del grid. */
export const LAYOUT_TRACK_LABELS: Readonly<Record<string, string>> = {
  '1fr': '1×', '2fr': '2×', '3fr': '3×', auto: 'Auto', content: 'Ajust.',
};

/** Decoración (surface) de contenedores: labels por grupo. */
export const LAYOUT_SURFACE_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  background:  { none: 'Ninguno', card: 'Tarjeta', muted: 'Tenue', accent: 'Acento', primary: 'Marca' },
  borderWidth: { thin: 'Fino', medium: 'Medio', thick: 'Grueso' },
  borderSide:  { top: 'Arriba', right: 'Derecha', bottom: 'Abajo', left: 'Izquierda' },
  borderStyle: { solid: 'Sólido', dashed: 'Trazos', dotted: 'Puntos' },
  radius:      { none: 'Rectas', sm: 'S', md: 'M', lg: 'L', xl: 'XL', full: 'Círculo' },
  shadow:      { none: 'Sin', sm: 'S', md: 'M', lg: 'L', xl: 'XL' },
  padding:     { none: '0', xs: 'XS', sm: 'S', md: 'M', lg: 'L', xl: 'XL' },
};

// ─────────────────────────────────────────────────────────────────────────
// 4. Card format — aspect/size de la carta + labels es-ES
// ─────────────────────────────────────────────────────────────────────────

export const DEFAULT_CARD_FORMAT: CardFormat = {
  aspect: '2:3',
  size:   'standard',
  cornerRadius: 'md',
};

/** KRO-225 — redondeado por nivel. `css` = valor de `border-radius` del
 *  contenedor de la carta en el render, en **PORCENTAJE** para que la roundness
 *  ESCALE con el tamaño (igual de redonda en grid, focus o preview, no px fijos).
 *  `svg` = radio en el espacio 300×420 del `borderSVG` (≈ css% × 3, porque el
 *  lienzo SVG es 300 de ancho → se escala a la carta). 'md' replica el look
 *  previo aprox. (backward-compat). */
export const CARD_CORNER_RADIUS_PX: Record<CardCornerRadius, { css: string; svg: number }> = {
  none: { css: '0',   svg: 0  },
  sm:   { css: '4%',  svg: 12 },
  md:   { css: '8%',  svg: 24 },
  lg:   { css: '16%', svg: 48 },
  xl:   { css: '28%', svg: 84 },
};

/** Resuelve el redondeado del formato, con fallback a 'md' si no se declaró. */
export function cardCornerRadiusPx(fmt: CardFormat | undefined): { css: string; svg: number } {
  return CARD_CORNER_RADIUS_PX[fmt?.cornerRadius ?? 'md'];
}

export const OPTIONS_CARD_CORNER_RADIUS_LABELS: Record<CardCornerRadius, string> = {
  none: 'Recto (sin redondeo)',
  sm:   'Poco',
  md:   'Medio · default',
  lg:   'Bastante',
  xl:   'Máximo',
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
