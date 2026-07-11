/// KRO-133 — FIXTURE DE CONFORMIDAD del motor de layout (ratchet anti-drift).
/// Espejo 1:1 de `layout-conformance.ts` (@kromia/core, a658d6d).
///
/// El render por bloques (`LayoutRenderer`) se espeja en cada plataforma (Studio =
/// @kromia/react, Flutter = @kromia/flutter). Cuando el catálogo CRECE (un
/// container kind, un prefab, una prop de appearance), es fácil que una plataforma
/// se quede atrás → drift silencioso. Este fixture es un corpus golden que
/// ejercita, a propósito, TODOS los primitivos: los 3 container kinds, los N
/// prefab components y las N props de appearance. El test ratchet verifica que el
/// fixture CUBRE el catálogo completo; el golden de Flutter renderiza este mismo
/// fixture y comprueba que su motor soporta cada primitivo.
library;

import 'components.dart' show componentIds;
import 'composition.dart';
import 'layout.dart' show layoutContainerKinds;
import 'layout_node.dart';
import 'slot_kinds.dart' show allAppearanceProps;

// ── Slots con appearance que, en conjunto, cubren TODAS las props ──────────────
final Map<String, SlotComposition> _slots = <String, SlotComposition>{
  'img': const SlotComposition(
    fields: ['arte'],
    appearance: SlotAppearance(
      shape: 'rounded', aspect: '16:9', objectFit: 'cover',
      imageFocus: ImageFocus(x: 50, y: 40, zoom: 1.2),
      opacity: '90', shadow: 'md', paddingY: 'sm',
    ),
  ),
  'text': const SlotComposition(
    fields: ['nombre'],
    appearance: SlotAppearance(
      align: 'center', weight: 'bold', italic: true, underline: true,
      textTransform: 'uppercase', font: 'serif', lineHeight: 'relaxed',
      tracking: 'wide', textShadow: 'sm', size: 'xl', truncate: '2',
      truncateChars: 80, textColor: 'muted', bgColor: 'primary', display: 'badge',
    ),
  ),
  'refs': const SlotComposition(
    fields: ['habitat'],
    appearance: SlotAppearance(refColumns: '3', refTap: 'focus', refSize: 60),
  ),
  'accent': const SlotComposition(
    fields: ['elemento'],
    appearance: SlotAppearance(accentPosition: 'left'),
  ),
  // Slots simples referenciados por prefabs (sin appearance extra).
  'title': const SlotComposition(fields: ['nombre']),
  'subtitle': const SlotComposition(fields: ['fecha']),
  'caption': const SlotComposition(fields: ['clima']),
  'badge': const SlotComposition(fields: ['elemento']),
  'media': const SlotComposition(fields: ['arte']),
  'banner': const SlotComposition(fields: ['arte']),
  'avatar': const SlotComposition(fields: ['arte']),
  'images': const SlotComposition(fields: ['imagenes']),
  'cards': const SlotComposition(fields: ['protagonista']),
  'stats': const SlotComposition(fields: ['altura', 'peso']),
  'badges': const SlotComposition(fields: ['elemento', 'rareza']),
  'sectionLabel': const SlotComposition(fields: ['nombre']),
};

// ── Un nodo `component` por cada prefab del catálogo (rol→slot) ────────────────
const Map<String, Map<String, String>> _componentRoleSlots = <String, Map<String, String>>{
  'card': {'media': 'media', 'title': 'title', 'caption': 'caption', 'badge': 'badge'},
  'ref_gallery': {'refs': 'refs'},
  'carousel_peek': {'images': 'images'},
  'carousel_centered': {'images': 'images'},
  'gallery_grid': {'images': 'images'},
  'cards_carousel': {'cards': 'cards'},
  'divider': {},
  'stats_row': {'stats': 'stats'},
  'badge_row': {'badges': 'badges'},
  // KRO-217 — chips_row con slot REAL (espejo del TS `bfe020e`): reusa 'badges'
  // (elemento+rareza) → el golden EXIGE que el componente pinte sus chips; un host
  // que lo dropee produce un golden distinto (antes: slot vacío = drift silencioso).
  'chips_row': {'chips': 'badges'},
  'section_title': {'text': 'sectionLabel'},
  'hero_header': {'banner': 'banner', 'avatar': 'avatar', 'title': 'title', 'subtitle': 'subtitle'},
};

List<LayoutNode> _componentNodes() => <LayoutNode>[
      for (var i = 0; i < componentIds.length; i++)
        LayoutComponentNode(
          component: componentIds[i],
          slots: _componentRoleSlots[componentIds[i]] ?? const <String, String>{},
          place: GridPlacement(colStart: 1, rowStart: i + 3),
        ),
    ];

// ── Árbol que usa los 3 container kinds (grid raíz + flex + stack) ─────────────
LayoutContainerNode _buildRoot() {
  const flexRow = LayoutContainerNode(
    kind: 'flex', direction: 'row', gap: 'md', align: 'center',
    place: GridPlacement(colStart: 1, rowStart: 1),
    children: <LayoutNode>[
      LayoutSlotNode(slot: 'img', place: GridPlacement()),
      LayoutSlotNode(slot: 'text', place: GridPlacement(), grow: 1),
      LayoutSlotNode(slot: 'accent', place: GridPlacement()),
    ],
  );
  const zStack = LayoutContainerNode(
    kind: 'stack', gap: 'none', scrim: 'bottom',
    place: GridPlacement(colStart: 1, rowStart: 2),
    children: <LayoutNode>[
      LayoutSlotNode(slot: 'img', place: GridPlacement()),
      LayoutSlotNode(slot: 'refs', place: GridPlacement(position: 'absolute', x: 5, y: 60, w: 90)),
    ],
  );
  final components = _componentNodes();
  return LayoutContainerNode(
    kind: 'grid', columns: 1, rows: components.length + 2, gap: 'md',
    surface: const ContainerSurface(
      background: 'card', radius: 'lg', border: SurfaceBorder(width: 'thin'), shadow: 'sm', padding: 'md',
    ),
    children: <LayoutNode>[flexRow, zStack, ...components],
  );
}

/// Composición golden que ejercita TODO el motor de layout.
final ViewComposition layoutConformanceFixture = ViewComposition(
  recipe: 'hero_protagonico',
  action: 'none',
  slots: _slots,
  layout: _buildRoot(),
);

// ── Walkers de cobertura (los usa el test ratchet + el golden de Flutter) ──────
void _walk(LayoutNode node, void Function(LayoutNode) visit) {
  visit(node);
  if (node is LayoutContainerNode) {
    for (final c in node.children) {
      _walk(c, visit);
    }
  }
}

/// Container kinds presentes en el fixture.
Set<String> conformanceContainerKinds([ViewComposition? comp]) {
  final c = comp ?? layoutConformanceFixture;
  final out = <String>{};
  final layout = c.layout;
  if (layout != null) {
    _walk(layout, (n) {
      if (n is LayoutContainerNode) out.add(n.kind);
    });
  }
  return out;
}

/// Prefab components presentes en el fixture.
Set<String> conformanceComponents([ViewComposition? comp]) {
  final c = comp ?? layoutConformanceFixture;
  final out = <String>{};
  final layout = c.layout;
  if (layout != null) {
    _walk(layout, (n) {
      if (n is LayoutComponentNode) out.add(n.component);
    });
  }
  return out;
}

/// Props de appearance presentes en los slots del fixture (= `Object.keys` del TS:
/// las props NO nulas de cada `SlotAppearance`).
Set<String> conformanceAppearanceProps([ViewComposition? comp]) {
  final c = comp ?? layoutConformanceFixture;
  final out = <String>{};
  for (final sc in (c.slots).values) {
    final a = sc.appearance;
    if (a != null) out.addAll(_presentAppearanceProps(a));
  }
  return out;
}

/// Nombres de prop NO nulos en una `SlotAppearance` (espejo de `Object.keys`).
Set<String> _presentAppearanceProps(SlotAppearance a) {
  final s = <String>{};
  if (a.shape != null) s.add('shape');
  if (a.aspect != null) s.add('aspect');
  if (a.objectFit != null) s.add('objectFit');
  if (a.imageFocus != null) s.add('imageFocus');
  if (a.align != null) s.add('align');
  if (a.weight != null) s.add('weight');
  if (a.italic != null) s.add('italic');
  if (a.underline != null) s.add('underline');
  if (a.textTransform != null) s.add('textTransform');
  if (a.font != null) s.add('font');
  if (a.lineHeight != null) s.add('lineHeight');
  if (a.tracking != null) s.add('tracking');
  if (a.textShadow != null) s.add('textShadow');
  if (a.size != null) s.add('size');
  if (a.display != null) s.add('display');
  if (a.textColor != null) s.add('textColor');
  if (a.bgColor != null) s.add('bgColor');
  if (a.truncate != null) s.add('truncate');
  if (a.truncateChars != null) s.add('truncateChars');
  if (a.accentPosition != null) s.add('accentPosition');
  if (a.refSize != null) s.add('refSize');
  if (a.refColumns != null) s.add('refColumns');
  if (a.refTap != null) s.add('refTap');
  if (a.paddingY != null) s.add('paddingY');
  if (a.opacity != null) s.add('opacity');
  if (a.shadow != null) s.add('shadow');
  return s;
}

/// Catálogos esperados (la lista canónica a cubrir). Espejo de `CONFORMANCE_CATALOG`.
class ConformanceCatalog {
  const ConformanceCatalog._();
  static const List<String> containerKinds = layoutContainerKinds;
  static List<String> get components => componentIds;
  static const List<String> appearanceProps = allAppearanceProps;
}
