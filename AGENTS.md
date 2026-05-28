# AGENTS.md — Onboarding del SDK Kromia

Lectura rápida para devs (humanos o IA) que entran a tocar este repo.
Si ya conoces el contexto, salta a [Tabla de helpers](#qué-helper-uso-para-qué) o [Workflow](#workflow-de-bump--cross-repo).

> Para CONSUMIR el SDK desde un cliente (Studio, futuro Flutter) ver
> [`README.md`](README.md). Este doc cubre **mantener el SDK desde dentro**.

---

## Mapa de paquetes

| Paquete | Qué contiene | Consumers | Bundle |
|---|---|---|---|
| `@kromia/core` | Modelo (types, registries, validators, synth, helpers puros) — sin React | Studio, Backend NodeJS, futuro Flutter (via mirror) | source `.ts`, transpilado por el consumer |
| `@kromia/react` | 8 recipe components + utilities (AvatarBox, ScalarText, …) — React 19 + Tailwind v3+ | Studio, herramientas internas React | source `.tsx`, `transpilePackages` en Next |
| `@kromia/flutter` *(futuro KRO-83)* | Mirror Dart de los recipes | Flutter app cliente | Dart package |

Diagrama de dependencias:

```
@kromia/react ──depends-on──▶ @kromia/core
@kromia/flutter ──mirrors──▶ @kromia/core (mismas APIs, otra plataforma)
       ▲                              ▲
       │                              │
   Studio                       Backend NodeJS
                                (solo @kromia/core)
```

Reglas duras:

- **`@kromia/core` NO depende de React.** Si tienes que añadir un helper que renderiza JSX, va a `@kromia/react`. Si es lógica pura (transformar datos, validar, calcular), va a `@kromia/core`.
- **Catálogos cerrados en `@kromia/core`.** Cualquier nuevo behavior, recipe, action, field type, appearance option vive aquí. Los consumers NO duplican.
- **Texto visible al publisher en `@kromia/core/options.ts`.** Studio renderiza dropdowns leyendo de aquí — añadir opción en SDK = aparece en todos los dropdowns sin tocar Studio.

---

## ¿Qué helper uso para qué?

### Modelar / registries — `@kromia/core`

| Necesito… | Helper | Notas |
|---|---|---|
| Lista de field types disponibles | `allFieldTypes()` / `FIELD_TYPE_IDS` | `text`, `number`, `image`, `array<image>`, `select`, `cardRef`, etc. |
| Saber qué behaviors aplican a un type | `getBehaviorsByType(fieldType)` | Devuelve `BehaviorDefinition[]` filtrados |
| Sugerir behavior por nombre de field | `suggestBehavior(key, type)` | Devuelve `BehaviorId | null`. Heurístico — usado en auto-fill del editor |
| Resolver behavior por id | `getBehavior(id)` | Para mostrar label/description |
| Lista de recipes (todas / filtradas por kind) | `allRecipes()` / `allRecipesByKind('list' \| 'detail')` | Editor monta dropdowns con esto |
| Lookup recipe por id | `getRecipeManifest(id)` | Devuelve `RecipeManifest` con slots, kind, displayName |
| Lista de actions (none, navigate_to_detail, …) | `allActions()` / `ACTION_IDS` | 5 acciones cerradas |
| Lista de slot accept kinds + meta | `SLOT_ACCEPT_KIND_META` | label + description por kind |

### Validar — `@kromia/core`

| Necesito… | Helper | Notas |
|---|---|---|
| Validar una ViewComposition | `validateComposition(vc, fields, options?)` | KRO-79/80. 14 reglas (slot required, action targets, compat…). Devuelve `ValidationIssue[]` con severity. **Usado cross-repo** (Studio handleSubmit + Backend pre-persist) |
| ¿Un field es compatible con un slot? | `isFieldCompatibleWithSlot(field, slot)` | Boolean, basado en `slot.accepts` |
| ¿Qué slots aplican tras slot overrides V5? | `getEffectiveSlots(manifest, overrides)` | Resuelve disabled + custom + order |
| Validar overrides per-instance | `validateSlotOverrides(overrides, manifest)` | Disabled no debe matar required, custom no debe colisionar con built-in |
| Clasificar un field por uso semántico | `classifyField(field)` | Devuelve `'identifier' \| 'image' \| 'scalar' \| 'sectionRef' \| 'cardRef' \| 'enum'` |

### Renderizar — `@kromia/react`

| Necesito… | Helper / Component | Notas |
|---|---|---|
| Renderizar UNA composition (lista o detalle) | `<RecipeRenderer composition={...} item={...} />` | Dispatcher principal — Studio AppPreview lo usa |
| Renderizar una receta anidada (card-ref) | `<NestedRecipeRenderer slot={...} parentItem={...} />` | Para slots `card-ref` con `targetRecipe` |
| Resolver slot a values + appearance | `resolveSlot(slotComp, fields, item)` | Helper puro, devuelve `ResolvedSlot` con fields, format, appearance |
| Composable text (joiner de N fields) | `<ComposableSlot input={...} />` | Renderiza "Año · Ciudad · Categoría" con separador configurable |
| Renderizar avatar (image o iniciales fallback) | `<AvatarBox src={...} fallbackName={...} />` | Con InitialsAvatar built-in |
| Render scalar con format | `<ScalarText value={...} field={...} />` | Aplica behavior format (year, currency, percentage…) |
| Clases Tailwind para shape/aspect/size | `appearanceShapeClass()` / `appearanceAspectClass()` / … | Helpers puros, no JSX |

### Generar datos sintéticos — `@kromia/core/synth`

| Necesito… | Helper | Notas |
|---|---|---|
| Generar N items sintéticos para preview | `synthSectionItems(sectionKey, section, n)` | KRO-72. Determinista por seed (sectionKey). Studio AppPreview lo usa |
| Generar valor sintético de UN field | `synthFieldValue(field, seed)` | Útil para llenar tabla de muestra |

### Formato / extracción — `@kromia/core`

| Necesito… | Helper | Notas |
|---|---|---|
| Formatear un scalar para mostrar (año, %, €, fecha…) | `formatScalar(value, field)` | KRO-73. Honra behavior + locale es-ES. Único punto de entrada de formato |
| Auto-generar ViewComposition de detalle desde una de lista | `buildAutoDetailComposition(listVC, fields)` | KRO-73. Studio lo usa cuando user pulsa "Autogenerar" |
| Extraer color accent de un item según field | `extractAccentSettings(item, fields)` | KRO-73. Devuelve `AccentSettings { color, position? }` |
| Mezclar valores de N fields en un texto | `composeSlotValues(input)` | KRO-73. Aplica separadores + skip empty |

### Catálogos para dropdowns — `@kromia/core/options`

KRO-75 — añadir opción aquí = aparece automáticamente en el editor.

| Necesito… | Export |
|---|---|
| Labels es-ES de las acciones | `OPTIONS_ACTION_LABELS` |
| Opciones de cada appearance prop | `OPTIONS_APPEARANCE_{SHAPE,ASPECT,ALIGN,WEIGHT,SIZE,TRUNCATE,PADDING_Y,ACCENT_POSITION}` |
| Labels + descripciones de appearance props | `OPTIONS_APPEARANCE_LABELS` / `OPTIONS_APPEARANCE_DESCRIPTIONS` |
| Presets compuestos (Avatar redondo, Banner ancho…) | `APPEARANCE_PRESETS` + `detectActivePreset(appearance)` |
| Aspect ratios + tamaños físicos de carta | `CARD_ASPECTS` / `CARD_SIZES` / `DEFAULT_CARD_FORMAT` |

---

## Workflow de bump + cross-repo

### Cuándo bumpeo qué nivel SemVer

| Tipo de cambio | Patch (X.Y.**Z**) | Minor (X.**Y**.0) | Major (**X**.0.0) |
|---|---|---|---|
| Typo en label/description | ✅ | | |
| Bug fix en helper interno (sin cambiar API) | ✅ | | |
| Nuevo behavior / recipe / action | | ✅ | |
| Nueva función pública | | ✅ | |
| Nuevo campo opcional en interface | | ✅ | |
| Renombrar export | | | ✅ |
| Eliminar export | | | ✅ |
| Cambio breaking en shape de un type | | | ✅ |
| Rename de package | | | ✅ |

**KRO-63 auto-bumper** detecta shape changes en el JSON output y bumpea automáticamente. Si añades algo nuevo + el bumper no lo detecta → fuerza tú el bump manual + tag.

### Workflow paso a paso

1. **Editar en `kromia-sdk/`** (tienes el submodule abierto en el repo Studio o trabajas standalone).
2. **`cd packages/core && pnpm test`** — suite verde.
3. **Bump version** en `packages/<pkg>/package.json` según tabla.
4. **Commit + tag** con prefix de dominio: `git tag krp/v2.1.0` (`krp` = Kromia Recipe Protocol).
5. **Push del SDK + push del tag**: `git push && git push --tags`.
6. **En Studio (consumer)**: `pnpm add "@kromia/core@file:./kromia-sdk/packages/core"` — fuerza relink (ver [gotcha pnpm](#gotchas)).
7. **Restart dev server** (Turbopack no detecta cambios dentro de node_modules sin restart).
8. **Si era cross-repo (Backend o futuro Flutter)**: aplicar mismo bump + cablear en los otros consumers. Ver [`playbooks/bump-protocol.md`](playbooks/bump-protocol.md).

### Cómo cablear un consumer nuevo

- **TypeScript (Backend NodeJS)**: añadir submodule + `tsconfig.json` paths + `jest.config.ts` moduleNameMapper apuntando a `kromia-sdk/packages/core/src/index.ts`. Patrón existente: ver `Kromia_NodeJS/src/modules/Albums/Core/services/viewCompositionValidator.ts` (KRO-80, thin wrapper).
- **React (Studio)**: `pnpm add @kromia/react@file:...` + `next.config.ts > transpilePackages: ['@kromia/core', '@kromia/react']` + Tailwind `@source` directive al package source.
- **Otro framework**: respetar las reglas: solo importar de `@kromia/core` (NO de paths internos), pin a tag específico (NO `main`), respetar la matriz SemVer.

---

## Gotchas

### pnpm + Windows: file: deps son copia, no symlink

Tras commit en SDK con bump O ANY edit interno, `pnpm install` en Studio reporta "Already up to date" pero `node_modules/@kromia/core/src/` sigue stale. Fix:

```bash
pnpm add "@kromia/core@file:./kromia-sdk/packages/core"
```

Esto fuerza re-copy. Si tienes dev server corriendo, **además restart** (Turbopack cachea node_modules).

Verificación rápida que la copia es buena:

```bash
grep "el-cambio-que-acabas-de-hacer" node_modules/@kromia/core/src/...
```

Si no aparece → relink no funcionó.

Linked memory: `kromia-studio/memory/feedback_sdk_refresh.md` (mantenida cada vez que reproducimos el bug).

### Submodule no se mueve solo

Si en Studio bumpeas el pointer del submodule, NO olvides commit el pointer también:

```bash
cd kromia-sdk && git pull origin main && cd ..
git add kromia-sdk && git commit -m "chore(krp): bump submodule a <SHA>"
```

`git submodule update --remote` puede ayudar pero verifica siempre el SHA esperado antes de commit.

### No mezclar @kromia/core y código UI

Si te tienta añadir un helper que devuelve JSX en `@kromia/core` — para. Va a `@kromia/react`. Razón: `@kromia/flutter` (futuro) consume solo `@kromia/core` y no puede ejecutar React.

### Tests del SDK son agnósticos de framework

Los tests de `@kromia/core` corren con Vitest en Node. No imports de React, no JSX, no fs. Si necesitas testear renderers, vete a `@kromia/react/tests/`.

---

## Cuándo usar cada playbook

Tabla rápida → ver [`playbooks/INDEX.md`](playbooks/INDEX.md) para enlaces completos.

| Voy a… | Playbook | Cuándo NO usarlo |
|---|---|---|
| Añadir un behavior nuevo | `add-behavior.md` | Solo cambias label/description de uno existente |
| Añadir una action nueva | `add-action.md` | Solo cambias label es-ES (eso es `options.ts` directo) |
| Añadir / modificar una recipe | `add-recipe.md` | Solo cambias displayName o description |
| Subir `protocolVersion` | `bump-protocol.md` | Auto-bumper de KRO-63 lo hace por ti en cambios shape-detectable |
| Empezar feature/bug/mejora | `start-feature.md` | Cambio menor que cabe en un commit |
| Cerrar tarea (Jira, memoria, follow-ups) | `ship-task.md` | Siempre — el cierre es disciplinado |
| Añadir / modificar un playbook | `add-playbook.md` | Solo arreglar typo |

---

## Filosofía

- **Source-of-truth ÚNICO + clientes que CONSUMEN, nunca duplican.**
- **Tipos y catálogos son lenguaje-neutros.** Si Studio lo necesita, Flutter también — vive en `@kromia/core`.
- **Cualquier UI específica de plataforma vive en el paquete de esa plataforma** (`@kromia/react`, `@kromia/flutter`).
- **Documenta el "por qué" en el código, el "cómo" en los playbooks, el "qué" en este AGENTS.**

---

## Last verified

2026-05-29 — sesión Claude post-KRO-87.
