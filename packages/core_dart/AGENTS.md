# core_dart — AGENTS.md

Espejo Dart 1:1 del SDK `@kromia/core` (TypeScript). Implementa el modelo/contrato Kromia en Dart (mismas APIs, misma lógica, otra plataforma) para que la app Flutter renderice composiciones sin reimplementar reglas. Paquete importado por la app vía path dependency.

## Regla de espejo (dura)

> **Fuente de verdad = `@kromia/core` (TS canónico).** Este paquete es un **espejo PASIVO**: toda la lógica y los catálogos se cambian PRIMERO en el TS y luego se portan aquí. La versión de paridad la fija `pubspec.yaml#version`, que DEBE converger con `package.json#version` del TS — comprueba ambos ficheros en lugar de fiarte de un número escrito aquí. **Estado actual (2026-06-21): paridad cerrada, ambos en `3.3.0`** (espejado `pubspec.yaml#version` + `version_compat.dart#protocolVersion`; suite de paridad verde, 608 tests). El guard interno `version_compat_test.dart` exige `protocolVersion == pubspec.version`; el drift-CI externo (KRO-64) compara contra `@kromia/core`.

- **NUNCA edites el TS desde el chat de Flutter.** ¿Falta un cambio de contrato/lógica? → **pídeselo a Studio** por `send_message` → Studio lo ejecuta en `@kromia/core` (+ bump SemVer + tag) → tú lo **espejas** aquí. Nunca al revés.
- **No inventes API en Dart**: cada export refleja su homólogo TS. El drift detector vigila los bumps major y abre issue Jira cuando `pubspec.yaml#version` y `package.json#version` divergen en major.
- **Paridad por construcción**: el corpus 1:1 (mismos inputs ⇒ mismos outputs) en `test/` y los drift tests de constantes canónicas (`card_layers_drift_test.dart`) son la red de seguridad. Si tu cambio rompe el corpus sin un cambio espejado en TS, el cambio está mal.

## Coordinación

- **Reparto + protocolo + cola de handoffs (fuente de verdad):** [`../../COORDINATION.md`](../../COORDINATION.md).
- **Mapa de helpers + matriz de bump SemVer + playbooks del SDK:** [`../../AGENTS.md`](../../AGENTS.md).

## Comandos

| Tarea | Comando |
|---|---|
| Resolver deps | `dart pub get` (en `packages/core_dart`) |
| Suite completa (corpus + drift) | `dart test` |
| CI de paridad | `krp-drift.yml`: `version-drift` (capa 1 SemVer TS↔Dart, major falla y abre Jira) · `corpus-parity` (capa 2, `dart test`) · `api-parity` (capa 3, WARN, no bloquea) |

## Estructura

- `lib/src/` — ~35 módulos Dart espejados del TS: `classify.dart`, `behaviors.dart`, `recipes.dart`, `composition.dart`, `validate.dart` (reglas de paridad con backend: recipe no vacío, keys no vacías, profundidad máx=2…), `layout.dart`, `visual_effects.dart`, `card_layers.dart`, `tag_styles.dart`, `section_icons.dart`, et al. (la cardinalidad exacta del catálogo de iconos la fija el ancla de `section_icons_test.dart`, no este doc).
- `test/` — ~29 tests: corpus 1:1 (`classify_test.dart`, `validate_test.dart`…), conformidad de layout (`layout_conformance_test.dart`: un fixture golden cubre todos los container kinds/prefabs/props, con ancla de 26 appearance props del ConformanceCatalog espejadas del TS), anclas de drift (`card_layers_drift_test.dart`), `schema_version_test.dart`.

---
*Last updated: 2026-06-21 — sesión Flutter. Espejo de `@kromia/core` en paridad v3.3.0 (TS canónico = pubspec local = protocolVersion).*
