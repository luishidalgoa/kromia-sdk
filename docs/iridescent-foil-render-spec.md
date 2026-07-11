# Render del `iridescent_foil` — spec cross-platform (KRO-224 / KRO-244)

Fuente canónica del RENDER del efecto `iridescent_foil` para que **Flutter lo
espeje 1:1** sin drift. El **contrato** (los params del config) vive en el KRP
(`registries/visual-effects.ts`); esta spec cubre la **capa C** (cómo se PINTA),
que NO va al `.json` — cada host la implementa, pero desde los MISMOS datos del
SDK (`@kromia/core/foil-recipe.ts`). Referencia de Studio: `VisualEffectLayers.tsx`
(componente `IridescentFoil`).

## Params del config (contrato KRP, ya espejados en `visual_effects.dart`)

`pattern` (paleta, enum), `pattern_hex` (paleta custom, string), `hue`, `angle`
(orientación 0–360), `opacity`, `glow`, `sheen`, `shimmer`, `noise`, `brightness`,
`contrast`, `scale`, `blend`, `geometry` (`bandas`|`organico`), `warp` (0–100),
`border_style`, `border_fill`, `border_width`, `border_margin`, `border_color`,
`border_color_hex`. Defaults en el registry.

## Orden de capas (sobre el arte de la carta)

`foil` → `sheen` → `glare` → `noise` → `borde`. Todas recortadas al redondeado/silueta.

## 1) Gradiente del foil (color + orientación + paleta custom)

- **Paleta**: `FOIL_PATTERNS[pattern]` (datos: stops + ángulo nativo). Si
  `parseFoilPatternHex(pattern_hex)` ≠ null → paleta CUSTOM (2–4 hex), ciclo 45%
  equiespaciado con el primer color repetido al cierre (ver `foilCustomPatternCss`);
  MANDA sobre `pattern`.
- **Orientación**: el ángulo de las bandas = `foilEffectiveAngle(pattern, angle)`
  (= ángulo nativo del pattern + `angle`). Para la paleta custom el nativo es 115°.
- **Filtro de color** (foil): `hue-rotate(hue) saturate(1.25) brightness(brightness%)
  contrast(contrast%)`. `background-size = scale% scale%`. `blend` = config.blend.
- **sheen**: mismo gradiente, `blend: screen`, `opacity: sheen/100`, size 250%.
- **glare**: radial blanco al puntero/tilt, `blend: soft-light`, alpha = `glow/100`.
- **noise**: textura fractal, `blend: overlay`, `opacity: noise/100`.

## 2) Geometría ORGÁNICA (`geometry: 'organico'`)  ⭐ lo que faltaba

Las bandas RECTAS se curvan por un desplazamiento de RUIDO FRACTAL → difracción
tipo lámina holográfica real (ref. ticket ISKRA). Se aplica **solo a las capas
`foil` y `sheen`** (glare/noise/borde NO se deforman). Con `geometry: 'bandas'`
(default) NO se aplica nada = look clásico.

Parámetros (fuente única: `FOIL_ORGANIC_WARP` en `foil-recipe.ts`):

| clave | valor | qué es |
|---|---|---|
| `baseFrequencyX/Y` | 0.008 / 0.014 | frecuencia del ruido (bajo = ondas ANCHAS suaves, no zigzag) |
| `octaves` | 2 | octavas del fractal |
| `seed` | 7 | semilla fija → estable entre cartas |
| `maxDisplacement` | 90 | desplazamiento a `warp=100` (px, espacio de la carta) |
| `overscan` | 0.12 | margen para que el desplazamiento no revele bordes transparentes |

- Desplazamiento efectivo = `foilWarpDisplacement(warp)` = `(warp/100) * maxDisplacement`.
- **Studio**: filtro SVG `feTurbulence(type=fractalNoise, baseFrequency, numOctaves,
  seed)` + `feDisplacementMap(scale = foilWarpDisplacement(warp), xChannel=R, yChannel=G)`
  sobre foil+sheen; con overscan `inset: -12%`.
- **Flutter**: fragment shader — `uv' = uv + (fbm(uv * baseFrequency, octaves) - 0.5)
  * foilWarpDisplacement(warp)` antes de muestrear el gradiente.
- ⚠️ El ruido difiere (Perlin SVG vs fbm shader) → **NO bit-idéntico**; con los mismos
  parámetros el LOOK converge (bandas anchas curvadas suaves). Apunta al look, no al píxel.

## 3) Marco (borde)

`border_style` (9 diseños) → `borderSVG(style, border_width, border_margin, border_fill,
radius)` (en `@kromia/core/border-svg.ts`, ya espejado). Tinte: `border_color_hex`
(si válido MANDA) · `FOIL_BORDER_SOLID[gold|silver|none]` · `aurora`/`spectrum` =
gradiente del foil · `FOIL_CARD_BG[forest|obsidian|plum|steel]` (degradado oscuro).
Radio del marco = `CARD_CORNER_RADIUS_PX[fmt.cornerRadius].svg` (mismo que el clip
de la carta — ver KRO-225; clip elíptico).

## Checklist de paridad Flutter

- [ ] `visual_effects.dart`: los 22 params (incl. geometry/warp/angle/pattern_hex). ✅ (5.3.0)
- [ ] `foil_recipe.dart`: `FOIL_PATTERNS`, `parseFoilPatternHex`, receta custom (ciclo 45%),
      `foilEffectiveAngle`, **`FOIL_ORGANIC_WARP` + `foilWarpDisplacement`**, tintes.
- [ ] Render app: gradiente (paleta/custom/ángulo) → warp orgánico (fbm) → glare/noise → marco.
- [ ] `border_svg.dart` (ya hecho, PR#64) + clip elíptico (KRO-225).
