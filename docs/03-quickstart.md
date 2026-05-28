---
title: Quick start
description: Monta un cliente React que renderiza una carta de Kromia en menos de 5 minutos. Sin clonar Studio, partiendo de cero.
category: Empezar aquí
---

# Quick start

En 5 minutos vas a tener un cliente React renderizando una carta de Kromia, copiando-pegando los snippets.

> Si solo quieres LEER cómo funciona sin instalarlo, salta a [Conceptos](/docs/02-concepts) primero.

## Pre-requisitos

- Node 20+ y pnpm 9+
- Un proyecto Next.js 16 ya creado (`pnpm create next-app@latest`)
- Tailwind CSS configurado (v3 o v4)

## 1. Añade el SDK como submodule

Desde la raíz de tu proyecto:

```bash
git submodule add https://github.com/luishidalgoa/kromia-sdk.git kromia-sdk
git submodule update --init --recursive
```

El SDK queda en `./kromia-sdk/` y se actualiza pinning a tags (no a `main`).

## 2. Instala los paquetes

```bash
pnpm add "@kromia/core@file:./kromia-sdk/packages/core"
pnpm add "@kromia/react@file:./kromia-sdk/packages/react"
```

Verifica que la copia en `node_modules` es la actual:

```bash
grep "PROTOCOL_VERSION" node_modules/@kromia/core/src/index.ts
```

> **Gotcha**: pnpm en Windows COPIA los `file:` deps en lugar de symlink. Si editas el SDK más tarde, vuelve a ejecutar el comando `pnpm add` para forzar el relink. Detalles en `kromia-sdk/AGENTS.md`.

## 3. Configura Next.js

`next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@kromia/core', '@kromia/react'],
};

export default nextConfig;
```

Tailwind necesita escanear los componentes del SDK. Si usas **Tailwind v4** (`@source` directive en CSS):

```css
@import "tailwindcss";

@source "../**/*.{ts,tsx}";
@source "../../node_modules/@kromia/react/src/**/*.{ts,tsx}";
```

Si usas **Tailwind v3** (`tailwind.config.ts`):

```ts
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@kromia/react/src/**/*.{ts,tsx}',
  ],
  // ...
};
```

## 4. Renderiza tu primera carta

`app/cromo/page.tsx`:

```tsx
import { RecipeRenderer } from '@kromia/react';
import type { ViewComposition, FieldDefLike } from '@kromia/core';

// El esquema de los datos (en producción viene de Studio).
const fields: FieldDefLike[] = [
  { key: 'foto',     type: 'image', label: 'Foto' },
  { key: 'nombre',   type: 'text',  label: 'Nombre' },
  { key: 'posicion', type: 'text',  label: 'Posición' },
];

// Una carta concreta.
const item = {
  foto:     'https://picsum.photos/seed/messi/200',
  nombre:   'Lionel Messi',
  posicion: 'Delantero',
};

// La composición visual elegida por el publisher.
const composition: ViewComposition = {
  recipe:        'compact_avatar',
  action:        'none',
  slots: {
    avatar:   { fields: ['foto'],     appearance: { shape: 'circle', aspect: '1:1' } },
    title:    { fields: ['nombre'] },
    subtitle: { fields: ['posicion'] },
  },
};

export default function CromoPage() {
  return (
    <div className="max-w-md mx-auto p-6">
      <RecipeRenderer
        composition={composition}
        item={item}
        fields={fields}
      />
    </div>
  );
}
```

Arranca el dev: `pnpm dev`. Abre `http://localhost:3000/cromo`. Verás un avatar circular con el nombre del jugador y su posición.

## 5. Próximos pasos típicos

### Validar una composición antes de guardarla

```ts
import { validateComposition } from '@kromia/core';

const result = validateComposition(composition, fields);
if (result.issues.some(i => i.severity === 'error')) {
  console.error('Composición inválida:', result.issues);
  return;
}
```

El validador aplica 14 reglas: slot required, action targets, compatibilidad field↔slot, appearance, orientation, expand, targetRecipe, slotOverrides. El backend de Kromia usa **el mismo validador** vía el SDK — imposible que el frontend permita lo que el backend rechaza.

### Generar items sintéticos para preview

```ts
import { synthSectionItems } from '@kromia/core';

const mockItems = synthSectionItems('jugadores', section, 5);
// → 5 items con datos deterministas (seed = 'jugadores'). Útil
//   para previsualizar la composition sin tener datos reales.
```

### Formatear un scalar respetando su behavior

```ts
import { formatScalar } from '@kromia/core';

const field = { key: 'fundacion', type: 'number', behavior: 'year' };
const value = 1873;
const display = formatScalar(value, field);  // → "1873" (sin separador de miles)
```

### Mapear catálogos de opciones

Para construir un dropdown de "qué shape elegir":

```ts
import { OPTIONS_APPEARANCE_SHAPE } from '@kromia/core';

OPTIONS_APPEARANCE_SHAPE.forEach(option => {
  console.log(option.id, option.tooltip);
});
// → 'circle', 'Círculo'
//   'square', 'Cuadrado'
//   'rounded', 'Redondeado'
```

Añadir una opción nueva al SDK = aparece automáticamente en el dropdown sin tocar tu cliente.

## Anatomía de lo que acabas de montar

```text
Tu app Next.js                ┐
  └── @kromia/react           │ Renderers JSX + Tailwind
       └── @kromia/core       │ Modelo + validators + helpers
            └── kromia-sdk    ┘ Submodule pineado a tag
                              (compartido con Studio + Backend)
```

Al hacer `pnpm add file:...` pnpm copia el SDK a `node_modules`. Tu app NO bundlea el SDK — Next lo procesa source `.ts/.tsx` directamente via `transpilePackages`. Stack traces limpios, ciclo de edición rápido.

## Errores comunes

| Síntoma | Causa | Fix |
|---|---|---|
| `TypeError: xxx is not a function` aunque el SDK exporta xxx | pnpm cache stale (Windows file: copy) | `pnpm add "@kromia/core@file:./kromia-sdk/packages/core"` para forzar relink |
| Las clases Tailwind del SDK no aplican (todo se ve sin estilo) | Tailwind no escanea node_modules | Ver paso 3 — añadir el `@source` o `content` |
| `Cannot find module '@kromia/react'` en dev | Falta `transpilePackages` en `next.config.ts` | Ver paso 3 |
| Cambias el SDK pero el dev no lo coge | Turbopack cachea `node_modules` | Restart dev tras `pnpm add` |

Más gotchas en `kromia-sdk/AGENTS.md`.

## Para profundizar

- **Conceptos del modelo Kromia (behavior, recipe, slot…)** → [Conceptos](/docs/02-concepts).
- **API completa del SDK** → `kromia-sdk/AGENTS.md` sección "Qué helper uso para qué".
- **Cómo extender (añadir recipe nueva, behavior nuevo)** → `kromia-sdk/playbooks/`.

---

*Última actualización: 2026-05-29 (KRO-87).*
