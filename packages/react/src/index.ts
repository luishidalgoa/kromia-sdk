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
export { CompactAvatarRecipe }        from './recipes/CompactAvatarRecipe';
export { CompactCardRecipe }          from './recipes/CompactCardRecipe';
export { HeroProtagonicoRecipe }      from './recipes/HeroProtagonicoRecipe';
export { RowTextRecipe }              from './recipes/RowTextRecipe';
export { EditorialRecipe }            from './recipes/EditorialRecipe';
export { MomentoRecipe }              from './recipes/MomentoRecipe';
export { AccordionSimpleRecipe }      from './recipes/AccordionSimpleRecipe';
export { AccordionWithActionsRecipe } from './recipes/AccordionWithActionsRecipe';

// ── Dispatchers ────────────────────────────────────────────────────────
export { RecipeRenderer }       from './recipes/RecipeRenderer';
export { NestedRecipeRenderer } from './recipes/NestedRecipeRenderer';
// KRO-133 F2/F3 — motor de render genérico del árbol de layout (grid 2D) +
// render de celda reutilizable por el editor visual de Studio.
export { LayoutRenderer, SlotContent, containerSurfaceClasses, type LayoutRendererProps, type SlotContentProps } from './recipes/LayoutRenderer';
