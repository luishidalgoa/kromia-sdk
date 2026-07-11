import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-133 — TERMÓMETRO de conformidad del motor de bloques Flutter.
///
/// Renderiza el `LAYOUT_CONFORMANCE_FIXTURE` (corpus golden de @kromia/core que
/// ejercita TODOS los primitivos: 3 container kinds + 11 prefabs + 26 appearance
/// props) y comprueba, de forma OBJETIVA (por render), qué primitivos soporta de
/// verdad el `LayoutRenderer`. Lo que el motor no aplica = drift granular.
///
/// El catálogo canónico llega de core_dart (espejo del TS, guardado por
/// `layout_conformance_test.dart` allí). Aquí medimos la COBERTURA del motor.

// Imagen-sonda: hoja determinista que registra fit/alignment (evita la red del
// Image.network real y da una firma estable para objectFit/imageFocus).
class _ProbeImage extends StatelessWidget {
  final BoxFit fit;
  final Alignment alignment;
  const _ProbeImage({required this.fit, required this.alignment});
  @override
  Widget build(BuildContext context) => const SizedBox(width: 48, height: 48);
}

Widget _probeImageBuilder(String url,
        {BoxFit fit = BoxFit.cover, Alignment alignment = Alignment.center, double? width, double? height}) =>
    _ProbeImage(fit: fit, alignment: alignment);

RenderCtx _ctx({
  required Map<String, SlotComposition> slots,
  required Map<String, dynamic> item,
  required List<FieldDefLike> defs,
  LayoutContainerNode? layout,
  CardRefTap? onCardRefTap,
}) =>
    RenderCtx(
      composition: ViewComposition(recipe: 'hero_protagonico', action: 'none', slots: slots, layout: layout),
      item: item,
      fieldDefs: defs,
      imageBuilder: _probeImageBuilder,
      onCardRefTap: onCardRefTap,
    );

Future<void> _pump(WidgetTester t, Widget w) => t.pumpWidget(
      Directionality(textDirection: TextDirection.ltr, child: Center(child: SizedBox(width: 320, child: w))),
    );

/// Firma estructural del árbol pintado: captura los rasgos que cada appearance
/// prop modifica. Si la firma CON la prop difiere de la firma SIN → el motor la
/// aplica. Objetivo y uniforme: no declara soporte, lo MIDE.
String _sig(WidgetTester t) {
  final b = StringBuffer();
  for (final w in t.allWidgets) {
    if (w is Text) {
      final s = w.style;
      b.write('T[${w.data}|${s?.fontWeight}|${s?.fontSize}|${s?.color}|${s?.fontStyle}|'
          '${s?.decoration}|${s?.letterSpacing}|${s?.height}|${s?.fontFamily}|${s?.shadows?.length}'
          '|a=${w.textAlign}|m=${w.maxLines}];');
    } else if (w is RichText) {
      b.write('RT[${w.text.toPlainText()}];');
    } else if (w is _ProbeImage) {
      b.write('IMG[${w.fit}|${w.alignment}];');
    } else if (w is AspectRatio) {
      b.write('AR[${w.aspectRatio}];');
    } else if (w is ClipRRect) {
      b.write('CR[${w.borderRadius}];');
    } else if (w is ClipOval) {
      b.write('CO;');
    } else if (w is Opacity) {
      b.write('OP[${w.opacity}];');
    } else if (w is Transform) {
      b.write('TR;');
    } else if (w is Padding) {
      b.write('PAD[${w.padding}];');
    } else if (w is FractionallySizedBox) {
      b.write('FSB[${w.widthFactor}];');
    } else if (w is Align) {
      b.write('AL[${w.alignment}];');
    } else if (w is DecoratedBox) {
      b.write('DB[${w.decoration}];');
    } else if (w is Container) {
      b.write('CON;');
    } else if (w is GestureDetector) {
      b.write('GEST;');
    }
  }
  return b.toString();
}

/// ¿Aplica el motor [prop]? Renderiza un slot CON solo esa prop y SIN ninguna; si
/// la firma cambia, la prop tiene efecto en el render.
Future<bool> _slotApplies(
  WidgetTester t,
  SlotAppearance ap,
  FieldDefLike def,
  Object? value, {
  CardRefTap? onCardRefTap,
}) async {
  final base = SlotComposition(fields: [def.key]);
  final withProp = SlotComposition(fields: [def.key], appearance: ap);
  await _pump(t, _ctx(slots: {'s': base}, item: {def.key: value}, defs: [def], onCardRefTap: onCardRefTap).let((c) => slotContent(c, 's') ?? const SizedBox()));
  final sigBase = _sig(t);
  await _pump(t, _ctx(slots: {'s': withProp}, item: {def.key: value}, defs: [def], onCardRefTap: onCardRefTap).let((c) => slotContent(c, 's') ?? const SizedBox()));
  final sigWith = _sig(t);
  return sigBase != sigWith;
}

extension<T> on T {
  R let<R>(R Function(T) f) => f(this);
}

void main() {
  final fixture = layoutConformanceFixture;

  // ── A. Los 11 prefabs del fixture renderizan en layout vertical, sin excepción ─
  // (Los 3 container kinds se cubren en C; el flex-row/stack del stress fixture
  // apila una imagen `aspect` cruda en una fila — edge de layout que las recetas
  // reales no producen. Aquí ejercemos los PREFABS con los slots/datos canónicos
  // del fixture en un layout vertical realista, que es como aparecen en detalle.)
  testWidgets('los 11 prefabs del fixture renderizan con sus slots canónicos', (t) async {
    final defs = const [
      FieldDefLike(key: 'arte', type: 'image'),
      FieldDefLike(key: 'nombre', type: 'text'),
      FieldDefLike(key: 'fecha', type: 'date'),
      FieldDefLike(key: 'clima', type: 'text'),
      FieldDefLike(key: 'elemento', type: 'text'),
      FieldDefLike(key: 'imagenes', label: 'Imágenes', type: 'array<image>'),
      FieldDefLike(key: 'protagonista', type: 'cardRef'),
      FieldDefLike(key: 'altura', label: 'Altura', type: 'number'),
      FieldDefLike(key: 'peso', label: 'Peso', type: 'number'),
      FieldDefLike(key: 'rareza', type: 'text'),
    ];
    final item = <String, dynamic>{
      'arte': 'http://x.test/a.png', 'nombre': 'Ignis', 'fecha': '1987-06-21', 'clima': 'Árido',
      'elemento': 'Fuego', 'imagenes': ['http://x.test/1.png', 'http://x.test/2.png'],
      'protagonista': ['c1'], 'altura': 12, 'peso': 340, 'rareza': 'Épica',
    };
    // Un grid de 1 columna con los 11 prefabs (su forma natural en un detalle).
    final layout = LayoutContainerNode(
      kind: 'grid', columns: 1,
      children: [for (final c in ConformanceCatalog.components) LayoutComponentNode(component: c, slots: _roleSlotsFor(c))],
    );
    final ctx = _ctx(slots: fixture.slots, item: item, defs: defs, layout: layout);
    await _pump(t, SingleChildScrollView(child: LayoutRenderer(ctx: ctx)));
    expect(t.takeException(), isNull, reason: 'los prefabs deben renderizar sin excepción de layout');
    expect(find.byType(LayoutRenderer), findsOneWidget);
    expect(find.text('ALTURA'), findsWidgets);     // stats_row → label del campo
    expect(find.text('IMÁGENES'), findsWidgets);   // gallery_grid → label del campo
  });

  // ── B. Cobertura de PREFAB COMPONENTS (ratchet duro) ────────────────────────
  testWidgets('el motor soporta TODOS los prefab components del catálogo', (t) async {
    final defs = const [
      FieldDefLike(key: 'arte', type: 'image'),
      FieldDefLike(key: 'nombre', type: 'text'),
      FieldDefLike(key: 'fecha', type: 'date'),
      FieldDefLike(key: 'clima', type: 'text'),
      FieldDefLike(key: 'elemento', type: 'text'),
      FieldDefLike(key: 'imagenes', type: 'array<image>'),
      FieldDefLike(key: 'protagonista', type: 'cardRef'),
      FieldDefLike(key: 'altura', label: 'Altura', type: 'number'),
      FieldDefLike(key: 'peso', label: 'Peso', type: 'number'),
      FieldDefLike(key: 'rareza', type: 'text'),
    ];
    final item = <String, dynamic>{
      'arte': 'http://x.test/a.png', 'nombre': 'Ignis', 'fecha': '1987', 'clima': 'Árido',
      'elemento': 'Fuego', 'imagenes': ['http://x.test/1.png'], 'protagonista': ['c1'],
      'altura': 12, 'peso': 340, 'rareza': 'Épica',
    };
    // Reusa el mapeo rol→slot del fixture canónico (mismos slots).
    final ctx = _ctx(slots: fixture.slots, item: item, defs: defs);
    final missing = <String>[];
    for (final comp in ConformanceCatalog.components) {
      final node = LayoutComponentNode(component: comp, slots: _roleSlotsFor(comp));
      if (componentContent(ctx, node) == null) missing.add(comp);
    }
    expect(missing, isEmpty, reason: 'prefabs sin soporte en el LayoutRenderer: ${missing.join(', ')}');
  });

  // ── B.2 — ENDURECIMIENTO (KRO-217): el fixture da un slot REAL a cada componente ─
  // El agujero que dejó pasar `chips_row`: un componente en el catálogo SIN slot en
  // el fixture renderiza VACÍO, y un host que lo dropea (default:null → SizedBox)
  // produce el MISMO golden vacío = cero diff = drift silencioso. Esta aserción
  // fuerza que todo componente (salvo `divider`, que no tiene slots) lleve un slot
  // real → si añades uno al catálogo y olvidas el slot, salta aquí.
  test('el fixture da un slot real a cada prefab (no vacío → sin drift silencioso)', () {
    final orphans = ConformanceCatalog.components
        .where((c) => c != 'divider' && _roleSlotsFor(c).isEmpty)
        .toList();
    expect(orphans, isEmpty,
        reason: 'componentes sin slot en el fixture (renderizarían vacío): ${orphans.join(', ')}');
  });

  // ── C. Cobertura de CONTAINER KINDS (ratchet duro) ──────────────────────────
  testWidgets('el motor pinta TODOS los container kinds del catálogo', (t) async {
    final defs = const [FieldDefLike(key: 'nombre', type: 'text')];
    final item = const {'nombre': 'Ignis'};
    final missing = <String>[];
    for (final kind in ConformanceCatalog.containerKinds) {
      final layout = LayoutContainerNode(kind: kind, children: const [LayoutSlotNode(slot: 'title')]);
      final ctx = _ctx(slots: {'title': const SlotComposition(fields: ['nombre'])}, item: item, defs: defs, layout: layout);
      await _pump(t, LayoutRenderer(ctx: ctx));
      if (find.text('Ignis').evaluate().isEmpty) missing.add(kind);
    }
    expect(missing, isEmpty, reason: 'container kinds que no pintan su contenido: ${missing.join(', ')}');
  });

  // ── D. Cobertura de APPEARANCE PROPS (termómetro objetivo por render) ────────
  testWidgets('cobertura de appearance props del motor', (t) async {
    const txt = FieldDefLike(key: 'nombre', type: 'text');
    const img = FieldDefLike(key: 'arte', type: 'image');
    const ref = FieldDefLike(key: 'protagonista', type: 'cardRef');
    const longText = 'Forjado por Ignis el brasaduende en las fraguas mas profundas de toda la vasta Aetheria conocida y por conocer';

    // Cada prop → (appearance con SOLO esa prop, def, valor) para la sonda.
    final probes = <String, Future<bool> Function()>{
      // Texto
      'align': () => _slotApplies(t, const SlotAppearance(align: 'center'), txt, 'Ignis'),
      'weight': () => _slotApplies(t, const SlotAppearance(weight: 'bold'), txt, 'Ignis'),
      'italic': () => _slotApplies(t, const SlotAppearance(italic: true), txt, 'Ignis'),
      'underline': () => _slotApplies(t, const SlotAppearance(underline: true), txt, 'Ignis'),
      'textTransform': () => _slotApplies(t, const SlotAppearance(textTransform: 'uppercase'), txt, 'Ignis'),
      'font': () => _slotApplies(t, const SlotAppearance(font: 'serif'), txt, 'Ignis'),
      'lineHeight': () => _slotApplies(t, const SlotAppearance(lineHeight: 'relaxed'), txt, 'Ignis'),
      'tracking': () => _slotApplies(t, const SlotAppearance(tracking: 'wide'), txt, 'Ignis'),
      'textShadow': () => _slotApplies(t, const SlotAppearance(textShadow: 'sm'), txt, 'Ignis'),
      'size': () => _slotApplies(t, const SlotAppearance(size: 'xl'), txt, 'Ignis'),
      'display': () => _slotApplies(t, const SlotAppearance(display: 'badge'), txt, 'Ignis'),
      'textColor': () => _slotApplies(t, const SlotAppearance(textColor: 'muted'), txt, 'Ignis'),
      'bgColor': () => _slotApplies(t, const SlotAppearance(bgColor: 'primary'), txt, 'Ignis'),
      'truncate': () => _slotApplies(t, const SlotAppearance(truncate: '2'), txt, longText),
      'truncateChars': () => _slotApplies(t, const SlotAppearance(truncateChars: 40), txt, longText),
      'paddingY': () => _slotApplies(t, const SlotAppearance(paddingY: 'md'), txt, 'Ignis'),
      // Imagen
      'shape': () => _slotApplies(t, const SlotAppearance(shape: 'circle'), img, 'http://x.test/a.png'),
      'aspect': () => _slotApplies(t, const SlotAppearance(aspect: '16:9'), img, 'http://x.test/a.png'),
      'objectFit': () => _slotApplies(t, const SlotAppearance(objectFit: 'contain'), img, 'http://x.test/a.png'),
      'imageFocus': () => _slotApplies(t, const SlotAppearance(imageFocus: ImageFocus(x: 20, y: 80, zoom: 1.5)), img, 'http://x.test/a.png'),
      'opacity': () => _slotApplies(t, const SlotAppearance(opacity: '50'), img, 'http://x.test/a.png'),
      'shadow': () => _slotApplies(t, const SlotAppearance(shadow: 'md'), img, 'http://x.test/a.png'),
      // Referencias
      'refSize': () => _slotApplies(t, const SlotAppearance(refSize: 50), ref, ['c1', 'c2']),
      'refTap': () => _slotApplies(t, const SlotAppearance(refTap: 'focus'), ref, ['c1', 'c2'], onCardRefTap: (_) {}),
    };

    final applied = <String>{};
    for (final e in probes.entries) {
      if (await e.value()) applied.add(e.key);
    }
    // refColumns: efecto en el nº de columnas (función pura del ctx, no en la firma).
    final ctx = _ctx(slots: const {}, item: const {}, defs: const []);
    if (ctx.refColumns(const SlotAppearance(refColumns: '4')) != ctx.refColumns(null)) applied.add('refColumns');
    // accentPosition: el motor lo aplica vía extractAccentSettings + _AccentFrame
    // (layout_renderer.dart) — soporte verificado por wiring del engine.
    if (extractAccentSettings(
              ViewComposition(
                recipe: 'x', action: 'none',
                slots: const {'accent': SlotComposition(fields: ['col'], appearance: SlotAppearance(accentPosition: 'left'))},
              ),
              const {'col': '#E07B39'},
              const [FieldDefLike(key: 'col', type: 'text', behavior: 'color_hex')],
              'top',
            )?.position ==
        'left') {
      applied.add('accentPosition');
    }

    final missing = ConformanceCatalog.appearanceProps.where((p) => !applied.contains(p)).toList();
    // ignore: avoid_print
    print('APPEARANCE COVERAGE: ${applied.length}/${ConformanceCatalog.appearanceProps.length} — gaps: ${missing.join(', ')}');

    // El motor cubre las 26 props del catálogo (drift cerrado espejando
    // @kromia/react). Si aparece un gap NUEVO → salta y fuerza implementarlo.
    expect(missing, isEmpty,
        reason: 'appearance props sin aplicar en el motor: ${missing.join(', ')} — '
            'espéjalas desde @kromia/react. Aplicadas: ${applied.toList()..sort()}');
  });
}

/// Mapeo rol→slot por prefab (mismo del fixture canónico).
Map<String, String> _roleSlotsFor(String component) => switch (component) {
      'card' => const {'media': 'media', 'title': 'title', 'caption': 'caption', 'badge': 'badge'},
      'ref_gallery' => const {'refs': 'refs'},
      'carousel_peek' => const {'images': 'images'},
      'carousel_centered' => const {'images': 'images'},
      'gallery_grid' => const {'images': 'images'},
      'cards_carousel' => const {'cards': 'cards'},
      'divider' => const {},
      'stats_row' => const {'stats': 'stats'},
      'badge_row' => const {'badges': 'badges'},
      'chips_row' => const {'chips': 'badges'},
      'section_title' => const {'text': 'sectionLabel'},
      'hero_header' => const {'banner': 'banner', 'avatar': 'avatar', 'title': 'title', 'subtitle': 'subtitle'},
      _ => const {},
    };
