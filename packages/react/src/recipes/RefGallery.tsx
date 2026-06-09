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
}

/** Punto de entrada: normaliza el valor a array y despacha nested vs mini-cartas. */
export function RefGallery({ refs, seed, cardFormat, nestedComposition, fieldDefs }: RefGalleryProps) {
  const list = (Array.isArray(refs) ? refs : refs == null ? [] : [refs])
    .filter((r): r is string | number => r != null && r !== '');
  if (list.length === 0) return null;
  if (nestedComposition) {
    return <NestedRecipeRenderer refs={list} nestedComposition={nestedComposition} fieldDefs={fieldDefs} />;
  }
  return <MiniCardRefs refs={list} seed={seed} cardFormat={cardFormat ?? DEFAULT_CARD_FORMAT} />;
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
  refs, seed, cardFormat,
}: {
  refs:       Array<string | number>;
  seed:       string;
  cardFormat: CardFormat;
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
