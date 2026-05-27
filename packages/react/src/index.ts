/**
 * `@kromia/react` — API pública del package React del SDK Kromia.
 *
 * Contiene los renderers que un cliente React (Studio, herramientas internas
 * con React) consume como Legos para componer pantallas. La lógica del modelo
 * vive en `@kromia/core` — este package solo aporta el JSX + clases CSS.
 *
 * Reglas:
 *  - Tailwind como peer dependency (las clases CSS asumen Tailwind v3+).
 *  - React 19 como peer dep.
 *  - lucide-react para iconos.
 *  - NO bundlear — exporta `.tsx` source. Los consumers (Next.js) usan
 *    `transpilePackages` para procesarlo.
 *
 * Patrón complementario:
 *  - `@kromia/flutter` (futuro, KRO-83) = mismos widgets en Dart.
 */

// ── Utilities + helpers + re-exports SDK core (recipe-utils) ──────────
export {
  // Component utilities
  AvatarBox,
  InitialsAvatar,
  ScalarText,
  ComposableSlot,
  StatusDot,
  ThumbBox,
  BannerBox,
  BadgePill,
  AccentFrame,
  // Helpers (no-JSX)
  resolveSlot,
  appearanceShapeClass,
  appearanceAspectClass,
  appearanceTextClasses,
  appearancePaddingClass,
  appearanceTruncateClass,
  appearanceSizePx,
  applyAppearanceTruncate,
  isEmpty,
  buildAccentBorderStyle,
  extractAccentColor,
  slotDebugAttrs,
  imageFocusStyle,
  // SDK core re-exports
  formatScalar,
  extractAccentSettings,
  // Types
  type FieldDefLike,
  type AccentSettings,
  type ResolvedSlot,
} from './recipe-utils';

// ── Recipes ────────────────────────────────────────────────────────────
// TODO KRO-82.3: añadir cuando migren los 8 recipes + 2 dispatchers.
