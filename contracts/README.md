# Contracts

Artefactos **derivados** que consumen los clientes downstream sin acceso al
código fuente del proyecto productor.

Cada contrato vive bajo `contracts/<dominio>/` y se compone de:

- `<nombre>-v<N>.json` — payload generado.
- `<nombre>-v<N>.schema.json` — JSON Schema (Draft 2020-12) que valida el shape.
- Tag de git (`<dominio>/v1.0.0`) marca cada release del contrato.

**Regla**: el `.json` se regenera, el `.schema.json` se escribe a mano y es el
**contrato fijo**. Cambiar el schema = bump mayor + PRs coordinados en los
consumers.

## Contratos vigentes

| ID | Productor | Consumers | Estado |
| --- | --- | --- | --- |
| `kromia-recipe-protocol-v1` | `@kromia/core` (TypeScript SDK, productor real) | kromia-flutter (vía `protocol-dart` futuro), wiki, drift detector CI | v1.1.0 |

## kromia-recipe-protocol (KRP)

Catálogo de recetas + slots + behaviors + actions + matriz de compatibilidad
del editor de composiciones de Kromia.

- **Productor**: Studio TypeScript registries → generator → `.json`.
- **Consumers**: Flutter (renderer), wiki (KRO-46), drift detector (KRO-64).
- **Versionado**: `protocolVersion` interno + tag git. Patch = nuevo behavior;
  minor = nueva recipe/slot/kind; major = breaking shape.

Estructura del payload (v1.1.0):

```jsonc
{
  "protocolVersion": "1.1.0",
  "generatedAt":     "2026-05-27T...",
  "generatedFrom":   { "packagePath": "packages/core/", "note": "..." },
  "recipes":             [ { id, kind, displayName, description, slots: [...] } ],
  "actions":             [ { id, displayName, description, transition, ... } ],
  "behaviors":           [ { id, displayName, description, applicableTypes, renderAs } ],
  "slotAcceptKinds":     [ { id, description, behaviorIds } ],
  "fieldTypes":          [ { id, displayName, description, cardinality, elementType? } ],
  "compatibilityMatrix": { "<recipeId>": { kindRole, allowedActions, ... } },
  "connections":         { "nodes": [...], "edges": [...] }
}
```

### Nuevo en v1.1.0 (KRO-71 Fase 2D)

- **`fieldTypes`**: catálogo de los 8 types base (`text`, `textarea`, `number`,
  `select`, `image`, `array<string>`, `array<number>`, `array<image>`) con
  descripciones humanas. Antes implícito en `behaviors[*].applicableTypes`.
- **`connections`**: grafo explícito de aristas entre entidades. Nodos
  namespaced (`fieldType:text`, `behavior:url`, `slotKind:image`, etc.).
  Edges con `kind`: `type-behavior`, `behavior-slotKind`, `recipe-action`,
  `recipe-target`, `recipe-expand`. Útil para visualizadores, tooltips
  encadenados (KRO-70), wiki (KRO-46).
- `generatedFrom` simplificado a `packagePath` ahora que el productor es
  el paquete `@kromia/core`, no Studio directamente.

Ver `kromia-recipe-protocol-v1.schema.json` para el contrato completo.

### Cómo regenerar

Desde el root del monorepo (`kromia-sdk/`):

```bash
pnpm gen
```

O desde Studio: `pnpm gen:protocol` (forwards al submodule).

El output se escribe en `kromia-sdk/contracts/kromia-recipe-protocol-v1.json`.

### Notas

- `generatedAt` cambia en cada regeneración pero NO cuenta para drift
  detection. Los consumers lo ignoran al diffear.
- El generator debe ser determinístico salvo timestamp. Misma entrada en HEAD
  → mismo `.json` byte-a-byte (excepto esa línea).
- El compatibilityMatrix se deriva por `kind` (list/detail/expand). Si la
  lógica de constraints se refina, refactorizar el generator sin cambiar
  shape — eso requeriría bump major.
