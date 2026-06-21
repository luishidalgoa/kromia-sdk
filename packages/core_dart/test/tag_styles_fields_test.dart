import 'package:kromia_core/kromia_core.dart';
import 'package:test/test.dart';

/// KRO-120/122 — `TagStyle` debe espejar `fieldKey` (ancla a un campo, p.ej.
/// rareza) y `customLayers` (foil personalizado). Sin esto no se resuelven ni
/// efectos por rareza ni foil custom.
void main() {
  group('TagStyle.fromJson — fieldKey + customLayers', () {
    test('parsea fieldKey y customLayers (foil custom anclado a un campo)', () {
      final ts = TagStyle.fromJson(const {
        'fieldKey': 'rareza',
        'value': 'legend',
        'effect': 'custom_foil',
        'config': {'intensity': 'high'},
        'customLayers': [
          {
            'kind': 'foil',
            'textureUrl': 'foil.png',
            'maskUrl': 'mask.png',
            'blend': 'color-dodge',
            'intensity': 0.6,
          },
        ],
      });
      expect(ts.fieldKey, 'rareza');
      expect(ts.value, 'legend');
      expect(ts.effect, 'custom_foil');
      expect(ts.config?['intensity'], 'high');
      expect(ts.customLayers, isNotNull);
      expect(ts.customLayers!.single.textureUrl, 'foil.png');
      expect(ts.customLayers!.single.blend, 'color-dodge');
    });

    test('TagStyle clásico (sin fieldKey/customLayers) → null', () {
      final ts = TagStyle.fromJson(const {
        'value': 'Holográfica',
        'effect': 'holographic_effect',
      });
      expect(ts.fieldKey, isNull);
      expect(ts.customLayers, isNull);
    });
  });
}
