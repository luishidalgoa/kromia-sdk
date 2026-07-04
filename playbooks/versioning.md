# versioning

**Cuándo aplica**: cerraste trabajo user-facing (parte de [ship-task.md](ship-task.md))
o vas a **cortar una versión** de una app (Studio / backend / Flutter). Regla
PRIMORDIAL del proyecto: el versionado NO se improvisa.

## Los DOS ejes de versión (no confundir)

1. **Contrato KRP** (`protocolVersion` del `.json`): versión de la MÁQUINA. La
   **auto-bumpea** `generate.ts` cuando cambia el modelo (contrato). Coincide con
   `@kromia/core.version` → es también la versión del **SDK**. Ver
   [bump-protocol.md](bump-protocol.md). NO se toca a mano ni se mezcla con la
   versión de las apps.
2. **Versión de APP** (Studio, backend, Flutter): versión para el HUMANO.
   **SemVer + `CHANGELOG.md` curado**. Cada app se versiona independiente (Studio
   puede ir 0.10.0 mientras el backend va 0.8.0).

**El SDK TAMBIÉN lleva `CHANGELOG.md`** (raíz de `kromia-sdk`), pero keyeado por su
`protocolVersion` (eje 1), no por una SemVer de app. OJO: los cambios **DATA /
aditivos** (tipos nuevos, helpers, un paquete nuevo como `@kromia/mcp`) **NO
bumpean el protocolVersion** → se acumulan en `[Unreleased]` hasta el próximo bump
de contrato (o hasta que se decida cortar un release del SDK). Los commits de
`core_dart`/`flutter` (espejo Dart) son paridad de otro chat → no se listan uno a
uno (nota "paridad Dart al día" basta).

## SemVer (pre-1.0 → `0.MINOR.PATCH`)

- **MINOR** (`0.X.0`): features nuevas o cambios de comportamiento notables
  (en 0.x pueden ser rompedores — es normal antes de 1.0).
- **PATCH** (`0.x.Y`): fixes y mejoras pequeñas sin feature nueva.
- `1.0.0` = cuando la app se considere estable para producción abierta.

## CHANGELOG.md — formato *Keep a Changelog*

Cada repo (Studio, backend, Flutter **y el SDK**) tiene su `CHANGELOG.md` en la
raíz. En **español**, NO un dump del git log. Las apps: orientado a usuario
(publisher/creador). El SDK: orientado a consumer del paquete (qué tipos/helpers/
recetas/renderers/tools cambiaron).

```markdown
## [Unreleased]
### Added
- Descripción de la feature user-facing (KRO-NN)
### Changed
- ...
### Fixed
- ...

## [0.4.0] - 2026-07-04
### Added
- ...
```

Categorías: **Added** (features) · **Changed** (mejoras/cambios de comportamiento)
· **Fixed** (bugs) · **Removed** · **Deprecated** · **Security**.

## Pasos

### Al cerrar trabajo user-facing (cada ship-task)
- [ ] Añade **1 entrada por cambio user-facing** (no por commit) bajo
  `## [Unreleased]`, en su categoría, con las refs `(KRO-NN)`.
- [ ] Los cambios triviales (typo, formato, refactor interno, bump de submódulo)
  NO van al changelog.
- [ ] Un cambio que toca varios repos → entrada en el `CHANGELOG.md` de **cada
  app afectada** (con su lenguaje: Studio/backend en su repo, Flutter en el suyo).

### Al cortar una versión (release)
- [ ] Decide MINOR vs PATCH según lo acumulado en `[Unreleased]`.
- [ ] Renombra `## [Unreleased]` → `## [X.Y.Z] - YYYY-MM-DD` y crea un
  `[Unreleased]` vacío arriba.
- [ ] Bump de la versión en `package.json` (Studio/backend) o `pubspec.yaml`
  (Flutter) a `X.Y.Z`.
- [ ] Tag `vX.Y.Z` en ese repo **solo con permiso del user** (aplica la regla
  "no push/tag sin permiso explícito"). Apunta el tag al **commit del corte** (el
  del bump/CHANGELOG), NO a HEAD si ya hay trabajo posterior en `[Unreleased]`.
- [ ] **GitHub Release** desde el tag (`gh release create vX.Y.Z --title … --notes-file <sección del CHANGELOG>`) — es un acto de PUBLICACIÓN → **con OK del user**. Notas = la sección `[X.Y.Z]` del CHANGELOG.
- [ ] No cortar versión por cada commit; hazlo en un batch/milestone coherente
  o cuando el user lo pida.

## Pitfalls conocidos
- **Confundir KRP-version con app-version**: son ejes distintos. El KRP se
  auto-bumpea; la app la curas tú.
- **Changelog = git log**: NO vuelques 1 línea por commit. Condensa por feature
  (muchos commits de una misma cosa = 1 entrada).
- **Tag/bump sin permiso**: cortar una versión toca `package.json` y crea tag →
  es un acto de release; confírmalo con el user (regla de no-push).
- **Idioma**: el changelog es cara al usuario → español claro, no jerga interna
  ni nombres de símbolos de código.

## Last verified

2026-07-04 — creación del histórico de CHANGELOG de Studio (585 commits del
último mes condensados) + esta política.
