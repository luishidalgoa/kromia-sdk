import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-133 — ratchet de conformidad del motor de layout (espejo de
/// `layout-conformance.test.ts`). Verifica que el fixture golden cubre el catálogo
/// COMPLETO de primitivos (container kinds + prefab components + props de
/// appearance). Si alguien añade un primitivo y NO lo mete en el fixture, falla →
/// fuerza a actualizarlo (y, con él, el golden que Flutter renderiza). Es el
/// guard del ESPEJO Dart del catálogo TS — no debe haber drift granular.
List<String> _missing(List<String> catalog, Set<String> covered) =>
    catalog.where((x) => !covered.contains(x)).toList();

void main() {
  test('el fixture cubre TODOS los container kinds del catálogo', () {
    final m = _missing(ConformanceCatalog.containerKinds, conformanceContainerKinds());
    expect(m, isEmpty, reason: 'container kinds sin cobertura en el fixture: ${m.join(', ')}');
  });

  test('el fixture cubre TODOS los prefab components', () {
    final m = _missing(ConformanceCatalog.components, conformanceComponents());
    expect(m, isEmpty,
        reason: 'componentes sin cobertura: ${m.join(', ')} — añádelos a layout_conformance.dart y al golden de Flutter');
  });

  test('el fixture cubre TODAS las props de appearance', () {
    final m = _missing(ConformanceCatalog.appearanceProps, conformanceAppearanceProps());
    expect(m, isEmpty,
        reason: 'appearance props sin cobertura: ${m.join(', ')} — añádelas a un slot del fixture y al golden de Flutter');
  });

  test('el catálogo de props coincide en cardinalidad con el TS (26)', () {
    expect(ConformanceCatalog.appearanceProps.length, 26);
  });

  test('el fixture es una composición válida con árbol de layout', () {
    expect(layoutConformanceFixture.layout, isNotNull);
    expect(layoutConformanceFixture.layout, isA<LayoutContainerNode>());
  });
}
