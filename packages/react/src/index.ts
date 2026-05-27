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
 *
 * KRO-82 — en construcción. Los exports se añaden a medida que se migran
 * los componentes desde `kromia-studio/src/components/album/recipes/`.
 */

// TODO KRO-82: añadir exports a medida que migran:
//   ./recipes/* (8 recipes + dispatcher + nested renderer)
//   ./ui/*     (AvatarBox, InitialsAvatar, ScalarText, ComposableSlot)
//   ./recipe-utils (resolveSlot + appearance Tailwind helpers + buildAccentBorderStyle)

export {};
