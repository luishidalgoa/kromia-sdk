/**
 * KRO-133 Capa 2 — Catálogo de COMPONENTES PREFABRICADOS para el motor de
 * bloques.
 *
 * Un componente es un bloque COMPUESTO reutilizable (carta, galería de cartas,
 * avatar…) que se inserta en un layout como UNA unidad (`LayoutComponentNode`),
 * en vez de recomponer slots a mano. Resuelve el hueco de que el motor genérico
 * no reproducía lo que las recetas hardcodean (p.ej. la rejilla de mini-cartas
 * caía a "[6]").
 *
 * Cada componente declara sus ROLES (los "huecos" que consume) con los
 * `accepts` (tipos de slot que encajan en cada rol). El publisher mapea cada rol
 * a un slot de la composición (`node.slots[role] = slotId`). El renderer
 * (`@kromia/react`, espejo `@kromia/flutter`) pinta el componente leyendo esos
 * slots.
 *
 * Patrón idéntico a `recipes.ts`: catálogo cerrado, source-of-truth única, que
 * Studio (palette + canvas), el validador y los renderers consumen. Entra al
 * contrato KRP (`generate.ts`) → versionado + visible para Flutter.
 *
 * **Ground truth cross-language**: `tests/components.test.ts`.
 */
import type { SlotAcceptKind } from '../types';

/** Un "hueco" del componente, mapeable a un slot de la composición. */
export interface ComponentRole {
  /** Id del rol — clave en `LayoutComponentNode.slots`. */
  id:        string;
  /** Etiqueta legible (UI de mapeo en el editor). */
  label:     string;
  /** Tipos de slot que encajan en este rol (mismo catálogo que los slots de receta). */
  accepts:   SlotAcceptKind[];
  /** Si true, el componente se pinta sin él. Default false (requerido). */
  optional?: boolean;
}

export interface ComponentDefinition {
  /** Id estable — referenciado por `LayoutComponentNode.component`. */
  id:          string;
  displayName: string;
  description: string;
  roles:       ComponentRole[];
}

/**
 * Catálogo cerrado. Arranque de la Capa 2 con 2 componentes; el resto
 * (avatar, banner, stat-row, badge…) son aditivos — solo nuevas entradas +
 * su renderer espejo.
 */
export const COMPONENT_REGISTRY: Record<string, ComponentDefinition> = {
  // Carta compuesta: media full-bleed + título + (opcional) pie + (opcional)
  // badge. La unidad visual canónica de un álbum de cromos.
  card: {
    id:          'card',
    displayName: 'Carta',
    description: 'Tarjeta compuesta: imagen + título + pie y badge opcionales. La unidad visual de un cromo, como un bloque reutilizable.',
    roles: [
      { id: 'media',   label: 'Imagen',  accepts: ['image', 'image-array'] },
      { id: 'title',   label: 'Título',  accepts: ['text-short'] },
      { id: 'caption', label: 'Pie',     accepts: ['text-short', 'text-long'], optional: true },
      { id: 'badge',   label: 'Badge',   accepts: ['badge'],                   optional: true },
    ],
  },

  // Cabecera "hero": banner + avatar circular superpuesto + título + subtítulo,
  // centrados. Reproduce FIEL la cabecera de la receta `hero_protagonico` (con
  // sus placeholders: banner degradado + inicial del título), que NO se puede
  // expresar con slots sueltos (lógica cruzada título→avatar + solape). Es la
  // pieza "prefab" que el preset de bloques del hero usa para no salir plano.
  hero_header: {
    id:          'hero_header',
    displayName: 'Cabecera hero',
    description: 'Banner + avatar circular superpuesto + título + subtítulo centrados — la cabecera de la receta "Hero protagónico" como bloque fiel (con placeholder de banner degradado e inicial del título). Se coloca como unidad.',
    roles: [
      { id: 'banner',   label: 'Banner',    accepts: ['image', 'image-array'],        optional: true },
      { id: 'avatar',   label: 'Avatar',    accepts: ['image'],                        optional: true },
      { id: 'title',    label: 'Título',    accepts: ['text-short'] },
      { id: 'subtitle', label: 'Subtítulo', accepts: ['text-short', 'date', 'number'], optional: true },
    ],
  },

  // Galería de cartas referenciadas: rejilla de mini-cartas (reutiliza el render
  // del slot card-ref de la Capa 1). Para "relacionadas", "plantilla", etc.
  ref_gallery: {
    id:          'ref_gallery',
    displayName: 'Galería de cartas',
    description: 'Rejilla de mini-cartas a partir de un slot de referencias (card-ref). Para cartas relacionadas, plantillas, colecciones.',
    roles: [
      { id: 'refs', label: 'Referencias', accepts: ['card-ref'] },
    ],
  },
};

/** Todos los componentes del catálogo (orden de declaración). */
export function allComponents(): ComponentDefinition[] {
  return Object.values(COMPONENT_REGISTRY);
}

/** Definición de un componente por id, o undefined si no existe. */
export function getComponentDef(id: string): ComponentDefinition | undefined {
  return COMPONENT_REGISTRY[id];
}

/** Ids del catálogo (para validación/iteración). */
export const COMPONENT_IDS: readonly string[] = Object.keys(COMPONENT_REGISTRY);
