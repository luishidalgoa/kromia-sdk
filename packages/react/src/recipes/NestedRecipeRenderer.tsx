'use client';
/**
 * NestedRecipeRenderer — V4 (KRO-43)
 *
 * Renderiza cada ref de un slot `nestable` (typicamente card-ref) usando una
 * mini-receta anidada. El caso canónico: el slot `related` de
 * `hero_protagonico` con `card_index_list`/`card_code_list` — cada ref se
 * pinta como una mini-card en lugar del chip plano con el ID.
 *
 * Limitación V4 MVP: no resolvemos las refs cross-section todavía. Cada ref
 * se renderiza con MOCK DATA derivada del ID (un item sintético con
 * `_ref: <id>` como única source of truth). El cliente real (Flutter) hará
 * la resolución contra el schema referenciado.
 *
 * Cuando Studio tenga `availableCardIndexes` / `availableCardCodes` con
 * acceso a las cards reales (futuro), este componente podrá enriquecerse
 * para mostrar datos reales en preview.
 *
 * Sirve como demostración visual del comportamiento: el publisher ve la
 * estructura de la mini-receta aplicada, aunque los datos sean placeholders.
 */

import { RecipeRenderer } from './RecipeRenderer';
import type { FieldDefLike } from '../recipe-utils';
import type { NestedViewComposition } from '@kromia/core';

export interface NestedRecipeRendererProps {
  /** Array de referencias (índices numéricos o codes textuales) del slot. */
  refs:              Array<string | number>;
  /** Receta anidada a aplicar a cada ref. */
  nestedComposition: NestedViewComposition;
  /** FieldDefs del schema padre — pasados al renderer para que tenga
   *  contexto si la nested referencia algún field shared. */
  fieldDefs:         FieldDefLike[];
}

export function NestedRecipeRenderer({
  refs, nestedComposition, fieldDefs,
}: NestedRecipeRendererProps) {

  // Para cada ref, sintetizamos un item mock. La mini-receta lo renderiza
  // con sus slots — los fields no resueltos (porque no tenemos la card real)
  // se rinden como placeholders. El publisher ENTIENDE la estructura.
  return (
    <div className="space-y-1.5">
      {refs.map((ref, i) => {
        const mockItem: Record<string, any> = {
          _ref: ref,
          // Inyectamos un proxy: cualquier field key que pida la receta
          // recibe un placeholder informativo. El renderer lo verá como
          // string y lo pintará tal cual.
        };

        // Pre-rellenamos placeholders para cada field declarado en los slots
        // de la receta nested — eso da una vista preview realista.
        for (const slot of Object.values(nestedComposition.slots)) {
          for (const fieldKey of slot.fields ?? []) {
            if (mockItem[fieldKey] == null) {
              mockItem[fieldKey] = `«${fieldKey}»`;
            }
          }
        }

        return (
          <div key={i} className="rounded-md border border-dashed border-border/60 bg-muted/20">
            <div className="px-2 pt-1 text-[10px] font-mono opacity-50">
              ref: #{ref}
            </div>
            <RecipeRenderer
              composition={{
                recipe: nestedComposition.recipe,
                slots:  nestedComposition.slots,
              }}
              item={mockItem}
              fieldDefs={fieldDefs}
            />
          </div>
        );
      })}
    </div>
  );
}
