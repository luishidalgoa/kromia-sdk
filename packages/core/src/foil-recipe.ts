/**
 * KRO-202 / KRO-224 — Receta DATA del foil iridiscente (movida a @kromia/core:
 * fuente única cross-platform; antes vivía en Studio `VisualEffectLayers.tsx`,
 * de donde se copiaba a Flutter a mano = drift).
 *
 * Los 6 `pattern` del `iridescent_foil` se declaran como DATOS ESTRUCTURADOS
 * (ángulo + stops de color), NO como string CSS: cada host construye su gradiente
 * nativo (Studio → CSS `repeating-linear-gradient`/`conic-gradient` con `foilPatternCss`;
 * Flutter → `LinearGradient`/`SweepGradient` desde los mismos stops). Así el COLOR
 * del foil es idéntico en ambas plataformas sin copiar strings.
 *
 * Los blends FIJOS por-capa y las opacidades DEFAULT no se declaran aquí: los
 * defaults viven en el config del efecto (`registries/visual-effects.ts`), y el
 * blend por-capa (foil = config.blend; sheen = screen; glare = soft-light;
 * noise = overlay) es política de render que cada host aplica igual — documentada
 * en el comentario de KRO-224 y en el render source.
 */

export interface FoilStop {
  /** Color hex `#rrggbb`. */
  color: string;
  /** Posición del stop en % (0–100). */
  pos: number;
}

export type FoilPattern =
  | { kind: 'repeating-linear'; angleDeg: number; stops: FoilStop[] }
  /** Cónico de colores equiespaciados (sin posiciones). */
  | { kind: 'conic'; fromDeg: number; colors: string[] };

/** Los 6 patterns del `iridescent_foil` (stops EXACTOS, calcados del mockup
 *  `Iridescent Card (standalone).html`). El enum `pattern` del efecto = estas keys. */
export const FOIL_PATTERNS: Record<string, FoilPattern> = {
  spectrum: {
    kind: 'repeating-linear', angleDeg: 115,
    stops: [
      { color: '#ff5fa2', pos: 0 }, { color: '#ffd166', pos: 9 }, { color: '#6efea0', pos: 18 },
      { color: '#57d2ff', pos: 27 }, { color: '#b985ff', pos: 36 }, { color: '#ff5fa2', pos: 45 },
    ],
  },
  oilslick: {
    kind: 'repeating-linear', angleDeg: 120,
    stops: [
      { color: '#3a6df0', pos: 0 }, { color: '#9b5cff', pos: 10 }, { color: '#ff5fa2', pos: 20 },
      { color: '#27c4b0', pos: 30 }, { color: '#3a6df0', pos: 40 },
    ],
  },
  sunset: {
    kind: 'repeating-linear', angleDeg: 110,
    stops: [
      { color: '#ff7e5f', pos: 0 }, { color: '#ffd166', pos: 12 }, { color: '#ff5fa2', pos: 24 },
      { color: '#b985ff', pos: 36 }, { color: '#ff7e5f', pos: 48 },
    ],
  },
  mint: {
    kind: 'repeating-linear', angleDeg: 115,
    stops: [
      { color: '#6efea0', pos: 0 }, { color: '#57d2ff', pos: 12 }, { color: '#b4ddd8', pos: 24 },
      { color: '#a0ffe0', pos: 36 }, { color: '#6efea0', pos: 48 },
    ],
  },
  aurora: {
    kind: 'conic', fromDeg: 0,
    colors: ['#57d2ff', '#6efea0', '#ffd166', '#ff5fa2', '#b985ff', '#57d2ff'],
  },
  // KRO-202 — "Medianoche": joya profunda (azul/violeta/teal), reluce sin ser arcoíris.
  midnight: {
    kind: 'repeating-linear', angleDeg: 120,
    stops: [
      { color: '#3a5fd0', pos: 0 }, { color: '#7a4ad0', pos: 11 }, { color: '#2aa088', pos: 22 },
      { color: '#4a6ad0', pos: 33 }, { color: '#3a5fd0', pos: 45 },
    ],
  },
};

/** Ids de los patterns disponibles (orden de declaración). */
export const FOIL_PATTERN_IDS = Object.keys(FOIL_PATTERNS) as ReadonlyArray<string>;

/** KRO-247 — paleta "Ninguna": el foil NO pinta gradiente de color. Id reservado
 *  del enum `pattern` (no vive en `FOIL_PATTERNS`: no hay stops de color). */
export const FOIL_PATTERN_NONE = 'none';

/**
 * KRO-247 — RECETA de la lámina NEUTRA (`pattern: 'none'`): sin gradiente de
 * color, el REFLEJO (sheen) usa este barrido blanco diagonal ÚNICO (no
 * repeating) en vez del gradiente de la paleta; la capa foil de color NO se
 * pinta (hue/brightness/contrast/scale/blend no aplican). Glare, grano y borde
 * no cambian. Es la base para combinar el brillo del iridiscente con capas
 * importadas (`custom_foil`) sin teñirlas de arcoíris.
 *
 * Fuente única cross-platform: Studio construye el CSS con
 * `foilNeutralSheenCss()`; Flutter su `LinearGradient` desde estos MISMOS stops
 * (blanco con alpha 0→0.9→0). El barrido se panea con el tilt / hace vaivén en
 * rejilla igual que el foil de color.
 */
export const FOIL_NEUTRAL_SHEEN = {
  /** Ángulo del barrido (el nativo de spectrum, mismo carácter diagonal). */
  angleDeg: 115,
  /** Stops BLANCOS con alpha 0–1 en pos % — barrido único, NO repeating. */
  stops: [
    { alpha: 0,   pos: 0 },
    { alpha: 0.9, pos: 50 },
    { alpha: 0,   pos: 100 },
  ],
} as const;

/** Host WEB: gradiente CSS del barrido neutro (`pattern: 'none'`). */
export function foilNeutralSheenCss(): string {
  const stops = FOIL_NEUTRAL_SHEEN.stops.map(s => `rgba(255,255,255,${s.alpha}) ${s.pos}%`);
  return `linear-gradient(${FOIL_NEUTRAL_SHEEN.angleDeg}deg,${stops.join(',')})`;
}

/** Host WEB (Studio): construye el string CSS del gradiente de un pattern. Flutter
 *  NO usa esto — construye su gradiente nativo desde `FOIL_PATTERNS[pattern]`.
 *  KRO-244 — `rotateDeg` (param `angle` del efecto): giro sobre el ángulo nativo. */
export function foilPatternCss(pattern: string, rotateDeg = 0): string {
  const p = FOIL_PATTERNS[pattern] ?? FOIL_PATTERNS.spectrum;
  if (p.kind === 'conic') return `conic-gradient(from ${p.fromDeg + rotateDeg}deg,${p.colors.join(',')})`;
  return `repeating-linear-gradient(${p.angleDeg + rotateDeg}deg,${p.stops.map(s => `${s.color} ${s.pos}%`).join(',')})`;
}

/** KRO-244 — parsea la paleta PERSONALIZADA del foil (`pattern_hex`): 2–4 hex
 *  `#RRGGBB` separados por coma. `null` si no es válida (→ se usa `pattern`).
 *  Compartido cross-platform: Flutter valida/parsea igual. */
export function parseFoilPatternHex(raw: string): string[] | null {
  if (!raw || !raw.trim()) return null;
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return null;
  return parts.every(p => /^#[0-9a-fA-F]{6}$/.test(p)) ? parts : null;
}

/** Host WEB: gradiente CSS de una paleta personalizada. Mismo CICLO que spectrum
 *  (la banda se repite cada 45%) con los colores equiespaciados y el primero
 *  repetido al cierre → repetición sin costura. Flutter construye su
 *  LinearGradient con estos mismos stops (k·45/n %, cierre en 45%). */
export function foilCustomPatternCss(colors: string[], angleDeg = 115): string {
  const cycle = 45;
  const step  = cycle / colors.length;
  const stops = colors.map((c, k) => `${c} ${+(k * step).toFixed(1)}%`);
  stops.push(`${colors[0]} ${cycle}%`);
  return `repeating-linear-gradient(${angleDeg}deg,${stops.join(',')})`;
}

/** Ángulo NATIVO de un pattern (linear = `angleDeg`; conic = `fromDeg`; paleta
 *  personalizada / desconocido = 115°, como spectrum). */
export function foilPatternBaseAngle(pattern: string): number {
  const p = FOIL_PATTERNS[pattern];
  return p ? (p.kind === 'conic' ? p.fromDeg : p.angleDeg) : 115;
}

/** KRO-244 — ORIENTACIÓN: ángulo EFECTIVO de las bandas = ángulo nativo del pattern
 *  + `rotate` (param `angle` del efecto). Fuente única para ambos hosts. */
export function foilEffectiveAngle(pattern: string, rotate = 0): number {
  return foilPatternBaseAngle(pattern) + rotate;
}

/**
 * KRO-244 — RECETA de la GEOMETRÍA ORGÁNICA del foil (`geometry: 'organico'`):
 * las bandas RECTAS se curvan por un desplazamiento de RUIDO FRACTAL → difracción
 * tipo lámina holográfica real (ref. ticket ISKRA). Estos son los PARÁMETROS del
 * ruido, fuente única cross-platform (antes vivían hardcodeados en el render de
 * Studio = drift).
 *
 * - Studio los aplica con un filtro SVG `feTurbulence` + `feDisplacementMap` sobre
 *   las capas foil y sheen (glare/grano/borde NO se deforman).
 * - Flutter los aplica en su fragment shader (fbm sobre las UV antes de muestrear
 *   el gradiente): `uv' = uv + (fbm(uv * baseFrequency, octaves) - 0.5) * disp`.
 *
 * ⚠️ El algoritmo de ruido DIFIERE (Perlin de SVG vs fbm del shader) → el resultado
 * NO es bit-idéntico entre plataformas. Con los MISMOS parámetros el LOOK converge:
 * bandas anchas curvadas SUAVES (no zigzag). `seed` fijo = estable entre cartas.
 */
export const FOIL_ORGANIC_WARP = {
  /** `feTurbulence baseFrequency` (X, Y). Bajo = ondas anchas y suaves. */
  baseFrequencyX: 0.008,
  baseFrequencyY: 0.014,
  /** `feTurbulence numOctaves`. */
  octaves: 2,
  /** `feTurbulence seed` (fijo → estable; Flutter usa el mismo como ancla). */
  seed: 7,
  /** Desplazamiento MÁXIMO (a warp=100) en el espacio de la carta. El scale
   *  efectivo = `foilWarpDisplacement(warp)`. */
  maxDisplacement: 90,
  /** Overscan (fracción del lado) para que el desplazamiento no revele los bordes
   *  transparentes de las capas (el host clipa con el redondeado/silueta). */
  overscan: 0.12,
} as const;

/** Desplazamiento efectivo del warp orgánico dado el param `warp` (0–100) →
 *  `scale` del feDisplacementMap (Studio) / factor del shader (Flutter). */
export function foilWarpDisplacement(warp: number): number {
  const w = Math.max(0, Math.min(100, warp));
  return (w / 100) * FOIL_ORGANIC_WARP.maxDisplacement;
}

/** Opacidad de la capa del efecto `holographic_effect` (preset cerrado) según su
 *  `intensity`. Compartido cross-platform (Studio y Flutter aplican la misma). */
export function holographicOpacity(intensity: string | number | undefined): number {
  switch (intensity) {
    case 'low':  return 0.18;
    case 'high': return 0.48;
    case 'medium':
    default:     return 0.32;
  }
}

/** KRO-244 (QA) — tintes del MARCO ornamental (`border_color` del iridescent_foil),
 *  centralizados como DATA cross-platform. SÓLIDOS: 'none'=blanco, gold, silver
 *  (silver se OSCURECIÓ — antes #cbd5e1 se confundía con el blanco en banda fina).
 *  aurora/spectrum NO están aquí: son gradientes del foil (FOIL_PATTERNS). */
export const FOIL_BORDER_SOLID: Record<string, string> = {
  none:   '#ffffff',
  gold:   '#f5c542',
  silver: '#aeb9c7',
};

/** KRO-244 (QA) — degradados oscuros "fondo carta" del marco (vertical top→bottom).
 *  RE-SATURADOS para ser DISTINGUIBLES entre sí como banda fina: antes los 4 eran
 *  casi-negros idénticos; ahora el top lleva el matiz claro (verde/neutro/violeta/
 *  azul) y el bottom lo ancla en oscuro. Fuente única — Flutter espeja estos hex. */
export const FOIL_CARD_BG: Record<string, { top: string; bottom: string }> = {
  forest:   { top: '#2e7d4f', bottom: '#0b2b1a' },   // verde bosque
  obsidian: { top: '#41444d', bottom: '#0a0a0d' },   // gris neutro casi-negro (su identidad)
  plum:     { top: '#6d3fa8', bottom: '#22103d' },   // violeta ciruela
  steel:    { top: '#3f6d99', bottom: '#101f30' },   // azul acero
};

/** Host WEB: gradiente CSS del tinte oscuro. `undefined` si el id no es "fondo carta". */
export function foilCardBgCss(id: string): string | undefined {
  const t = FOIL_CARD_BG[id];
  return t ? `linear-gradient(180deg,${t.top},${t.bottom})` : undefined;
}

/**
 * KRO-249 — FILL LIBRE del marco ornamental. El tinte del marco deja de ser un
 * catálogo cerrado: puede ser un sólido, un gradiente (cualquier paleta del
 * foil, o un degradado propio de 2–4 hex), o una TEXTURA importada. Este
 * resolver PURO centraliza la PRECEDENCIA (antes vivía inline en el render de
 * Studio = drift). Ambos hosts lo consumen y pintan cada kind con su primitiva:
 *
 *   1. `border_texture_url`  → { kind:'texture' }        (manda sobre todo)
 *   2. `border_color_hex`    → { kind:'solid' }          (hex #RRGGBB válido)
 *   3. `border_gradient_hex` → { kind:'custom-gradient' } (2–4 hex, ciclo 45%
 *       como pattern_hex — web: `foilCustomPatternCss(colors)`)
 *   4. `border_color` enum:
 *       'spectrum'                → { kind:'follow-foil' } (el gradiente ACTUAL
 *          del foil: pattern/pattern_hex/none del config — lo resuelve el host)
 *       paleta de FOIL_PATTERNS   → { kind:'palette' }     (gradiente FIJO)
 *       'forest'|'obsidian'|…     → { kind:'card-bg' }     (degradado oscuro)
 *       'none'|'gold'|'silver'|?? → { kind:'solid' }       (FOIL_BORDER_SOLID;
 *          desconocido cae a blanco, el look base)
 */
export type FoilBorderFill =
  | { kind: 'texture'; url: string }
  | { kind: 'solid'; color: string }
  | { kind: 'custom-gradient'; colors: string[] }
  | { kind: 'follow-foil' }
  | { kind: 'palette'; pattern: string }
  | { kind: 'card-bg'; top: string; bottom: string };

export function resolveFoilBorderFill(config: {
  border_texture_url?: unknown;
  border_color_hex?: unknown;
  border_gradient_hex?: unknown;
  border_color?: unknown;
}): FoilBorderFill {
  const texture = String(config.border_texture_url ?? '').trim();
  if (texture) return { kind: 'texture', url: texture };

  const hex = String(config.border_color_hex ?? '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return { kind: 'solid', color: hex };

  const gradient = parseFoilPatternHex(String(config.border_gradient_hex ?? ''));
  if (gradient) return { kind: 'custom-gradient', colors: gradient };

  const id = String(config.border_color ?? 'none');
  if (id === 'spectrum') return { kind: 'follow-foil' };
  if (FOIL_PATTERNS[id]) return { kind: 'palette', pattern: id };
  const cardBg = FOIL_CARD_BG[id];
  if (cardBg) return { kind: 'card-bg', top: cardBg.top, bottom: cardBg.bottom };
  return { kind: 'solid', color: FOIL_BORDER_SOLID[id] ?? FOIL_BORDER_SOLID.none };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * KRO-256 — VIDA del iridiscente: movimiento autónomo, destellos de máscara y
 * brillo del marco. Recetas numéricas cross-platform (Studio CSS / Flutter
 * shader espejan ESTOS valores).
 * ──────────────────────────────────────────────────────────────────────────── */

/** Valores del param `motion` (contrato). 'auto' = clásico (vaivén en rejilla,
 *  sigue la inclinación en focus). 'deriva' = barrido continuo. 'tono' = el
 *  matiz cicla en sitio. 'total' = ambos. */
export const FOIL_MOTIONS = ['auto', 'deriva', 'tono', 'total'] as const;
export type FoilMotion = (typeof FOIL_MOTIONS)[number];

/** Tiempos del movimiento: segundos por ciclo según `shimmer` (0–100; alto =
 *  rápido): sec = baseSec − (shimmer/100)·spanSec. La deriva usa el MISMO mapeo
 *  que el vaivén de rejilla clásico (continuidad visual). */
export const FOIL_MOTION_TIMING = {
  sweep: { baseSec: 5.5, spanSec: 3.5 },  // 5.5s (shimmer 0) → 2.0s (100)
  hue:   { baseSec: 14,  spanSec: 10 },   // 14s → 4s por vuelta completa de matiz
} as const;

/** Flags de render derivados del param `motion` (tolerante a valores raros). */
export function foilMotionFlags(motion: unknown): { drift: boolean; hueCycle: boolean } {
  const m = String(motion ?? 'auto');
  return { drift: m === 'deriva' || m === 'total', hueCycle: m === 'tono' || m === 'total' };
}

/** Segundos del ciclo de deriva (barrido) para un `shimmer` 0–100. */
export function foilMotionSweepSec(shimmer: number): number {
  const s = Math.min(1, Math.max(0, (Number.isFinite(shimmer) ? shimmer : 50) / 100));
  return +(FOIL_MOTION_TIMING.sweep.baseSec - s * FOIL_MOTION_TIMING.sweep.spanSec).toFixed(2);
}

/** Segundos de la vuelta completa del ciclo de tono para un `shimmer` 0–100. */
export function foilMotionHueSec(shimmer: number): number {
  const s = Math.min(1, Math.max(0, (Number.isFinite(shimmer) ? shimmer : 50) / 100));
  return +(FOIL_MOTION_TIMING.hue.baseSec - s * FOIL_MOTION_TIMING.hue.spanSec).toFixed(2);
}

/** Valores del param `mask_sparkle` (contrato). */
export const FOIL_MASK_SPARKLES = ['no', 'pastel', 'vivo'] as const;

/** KRO-256 — DESTELLOS de la máscara: un campo multicolor de grano fino se
 *  pinta TRAS la máscara (misma máscara/layout que el foil) y su matiz cicla en
 *  continuo (`foilMotionHueSec`) → cada perforación muestra SU color, distinto
 *  del vecino, y todos van rotando (look "cosmos"). El campo reusa la paleta
 *  'spectrum' girada `angleOffsetDeg` sobre su ángulo nativo (cruza la lámina)
 *  con `sizePct` pequeño (vecinos ⇒ colores distintos). */
export const FOIL_MASK_SPARKLE = {
  sizePct: 46,
  angleOffsetDeg: -30,
  variants: {
    pastel: { opacity: 0.7, saturate: 0.85 },
    vivo:   { opacity: 1,   saturate: 1.6 },
  },
} as const;

/** Valores del param `border_sheen` (contrato). */
export const FOIL_BORDER_SHEENS = ['no', 'metalico', 'iridiscente'] as const;

/** KRO-256 — BRILLO del marco: banda especular que barre el marco en continuo,
 *  como capa APARTE encima del fill (mismo borderSVG como máscara) → "borde
 *  metálico por capas". 'metalico' = esta banda blanca; 'iridiscente' = la banda
 *  usa la paleta spectrum. Duración = `foilMotionSweepSec(shimmer)`. */
export const FOIL_BORDER_SHEEN = {
  angleDeg: 100,
  /** Banda blanca especular: stops alpha 0→0.85→0 concentrados al centro. */
  stops: [
    { alpha: 0, pos: 0 },
    { alpha: 0, pos: 35 },
    { alpha: 0.85, pos: 50 },
    { alpha: 0, pos: 65 },
    { alpha: 0, pos: 100 },
  ],
  /** background-size del barrido (%) — mismo recorrido que kr-holo-sweep. */
  sizePct: 250,
} as const;

/** Host WEB: gradiente CSS de la banda especular del brillo del marco. */
export function foilBorderSheenCss(): string {
  const stops = FOIL_BORDER_SHEEN.stops.map(s => `rgba(255,255,255,${s.alpha}) ${s.pos}%`);
  return `linear-gradient(${FOIL_BORDER_SHEEN.angleDeg}deg,${stops.join(',')})`;
}

/** KRO-244 UX — preset DE FÁBRICA del editor de efectos: un clic siembra el
 *  config completo; los sliders quedan como afinado opcional (anti-saturación:
 *  la mayoría de publishers no debería tocar 12 sliders). Editor-only (no
 *  render, no contrato). */
export interface EffectFactoryPreset {
  id:   string;
  /** Nombre del chip en el editor. */
  name: string;
  /** Tooltip: qué look produce. */
  hint: string;
  /** Config completo que siembra (lo no listado cae a los defaults del efecto). */
  config: Record<string, string | number>;
}

/** Presets de fábrica por id de efecto — hoy solo el iridiscente los tiene.
 *  (Las PLANTILLAS del publisher, album-scoped, son otra cosa: KRO-202.) */
export const EFFECT_FACTORY_PRESETS: Record<string, EffectFactoryPreset[]> = {
  iridescent_foil: [
    { id: 'espectro-clasico', name: 'Espectro clásico',
      hint: 'El arcoíris de siempre, a valores de fábrica.',
      config: { pattern: 'spectrum' } },
    { id: 'lamina-real', name: 'Lámina real',
      hint: 'Difracción orgánica curvada, como una lámina holográfica física.',
      config: { pattern: 'spectrum', geometry: 'organico', warp: 60, opacity: 80, sheen: 30, noise: 24 } },
    { id: 'joya-oscura', name: 'Joya oscura',
      hint: 'Medianoche profunda con marco doble en acero (passe-partout).',
      config: { pattern: 'midnight', opacity: 62, scale: 262, border_style: 'double', border_fill: 'marco', border_width: 8, border_color: 'steel' } },
    { id: 'atardecer-dorado', name: 'Atardecer dorado',
      hint: 'Cálido coral y ámbar con marco clásico dorado.',
      config: { pattern: 'sunset', opacity: 60, border_style: 'classic', border_fill: 'hueco', border_width: 8, border_color: 'gold' } },
  ],
};
