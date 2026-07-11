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

## 1-bis) Paleta "Ninguna" (`pattern: 'none'`) — lámina NEUTRA (KRO-247, KRP 5.4.0)

Sin gradiente de color. Reglas (con `pattern:'none'` y SIN `pattern_hex` válido —
un `pattern_hex` válido sigue MANDANDO; el editor garantiza la exclusión):

- **La capa foil de color NO se pinta** → `hue`, `opacity` (de la capa foil),
  `brightness`, `contrast`, `scale`, `blend`, `angle`, `geometry` y `warp` **no
  aplican** (el editor los oculta vía `visibleWhen`, editor-only). Un valor
  residual de `geometry:'organico'` en el config se IGNORA.
- **El sheen usa el barrido neutro** `FOIL_NEUTRAL_SHEEN` (foil-recipe.ts):
  linear-gradient **único, NO repeating**, 115°, blanco con alpha `0 → 0.9 → 0`
  (pos 0/50/100%). Studio: `foilNeutralSheenCss()`; Flutter: `LinearGradient`
  desde los MISMOS stops. `blend: screen`, `opacity: sheen/100`, size 250%.
  En rejilla hereda el vaivén `kr-holo-sweep` (velocidad = `shimmer`; con paleta
  de color ese vaivén lo lleva la capa foil); en foco se panea con el tilt
  (dirección opuesta, como el sheen normal).
- **glare (`glow`), grano (`noise`) y marco (`border_*`) NO cambian.**
- Tinte de borde `spectrum` ("sigue al foil") con `none` = el barrido neutro.
- **Para qué sirve**: combinar el brillo del iridiscente (reflejo/resplandor/
  grano/marco) con capas importadas (`custom_foil`) sin teñirlas de arcoíris.

## 1-ter) MÁSCARA importable (`mask_url` + `mask_layout` + `mask_scale`) — KRO-248, KRP 5.5.0

El iridiscente acepta una máscara por **LUMINANCIA** (blanco = el foil asoma,
negro = oculto), como la del custom_foil. Recorta **solo las capas `foil` y
`sheen`** (glare/grano/borde NO se recortan). Sin `mask_url` → sin recorte
(retro-compat). Funciona con CUALQUIER paleta, incluida `none`.

- **Layout** desde la receta compartida **`foilMaskLayout(layout, scalePct)`**
  (`custom-foil-recipe.ts`), fuente única de ambos efectos:
  - `cover` (default) = escala+recorta centrada, sin repeat (== `CUSTOM_FOIL_MASK`).
  - `tile` = la máscara TESELA el cuadro: repeat, tamaño `scale%` del ancho
    (alto auto, conserva el aspect de la tesela), anclada a la esquina
    (`top-left`). `mask_scale` 5–100, default 25 (`FOIL_MASK_TILE`).
- **Studio (CSS)**: `mask-image: url(proxy)` + `mask-mode: luminance` +
  `mask-size: cover | <scale>% auto` + `mask-repeat: no-repeat | repeat`.
  La URL SIEMPRE por el proxy same-origin (mask-image cross-origin = CORS).
- **Flutter**: máscara luma→alfa (`dstIn` / canal de luminancia en el shader)
  sobre las capas foil+sheen; con `tile` muestrear la tesela con wrap-repeat a
  la escala dada. NO usar el alfa crudo.
- **Caso estrella**: tesela de puntos blancos sobre negro + `tile` = fondo
  "papel perforado"/cosmos-holo (el foil asoma solo por los puntos), combinable
  con paleta `none` (destellos plata) o cualquier paleta de color.
- **`EffectLayer` (custom_foil) gana lo mismo**: `maskLayout?`/`maskScale?`
  (tipo `EffectMaskLayout`, DATA — ausente = `cover`). El render del host usa el
  MISMO `foilMaskLayout`.

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
      `foilEffectiveAngle`, **`FOIL_ORGANIC_WARP` + `foilWarpDisplacement`**, tintes,
      **`FOIL_PATTERN_NONE` + `FOIL_NEUTRAL_SHEEN`** (KRO-247, §1-bis).
- [ ] `visual_effects.dart`: opción `none` en el enum `pattern` (KRP **5.4.0**).
- [ ] Render `pattern:'none'`: sin capa de color; sheen = barrido neutro (§1-bis).
- [ ] `visual_effects.dart`: params `mask_url`/`mask_layout`/`mask_scale` (KRP **5.5.0**).
- [ ] `custom_foil_recipe.dart`: `FOIL_MASK_LAYOUTS` + `FOIL_MASK_TILE` + `foilMaskLayout`;
      `EffectLayer.maskLayout`/`maskScale` en el modelo Dart (§1-ter).
- [ ] Render máscara: luma→alfa sobre foil+sheen; `tile` = wrap-repeat a escala (§1-ter).
- [ ] Render app: gradiente (paleta/custom/ángulo) → warp orgánico (fbm) → glare/noise → marco.
- [ ] `border_svg.dart` (ya hecho, PR#64) + clip elíptico (KRO-225).
