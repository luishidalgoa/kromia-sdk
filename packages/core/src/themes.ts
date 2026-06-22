/**
 * KRO-198 — THEME_PRESETS: "acabados de marca" aplicables de un click.
 *
 * Un acabado RE-COLOREA toda una composición de forma coordinada y LEGIBLE por
 * construcción (fondo "papel" + color de texto que contrasta + acento para los
 * badges), sin tocar la ESTRUCTURA (campos, layout, tamaños, pesos, alineación).
 * Resuelve el "blank-canvas cromático": el publisher no-técnico no tiene que
 * recolorear slot a slot — que es justo donde nace el riesgo de contraste.
 *
 * Cada par de color usa tonos CRUDOS de la rejilla con contraste WCAG ≥ AA
 * (verificado en themes.test.ts con `paletteContrastRatio`), así que aplicar un
 * acabado NUNCA dispara el aviso de contraste del editor.
 *
 * FUERA del contrato KRP a propósito (mismo criterio que LAYOUT_TEMPLATES /
 * SECTION_ICONS): el acabado se consume en EDICIÓN para sembrar `appearance` y
 * `layout.surface`, que es lo que se persiste y lo que Flutter renderiza. La app
 * no necesita el catálogo para pintar — solo si algún día edita.
 */
import type { ContainerSurface, SlotAppearance, ViewComposition } from './types';

export interface ThemePreset {
  /** Id estable (contrato cross-language si la app edita). */
  id:          string;
  label:       string;
  description: string;
  /** Fondo "papel" del contenedor raíz (id de la paleta). */
  paperBg?:    string;
  /** Borde/radius/sombra opcionales del contenedor raíz (merge sobre el actual). */
  surface?:    Partial<ContainerSurface>;
  /** Color de texto base aplicado a TODOS los slots (las imágenes lo ignoran). */
  textColor?:  string;
  /** Familia tipográfica base. */
  font?:       'sans' | 'serif';
  /** Acento de los slots mostrados como `badge` (pastilla de rareza/tipo). */
  accent?:     { bgColor: string; textColor: string };
}

/**
 * Catálogo de acabados. Los pares paper↔text y accent.bg↔accent.text están
 * elegidos para pasar contraste AA (ver themes.test.ts). El editor los nombra
 * "Acabado" — distinto de "Tema" (modo claro/oscuro) y "Color" (por slot).
 */
export const THEME_PRESETS: ReadonlyArray<ThemePreset> = [
  {
    id: 'oro', label: 'Cromo oro',
    description: 'Fondo grafito, texto dorado claro y acento oro. Premium y cálido.',
    paperBg: 'slate-800', textColor: 'amber-200',
    accent: { bgColor: 'amber-400', textColor: 'slate-800' },
    surface: { radius: 'lg' },
  },
  {
    id: 'editorial', label: 'Editorial',
    description: 'Papel claro, texto grafito y tipografía serif. Sobrio, de revista.',
    paperBg: 'slate-200', textColor: 'slate-800', font: 'serif',
    accent: { bgColor: 'slate-800', textColor: 'slate-200' },
    surface: { radius: 'sm' },
  },
  {
    id: 'neon', label: 'Neón',
    description: 'Fondo grafito, texto cian y acento rosa. Vibrante, estilo gamer.',
    paperBg: 'slate-800', textColor: 'sky-200',
    accent: { bgColor: 'pink-200', textColor: 'slate-800' },
    surface: { radius: 'lg' },
  },
  {
    id: 'bosque', label: 'Bosque',
    description: 'Fondo verde profundo, texto menta y acento ámbar. Natural.',
    paperBg: 'emerald-800', textColor: 'emerald-200',
    accent: { bgColor: 'amber-400', textColor: 'emerald-800' },
    surface: { radius: 'lg' },
  },
];

/** Busca un acabado por id (o undefined). */
export function getThemePreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find(t => t.id === id);
}

/**
 * Aplica un acabado a una composición y devuelve una NUEVA (pura, no muta).
 * Semántica: el acabado MANDA sobre los colores (textColor/bgColor de badges,
 * font, fondo del contenedor raíz) — recolorea — pero PRESERVA todo lo demás
 * (campos, layout, tamaños, pesos, alineación, truncado…). Es reversible con el
 * undo del editor. Sin match → devuelve la composición sin cambios.
 */
export function applyThemePreset(composition: ViewComposition, themeId: string): ViewComposition {
  const theme = getThemePreset(themeId);
  if (!theme) return composition;

  const slots: ViewComposition['slots'] = {};
  for (const [id, sc] of Object.entries(composition.slots ?? {})) {
    const ap: SlotAppearance = { ...(sc.appearance ?? {}) };
    if (theme.textColor) ap.textColor = theme.textColor;
    if (theme.font)      ap.font = theme.font;
    // Un slot mostrado como badge (rareza/tipo) recibe el acento coordinado.
    if (ap.display === 'badge' && theme.accent) {
      ap.bgColor   = theme.accent.bgColor;
      ap.textColor = theme.accent.textColor;
    }
    slots[id] = { ...sc, appearance: ap };
  }

  let layout = composition.layout;
  if (layout && (theme.paperBg || theme.surface)) {
    layout = {
      ...layout,
      surface: {
        ...(layout.surface ?? {}),
        ...(theme.paperBg ? { bgColor: theme.paperBg } : {}),
        ...(theme.surface ?? {}),
      },
    };
  }

  return { ...composition, slots, layout };
}
