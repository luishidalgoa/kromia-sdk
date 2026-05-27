# bump-protocol

**Cuándo aplica**: vas a subir la versión de un contract (`protocolVersion`
dentro del JSON + version del paquete + tag de git en este repo).

Hoy aplica al KRP (`kromia-recipe-protocol-v1.json` + `@kromia/protocol`).
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

## Pasos

### En `kromia-protocol/packages/protocol-ts/` (SDK, productor)

- [ ] Edita los registries / lógica según el playbook que aplique
  ([add-behavior](add-behavior.md), [add-action](add-action.md),
  [add-recipe](add-recipe.md)).
- [ ] `pnpm test` (40+ tests del corpus deben pasar).
- [ ] Bump version en **DOS sitios** que deben matchear:
  - `packages/protocol-ts/package.json` → `version`
  - `packages/protocol-ts/src/generate.ts` → constante `PROTOCOL_VERSION`
- [ ] Regenera: `pnpm gen` (desde el root del monorepo).
- [ ] Verifica el diff del `.json` en `contracts/`:
  - Patch: solo cambian campos `description`, `displayName`, o entries
    con metadata aditiva.
  - Minor: aparece nueva entidad / slot opcional / kind. Las entidades
    existentes no cambian shape.
  - Major: desaparece o cambia tipo/shape de un campo existente.
- [ ] Actualiza `contracts/README.md` si hay cambios visibles en la estructura
  del payload.

### En `kromia-protocol` (root del monorepo)

- [ ] Commit en kromia-protocol con mensaje:
  - `feat(krp): minor — <descripción>` (para minor)
  - `fix(krp): patch — <descripción>` (para patch)
  - `feat(krp)!: major — <descripción>` (para major, nota el `!`)
- [ ] Crea tag git: `git tag krp/v<X.Y.Z>` (formato `<dominio>/v<X.Y.Z>`).
- [ ] Push con tags: `git push origin main --tags`.

### En `kromia-studio` (consumer TS)

- [ ] Actualiza el submodule pointer: `git submodule update --remote --merge`
  desde el root de Studio.
- [ ] **Major bumps requieren coordinación**: revisa qué imports de
  `@kromia/protocol` en Studio quedaron inválidos (TypeScript te lo dice
  al hacer `npx tsc --noEmit`). Adapta consumers.
- [ ] Para minor / patch: `pnpm install` (refresca el lock con la nueva
  version del paquete) + `pnpm gen:protocol` (regenera para verificar
  forward compat).
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

- **`generatedAt` cambia siempre** pero NO cuenta como bump. El diff debe
  ignorarlo. Si el único cambio del `.json` es `generatedAt`, no hay bump.
- **Patch en realidad debería ser minor si añade un id nuevo** que el cliente
  necesita renderizar. Patch es para cambios "el cliente ni se entera"
  (descripción, label). Si dudas, ve a minor.
- **Major implica trabajo coordinado**: NO bumpees major sin avisar al
  equipo de Flutter (cuando exista) + abrir tarea de migración.
- **Olvidar bumpear `package.json` Y `generate.ts`**: deben matchear.
  Si divergen, el `.json` declara una versión pero el paquete instala otra.

## Last verified

2026-05-27 — KRP V1.5 (KRO-71 Fase 2 shipped). v1.1.0 emitido vía este
flujo (tag `krp/v1.1.0`).
