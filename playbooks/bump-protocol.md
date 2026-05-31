# bump-protocol

**Cuándo aplica**: vas a subir la versión de un contract (`protocolVersion`
dentro del JSON + version del paquete + tag de git en este repo).

Hoy aplica al KRP (`kromia-recipe-protocol-v1.json` + `@kromia/core`).
Cuando aparezcan nuevos contracts/paquetes, este playbook cubre todos.

## Niveles SemVer

- **Patch** (1.0.0 → 1.0.1): cambios additive de metadata. Ej: nueva
  descripción, nuevo label, fix de typo.
- **Minor** (1.0.0 → 1.1.0): nueva entidad backward-compatible. Ej: nueva
  recipe, nueva action, nuevo behavior, nuevo slot opcional, nuevo
  SlotAcceptKind, nuevo field type.
- **Major** (1.0.0 → 2.0.0): breaking change de shape. Ej: eliminar recipe,
  eliminar slot, cambiar `accepts` de un slot existente, renombrar campo
  del JSON. Requiere PR coordinado en TODOS los consumers.

## Tras KRO-63 — Auto-bump

Desde v1.3.0 (KRO-63), `pnpm gen` **detecta el tipo de cambio
automáticamente** comparando el `.json` recién generado contra el `HEAD`
del git. Aplica:

1. Lee el `.json` previo desde `git show HEAD:contracts/...`.
2. Compara prev vs candidate con `detectBumpKind` → major/minor/patch/none.
3. Si kind ≠ 'none', bumpea `package.json#version` **y** el campo
   `protocolVersion` del JSON juntos (single source-of-truth en
   `package.json`).
4. Escribe ambos archivos.

**Single source-of-truth**: ya NO se edita `PROTOCOL_VERSION` a mano. La
constante exportada del barrel (`@kromia/core#PROTOCOL_VERSION`) y
el `protocolVersion` del JSON ambos leen de `package.json#version`.

**Flag útil**: `pnpm gen --dry-run` reporta qué bumpearía sin tocar
archivos. Útil antes de commit para confirmar el verdict.

## Pasos

### En `kromia-sdk/packages/core/` (SDK, productor)

- [ ] Edita los registries / lógica según el playbook que aplique
  ([add-behavior](add-behavior.md), [add-action](add-action.md),
  [add-recipe](add-recipe.md)).
- [ ] `pnpm test` (tests del corpus deben pasar — 194+ al 2026-05-27).
- [ ] **`pnpm gen --dry-run`** para preview del bump detectado.
- [ ] **`pnpm gen`** para escribir cambios:
  - Auto-bumpea `package.json#version` según changes detectados.
  - Auto-actualiza `protocolVersion` en el `.json`.
  - Reporta razones del bump (top 5).
- [ ] Verifica el diff del `.json` en `contracts/`:
  - El diff debe matchear las razones que reportó el generator.
  - Si te sorprende el bump → revisa los registries o abre issue contra el detector.
- [ ] Actualiza `contracts/README.md` si hay cambios visibles en la estructura
  del payload.

### En `kromia-sdk` (root del monorepo)

- [ ] Commit en kromia-sdk con mensaje (el generator imprime la nueva version, úsala):
  - `feat(krp): minor X.Y.0 — <descripción>` (para minor)
  - `fix(krp): patch X.Y.Z — <descripción>` (para patch)
  - `feat(krp)!: major X.0.0 — <descripción>` (para major, nota el `!`)
- [ ] Crea tag git: `git tag krp/v<X.Y.Z>` (formato `<dominio>/v<X.Y.Z>`).
- [ ] Push con tags: `git push origin main --tags`.

### En `kromia-studio` (consumer TS)

- [ ] Actualiza el submodule pointer: `git submodule update --remote --merge`
  desde el root de Studio.
- [ ] **Major bumps requieren coordinación**: revisa qué imports de
  `@kromia/core` en Studio quedaron inválidos (TypeScript te lo dice
  al hacer `npx tsc --noEmit`). Adapta consumers.
- [ ] Para minor / patch / major: **NO basta con `pnpm install`** — el
  cache de pnpm con `file:` deps no detecta cambios de version del
  paquete sin un add explícito. Usar:
  ```
  pnpm add "@kromia/core@file:./kromia-sdk/packages/core"
  ```
  Eso refresca el symlink y reporta `+ @kromia/core X.Y.Z`. Síntoma
  de saltarse este paso: tests Studio fallan con `TypeError: <export> is
  not a function` aunque el SDK tenga el export.
- [ ] Commit en kromia-studio: `chore(krp): bump submodule to v<X.Y.Z>`.

### En `kromia-flutter` — cuando KRO-65 esté shipped

- [ ] Si es patch o minor: actualiza el pin del paquete Dart (`path:` o
  `pub.dev` ref) al nuevo tag. El cliente debe ignorar entidades
  desconocidas silenciosamente.
- [ ] Si es major: PR coordinado. Actualizar parser, ajustar widgets,
  documentar la migración. Los tests cross-language del paquete TS son
  la guía — el output esperado para los mismos inputs debe ser idéntico
  en el paquete Dart.

### Jira

- [ ] Patch / minor: nota en la subtarea que disparó el cambio.
- [ ] Major: subtarea propia bajo `KRO-61` para coordinar el rollout.
  Issue automático abierto por KRO-64 (drift detector) cuando esté shipped.
- [ ] Labels apropiadas: `SDK` siempre, más `Studio` / `Flutter` según
  trabajo coordinado.

## Pitfalls conocidos

- **`generatedAt` cambia siempre** pero NO cuenta como bump. El detector
  lo ignora — si el único diff del `.json` es `generatedAt`, no hay bump.
- **Major implica trabajo coordinado**: NO bumpees major sin avisar al
  equipo de Flutter (cuando exista) + abrir tarea de migración.
- **Detector demasiado conservador**: cualquier change shape en una entrada
  existente se marca major. Si crees que debería ser minor (ej. añadir
  campo opcional a una entry), considera si esa "opcionalidad" es real
  para clientes legacy.
- **`pnpm install` no refresca el SDK en Studio**: usa `pnpm add` con
  el path completo del paquete (ver sección "kromia-studio" arriba).

## Drift CI (KRO-64) — qué se dispara y cómo se resuelve

`.github/workflows/krp-drift.yml` vigila la paridad TS↔Dart en cada push/PR que
toque `packages/core/package.json`, `packages/core_dart/**` o `contracts/**`
(también `workflow_dispatch` para correrlo a mano). Dos capas:

- **corpus-parity**: corre `dart test` del paquete Dart. Caza drift de
  COMPORTAMIENTO (cambios de lógica runtime, p.ej. `classify.ts`) que el número
  de versión NO refleja — esa lógica no viaja entera en el `.json`, así que el
  auto-bumper de KRO-63 no la ve. Esta es la red que cubre ese hueco.
- **version-drift**: compara `core/package.json#version` (TS, source) vs
  `core_dart/pubspec.yaml#version` (Dart, mirror):
  - iguales → ✅ sin drift.
  - mismo major, TS minor/patch mayor → ⚠️ aviso (aditivo, NO bloquea: el
    cliente ignora entidades desconocidas). Alinear el Dart cuando el render lo
    necesite.
  - **TS major > Dart major → ❌ falla el check + abre issue Jira** automática
    (label `drift`, status `Drift Sync`, parent `KRO-61`) con el changeset de
    `contracts/` y el commit. Idempotente: no duplica si ya hay una abierta para
    esa versión.
  - Dart major > TS (improbable) → ⚠️ aviso para revisar a mano.

### Cuando se abre un drift issue (qué haces)

1. Lee el changeset de la issue (qué entidades cambiaron en `contracts/`).
2. Alinea `packages/core_dart` (registries / classify / types) con el TS.
3. Traduce/actualiza el corpus de tests; `dart test` verde.
4. Sube `core_dart/pubspec.yaml#version` a la versión del TS.
5. Cierra la issue (Completado). El próximo push verifica que el drift desapareció.

### Secrets necesarios para la auto-issue

`JIRA_BASE_URL`, `JIRA_USER_EMAIL`, `JIRA_API_TOKEN` en repo Settings → Secrets →
Actions. Sin ellos, el detector sigue **fallando** en major drift (visible) pero
no crea la issue.

## Last verified

2026-05-31 — KRO-64 drift CI añadido (`krp-drift.yml`): version-drift +
corpus-parity. Paridad doble (versión + comportamiento).
2026-05-27 — KRO-63 shipped. Auto-bump activo desde v1.3.0. Antes (v1.0.0
→ v1.2.0) el bump era manual; el playbook describe ahora el flow nuevo.
