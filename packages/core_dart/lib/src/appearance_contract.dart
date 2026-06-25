/// KRO — sección `appearance` del contrato KRP (protocolVersion 3.2.0). Espejo de
/// `buildAppearance()` (generate.ts): `{ props, propsByKind, variants }` derivado
/// de los catálogos. El SDK la mete en el .json del KRP; CUALQUIER variante/prop
/// nueva → contract-drift + bump de protocolVersion. El test
/// `appearance_contract_test.dart` vigila que ESTE espejo Dart siga al SDK: si el
/// contrato cambia y aquí no, falla → la alarma aterriza en el lado Flutter.
library;

import 'slot_kinds.dart';

/// Variantes por prop: lista de ids cerrados (enumerables) o el TIPO de las no
/// enumerables ('boolean'|'number'|'object'|'palette'). Espejo EXACTO de
/// `buildAppearance().variants` (options.ts `OPTIONS_APPEARANCE_*`).
const Map<String, Object> appearanceVariants = <String, Object>{
  // Enumerables (ids cerrados de su catálogo).
  'shape': <String>['circle', 'square', 'rounded'],
  'aspect': <String>['1:1', '16:9', '4:3', '3:4', '9:16', 'free'],
  'objectFit': <String>['cover', 'contain'],
  'align': <String>['left', 'center', 'right'],
  'weight': <String>['regular', 'semibold', 'bold'],
  'textTransform': <String>['none', 'uppercase'],
  // KRO-218 — set curado (espejo de OPTIONS_APPEARANCE_FONT): sans/serif + 9
  // Google Fonts. El render Flutter mapea cada id a su familia (google_fonts).
  'font': <String>['sans', 'serif', 'inter', 'manrope', 'nunito', 'montserrat', 'lora', 'playfair', 'robotoslab', 'oswald', 'jetbrains'],
  'lineHeight': <String>['tight', 'normal', 'relaxed'],
  'tracking': <String>['tight', 'normal', 'wide'],
  'textShadow': <String>['none', 'sm', 'md'],
  'size': <String>['sm', 'md', 'lg', 'xl'],
  'display': <String>['text', 'badge'],
  'truncate': <String>['1', '2', '3', 'none'],
  'paddingY': <String>['none', 'sm', 'md', 'lg'],
  'opacity': <String>['100', '90', '75', '50'],
  'shadow': <String>['none', 'sm', 'md', 'lg'],
  'accentPosition': <String>['auto', 'top', 'left', 'right', 'bottom', 'none'],
  'refColumns': <String>['1', '2', '3', '4'],
  'refTap': <String>['none', 'focus'],
  // No enumerables → el contrato declara su TIPO.
  'italic': 'boolean',
  'underline': 'boolean',
  'truncateChars': 'number',
  'refSize': 'number',
  'imageFocus': 'object',
  'textColor': 'palette',
  'bgColor': 'palette',
};

/// Sección `appearance` del contrato: `{ props, propsByKind, variants }`.
/// Espejo de `buildAppearance()`.
Map<String, Object> buildAppearanceContract() {
  final propsByKind = <String, List<String>>{};
  for (final kind in slotAcceptKindMeta.keys) {
    propsByKind[kind] = getAvailableAppearanceProps(<String>[kind]);
  }
  return <String, Object>{
    'props': List<String>.of(allAppearanceProps),
    'propsByKind': propsByKind,
    'variants': appearanceVariants,
  };
}
