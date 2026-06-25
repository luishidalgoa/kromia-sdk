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
  ComponentContent, ComposableSlot, SlotContent, resolveSlot,
  appearancePaddingClass, appearanceEffectClasses, appearanceTextClasses,
  appearanceObjectFitClass, BadgeSlot,
  CompactAvatarRecipe, HeroProtagonicoRecipe, EditorialRecipe, MomentoRecipe,
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

// ── "Mostrar como" (display) por-chip: la rama `chips` de ComposableSlot debe
// respetar display:'text' (plano, sin pastilla) IGUAL que el componente chips_row.
// El editor parte la fila en chips de 1 campo que pasan por aquí → si la rama
// ignorara el display, mostraría badge donde el publisher puso texto (drift app↔editor). ──
describe('chips — display por-field: text = plano (sin pastilla), badge/default = pastilla', () => {
  const base = {
    fields: [
      { key: 'a', def: fieldDefs[0], value: 'Aaa' },
      { key: 'b', def: fieldDefs[1], value: 'Bbb' },
    ],
    orientation: 'horizontal', separator: ' · ', composableDisplay: 'chips',
  } as any;

  it('TODOS display:text → ninguna pastilla (sin rounded-full)', () => {
    const html = renderToStaticMarkup(<ComposableSlot slot={{ ...base, fieldAppearances: { a: { display: 'text' }, b: { display: 'text' } } }} />);
    expect(html).not.toContain('rounded-full');
  });

  it('display:badge o default → pastilla (rounded-full)', () => {
    const html = renderToStaticMarkup(<ComposableSlot slot={{ ...base, fieldAppearances: { a: { display: 'badge' }, b: {} } }} />);
    expect(html).toContain('rounded-full');
  });

  it('mezcla text+badge → SOLO el badge es pastilla', () => {
    const html = renderToStaticMarkup(<ComposableSlot slot={{ ...base, fieldAppearances: { a: { display: 'text' }, b: { display: 'badge' } } }} />);
    expect((html.match(/rounded-full/g) || []).length, 'solo 1 pastilla (el chip badge)').toBe(1);
  });
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

// ── Cláusula ELSE (otherwise) del "Estilo por valor" v2: el render (resolveSlot)
// debe aplicar el fallback cuando NINGÚN caso coincide, con su scoping por target. ──
describe('conditional else (otherwise) — resolveSlot aplica el fallback con su target', () => {
  const condFieldDefs = [
    { key: 'elemento', label: 'Elemento', type: 'text' },
    { key: 'rareza', label: 'Rareza', type: 'text' },
  ] as any;
  const cond = {
    fieldKey: 'elemento',
    cases: [{ value: 'fuego', appearance: { bgColor: 'rose' }, target: ['elemento'] }],
    otherwise: { appearance: { bgColor: 'zinc' }, target: ['elemento'] },
  };
  const composition = { slots: { s: { fields: ['elemento', 'rareza'], conditionalStyle: cond } } } as any;

  it('caso coincide → el chip vigilado coge la apariencia del CASO (no el else)', () => {
    const r = resolveSlot(composition, 's', condFieldDefs, { elemento: 'fuego', rareza: 'rara' });
    expect(r?.fieldAppearances?.elemento?.bgColor).toBe('rose');
  });
  it('ningún caso coincide → el ELSE aplica al chip vigilado, sin tocar el vecino', () => {
    const r = resolveSlot(composition, 's', condFieldDefs, { elemento: 'agua', rareza: 'rara' });
    expect(r?.fieldAppearances?.elemento?.bgColor).toBe('zinc');
    expect(r?.fieldAppearances?.rareza?.bgColor).toBeUndefined();
  });
  it('else SIN target → se mergea sobre la apariencia base de toda la fila', () => {
    const cond2 = { fieldKey: 'elemento', cases: [{ value: 'fuego', appearance: { bgColor: 'rose' } }], otherwise: { appearance: { bgColor: 'zinc' } } };
    const comp2 = { slots: { s: { fields: ['elemento', 'rareza'], conditionalStyle: cond2 } } } as any;
    const r = resolveSlot(comp2, 's', condFieldDefs, { elemento: 'agua', rareza: 'rara' });
    expect(r?.appearance?.bgColor).toBe('zinc');
  });
  it('sin else + ningún caso → cae a la base (retro-compat, sin fallback)', () => {
    const cond3 = { fieldKey: 'elemento', cases: [{ value: 'fuego', appearance: { bgColor: 'rose' }, target: ['elemento'] }] };
    const comp3 = { slots: { s: { fields: ['elemento', 'rareza'], appearance: { bgColor: 'sky' }, conditionalStyle: cond3 } } } as any;
    const r = resolveSlot(comp3, 's', condFieldDefs, { elemento: 'agua', rareza: 'rara' });
    expect(r?.appearance?.bgColor).toBe('sky');
    expect(r?.fieldAppearances?.elemento?.bgColor).toBeUndefined();
  });
});

// ── SlotContent: un `composableDisplay` EXPLÍCITO manda aunque el slot tenga UN solo
// campo escalar. El editor parte la fila de chips en slots de 1 campo (display 'chips')
// para arrastrar cada chip; si SlotContent cayera a ScalarText, el chip se vería como
// texto plano SIN su estilo por valor (drift editor↔app). Esta es esa red. ──
describe('SlotContent — display explícito en slot de 1 campo → ComposableSlot (pill), no ScalarText', () => {
  const fd = [{ key: 'elemento', label: 'Elemento', type: 'text' }] as any;
  const cond = { fieldKey: 'elemento', cases: [{ value: 'Fuego', appearance: { bgColor: 'rose' }, target: ['elemento'] }] };

  it('display=chips + 1 campo → pill (rounded-full), NO texto plano', () => {
    const comp = { slots: { s: { fields: ['elemento'], composableDisplay: 'chips' } } } as any;
    const html = renderToStaticMarkup(<SlotContent slot="s" composition={comp} item={{ elemento: 'Fuego' }} fieldDefs={fd} />);
    expect(html, 'el chip de 1 campo con display=chips debe ser pill, no ScalarText').toContain('rounded-full');
  });

  it('display=chips + 1 campo + estilo por valor → el chip coge la apariencia del caso', () => {
    const comp = { slots: { s: { fields: ['elemento'], composableDisplay: 'chips', conditionalStyle: cond } } } as any;
    const html = renderToStaticMarkup(<SlotContent slot="s" composition={comp} item={{ elemento: 'Fuego' }} fieldDefs={fd} />);
    // El caso "Fuego" → bgColor 'rose' aplicado al chip vía fieldAppearances (resolveSlot).
    expect(html).toContain(paletteClass('rose', 'bg'));
  });

  it('display=auto + 1 campo escalar → sigue siendo ScalarText (retro-compat, sin pill)', () => {
    const comp = { slots: { s: { fields: ['elemento'], composableDisplay: 'auto' } } } as any;
    const html = renderToStaticMarkup(<SlotContent slot="s" composition={comp} item={{ elemento: 'Fuego' }} fieldDefs={fd} />);
    expect(html).not.toContain('rounded-full');
  });
});

// ── Rejilla de chips (chipGrid + chipPlacements): coloca cada chip en su celda 2D,
// reusando las clases col/row del motor de bloques. Sin chipGrid = flex-wrap (compat). ──
describe('chip grid — chips_row + ComposableSlot colocan cada chip en su celda', () => {
  const cg = { columns: 2 };
  // "Amet" arriba ocupando 2 columnas; los otros dos abajo (fila 2).
  const placements = {
    a: { colStart: 1, colSpan: 2, rowStart: 1 },
    b: { colStart: 1, rowStart: 2 },
    c: { colStart: 2, rowStart: 2 },
  };
  const gFieldDefs = [
    { key: 'a', label: 'A', type: 'text' },
    { key: 'b', label: 'B', type: 'text' },
    { key: 'c', label: 'C', type: 'text' },
  ] as any;
  const gItem = { a: 'Amet', b: 'Elit', c: 'Star' };

  it('chips_row con chipGrid → wrapper inline-grid (repeat 2) + placement por chip', () => {
    const node = { type: 'component', component: 'chips_row', slots: { chips: 's' } } as any;
    const composition = { slots: { s: { fields: ['a', 'b', 'c'], chipGrid: cg, chipPlacements: placements } } } as any;
    const html = renderToStaticMarkup(<ComponentContent node={node} composition={composition} item={gItem} fieldDefs={gFieldDefs} />);
    expect(html, 'falta inline-grid').toContain('inline-grid');
    expect(html, 'falta grid-template-columns repeat(2)').toContain('repeat(2');
    expect(html, 'falta el span de Amet (col-span-2)').toContain('col-span-2');
    expect(html, 'faltan los chips de la fila 2 (row-start-2)').toContain('row-start-2');
    // Atributos que el EDITOR usa para enganchar el arrastre de chips en el lienzo.
    expect(html, 'falta data-chip-grid (marca de la rejilla para el editor)').toContain('data-chip-grid');
    expect(html, 'falta data-chip-key por chip').toContain('data-chip-key="a"');
  });
  it('chips_row SIN chipGrid → flex-wrap (retro-compat, sin placement ni data-chip)', () => {
    const node = { type: 'component', component: 'chips_row', slots: { chips: 's' } } as any;
    const composition = { slots: { s: { fields: ['a', 'b', 'c'] } } } as any;
    const html = renderToStaticMarkup(<ComponentContent node={node} composition={composition} item={gItem} fieldDefs={gFieldDefs} />);
    expect(html).toContain('flex-wrap');
    expect(html).not.toContain('col-span-2');
    expect(html).not.toContain('data-chip-key'); // sin rejilla, no se marcan los chips
  });
  it('ComposableSlot display=chips con chipGrid → coloca cada chip igual + data-chip', () => {
    const resolved = {
      fields: [
        { key: 'a', def: gFieldDefs[0], value: 'Amet' },
        { key: 'b', def: gFieldDefs[1], value: 'Elit' },
        { key: 'c', def: gFieldDefs[2], value: 'Star' },
      ],
      orientation: 'horizontal', separator: ' · ', composableDisplay: 'chips',
      chipGrid: cg, chipPlacements: placements,
    } as any;
    const html = renderToStaticMarkup(<ComposableSlot slot={resolved} />);
    expect(html).toContain('inline-grid');
    expect(html).toContain('col-span-2');
    expect(html).toContain('row-start-2');
    expect(html).toContain('data-chip-grid');
    expect(html).toContain('data-chip-key="a"');
  });
  it('ancho del chip: content+align → justify-self (content-fit+posición); fill+align → justify-content (texto)', () => {
    const node = { type: 'component', component: 'chips_row', slots: { chips: 's' } } as any;
    // chipWidth:'content' + align center → el chip se ajusta y se POSICIONA (justify-self-center).
    const compC = { slots: { s: { fields: ['a', 'b', 'c'], chipGrid: cg, chipPlacements: placements, fieldAppearances: { a: { chipWidth: 'content', align: 'center' } } } } } as any;
    const htmlC = renderToStaticMarkup(<ComponentContent node={node} composition={compC} item={gItem} fieldDefs={gFieldDefs} />);
    expect(htmlC, 'content+center → justify-self-center').toContain('justify-self-center');
    // fill (default) + align center → el chip ESTIRA y el TEXTO se centra (justify-content), SIN justify-self.
    const compF = { slots: { s: { fields: ['a', 'b', 'c'], chipGrid: cg, chipPlacements: placements, fieldAppearances: { a: { align: 'center' } } } } } as any;
    const htmlF = renderToStaticMarkup(<ComponentContent node={node} composition={compF} item={gItem} fieldDefs={gFieldDefs} />);
    expect(htmlF, 'fill+center → justify-center (texto en la pastilla)').toContain('justify-center');
    expect(htmlF, 'fill NO usa justify-self (el chip estira)').not.toContain('justify-self');
  });
});

// ── KRO-217: las recetas-preset (Hero/Editorial/Momento/CompactAvatar) DELEGAN sus
// bloques de stats/galería/meta en los componentes COMPARTIDOS (StatsRow/ImageGallery)
// en vez de duplicar markup con colores/object-fit fijos. Esta red verifica el CABLEADO:
// que cada receta PASA la apariencia del slot al componente → sus clases salen en el
// HTML. Si alguien revierte una receta a markup hardcodeado, su clase no sale y cae. ──
describe('appearance coverage — KRO-217: las recetas-preset delegan y honran la apariencia del slot', () => {
  const IMG_AP   = { objectFit: 'contain', opacity: '50', shadow: 'md', aspect: 'video' } as const;
  const imgDefs  = [{ key: 'img', label: 'Galería', type: 'image' }] as any;
  const imgItem  = { img: ['https://example.com/p.jpg'] };          // array de URLs reales → <img>
  const allDefs  = [...fieldDefs, ...imgDefs];
  const allItem  = { ...item, ...imgItem };
  const FIT         = appearanceObjectFitClass(IMG_AP as any);       // object-contain
  const IMG_EFFECTS = appearanceEffectClasses(IMG_AP as any).split(' ').filter(Boolean); // opacity-50 + shadow-md

  it('CompactAvatar (A1) — el slot meta honra opacidad/sombra (antes los ignoraba)', () => {
    const composition = { slots: {
      avatar: { fields: ['a'] }, title: { fields: ['a'] },
      meta:   { fields: ['b'], appearance: FULL_AP },
    } } as any;
    const html = renderToStaticMarkup(
      <CompactAvatarRecipe composition={composition} item={item} fieldDefs={fieldDefs} />,
    );
    for (const eff of EFFECTS) expect(html, `meta: falta el efecto "${eff}"`).toContain(eff);
  });

  it('Hero (A4) — el bloque stats delega en StatsRow y honra relleno + color', () => {
    const composition = { slots: {
      title: { fields: ['a'] },
      stats: { fields: ['a', 'b'], appearance: FULL_AP },
    } } as any;
    const html = renderToStaticMarkup(
      <HeroProtagonicoRecipe composition={composition} item={item} fieldDefs={fieldDefs} />,
    );
    expect(html, `stats: falta el relleno "${PAD}"`).toContain(PAD);
    expect(html, `stats: falta el color "${TXT}"`).toContain(TXT);
  });

  it('Hero (A5) — la galería delega en ImageGallery y honra object-fit + efectos', () => {
    const composition = { slots: {
      title:   { fields: ['a'] },
      gallery: { fields: ['img'], appearance: IMG_AP },
    } } as any;
    const html = renderToStaticMarkup(
      <HeroProtagonicoRecipe composition={composition} item={allItem} fieldDefs={allDefs} />,
    );
    expect(html, `gallery: falta el object-fit "${FIT}"`).toContain(FIT);
    for (const eff of IMG_EFFECTS) expect(html, `gallery: falta el efecto "${eff}"`).toContain(eff);
  });

  it('Editorial (A2) — la galería grid delega en ImageGallery y honra object-fit + efectos', () => {
    const composition = { slots: {
      title:   { fields: ['a'] }, body: { fields: ['a'] },
      gallery: { fields: ['img'], appearance: IMG_AP },
    } } as any;
    const html = renderToStaticMarkup(
      <EditorialRecipe composition={composition} item={allItem} fieldDefs={allDefs} />,
    );
    expect(html, `gallery: falta el object-fit "${FIT}"`).toContain(FIT);
    for (const eff of IMG_EFFECTS) expect(html, `gallery: falta el efecto "${eff}"`).toContain(eff);
  });

  it('Momento (A3) — el slideshow centered delega en ImageGallery y honra object-fit + efectos', () => {
    const composition = { slots: {
      date: { fields: ['a'] }, title: { fields: ['a'] },
      slideshow: { fields: ['img'], appearance: IMG_AP },
    } } as any;
    const html = renderToStaticMarkup(
      <MomentoRecipe composition={composition} item={allItem} fieldDefs={allDefs} />,
    );
    expect(html, `slideshow: falta el object-fit "${FIT}"`).toContain(FIT);
    for (const eff of IMG_EFFECTS) expect(html, `slideshow: falta el efecto "${eff}"`).toContain(eff);
  });
});

// ── KRO-217 Tier B: el render de BADGE (pastilla) se extrajo a un componente
// COMPARTIDO (BadgeSlot) que usaban DUPLICADO el motor de bloques (SlotContent) y
// CompactCardRecipe. Esta red fija su contrato: pastilla + color/efectos en la
// pastilla, ALIGN en el bloque exterior (un badge es inline-flex; text-align no lo
// mueve dentro), y `wrapperClassName` respetado. ──
describe('appearance coverage — KRO-217 BadgeSlot: pastilla con color/efectos + align en el bloque', () => {
  it('SlotContent display=badge → pastilla con color + efectos y align en el bloque (no inerte)', () => {
    const fd = [{ key: 'r', label: 'Rareza', type: 'text' }] as any;
    const ap = { ...FULL_AP, display: 'badge', align: 'center' };
    const comp = { slots: { s: { fields: ['r'], appearance: ap } } } as any;
    const html = renderToStaticMarkup(<SlotContent slot="s" composition={comp} item={{ r: 'Rara' }} fieldDefs={fd} />);
    expect(html, 'el badge debe ser pastilla').toContain('rounded-full');
    expect(html, `badge: falta el color "${TXT}"`).toContain(TXT);
    for (const eff of EFFECTS) expect(html, `badge: falta el efecto "${eff}"`).toContain(eff);
    expect(html, 'el align del badge va en el bloque exterior (text-center)').toContain('text-center');
  });

  it('BadgeSlot directo: respeta wrapperClassName y pone el align en el bloque, el efecto en la pastilla', () => {
    const html = renderToStaticMarkup(
      <BadgeSlot
        appearance={{ display: 'badge', textColor: 'rose', align: 'center', opacity: '50' } as any}
        item={{}}
        wrapperClassName="max-w-[35%]"
      >X</BadgeSlot>,
    );
    expect(html, 'pastilla').toContain('rounded-full');
    expect(html, 'wrapperClassName respetado').toContain('max-w-[35%]');
    expect(html, 'align → bloque').toContain('text-center');
    expect(html, 'efecto → pastilla').toContain('opacity-50');
  });
});

// ── KRO-222 Parte A: la ETIQUETA de una stat ya no se trunca a 1 línea por defecto
// (causaba "TASA DE…"): envuelve a 2 líneas (line-clamp-2). El publisher la recorta
// con appearance.truncate, igual que el valor. Cubre StatsRow (stats_row) y su gemelo
// de recipe-utils (rama display==='stats' del ComposableSlot). ──
describe('appearance coverage — KRO-222: la etiqueta de stats envuelve a 2 líneas (no trunca a 1)', () => {
  const sNode = { type: 'component', component: 'stats_row', slots: { stats: 's' } } as any;

  it('stats_row (StatsRow): etiqueta con line-clamp-2 por defecto (sin override)', () => {
    const html = renderComponent('stats_row', 'stats', ['a', 'b']);
    expect(html, 'la etiqueta debe envolver a 2 líneas por defecto').toContain('line-clamp-2');
  });

  it('stats_row: appearance.truncate=1 fuerza la etiqueta a 1 línea (line-clamp-1, sin fallback)', () => {
    const comp = { slots: { s: { fields: ['a', 'b'], appearance: { truncate: '1' } } } } as any;
    const html = renderToStaticMarkup(<ComponentContent node={sNode} composition={comp} item={item} fieldDefs={fieldDefs} />);
    expect(html, 'el override del publisher manda').toContain('line-clamp-1');
    expect(html, 'sin fallback a 2 líneas cuando hay override').not.toContain('line-clamp-2');
  });

  it('ComposableSlot display=stats: misma regla en el gemelo de recipe-utils', () => {
    const resolved = {
      fields: [
        { key: 'a', def: fieldDefs[0], value: 'Aaa' },
        { key: 'b', def: fieldDefs[1], value: '42' },
      ],
      orientation: 'horizontal', separator: ' · ', composableDisplay: 'stats',
    } as any;
    const html = renderToStaticMarkup(<ComposableSlot slot={resolved} />);
    expect(html, 'el gemelo también envuelve la etiqueta a 2 líneas').toContain('line-clamp-2');
  });
});
