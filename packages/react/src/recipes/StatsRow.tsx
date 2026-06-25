'use client';
/**
 * StatsRow — bloque de estadísticas COMPARTIDO (KRO-133 fidelidad).
 *
 * Cada campo del slot se pinta como VALOR grande (números tabulares) + su
 * ETIQUETA debajo (mayúsculas), en una fila con borde superior/inferior. Recrea
 * fiel el bloque "stats" de las recetas de detalle (Hero/Ficha/Perfil), que es
 * lógica multi-campo NO expresable con un slot pelado.
 *
 * KRO-198 — honra la APARIENCIA del slot COMPLETA: la base (`appearance`) en el
 * wrapper + la apariencia EFECTIVA por estadística (base ← `fieldAppearances[key]`)
 * en cada valor: tipografía, COLOR de texto, FONDO, RECORTE (truncado) y CAJA
 * (relleno/efecto), vía los mismos helpers que `ComposableSlot` (mergeFieldAppearance
 * + appearance*Class). La ETIQUETA solo sigue el color (mantiene su identidad de
 * caption). Así el estilo que el publisher fija (base o por chip) gana sobre el del
 * acabado/tema, y al descomponer el componente el look es idéntico.
 */
import { paletteClass, type SlotAppearance } from '@kromia/core';
import { cn } from '../lib/cn';
import {
  formatScalar, mergeFieldAppearance, appearanceTextClasses,
  appearancePaddingClass, appearanceTruncateClass, appearanceEffectClasses,
  type FieldDefLike,
} from '../recipe-utils';

export interface StatsRowField {
  /** KRO-198 — key del field (para casar su entrada en `fieldAppearances`). */
  key?:  string;
  value: unknown;
  def:   FieldDefLike | undefined;
}

export function StatsRow({ fields, appearance, fieldAppearances }: {
  fields:            StatsRowField[];
  /** KRO-198 — apariencia base del slot (tipografía, color, mayúsculas, etc.). */
  appearance?:       SlotAppearance;
  /** KRO-198 — apariencia POR-FIELD: cada estadística puede llevar la suya. */
  fieldAppearances?: Record<string, SlotAppearance>;
}) {
  const present = fields.filter(f => f && f.value != null && f.value !== '');
  if (present.length === 0) return null;
  return (
    <div className={cn('grid grid-flow-col auto-cols-fr gap-2 border-y border-border py-3', appearanceTextClasses(appearance))}>
      {present.map((f, idx) => {
        const ap = mergeFieldAppearance(appearance, fieldAppearances, f.key);
        const bg = paletteClass(ap?.bgColor, 'bg');
        // KRO-198 — `display:'badge'` → el VALOR se pinta como pastilla (rareza/tipo),
        // no como cifra grande. Honra color/tipografía/relleno/efecto igual.
        const isBadge = ap?.display === 'badge';
        return (
          // KRO-198 — `data-stat-key`: el editor del lienzo lo lee por delegación (closest)
          // para SELECCIONAR esta estadística al clicarla (como `data-chip-key` en los chips).
          // DATA (no contrato): solo es un atributo de render. undefined si el field no trae key.
          <div key={idx} data-stat-key={f.key} className="text-center min-w-0">
            {isBadge ? (
              <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums max-w-full',
                bg || 'bg-muted', appearancePaddingClass(ap), appearanceEffectClasses(ap),
                appearanceTextClasses(ap ? { ...ap, bgColor: undefined } : undefined) || 'text-foreground')}>
                {formatScalar(f.value, f.def)}
              </span>
            ) : (
              <p className={cn('text-lg font-bold tabular-nums max-w-full text-foreground',
                !ap?.truncate && 'truncate', appearanceTruncateClass(ap),
                bg && 'rounded px-1', appearancePaddingClass(ap), appearanceEffectClasses(ap), bg,
                appearanceTextClasses(ap ? { ...ap, bgColor: undefined } : undefined))}>
                {formatScalar(f.value, f.def)}
              </p>
            )}
            {f.def?.label && (
              // KRO-222 — la ETIQUETA ya no se trunca a 1 línea por defecto (causaba
              // "TASA DE…"); ahora envuelve a 2 líneas. El publisher puede forzar otro
              // recorte con su appearance.truncate (1/2/3/none), igual que el valor.
              <p className={cn('text-[10px] uppercase tracking-wider max-w-full text-muted-foreground',
                appearanceTruncateClass(ap) || 'line-clamp-2',
                ap?.textColor && paletteClass(ap.textColor, 'text'))}>
                {f.def.label}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
