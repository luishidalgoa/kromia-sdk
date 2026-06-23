/**
 * KRO-198 — etiqueta NORMALIZADA de un field, para NOMBRAR slots genéricos en el
 * editor de bloques (un slot por campo): prefiere el `displayName` del BEHAVIOR
 * (p.ej. `tags`→"Etiquetas", `card_index_list`→"Lista de cartas", `iso_date`→
 * "Fecha", `color_hex`→"Color"); si el campo no tiene behavior, cae al
 * `displayName` del TYPE (`text`→"Texto", `number`→"Número", `image`→"Imagen"…);
 * y por último al `type` crudo. NO duplica catálogo — lee del registry.
 */
import { getBehavior } from './registries/behaviors';
import { getFieldType } from './registries/field-types';

export function labelForField(field: { type: string; behavior?: string | null }): string {
  return getBehavior(field.behavior)?.displayName
    ?? getFieldType(field.type)?.displayName
    ?? field.type;
}
