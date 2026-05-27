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
| `kromia-recipe-protocol-v1` | kromia-studio (`scripts/generate-recipe-protocol.ts`) | kromia-flutter, wiki, drift detector CI | v1.0.0 (MVP) |

## kromia-recipe-protocol (KRP)

Catálogo de recetas + slots + behaviors + actions + matriz de compatibilidad
del editor de composiciones de Kromia.

- **Productor**: Studio TypeScript registries → generator → `.json`.
- **Consumers**: Flutter (renderer), wiki (KRO-46), drift detector (KRO-64).
- **Versionado**: `protocolVersion` interno + tag git. Patch = nuevo behavior;
  minor = nueva recipe/slot/kind; major = breaking shape.

Estructura del payload (resumen):

```jsonc
{
  "protocolVersion": "1.0.0",
  "generatedAt":     "2026-05-26T...",
  "generatedFrom":   { "registryPath": "...", "behaviorsPath": "..." },
  "recipes":             [ { id, kind, displayName, description, slots: [...] } ],
  "actions":             [ { id, displayName, description, transition, ... } ],
  "behaviors":           [ { id, displayName, description, applicableTypes, renderAs } ],
  "slotAcceptKinds":     [ { id, description, behaviorIds } ],
  "compatibilityMatrix": { "<recipeId>": { kindRole, allowedActions, ... } }
}
```

Ver `kromia-recipe-protocol-v1.schema.json` para el contrato completo.

### Cómo regenerar

Hoy: `pnpm gen:protocol` en kromia-studio escribe directamente en
`kromia-studio/contracts/`. La próxima iteración (KRP V1.5) cambia el output
path para escribir aquí, en el submodule.

### Notas

- `generatedAt` cambia en cada regeneración pero NO cuenta para drift
  detection. Los consumers lo ignoran al diffear.
- El generator debe ser determinístico salvo timestamp. Misma entrada en HEAD
  → mismo `.json` byte-a-byte (excepto esa línea).
- El compatibilityMatrix se deriva por `kind` (list/detail/expand). Si la
  lógica de constraints se refina, refactorizar el generator sin cambiar
  shape — eso requeriría bump major.
