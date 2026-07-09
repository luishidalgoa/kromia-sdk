/**
 * border-svg — KRO-202 (movido a @kromia/core, KRO-224 fidelidad).
 *
 * Generadores de SVG para los marcos/bordes ornamentales de carta. Porte
 * FIEL del mockup `Iridescent Card (standalone).html` (`borderSVG` + helpers),
 * de JS puro a TS. Cada estilo dibuja en un lienzo `viewBox 0 0 300 420`, en
 * BLANCO sobre transparente → los clientes lo usan como `mask` sobre un relleno
 * (color sólido o gradiente del foil) para teñir el borde: Studio como CSS
 * `mask-image` (helper `borderMaskUrl`, en el host), Flutter espejando esta
 * función en `core_dart` y renderizando el string (flutter_svg o parseo).
 *
 * TS PURO (sin DOM/React) → fuente única cross-platform. `m` = margen desde el
 * borde natural de la carta (px en el espacio 300×420). `bw` = ancho de la banda
 * decorativa. `fill` = hueco | borde | marco.
 */

export type BorderStyle =
  | 'classic' | 'double' | 'sticker' | 'emblema' | 'tech' | 'feston' | 'gotico' | 'barroco' | 'none';
export type BorderFill = 'hueco' | 'borde' | 'marco';

const f = (n: number): string => (+n).toFixed(1);

/** Rectángulo redondeado. `ccw` invierte el sentido (resta bajo evenodd). */
function rrPath(x: number, y: number, w: number, h: number, r: number, ccw?: boolean): string {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!ccw)
    return `M${f(x + r)},${f(y)} H${f(x + w - r)} A${f(r)},${f(r)} 0 0 1 ${f(x + w)},${f(y + r)} V${f(y + h - r)} A${f(r)},${f(r)} 0 0 1 ${f(x + w - r)},${f(y + h)} H${f(x + r)} A${f(r)},${f(r)} 0 0 1 ${f(x)},${f(y + h - r)} V${f(y + r)} A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(y)} Z`;
  return `M${f(x + r)},${f(y)} A${f(r)},${f(r)} 0 0 0 ${f(x)},${f(y + r)} V${f(y + h - r)} A${f(r)},${f(r)} 0 0 0 ${f(x + r)},${f(y + h)} H${f(x + w - r)} A${f(r)},${f(r)} 0 0 0 ${f(x + w)},${f(y + h - r)} V${f(y + r)} A${f(r)},${f(r)} 0 0 0 ${f(x + w - r)},${f(y)} Z`;
}

function diamond(cx: number, cy: number, r: number): string {
  return `M${f(cx)},${f(cy - r)} L${f(cx + r)},${f(cy)} L${f(cx)},${f(cy + r)} L${f(cx - r)},${f(cy)} Z`;
}

/** Octágono (esquinas achaflanadas) — borde "Tecno". */
function octaPath(x: number, y: number, w: number, h: number, c: number, ccw?: boolean): string {
  if (!ccw)
    return `M${f(x + c)},${f(y)} H${f(x + w - c)} L${f(x + w)},${f(y + c)} V${f(y + h - c)} L${f(x + w - c)},${f(y + h)} H${f(x + c)} L${f(x)},${f(y + h - c)} V${f(y + c)} Z`;
  return `M${f(x + c)},${f(y)} L${f(x)},${f(y + c)} V${f(y + h - c)} L${f(x + c)},${f(y + h)} H${f(x + w - c)} L${f(x + w)},${f(y + h - c)} V${f(y + c)} L${f(x + w - c)},${f(y)} Z`;
}

/** Rectángulo festoneado (borde de semicírculos) — borde "Festón". */
function scallopRect(x: number, y: number, w: number, h: number, bump: number): string {
  const edge = (x1: number, y1: number, x2: number, y2: number): string => {
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(len / bump));
    const dx = (x2 - x1) / n, dy = (y2 - y1) / n, r = Math.hypot(dx, dy) / 2;
    let p = '';
    for (let i = 0; i < n; i++) p += `A${f(r)},${f(r)} 0 0 1 ${f(x1 + dx * (i + 1))},${f(y1 + dy * (i + 1))} `;
    return p;
  };
  return `M${f(x)},${f(y)} ` + edge(x, y, x + w, y) + edge(x + w, y, x + w, y + h)
    + edge(x + w, y + h, x, y + h) + edge(x, y + h, x, y) + 'Z';
}

/** Rectángulo con arcos apuntados arriba/abajo — borde "Gótico". */
function archRect(x: number, y: number, w: number, h: number, cols: number, ah: number): string {
  const aw = w / cols;
  let p = `M${f(x)},${f(y)} `;
  for (let i = 0; i < cols; i++) { const xm = x + (i + 0.5) * aw, xe = x + (i + 1) * aw; p += `L${f(xm)},${f(y - ah)} L${f(xe)},${f(y)} `; }
  p += `L${f(x + w)},${f(y + h)} `;
  for (let i = 0; i < cols; i++) { const xm = x + w - (i + 0.5) * aw, xe = x + w - (i + 1) * aw; p += `L${f(xm)},${f(y + h + ah)} L${f(xe)},${f(y + h)} `; }
  return p + 'Z';
}

/** Markup SVG del borde (BLANCO sobre transparente). '' si style==='none'.
 *  `radius` (KRO-225) = redondeado de esquina del MARCO (espacio 300×420), para
 *  que coincida con el redondeado de la carta. Default 20 = look previo. Los
 *  estilos rectos (tech, octágono) lo ignoran a propósito. */
export function borderSVG(style: BorderStyle, bw: number, m: number, fill: BorderFill, radius = 20): string {
  if (style === 'none') return '';
  const W = 300, H = 420;
  const R0 = Math.max(0, Math.min(radius, 100)); // KRO-225 — radio del marco (clamp; rrPath ya limita a w/2,h/2)
  const stroke = (d: string, sw: number, op?: number): string => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${sw}" opacity="${op == null ? 1 : op}"/>`;
  const solid = (d: string): string => `<path d="${d}" fill="#fff"/>`;
  const cardD = rrPath(0, 0, W, H, R0); // flush to the card's natural edge

  let open = '';      // markup completo en modo "hueco"
  let outerCW = '';   // contorno exterior de la banda (el relleno "borde" para aquí)
  let winCW = '', winCCW = ''; // contorno de la ventana del arte (los rellenos paran aquí)
  let holes: string[] = []; // paths perforados (pips de esquina, tachones)
  let top = '';       // strokes encima del relleno (divisores, filetes)
  let extra = '';     // ornamentos sólidos en todos los modos (volutas, crestas)
  let winSW = 1.2;

  switch (style) {
    case 'classic': {
      const g = Math.max(3, Math.round(bw * 0.5));
      const x = m + 8, y = m + 8, w = W - 2 * (m + 8), h = H - 2 * (m + 8), r = R0;
      const ix = x + g, iy = y + g, iw = w - 2 * g, ih = h - 2 * g, ir = Math.max(2, r - g);
      const dia = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([cx, cy]) => diamond(cx, cy, 4.5));
      outerCW = rrPath(x, y, w, h, r);
      winCW = rrPath(ix, iy, iw, ih, ir); winCCW = rrPath(ix, iy, iw, ih, ir, true);
      holes = dia; winSW = 1;
      open = stroke(outerCW, 1.9, 1) + stroke(winCW, 1, 0.7) + dia.map(solid).join('');
      break;
    }
    case 'double': {
      const x = m + 7, y = m + 7, w = W - 2 * (m + 7), h = H - 2 * (m + 7), r = R0;
      const ix = x + 10, iy = y + 10, iw = w - 20, ih = h - 20, ir = Math.max(2, r - 8);
      const mid = rrPath(x + 4, y + 4, w - 8, h - 8, Math.max(2, r - 3));
      outerCW = rrPath(x, y, w, h, r);
      winCW = rrPath(ix, iy, iw, ih, ir); winCCW = rrPath(ix, iy, iw, ih, ir, true);
      winSW = 1.1; top = stroke(mid, 0.8, 0.4);
      open = stroke(outerCW, 2.6, 1) + stroke(mid, 0.8, 0.5) + stroke(winCW, 1.1, 0.85);
      break;
    }
    case 'sticker': {
      const R = R0, r2 = Math.max(3, R - bw);
      const hair = rrPath(m + bw + 4, m + bw + 4, W - 2 * (m + bw) - 8, H - 2 * (m + bw) - 8, Math.max(2, r2 - 4));
      outerCW = rrPath(m, m, W - 2 * m, H - 2 * m, R);
      winCW = rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2);
      winCCW = rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2, true);
      winSW = 1.3; top = stroke(hair, 1.1, 0.6);
      open = stroke(outerCW, 1.8, 1) + stroke(winCW, 1.3, 0.85) + stroke(hair, 1, 0.5);
      break;
    }
    case 'emblema': {
      const R = R0, r2 = Math.max(3, R - bw);
      const studR = Math.max(4, bw * 0.4);
      const studs = [diamond(150, m + bw / 2, studR), diamond(150, H - m - bw / 2, studR)];
      const hair = rrPath(m + bw + 4, m + bw + 4, W - 2 * (m + bw) - 8, H - 2 * (m + bw) - 8, Math.max(2, r2 - 4));
      outerCW = rrPath(m, m, W - 2 * m, H - 2 * m, R);
      winCW = rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2);
      winCCW = rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2, true);
      holes = studs; winSW = 1.3; top = stroke(hair, 1, 0.5);
      open = stroke(outerCW, 1.8, 1) + stroke(winCW, 1.3, 0.85) + studs.map(solid).join('') + stroke(hair, 1, 0.5);
      break;
    }
    case 'tech': {
      const c = Math.max(13, bw + 8), ci = Math.max(5, c - bw);
      const diag = stroke(`M${f(W - m - c)},${f(m)} L${f(W - m)},${f(m + c)}`, 2, 0.85)
        + stroke(`M${f(m + c)},${f(H - m)} L${f(m)},${f(H - m - c)}`, 2, 0.85);
      outerCW = octaPath(m, m, W - 2 * m, H - 2 * m, c);
      winCW = octaPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), ci);
      winCCW = octaPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), ci, true);
      winSW = 1.3; top = diag;
      open = stroke(outerCW, 1.8, 1) + stroke(winCW, 1.3, 0.85) + diag;
      break;
    }
    case 'feston': {
      const R = R0;
      const win = scallopRect(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), 18);
      outerCW = rrPath(m, m, W - 2 * m, H - 2 * m, R);
      winCW = win; winCCW = win; winSW = 1.2;
      const hair = scallopRect(m + bw + 5, m + bw + 5, W - 2 * (m + bw) - 10, H - 2 * (m + bw) - 10, 17);
      top = stroke(hair, 0.9, 0.45);
      open = stroke(outerCW, 1.8, 1) + stroke(win, 1.3, 0.85) + stroke(hair, 0.9, 0.45);
      break;
    }
    case 'gotico': {
      const R = R0;
      const ah = Math.min(bw * 0.72, 22);
      const win = archRect(m + bw, m + bw + ah, W - 2 * (m + bw), H - 2 * (m + bw) - 2 * ah, 6, ah);
      outerCW = rrPath(m, m, W - 2 * m, H - 2 * m, R);
      winCW = win; winCCW = win; winSW = 1.2;
      const pips: string[] = [];
      for (let i = 0; i < 6; i++) { const x = m + bw + (i + 0.5) * ((W - 2 * (m + bw)) / 6); pips.push(`<circle cx="${f(x)}" cy="${f(m + bw * 0.5)}" r="1.6" fill="#fff"/>`); pips.push(`<circle cx="${f(x)}" cy="${f(H - m - bw * 0.5)}" r="1.6" fill="#fff"/>`); }
      extra = pips.join('');
      open = stroke(outerCW, 1.8, 1) + stroke(win, 1.3, 0.85);
      break;
    }
    case 'barroco': {
      const R = R0, r2 = Math.max(3, R - bw);
      outerCW = rrPath(m, m, W - 2 * m, H - 2 * m, R);
      winCW = rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2);
      winCCW = winCW; winSW = 1.1;
      const sc = Math.max(0.5, Math.min(1.05, bw / 15));
      const ix = m + bw, iy = m + bw, ax = W - m - bw, ay = H - m - bw, cxw = 150, cyh = 210;
      const gem = (x: number, y: number, r: number): string => `<path d="${diamond(x, y, r)}" fill="#fff"/>`;
      const ARM = 'M6,6 C26,5 47,6 47,19 C47,28 39,30 35,25 C32,21 37,16 39,20'
        + ' M6,6 C5,26 6,47 19,47 C28,47 30,39 25,35 C21,32 16,37 20,39';
      const cornerG = (x: number, y: number, sx: number, sy: number): string =>
        `<g transform="translate(${f(x)},${f(y)}) scale(${(sx * sc).toFixed(3)},${(sy * sc).toFixed(3)})">`
        + `<path d="${ARM}" fill="none" stroke="#fff" stroke-width="${(1.7 / sc).toFixed(2)}" stroke-linecap="round"/>`
        + `<circle cx="6" cy="6" r="3" fill="#fff"/><circle cx="6" cy="6" r="1.2" fill="#0e1a12"/></g>`;
      const corners = cornerG(ix, iy, 1, 1) + cornerG(ax, iy, -1, 1) + cornerG(ax, ay, -1, -1) + cornerG(ix, ay, 1, -1);
      const shell = (cx: number, cy: number, dir: number, vert: boolean): string => {
        const r = Math.max(9, bw * 0.72); let g = '';
        if (!vert) {
          g += `<path d="M${f(cx - r)},${f(cy)} A${f(r)},${f(r)} 0 0 ${dir > 0 ? 1 : 0} ${f(cx + r)},${f(cy)}" fill="none" stroke="#fff" stroke-width="1.3"/>`;
          for (let i = 0; i <= 8; i++) { const a = Math.PI * (i / 8); g += `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(cx - Math.cos(a) * r)}" y2="${f(cy + dir * Math.sin(a) * r * 0.9)}" stroke="#fff" stroke-width="0.8" opacity="0.9"/>`; }
          g += gem(cx, cy + dir * (r + 5), 4.5);
        } else {
          g += `<path d="M${f(cx)},${f(cy - r)} A${f(r)},${f(r)} 0 0 ${dir > 0 ? 0 : 1} ${f(cx)},${f(cy + r)}" fill="none" stroke="#fff" stroke-width="1.3"/>`;
          for (let i = 0; i <= 8; i++) { const a = Math.PI * (i / 8); g += `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(cx + dir * Math.sin(a) * r * 0.9)}" y2="${f(cy - Math.cos(a) * r)}" stroke="#fff" stroke-width="0.8" opacity="0.9"/>`; }
          g += gem(cx + dir * (r + 5), cy, 4.5);
        }
        return g;
      };
      const crests = shell(cxw, iy, 1, false) + shell(cxw, ay, -1, false)
        + shell(ix, cyh, 1, true) + shell(ax, cyh, -1, true);
      const inner = stroke(rrPath(ix + 5, iy + 5, W - 2 * ix - 10, H - 2 * iy - 10, Math.max(2, r2 - 5)), 0.8, 0.5);
      extra = corners;
      open = stroke(outerCW, 1.8, 1) + stroke(winCW, 1.2, 0.85) + inner + crests;
      break;
    }
    default: {
      const R = R0, r2 = Math.max(3, R - bw);
      outerCW = rrPath(m, m, W - 2 * m, H - 2 * m, R);
      winCW = rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2);
      winCCW = rrPath(m + bw, m + bw, W - 2 * (m + bw), H - 2 * (m + bw), r2, true);
      open = stroke(outerCW, 1.8, 1) + stroke(winCW, 1.3, 0.85);
    }
  }

  if (fill === 'hueco') return open + extra;
  const region = fill === 'marco' ? cardD : outerCW;
  const holesD = holes.length ? ' ' + holes.join(' ') : '';
  return `<path d="${region} ${winCCW}${holesD}" fill="#fff" fill-rule="evenodd"/>`
    + stroke(winCW, winSW * 0.85, 0.5) + top + extra;
}
