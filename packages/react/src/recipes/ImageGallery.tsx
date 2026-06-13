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
 * Mobile-first. Espejo Flutter pendiente (KRO-83).
 */
import type { CSSProperties } from 'react';
import { isMockupImage } from '@kromia/core';
import { cn } from '../lib/cn';
import { MockupImageSkeleton } from '../recipe-utils';

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

export function ImageGallery({ urls, variant = 'peek', imgStyle, label, className }: ImageGalleryProps) {
  const clean = (urls ?? []).filter((u): u is string => typeof u === 'string' && u.trim() !== '');
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
          <div key={i} className="aspect-square rounded-lg bg-muted overflow-hidden">
            {isMockupImage(url) ? <MockupImageSkeleton /> :
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" style={imgStyle} className="w-full h-full object-cover" />}
          </div>
        ))}
        {gridOverflow > 0 && (
          <div className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/40 flex items-center justify-center">
            <span className="text-sm font-bold text-muted-foreground">+{gridOverflow}</span>
          </div>
        )}
      </div>
    )
    : (
      <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1">
        {clean.map((url, i) => (
          <div
            key={i}
            className={variant === 'centered'
              ? 'snap-center shrink-0 w-64 aspect-[4/3] rounded-lg bg-muted overflow-hidden'
              : 'snap-start shrink-0 aspect-[4/3] rounded-lg bg-muted overflow-hidden'}
            style={variant === 'peek' ? { width: '70%' } : undefined}
          >
            {isMockupImage(url) ? <MockupImageSkeleton /> :
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" style={imgStyle} className="w-full h-full object-cover" />}
          </div>
        ))}
      </div>
    );

  return <div className={className}>{labelEl}{inner}</div>;
}
