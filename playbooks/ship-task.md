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

### Cross-repo (cuando el cambio toca varios)

- [ ] Si modificaste KRP: bump tag en `kromia-protocol`
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

## Last verified

2026-05-27 — setup inicial del repo.
