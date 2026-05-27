# @kromia/protocol

SDK TypeScript del contrato Kromia. **Source-of-truth** del modelo que define
cómo Studio (Next.js) y Flutter (futuro) hablan del mismo álbum.

## Qué contiene

| Pieza | Archivo |
| --- | --- |
| **Types** del modelo (SlotAcceptKind, RecipeId, SlotKind, etc.) | `src/types.ts` |
| **Field types** registry (text, number, image, array<X>, ...) | `src/registries/field-types.ts` |
| **Behaviors** registry (year, iso_date, rating, color_hex, gallery, ...) | `src/registries/behaviors.ts` |
| **Actions** registry (none, navigate_to_detail, modal, expand_inline, ...) | `src/registries/actions.ts` |
| **Recipes** registry (compact_avatar, hero_protagonico, ...) | `src/registries/recipes.ts` |
| **Slot kinds** + descripciones | `src/registries/slot-kinds.ts` |
| **classifyField** + isFieldCompatibleWithSlot | `src/classify.ts` |
| **Generator del contracts/*.json** | `src/generate.ts` |
| **API pública (barrel)** | `src/index.ts` |

## Uso desde un consumidor

```ts
import {
  allBehaviors,
  allActions,
  allFieldTypes,
  classifyField,
  isFieldCompatibleWithSlot,
  RECIPE_REGISTRY,
  SLOT_ACCEPT_KIND_META,
} from '@kromia/protocol';

// Ejemplo: qué slot kinds aceptaría este field
const kinds = classifyField({ type: 'number', behavior: 'year' });
// → ['any', 'date', 'number']
```

## Regenerar el `.json`

Desde el root del monorepo:

```bash
pnpm gen          # ejecuta packages/protocol-ts/src/generate.ts
```

Output: `../../contracts/kromia-recipe-protocol-v1.json` (carpeta `contracts/`
en el root del monorepo, lenguaje-neutra).

## Tests

```bash
pnpm test         # corpus de classifyField + matrices de compatibilidad
```

Los tests definen el **corpus canónico** de inputs (field+behavior combinations).
Cualquier SDK mirror (futuro Dart) debe producir el mismo output para el mismo
input. Es la garantía de paridad cross-language.

## Versionado

- `protocolVersion` en el `.json` = versión que ve el consumidor.
- `version` en este `package.json` = alineado con `protocolVersion`.
- Tag git en el root del monorepo: `krp/v<X.Y.Z>`.

Niveles SemVer:

| Nivel | Cuándo |
| --- | --- |
| Patch | Solo metadata (descriptions, labels). |
| Minor | Nueva entidad backward-compatible (behavior, recipe, action, slot kind, field type). |
| Major | Breaking shape (eliminar entidad, cambiar `accepts`, etc.). |

Ver `kromia-sdk/playbooks/bump-protocol.md`.

## Publicación a npm

**No se publica hasta que haya consumidor externo real** (third-party developer
API). Consumido vía path local del submodule:

```jsonc
// kromia-studio/package.json
{
  "dependencies": {
    "@kromia/protocol": "file:./kromia-sdk/packages/protocol-ts"
  }
}
```

Cuando se decida publish, cambiar `"private": true` → `false` + `npm publish`.

## Estructura del SDK

```
packages/protocol-ts/
├── src/
│   ├── types.ts                  ← SlotAcceptKind, RecipeId, SlotKind, ...
│   ├── registries/
│   │   ├── field-types.ts        ← 8 types base
│   │   ├── actions.ts            ← 5 actions
│   │   ├── behaviors.ts          ← 26 behaviors con renderAsSlotKind
│   │   ├── recipes.ts            ← 8 recipes (manifests + slots)
│   │   └── slot-kinds.ts         ← SLOT_ACCEPT_KIND_META con descripciones
│   ├── classify.ts               ← classifyField + isFieldCompatibleWithSlot
│   ├── generate.ts               ← script que emite contracts/*.json
│   └── index.ts                  ← API pública
├── tests/                        ← corpus + verificaciones
├── package.json
├── tsconfig.json
└── README.md
```

## Reglas de capas

- ❌ **NO** importar React, JSX, ni nada de Studio (`@/components/*`).
- ❌ **NO** depender de Node específico salvo en `generate.ts` (que sí usa `node:fs`).
- ✅ Lenguaje-neutral por construcción → portable a paquete público mañana.
- ✅ Solo data + funciones puras + types.

## Mantenimiento

Antes de añadir behavior/action/recipe/etc., consulta el playbook correspondiente
en `kromia-sdk/playbooks/INDEX.md`.
