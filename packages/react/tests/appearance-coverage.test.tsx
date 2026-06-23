/**
 * KRO-198 — RED DE REGRESIÓN de la clase de bug recurrente: "el editor te deja poner
 * una prop de apariencia, pero alguna rama de render NO la aplica".
 *
 * Estrategia (la que cazó los bugs en la auditoría): renderizar cada componente del
 * MOTOR DE BLOQUES con una apariencia COMPLETA y verificar que las clases que producen
 * los helpers (`appearancePaddingClass`, `appearanceEffectClasses`, color) APARECEN en
 * el HTML. Si una rama se come una prop, su clase no sale → el test falla.
 *
 * Al añadir un componente nuevo a `ComponentContent`, súmalo a `COMPONENTS` con los
 * kinds que acepta su rol y este test garantiza que honra la apariencia.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { paletteClass } from '@kromia/core';
import {
  ComponentContent, ComposableSlot,
  appearancePaddingClass, appearanceEffectClasses, appearanceTextClasses,
  appearanceObjectFitClass,
} from '../src/index';

// Apariencia con TODA prop "de caja/color" puesta a un valor distintivo.
const FULL_AP = {
  textColor: 'rose', bgColor: 'sky', weight: 'bold', size: 'lg',
  paddingY: 'lg', opacity: '50', shadow: 'md',
} as const;

const fieldDefs = [
  { key: 'a', label: 'A', type: 'text' },
  { key: 'b', label: 'B', type: 'number' },
] as any;
const item = { a: 'Aaa', b: '42' };

const PAD = appearancePaddingClass(FULL_AP as any);
const EFFECTS = appearanceEffectClasses(FULL_AP as any).split(' ').filter(Boolean); // opacity + shadow
const TXT = paletteClass(FULL_AP.textColor, 'text');

function renderComponent(componentId: string, role: string, fields: string[]): string {
  const node = { type: 'component', component: componentId, slots: { [role]: 's' } } as any;
  const composition = { slots: { s: { fields, appearance: FULL_AP } } } as any;
  return renderToStaticMarkup(
    <ComponentContent node={node} composition={composition} item={item} fieldDefs={fieldDefs} />,
  );
}

// componentId · rol · campos · qué props de caja DEBE honrar (segun el kind del rol).
const COMPONENTS: Array<{ id: string; role: string; fields: string[]; padding: boolean; effects: boolean; color: boolean }> = [
  { id: 'chips_row',     role: 'chips',  fields: ['a', 'b'], padding: true, effects: true,  color: true },
  { id: 'badge_row',     role: 'badges', fields: ['a', 'b'], padding: true, effects: true,  color: true },
  { id: 'stats_row',     role: 'stats',  fields: ['a', 'b'], padding: true, effects: false, color: true }, // number kind: sin opacity/shadow
  { id: 'section_title', role: 'text',   fields: ['a'],      padding: true, effects: false, color: true }, // text-short
];

describe('appearance coverage — componentes del motor de bloques honran la apariencia del slot', () => {
  it('los helpers producen clases no vacías (sanity)', () => {
    expect(PAD).toBeTruthy();
    expect(EFFECTS.length).toBeGreaterThan(0);
    expect(TXT).toBeTruthy();
  });

  for (const c of COMPONENTS) {
    it(`${c.id} aplica relleno/${c.effects ? 'efectos/' : ''}color de la apariencia`, () => {
      const html = renderComponent(c.id, c.role, c.fields);
      if (c.padding) expect(html, `${c.id}: falta el relleno "${PAD}"`).toContain(PAD);
      if (c.color)   expect(html, `${c.id}: falta el color de texto "${TXT}"`).toContain(TXT);
      if (c.effects) for (const eff of EFFECTS) expect(html, `${c.id}: falta el efecto "${eff}"`).toContain(eff);
    });
  }
});

// ── ComposableSlot: cada disposición debe aplicar la apariencia PER-FIELD ──────────
// Contrato de diseño (recipe-utils `styleFor`): el COLOR/tipografía se mergea
// base ← override per-field; la CAJA (relleno/efecto/recorte) viene SOLO del
// override per-field `own` (deliberado, para no alterar recetas ya shipeadas).
// El test refleja ESO: 1er field hereda el color base, 2º field trae su color Y
// su relleno propios → cada disposición debe pintar los tres.
describe('appearance coverage — ComposableSlot honra la apariencia por-field en cada disposición', () => {
  const resolved = {
    fields: [
      { key: 'a', def: fieldDefs[0], value: 'Aaa' },
      { key: 'b', def: fieldDefs[1], value: 'Bbb' },
    ],
    orientation: 'horizontal',
    separator: ' · ',
    composableDisplay: 'auto',
    appearance: FULL_AP,
    // override per-field DISTINTIVO en el 2º field: color + relleno propios.
    fieldAppearances: { b: { textColor: 'emerald', paddingY: 'lg' } },
  } as any;
  const PERFIELD = paletteClass('emerald', 'text');                 // color propio del 2º field
  const PERFIELD_PAD = appearancePaddingClass({ paddingY: 'lg' } as any); // su caja (relleno)

  for (const display of ['auto', 'chips', 'inline', 'list'] as const) {
    it(`display=${display} hereda color base + aplica color y relleno per-field`, () => {
      const html = renderToStaticMarkup(<ComposableSlot slot={{ ...resolved, composableDisplay: display }} />);
      expect(html, `${display}: falta el color base "${TXT}" en el 1er field`).toContain(TXT);
      expect(html, `${display}: falta el color per-field "${PERFIELD}"`).toContain(PERFIELD);
      expect(html, `${display}: falta el relleno per-field "${PERFIELD_PAD}"`).toContain(PERFIELD_PAD);
    });
  }
});

// ── Galerías de imágenes (carousel/grid): el slot image-array expone objectFit/
// efectos/forma/aspect → cada variante debe honrarlos. Antes el componente de
// galería IGNORABA la apariencia por completo (solo pasaba urls/variant/label). ──
describe('appearance coverage — los componentes de galería honran la apariencia del slot de imagen', () => {
  const IMG_AP = { objectFit: 'contain', opacity: '50', shadow: 'md', aspect: 'video' } as const;
  const imgFieldDefs = [{ key: 'img', label: 'Img', type: 'image' }] as any;
  const imgItem = { img: 'https://example.com/p.jpg' }; // URL real (no mockup) → renderiza <img>
  const FIT = appearanceObjectFitClass(IMG_AP as any);             // object-contain
  const IMG_EFFECTS = appearanceEffectClasses(IMG_AP as any).split(' ').filter(Boolean); // opacity-50 + shadow-md

  for (const component of ['gallery_grid', 'carousel_peek', 'carousel_centered'] as const) {
    it(`${component} aplica object-fit + efectos del slot`, () => {
      const node = { type: 'component', component, slots: { images: 'g' } } as any;
      const composition = { slots: { g: { fields: ['img'], appearance: IMG_AP } } } as any;
      const html = renderToStaticMarkup(
        <ComponentContent node={node} composition={composition} item={imgItem} fieldDefs={imgFieldDefs} />,
      );
      expect(html, `${component}: falta el object-fit "${FIT}"`).toContain(FIT);
      for (const eff of IMG_EFFECTS) expect(html, `${component}: falta el efecto "${eff}"`).toContain(eff);
    });
  }
});
