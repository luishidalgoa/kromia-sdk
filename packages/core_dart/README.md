# kromia_core (Dart)

Espejo **Dart** del SDK `@kromia/core` (TypeScript). Es el "libro de reglas"
del modelo del editor de Kromia, en el lenguaje que habla Flutter. El cliente
Flutter lo consume para renderizar **igual** que Studio, sin reimplementar
reglas a mano.

> **Fuente de verdad = el TS.** Este paquete es un espejo. Si el TS y el Dart
> divergen, gana el TS. La paridad se garantiza por construcción con el corpus
> de tests (mismos inputs → mismos outputs) + el drift-CI (KRO-64).

## Cobertura actual (KRO-65 parte A+B)

- `classifyField(FieldSpec)` / `isFieldCompatibleWithSlot(field, slot)` — espejo
  de `classify.ts`. Mapea un field (type + behavior) a sus `SlotAcceptKind`.
- `SlotAcceptKind` — los 14 kinds (`types.ts`).
- `isCompatible(albumVersion, [clientVersion])` / `compareSemver` /
  `protocolVersion` — compatibilidad de protocolo en runtime (política
  major-based: fallback solo si el álbum tiene un major mayor que el cliente).

### Pendiente (chunks siguientes, según los necesite el render)

Registries completos (behaviors, actions, recipes, slot-kinds, field-types),
`validate`, `format`. Se traducen 1:1 desde `packages/core/src/` con su corpus.

## Uso (desde la app Flutter)

```yaml
# pubspec.yaml de la app
dependencies:
  kromia_core:
    path: ../kromia-sdk/packages/core_dart
```

```dart
import 'package:kromia_core/kromia_core.dart';

final kinds = classifyField(const FieldSpec('text', behavior: 'url'));
// → ['any', 'url', 'text-short']

if (!isCompatible(album.protocolVersion)) {
  // fallback render + banner "actualiza la app"
}
```

## Tests

```bash
dart pub get
dart test
```

El `version` del `pubspec.yaml` **debe** matchear `@kromia/core`
(`packages/core/package.json#version`). El drift-CI (KRO-64) lo vigila.
