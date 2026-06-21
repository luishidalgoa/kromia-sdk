import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO — ANTI-DRIFT de la sección `appearance` del contrato KRP (protocolVersion
/// 3.2.0). El SDK deriva `{ props, propsByKind, variants }` de sus catálogos; este
/// test vigila que el espejo Dart la siga. Si el SDK añade una variante/prop y
/// core_dart no, FALLA aquí → la alarma del drift aterriza en el lado Flutter.
void main() {
  final contract = buildAppearanceContract();

  test('props == allAppearanceProps (26 props del catálogo)', () {
    expect(contract['props'], equals(allAppearanceProps));
    expect((contract['props'] as List).length, 26);
  });

  test('TODA prop del catálogo tiene una variante declarada (sin huérfanas)', () {
    final missing = allAppearanceProps.where((p) => !appearanceVariants.containsKey(p)).toList();
    expect(missing, isEmpty, reason: 'props sin variante en el contrato: ${missing.join(', ')}');
    // …y ninguna variante sobra respecto al catálogo.
    final extra = appearanceVariants.keys.where((p) => !allAppearanceProps.contains(p)).toList();
    expect(extra, isEmpty, reason: 'variantes que no son props del catálogo: ${extra.join(', ')}');
  });

  test('propsByKind: una entrada por kind, solo props del catálogo', () {
    final pbk = contract['propsByKind'] as Map<String, List<String>>;
    for (final kind in slotAcceptKindMeta.keys) {
      expect(pbk.containsKey(kind), isTrue, reason: 'falta el kind "$kind" en propsByKind');
      for (final p in pbk[kind]!) {
        expect(allAppearanceProps.contains(p), isTrue, reason: 'kind "$kind" gatea prop fuera del catálogo: $p');
      }
    }
  });

  test('snapshot de variantes — si el SDK las cambia (y bumpea protocolVersion), '
      'actualiza esto a conciencia', () {
    // Enumerables: valores EXACTOS de options.ts (OPTIONS_APPEARANCE_*).
    expect(appearanceVariants['shape'], <String>['circle', 'square', 'rounded']);
    expect(appearanceVariants['objectFit'], <String>['cover', 'contain']);
    expect(appearanceVariants['opacity'], <String>['100', '90', '75', '50']);
    expect(appearanceVariants['shadow'], <String>['none', 'sm', 'md', 'lg']);
    expect(appearanceVariants['refColumns'], <String>['1', '2', '3', '4']);
    expect(appearanceVariants['refTap'], <String>['none', 'focus']);
    expect(appearanceVariants['accentPosition'], <String>['auto', 'top', 'left', 'right', 'bottom', 'none']);
    // No enumerables: tipo.
    expect(appearanceVariants['italic'], 'boolean');
    expect(appearanceVariants['truncateChars'], 'number');
    expect(appearanceVariants['imageFocus'], 'object');
    expect(appearanceVariants['textColor'], 'palette');
    expect(appearanceVariants['bgColor'], 'palette');
    // Cardinalidad: 19 enumerables + 7 tipos = 26 (una por prop).
    expect(appearanceVariants.length, 26);
  });
}
