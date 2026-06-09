'use client';
/**
 * HeroHeader — cabecera rica del hero protagónico (KRO-133), COMPARTIDA por
 * `HeroProtagonicoRecipe` y el componente prefabricado `hero_header` del motor de
 * bloques. Así la versión "diseño por bloques" del detalle reproduce EXACTAMENTE
 * la cabecera de la receta — cosa que NO se puede expresar con slots sueltos:
 *   - banner degradado de placeholder (hue del título) cuando no hay imagen,
 *   - avatar circular con la INICIAL derivada del TÍTULO (lógica cruzada),
 *   - solape avatar/banner (margen negativo).
 * Una sola fuente de verdad → la receta y el bloque no pueden divergir.
 *
 *   ┌───────────────────────┐
 *   │  banner (16:9 o grad.) │
 *   │        ╭───────╮       │  ← avatar circular superpuesto (-mt-12);
 *   │        │   F   │       │     inicial del título si no hay foto
 *   │        ╰───────╯       │
 *   │      Título grande     │  ← centrado
 *   │      subtítulo         │
 *   └───────────────────────┘
 */
import { cn } from '../lib/cn';
import { simpleHash } from '../lib/hash';
import {
  AvatarBox, BannerBox, ComposableSlot, ScalarText, resolveSlot,
  appearancePaddingClass, appearanceTextClasses, appearanceTruncateClass, slotDebugAttrs,
  type FieldDefLike,
} from '../recipe-utils';
import type { ViewComposition } from '@kromia/core';

export interface HeroHeaderProps {
  composition: Pick<ViewComposition, 'slots'>;
  item:        Record<string, any>;
  fieldDefs:   FieldDefLike[];
  className?:  string;
}

export function HeroHeader({ composition, item, fieldDefs, className }: HeroHeaderProps) {
  const banner   = resolveSlot(composition, 'banner',   fieldDefs, item);
  const avatar   = resolveSlot(composition, 'avatar',   fieldDefs, item);
  const title    = resolveSlot(composition, 'title',    fieldDefs, item);
  const subtitle = resolveSlot(composition, 'subtitle', fieldDefs, item);

  const bannerUrl  = banner?.fields[0]?.value as string | undefined;
  const avatarUrl  = avatar?.fields[0]?.value as string | undefined;
  const titleField = title?.fields[0];
  const titleText  = String(titleField?.value ?? '');

  return (
    <div className={className}>
      {/* Banner — full-width 16:9. Sin URL → gradient brand (hue del título) con
          patrón abstracto de círculos, como el mockup del diseñador. */}
      {bannerUrl
        ? <span {...slotDebugAttrs('banner', banner)} className="block">
            <BannerBox url={bannerUrl} alt="" className="rounded-none" appearance={banner?.appearance} />
          </span>
        : <GradientBanner seed={titleText} />}

      {/* Avatar (solapado -mt-12) + título + subtítulo, centrados. El avatar saca
          la inicial del TÍTULO cuando no hay foto (AvatarBox con alt=titleText). */}
      <div className="px-5 -mt-12 relative">
        <div className="flex flex-col items-center">
          <div className={appearancePaddingClass(avatar?.appearance)} {...slotDebugAttrs('avatar', avatar)}>
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
      </div>
    </div>
  );
}

/**
 * Banner gradient fallback cuando no hay imagen real (movido de
 * HeroProtagonicoRecipe). Color principal derivado del hash del título → cada
 * item con un color estable; patrón abstracto de círculos overlay para textura.
 */
export function GradientBanner({ seed }: { seed: string }) {
  const hue = simpleHash(seed) % 360;
  const start = `hsl(${hue}, 65%, 42%)`;
  const end   = `hsl(${(hue + 20) % 360}, 70%, 32%)`;
  return (
    <div
      className="w-full aspect-[16/9] relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${start} 0%, ${end} 100%)` }}
      aria-hidden
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice">
        <circle cx="170" cy="20" r="35" fill="rgba(255,255,255,0.10)" />
        <circle cx="40"  cy="80" r="50" fill="rgba(255,255,255,0.06)" />
        <circle cx="140" cy="70" r="20" fill="rgba(255,255,255,0.08)" />
      </svg>
    </div>
  );
}
