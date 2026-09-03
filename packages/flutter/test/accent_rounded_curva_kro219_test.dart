import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-219 — `rounded` tiene que verse DISTINTO de `bar`.
///
/// En la app los cinco estilos de acento salían rectos: `rounded` era
/// indistinguible de `bar`. El test que ya existía no lo cazaba porque comprueba
/// que los cinco **no revientan** y que la banda se distingue del gradiente —
/// nunca separa `rounded` de `bar`, que es justo lo único que aquí falla.
///
/// ## La regla canónica, del `LayoutRenderer.tsx` de react
///
/// ```ts
/// const curvedAccent = accent?.style === 'rounded' && accent.position !== 'none';
/// root = isDetail && rawRoot.surface
///   ? { ...surface, radius: curvedAccent ? surface.radius : undefined,
///                   border: undefined, background: undefined }
///   : rawRoot;
/// ```
///
/// Tres cosas que hay que espejar enteras, y las tres se pueden hacer a medias:
///
/// 1. Solo en recetas de **detalle** y solo si el raíz trae `surface`.
/// 2. Fondo y borde se quitan **siempre**; el radio **solo** se quita si el
///    acento no es curvo.
/// 3. `position !== 'none'` es parte de la condición. Un `rounded` con posición
///    `none` **no** curva — espejar sin ese término mete un drift nuevo mientras
///    se arregla el viejo.
void main() {
  RenderCtx ctx(String style, {String position = 'left'}) => RenderCtx(
        composition: ViewComposition(
          recipe: 'hero_protagonico', // kind 'detail'
          action: 'none',
          accentStyle: style,
          accentPosition: position,
          slots: const {
            'title': SlotComposition(fields: ['nombre']),
            'color': SlotComposition(fields: ['color']),
          },
          // El raíz TRAE surface con radio: sin eso la regla ni se aplica y el
          // test mediría otra cosa.
          layout: const LayoutContainerNode(
            surface: ContainerSurface(
              radius: 'lg',
              background: 'card',
              border: SurfaceBorder(width: 'thin'),
            ),
            children: [LayoutSlotNode(slot: 'title')],
          ),
        ),
        item: const {'nombre': 'Pelé', 'color': '#ff0000'},
        fieldDefs: const [
          FieldDefLike(key: 'nombre', type: 'text'),
          FieldDefLike(key: 'color', type: 'text', behavior: 'color_hex'),
        ],
      );

  Future<void> pintar(WidgetTester t, String style, {String position = 'left'}) async {
    await t.pumpWidget(Directionality(
      textDirection: TextDirection.ltr,
      child: Center(
        child: SizedBox(width: 320, child: LayoutRenderer(ctx: ctx(style, position: position))),
      ),
    ));
    await t.pump();
  }

  /// El radio con el que se recorta el contenido del raíz, o `null` si va recto.
  double? radioDelRecorte(WidgetTester t) {
    for (final c in t.widgetList<ClipRRect>(find.byType(ClipRRect))) {
      final r = c.borderRadius;
      if (r is BorderRadius && r.topLeft.x > 0) return r.topLeft.x;
    }
    return null;
  }

  /// El radio de la BANDA del acento, o `null` si la banda va recta.
  double? radioDeLaBanda(WidgetTester t) {
    for (final c in t.widgetList<Container>(find.byType(Container))) {
      final d = c.foregroundDecoration;
      if (d is! BoxDecoration || d.border == null) continue;
      final r = d.borderRadius;
      if (r is BorderRadius && r.topLeft.x > 0) return r.topLeft.x;
      return 0;
    }
    return null;
  }

  group('rounded curva; bar no', () {
    testWidgets('con `rounded`, el raíz conserva su radio', (t) async {
      await pintar(t, 'rounded');

      expect(radioDelRecorte(t), isNotNull,
          reason: '`rounded` sale recto: es indistinguible de `bar`');
    });

    testWidgets('y con `bar` NO', (t) async {
      // El control que le da sentido al de arriba: si el radio se conservara
      // siempre, aquel pasaría sin que `rounded` hiciera nada especial.
      await pintar(t, 'bar');

      expect(radioDelRecorte(t), isNull,
          reason: 'en el detalle el radio del raíz se quita salvo con acento curvo');
    });

    testWidgets('ni `glow` ni `gradient` ni `ambient`', (t) async {
      for (final estilo in ['glow', 'gradient', 'ambient']) {
        await pintar(t, estilo);

        expect(radioDelRecorte(t), isNull, reason: '$estilo no debería curvar');
      }
    });
  });

  group('el término que falta en los resúmenes', () {
    testWidgets('`rounded` con posición `none` NO curva', (t) async {
      // La condición de react es `style === 'rounded' && position !== 'none'`.
      // Sin el segundo término, espejar esto metería un drift nuevo mientras se
      // arregla el viejo.
      await pintar(t, 'rounded', position: 'none');

      expect(radioDelRecorte(t), isNull,
          reason: 'sin acento no hay nada que curvar');
    });
  });

  group('la banda sigue la curva', () {
    testWidgets('con `rounded`, la banda va redondeada', (t) async {
      // La otra mitad, y la que deja el mismo fallo con otra cara si se olvida:
      // aunque el raíz conserve su radio, una banda pintada como `Border` sin
      // `borderRadius` sale RECTA sobre unas esquinas curvas.
      await pintar(t, 'rounded');

      expect(radioDeLaBanda(t), isNotNull, reason: 'no hay banda que medir');
      expect(radioDeLaBanda(t), greaterThan(0),
          reason: 'la banda va recta sobre un contenedor curvo');
    });

    testWidgets('y con `bar` va recta', (t) async {
      await pintar(t, 'bar');

      expect(radioDeLaBanda(t), 0,
          reason: 'la banda de `bar` no lleva curva');
    });
  });
}
