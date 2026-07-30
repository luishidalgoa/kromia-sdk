# ship-task

**Cuándo aplica**: terminaste el trabajo de un issue Jira y quieres cerrarlo
limpiamente.

## Pasos

### Verificación

- [ ] Verifica que los criterios de aceptación del issue se cumplen
  (checklist en la descripción).
- [ ] Si el cambio es observable en UI/server, verificarlo end-to-end
  siguiendo la skill `verify` (corre la app, no los tests).
- [ ] Si introduce cambios al KRP: regenerar contract + verificar diff
  (ver [bump-protocol.md](bump-protocol.md)).

### Changelog (regla primordial — ver [versioning.md](versioning.md))

- [ ] Si el cambio es **user-facing**, añade 1 entrada (por cambio, NO por commit)
  bajo `## [Unreleased]` del `CHANGELOG.md` del repo, en su categoría
  (Added/Changed/Fixed/…), con las refs `(KRO-NN)`. Trivial (typo/formato/refactor
  interno) → NO va al changelog.
- [ ] Toca varios repos → entrada en el `CHANGELOG.md` de cada app afectada.

### Commits

- [ ] Mensajes seguir el estilo del repo (conventional commits con scope):
  - `feat(<scope>): ...`
  - `fix(<scope>): ...`
  - `refactor(<scope>): ...`
  - `docs(<scope>): ...`
  - `chore(<scope>): ...`
- [ ] Co-author footer cuando aplique (Claude):
  ```
  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
  ```
- [ ] **NO** crear commit si no se pidió explícitamente. Confirmar con el user.

### Jira

- [ ] Añadir comentario de cierre con:
  - Resumen de lo entregado (3-5 bullets máx).
  - Links a commits / PRs si aplican.
  - Lo que **NO** entró (follow-ups, deferred).
- [ ] Transicionar a `Completado` (o el status final del workflow).
- [ ] Si hay follow-ups identificados, crearlos como issues nuevos linkeados
  a este (no como TODOs en código).

### Memoria

- [ ] Actualizar `MEMORY.md` en la sección "Backlog activo":
  - Tachar el issue cerrado.
  - Actualizar la fecha del bloque.
  - Si el cierre desbloquea otro issue, anotarlo.
- [ ] Si descubriste algo durable (constraint, gotcha, pattern), crear
  memory de tipo `feedback` o `project`. NO duplicar info derivable del
  código.

### Tras el push: comprobar el CI

Un push puede disparar un workflow, y **un CI en rojo pasa desapercibido** — el
push devuelve 0 igualmente y nadie se entera hasta días después.

- [ ] Comprobar si el repo tiene workflows con trigger `push`:
      `ls .github/workflows/` y mirar su `on:`.
- [ ] Si los hay, tras el push: `gh run list --limit 3`.
- [ ] Si sale `failure`, **mirar la causa antes de seguir**: `gh run view <id>`.
      Distinguir tres cosas que se ven igual desde fuera:
      - **El job no arranca** (dura 1-5 s, sin pasos): problema de cuenta —
        facturación, límite de gasto. No es el código.
      - **Falla el checkout**: casi siempre el token del submódulo privado
        (`SDK_SUBMODULE_TOKEN`), caducado o sin permiso.
      - **Falla un paso real**: eso sí es tuyo.
- [ ] Si el fallo NO es del código, **decirlo explícitamente al user** — es suyo
      resolverlo, y mientras tanto los pushes van sin red.

**Qué dispara qué hoy** (2026-07-30):

| Repo | Workflow | Trigger |
|---|---|---|
| `kromia-sdk` | `krp-drift.yml` (paridad TS↔Dart) · `docs.yml` | **push** |
| `Kromia_NodeJS` | `api-map-drift.yml` | **push** a `main`, filtrado por paths |
| `kromia-studio` | — | *(no tiene workflows)* |
| `kromia-mobile` | `ios-build.yml` | solo manual (`workflow_dispatch`) |

### Cross-repo (cuando el cambio toca varios)

- [ ] Si modificaste KRP: bump tag en `kromia-sdk`
  (ver [bump-protocol.md](bump-protocol.md)).
- [ ] Si el cambio requiere acción en otro repo (Flutter, NodeJS), abrir
  issue de seguimiento ahí o documentarlo en la descripción de cierre.

### Limpieza

- [ ] Borrar tareas de `TaskCreate` ya completadas (housekeeping).
- [ ] Si trabajaste en worktree: confirmar con el user antes de hacer
  cleanup.

## Pitfalls conocidos

- **Cerrar con tests rotos**: si el cambio rompe algo no relacionado y lo
  detectas, NO cierres. Investigar root cause o crear hotfix issue.
- **Memoria-bloat**: no guardes "cerré KRO-X el día Y haciendo Z". Eso
  está en Jira. La memoria es para lo que NO se puede derivar de Jira o
  git (decisiones, constraints, preferencias).
- **Follow-ups en TODOs**: si encontraste cosas pendientes durante la
  ejecución, NO las dejes como `// TODO` en código. Crea issue Jira o
  usa `spawn_task`.
- **Dar el push por bueno porque no dio error**: el push local puede salir
  perfecto y el CI caerse tres segundos después. Si el repo tiene workflows de
  `push`, el trabajo no está cerrado hasta haberlos mirado.

## Last verified

2026-07-30 — se añade la comprobación del CI tras el push (el CI del SDK y
el del backend llevaban días en rojo sin que nadie lo mirara).
