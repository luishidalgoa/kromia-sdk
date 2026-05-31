# kromia_core (Dart)

Espejo **Dart** del SDK `@kromia/core` (TypeScript). Es el "libro de reglas"
del modelo del editor de Kromia, en el lenguaje que habla Flutter. El cliente
Flutter lo consume para renderizar **igual** que Studio, sin reimplementar
reglas a mano.

> **Fuente de verdad = el TS.** Este paquete es un espejo. Si el TS y el Dart
> divergen, gana el TS. La paridad se garantiza por construcción con el corpus
> de tests (mismos inputs → mismos outputs) + el drift-CI (KRO-64).

## Cobertura actual

- `classifyField(FieldSpec)` / `isFieldCompatibleWithSlot(field, slot)` — espejo
  de `classify.ts`. Mapea un field (type + behavior) a sus `SlotAcceptKind`.
- `SlotAcceptKind` — los 14 kinds (`types.ts`).
- `isCompatible(albumVersion, [clientVersion])` / `compareSemver` /
  `protocolVersion` — compatibilidad de protocolo en runtime (política
  major-based: fallback solo si el álbum tiene un major mayor que el cliente).
- **Registries** (espejo de `registries/`):
  - `field-types`: `allFieldTypes()` / `getFieldType(id)` / `fieldTypeIds` (9 types).
  - `actions`: `allActions()` / `getAction(id)` / `actionIds` (5 actions + flags).
  - `behaviors`: `allBehaviors()` / `getBehavior(id)` / `getBehaviorsByType(type)` /
    `suggestBehavior(key, type)` (27 behaviors + heurística por key).
  - `recipes`: `recipeRegistry` / `getRecipeManifest(id)` / `allRecipes()` /
    `allRecipesByKind(kind)` (8 manifests con slots).
  - `slot-kinds`: `slotAcceptKindMeta` (14), `getSlotAcceptKindOptions()`,
    `formatSlotAccepts()`, `getAvailableAppearanceProps()`.
- **Composición de vista** (espejo de `types.ts` + resolución de slots):
  - `ViewComposition` / `SlotComposition` / `SlotAppearance` / `SlotOverrides` /
    `CustomSlotDefinition` / `NestedViewComposition` — con `fromJson` (llegan del
    `AlbumSchema.dataStructure[sectionKey].viewComposition` del backend).
  - `getEffectiveSlots(manifest, overrides)` (disabled + custom + order),
    `validateSlotOverrides()`, `customSlotToSlotDefinition()`.

### Pendiente (chunks siguientes, según los necesite el render)

`validate` (validateComposition / validateAlbumData), `format` (formatScalar) y
helpers de preview (synth / compose / auto-detail). Se traducen 1:1 con su corpus.
El RENDERER (widgets que pintan estos manifests + composición) vive en la app
Flutter, no en este paquete.

> Mirror de campos semánticos/estructurales (ids, displayName, description, flags).
> La doc rica de `EncyclopediaDoc` (whenToUse/long/examples/related/aliases) NO se
> espeja a mano: llega vía el `.json` del KRP (KRO-83).

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
