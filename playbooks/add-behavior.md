# add-behavior

**Cuándo aplica**: vas a añadir un nuevo behavior al sistema (ej: `currency`,
`color_hex`, `iso_date`...). Un behavior define cómo se interpreta y renderiza
un field además de su `type` base.

## Pasos

### Studio (kromia-studio)

- [ ] Añadir entrada en `src/lib/behavior-registry.ts`:
  - `id` (snake_case, único, lo que se guarda en BD)
  - `displayName` (UI)
  - `description` (frase corta, aparece en tooltip + KRO-70)
  - `applicableTypes` (tipos base compatibles: `'text'`, `'number'`,
    `'textarea'`, `'array<image>'`, etc.)
- [ ] Actualizar `classifyField` en `src/components/album/recipes/recipe-registry.ts`:
  si el behavior introduce reglas de mapeo a un `SlotAcceptKind`, añadir el
  branch correspondiente.
- [ ] Si renderiza diferente en el preview, actualizar las recipes afectadas
  en `src/components/album/recipes/<Recipe>.tsx`.
- [ ] Regenerar contract: `pnpm gen:protocol`.
- [ ] Verificar diff de `contracts/kromia-recipe-protocol-v1.json` — debe
  aparecer el behavior nuevo en la sección `behaviors` y, si aplica, en
  `slotAcceptKinds[*].behaviorIds`.

### Flutter (kromia-flutter) — cuando KRO-65 esté shipped

- [ ] Si el behavior introduce render no genérico (ej: `currency` formato €,
  `iso_date` con locale), añadir handler en `lib/widgets/behaviors/`.
- [ ] Si solo afecta texto/estilo, el render genérico debería bastar.

### Backend (Kromia_NodeJS)

- [ ] **Por defecto NO se toca**. El backend es permisivo (acepta cualquier
  string en `field.behavior`).
- [ ] Excepción: si el behavior implica un nuevo `type` base que el backend
  valida, añadir el type en `BehaviorRegistry.ts` + tests.

### Contract / Versionado

- [ ] Esto es un cambio **patch** (1.0.0 → 1.0.1). Solo se añade metadata,
  no se rompe nada existente.
- [ ] Seguir [bump-protocol.md](bump-protocol.md) para el bump.

### Jira

- [ ] Subtarea de `KRO-21` (parent de behaviors).
- [ ] Labels: `feature`, `behaviors`, `frontend`.
- [ ] Si es controvertido / experimental: status `💡Ideas` hasta validar.

### Git

- [ ] Branch: `feat/behavior-<id>` o trabajar en main si es trivial.
- [ ] Commit message: `feat(behaviors): añadir <id> — <descripción corta>`.

## Pitfalls conocidos

- **color_hex es type=text pero NO va en text-short slots** (KRO-69). Si tu
  behavior nuevo tiene una situación similar (mismo type, semántica diferente),
  añadir el branch en `classifyField` que lo excluye explícitamente.
- **applicableTypes con `array<X>`** requiere que el backend acepte ese type
  base. Verificar antes de añadirlo en frontend.
- **Si el behavior tiene config (ej: `currency` con símbolo)**, definir
  schema de config en el behavior-registry y propagarlo al KRP. Hoy el KRP
  no serializa configs por behavior — tarea para KRP V1.5+.

## Last verified

2026-05-27 — setup inicial del repo.
