# add-action

**Cuándo aplica**: vas a añadir una nueva action al sistema (ej:
`navigate_to_detail`, `expand_inline`, `external_link`...). Una action define
qué pasa cuando el usuario toca un item en una recipe `list`.

## Regla de oro

> La action se define en el **SDK** (`@kromia/protocol`), no en Studio
> ni en Flutter. Los clientes lo **consumen** vía import del paquete.

## Pasos

### SDK (`kromia-sdk/packages/protocol-ts/`)

- [ ] Añadir entrada en `src/registries/actions.ts`:
  - `id` (snake_case)
  - `displayName`, `description`
  - `transition`: `'static' | 'push' | 'modal' | 'inline' | 'external'`
  - `requiresTargetRecipe?`, `targetRecipeKind?`,
    `requiresExpandRecipe?`, `requiresLinkField?` según aplique.
- [ ] `pnpm test` debe pasar (las actions no tienen corpus específico hoy
  pero los tests del modelo deben seguir verdes).
- [ ] Regenerar: `pnpm gen`. Verificar `actions[]` + `compatibilityMatrix`
  + `connections.edges` (kind `recipe-action`).
- [ ] Si introduces un nuevo `transition` no existente, considerar si el
  shape de `ActionDefinition` debe extenderse (eso sería **major** bump).

### Studio (`kromia-studio/`)

- [ ] **NO se toca el modelo** — viene del SDK.
- [ ] Si la action introduce nuevo flujo visual, implementarlo en el
  AppPreview (`src/components/album/SectionAppPreview.tsx` y similares) +
  el editor (`ViewCompositionTreeEditor.tsx` para nuevos campos requeridos).
- [ ] Validar en `viewCompositionValidator.ts` (Studio) si la action exige
  campos en la composition (target/expand/linkField). El validador puede
  reusar las constraint flags del `ActionDefinition` vía
  `getAction(id)?.requiresTargetRecipe`.

### Flutter — cuando KRO-65 esté shipped

- [ ] Añadir handler de la action en el navigator / overlay manager.
- [ ] `transition: 'external'` → integrar con `url_launcher` o equivalente.
- [ ] `transition: 'modal'` → bottom sheet con la recipe declarada en
  `targetRecipe`.

### Backend (`Kromia_NodeJS/`)

- [ ] **NO se toca**. El validator backend es permisivo (acepta cualquier
  string non-empty en `composition.action`).

### Contract / Versionado

- [ ] Cambio **minor** (1.x.0 → 1.(x+1).0). El cliente antiguo ignora la
  action desconocida (renderiza como `none`).
- [ ] Bump version en `packages/protocol-ts/package.json` + `PROTOCOL_VERSION`.
- [ ] Seguir [bump-protocol.md](bump-protocol.md).

### Jira

- [ ] Subtarea de `KRO-21`.
- [ ] Labels: `feature`, `SDK`. Añadir `Studio` si requiere trabajo en
  AppPreview o editor.

### Git

- [ ] **Commit en kromia-sdk**: `feat(actions): añadir <id> — <descripción>`.
- [ ] **Commit en kromia-studio**: solo si hubo trabajo en AppPreview/editor.

## Pitfalls conocidos

- **transition='inline'** requiere `requiresExpandRecipe: true` y la
  composition debe declarar `expand` (mini-receta accordion).
- **transition='external'** requiere `requiresLinkField: true` y el field
  apuntado debe tener behavior `url | email | phone`.
- **transition='push' | 'modal'** requieren `targetRecipe` declarado y que
  esa recipe sea de `kind: 'detail'`.

## Last verified

2026-05-27 — KRP V1.5 (KRO-71 Fase 2 shipped, monorepo + SDK activos).
