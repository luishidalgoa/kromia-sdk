/// `border_svg.dart` — KRO-202/KRO-224. Marcos/bordes ornamentales de carta.
/// Espejo Dart PURO de `@kromia/core` `border-svg.ts` (commit `f1e2ced`): DEBE
/// mantenerse 1:1 con el TS a mano (no entra al `.json` del contrato → sin bump
/// de protocolVersion; render-only).
///
/// Cada estilo dibuja en un lienzo `viewBox 0 0 300 420`, en BLANCO sobre
/// transparente → el cliente lo TIÑE (color sólido o gradiente del foil):
/// Studio como CSS `mask-image`; Flutter renderizando el string (flutter_svg)
/// con un tinte/ShaderMask. `m` = margen desde el borde natural de la carta
/// (px en el espacio 300×420). `bw` = ancho de la banda decorativa.
/// `fill` = hueco (solo trazo) | borde (banda) | marco (passe-partout).
///
/// La función devuelve el FRAGMENTO de markup (paths), como el TS; el caller lo
/// envuelve en `<svg viewBox="0 0 300 420">…</svg>` (ver [borderSvgDocument]).
library;

import 'dart:math' as math;

/// Estilos del marco (enum cerrado, espejo de `BorderStyle`).
const List<String> borderStyles = [
  'classic', 'double', 'sticker', 'emblema', 'tech', 'feston', 'gotico', 'barroco', 'none',
];

/// Rellenos del marco (espejo de `BorderFill`).
const List<String> borderFills = ['hueco', 'borde', 'marco'];

String _f(num n) => n.toStringAsFixed(1);

/// Rectángulo redondeado. `ccw` invierte el sentido (resta bajo evenodd).
String _rrPath(num x, num y, num w, num h, num r, [bool ccw = false]) {
  r = math.max(0, math.min(r, math.min(w / 2, h / 2)));
  if (!ccw) {
    return 'M${_f(x + r)},${_f(y)} H${_f(x + w - r)} A${_f(r)},${_f(r)} 0 0 1 ${_f(x + w)},${_f(y + r)} V${_f(y + h - r)} A${_f(r)},${_f(r)} 0 0 1 ${_f(x + w - r)},${_f(y + h)} H${_f(x + r)} A${_f(r)},${_f(r)} 0 0 1 ${_f(x)},${_f(y + h - r)} V${_f(y + r)} A${_f(r)},${_f(r)} 0 0 1 ${_f(x + r)},${_f(y)} Z';
  }
  return 'M${_f(x + r)},${_f(y)} A${_f(r)},${_f(r)} 0 0 0 ${_f(x)},${_f(y + r)} V${_f(y + h - r)} A${_f(r)},${_f(r)} 0 0 0 ${_f(x + r)},${_f(y + h)} H${_f(x + w - r)} A${_f(r)},${_f(r)} 0 0 0 ${_f(x + w)},${_f(y + h - r)} V${_f(y + r)} A${_f(r)},${_f(r)} 0 0 0 ${_f(x + w - r)},${_f(y)} Z';
}

String _diamond(num cx, num cy, num r) =>
    'M${_f(cx)},${_f(cy - r)} L${_f(cx + r)},${_f(cy)} L${_f(cx)},${_f(cy + r)} L${_f(cx - r)},${_f(cy)} Z';

/// Octágono (esquinas achaflanadas) — borde "Tecno".
String _octaPath(num x, num y, num w, num h, num c, [bool ccw = false]) {
  if (!ccw) {
    return 'M${_f(x + c)},${_f(y)} H${_f(x + w - c)} L${_f(x + w)},${_f(y + c)} V${_f(y + h - c)} L${_f(x + w - c)},${_f(y + h)} H${_f(x + c)} L${_f(x)},${_f(y + h - c)} V${_f(y + c)} Z';
  }
  return 'M${_f(x + c)},${_f(y)} L${_f(x)},${_f(y + c)} V${_f(y + h - c)} L${_f(x + c)},${_f(y + h)} H${_f(x + w - c)} L${_f(x + w)},${_f(y + h - c)} V${_f(y + c)} L${_f(x + w - c)},${_f(y)} Z';
}

/// Rectángulo festoneado (borde de semicírculos) — borde "Festón".
String _scallopRect(num x, num y, num w, num h, num bump) {
  String edge(num x1, num y1, num x2, num y2) {
    final len = math.sqrt(math.pow(x2 - x1, 2) + math.pow(y2 - y1, 2));
    final n = math.max(1, (len / bump).round());
    final dx = (x2 - x1) / n, dy = (y2 - y1) / n;
    final r = math.sqrt(dx * dx + dy * dy) / 2;
    final p = StringBuffer();
    for (var i = 0; i < n; i++) {
      p.write('A${_f(r)},${_f(r)} 0 0 1 ${_f(x1 + dx * (i + 1))},${_f(y1 + dy * (i + 1))} ');
    }
    return p.toString();
  }

  return 'M${_f(x)},${_f(y)} ${edge(x, y, x + w, y)}${edge(x + w, y, x + w, y + h)}'
      '${edge(x + w, y + h, x, y + h)}${edge(x, y + h, x, y)}Z';
}

/// Rectángulo con arcos apuntados arriba/abajo — borde "Gótico".
String _archRect(num x, num y, num w, num h, int cols, num ah) {
  final aw = w / cols;
  final p = StringBuffer('M${_f(x)},${_f(y)} ');
  for (var i = 0; i < cols; i++) {
    final xm = x + (i + 0.5) * aw, xe = x + (i + 1) * aw;
    p.write('L${_f(xm)},${_f(y - ah)} L${_f(xe)},${_f(y)} ');
  }
  p.write('L${_f(x + w)},${_f(y + h)} ');
  for (var i = 0; i < cols; i++) {
    final xm = x + w - (i + 0.5) * aw, xe = x + w - (i + 1) * aw;
    p.write('L${_f(xm)},${_f(y + h + ah)} L${_f(xe)},${_f(y + h)} ');
  }
  return '${p}Z';
}

/// Markup SVG del borde (BLANCO sobre transparente). '' si style=='none'.
/// [radius] (KRO-225) = redondeado de esquina del MARCO (espacio 300×420), para
/// que coincida con el redondeado de la carta. Default 20 = look previo. Los
/// estilos rectos (tech, octágono) lo ignoran a propósito.
String borderSvg(String style, num bw, num m, String fill, {num radius = 20}) {
  if (style == 'none') return '';
  const W = 300, H = 420;
  final r0 = math.max(0, math.min(radius, 100)); // clamp; _rrPath ya limita a w/2,h/2
  String stroke(String d, num sw, [num? op]) =>
      '<path d="$d" fill="none" stroke="#fff" stroke-width="$sw" opacity="${op ?? 1}"/>';
  String solid(String d) => '<path d="$d" fill="#fff"/>';
  final cardD = _rrPath(0, 0, W, H, r0); // a ras del borde natural de la carta

  var open = ''; // markup completo en modo "hueco"
  var outerCW = ''; // contorno exterior de la banda (el relleno "borde" para aquí)
  var winCW = '', winCCW = ''; // contorno de la ventana del arte
  var holes = <String>[]; // paths perforados (pips de esquina, tachones)
  var top = ''; // strokes encima del relleno (divisores, filetes)
  var extra = ''; // ornamentos sólidos en todos los modos (volutas, crestas)
  num winSW = 1.2;

  switch (style) {
    case 'classic':
      final g = math.max(3, (bw * 0.5).round());
      final x = m + 8, y = m + 8, w = W - 2 * (m + 8), h = H - 2 * (m + 8), r = r0;
      final ix = x + g, iy = y + g, iw = w - 2 * g, ih = h - 2 * g;
      final ir = math.max(2, r - g);
      final dia = [
        [x, y], [x + w, y], [x + w, y + h], [x, y + h],
      ].map((c) => _diamond(c[0], c[1], 4.5)).toList();
      outerCW = _rrPath(x, y, w, h, r);
      winCW = _rrPath(ix, iy, iw, ih, ir);
      winCCW = _rrPath(ix, iy, iw, ih, ir, true);
      holes = dia;
      winSW = 1;
      open = stroke(outerCW, 1.9, 1) + stroke(winCW, 1, 0.7) + dia.map(solid).join();
    case 'double':
      final x = m + 7, y = m + 7, w = W - 2 * (m + 7), h = H - 2 * (m + 7), r = r0;
      final ix = x + 10, iy = y + 10, iw = w - 20, ih = h - 20;
      final ir = math.max(2, r - 8);
      final mid = _rrPath(x + 4, y + 4, w - 8, h - 8, math.max(2, r - 3));
      outerCW = _rrPath(x, y, w, h, r);
      winCW = _rrPath(ix, iy, iw, ih, ir);
      winCCW = _rrPath(ix, iy, iw, ih, ir, true);
      winSW = 1.1;
      top = stroke(mid, 0.8, 0.4);
      open = stroke(outerCW, 2.6, 1) + stroke(mid, 0.8, 0.5) + stroke(winCW, 1.1, 0.85);
    case 'sticker':
      final R = r0, r2 = math.max(3, R - bw);
      final hair = _rrPath(m + bw + 4, m + bw + 4, W - 2 * (m + bw) - 8, H - 2 * (m + bw) - 8,
          math.max(2, r2 - 4));
      outerCW = _rrPath(m, m, W - 2 * m, H - 2 * m, R);
      winCW = _rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2);
      winCCW = _rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2, true);
      winSW = 1.3;
      top = stroke(hair, 1.1, 0.6);
      open = stroke(outerCW, 1.8, 1) + stroke(winCW, 1.3, 0.85) + stroke(hair, 1, 0.5);
    case 'emblema':
      final R = r0, r2 = math.max(3, R - bw);
      final studR = math.max(4, bw * 0.4);
      final studs = [
        _diamond(150, m + bw / 2, studR),
        _diamond(150, H - m - bw / 2, studR),
      ];
      final hair = _rrPath(m + bw + 4, m + bw + 4, W - 2 * (m + bw) - 8, H - 2 * (m + bw) - 8,
          math.max(2, r2 - 4));
      outerCW = _rrPath(m, m, W - 2 * m, H - 2 * m, R);
      winCW = _rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2);
      winCCW = _rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2, true);
      holes = studs;
      winSW = 1.3;
      top = stroke(hair, 1, 0.5);
      open = stroke(outerCW, 1.8, 1) + stroke(winCW, 1.3, 0.85) + studs.map(solid).join() +
          stroke(hair, 1, 0.5);
    case 'tech':
      final c = math.max(13, bw + 8), ci = math.max(5, c - bw);
      final diag = stroke('M${_f(W - m - c)},${_f(m)} L${_f(W - m)},${_f(m + c)}', 2, 0.85) +
          stroke('M${_f(m + c)},${_f(H - m)} L${_f(m)},${_f(H - m - c)}', 2, 0.85);
      outerCW = _octaPath(m, m, W - 2 * m, H - 2 * m, c);
      winCW = _octaPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), ci);
      winCCW = _octaPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), ci, true);
      winSW = 1.3;
      top = diag;
      open = stroke(outerCW, 1.8, 1) + stroke(winCW, 1.3, 0.85) + diag;
    case 'feston':
      final R = r0;
      final win = _scallopRect(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), 18);
      outerCW = _rrPath(m, m, W - 2 * m, H - 2 * m, R);
      winCW = win;
      winCCW = win;
      winSW = 1.2;
      final hair =
          _scallopRect(m + bw + 5, m + bw + 5, W - 2 * (m + bw) - 10, H - 2 * (m + bw) - 10, 17);
      top = stroke(hair, 0.9, 0.45);
      open = stroke(outerCW, 1.8, 1) + stroke(win, 1.3, 0.85) + stroke(hair, 0.9, 0.45);
    case 'gotico':
      final R = r0;
      final ah = math.min(bw * 0.72, 22);
      final win = _archRect(m + bw, m + bw + ah, W - 2 * (m + bw), H - 2 * (m + bw) - 2 * ah, 6, ah);
      outerCW = _rrPath(m, m, W - 2 * m, H - 2 * m, R);
      winCW = win;
      winCCW = win;
      winSW = 1.2;
      final pips = StringBuffer();
      for (var i = 0; i < 6; i++) {
        final x = m + bw + (i + 0.5) * ((W - 2 * (m + bw)) / 6);
        pips.write('<circle cx="${_f(x)}" cy="${_f(m + bw * 0.5)}" r="1.6" fill="#fff"/>');
        pips.write('<circle cx="${_f(x)}" cy="${_f(H - m - bw * 0.5)}" r="1.6" fill="#fff"/>');
      }
      extra = pips.toString();
      open = stroke(outerCW, 1.8, 1) + stroke(win, 1.3, 0.85);
    case 'barroco':
      final R = r0, r2 = math.max(3, R - bw);
      outerCW = _rrPath(m, m, W - 2 * m, H - 2 * m, R);
      winCW = _rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2);
      winCCW = winCW;
      winSW = 1.1;
      final sc = math.max(0.5, math.min(1.05, bw / 15));
      final ix = m + bw, iy = m + bw, ax = W - m - bw, ay = H - m - bw;
      const cxw = 150, cyh = 210;
      String gem(num x, num y, num r) => '<path d="${_diamond(x, y, r)}" fill="#fff"/>';
      const arm = 'M6,6 C26,5 47,6 47,19 C47,28 39,30 35,25 C32,21 37,16 39,20'
          ' M6,6 C5,26 6,47 19,47 C28,47 30,39 25,35 C21,32 16,37 20,39';
      String cornerG(num x, num y, num sx, num sy) =>
          '<g transform="translate(${_f(x)},${_f(y)}) scale(${(sx * sc).toStringAsFixed(3)},${(sy * sc).toStringAsFixed(3)})">'
          '<path d="$arm" fill="none" stroke="#fff" stroke-width="${(1.7 / sc).toStringAsFixed(2)}" stroke-linecap="round"/>'
          '<circle cx="6" cy="6" r="3" fill="#fff"/><circle cx="6" cy="6" r="1.2" fill="#0e1a12"/></g>';
      final corners =
          cornerG(ix, iy, 1, 1) + cornerG(ax, iy, -1, 1) + cornerG(ax, ay, -1, -1) + cornerG(ix, ay, 1, -1);
      String shell(num cx, num cy, int dir, bool vert) {
        final r = math.max(9, bw * 0.72);
        final g = StringBuffer();
        if (!vert) {
          g.write(
              '<path d="M${_f(cx - r)},${_f(cy)} A${_f(r)},${_f(r)} 0 0 ${dir > 0 ? 1 : 0} ${_f(cx + r)},${_f(cy)}" fill="none" stroke="#fff" stroke-width="1.3"/>');
          for (var i = 0; i <= 8; i++) {
            final a = math.pi * (i / 8);
            g.write(
                '<line x1="${_f(cx)}" y1="${_f(cy)}" x2="${_f(cx - math.cos(a) * r)}" y2="${_f(cy + dir * math.sin(a) * r * 0.9)}" stroke="#fff" stroke-width="0.8" opacity="0.9"/>');
          }
          g.write(gem(cx, cy + dir * (r + 5), 4.5));
        } else {
          g.write(
              '<path d="M${_f(cx)},${_f(cy - r)} A${_f(r)},${_f(r)} 0 0 ${dir > 0 ? 0 : 1} ${_f(cx)},${_f(cy + r)}" fill="none" stroke="#fff" stroke-width="1.3"/>');
          for (var i = 0; i <= 8; i++) {
            final a = math.pi * (i / 8);
            g.write(
                '<line x1="${_f(cx)}" y1="${_f(cy)}" x2="${_f(cx + dir * math.sin(a) * r * 0.9)}" y2="${_f(cy - math.cos(a) * r)}" stroke="#fff" stroke-width="0.8" opacity="0.9"/>');
          }
          g.write(gem(cx + dir * (r + 5), cy, 4.5));
        }
        return g.toString();
      }

      final crests = shell(cxw, iy, 1, false) +
          shell(cxw, ay, -1, false) +
          shell(ix, cyh, 1, true) +
          shell(ax, cyh, -1, true);
      final inner = stroke(
          _rrPath(ix + 5, iy + 5, W - 2 * ix - 10, H - 2 * iy - 10, math.max(2, r2 - 5)), 0.8, 0.5);
      extra = corners;
      open = stroke(outerCW, 1.8, 1) + stroke(winCW, 1.2, 0.85) + inner + crests;
    default:
      final R = r0, r2 = math.max(3, R - bw);
      outerCW = _rrPath(m, m, W - 2 * m, H - 2 * m, R);
      winCW = _rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2);
      winCCW = _rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2, true);
      open = stroke(outerCW, 1.8, 1) + stroke(winCW, 1.3, 0.85);
  }

  if (fill == 'hueco') return open + extra;
  final region = fill == 'marco' ? cardD : outerCW;
  final holesD = holes.isNotEmpty ? ' ${holes.join(' ')}' : '';
  return '<path d="$region $winCCW$holesD" fill="#fff" fill-rule="evenodd"/>'
      '${stroke(winCW, winSW * 0.85, 0.5)}$top$extra';
}

/// Documento SVG completo listo para renderizar (envuelve el fragmento de
/// [borderSvg] en `<svg viewBox="0 0 300 420">`). '' si style=='none'.
String borderSvgDocument(String style, num bw, num m, String fill, {num radius = 20}) {
  final body = borderSvg(style, bw, m, fill, radius: radius);
  if (body.isEmpty) return '';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420">$body</svg>';
}
