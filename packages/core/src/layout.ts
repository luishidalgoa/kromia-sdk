/**
 * KRO-133 — Lógica PURA del árbol de LAYOUT de una composición (constructor
 * visual tipo Gutenberg). Vive en `@kromia/core` para que Studio (canvas DnD +
 * preview), el backend (validación pre-persist) y el futuro motor de render
 * (`@kromia/react` + espejo `@kromia/flutter`) deriven EXACTAMENTE las mismas
 * reglas (anti-drift, patrón KRO-79/101).
 *
 * Fase 1 (modelo): catálogos cerrados + validador del árbol + auto-migración
 * no destructiva de las composiciones viejas (slots-plano → árbol). El motor de
 * render y el canvas DnD llegan en fases posteriores.
 *
 * **Ground truth cross-language**: `tests/layout.test.ts` es la spec.
 */
import type {
  LayoutNode,
  LayoutContainerNode,
  LayoutContainerKind,
  LayoutDirection,
  LayoutAlign,
  LayoutJustify,
  LayoutGap,
  GridPlacement,
  SlotComposition,
  ViewComposition,
} from './types';
import { getRecipeManifest } from './registries/recipes';
import { getComponentDef } from './registries/components';

// ── Catálogos cerrados (los consume el editor; el validador valida contra ellos) ──

export const LAYOUT_CONTAINER_KINDS: readonly LayoutContainerKind[] = ['flex', 'grid', 'stack'];
export const LAYOUT_DIRECTIONS:      readonly LayoutDirection[]      = ['row', 'column'];
export const LAYOUT_ALIGNS:          readonly LayoutAlign[]          = ['start', 'center', 'end', 'stretch'];
export const LAYOUT_JUSTIFY:         readonly LayoutJustify[]        = ['start', 'center', 'end', 'between', 'around'];
export const LAYOUT_GAPS:            readonly LayoutGap[]            = ['none', 'xs', 'sm', 'md', 'lg'];

// Catálogos de decoración de contenedor (KRO-133 F3) — presets cerrados, ricos.
export const SURFACE_BACKGROUNDS   = ['none', 'card', 'muted', 'accent', 'primary'] as const;
export const SURFACE_BORDER_WIDTHS = ['thin', 'medium', 'thick'] as const;
/** Lados físicos del borde (multi-selección; vacío = los 4). */
export const SURFACE_BORDER_SIDES  = ['top', 'right', 'bottom', 'left'] as const;
export const SURFACE_BORDER_COLORS = ['border', 'muted', 'accent', 'primary', 'foreground'] as const;
export const SURFACE_BORDER_STYLES = ['solid', 'dashed', 'dotted'] as const;
export const SURFACE_RADII         = ['none', 'sm', 'md', 'lg', 'xl', 'full'] as const;
/** Esquinas para el radius por-esquina (multi; vacío = las 4). */
export const SURFACE_RADIUS_CORNERS = ['tl', 'tr', 'bl', 'br'] as const;

// ── Track sizing (ancho de columna / alto de fila) ──────────────────────────
/** Tokens de tamaño de pista del grid (KRO-133 F3). */
export const TRACK_SIZES = ['1fr', '2fr', '3fr', 'auto', 'content'] as const;

/** Token de pista → valor CSS de grid-template. `content` = ajustado al contenido. */
export function trackToCss(token: string | undefined): string {
  switch (token) {
    case 'auto':    return 'auto';
    case 'content': return 'min-content';
    case '2fr':     return 'minmax(0, 2fr)';
    case '3fr':     return 'minmax(0, 3fr)';
    default:        return 'minmax(0, 1fr)'; // '1fr' / undefined
  }
}

/** Nº de filas EFECTIVAS de un grid (explícitas o las que exige la colocación). */
function effectiveRows(node: LayoutContainerNode): number {
  let max = 1;
  for (const ch of node.children) {
    const rs = ch.place?.rowStart ?? 1, rsp = ch.place?.rowSpan ?? 1;
    max = Math.max(max, rs + rsp - 1);
  }
  return Math.max(node.rows ?? 1, max);
}

/** `grid-template-columns` del contenedor (respeta columnSizes; default = iguales). */
export function gridColumnsTemplate(node: LayoutContainerNode): string {
  const cols = Math.max(1, node.columns ?? 1);
  if (node.columnSizes && node.columnSizes.length) {
    return Array.from({ length: cols }, (_, i) => trackToCss(node.columnSizes![i])).join(' ');
  }
  return `repeat(${cols}, minmax(0, 1fr))`;
}

/** `grid-template-rows` del contenedor (respeta rowSizes; si no, rowSize auto/equal). */
export function gridRowsTemplate(node: LayoutContainerNode): string {
  const rows = effectiveRows(node);
  if (node.rowSizes && node.rowSizes.length) {
    return Array.from({ length: rows }, (_, i) => trackToCss(node.rowSizes![i])).join(' ');
  }
  return node.rowSize === 'equal' ? `repeat(${rows}, minmax(0, 1fr))` : `repeat(${rows}, auto)`;
}
export const SURFACE_SHADOWS       = ['none', 'sm', 'md', 'lg', 'xl'] as const;
export const SURFACE_PADDINGS      = ['none', 'xs', 'sm', 'md', 'lg', 'xl'] as const;

/** Profundidad máxima de anidamiento de contenedores (raíz = 1). */
export const MAX_LAYOUT_DEPTH = 5;
/** Máximo de columnas de un contenedor `grid`. */
export const MAX_GRID_COLUMNS = 6;
/** Máximo de filas EXPLÍCITAS de un contenedor `grid` (KRO-133 F3). */
export const MAX_GRID_ROWS = 6;

// ── Validación ───────────────────────────────────────────────────────────────

export interface LayoutIssue {
  level:   'error' | 'warn';
  /** Ruta legible al nodo, p.ej. `root.children[0].children[2]`. */
  path:    string;
  message: string;
}

export interface LayoutValidationResult {
  ok:     boolean;
  issues: LayoutIssue[];
}

export interface ValidateLayoutOptions {
  /** Slots declarados en la composición (`ViewComposition.slots`). Cada slot-hoja
   *  del árbol debe referenciar uno de estos. */
  slots: Record<string, SlotComposition>;
}

/**
 * Valida el árbol de layout: estructura (raíz contenedor, hijos no vacíos),
 * catálogos (kind/gap/align/justify/columns), profundidad, y que cada slot-hoja
 * referencie un slot existente y NO se repita. Devuelve issues con severity.
 */
export function validateLayout(
  root: LayoutContainerNode | null | undefined,
  opts: ValidateLayoutOptions,
): LayoutValidationResult {
  const issues: LayoutIssue[] = [];
  if (!root) {
    return { ok: true, issues }; // sin layout → válido (cae al preset de la receta)
  }
  if (root.type !== 'container') {
    issues.push({ level: 'error', path: 'root', message: 'La raíz del layout debe ser un contenedor.' });
    return { ok: false, issues };
  }

  const slotKeys = new Set(Object.keys(opts.slots ?? {}));
  const seenSlots = new Set<string>();

  const walk = (node: LayoutNode, path: string, depth: number): void => {
    if (node.type === 'slot') {
      if (!node.slot || typeof node.slot !== 'string') {
        issues.push({ level: 'error', path, message: 'Slot sin nombre.' });
        return;
      }
      if (!slotKeys.has(node.slot)) {
        issues.push({ level: 'error', path, message: `El slot "${node.slot}" no está declarado en la composición.` });
      }
      if (seenSlots.has(node.slot)) {
        issues.push({ level: 'error', path, message: `El slot "${node.slot}" aparece más de una vez en el layout.` });
      }
      seenSlots.add(node.slot);
      if (node.grow !== undefined && (!Number.isFinite(node.grow) || node.grow < 0)) {
        issues.push({ level: 'error', path, message: '`grow` debe ser un número ≥ 0.' });
      }
      return;
    }

    // Componente prefabricado (KRO-133 Capa 2): id del catálogo + roles mapeados
    // a slots existentes (sin repetir un slot en el árbol).
    if (node.type === 'component') {
      const def = getComponentDef(node.component);
      if (!def) {
        issues.push({ level: 'error', path, message: `Componente desconocido: "${node.component}".` });
        return;
      }
      const mapped = node.slots ?? {};
      for (const role of def.roles) {
        if (!role.optional && !mapped[role.id]) {
          issues.push({ level: 'warn', path, message: `El componente "${def.displayName}" espera el rol "${role.label}".` });
        }
      }
      for (const [roleId, slotId] of Object.entries(mapped)) {
        if (!def.roles.some(r => r.id === roleId)) {
          issues.push({ level: 'warn', path, message: `Rol "${roleId}" no existe en el componente "${def.displayName}".` });
        }
        if (!slotKeys.has(slotId)) {
          issues.push({ level: 'error', path, message: `El slot "${slotId}" (rol "${roleId}") no está declarado en la composición.` });
        }
        if (seenSlots.has(slotId)) {
          issues.push({ level: 'error', path, message: `El slot "${slotId}" aparece más de una vez en el layout.` });
        }
        seenSlots.add(slotId);
      }
      return;
    }

    // Contenedor.
    if (depth > MAX_LAYOUT_DEPTH) {
      issues.push({ level: 'error', path, message: `Anidamiento demasiado profundo (máx ${MAX_LAYOUT_DEPTH}).` });
      return;
    }
    if (!LAYOUT_CONTAINER_KINDS.includes(node.kind)) {
      issues.push({ level: 'error', path, message: `Tipo de contenedor inválido: "${node.kind}".` });
    }
    if (node.gap !== undefined && !LAYOUT_GAPS.includes(node.gap)) {
      issues.push({ level: 'error', path, message: `Separación (gap) inválida: "${node.gap}".` });
    }
    if (node.align !== undefined && !LAYOUT_ALIGNS.includes(node.align)) {
      issues.push({ level: 'error', path, message: `Alineación inválida: "${node.align}".` });
    }
    if (node.justify !== undefined && !LAYOUT_JUSTIFY.includes(node.justify)) {
      issues.push({ level: 'error', path, message: `Distribución inválida: "${node.justify}".` });
    }
    if (node.direction !== undefined && !LAYOUT_DIRECTIONS.includes(node.direction)) {
      issues.push({ level: 'error', path, message: `Dirección inválida: "${node.direction}".` });
    }
    if (node.kind === 'grid' && node.columns !== undefined &&
        (!Number.isInteger(node.columns) || node.columns < 1 || node.columns > MAX_GRID_COLUMNS)) {
      issues.push({ level: 'error', path, message: `Columnas del grid fuera de rango (1..${MAX_GRID_COLUMNS}).` });
    }
    if (node.kind === 'grid' && node.rows !== undefined &&
        (!Number.isInteger(node.rows) || node.rows < 1 || node.rows > MAX_GRID_ROWS)) {
      issues.push({ level: 'error', path, message: `Filas del grid fuera de rango (1..${MAX_GRID_ROWS}).` });
    }
    if (!Array.isArray(node.children) || node.children.length === 0) {
      issues.push({ level: 'warn', path, message: 'Contenedor vacío (sin hijos).' });
      return;
    }
    // KRO-133 F3 — valida la colocación (place) de cada hijo contra ESTE grid.
    const cols = node.kind === 'grid' ? (node.columns ?? 2) : undefined;
    const rows = node.kind === 'grid' ? node.rows : undefined;
    node.children.forEach((child, i) => {
      const childPath = `${path}.children[${i}]`;
      if (child.place) validatePlacement(child.place, cols, rows, childPath, issues);
      walk(child, childPath, depth + 1);
    });
  };

  walk(root, 'root', 1);
  return { ok: issues.every(i => i.level !== 'error'), issues };
}

/**
 * KRO-133 F3 — valida una colocación `place` contra el grid padre. `cols`/`rows`
 * son las columnas/filas del grid padre (`rows` undefined = filas implícitas).
 * Spans fuera de rango son error; un nodo colocado fuera del grid es warn (no
 * rompe el render — solo no se verá donde se espera).
 */
function validatePlacement(
  place: GridPlacement, cols: number | undefined, rows: number | undefined,
  path: string, issues: LayoutIssue[],
): void {
  if (cols === undefined) {
    issues.push({ level: 'warn', path, message: '`place` solo aplica dentro de un contenedor grid.' });
    return;
  }
  const intGte1 = (v: number | undefined) => v === undefined || (Number.isInteger(v) && v >= 1);
  if (!intGte1(place.colStart) || !intGte1(place.colSpan) || !intGte1(place.rowStart) || !intGte1(place.rowSpan)) {
    issues.push({ level: 'error', path, message: '`place` (colStart/colSpan/rowStart/rowSpan) deben ser enteros ≥ 1.' });
    return;
  }
  const colStart = place.colStart ?? 1;
  const colSpan  = place.colSpan ?? 1;
  if (colStart > cols) {
    issues.push({ level: 'warn', path, message: `La celda empieza en la columna ${colStart} pero el grid tiene ${cols}.` });
  } else if (colStart + colSpan - 1 > cols) {
    issues.push({ level: 'warn', path, message: `La celda se sale por la derecha (col ${colStart}+${colSpan} > ${cols}).` });
  }
  if (rows !== undefined) {
    const rowStart = place.rowStart ?? 1;
    const rowSpan  = place.rowSpan ?? 1;
    if (rowStart > rows) {
      issues.push({ level: 'warn', path, message: `La celda empieza en la fila ${rowStart} pero el grid tiene ${rows}.` });
    } else if (rowStart + rowSpan - 1 > rows) {
      issues.push({ level: 'warn', path, message: `La celda se sale por abajo (fila ${rowStart}+${rowSpan} > ${rows}).` });
    }
  }
}

// ── Auto-migración (slots-plano → árbol) ─────────────────────────────────────

/**
 * Deriva un árbol de layout para una composición que aún NO lo tiene (legacy).
 * NO destructivo: una columna flex con un slot-hoja por cada slot de la receta,
 * en su orden declarado (o, si la receta es desconocida, el orden de las keys de
 * `slots`). Es el baseline de la Fase 1; los presets ricos por-receta (que
 * replican el JSX actual) llegan en la fase de migración/presets.
 */
export function migrateSlotsToLayout(
  composition: Pick<ViewComposition, 'recipe' | 'slots'> & { layout?: LayoutContainerNode },
): LayoutContainerNode {
  if (composition.layout) return composition.layout; // ya tiene → respétalo

  const declared = composition.slots ?? {};
  const manifest = composition.recipe ? getRecipeManifest(composition.recipe) : undefined;
  // Orden de la receta, filtrado a los slots realmente presentes; si no hay
  // receta conocida, las keys tal cual.
  const ordered = manifest
    ? manifest.slots.map(s => s.id).filter(id => id in declared)
    : Object.keys(declared);
  // Por si la composición trae slots fuera del manifest, añádelos al final.
  for (const k of Object.keys(declared)) if (!ordered.includes(k)) ordered.push(k);

  return {
    type:      'container',
    kind:      'flex',
    direction: 'column',
    gap:       'sm',
    children:  ordered.map(slot => ({ type: 'slot', slot })),
  };
}

/**
 * KRO-133 F3 — variante GRID de la migración: deriva un grid de 1 columna con
 * los slots apilados (auto-flow). Es el estado inicial del editor por bloques
 * 2D — el publisher parte de aquí y reorganiza en celdas. NO destructivo
 * (respeta un `layout` ya existente). Equivalente visual a la columna flex,
 * pero ya en el modelo grid para que el constructor 2D opere sobre él.
 */
export function migrateSlotsToGrid(
  composition: Pick<ViewComposition, 'recipe' | 'slots'> & { layout?: LayoutContainerNode },
): LayoutContainerNode {
  if (composition.layout) return composition.layout;
  const flex = migrateSlotsToLayout(composition); // reusa el orden de slots
  return {
    type:     'container',
    kind:     'grid',
    columns:  1,
    gap:      'sm',
    children: flex.children, // mismos slot-hojas, sin place → auto-flow vertical
  };
}

// ── Helpers de recorrido ─────────────────────────────────────────────────────

/** Profundidad máxima del árbol (raíz = 1). */
export function layoutDepth(node: LayoutNode): number {
  if (node.type === 'slot' || node.type === 'component') return 1;
  if (!node.children?.length) return 1;
  return 1 + Math.max(...node.children.map(layoutDepth));
}

/** Nombres de todos los slots referenciados por el árbol (en orden de aparición).
 *  Un componente referencia los slots mapeados a sus roles. */
export function collectLayoutSlots(node: LayoutNode): string[] {
  if (node.type === 'slot') return [node.slot];
  if (node.type === 'component') return Object.values(node.slots ?? {});
  return (node.children ?? []).flatMap(collectLayoutSlots);
}
