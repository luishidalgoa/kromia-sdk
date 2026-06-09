'use client';
/**
 * StatsRow — bloque de estadísticas COMPARTIDO (KRO-133 fidelidad).
 *
 * Cada campo del slot se pinta como VALOR grande (números tabulares) + su
 * ETIQUETA debajo (mayúsculas), en una fila con borde superior/inferior. Recrea
 * fiel el bloque "stats" de las recetas de detalle (Hero/Ficha/Perfil), que es
 * lógica multi-campo NO expresable con un slot pelado.
 */
import { formatScalar, type FieldDefLike } from '../recipe-utils';

export interface StatsRowField {
  value: unknown;
  def:   FieldDefLike | undefined;
}

export function StatsRow({ fields }: { fields: StatsRowField[] }) {
  const present = fields.filter(f => f && f.value != null && f.value !== '');
  if (present.length === 0) return null;
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-2 border-y border-border py-3">
      {present.map((f, idx) => (
        <div key={idx} className="text-center min-w-0">
          <p className="text-lg font-bold text-foreground tabular-nums truncate">
            {formatScalar(f.value, f.def)}
          </p>
          {f.def?.label && (
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
              {f.def.label}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
