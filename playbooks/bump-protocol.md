# bump-protocol

**Cuándo aplica**: vas a subir la versión de un contract (`protocolVersion`
dentro del JSON + tag de git en este repo).

Hoy aplica al KRP (`kromia-recipe-protocol-v1.json`). Cuando aparezcan
nuevos contracts, este playbook cubre todos.

## Niveles SemVer

- **Patch** (1.0.0 → 1.0.1): cambios additive de metadata. Ej: nuevo
  behavior, nueva descripción, nuevo label.
- **Minor** (1.0.0 → 1.1.0): nueva entidad backward-compatible. Ej: nueva
  recipe, nueva action, nuevo slot opcional, nuevo SlotAcceptKind.
- **Major** (1.0.0 → 2.0.0): breaking change de shape. Ej: eliminar recipe,
  eliminar slot, cambiar `accepts` de un slot existente, renombrar campo
  del JSON. Requiere PR coordinado en TODOS los consumers.

## Pasos

### En kromia-studio (productor)

- [ ] Modifica el código (registries, etc.) según el playbook que aplique
  ([add-behavior](add-behavior.md), [add-action](add-action.md),
  [add-recipe](add-recipe.md)).
- [ ] Regenera el contract: `pnpm gen:protocol`.
- [ ] **Hoy** (pre-KRP-V1.5): cambia `PROTOCOL_VERSION` a mano en
  `scripts/generate-recipe-protocol.ts` y vuelve a regenerar.
- [ ] **Post-KRP-V1.5 (KRO-63)**: el generator detecta diff vs último
  `.json` + hace el bump automático según heurística.
- [ ] Verifica el diff del `.json`:
  - Patch: solo cambian campos `description`, `displayName`, o nueva
    entrada en `behaviors[]`.
  - Minor: aparece nueva recipe / action / slot opcional / kind.
  - Major: desaparece o cambia tipo de un campo existente.

### En kromia-protocol (este repo)

- [ ] Si el output del generator va a Studio (`kromia-studio/contracts/`),
  copiar el `.json` actualizado a `contracts/` aquí. KRP V1.5 lo automatiza.
- [ ] Actualizar `contracts/README.md` si la estructura visible cambió.
- [ ] Crear tag git: `git tag krp/v1.0.1` (formato: `<dominio>/v<X.Y.Z>`).
- [ ] **NO** push de tags sin permiso del user.

### En kromia-flutter — cuando KRO-65 esté shipped

- [ ] Si es patch o minor: pinear al nuevo tag, regenerar parser si aplica.
  El cliente debe ignorar entidades desconocidas silenciosamente.
- [ ] Si es major: PR coordinado. Actualizar parser, ajustar widgets,
  documentar la migración.

### Jira

- [ ] Patch/minor: nota en la subtarea que disparó el cambio.
- [ ] Major: subtarea propia bajo `KRO-61` para coordinar el rollout.
  Issue automático abierto por KRO-64 (drift detector) cuando esté shipped.

### Git (commits)

- [ ] Studio: `chore(krp): regenerate contract v1.0.1` (o el version que toque).
- [ ] kromia-protocol: `chore(krp): bump to v1.0.1` + tag.

## Pitfalls conocidos

- **`generatedAt` cambia siempre** pero NO cuenta como bump. El diff debe
  ignorarlo. Si el único cambio es `generatedAt`, no hay bump.
- **Patch en realidad debería ser minor si añade un id nuevo** que el cliente
  necesita renderizar. Patch es para cambios "el cliente ni se entera"
  (descripción, label). Si dudas, ve a minor.
- **Major implica trabajo coordinado**: NO bumpees major sin avisar al
  equipo de Flutter (cuando exista) + abrir tarea de migración.

## Last verified

2026-05-27 — setup inicial del repo.
