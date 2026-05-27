/**
 * `cn` — concatena className strings con clsx + tailwind-merge.
 *
 * Resuelve conflictos de Tailwind (e.g. `cn('p-2', 'p-4')` → `'p-4'`).
 * Equivalente al `cn` de `@/lib/utils` de Studio — duplicado aquí para
 * que el package react no dependa de paths internos de un consumer.
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
