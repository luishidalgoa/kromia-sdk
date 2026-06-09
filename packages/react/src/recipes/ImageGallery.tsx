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
import { cn } from '../lib/cn';

export type ImageGalleryVariant = 'peek' | 'centered' | 'grid';

export interface ImageGalleryProps {
  /** URLs de las imágenes (se filtran las vacías/no-string). */
  urls:      Array<string | null | undefined>;
  variant?:  ImageGalleryVariant;
  /** Estilo opcional por <img> (p.ej. object-position de un focus de apariencia). */
  imgStyle?: CSSProperties;
  className?: string;
}

export function ImageGallery({ urls, variant = 'peek', imgStyle, className }: ImageGalleryProps) {
  const clean = (urls ?? []).filter((u): u is string => typeof u === 'string' && u.trim() !== '');
  if (clean.length === 0) return null;

  if (variant === 'grid') {
    return (
      <div className={cn('grid grid-cols-3 gap-2', className)}>
        {clean.slice(0, 6).map((url, i) => (
          <div key={i} className="aspect-square rounded-lg bg-muted overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" style={imgStyle} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    );
  }

  // peek | centered → carrusel horizontal scroll-snap.
  const itemClass = variant === 'centered'
    ? 'snap-center shrink-0 w-64 aspect-[4/3] rounded-lg bg-muted overflow-hidden'
    : 'snap-start shrink-0 aspect-[4/3] rounded-lg bg-muted overflow-hidden';
  const itemStyle: CSSProperties | undefined = variant === 'peek' ? { width: '70%' } : undefined;

  return (
    <div className={cn('flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1', className)}>
      {clean.map((url, i) => (
        <div key={i} className={itemClass} style={itemStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" style={imgStyle} className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  );
}
