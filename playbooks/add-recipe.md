# add-recipe

**Cuándo aplica**: vas a añadir una nueva recipe (ej: `compact_avatar`,
`hero_protagonico`, `editorial`...) o modificar slots / slot kinds en una
recipe existente.

Una recipe es un **manifest** (metadata: id, kind, slots) + un **renderer**
(`.tsx` Studio + futuro Flutter widget).

## Pasos

### Studio — Manifest

- [ ] Añadir manifest en `src/components/album/recipes/recipe-registry.ts`,
  bajo `RECIPE_REGISTRY`:
  - `id` (snake_case único)
  - `kind`: `'list' | 'detail' | 'expand'`
  - `displayName`, `description`
  - `slots`: array de `SlotDefinition`. Cada slot lleva:
    - `id`, `label`
    - `kind`: `'single' | 'composable'` (composable acepta varios fields
      con separador)
    - `accepts`: array de `SlotAcceptKind` (ver `slot-kind` types)
    - `optional?`, `nestable?`, `description?`
- [ ] Si introduces un **slot kind nuevo**, añadirlo:
  - En el union `SlotAcceptKind` (mismo file)
  - En `classifyField` (la lógica que mapea field → kinds)
  - En `SLOT_KIND_DESCRIPTIONS` del generator (hoy hardcoded —
    KRP V1.5 lo mueve al registry)

### Studio — Renderer

- [ ] Crear `src/components/album/recipes/<RecipeName>Recipe.tsx`.
- [ ] Usar helpers centralizados de `recipe-utils.tsx`:
  - `extractAccentSettings`, `AccentFrame`, `slotDebugAttrs`
  - `applyAppearanceTruncate`, `imageFocusStyle` si aplica
- [ ] El renderer recibe `{ data, composition, fieldsByKey }` y produce JSX.
- [ ] Registrarlo en el mapping recipe-id → componente
  (`src/components/album/recipes/index.ts` o similar).

### Studio — Editor

- [ ] Si la recipe tiene constraints especiales (slots requeridos, behaviors
  específicos), actualizar `ViewCompositionTreeEditor.tsx` con
  validación adicional.
- [ ] Si introduce `appearance` props nuevos, propagarlos a `SlotAppearance`
  en `types.ts` + UI en `AppearanceEditor`.

### Flutter (kromia-flutter) — cuando KRO-65 esté shipped

- [ ] Crear widget Flutter equivalente en `lib/recipes/<recipe_name>.dart`.
- [ ] Registrarlo en el factory de recipes que parsea el `.json` del KRP.

### Backend (Kromia_NodeJS)

- [ ] **NO se toca**. El backend serializa `ViewComposition` sin validar
  la lógica visual de la recipe.

### Contract / Versionado

- [ ] Cambio **minor** (1.x.0 → 1.(x+1).0). Nueva recipe es additive.
- [ ] Si **modificas** una recipe existente (cambias `accepts` de un slot,
  eliminas un slot, etc.) → cambio **major** (2.0.0). Composiciones
  existentes pueden quedar inválidas.
- [ ] Regenerar contract: `pnpm gen:protocol`.
- [ ] Seguir [bump-protocol.md](bump-protocol.md).

### Jira

- [ ] Subtarea de `KRO-21` (parent de recipes).
- [ ] Labels: `feature`, `frontend`. Añadir `behaviors` si introduce
  behaviors nuevos en paralelo.

### Git

- [ ] Branch: `feat/recipe-<id>`.
- [ ] Commit: `feat(recipes): añadir <id> — <descripción>`.

## Pitfalls conocidos

- **kind='detail'**: las recipes detail NO pueden tener action propia (su
  rol es ser target de un push/modal). El compatibilityMatrix lo enforza.
- **Slots `nestable`** habilitan composición recursiva (slot dentro de slot).
  Usar con cuidado — afecta el editor de árbol.
- **SlotAppearance**: las apariencias (shape, aspect, truncate, etc.) son
  **per-instance overrides**. La recipe declara defaults, el publisher las
  ajusta en la composition. Ver `docs/v6-appearance-system.md` en Studio.
- **Backward compat de manifests**: campos legacy (ej: `image-avatar`,
  `image-banner`, `image-cover`) se mantienen como aliases de `image` para
  no romper composiciones viejas. Si añades una unificación similar,
  documentarla en `classifyField` con comentario explícito.

## Last verified

2026-05-27 — setup inicial del repo.
