'use client';
/**
 * KRO-133 — contexto de ZOOM de galería de imágenes.
 *
 * `ImageGallery` es una HOJA usada en varias recetas (Hero/Momento/Editorial) y
 * en el motor de bloques (`carousel_peek` / `carousel_centered` / `gallery_grid`).
 * En vez de prop-drillear un callback por todas ellas, el HOST envuelve su subtree
 * en `ImageZoomProvider` y la galería lee el contexto directamente.
 *
 * Misma filosofía que el `onRefTap` del card-ref: el SDK expone la CAPACIDAD
 * (imágenes tappables) y el host decide DÓNDE se monta el visor (`ImageZoomOverlay`)
 * — in-frame en el AppPreview de Studio (vía el `overlay` del PhoneFrame, igual que
 * `CardFocusOverlay`), a viewport en una app web real, o nativo en Flutter (KRO-83).
 *
 * Sin provider → `useImageZoom()` devuelve `null` → la galería se mantiene ESTÁTICA
 * (backward-compat con el comportamiento actual de scroll-snap).
 */
import { createContext, useContext, type ReactNode } from 'react';

/** Abre el visor de zoom con la lista COMPLETA de urls y el índice inicial. */
export type OpenImageZoom = (urls: string[], index: number) => void;

const ImageZoomContext = createContext<OpenImageZoom | null>(null);

export function ImageZoomProvider({
  openZoom, children,
}: {
  openZoom: OpenImageZoom;
  children: ReactNode;
}) {
  return <ImageZoomContext.Provider value={openZoom}>{children}</ImageZoomContext.Provider>;
}

/** Opener del visor de zoom, o `null` si no hay host (galería estática). */
export function useImageZoom(): OpenImageZoom | null {
  return useContext(ImageZoomContext);
}
