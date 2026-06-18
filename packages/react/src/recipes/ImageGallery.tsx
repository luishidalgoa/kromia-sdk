'use client';
/**
 * ImageGallery — renderer COMPARTIDO de una galería/carrusel de imágenes
 * (KRO-133). Extrae el markup que las recetas Hero protagónico / Momento /
 * Editorial tenían inline y duplicado, para que los COMPONENTES de bloque
 * (`carousel_peek` / `carousel_centered` / `gallery_grid`) lo reutilicen.
 *
 * Variantes (mismo CSS scroll-snap que las recetas, sin JS):
 *   · peek      → swipe horizontal, cada imagen ~70% del ancho, asoma la
 *                 siguiente (estilo "Hero protagónico").
 *   · centered  → swipe horizontal, tarjetas centradas de ancho fijo (w-64)
 *                 (estilo "Momento").
 *   · grid      → mosaico en rejilla de 3 columnas, hasta 6 (estilo "Editorial").
 *
 * ZOOM (KRO-133): si hay un `ImageZoomProvider` arriba (`useImageZoom`), cada
 * imagen REAL pasa a ser tappable → abre el visor a pantalla completa
 * (`ImageZoomOverlay`) con pinch/pan/swipe. Sin provider, la galería se mantiene
 * estática (backward-compat). El host monta el visor donde toca (in-frame en
 * Studio). Mobile-first. Espejo Flutter pendiente (KRO-83).
 */
import { useRef, useState, type CSSProperties } from 'react';
import { ZoomIn } from 'lucide-react';
import { isMockupImage } from '@kromia/core';
import { cn } from '../lib/cn';
import { MockupImageSkeleton } from '../recipe-utils';
import { useImageZoom } from './ImageZoomContext';

export type ImageGalleryVariant = 'peek' | 'centered' | 'grid';

export interface ImageGalleryProps {
  /** URLs de las imágenes (se filtran las vacías/no-string). */
  urls:      Array<string | null | undefined>;
  variant?:  ImageGalleryVariant;
  /** Estilo opcional por <img> (p.ej. object-position de un focus de apariencia). */
  imgStyle?: CSSProperties;
  /** Etiqueta opcional encima (KRO-133 — fidelidad: las recetas pintan el label
   *  del campo, p.ej. "GALERÍA"). Mismo markup que Editorial/Hero. */
  label?:    string;
  className?: string;
}

/** Celda de imagen: skeleton para mockups; `<button>` ampliable (cursor-zoom-in
 *  + hint al hover) cuando hay host de zoom y la imagen es REAL; si no, `<div>`
 *  estático. La caja recorta (overflow-hidden) → el overlay de hover queda dentro. */
function GalleryCell({
  url, boxClass, style, imgStyle, onZoom,
}: {
  url:       string;
  boxClass:  string;
  style?:    CSSProperties;
  imgStyle?: CSSProperties;
  onZoom?:   () => void;
}) {
  const mockup = isMockupImage(url);
  const media = mockup
    ? <MockupImageSkeleton />
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={url} alt="" style={imgStyle} className="w-full h-full object-cover" />;

  // Tappable cuando hay host de zoom (incluye los mockups: en el preview del
  // wizard las imágenes son sintéticas y aún así el publisher debe poder
  // DESCUBRIR y probar el gesto; el visor las muestra como "imagen de ejemplo").
  if (onZoom) {
    return (
      <button type="button" onClick={onZoom} title="Ampliar imagen" className={cn(boxClass, 'group relative cursor-zoom-in')} style={style}>
        {media}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/0 group-hover:bg-black/20 transition-all">
          <ZoomIn className="h-5 w-5 text-white drop-shadow" />
        </span>
      </button>
    );
  }
  return <div className={boxClass} style={style}>{media}</div>;
}

export function ImageGallery({ urls, variant = 'peek', imgStyle, label, className }: ImageGalleryProps) {
  // KRO-155 — dots de posición en los carruseles (peek/centered): el índice
  // activo se deriva del scroll (stride medio = scrollWidth / nº slides), así un
  // carrusel con una slide visible deja de parecer estático. Los hooks van ANTES
  // del early-return para respetar las reglas de hooks.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // KRO-133 — opener del visor de zoom (null si no hay host → galería estática).
  const openZoom = useImageZoom();
  const clean = (urls ?? []).filter((u): u is string => typeof u === 'string' && u.trim() !== '');
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || clean.length < 2) return;
    const stride = el.scrollWidth / clean.length;
    setActive(Math.max(0, Math.min(clean.length - 1, Math.round(el.scrollLeft / stride))));
  };
  if (clean.length === 0) return null;

  const labelEl = label
    ? <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">{label}</p>
    : null;

  // KRO-155 — coherencia con MiniCardRefs (RefGallery): el grid mostraba 6 y
  // DESCARTABA el resto en silencio. Si hay más de 6, mostramos 5 + una celda
  // "+N" para comunicar que el contenido no se perdió. Los carruseles (peek/
  // centered) ya muestran todo deslizando, no necesitan el indicador.
  const gridOverflow = variant === 'grid' && clean.length > 6 ? clean.length - 5 : 0;
  const gridShown    = gridOverflow > 0 ? clean.slice(0, 5) : clean.slice(0, 6);

  const inner = variant === 'grid'
    ? (
      <div className="grid grid-cols-3 gap-2">
        {gridShown.map((url, i) => (
          <GalleryCell
            key={i}
            url={url}
            boxClass="aspect-square rounded-lg bg-muted overflow-hidden"
            imgStyle={imgStyle}
            onZoom={openZoom ? () => openZoom(clean, i) : undefined}
          />
        ))}
        {gridOverflow > 0 && (
          openZoom ? (
            <button
              type="button"
              onClick={() => openZoom(clean, gridShown.length)}
              title="Ver todas"
              className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/40 flex items-center justify-center cursor-zoom-in hover:bg-muted/60 transition-colors"
            >
              <span className="text-sm font-bold text-muted-foreground">+{gridOverflow}</span>
            </button>
          ) : (
            <div className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/40 flex items-center justify-center">
              <span className="text-sm font-bold text-muted-foreground">+{gridOverflow}</span>
            </div>
          )
        )}
      </div>
    )
    : (
      <>
        <div ref={scrollRef} onScroll={onScroll} className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1">
          {clean.map((url, i) => (
            <GalleryCell
              key={i}
              url={url}
              boxClass={variant === 'centered'
                ? 'snap-center shrink-0 w-64 aspect-[4/3] rounded-lg bg-muted overflow-hidden'
                : 'snap-start shrink-0 aspect-[4/3] rounded-lg bg-muted overflow-hidden'}
              style={variant === 'peek' ? { width: '70%' } : undefined}
              imgStyle={imgStyle}
              onZoom={openZoom ? () => openZoom(clean, i) : undefined}
            />
          ))}
        </div>
        {/* KRO-155 — dots de posición (solo con ≥2 slides). El activo se ensancha. */}
        {clean.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-1.5" aria-hidden>
            {clean.map((_, i) => (
              <span key={i} className={cn('h-1.5 rounded-full transition-all', i === active ? 'w-4 bg-foreground/60' : 'w-1.5 bg-foreground/25')} />
            ))}
          </div>
        )}
      </>
    );

  return <div className={className}>{labelEl}{inner}</div>;
}
