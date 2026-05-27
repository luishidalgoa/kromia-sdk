# add-behavior

**Cuándo aplica**: vas a añadir un nuevo behavior al sistema (ej: `currency`,
`color_hex`, `iso_date`...). Un behavior define cómo se interpreta y renderiza
un field además de su `type` base.

## Regla de oro

> El behavior se define en el **SDK** (`@kromia/core`), no en Studio
> ni en Flutter. Los clientes lo **consumen** vía import del paquete.

## Pasos

### SDK (`kromia-sdk/packages/core/`)

- [ ] Añadir entrada en `src/registries/behaviors.ts`:
  - `id` (snake_case, único, lo que se guarda en BD)
  - `displayName` (UI)
  - `description` (frase corta, tooltip + KRO-70)
  - `applicableTypes` (`'text'`, `'number'`, `'textarea'`, `'array<image>'`, etc.)
  - `renderAsSlotKind?` (opcional — el `SlotAcceptKind` primario en el que
    el behavior encaja; el generator lo usa para `slotAcceptKinds[*].behaviorIds`)
- [ ] Actualizar `src/classify.ts` (función `classifyField`) si el behavior
  introduce reglas de mapeo a un `SlotAcceptKind`. **Crítico**: `renderAsSlotKind`
  y `classifyField` deben estar sincronizados — un branch en `classifyField`
  por cada nuevo kind expuesto vía `renderAsSlotKind`.
- [ ] Añadir caso al corpus en `tests/classify.test.ts`. Mínimo dos casos:
  con el behavior y sin (solo con el type base). Los tests son ground truth
  para futuros mirrors (Dart).
- [ ] Si introduce un nuevo `SlotAcceptKind` → ver [add-recipe.md](add-recipe.md)
  sección "Slot kinds nuevos".
- [ ] `pnpm test` debe pasar.
- [ ] Regenerar contract: `pnpm gen` (desde el root del monorepo).
- [ ] Verificar diff de `contracts/kromia-recipe-protocol-v1.json` — debe
  aparecer el behavior nuevo en `behaviors` y, si aplica, en
  `slotAcceptKinds[*].behaviorIds` + `connections.edges`.

### Studio (`kromia-studio/`)

- [ ] **NO se toca** nada del modelo. Studio consume via
  `from '@kromia/core'` y eso ya tiene el behavior nuevo.
- [ ] Si el behavior renderiza diferente en el preview (UI específica),
  actualizar el `.tsx` renderer correspondiente en
  `src/components/album/recipes/<Recipe>.tsx` o helpers de
  `src/components/album/recipes/recipe-utils.tsx`. La lógica RENDER vive
  en Studio; la lógica MODELO vive en el SDK.
- [ ] Si necesitas actualizar el submodule (porque el paquete tiene cambios
  no pulled aún): `git submodule update --remote --merge` desde el root
  de Studio.

### Flutter (`kromia-flutter/`) — cuando KRO-65 esté shipped

- [ ] **NO reescribir** la entrada. Flutter consume via
  `import 'package:kromia_protocol/kromia_protocol.dart';`
  La clase Dart equivalente vive en `packages/protocol-dart/`.
- [ ] Si el behavior introduce render no genérico (ej: `currency` formato €,
  `iso_date` con locale), añadir handler en `lib/widgets/behaviors/` del
  Flutter consumidor. El paquete Dart NO contiene widgets.

### Backend (`Kromia_NodeJS/`)

- [ ] **Por defecto NO se toca**. El backend es permisivo (acepta cualquier
  string en `field.behavior`).
- [ ] Excepción: si el behavior implica un nuevo `type` base que el backend
  valida, añadir el type en `BehaviorRegistry.ts` + tests.

### Contract / Versionado

- [ ] Esto es un cambio **minor** (1.x.0 → 1.(x+1).0) — nueva entidad
  backward-compatible. Para detalles: [bump-protocol.md](bump-protocol.md).
- [ ] Bump version en `packages/core/package.json` + `PROTOCOL_VERSION`
  en `src/generate.ts`. Regenerar.

### Jira

- [ ] Subtarea de `KRO-21` (parent de behaviors) si afecta el modelo del editor.
- [ ] Labels: `feature`, `behaviors`, `SDK`. Añadir `Studio` si requiere
  trabajo en .tsx render.

### Git

- [ ] **Commit en kromia-sdk**: `feat(behaviors): añadir <id> — <descripción>`.
- [ ] Tag si el cambio justifica un bump: `krp/v1.X.Y`.
- [ ] **Commit en kromia-studio**: solo si hubo trabajo en render. Mensaje:
  `chore(krp): bump submodule + render handler para <behavior>`.

## Pitfalls conocidos

- **color_hex es type=text pero NO va en text-short slots** (KRO-69). Si tu
  behavior nuevo tiene una situación similar (mismo type, semántica diferente),
  añadir el branch en `classifyField` que lo excluye explícitamente +
  documentar el motivo en `tests/classify.test.ts`.
- **`applicableTypes` con `array<X>`** requiere que el backend acepte ese type
  base. Verificar antes de añadirlo en el SDK.
- **Drift entre `renderAsSlotKind` y `classifyField`**: los tests del corpus
  cazan esto, pero solo si añades el caso. **Siempre añadir el test.**
- **Si el behavior tiene config** (ej: `currency` con símbolo), definir
  schema de config en el behavior-registry y propagarlo al KRP. Hoy el KRP
  no serializa configs por behavior — feature aún pendiente.

## Last verified

2026-05-27 — KRP V1.5 (KRO-71 Fase 2 shipped, monorepo + SDK activos).
