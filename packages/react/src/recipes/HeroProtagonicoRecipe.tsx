'use client';
/**
 * Receta DETALLE `hero_protagonico` — vista hero con banner superior,
 * avatar central destacado, título grande, stats, body markdown, galería
 * y cartas relacionadas. Para vistas hero al abrir un item (e.g. España
 * en la sección Equipos).
 *
 * Slots (ver recipe-registry.ts):
 *   banner    — single, image-banner
 *   avatar    — single, image-avatar
 *   title     — single, text-short
 *   subtitle  — composable horizontal             (opcional)
 *   stats     — composable horizontal (numbers)   (opcional)
 *   body      — single, text-long (markdown)      (opcional)
 *   gallery   — single, image-array               (opcional)
 *   related   — single, card-ref                  (opcional)
 *
 * Layout:
 *   ┌────────────────────────────────────────┐
 *   │ [BANNER 16:9]                          │
 *   │   ╭───────╮                            │
 *   │   │ AVATAR│ ← overlap con banner       │
 *   │   ╰───────╯                            │
 *   │     Título grande                      │
 *   │     subtítulo · compose                │
 *   │   ┌──────────┬──────────┬──────────┐   │
 *   │   │  STAT 1  │  STAT 2  │  STAT 3  │   │
 *   │   └──────────┴──────────┴──────────┘   │
 *   │   Body markdown texto largo...         │
 *   │   [Gallery thumb thumb thumb]          │
 *   │   Relacionadas: #4 #5 #6               │
 *   └────────────────────────────────────────┘
 */

import { cn } from '../lib/cn';
import {
  AvatarBox, BannerBox, ComposableSlot, ScalarText,
  resolveSlot, formatScalar,
  appearancePaddingClass, appearanceTextClasses, appearanceTruncateClass,
  applyAppearanceTruncate, imageFocusStyle, slotDebugAttrs, extractAccentSettings, AccentFrame,
  type FieldDefLike,
} from '../recipe-utils';
import { NestedRecipeRenderer } from './NestedRecipeRenderer';
import { aspectToRatio, DEFAULT_CARD_FORMAT, type CardFormat } from '@kromia/core';
import type { ViewComposition } from '@kromia/core';

export interface HeroProtagonicoRecipeProps {
  composition: ViewComposition;
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  className?:  string;
  /** Formato físico de las cartas del álbum. Las mini-cards del slot
   *  `related` deben respetar este aspect (vertical 2:3, horizontal 3:2,
   *  cuadrada 1:1 o panorámica 16:9) para que el preview sea coherente
   *  con la "Estructura de cartas" que el publisher configuró en el step 1
   *  del wizard. Sin esto, las mini-cards asumen 2:3 default. */
  cardFormat?: CardFormat;
}

export function HeroProtagonicoRecipe({
  composition, item, fieldDefs, className, cardFormat,
}: HeroProtagonicoRecipeProps) {
  const banner   = resolveSlot(composition, 'banner',   fieldDefs, item);
  const avatar   = resolveSlot(composition, 'avatar',   fieldDefs, item);
  const title    = resolveSlot(composition, 'title',    fieldDefs, item);
  const subtitle = resolveSlot(composition, 'subtitle', fieldDefs, item);
  const stats    = resolveSlot(composition, 'stats',    fieldDefs, item);
  const body     = resolveSlot(composition, 'body',     fieldDefs, item);
  const gallery  = resolveSlot(composition, 'gallery',  fieldDefs, item);
  const related  = resolveSlot(composition, 'related',  fieldDefs, item);

  const bannerUrl    = banner?.fields[0]?.value as string | undefined;
  const avatarUrl    = avatar?.fields[0]?.value as string | undefined;
  const titleField   = title?.fields[0];
  const titleText    = String(titleField?.value ?? '');
  const bodyField    = body?.fields[0];
  const galleryUrls  = gallery?.fields[0]?.value as string[] | undefined;
  const relatedRefs  = related?.fields[0]?.value as Array<string | number> | undefined;

  // KRO-54 follow-up²: orden de los body blocks (stats/body/gallery/related)
  // según la POSICIÓN del primer field de cada slot en section.fields.
  // Header (banner/avatar/title/subtitle) siempre arriba — define la
  // identidad de la pantalla. Pero el cuerpo se reordena dinámicamente
  // para que coincida con el orden que el publisher dragueó en "Campos
  // de la sección" (single source of truth).
  //
  // Ejemplo: si el publisher pone `cartas_estrella` (related slot) en
  // posición 3 y `gallery` (gallery slot) en posición 8 dentro de la
  // sección, el render mostrará Cartas estrella ARRIBA de la galería
  // — antes el related slot iba siempre al final por defecto del recipe.
  const orderMap = new Map(fieldDefs.map((d, i) => [d.key, i]));
  const slotOrder = (slot: typeof stats): number => {
    if (!slot) return Number.MAX_SAFE_INTEGER;
    const firstKey = slot.fields[0]?.key;
    return firstKey ? orderMap.get(firstKey) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
  };

  // Lista de body blocks renderizables — cada uno con su index de sección.
  // El primer match en fieldDefs determina la posición en el render.
  const bodyBlocks: Array<{ key: string; order: number; render: () => React.ReactNode }> = [];

  if (stats) {
    bodyBlocks.push({
      key:   'stats',
      order: slotOrder(stats),
      render: () => (
        <div
          className={cn(
            'grid grid-flow-col auto-cols-fr gap-2 border-y border-border py-3',
            appearancePaddingClass(stats.appearance),
            appearanceTextClasses(stats.appearance),
          )}
          {...slotDebugAttrs('stats', stats)}
        >
          {stats.fields.map((f, idx) => (
            <div key={idx} className="text-center min-w-0">
              <p className="text-lg font-bold text-foreground tabular-nums truncate">
                {formatScalar(f.value, f.def)}
              </p>
              {f.def?.label && (
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                  {f.def.label}
                </p>
              )}
            </div>
          ))}
        </div>
      ),
    });
  }

  if (bodyField && body) {
    bodyBlocks.push({
      key:   'body',
      order: slotOrder(body),
      render: () => (
        <div
          className={cn(
            'text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap',
            appearancePaddingClass(body.appearance),
            appearanceTextClasses(body.appearance),
            appearanceTruncateClass(body.appearance),
          )}
          {...slotDebugAttrs('body', body)}
        >
          {applyAppearanceTruncate(String(bodyField.value), body.appearance)}
        </div>
      ),
    });
  }

  if (gallery && galleryUrls && Array.isArray(galleryUrls) && galleryUrls.length > 0) {
    bodyBlocks.push({
      key:   'gallery',
      order: slotOrder(gallery),
      render: () => (
        <div
          className={appearancePaddingClass(gallery.appearance)}
          {...slotDebugAttrs('gallery', gallery)}
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            {gallery.fields[0]?.def?.label ?? 'Galería'}
          </p>
          {/* Carrusel horizontal con snap — fotos más grandes que el grid 3-col
              anterior. Cada foto ~70% del ancho del frame, aspect 4:3 (formato
              foto natural), scroll horizontal con snap-x para una foto a la
              vez. -mx-5 + px-5 para que el carrusel respire hasta los bordes
              del PhoneFrame sin perder el padding del contenido del hero. */}
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2 -mx-5 px-5 scroll-px-5">
            {galleryUrls
              .filter((url): url is string => typeof url === 'string' && url.trim() !== '')
              .map((url, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] rounded-lg bg-muted overflow-hidden shrink-0 snap-start"
                  style={{ width: '70%' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    style={imageFocusStyle(gallery.appearance)}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
          </div>
        </div>
      ),
    });
  }

  if (related && relatedRefs && Array.isArray(relatedRefs) && relatedRefs.length > 0) {
    bodyBlocks.push({
      key:   'related',
      order: slotOrder(related),
      render: () => (
        <div
          className={appearancePaddingClass(related.appearance)}
          {...slotDebugAttrs('related', related)}
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            {related.fields[0]?.def?.label ?? 'Relacionadas'}
          </p>
          {composition.slots.related?.nestedComposition ? (
            <NestedRecipeRenderer
              refs={relatedRefs}
              nestedComposition={composition.slots.related.nestedComposition}
              fieldDefs={fieldDefs}
            />
          ) : (
            <MiniCardRefs
              refs={relatedRefs}
              seed={titleText}
              cardFormat={cardFormat ?? DEFAULT_CARD_FORMAT}
            />
          )}
        </div>
      ),
    });
  }

  // Sort por posición del primer field en section.fields. Ties resueltos
  // por orden de declaración en bodyBlocks (stats < body < gallery <
  // related), comportamiento estable.
  bodyBlocks.sort((a, b) => a.order - b.order);

  // KRO-69 follow-up — accent color via AccentFrame (default 'top').
  const accent = extractAccentSettings(composition, item, fieldDefs, 'top');

  return (
    <AccentFrame accent={accent} width={4}>
    <div
      className={cn(
      // Sin border ni rounded propio: la receta DETAIL es una pantalla
      // completa, no una card. Cuando se renderiza dentro del PhoneFrame
      // del App Preview, el frame ya provee los rounded corners + ring;
      // duplicar aquí creaba un "card dentro de card" visualmente raro.
      // Solo bg-card para fondo, no chrome.
      'bg-card',
      className,
    )}>
      {/* Banner — full-width, aspect 16:9. Si no hay URL, mostramos un
          gradient brand con un patrón abstracto de círculos como en el
          mockup del diseñador (red gradient en España). El hue del
          gradient se deriva del título → cada item tiene un color
          consistente sin necesidad de plumbing de sectionColor. */}
      {bannerUrl
        ? <span {...slotDebugAttrs('banner', banner)} className="block">
            <BannerBox url={bannerUrl} alt="" className="rounded-none" appearance={banner?.appearance} />
          </span>
        : <GradientBanner seed={titleText} />}

      <div className="px-5 pb-5 -mt-12 relative">
        {/* Avatar + Title + Subtitle (HEADER) — siempre en este orden y
            arriba del cuerpo. Define la identidad de la pantalla del item;
            no se reordena con section.fields.
            KRO-69: cada slot pasa su appearance al utility component. */}
        <div className="flex flex-col items-center">
          {/* KRO-69: paddingY del avatar al wrapper. */}
          <div
            className={appearancePaddingClass(avatar?.appearance)}
            {...slotDebugAttrs('avatar', avatar)}
          >
            <AvatarBox
              url={avatarUrl}
              alt={titleText}
              size={96}
              className="ring-4 ring-card shadow-md"
              appearance={avatar?.appearance}
            />
          </div>
          {titleField && (
            <h2
              className={cn(
                'text-2xl font-bold text-foreground mt-3 leading-tight',
                !title?.appearance?.align && 'text-center',
                appearancePaddingClass(title?.appearance),
                appearanceTextClasses(title?.appearance),
                appearanceTruncateClass(title?.appearance),
              )}
              {...slotDebugAttrs('title', title)}
            >
              <ScalarText value={titleField.value} def={titleField.def} appearance={title?.appearance} />
            </h2>
          )}
          {subtitle && (
            <p
              className={cn(
                'text-sm text-muted-foreground mt-1',
                !subtitle.appearance?.align && 'text-center',
                appearancePaddingClass(subtitle.appearance),
                appearanceTextClasses(subtitle.appearance),
                appearanceTruncateClass(subtitle.appearance),
              )}
              {...slotDebugAttrs('subtitle', subtitle)}
            >
              <ComposableSlot slot={subtitle} />
            </p>
          )}
        </div>

        {/* BODY BLOCKS — renderizados en orden de section.fields del primer
            field de cada slot. Si el publisher dragueó cartas_estrella en
            posición 1 y altura_escudo en posición 5, related aparece
            ANTES que stats. */}
        {bodyBlocks.map(b => (
          <div key={b.key} className="mt-5">
            {b.render()}
          </div>
        ))}
      </div>
    </div>
    </AccentFrame>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Banner gradient fallback cuando no hay imagen real. Color principal
 * derivado del hash del título → cada item con un color estable. Patrón
 * abstracto de círculos overlay sutil (5-7% opacity) para textura.
 *
 * Inspirado en el mockup del diseñador: España aparece con un banner rojo
 * con círculos abstractos. Sin imagen real ni configuración de color de
 * sección, derivamos el hue del nombre para tener variedad.
 */
function GradientBanner({ seed }: { seed: string }) {
  const hue = simpleHash(seed) % 360;
  const start = `hsl(${hue}, 65%, 42%)`;
  const end   = `hsl(${(hue + 20) % 360}, 70%, 32%)`;
  return (
    <div
      className="w-full aspect-[16/9] relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${start} 0%, ${end} 100%)` }}
      aria-hidden
    >
      {/* Patrón abstracto: 3 círculos translúcidos en posiciones distintas */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 200 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle cx="170" cy="20" r="35" fill="rgba(255,255,255,0.10)" />
        <circle cx="40"  cy="80" r="50" fill="rgba(255,255,255,0.06)" />
        <circle cx="140" cy="70" r="20" fill="rgba(255,255,255,0.08)" />
      </svg>
    </div>
  );
}

/**
 * Mini-cards de refs relacionadas (cuando no hay nestedComposition).
 *
 * Diseño mockup-fiel: mini-mockup de carta — la imagen ocupa la card
 * completa, edge-to-edge, con solo el número como overlay arriba a la
 * izquierda. NO hay silueta circular interna ni label inferior porque:
 *
 *   - El placeholder visual de "esto es una carta" lo da el degradado
 *     full-bleed que ocupa todo el rectángulo (color tinta del hash
 *     del título) — antes era una silueta circular que rompía la
 *     ilusión de "carta entera con foto".
 *   - El label inferior previo ("REF") no tenía significado real —
 *     era un placeholder mío sin conexión con datos. Eliminado.
 *
 *   ┌─────────┐
 *   │ 012     │  ← número padded top-left (overlay sobre la imagen)
 *   │         │
 *   │ ▓▓▓▓▓▓▓ │  ← imagen full-bleed (degradado en preview, foto real
 *   │ ▓▓▓▓▓▓▓ │     cuando llegue Flutter con data real)
 *   │ ▓▓▓▓▓▓▓ │
 *   └─────────┘
 *
 * Aspect 3:4, card central destacada con ring + scale + shadow, "+N"
 * con border dashed para el overflow. Pattern visual mockup-fiel.
 *
 * CONFIGURACIÓN futura (no implementada — diferida a KRO-58 V5 slots
 * customizables): layout grid|carousel + columns N. Hoy: grid de 4
 * columnas hardcoded.
 */
function MiniCardRefs({
  refs, seed, cardFormat,
}: {
  refs:       Array<string | number>;
  seed:       string;
  cardFormat: CardFormat;
}) {
  const hue = simpleHash(seed) % 360;
  // Gradient sutil — la card es la imagen full-bleed, no un fondo plano.
  // Hue derivado del hash del título da color consistente por item.
  const gradStart   = `hsl(${hue}, 45%, 88%)`;
  const gradEnd     = `hsl(${hue}, 50%, 72%)`;
  const tintFg      = `hsl(${hue}, 55%, 22%)`;  // texto overlay legible sobre el gradient
  const tintAccent  = `hsl(${hue}, 42%, 70%)`;  // border del "+N" placeholder
  const tintHilight = `hsl(${hue}, 55%, 50%)`;  // ring de la card destacada

  // Aspect viene del cardFormat del álbum — coherente con la "Estructura
  // de cartas" del wizard. Si el publisher eligió 3:2 (horizontal estilo
  // Topps baseball), las mini-cards serán wider que tall; si 1:1 cuadrada,
  // serán cuadradas; etc.
  const ratio = aspectToRatio(cardFormat.aspect);

  // Columnas según ASPECT + SIZE del cardFormat:
  //
  // Iteración 2 (post review): los step-jumps anteriores (1.4/1.0/0.8/0.5
  // con baseCols=4) daban diferencias muy sutiles entre standard y large
  // (4 vs 3 cols), y standard parecía "mini" en el viewport reducido del
  // PhoneFrame. Bajamos baseCols + multiplicadores más agresivos → cada
  // tamaño una columna menos que el anterior. Diferencia perceptible.
  //
  // Matriz final (clamp 1-6):
  //              mini   standard   large   poster
  //   2:3 / 1:1  4 col  3 col      2 col   1 col
  //   3:2 / 16:9 3 col  2 col      1 col   1 col
  //
  // El publisher entiende intuitivamente: poster → carta enorme dominante;
  // mini → 4 cards apretadas por fila; standard → 3 cards cómodas.
  const isWide          = ratio > 1.2;
  const baseCols        = isWide ? 2 : 3;
  const sizeMultiplier  = SIZE_COLS_MULTIPLIER[cardFormat.size] ?? 1;
  const cols            = Math.max(1, Math.min(6, Math.round(baseCols * sizeMultiplier)));
  const visibleCount    = Math.max(1, cols - 1);  // un slot reservado para "+N"
  const visible         = refs.slice(0, visibleCount);
  const overflow        = refs.length - visible.length;

  // Card central destacada cuando hay ≥2 visibles. Con cols=2 (1 card +
  // "+N") no aplica.
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
            {/* Número padded en overlay top-left — el resto de la card
                queda libre como "imagen" full-bleed. */}
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

/** Hash determinista barato para derivar colores del título. */
function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Multiplicador de columnas para mini-cards según el tamaño físico del
 * cardFormat. Cards más grandes ocupan más → menos columnas por fila.
 *
 * Iteración 2 (post review user "el grande se ve como un estandar y un
 * estandar como un mini"): bajamos baseCols a 3 y multiplicadores más
 * agresivos para que la diferencia entre tamaños sea perceptible. Cada
 * tier salta una columna menos.
 *
 * Con baseCols=3 (vertical/cuadrada):
 *   mini × 1.3  ≈ 4 cols  (cards pequeñas, 4 visibles + "+N")
 *   standard ×1 = 3 cols  (base)
 *   large × 0.7 ≈ 2 cols  (cards grandes, 1 visible + "+N")
 *   poster × 0.4 ≈ 1 col  (carta enorme, dominante)
 *
 * Con baseCols=2 (horizontal/panorámica):
 *   mini × 1.3  ≈ 3 cols
 *   standard ×1 = 2 cols
 *   large × 0.7 ≈ 1 col
 *   poster × 0.4 ≈ 1 col (clamp)
 */
const SIZE_COLS_MULTIPLIER: Record<import('@kromia/core').CardSize, number> = {
  mini:     1.3,
  standard: 1.0,
  large:    0.7,
  poster:   0.4,
};
