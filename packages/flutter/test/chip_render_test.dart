import 'package:flutter/widgets.dart';
import 'package:flutter_layout_grid/flutter_layout_grid.dart' hide GridPlacement;
import 'package:flutter_test/flutter_test.dart';
import 'package:kromia_core/kromia_core.dart';
import 'package:kromia_flutter/kromia_flutter.dart';

/// KRO-220 — _badgeRow: builder único por-field (mergeFieldAppearance) + display
/// por-chip + chipGrid 2D (LayoutGrid) + chipWidth. Sin chipGrid → flex-wrap.
RenderCtx _ctx({
  ChipGrid? grid,
  Map<String, GridPlacement>? placements,
  SlotAppearance? appearance,
  Map<String, SlotAppearance>? fieldAppearances,
}) =>
    RenderCtx(
      composition: ViewComposition(recipe: 'editorial', action: 'none', slots: {
        'badges': SlotComposition(
          fields: const ['rareza', 'tipo'],
          appearance: appearance,
          fieldAppearances: fieldAppearances,
          chipGrid: grid,
          chipPlacements: placements,
        ),
      }),
      item: const {'rareza': 'Épica', 'tipo': 'Fuego'},
      fieldDefs: const [FieldDefLike(key: 'rareza', type: 'text'), FieldDefLike(key: 'tipo', type: 'text')],
    );

Future<void> _pump(WidgetTester t, RenderCtx ctx) async {
  final w = componentContent(ctx, const LayoutComponentNode(component: 'badge_row', slots: {'badges': 'badges'}));
  await t.pumpWidget(Directionality(textDirection: TextDirection.ltr, child: Center(child: SizedBox(width: 320, child: w ?? const SizedBox()))));
  await t.pump();
}

bool _isPillColor(Widget w, Color c) =>
    w is Container && w.decoration is BoxDecoration && (w.decoration as BoxDecoration).color == c;

void main() {
  group('_badgeRow (KRO-220)', () {
    testWidgets('sin chipGrid → flex-wrap (Wrap), 1 chip por field', (t) async {
      await _pump(t, _ctx());
      expect(find.text('Épica'), findsOneWidget);
      expect(find.text('Fuego'), findsOneWidget);
      expect(find.byType(Wrap), findsOneWidget);
      expect(find.byType(LayoutGrid), findsNothing);
    });

    testWidgets('chipGrid presente → rejilla (LayoutGrid), no Wrap', (t) async {
      await _pump(t, _ctx(grid: const ChipGrid(columns: 2)));
      expect(find.byType(LayoutGrid), findsOneWidget);
      expect(find.byType(Wrap), findsNothing);
      expect(find.text('Épica'), findsOneWidget);
      expect(find.text('Fuego'), findsOneWidget);
    });

    testWidgets('fieldAppearances → SOLO el chip objetivo toma su color', (t) async {
      await _pump(t, _ctx(fieldAppearances: const {'rareza': SlotAppearance(bgColor: 'red-500')}));
      // red-500 = 0xFFEF4444 (paleta Tailwind). Solo la pastilla de 'rareza'.
      expect(find.byWidgetPredicate((w) => _isPillColor(w, const Color(0xFFEF4444))), findsOneWidget);
    });

    testWidgets("display:'text' por-field → ese chip es texto plano (sin pastilla extra)", (t) async {
      await _pump(t, _ctx(fieldAppearances: const {'rareza': SlotAppearance(display: 'text')}));
      expect(find.text('Épica'), findsOneWidget);
      expect(find.text('Fuego'), findsOneWidget);
      // 'tipo' sigue siendo pastilla (bg-muted) → 1 Container de pastilla; 'rareza' texto plano.
      expect(find.byWidgetPredicate((w) => _isPillColor(w, KromiaTokens.bgSurface2)), findsOneWidget);
    });

    testWidgets('chipWidth:content + chipGrid → Align posiciona el chip (sin crash)', (t) async {
      await _pump(t, _ctx(grid: const ChipGrid(columns: 2), appearance: const SlotAppearance(chipWidth: 'content', align: 'right')));
      expect(t.takeException(), isNull);
      expect(find.byType(LayoutGrid), findsOneWidget);
      expect(find.byType(Align), findsWidgets);
      expect(find.text('Épica'), findsOneWidget);
    });
  });
}
