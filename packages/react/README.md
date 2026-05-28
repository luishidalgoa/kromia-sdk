# @kromia/react

Renderers React del SDK Kromia. Contiene las **8 recipes** (CompactAvatar, HeroProtagónico, Editorial, …) + utilities (`AvatarBox`, `ScalarText`, `ComposableSlot`, …) que un cliente React monta como Legos para renderizar coleccionables.

La lógica del modelo (validators, registries, format helpers) vive en [`@kromia/core`](../core/). Este paquete solo aporta el **JSX + Tailwind**.

> Patrón complementario futuro: [`@kromia/flutter`](../flutter/) (KRO-83) — mismas recipes en Dart para apps Flutter.

---

## Qué exporta

### Componentes principales (dispatchers)

| Export | Cuándo usarlo |
|---|---|
| `<RecipeRenderer composition item />` | Renderiza UNA composition (lista o detalle) con su item de datos. Es el dispatcher principal — internamente selecciona la recipe correcta por `composition.recipe` y delega |
| `<NestedRecipeRenderer slot parentItem />` | Para slots `card-ref` con `targetRecipe` definido (V4 nested recipes) |

### Las 8 recipes

| Recipe | Kind | Cuándo usar |
|---|---|---|
| `<CompactAvatarRecipe>` | list | Listas densas con foto + nombre + dato corto (jugadores, hermanas, capítulos) |
| `<CompactCardRecipe>` | list | Grids con imagen cuadrada + título + badge (escudos, covers) |
| `<HeroProtagonicoRecipe>` | detail | Vista detalle con banner + descripción + mini-cards anidadas |
| `<RowTextRecipe>` | list | Lista densa solo-texto (estadísticas, eventos) |
| `<EditorialRecipe>` | detail | Card tipo blog post con cover + título + extracto |
| `<MomentoRecipe>` | detail | Tarjeta tipo Instagram con foto cuadrada + caption |
| `<AccordionSimpleRecipe>` | list | Lista colapsable (FAQs, capítulos expandibles) |
| `<AccordionWithActionsRecipe>` | list | Acordeón + botones de acción dentro |

Para descripciones completas de cuándo usar cada una ver la enciclopedia in-app del editor Studio (KRO-70) o `kromia-studio/src/lib/encyclopedia/entries.ts`.

### Utilities (Legos)

Para construir renderers custom o probar pantallas sin recipe completa:

| Export | Propósito |
|---|---|
| `<AvatarBox>` | Avatar con shape configurable + fallback a iniciales |
| `<InitialsAvatar>` | Avatar de iniciales puro (sin imagen) |
| `<ScalarText>` | Renderiza scalar (string/number) con formato según field+behavior |
| `<ComposableSlot>` | Texto compuesto: une N fields con separadores configurables |
| `<StatusDot>`, `<ThumbBox>`, `<BannerBox>`, `<BadgePill>`, `<AccentFrame>` | Building blocks varios |

### Helpers no-JSX

| Export | Propósito |
|---|---|
| `resolveSlot(slotComp, fields, item)` | Resuelve un slot a `ResolvedSlot { fields, format, appearance }`. Lo que cada recipe usa internamente |
| `appearanceShapeClass()` / `appearanceAspectClass()` / `appearanceSizePx()` / etc. | Generan clases Tailwind a partir de `SlotAppearance` props |
| `buildAccentBorderStyle()` / `extractAccentColor()` | Manejo del accent (línea de color) per-card |
| `imageFocusStyle()` | Object-position + scale CSS según `imageFocus` |
| `isEmpty()` | Helper común para detectar slot vacío |

---

## Cómo consumirlo desde un cliente nuevo

### Stack requerido

- React 19 + react-dom 19 (peer dep)
- Tailwind CSS v3+ (peer dep — el paquete asume las clases utility funcionan)
- lucide-react ≥ 0.460 (peer dep — los iconos de Status, Lock, etc.)
- `clsx` + `tailwind-merge` ya incluidos como deps

### Instalación

Si tu cliente vive en un monorepo con el SDK como workspace:

```json
// package.json del cliente
{
  "dependencies": {
    "@kromia/react": "workspace:*",
    "@kromia/core": "workspace:*"
  }
}
```

Si usas el SDK como submodule (caso Studio):

```bash
pnpm add "@kromia/react@file:./kromia-sdk/packages/react"
pnpm add "@kromia/core@file:./kromia-sdk/packages/core"
```

### Configuración Next.js

El paquete se **distribuye como source `.tsx`** — no hay build pre-compilado. Tu bundler debe procesarlo:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  transpilePackages: ['@kromia/core', '@kromia/react'],
  // ...
};
```

### Configuración Tailwind

Tailwind necesita escanear los archivos del SDK para generar las clases:

**Tailwind v4** (con `@source` directive en CSS):

```css
@import "tailwindcss";

@source "../**/*.{ts,tsx}";
@source "../../node_modules/@kromia/react/src/**/*.{ts,tsx}";
```

**Tailwind v3** (con `tailwind.config.ts`):

```ts
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@kromia/react/src/**/*.{ts,tsx}',
  ],
  // ...
};
```

### Uso mínimo

```tsx
import { RecipeRenderer } from '@kromia/react';
import type { ViewComposition } from '@kromia/core';

const composition: ViewComposition = {
  recipe: 'compact_avatar',
  action: 'navigate_to_detail',
  targetRecipe: 'hero_protagonico',
  slots: {
    avatar:   { fields: ['photo'] },
    title:    { fields: ['name'] },
    subtitle: { fields: ['position'] },
  },
};

const item = {
  photo:    'https://...',
  name:     'Lionel Messi',
  position: 'Delantero',
};

const fields = [
  { key: 'photo',    type: 'image' as const, label: 'Foto' },
  { key: 'name',     type: 'text'  as const, label: 'Nombre' },
  { key: 'position', type: 'text'  as const, label: 'Posición' },
];

export function PlayerCard() {
  return <RecipeRenderer composition={composition} item={item} fields={fields} />;
}
```

---

## Cómo extender (añadir una recipe nueva)

> **Antes de empezar**: ver [`kromia-sdk/playbooks/add-recipe.md`](../../playbooks/add-recipe.md). El playbook cubre los pasos en orden + los checkpoints (registry en core, manifest, componente).

Resumen del flujo:

1. **Declarar el manifest en `@kromia/core`** (`packages/core/src/registries/recipes.ts`): id, displayName, kind, slots con `accepts` + `appearance` props soportadas.
2. **Crear el componente en `@kromia/react`** (`packages/react/src/recipes/MyRecipe.tsx`): consume slotos via `resolveSlot` + renderiza Tailwind.
3. **Exportar desde el barrel** (`packages/react/src/index.ts`).
4. **Cablear en el dispatcher** (`RecipeRenderer.tsx`): añadir el `case 'my_recipe'`.
5. **Mock data + visual test** en Studio AppPreview.
6. **Bump version** del SDK según [matriz SemVer del AGENTS.md raíz](../../AGENTS.md#cuándo-bumpeo-qué-nivel-semver).

---

## Slots customizables (V5) + appearance per-instance (V6)

El paquete honra:

- **Slot overrides** (`composition.slotOverrides { disabled[], custom[], order[] }`) — el publisher puede deshabilitar slots built-in, añadir custom, reordenar. Resolución vía `getEffectiveSlots()` de `@kromia/core`.
- **Appearance per-instance** (`SlotComposition.appearance`) — shape, aspect, align, weight, size, padding, accent position. Cada recipe expone qué props soporta vía `manifest.slots[].appearance`.

Para añadir una nueva appearance prop o slot kind: ver [`add-recipe.md`](../../playbooks/add-recipe.md) sección "Extender appearance".

---

## Testing

```bash
cd packages/react
pnpm test          # vitest run
pnpm test:watch    # vitest watch
```

Los tests son agnósticos del DOM real cuando es posible (tests de helpers puros). Para tests de componentes con render, vitest config carga `@testing-library/react` si es necesario.

---

## Mantenimiento interno

Si vas a tocar el SDK desde dentro (no consumirlo), lee primero [`AGENTS.md`](../../AGENTS.md) raíz. Cubre:

- Mapa completo de paquetes y dependencias
- Tabla de helpers (qué helper para qué)
- Workflow de bump + cross-repo wire
- Gotchas conocidos (pnpm + Windows, submodule sync, etc.)

---

## Last verified

2026-05-29 — sesión KRO-87 (creación inicial). React 19 + Tailwind v4 + Next 16.
