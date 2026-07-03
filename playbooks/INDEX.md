# Playbooks INDEX

> **Cuándo aplicar un playbook**: cuando vas a modificar comportamiento del
> sistema (código, contratos, configuración, flujo de trabajo).
>
> **Cuándo NO**: cambios triviales (typo, formato, comentario, dependencia
> menor, refactor cosmético sin cambio de API). Procede normal.
>
> Si dudas, leer es barato — abre el playbook.

## Routing

| Voy a... | Playbook |
| --- | --- |
| Añadir un **behavior** nuevo | [add-behavior.md](add-behavior.md) |
| Añadir una **action** nueva | [add-action.md](add-action.md) |
| Añadir o modificar una **recipe** (incluye slots, slot kinds) | [add-recipe.md](add-recipe.md) |
| Subir `protocolVersion` del KRP o de cualquier contract | [bump-protocol.md](bump-protocol.md) |
| Versionar una app (Studio/backend/Flutter) o actualizar su **CHANGELOG** | [versioning.md](versioning.md) |
| Empezar una feature/bug/mejora nueva (planificación, Jira, branch) | [start-feature.md](start-feature.md) |
| Cerrar una tarea (cierre Jira, memoria, commits, follow-ups) | [ship-task.md](ship-task.md) |
| Añadir o modificar un **playbook** | [add-playbook.md](add-playbook.md) |

## Convención de formato

Cada playbook sigue esta estructura mínima:

```markdown
# <nombre>

**Cuándo aplica**: <frase corta que describe el trigger>.

## Pasos
- [ ] <paso ejecutable>
- [ ] ...

## Pitfalls conocidos
- ...

## Last verified
<YYYY-MM-DD> — <issue Jira o commit>
```

Reglas:

- Un playbook = **una pantalla**. Si crece, divídelo o muévelo a doc densa.
- Checklist accionable, no prosa.
- "Last verified" se actualiza cuando alguien ejecuta el playbook end-to-end.
  Si encuentras algo obsoleto, lo arreglas en el mismo PR.

## Drift / mantenimiento

Sweep manual trimestral: revisar `Last verified` de cada playbook. Si > 6
meses sin re-verify y el sistema documentado ha cambiado, refrescar.
