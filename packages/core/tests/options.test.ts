/**
 * Tests de los catálogos de opciones de personalización — KRO-75.
 *
 * Validan los 10 catálogos migrados desde Studio + helper `detectActivePreset`
 * + `aspectToRatio` + `getFieldTypeDescriptions`.
 *
 * El objetivo es cazar regresiones cuando alguien:
 *  - Elimine accidentalmente una opción.
 *  - Renombre un id (breaking change — debe ir con major bump).
 *  - Añada una opción sin actualizar este snapshot.
 */

import { describe, it, expect } from 'vitest';
import {
  // Action
  OPTIONS_ACTION_LABELS,
  // Appearance
  OPTIONS_APPEARANCE_SHAPE,
  OPTIONS_APPEARANCE_ASPECT,
  OPTIONS_APPEARANCE_ALIGN,
  OPTIONS_APPEARANCE_WEIGHT,
  OPTIONS_APPEARANCE_SIZE,
  OPTIONS_APPEARANCE_TRUNCATE,
  OPTIONS_APPEARANCE_PADDING_Y,
  OPTIONS_APPEARANCE_ACCENT_POSITION,
  OPTIONS_APPEARANCE_LINE_HEIGHT,
  OPTIONS_APPEARANCE_TRACKING,
  OPTIONS_APPEARANCE_OBJECT_FIT,
  OPTIONS_APPEARANCE_OPACITY,
  OPTIONS_APPEARANCE_SHADOW,
  OPTIONS_APPEARANCE_LABELS,
  OPTIONS_APPEARANCE_DESCRIPTIONS,
  APPEARANCE_PRESETS,
  detectActivePreset,
  // Card format
  CARD_ASPECTS,
  CARD_SIZES,
  DEFAULT_CARD_FORMAT,
  OPTIONS_CARD_ASPECT_LABELS,
  OPTIONS_CARD_SIZE_LABELS,
  aspectToRatio,
  // Helper
  getFieldTypeDescriptions,
  allFieldTypes,
} from '../src/index';

// ── 1. Action labels ────────────────────────────────────────────────

describe('OPTIONS_ACTION_LABELS', () => {
  it('contiene las 5 actions canónicas', () => {
    const keys = Object.keys(OPTIONS_ACTION_LABELS).sort();
    expect(keys).toEqual(['expand_inline', 'external_link', 'modal', 'navigate_to_detail', 'none']);
  });

  it('cada label es un string no vacío', () => {
    Object.values(OPTIONS_ACTION_LABELS).forEach(label => {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  it('"none" tiene label descriptivo (no solo "none")', () => {
    expect(OPTIONS_ACTION_LABELS.none).toMatch(/Informativo|sin acción/i);
  });
});

// ── 2. Appearance catalogs ──────────────────────────────────────────

describe('OPTIONS_APPEARANCE_SHAPE', () => {
  it('3 shapes: circle, square, rounded', () => {
    const ids = OPTIONS_APPEARANCE_SHAPE.map(o => o.id).sort();
    expect(ids).toEqual(['circle', 'rounded', 'square']);
  });

  it('cada opción tiene tooltip', () => {
    OPTIONS_APPEARANCE_SHAPE.forEach(o => {
      expect(o.tooltip).toBeTruthy();
    });
  });
});

describe('OPTIONS_APPEARANCE_ASPECT', () => {
  it('6 ratios incluyendo free', () => {
    expect(OPTIONS_APPEARANCE_ASPECT).toHaveLength(6);
    const ids = OPTIONS_APPEARANCE_ASPECT.map(o => o.id);
    expect(ids).toContain('1:1');
    expect(ids).toContain('16:9');
    expect(ids).toContain('free');
  });
});

describe('OPTIONS_APPEARANCE_ALIGN', () => {
  it('3 alignments: left, center, right', () => {
    expect(OPTIONS_APPEARANCE_ALIGN.map(o => o.id).sort()).toEqual(['center', 'left', 'right']);
  });
});

describe('OPTIONS_APPEARANCE_WEIGHT', () => {
  it('3 weights con label corto', () => {
    expect(OPTIONS_APPEARANCE_WEIGHT).toHaveLength(3);
    OPTIONS_APPEARANCE_WEIGHT.forEach(o => {
      expect(o.label).toBeTruthy();
      expect(o.tooltip).toBeTruthy();
    });
  });
});

describe('OPTIONS_APPEARANCE_SIZE', () => {
  it('4 sizes: sm, md, lg, xl', () => {
    expect(OPTIONS_APPEARANCE_SIZE.map(o => o.id)).toEqual(['sm', 'md', 'lg', 'xl']);
  });
});

describe('OPTIONS_APPEARANCE_TRUNCATE', () => {
  it('4 opciones: 1, 2, 3, none', () => {
    expect(OPTIONS_APPEARANCE_TRUNCATE.map(o => o.id)).toEqual(['1', '2', '3', 'none']);
  });
});

describe('OPTIONS_APPEARANCE_PADDING_Y', () => {
  it('4 opciones: none, sm, md, lg', () => {
    expect(OPTIONS_APPEARANCE_PADDING_Y.map(o => o.id)).toEqual(['none', 'sm', 'md', 'lg']);
  });
});

describe('OPTIONS_APPEARANCE_ACCENT_POSITION', () => {
  it('6 opciones: auto, top, left, right, bottom, none', () => {
    expect(OPTIONS_APPEARANCE_ACCENT_POSITION.map(o => o.id)).toEqual([
      'auto', 'top', 'left', 'right', 'bottom', 'none',
    ]);
  });

  it('"auto" tiene tooltip explicativo del default por receta', () => {
    const auto = OPTIONS_APPEARANCE_ACCENT_POSITION.find(o => o.id === 'auto');
    expect(auto?.tooltip).toMatch(/default|receta/i);
  });
});

// KRO-147 F3 — catálogos nuevos: tipografía rica + caja/efectos
describe('OPTIONS_APPEARANCE — KRO-147 F3 catálogos nuevos', () => {
  it('LINE_HEIGHT: tight, normal, relaxed', () => {
    expect(OPTIONS_APPEARANCE_LINE_HEIGHT.map(o => o.id)).toEqual(['tight', 'normal', 'relaxed']);
  });
  it('TRACKING: tight, normal, wide', () => {
    expect(OPTIONS_APPEARANCE_TRACKING.map(o => o.id)).toEqual(['tight', 'normal', 'wide']);
  });
  it('OBJECT_FIT: cover, contain', () => {
    expect(OPTIONS_APPEARANCE_OBJECT_FIT.map(o => o.id)).toEqual(['cover', 'contain']);
  });
  it('OPACITY: 100, 90, 75, 50', () => {
    expect(OPTIONS_APPEARANCE_OPACITY.map(o => o.id)).toEqual(['100', '90', '75', '50']);
  });
  it('SHADOW: none, sm, md, lg', () => {
    expect(OPTIONS_APPEARANCE_SHADOW.map(o => o.id)).toEqual(['none', 'sm', 'md', 'lg']);
  });
  it('cada opción nueva tiene label + tooltip', () => {
    for (const cat of [OPTIONS_APPEARANCE_LINE_HEIGHT, OPTIONS_APPEARANCE_TRACKING,
      OPTIONS_APPEARANCE_OBJECT_FIT, OPTIONS_APPEARANCE_OPACITY, OPTIONS_APPEARANCE_SHADOW]) {
      cat.forEach(o => { expect(o.label).toBeTruthy(); expect(o.tooltip).toBeTruthy(); });
    }
  });
});

describe('OPTIONS_APPEARANCE_LABELS', () => {
  it('todos los appearance props tienen label es-ES', () => {
    const props = ['shape', 'aspect', 'imageFocus', 'align', 'weight', 'size',
                   'truncate', 'truncateChars', 'accentPosition', 'paddingY',
                   // KRO-147 F3
                   'italic', 'underline', 'lineHeight', 'tracking', 'objectFit', 'opacity', 'shadow'];
    props.forEach(p => {
      expect(OPTIONS_APPEARANCE_LABELS[p as keyof typeof OPTIONS_APPEARANCE_LABELS]).toBeTruthy();
    });
  });
});

describe('OPTIONS_APPEARANCE_DESCRIPTIONS', () => {
  it('todas las descripciones son strings ≥ 20 chars', () => {
    Object.values(OPTIONS_APPEARANCE_DESCRIPTIONS).forEach(desc => {
      expect(desc.length).toBeGreaterThan(20);
    });
  });
});

// ── 3. Appearance presets ───────────────────────────────────────────

describe('APPEARANCE_PRESETS', () => {
  it('6 presets canónicos', () => {
    expect(APPEARANCE_PRESETS).toHaveLength(6);
    const ids = APPEARANCE_PRESETS.map(p => p.id);
    expect(ids).toEqual(['avatar', 'square', 'portrait', 'banner', 'story', 'polaroid']);
  });

  it('cada preset tiene shape + aspect coherentes con APPEARANCE_OPTIONS', () => {
    const validShapes  = OPTIONS_APPEARANCE_SHAPE.map(o => o.id);
    const validAspects = OPTIONS_APPEARANCE_ASPECT.map(o => o.id);
    APPEARANCE_PRESETS.forEach(p => {
      expect(validShapes).toContain(p.shape);
      expect(validAspects).toContain(p.aspect);
    });
  });
});

describe('detectActivePreset', () => {
  it('appearance vacío → undefined', () => {
    expect(detectActivePreset(undefined)).toBeUndefined();
    expect(detectActivePreset({})).toBeUndefined();
  });

  it('matching exacto avatar (circle + 1:1) → "avatar"', () => {
    expect(detectActivePreset({ shape: 'circle', aspect: '1:1' })).toBe('avatar');
  });

  it('matching exacto banner (rounded + 16:9) → "banner"', () => {
    expect(detectActivePreset({ shape: 'rounded', aspect: '16:9' })).toBe('banner');
  });

  it('combinación que no matchea ningún preset → undefined', () => {
    expect(detectActivePreset({ shape: 'circle', aspect: '16:9' })).toBeUndefined();
  });
});

// ── 4. Card format ──────────────────────────────────────────────────

describe('CARD_ASPECTS + CARD_SIZES', () => {
  it('4 aspects y 4 sizes', () => {
    expect(CARD_ASPECTS).toHaveLength(4);
    expect(CARD_SIZES).toHaveLength(4);
  });

  it('DEFAULT_CARD_FORMAT usa values válidos', () => {
    expect(CARD_ASPECTS).toContain(DEFAULT_CARD_FORMAT.aspect);
    expect(CARD_SIZES).toContain(DEFAULT_CARD_FORMAT.size);
  });

  it('cada aspect tiene label es-ES', () => {
    CARD_ASPECTS.forEach(a => {
      expect(OPTIONS_CARD_ASPECT_LABELS[a]).toBeTruthy();
    });
  });

  it('cada size tiene label es-ES', () => {
    CARD_SIZES.forEach(s => {
      expect(OPTIONS_CARD_SIZE_LABELS[s]).toBeTruthy();
    });
  });
});

describe('aspectToRatio', () => {
  it('2:3 → 0.666...', () => {
    expect(aspectToRatio('2:3')).toBeCloseTo(0.667, 2);
  });
  it('16:9 → 1.778...', () => {
    expect(aspectToRatio('16:9')).toBeCloseTo(1.778, 2);
  });
  it('1:1 → 1', () => {
    expect(aspectToRatio('1:1')).toBe(1);
  });
});

// ── 5. Field type descriptions helper ───────────────────────────────

describe('getFieldTypeDescriptions', () => {
  it('produce un Record<id, description> desde allFieldTypes()', () => {
    const descs = getFieldTypeDescriptions(allFieldTypes());
    expect(descs.text).toMatch(/Texto/i);
    expect(descs.cardRef).toMatch(/Referencia|carta/i);
  });

  it('cubre todos los field types declarados', () => {
    const descs = getFieldTypeDescriptions(allFieldTypes());
    allFieldTypes().forEach(t => {
      expect(descs[t.id]).toBeTruthy();
    });
  });
});

// ── 6. cardRef (drift resolution) ───────────────────────────────────

describe('cardRef (KRO-75 drift resolution)', () => {
  it('está en el field-types registry como scalar', () => {
    const types = allFieldTypes();
    const cardRef = types.find(t => t.id === 'cardRef');
    expect(cardRef).toBeDefined();
    expect(cardRef?.cardinality).toBe('scalar');
    expect(cardRef?.description).toMatch(/Referencia|primary key/i);
  });
});
