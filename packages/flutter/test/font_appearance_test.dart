import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/src/utils/appearance_styles.dart';

/// KRO-218 — `SlotAppearance.font` → familia tipográfica. `sans` = Plus Jakarta
/// bundleado FORZADO; `serif` = serif del sistema; las 9 extras = google_fonts;
/// desconocido/null = hereda la base. Espejo del set curado del web.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized(); // google_fonts necesita binding
  // En test no hay red (HTTP→400). El runtime SÍ baja la fuente (lazy+caché); el
  // test solo verifica la FAMILIA resuelta, sin fetch (patrón oficial de google_fonts).
  GoogleFonts.config.allowRuntimeFetching = false;

  const base = TextStyle(fontSize: 14); // base SIN familia (hereda de la app)
  TextStyle apply(String? font) => applyAppearanceText(base, SlotAppearance(font: font));

  group('font → familia', () {
    test('sans → Plus Jakarta bundleado, FORZADO (no hereda — fix 6220f66)', () {
      final s = apply('sans');
      expect(s.fontFamily, kSansFontFamily);
      expect(s.fontFamilyFallback, isEmpty); // sin fallback heredado
    });

    test('serif → serif del sistema (igual que hoy)', () {
      expect(apply('serif').fontFamily, 'serif');
    });

    // Las 9 extras (inter/manrope/…) dispatchan a google_fonts (descarga lazy).
    // NO se asertan en runtime aquí: el entorno de test no tiene red ni las
    // fuentes en assets (google_fonts lanzaría). Su cobertura: están en el
    // contrato (`appearance_contract_test`) + el switch literal en applyFontFamily.

    test('null → hereda base.fontFamily', () {
      expect(applyAppearanceText(base, const SlotAppearance()).fontFamily, base.fontFamily);
    });

    test('id desconocido → hereda base.fontFamily (fallback)', () {
      expect(apply('comicsans').fontFamily, base.fontFamily);
    });

    test('preserva el resto de props (size/weight) al aplicar la familia', () {
      final s = applyAppearanceText(base, const SlotAppearance(font: 'sans', weight: 'bold', size: 'xl'));
      expect(s.fontFamily, kSansFontFamily);
      expect(s.fontSize, 18); // size xl
      expect(s.fontWeight, FontWeight.w700); // weight bold
    });
  });
}
