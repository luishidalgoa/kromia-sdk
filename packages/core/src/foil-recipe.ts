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

/** Host WEB (Studio): construye el string CSS del gradiente de un pattern. Flutter
 *  NO usa esto — construye su gradiente nativo desde `FOIL_PATTERNS[pattern]`. */
export function foilPatternCss(pattern: string): string {
  const p = FOIL_PATTERNS[pattern] ?? FOIL_PATTERNS.spectrum;
  if (p.kind === 'conic') return `conic-gradient(from ${p.fromDeg}deg,${p.colors.join(',')})`;
  return `repeating-linear-gradient(${p.angleDeg}deg,${p.stops.map(s => `${s.color} ${s.pos}%`).join(',')})`;
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
