'use client';
/**
 * RefGallery — "componente carta" compartido (KRO-133 Capa 1).
 *
 * Render rico de un slot de REFERENCIAS (`cardRef`/`sectionRef`; valor único o
 * lista vía behavior `card_index_list`/`card_code_list`): una rejilla de
 * mini-cartas. Antes vivía forjado dentro de `HeroProtagonicoRecipe`; ahora es
 * compartido para que el MOTOR DE BLOQUES (`LayoutRenderer`/`SlotContent`) pinte
 * estos slots IGUAL que la receta, en vez de caer a texto crudo ("[6]").
 *
 *   ┌─────────┐
 *   │ 012     │  ← número padded top-left (overlay sobre la "imagen")
 *   │ ▓▓▓▓▓▓▓ │  ← imagen full-bleed (degradado en preview, foto real con
 *   │ ▓▓▓▓▓▓▓ │     data real cuando llegue Flutter)
 *   └─────────┘
 *
 * `nestedComposition` presente → cada ref se pinta con su mini-receta
 * (`NestedRecipeRenderer`). Si no, rejilla de mini-cartas placeholder
 * (`MiniCardRefs`). El nº de columnas y el aspect derivan del `cardFormat` del
 * álbum vía `miniRefGridColumns` (KRO-78) — una sola fuente de verdad.
 */
import { cn } from '../lib/cn';
import { simpleHash } from '../lib/hash';
import {
  aspectToRatio, DEFAULT_CARD_FORMAT, miniRefGridColumns,
  type CardFormat, type NestedViewComposition,
} from '@kromia/core';
import { NestedRecipeRenderer } from './NestedRecipeRenderer';
import type { FieldDefLike } from '../recipe-utils';

export interface RefGalleryProps {
  /** Valor del field de refs: un ref único o un array (lista). */
  refs:               Array<string | number> | string | number | null | undefined;
  /** Seed estable para el color del placeholder (cosmético en preview). */
  seed:               string;
  cardFormat?:        CardFormat;
  /** Si el slot trae mini-receta, cada ref se pinta con ella. */
  nestedComposition?: NestedViewComposition;
  fieldDefs:          FieldDefLike[];
  /**
   * KRO-133 — disposición de las mini-cartas: 'grid' (rejilla, default — el
   * componente `ref_gallery`) o 'carousel' (fila deslizable con swipe — el
   * componente `cards_carousel`). Solo afecta al placeholder de mini-cartas;
   * el render nested mantiene su propia disposición.
   */
  layout?:            'grid' | 'carousel';
  /** KRO-133 — etiqueta opcional encima (fidelidad: el "BESTIAS" del hero). */
  label?:             string;
}

/** Punto de entrada: normaliza el valor a array y despacha nested vs mini-cartas. */
export function RefGallery({ refs, seed, cardFormat, nestedComposition, fieldDefs, layout = 'grid', label }: RefGalleryProps) {
  const list = (Array.isArray(refs) ? refs : refs == null ? [] : [refs])
    .filter((r): r is string | number => r != null && r !== '');
  if (list.length === 0) return null;
  const inner = nestedComposition
    ? <NestedRecipeRenderer refs={list} nestedComposition={nestedComposition} fieldDefs={fieldDefs} />
    : <MiniCardRefs refs={list} seed={seed} cardFormat={cardFormat ?? DEFAULT_CARD_FORMAT} layout={layout} />;
  if (!label) return inner;
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">{label}</p>
      {inner}
    </div>
  );
}

/**
 * Mini-cards de refs relacionadas (cuando no hay nestedComposition).
 *
 * Diseño mockup-fiel: la imagen ocupa la card completa edge-to-edge, con solo
 * el número como overlay arriba a la izquierda (el degradado del hash del seed
 * hace de "foto" en preview). Card central destacada cuando hay ≥2 visibles;
 * "+N" con border dashed para el overflow. Columnas derivadas del `cardFormat`.
 */
export function MiniCardRefs({
  refs, seed, cardFormat, layout = 'grid',
}: {
  refs:       Array<string | number>;
  seed:       string;
  cardFormat: CardFormat;
  layout?:    'grid' | 'carousel';
}) {
  const hue = simpleHash(seed) % 360;
  // Gradient sutil — la card es la imagen full-bleed, no un fondo plano.
  const gradStart   = `hsl(${hue}, 45%, 88%)`;
  const gradEnd     = `hsl(${hue}, 50%, 72%)`;
  const tintFg      = `hsl(${hue}, 55%, 22%)`;  // texto overlay legible sobre el gradient
  const tintAccent  = `hsl(${hue}, 42%, 70%)`;  // border del "+N" placeholder
  const tintHilight = `hsl(${hue}, 55%, 50%)`;  // ring de la card destacada

  // Aspect viene del cardFormat del álbum — coherente con la "Estructura de
  // cartas" del wizard (3:2 horizontal → wider; 1:1 → cuadrada; etc.).
  const ratio = aspectToRatio(cardFormat.aspect);

  // KRO-133 — carrusel: fila deslizable con swipe (cada mini-carta de ancho
  // fijo, snap horizontal), en vez de rejilla. Muestra TODAS las refs (cap a 24
  // por seguridad), sin "+N" (es scrollable). Para el componente cards_carousel.
  if (layout === 'carousel') {
    return (
      <div className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-1">
        {refs.slice(0, 24).map((ref, i) => (
          <div
            key={i}
            className="shrink-0 snap-start rounded-lg overflow-hidden relative"
            style={{
              width: '6rem',
              aspectRatio: ratio,
              background: `linear-gradient(135deg, ${gradStart} 0%, ${gradEnd} 100%)`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <span
              className="absolute top-1.5 left-1.5 text-[10px] font-mono font-bold leading-none"
              style={{ color: tintFg }}
            >
              {String(ref).padStart(3, '0')}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // KRO-78 — columnas derivadas del cardFormat (aspect + size) por el helper
  // puro `miniRefGridColumns` de `@kromia/core`. Clamp 1-6.
  const cols            = miniRefGridColumns(cardFormat);
  const visibleCount    = Math.max(1, cols - 1);  // un slot reservado para "+N"
  const visible         = refs.slice(0, visibleCount);
  const overflow        = refs.length - visible.length;

  // Card central destacada cuando hay ≥2 visibles.
  const highlightIdx = visible.length >= 2 ? Math.floor(visible.length / 2) : -1;

  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {visible.map((ref, i) => {
        const highlighted = i === highlightIdx;
        return (
          <div
            key={i}
            className={cn(
              'rounded-lg overflow-hidden relative',
              'transition-transform',
              highlighted && 'scale-[1.04]',
            )}
            style={{
              aspectRatio: ratio,
              background: `linear-gradient(135deg, ${gradStart} 0%, ${gradEnd} 100%)`,
              boxShadow: highlighted
                ? `0 0 0 1.5px ${tintHilight}, 0 4px 8px rgba(0,0,0,0.10)`
                : '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {/* Número padded en overlay top-left — el resto queda libre como
                "imagen" full-bleed. */}
            <span
              className="absolute top-1.5 left-1.5 text-[10px] font-mono font-bold leading-none"
              style={{ color: tintFg }}
            >
              {String(ref).padStart(3, '0')}
            </span>
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          className="rounded-lg border-2 border-dashed flex items-center justify-center"
          style={{ aspectRatio: ratio, borderColor: tintAccent }}
        >
          <span
            className="text-xs font-bold"
            style={{ color: tintFg, opacity: 0.7 }}
          >
            +{overflow}
          </span>
        </div>
      )}
    </div>
  );
}
