# start-feature

**Cuándo aplica**: vas a empezar una feature, bug, mejora o cualquier trabajo
que merezca tracking. Si es una corrección trivial (typo, log de debug),
salta este playbook.

## Pasos

### Planificación

- [ ] Definir scope en 1-2 frases. Si no cabe, el alcance es demasiado grande
  → dividir en sub-features primero.
- [ ] Identificar el padre Jira: parent feature, área del backlog
  (KRO-21 = recetas/slots, KRO-61 = KRP, etc.).
- [ ] Verificar que NO existe ya un issue duplicado (buscar en Jira con
  keywords).

### Jira

- [ ] Crear issue en proyecto `KRO`:
  - **Type**: `Subtarea` (si tiene padre) o `Task`.
  - **Summary**: imperativo, < 80 chars. Ej: "Centralizar actions en
    action-registry.ts".
  - **Description**: contexto + alcance + criterios de aceptación (checklist).
  - **Labels**: combinación de `feature` | `bug` | `mejora` | `ux` |
    `backend` | `frontend` | `behaviors` | `process`.
  - **Parent**: el padre identificado.
- [ ] Status inicial: `In Progress` si vas a empezar ya, `To Do` si lo dejas
  preparado.

### Memoria (auto-memory de Claude)

- [ ] Si el issue desbloquea / bloquea otros tracking issues, actualizar
  `MEMORY.md` index en la sección "Backlog activo".
- [ ] Si introduce decisión arquitectónica durable (no derivable del código),
  crear/actualizar memory de tipo `project`.

### Branch / Worktree

- [ ] Worktree si la feature toca muchos archivos en paralelo: lo crea el
  user con `/worktree` o equivalente.
- [ ] Branch si es modificación simple: `feat/<short-name>`, `fix/<short-name>`,
  `chore/<short-name>`.

### Análisis previo (cuando aplique)

- [ ] Si la feature modifica algo del KRP, behaviors, actions, recipes,
  slot kinds → identificar el playbook correspondiente del INDEX y
  enlazarlo en la descripción del issue.
- [ ] Si la feature impacta múltiples repos (Studio + Flutter + NodeJS),
  documentar la lista en la descripción.

## Pitfalls conocidos

- **Issues sin padre**: cualquier issue debería tener un parent feature o
  ser una task standalone justificada. Si no lo tienes claro, parkearlo
  como `💡Ideas` hasta que se aclare.
- **Labels críticos**: `historic` se reserva para trabajo ya hecho que
  documentas a posteriori; NO usarlo para issues en curso. `drift` solo
  lo abre el detector automático (KRO-64).
- **Scope creep**: si durante la ejecución descubres trabajo adicional, NO
  lo mezcles. Crea follow-up issues (o usa `mcp__ccd_session__spawn_task`).

## Last verified

2026-05-27 — setup inicial del repo.
