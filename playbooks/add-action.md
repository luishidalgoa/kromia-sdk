# add-action

**Cuándo aplica**: vas a añadir una nueva action al sistema (ej:
`navigate_to_detail`, `expand_inline`, `external_link`...). Una action define
qué pasa cuando el usuario toca un item en una recipe `list`.

## Pasos

### Studio (kromia-studio)

- [ ] Hoy las actions están **hardcoded** en
  `scripts/generate-recipe-protocol.ts` (constante `ACTIONS`). KRP V1.5 las
  moverá a `src/lib/action-registry.ts`. Mientras tanto:
  - Si V1.5 ya está shipped → editar `src/lib/action-registry.ts`.
  - Si no → editar la constante `ACTIONS` en el generator script.
- [ ] Campos obligatorios por entrada:
  - `id` (snake_case)
  - `displayName`, `description`
  - `transition`: `'static' | 'push' | 'modal' | 'inline' | 'external'`
  - `requiresTargetRecipe?`, `targetRecipeKind?`, `requiresExpandRecipe?`,
    `requiresLinkField?` según aplique.
- [ ] Si la action introduce nuevo flujo visual, implementarlo en el
  AppPreview (`src/components/album/SectionAppPreview.tsx` y similares) +
  el editor (`ViewCompositionTreeEditor.tsx` para nuevos campos requeridos).
- [ ] Validar en `viewCompositionValidator.ts` (Studio) si la action exige
  campos en la composition (target/expand/linkField).
- [ ] Regenerar contract: `pnpm gen:protocol`.
- [ ] Verificar `contracts/kromia-recipe-protocol-v1.json` → sección
  `actions` + `compatibilityMatrix[<recipe>].allowedActions`.

### Flutter (kromia-flutter) — cuando KRO-65 esté shipped

- [ ] Añadir handler de la action en el navigator / overlay manager.
- [ ] Si `transition: 'external'` → integrar con `url_launcher` o equivalente.
- [ ] Si `transition: 'modal'` → bottom sheet con la recipe declarada en
  `targetRecipe`.

### Backend (Kromia_NodeJS)

- [ ] **NO se toca**. El validator backend es permisivo (acepta cualquier
  string non-empty en `composition.action`).

### Contract / Versionado

- [ ] Cambio **minor** (1.x.0 → 1.(x+1).0). El cliente Flutter antiguo
  ignora la action desconocida (renderiza como `none`).
- [ ] Seguir [bump-protocol.md](bump-protocol.md).

### Jira

- [ ] Subtarea de `KRO-21`.
- [ ] Labels: `feature`, `frontend`, `behaviors`.

### Git

- [ ] Commit message: `feat(actions): añadir <id> — <descripción>`.

## Pitfalls conocidos

- **transition='inline'** requiere `requiresExpandRecipe: true` y la
  composition debe declarar `expand` (mini-receta accordion).
- **transition='external'** requiere `requiresLinkField: true` y el field
  apuntado debe tener behavior `url | email | phone`.
- **transition='push' | 'modal'** requieren `targetRecipe` declarado y que
  esa recipe sea de `kind: 'detail'`.

## Last verified

2026-05-27 — setup inicial del repo.
