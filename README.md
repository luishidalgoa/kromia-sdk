# kromia-sdk

Repositorio central de **contratos** y **playbooks** del ecosistema Kromia.
Lo consumen los proyectos cliente como **submodule**:

- `kromia-studio` (Next.js, editor web)
- `kromia-flutter` (Flutter, renderer móvil — futuro)
- `Kromia_NodeJS` (backend, opcional)

## Estructura

```
kromia-sdk/
├── contracts/                  ← datos versionados (machine-readable)
│   ├── kromia-recipe-protocol-v1.json
│   ├── kromia-recipe-protocol-v1.schema.json
│   └── README.md
├── playbooks/                  ← procesos paso-a-paso (human/AI-readable)
│   ├── INDEX.md                ← router (consumido vía @import en AGENTS.md)
│   ├── add-behavior.md
│   ├── add-action.md
│   ├── add-recipe.md
│   ├── bump-protocol.md
│   ├── start-feature.md
│   ├── ship-task.md
│   └── add-playbook.md
└── README.md
```

## Contracts

Artefactos JSON + JSON Schema que describen entidades estables del sistema
(recipes, behaviors, actions, slot kinds, compatibility matrix). Son
**lenguaje-neutros**: Studio los **produce** (generator TypeScript), Flutter
los **consume** (parser Dart).

Ver [`contracts/README.md`](contracts/README.md) para detalles.

## Playbooks

Guías paso-a-paso de "voy a hacer X". Cada repo cliente incluye el INDEX
en su `AGENTS.md` con `@import` para que la IA (o el dev humano) consulte
el playbook adecuado **antes** de modificar el sistema.

Ver [`playbooks/INDEX.md`](playbooks/INDEX.md) para el catálogo.

## Cómo consumir desde un proyecto cliente

### 1. Añadir como submodule

```bash
git submodule add <url-del-remote> kromia-sdk
git submodule update --init --recursive
```

Convención: el submodule vive en `kromia-sdk/` al root del repo
cliente. Si tu repo necesita otra ubicación, ajustar el path en `AGENTS.md`.

### 2. Importar el INDEX en `AGENTS.md` del cliente

```markdown
## Protocolos de modificación

Antes de cualquier modificación al código, contratos o configuración,
consulta el INDEX de playbooks. Si un playbook aplica → seguirlo.
Si nada matchea o el cambio es trivial → procede normal.

@kromia-sdk/playbooks/INDEX.md
```

El `@import` hace que el INDEX esté **siempre cargado** en el contexto de
la IA, sin tener que enumerar triggers en AGENTS.md.

### 3. Consumir contracts en build/runtime

- **Studio (productor)**: el generator (`pnpm gen:protocol`) escribe en
  `kromia-sdk/contracts/`. Cambios se commitean en este repo.
- **Flutter (consumer)**: parsea el `.json` del submodule en build time o
  lo embebe como asset.
- **Wiki / drift detector**: leen el `.json` directamente.

## Versionado

- Cada contract lleva su propia `protocolVersion` (`X.Y.Z`).
- Tags de git en este repo siguen formato `<dominio>/v<X.Y.Z>` —
  ej: `krp/v1.0.0`, `krp/v1.1.0`.
- Los repos cliente pinean al tag (NO a `main`) para evitar drift no
  intencional. Bump del pin = PR explícito.

Niveles (aplica a todos los contracts):

| Nivel | Cuándo | Acción en clientes |
|---|---|---|
| Patch | Solo metadata (descriptions, labels) | Auto-pull, sin trabajo |
| Minor | Nueva entidad backward-compatible | Pin opcional, sin breaking |
| Major | Breaking shape, eliminaciones | PR coordinado en TODOS los clientes |

Ver [`playbooks/bump-protocol.md`](playbooks/bump-protocol.md).

## Flujo de trabajo

```
1. Editor edita registries en kromia-studio/src/lib/*
        ↓
2. pnpm gen:protocol regenera kromia-sdk/contracts/*.json
        ↓
3. Commit + tag en kromia-sdk
        ↓
4. Clientes pinean al tag nuevo (manual o vía CI)
        ↓
5. Drift detector (KRO-64, futuro) abre auto-issue si major y un cliente
   no se actualizó
```

## Roadmap

- ✅ **Setup inicial** (este commit) — scaffold + KRP v1.0.0 + 7 playbooks.
- ⏳ **KRP V1.5** — Centralizar actions + field types + grafo de conexiones.
  Mover generator output a este repo. Tarea Jira pendiente.
- ⏳ **KRO-63** — SemVer auto-bump del generator basado en hash del payload.
- ⏳ **KRO-64** — Drift detector CI (auto-issue Jira en major bump sin
  alineación de Flutter).
- ⏳ **KRO-65** — Cliente Flutter consume el `.json` con fallback render.

## Filosofía

> Source-of-truth ÚNICO + clientes que CONSUMEN, nunca duplican.

- El contract es el contrato real, NO el código TS que lo produce.
- Los playbooks evitan que el conocimiento tribal se pierda en commits y
  conversaciones.
- Si dos lugares describen "qué es un behavior", solo uno gana — este.
# kromia-sdk
