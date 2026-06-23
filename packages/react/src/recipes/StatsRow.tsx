'use client';
/**
 * StatsRow — bloque de estadísticas COMPARTIDO (KRO-133 fidelidad).
 *
 * Cada campo del slot se pinta como VALOR grande (números tabulares) + su
 * ETIQUETA debajo (mayúsculas), en una fila con borde superior/inferior. Recrea
 * fiel el bloque "stats" de las recetas de detalle (Hero/Ficha/Perfil), que es
 * lógica multi-campo NO expresable con un slot pelado.
 *
 * KRO-198 — honra la APARIENCIA del slot: `appearanceTextClasses(appearance)` en
 * el wrapper + COLOR por-field (base ← `fieldAppearances[key]`) en cada valor/
 * etiqueta, vía el MISMO helper `fieldColorClasses` que usa la rama 'stats' de
 * `ComposableSlot` → al descomponer el componente el look es idéntico, y el color
 * que el publisher fija (base o por chip) gana sobre el del acabado/tema.
 */
import { type SlotAppearance } from '@kromia/core';
import { cn } from '../lib/cn';
import { formatScalar, appearanceTextClasses, fieldColorClasses, type FieldDefLike } from '../recipe-utils';

export interface StatsRowField {
  /** KRO-198 — key del field (para casar su entrada en `fieldAppearances`). */
  key?:  string;
  value: unknown;
  def:   FieldDefLike | undefined;
}

export function StatsRow({ fields, appearance, fieldAppearances }: {
  fields:            StatsRowField[];
  /** KRO-198 — apariencia base del slot (color de texto, mayúsculas, etc.). */
  appearance?:       SlotAppearance;
  /** KRO-198 — apariencia POR-FIELD: cada estadística puede llevar su propio color. */
  fieldAppearances?: Record<string, SlotAppearance>;
}) {
  const present = fields.filter(f => f && f.value != null && f.value !== '');
  if (present.length === 0) return null;
  const textClasses = appearanceTextClasses(appearance);
  return (
    <div className={cn('grid grid-flow-col auto-cols-fr gap-2 border-y border-border py-3', textClasses)}>
      {present.map((f, idx) => {
        const c = fieldColorClasses(appearance, fieldAppearances, f.key);
        return (
          <div key={idx} className="text-center min-w-0">
            <p className={cn('text-lg font-bold tabular-nums truncate', c.text || 'text-foreground')}>
              {formatScalar(f.value, f.def)}
            </p>
            {f.def?.label && (
              <p className={cn('text-[10px] uppercase tracking-wider truncate', c.text || 'text-muted-foreground')}>
                {f.def.label}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
