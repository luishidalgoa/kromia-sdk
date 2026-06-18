'use client';
/**
 * KRO-133 — visor de ZOOM de galería (lightbox). Reutilizable y CONTAINER-FILLING
 * (`absolute inset-0`): el host decide el marco de referencia — in-frame en el
 * AppPreview de Studio (vía el `overlay` del PhoneFrame), a viewport en una app
 * web (envolviéndolo en un contenedor `fixed inset-0`). Espejo Flutter: KRO-83
 * (InteractiveViewer + PageView).
 *
 * Interacciones:
 *   · ZOOM real — rueda del ratón (zoom al cursor) · doble-click/doble-tap (toggle
 *     1× ↔ 2.5× en el punto) · pinch de 2 dedos. Clamp 1×–5×.
 *   · PAN — al estar ampliado (scale>1), arrastrar desplaza (con límites).
 *   · ENTRE IMÁGENES — a escala 1: flechas ←/→ del teclado, chevrons (desktop) o
 *     swipe horizontal. Reinicia el zoom al cambiar.
 *   · CERRAR — botón ✕, tecla Esc, click en el scrim (a escala 1) o swipe-down.
 *
 * `prefers-reduced-motion` → sin transición (saltos directos).
 */
import {
  useCallback, useEffect, useRef, useState,
  type CSSProperties, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent,
} from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { isMockupImage } from '@kromia/core';
import { cn } from '../lib/cn';
import { MockupImageSkeleton } from '../recipe-utils';

export interface ImageZoomOverlayProps {
  /** Lista de urls a mostrar. */
  urls:   string[];
  /** Índice inicial. */
  index:  number;
  onClose: () => void;
  /** Notifica el índice activo (el host puede sincronizar el carrusel de fondo). */
  onIndexChange?: (index: number) => void;
  className?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
/** px de arrastre a escala 1 para disparar cambio de imagen / cierre. */
const SWIPE_THRESHOLD = 60;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

interface Transform { scale: number; x: number; y: number }

export function ImageZoomOverlay({ urls, index, onClose, onIndexChange, className }: ImageZoomOverlayProps) {
  const clean = (urls ?? []).filter((u): u is string => typeof u === 'string' && u.trim() !== '');
  const reduced = usePrefersReducedMotion();

  const [i, setI] = useState(() => clamp(index, 0, Math.max(0, clean.length - 1)));
  const [t, setT] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  // Mientras hay un gesto activo desactivamos la transición CSS (sigue al dedo).
  const [gesturing, setGesturing] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  // Espejo del transform en ref → el listener `wheel` nativo (attached una vez)
  // lee siempre el valor actual sin re-suscribirse.
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);
  // Punteros activos (mouse/touch unificados) para pan + pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  // Estado base al iniciar un gesto (pan o pinch).
  const gesture = useRef<{ t: Transform; dist: number; midX: number; midY: number } | null>(null);
  // Para decidir swipe/cierre a escala 1 (sin desplazar la imagen).
  const tap = useRef<{ x: number; y: number } | null>(null);

  const reset = useCallback(() => setT({ scale: 1, x: 0, y: 0 }), []);
  const go = useCallback((next: number) => {
    if (clean.length === 0) return;
    const n = (next + clean.length) % clean.length;
    setI(n);
    reset();
    onIndexChange?.(n);
  }, [clean.length, reset, onIndexChange]);

  // Límite de desplazamiento para que la imagen ampliada no se vaya de cuadro.
  const clampPan = useCallback((x: number, y: number, scale: number) => {
    const el = frameRef.current;
    if (!el) return { x, y };
    const r = el.getBoundingClientRect();
    const maxX = ((scale - 1) * r.width) / 2;
    const maxY = ((scale - 1) * r.height) / 2;
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }, []);

  // Zoom centrado en un punto (cursor/midpoint): el contenido bajo el foco se
  // mantiene fijo. Origen del transform = centro del marco.
  const zoomTo = useCallback((nextScale: number, focalClientX: number, focalClientY: number) => {
    const el = frameRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const fx = focalClientX - (r.left + r.width / 2);
    const fy = focalClientY - (r.top + r.height / 2);
    setT(prev => {
      const s1 = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      if (s1 === 1) return { scale: 1, x: 0, y: 0 };
      const ratio = s1 / prev.scale;
      const nx = fx - (fx - prev.x) * ratio;
      const ny = fy - (fy - prev.y) * ratio;
      const c = clampPan(nx, ny, s1);
      return { scale: s1, x: c.x, y: c.y };
    });
  }, [clampPan]);

  // Esc / flechas a nivel ventana.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); go(i - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, go, onClose]);

  // Rueda del ratón → zoom al cursor. Listener NATIVO no-pasivo: el `onWheel` de
  // React es passive y `preventDefault()` no surtiría efecto (la página haría
  // scroll en vez de ampliar).
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomTo(tRef.current.scale * factor, e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  if (clean.length === 0) return null;
  const url = clean[i];
  const mockup = isMockupImage(url);

  const onDoubleClick = (e: ReactMouseEvent) => {
    if (mockup) return;
    if (tRef.current.scale > 1) reset();
    else zoomTo(2.5, e.clientX, e.clientY);
  };

  const pts = () => [...pointers.current.values()];
  const dist = () => {
    const p = pts();
    return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  };
  const mid = () => {
    const p = pts();
    if (p.length < 2) return { x: p[0]?.x ?? 0, y: p[0]?.y ?? 0 };
    return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setGesturing(true);
    if (pointers.current.size === 2) {
      const m = mid();
      gesture.current = { t: tRef.current, dist: dist(), midX: m.x, midY: m.y };
      tap.current = null;
    } else {
      gesture.current = { t: tRef.current, dist: 0, midX: e.clientX, midY: e.clientY };
      tap.current = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const base = gesture.current;
    if (!base) return;

    if (pointers.current.size >= 2) {
      // Pinch: escala por ratio de distancia, centrada en el midpoint.
      const d = dist();
      if (base.dist > 0) {
        const m = mid();
        zoomTo(base.t.scale * (d / base.dist), m.x, m.y);
      }
      return;
    }

    if (tRef.current.scale > 1) {
      // Pan al estar ampliado.
      const dx = e.clientX - base.midX;
      const dy = e.clientY - base.midY;
      const c = clampPan(base.t.x + dx, base.t.y + dy, tRef.current.scale);
      setT(prev => ({ ...prev, x: c.x, y: c.y }));
    }
    // A escala 1 NO movemos la imagen: el swipe/cierre se decide en pointerup.
  };

  const endPointer = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setGesturing(false);

    // Swipe / cierre solo a escala 1 y con un único puntero (gesto simple).
    if (tRef.current.scale === 1 && tap.current && pointers.current.size === 0) {
      const dx = e.clientX - tap.current.x;
      const dy = e.clientY - tap.current.y;
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        go(dx < 0 ? i + 1 : i - 1);
      } else if (dy > SWIPE_THRESHOLD && dy > Math.abs(dx)) {
        onClose();  // swipe-down
      }
    }
    // Tras un pinch que volvió cerca de 1×, normaliza.
    if (pointers.current.size === 0 && tRef.current.scale < 1.02 && (tRef.current.x !== 0 || tRef.current.y !== 0)) reset();
    if (pointers.current.size < 2) gesture.current = null;
    tap.current = null;
  };

  const transition = reduced || gesturing ? 'none' : 'transform 0.18s cubic-bezier(0.2,0,0,1)';
  const imgStyle: CSSProperties = {
    transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`,
    transition,
    cursor: t.scale > 1 ? 'grab' : 'zoom-in',
    touchAction: 'none',
  };

  return (
    <div
      ref={frameRef}
      className={cn('absolute inset-0 z-50 flex items-center justify-center select-none', !reduced && 'animate-in fade-in duration-200', className)}
      style={{ background: 'rgba(10,8,6,0.92)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Visor de imagen"
    >
      {/* Scrim tapable (cierra a escala 1) — debajo de la imagen y los controles. */}
      <div className="absolute inset-0" onClick={() => { if (t.scale === 1) onClose(); }} aria-hidden />

      {/* Imagen / skeleton */}
      <div
        className="relative max-w-full max-h-full"
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        {mockup ? (
          <div className="w-72 h-72 max-w-[80vw] max-h-[70vh] rounded-lg overflow-hidden" style={imgStyle}>
            <MockupImageSkeleton />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            draggable={false}
            className="block max-w-[92%] max-h-[82%] mx-auto object-contain rounded-lg shadow-2xl"
            style={imgStyle}
          />
        )}
      </div>

      {/* Cerrar */}
      <button
        type="button"
        onClick={onClose}
        title="Cerrar (Esc)"
        className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/45 text-white hover:bg-black/60 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Contador */}
      {clean.length > 1 && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full bg-black/45 text-white text-[11px] font-medium tabular-nums">
          {i + 1} / {clean.length}
        </div>
      )}
      {/* Hint de zoom (solo a escala 1, imagen real) / nota de imagen sintética */}
      {t.scale === 1 && !mockup && (
        <div className="absolute bottom-9 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 text-white/80 text-[10px] pointer-events-none">
          <ZoomIn className="h-3 w-3" /> Rueda o doble-click para ampliar
        </div>
      )}
      {mockup && (
        <div className="absolute bottom-9 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full bg-black/40 text-white/70 text-[10px] pointer-events-none">
          Imagen de ejemplo (sintética)
        </div>
      )}

      {/* Navegación entre imágenes (desktop) — solo a escala 1. */}
      {clean.length > 1 && t.scale === 1 && (
        <>
          <button
            type="button"
            onClick={() => go(i - 1)}
            title="Anterior (←)"
            className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-black/45 text-white hover:bg-black/60 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(i + 1)}
            title="Siguiente (→)"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-black/45 text-white hover:bg-black/60 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5" aria-hidden>
            {clean.map((_, k) => (
              <span key={k} className={cn('h-1.5 rounded-full transition-all', k === i ? 'w-4 bg-white/90' : 'w-1.5 bg-white/40')} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
