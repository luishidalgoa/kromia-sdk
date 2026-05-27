# add-recipe

**Cuándo aplica**: vas a añadir una nueva recipe (ej: `compact_avatar`,
`hero_protagonico`, `editorial`...) o modificar slots / slot kinds en una
recipe existente.

Una recipe es un **manifest** (metadata: id, kind, slots) + un **renderer**
(`.tsx` Studio + futuro Flutter widget). El manifest vive en el SDK; los
renderers viven en cada cliente.

## Regla de oro

> El **manifest** vive en el SDK. El **renderer .tsx** vive en Studio.
> El **renderer Dart** vive en Flutter (cuando exista). Manifest único,
> renderers por lenguaje.

## Pasos

### SDK — Manifest (`kromia-sdk/packages/core/`)

- [ ] Añadir manifest en `src/registries/recipes.ts`, bajo `RECIPE_REGISTRY`:
  - `id` (snake_case único)
  - `kind`: `'list' | 'detail' | 'expand'`
  - `displayName`, `description`
  - `slots`: array de `SlotDefinition`. Cada slot lleva:
    - `id`, `label`
    - `kind`: `'single' | 'composable'`
    - `accepts`: array de `SlotAcceptKind` (ver `src/types.ts`)
    - `optional?`, `nestable?`, `description?`
- [ ] Si introduces un **slot kind nuevo**, hay que tocar varios sitios:
  - Añadir el literal al union `SlotAcceptKind` en `src/types.ts`.
  - Añadir la entry en `SLOT_ACCEPT_KIND_META` (`src/registries/slot-kinds.ts`).
  - Añadir las `AppearanceProp` aplicables en `APPEARANCE_PROPS_BY_KIND`.
  - Añadir el branch en `classifyField` (`src/classify.ts`) si aplica.
  - Añadir tests al corpus en `tests/classify.test.ts`.
  - TypeScript fuerza exhaustividad via `Record<SlotAcceptKind, ...>` —
    los errores de compilación te recuerdan los sitios que faltan.
- [ ] Si añades un `id` nuevo a `RecipeId` union, actualizar `src/types.ts`.
- [ ] `pnpm test` + `pnpm gen` + verificar diff del `.json`.

### Studio — Renderer (`kromia-studio/`)

- [ ] Crear `src/components/album/recipes/<RecipeName>Recipe.tsx`.
- [ ] Usar helpers centralizados de `recipe-utils.tsx`:
  - `extractAccentSettings`, `AccentFrame`, `slotDebugAttrs`
  - `applyAppearanceTruncate`, `imageFocusStyle` si aplica
- [ ] El renderer recibe `{ data, composition, fieldsByKey }` y produce JSX.
- [ ] Registrarlo en el mapping recipe-id → componente
  (`src/components/album/recipes/index.ts` o el factory que aplique).

### Studio — Editor

- [ ] Si la recipe tiene constraints especiales (slots requeridos, behaviors
  específicos), actualizar `ViewCompositionTreeEditor.tsx` con validación
  adicional. El validador puede usar `getRecipeManifest(id)` del SDK.
- [ ] Si introduce `appearance` props nuevos, propagarlos a `SlotAppearance`
  en `src/types.ts` del SDK (NO en Studio) + UI en `AppearanceEditor`.

### Flutter — cuando KRO-65 esté shipped

- [ ] Crear widget Flutter equivalente en `lib/recipes/<recipe_name>.dart`.
- [ ] Registrarlo en el factory de recipes que parsea el `.json` del KRP
  (o consume el paquete `kromia_protocol` Dart).

### Backend (`Kromia_NodeJS/`)

- [ ] **NO se toca**. El backend serializa `ViewComposition` sin validar
  la lógica visual de la recipe.

### Contract / Versionado

- [ ] Cambio **minor** (1.x.0 → 1.(x+1).0). Nueva recipe es additive.
- [ ] Si **modificas** una recipe existente (cambias `accepts` de un slot,
  eliminas un slot, etc.) → cambio **major** (2.0.0). Composiciones
  existentes pueden quedar inválidas.
- [ ] Seguir [bump-protocol.md](bump-protocol.md).

### Jira

- [ ] Subtarea de `KRO-21` (parent de recipes).
- [ ] Labels: `feature`, `SDK` (manifest) + `Studio` (renderer .tsx).
  Si solo cambias manifest sin renderer: solo `SDK`. Si introduces
  behaviors nuevos en paralelo, añadir `behaviors`.

### Git

- [ ] **Commit en kromia-sdk** (manifest): `feat(recipes): añadir <id>`.
- [ ] **Commit en kromia-studio** (renderer): `feat(recipes): renderer .tsx
  para <id> + bump submodule`.

## Pitfalls conocidos

- **kind='detail'**: las recipes detail NO pueden tener action propia (su
  rol es ser target de un push/modal). El compatibilityMatrix del KRP lo
  enforza al serializar.
- **Slots `nestable`** habilitan composición recursiva (slot dentro de slot).
  Usar con cuidado — afecta el editor de árbol.
- **SlotAppearance**: las apariencias (shape, aspect, truncate, etc.) son
  **per-instance overrides**. La recipe declara defaults, el publisher las
  ajusta en la composition. Ver `docs/v6-appearance-system.md` en Studio.
- **Backward compat de manifests**: campos legacy (ej: `image-avatar`,
  `image-banner`, `image-cover`) se mantienen como aliases de `image` para
  no romper composiciones viejas. Si añades una unificación similar,
  documentarla en `classifyField` con comentario explícito + test del
  corpus que cubra ambos sides (alias antiguo + canónico nuevo).

## Last verified

2026-05-27 — KRP V1.5 (KRO-71 Fase 2 shipped, monorepo + SDK activos).
