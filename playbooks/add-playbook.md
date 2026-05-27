# add-playbook

**Cuándo aplica**: detectaste un flujo repetido (humano o IA) que merece
ser convertido en playbook. Meta: este playbook describe cómo añadir otros
playbooks.

## Criterios para crear un playbook

Un flujo merece playbook si cumple **al menos 2** de:

- Se ha repetido ≥ 3 veces sin un guion claro.
- Toca múltiples archivos / repos coordinadamente.
- Ha causado regresiones por olvido de un paso.
- Conviene que un agente IA lo siga sin pedir contexto adicional.

Si solo ocurre una vez al año → docs/notas, NO playbook.

## Pasos

- [ ] Crear `playbooks/<nombre>.md`. Convención de nombre: `<verbo>-<sustantivo>`
  en kebab-case. Ejemplos: `add-behavior`, `bump-protocol`, `ship-task`.
- [ ] Seguir el template:

  ```markdown
  # <nombre>

  **Cuándo aplica**: <una frase>.

  ## Pasos

  ### <Sección>

  - [ ] <paso ejecutable: comando, edición concreta, decisión binaria>
  - [ ] ...

  ## Pitfalls conocidos

  - ...

  ## Last verified

  <YYYY-MM-DD> — <issue Jira o "setup inicial">
  ```

- [ ] Añadir entrada en `INDEX.md` en la tabla de routing. Forma:
  ```
  | Voy a... | [<nombre>.md](<nombre>.md) |
  ```
- [ ] Si el playbook es complemento de uno existente (caso particular),
  enlazar desde el padre y NO duplicar pasos.

## Reglas de estilo

- **Una pantalla máx**. Si crece, divídelo o convertelo en doc densa.
- **Checklist accionable**. Cada bullet debe ser algo que puedas hacer o
  decidir. NO prosa abstracta.
- **Pitfalls explícitos**. Cosas que ya fallaron antes (con referencia a
  issue Jira si se documentó).
- **Last verified**. Fecha + contexto. Se actualiza cuando alguien lo
  ejecuta end-to-end y detecta drift.

## Anti-patterns

- Playbook que dice "depende del caso" en cada paso → no es playbook,
  es checklist genérica. Refinar o no crear.
- Playbook que duplica un README ya existente → enlazar al README, no
  copiar.
- Playbook con > 50 bullets → demasiado grande. Subdivide.

## Pitfalls conocidos

- **No tocar AGENTS.md por playbook nuevo**: el `@import` del INDEX en
  `AGENTS.md` (Studio, Flutter, NodeJS) ya carga este index. Añadir un
  playbook = editar solo `INDEX.md` + nuevo `.md`. Si te pides editar
  AGENTS.md por un playbook nuevo, es señal de que algo está mal.
- **Renombrar un playbook**: editar `INDEX.md` + cualquier playbook que lo
  referencie. Considerar dejar un stub redirect si ya estaba en uso.

## Last verified

2026-05-27 — setup inicial del repo.
