import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

/// KRO-220 — `chipGrid` + `chipPlacements` (SlotComposition) + `chipWidth`
/// (SlotAppearance). Render-meta; reusan GridPlacement de los bloques.
void main() {
  group('chipGrid / chipPlacements', () {
    test('fromJson parsea columns/gap + placements (reusa GridPlacement)', () {
      final s = SlotComposition.fromJson(const {
        'fields': ['a', 'b'],
        'chipGrid': {'columns': 2, 'gap': 'md'},
        'chipPlacements': {
          'a': {'colStart': 1, 'colSpan': 2, 'rowStart': 1},
          'b': {'colStart': 1, 'rowStart': 2},
        },
      });
      expect(s.chipGrid!.columns, 2);
      expect(s.chipGrid!.gap, 'md');
      expect(s.chipPlacements!['a']!.colSpan, 2);
      expect(s.chipPlacements!['a']!.rowStart, 1);
      expect(s.chipPlacements!['b']!.rowStart, 2);
    });

    test('sin chipGrid/chipPlacements → null (flex-wrap histórico)', () {
      final s = SlotComposition.fromJson(const {'fields': ['a']});
      expect(s.chipGrid, isNull);
      expect(s.chipPlacements, isNull);
    });

    test('columns ausente → 1 (clamp)', () {
      expect(ChipGrid.fromJson(const {}).columns, 1);
    });
  });

  group('SlotAppearance.chipWidth', () {
    test('fromJson + mergedOver (override por-clave gana, hereda base)', () {
      expect(SlotAppearance.fromJson(const {'chipWidth': 'content'}).chipWidth, 'content');
      const base = SlotAppearance(chipWidth: 'fill');
      expect(const SlotAppearance(chipWidth: 'content').mergedOver(base).chipWidth, 'content');
      expect(const SlotAppearance().mergedOver(base).chipWidth, 'fill'); // hereda
    });
  });
}
