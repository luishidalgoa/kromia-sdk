import 'package:test/test.dart';
import 'package:kromia_core/kromia_core.dart';

/// KRO-198 §7 — espejo del test TS `computeHiddenHeroRoles.test.ts`. Un rol de la
/// cabecera (hero_header) se oculta si lo marcó el publisher (nodeHidden) o si su
/// slotId está en los hiddenSlots globales (panel "solo datos" del detalle).
void main() {
  const roles = ['banner', 'avatar', 'title', 'subtitle'];

  group('computeHiddenHeroRoles', () {
    test('sin nada oculto → []', () {
      expect(
        computeHiddenHeroRoles(roles, null, {'banner': 'b', 'title': 't'}, null),
        isEmpty,
      );
    });

    test('respeta node.hidden (oculto por el publisher)', () {
      expect(
        computeHiddenHeroRoles(roles, ['avatar'], {'avatar': 'a', 'title': 't'}, null),
        ['avatar'],
      );
    });

    test('oculta un rol cuyo slotId está en hiddenSlots globales (cruza por slotId)', () {
      final out = computeHiddenHeroRoles(
          roles, null, {'banner': 'banner', 'title': 'nombre'}, ['banner', 'title']);
      expect(out, ['banner']);
    });

    test('cruza por slotId, no por nombre de rol', () {
      final out = computeHiddenHeroRoles(
          roles, null, {'banner': 'banner', 'title': 'title'}, ['banner', 'title']);
      expect(out..sort(), ['banner', 'title']);
    });

    test('combina node.hidden + hiddenSlots (sin duplicar)', () {
      final out = computeHiddenHeroRoles(
        roles,
        ['avatar'],
        {'banner': 'banner', 'avatar': 'avatar', 'title': 'nombre'},
        ['banner', 'avatar'],
      );
      expect(out..sort(), ['avatar', 'banner']);
    });

    test('un rol sin slot mapeado y no marcado → no se oculta', () {
      expect(
        computeHiddenHeroRoles(roles, null, {'title': 'nombre'}, ['banner']),
        isEmpty,
      );
    });

    test('hiddenSlots que no mapea a ningún rol → []', () {
      expect(
        computeHiddenHeroRoles(roles, null, {'title': 'nombre'}, ['otra-cosa']),
        isEmpty,
      );
    });
  });
}
