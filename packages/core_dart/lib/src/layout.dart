/// `layout.dart` — KRO-133. Lógica PURA del árbol de LAYOUT. Espejo de `layout.ts`
/// (catálogos cerrados + validador + helpers de grid + auto-migración).
///
/// Ground truth cross-language: `tests/layout.test.ts`. Se omiten los helpers de
/// CSS-string del TS (`trackToCss`/`gridColumnsTemplate`/`gridRowsTemplate`),
/// específicos del render web — el motor Flutter (S2) deriva el layout nativo de
/// `gridCols`/track-tokens, no de cadenas CSS.
library;

import 'dart:math' as math;

import 'components.dart';
import 'composition.dart' show SlotComposition;
import 'layout_node.dart';
import 'recipes.dart';

// ── Catálogos cerrados ────────────────────────────────────────────────────────
const List<String> layoutContainerKinds = ['flex', 'grid', 'stack'];
const List<String> layoutDirections = ['row', 'column'];
const List<String> layoutAligns = ['start', 'center', 'end', 'stretch'];
const List<String> layoutJustify = ['start', 'center', 'end', 'between', 'around'];
const List<String> layoutGaps = ['none', 'xs', 'sm', 'md', 'lg'];

const List<String> surfaceBackgrounds = ['none', 'card', 'muted', 'accent', 'primary'];
const List<String> surfaceBorderWidths = ['thin', 'medium', 'thick'];
const List<String> surfaceBorderSides = ['top', 'right', 'bottom', 'left'];
const List<String> surfaceBorderColors = ['border', 'muted', 'accent', 'primary', 'foreground'];
const List<String> surfaceBorderStyles = ['solid', 'dashed', 'dotted'];
const List<String> surfaceRadii = ['none', 'sm', 'md', 'lg', 'xl', 'full'];
const List<String> surfaceRadiusCorners = ['tl', 'tr', 'bl', 'br'];
const List<String> surfaceShadows = ['none', 'sm', 'md', 'lg', 'xl'];
const List<String> surfacePaddings = ['none', 'xs', 'sm', 'md', 'lg', 'xl'];

/// Tokens de tamaño de pista del grid (KRO-133 F3).
const List<String> trackSizes = ['1fr', '2fr', '3fr', 'auto', 'content'];
const Set<String> _trackTokens = {'1fr', '2fr', '3fr', 'auto', 'content'};

/// Profundidad máxima de anidamiento (raíz = 1).
const int maxLayoutDepth = 5;
const int maxGridColumns = 6;
const int maxGridRows = 6;

// ── Helpers de geometría (canónicos, KRO-166) ────────────────────────────────

GridPlacement? _placeOf(LayoutNode n) => switch (n) {
      LayoutSlotNode s => s.place,
      LayoutContainerNode c => c.place,
      LayoutComponentNode k => k.place,
    };

/// Default de columnas = 1 (la verdad del render). columns clampado a ≥ 1.
int gridCols(LayoutContainerNode node) => math.max(1, node.columns ?? 1);

/// Nº de filas EFECTIVAS de un grid (explícitas o las que exige la colocación,
/// ignorando hijos absolutos).
int gridRows(LayoutContainerNode node) {
  num maxv = 1;
  for (final ch in node.children) {
    final place = _placeOf(ch);
    if (place?.position == 'absolute') continue;
    final rs = place?.rowStart ?? 1;
    final rsp = place?.rowSpan ?? 1;
    final end = rs + rsp - 1;
    if (end > maxv) maxv = end;
  }
  return math.max(node.rows ?? 1, maxv).toInt();
}

/// ¿Algún hijo EN FLUJO (no absoluto) cubre la celda (col,row)?
bool cellCovered(LayoutContainerNode node, int col, int row) {
  return node.children.any((ch) {
    final place = _placeOf(ch);
    if (place?.position == 'absolute') return false;
    final cs = place?.colStart ?? 1;
    final csp = place?.colSpan ?? 1;
    final rs = place?.rowStart ?? 1;
    final rsp = place?.rowSpan ?? 1;
    return col >= cs && col < cs + csp && row >= rs && row < rs + rsp;
  });
}

// ── Validación ───────────────────────────────────────────────────────────────

class LayoutIssue {
  final String level; // 'error' | 'warn'
  final String path;
  final String message;
  const LayoutIssue({required this.level, required this.path, required this.message});

  @override
  String toString() => '[$level] $path: $message';
}

class LayoutValidationResult {
  final bool ok;
  final List<LayoutIssue> issues;
  const LayoutValidationResult({required this.ok, required this.issues});
}

/// Valida el árbol de layout (estructura/catálogos/profundidad/slots/placement/
/// surface/tracks/solapes). `slots` = los declarados en la composición.
LayoutValidationResult validateLayout(
  LayoutContainerNode? root, {
  required Map<String, SlotComposition> slots,
}) {
  final issues = <LayoutIssue>[];
  if (root == null) {
    return LayoutValidationResult(ok: true, issues: issues); // sin layout → válido
  }

  final slotKeys = slots.keys.toSet();
  final seenSlots = <String>{};

  void walk(LayoutNode node, String path, int depth) {
    // Slot-hoja.
    if (node is LayoutSlotNode) {
      if (node.slot.isEmpty) {
        issues.add(LayoutIssue(level: 'error', path: path, message: 'Slot sin nombre.'));
        return;
      }
      if (!slotKeys.contains(node.slot)) {
        issues.add(LayoutIssue(
            level: 'error', path: path, message: 'El slot "${node.slot}" no está declarado en la composición.'));
      }
      if (seenSlots.contains(node.slot)) {
        issues.add(LayoutIssue(
            level: 'error', path: path, message: 'El slot "${node.slot}" aparece más de una vez en el layout.'));
      }
      seenSlots.add(node.slot);
      if (node.grow != null && (!node.grow!.isFinite || node.grow! < 0)) {
        issues.add(LayoutIssue(level: 'error', path: path, message: '`grow` debe ser un número ≥ 0.'));
      }
      return;
    }

    // Componente prefabricado.
    if (node is LayoutComponentNode) {
      final def = getComponentDef(node.component);
      if (def == null) {
        issues.add(LayoutIssue(level: 'error', path: path, message: 'Componente desconocido: "${node.component}".'));
        return;
      }
      if (node.surface != null) _validateSurface(node.surface!, '$path.surface', issues);
      final mapped = node.slots ?? const {};
      for (final role in def.roles) {
        if (!role.optional && mapped[role.id] == null && !(node.hidden?.contains(role.id) ?? false)) {
          issues.add(LayoutIssue(
              level: 'warn', path: path, message: 'El componente "${def.displayName}" espera el rol "${role.label}".'));
        }
      }
      mapped.forEach((roleId, slotId) {
        if (!def.roles.any((r) => r.id == roleId)) {
          issues.add(LayoutIssue(
              level: 'warn', path: path, message: 'Rol "$roleId" no existe en el componente "${def.displayName}".'));
        }
        if (!slotKeys.contains(slotId)) {
          issues.add(LayoutIssue(
              level: 'error',
              path: path,
              message: 'El slot "$slotId" (rol "$roleId") no está declarado en la composición.'));
        }
        if (seenSlots.contains(slotId)) {
          issues.add(LayoutIssue(
              level: 'error', path: path, message: 'El slot "$slotId" aparece más de una vez en el layout.'));
        }
        seenSlots.add(slotId);
      });
      return;
    }

    // Contenedor.
    final container = node as LayoutContainerNode;
    if (depth > maxLayoutDepth) {
      issues.add(LayoutIssue(
          level: 'error', path: path, message: 'Anidamiento demasiado profundo (máx $maxLayoutDepth).'));
      return;
    }
    if (!layoutContainerKinds.contains(container.kind)) {
      issues.add(LayoutIssue(level: 'error', path: path, message: 'Tipo de contenedor inválido: "${container.kind}".'));
    }
    if (container.gap != null && !layoutGaps.contains(container.gap)) {
      issues.add(LayoutIssue(level: 'error', path: path, message: 'Separación (gap) inválida: "${container.gap}".'));
    }
    if (container.align != null && !layoutAligns.contains(container.align)) {
      issues.add(LayoutIssue(level: 'error', path: path, message: 'Alineación inválida: "${container.align}".'));
    }
    if (container.justify != null && !layoutJustify.contains(container.justify)) {
      issues.add(LayoutIssue(level: 'error', path: path, message: 'Distribución inválida: "${container.justify}".'));
    }
    if (container.direction != null && !layoutDirections.contains(container.direction)) {
      issues.add(LayoutIssue(level: 'error', path: path, message: 'Dirección inválida: "${container.direction}".'));
    }
    if (container.kind == 'grid' &&
        container.columns != null &&
        (container.columns! < 1 || container.columns! > maxGridColumns)) {
      issues.add(LayoutIssue(
          level: 'error', path: path, message: 'Columnas del grid fuera de rango (1..$maxGridColumns).'));
    }
    if (container.kind == 'grid' &&
        container.rows != null &&
        (container.rows! < 1 || container.rows! > maxGridRows)) {
      issues.add(LayoutIssue(level: 'error', path: path, message: 'Filas del grid fuera de rango (1..$maxGridRows).'));
    }
    if (container.children.isEmpty) {
      issues.add(LayoutIssue(level: 'warn', path: path, message: 'Contenedor vacío (sin hijos).'));
      return;
    }
    if (container.surface != null) _validateSurface(container.surface!, '$path.surface', issues);
    if (container.kind == 'grid') {
      final colsN = gridCols(container);
      for (final entry in [
        ('columnSizes', container.columnSizes),
        ('rowSizes', container.rowSizes),
      ]) {
        final propName = entry.$1;
        final arr = entry.$2;
        if (arr == null) continue;
        for (var i = 0; i < arr.length; i++) {
          if (!_trackTokens.contains(arr[i])) {
            issues.add(LayoutIssue(
                level: 'warn',
                path: '$path.$propName[$i]',
                message:
                    'Track "${arr[i]}" desconocido (esperaba: ${_trackTokens.join('|')}) — el render usará 1fr.'));
          }
        }
        if (propName == 'columnSizes' && arr.length > colsN) {
          issues.add(LayoutIssue(
              level: 'warn',
              path: '$path.columnSizes',
              message:
                  'columnSizes tiene ${arr.length} entradas pero el grid tiene $colsN columnas (las extra se ignoran).'));
        }
      }
    }

    final cols = container.kind == 'grid' ? gridCols(container) : null;
    final rows = container.kind == 'grid' ? container.rows : null;
    for (var i = 0; i < container.children.length; i++) {
      final child = container.children[i];
      final childPath = '$path.children[$i]';
      final place = _placeOf(child);
      if (place != null) _validatePlacement(place, cols, rows, childPath, issues);
      walk(child, childPath, depth + 1);
    }

    // Solapes (grid): dos hijos en flujo que comparten celda.
    if (container.kind == 'grid') {
      final rects = <({int i, num cs, num csp, num rs, num rsp})?>[];
      for (var i = 0; i < container.children.length; i++) {
        final place = _placeOf(container.children[i]);
        if (place?.position == 'absolute') {
          rects.add(null);
        } else {
          rects.add((
            i: i,
            cs: place?.colStart ?? 1,
            csp: place?.colSpan ?? 1,
            rs: place?.rowStart ?? 1,
            rsp: place?.rowSpan ?? 1,
          ));
        }
      }
      for (var a = 0; a < rects.length; a++) {
        final ra = rects[a];
        if (ra == null) continue;
        for (var b = a + 1; b < rects.length; b++) {
          final rb = rects[b];
          if (rb == null) continue;
          final overlap = ra.cs < rb.cs + rb.csp &&
              rb.cs < ra.cs + ra.csp &&
              ra.rs < rb.rs + rb.rsp &&
              rb.rs < ra.rs + ra.rsp;
          if (overlap) {
            issues.add(LayoutIssue(
              level: 'warn',
              path: '$path.children[${rb.i}]',
              message:
                  'Los bloques #${ra.i + 1} y #${rb.i + 1} se solapan en la celda (${math.max(ra.cs, rb.cs)},${math.max(ra.rs, rb.rs)}).',
            ));
          }
        }
      }
    }
  }

  walk(root, 'root', 1);
  return LayoutValidationResult(ok: issues.every((i) => i.level != 'error'), issues: issues);
}

void _validateSurface(ContainerSurface surface, String path, List<LayoutIssue> issues) {
  bool inSet(String? v, List<String> set) => v == null || set.contains(v);
  if (!inSet(surface.background, surfaceBackgrounds)) {
    issues.add(LayoutIssue(level: 'error', path: '$path.background', message: 'background "${surface.background}" no es válido.'));
  }
  if (!inSet(surface.radius, surfaceRadii)) {
    issues.add(LayoutIssue(level: 'error', path: '$path.radius', message: 'radius "${surface.radius}" no es válido.'));
  }
  if (surface.radiusCorners?.any((c) => !surfaceRadiusCorners.contains(c)) ?? false) {
    issues.add(LayoutIssue(level: 'error', path: '$path.radiusCorners', message: 'radiusCorners solo admite tl/tr/bl/br.'));
  }
  if (!inSet(surface.shadow, surfaceShadows)) {
    issues.add(LayoutIssue(level: 'error', path: '$path.shadow', message: 'shadow "${surface.shadow}" no es válido.'));
  }
  if (!inSet(surface.padding, surfacePaddings)) {
    issues.add(LayoutIssue(level: 'error', path: '$path.padding', message: 'padding "${surface.padding}" no es válido.'));
  }
  final border = surface.border;
  if (border != null) {
    if (!inSet(border.width, surfaceBorderWidths)) {
      issues.add(LayoutIssue(level: 'error', path: '$path.border.width', message: 'border.width "${border.width}" no es válido.'));
    }
    if (border.sides?.any((sd) => !surfaceBorderSides.contains(sd)) ?? false) {
      issues.add(LayoutIssue(level: 'error', path: '$path.border.sides', message: 'border.sides solo admite top/right/bottom/left.'));
    }
    if (!inSet(border.style, surfaceBorderStyles)) {
      issues.add(LayoutIssue(level: 'error', path: '$path.border.style', message: 'border.style "${border.style}" no es válido.'));
    }
  }
}

void _validatePlacement(
    GridPlacement place, int? cols, int? rows, String path, List<LayoutIssue> issues) {
  // Modo ABSOLUTO.
  if (place.position == 'absolute') {
    bool pct(num? v, num lo) => v == null || (v.isFinite && v >= lo && v <= 100);
    if (!pct(place.x, 0) || !pct(place.y, 0)) {
      issues.add(LayoutIssue(level: 'error', path: path, message: 'Posición absoluta: x/y deben ser números entre 0 y 100 (%).'));
    }
    if (!pct(place.w, 5) || !pct(place.h, 5)) {
      issues.add(LayoutIssue(level: 'error', path: path, message: 'Posición absoluta: w/h deben ser números entre 5 y 100 (%).'));
    }
    return;
  }
  if (cols == null) {
    issues.add(LayoutIssue(level: 'warn', path: path, message: '`place` solo aplica dentro de un contenedor grid.'));
    return;
  }
  bool intGte1(num? v) => v == null || (v % 1 == 0 && v >= 1);
  if (!intGte1(place.colStart) || !intGte1(place.colSpan) || !intGte1(place.rowStart) || !intGte1(place.rowSpan)) {
    issues.add(LayoutIssue(
        level: 'error', path: path, message: '`place` (colStart/colSpan/rowStart/rowSpan) deben ser enteros ≥ 1.'));
    return;
  }
  final colStart = place.colStart ?? 1;
  final colSpan = place.colSpan ?? 1;
  if (colStart > cols) {
    issues.add(LayoutIssue(
        level: 'warn', path: path, message: 'La celda empieza en la columna $colStart pero el grid tiene $cols.'));
  } else if (colStart + colSpan - 1 > cols) {
    issues.add(LayoutIssue(
        level: 'warn', path: path, message: 'La celda se sale por la derecha (col $colStart+$colSpan > $cols).'));
  }
  if (rows != null) {
    final rowStart = place.rowStart ?? 1;
    final rowSpan = place.rowSpan ?? 1;
    if (rowStart > rows) {
      issues.add(LayoutIssue(
          level: 'warn', path: path, message: 'La celda empieza en la fila $rowStart pero el grid tiene $rows.'));
    } else if (rowStart + rowSpan - 1 > rows) {
      issues.add(LayoutIssue(
          level: 'warn', path: path, message: 'La celda se sale por abajo (fila $rowStart+$rowSpan > $rows).'));
    }
  }
}

// ── Poda + migración ─────────────────────────────────────────────────────────

/// Poda las hojas-slot inválidas + desmapea roles de componente a slots
/// inválidos. Pura (devuelve un árbol nuevo, modelos inmutables).
LayoutContainerNode pruneLayoutSlots(LayoutContainerNode layout, List<String> validSlotIds) {
  final valid = validSlotIds.toSet();
  LayoutNode? walk(LayoutNode node) {
    switch (node) {
      case LayoutSlotNode s:
        return valid.contains(s.slot) ? s : null;
      case LayoutComponentNode c:
        final kept = <String, String>{};
        (c.slots ?? const {}).forEach((role, sid) {
          if (valid.contains(sid)) kept[role] = sid;
        });
        return c.copyWith(slots: kept);
      case LayoutContainerNode k:
        final kids = <LayoutNode>[];
        for (final ch in k.children) {
          final w = walk(ch);
          if (w != null) kids.add(w);
        }
        return k.copyWith(children: kids);
    }
  }

  return walk(layout) as LayoutContainerNode;
}

/// Deriva un árbol flex-column (1 slot-hoja por slot, en orden de la receta).
/// Respeta un `layout` ya existente. NO destructivo.
LayoutContainerNode migrateSlotsToLayout({
  String? recipe,
  required Map<String, SlotComposition> slots,
  LayoutContainerNode? layout,
}) {
  if (layout != null) return layout;
  final declared = slots;
  final manifest = recipe != null ? getRecipeManifest(recipe) : null;
  final ordered = manifest != null
      ? manifest.slots.map((s) => s.id).where((id) => declared.containsKey(id)).toList()
      : declared.keys.toList();
  for (final k in declared.keys) {
    if (!ordered.contains(k)) ordered.add(k);
  }
  return LayoutContainerNode(
    kind: 'flex',
    direction: 'column',
    gap: 'sm',
    children: ordered.map((slot) => LayoutSlotNode(slot: slot)).toList(),
  );
}

/// Variante GRID de la migración: grid de 1 columna con los slots apilados.
LayoutContainerNode migrateSlotsToGrid({
  String? recipe,
  required Map<String, SlotComposition> slots,
  LayoutContainerNode? layout,
}) {
  if (layout != null) return layout;
  final flex = migrateSlotsToLayout(recipe: recipe, slots: slots);
  return LayoutContainerNode(kind: 'grid', columns: 1, gap: 'sm', children: flex.children);
}

// ── Helpers de recorrido ─────────────────────────────────────────────────────

/// Profundidad máxima del árbol (raíz = 1).
int layoutDepth(LayoutNode node) {
  if (node is! LayoutContainerNode) return 1;
  if (node.children.isEmpty) return 1;
  return 1 + node.children.map(layoutDepth).reduce(math.max);
}

/// Nombres de todos los slots referenciados por el árbol (en orden de aparición).
List<String> collectLayoutSlots(LayoutNode node) {
  switch (node) {
    case LayoutSlotNode s:
      return [s.slot];
    case LayoutComponentNode c:
      return (c.slots ?? const {}).values.toList();
    case LayoutContainerNode k:
      return k.children.expand(collectLayoutSlots).toList();
  }
}

/// Clampa la colocación `place` al nº de columnas del grid padre. Devuelve la
/// MISMA instancia si no cambia (paridad con el TS).
GridPlacement? clampPlaceToGrid(GridPlacement? place, int cols) {
  if (place == null) return place;
  final c = math.max(1, cols);
  final colStart = math.min(math.max(1, place.colStart ?? 1), c);
  final colSpan = math.min(math.max(1, place.colSpan ?? 1), c - colStart + 1);
  if (colStart == place.colStart && colSpan == place.colSpan) return place;
  return GridPlacement(
    colStart: colStart,
    colSpan: colSpan,
    rowStart: place.rowStart,
    rowSpan: place.rowSpan,
    justifySelf: place.justifySelf,
    alignSelf: place.alignSelf,
    position: place.position,
    x: place.x,
    y: place.y,
    w: place.w,
    h: place.h,
  );
}
