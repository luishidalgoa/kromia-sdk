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

**Z-order CANÓNICO de la CARTA con capas 3D** (KRO-128; verificado en el código
de Studio 2026-07-18, `CardFocusOverlay`/`AlbumAppPreview`/`VisualEffectLayers`,
QA carta 006):

```
fondo (arte plano + depth `back`)
  → foils de TARJETA (la pila entera: iridescent/holographic/custom)
    → SUJETO limpio (depth `mid` + `front`, cada una con su foil POR-CAPA
       `__depthLayers[i].foil` — eso es lo que tiñe al sujeto, NO el foil de tarjeta)
      → frozen / signed
        → badge
```

Ni "todo-limpio" (KRO-224 viejo) ni "todo-bañado": el foil de tarjeta baña SOLO
fondo+`back`; **`mid` y `front` van LIMPIAS encima**. Sin capas 3D, el foil
cubre toda la carta (cartas planas).

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

**Ciclo canónico del repeating (paridad de TAMAÑO)**: `foilPatternCycle(pattern)`
(TS y Dart) — posición del último stop: spectrum/midnight **45** · oilslick **40** ·
sunset/mint **48** · custom clásico (`FOIL_CUSTOM_CYCLE_PCT`) **45** · aurora
(cónica) **null** (gira, no cicla). El % es relativo al LIENZO (`background-size`),
así que el **periodo visual sobre la carta = ciclo · scale/100**: a scale 300,
spectrum cierra cada 1.35 anchos de carta (lavado ancho, <1 ciclo visible), NO
bandas finas. ⚠️ Al estirar, el blowout del blend se controla con la
`opacity`/blend de la capa (un lavado overlay@30 es sutil por diseño) — no
recortar el periodo para compensar.

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

## 3) Marco (borde) — FILL LIBRE (KRO-249, KRP 5.6.0)

`border_style` (9 diseños) → `borderSVG(style, border_width, border_margin, border_fill,
radius)` (en `@kromia/core/border-svg.ts`, ya espejado). Radio del marco =
`CARD_CORNER_RADIUS_PX[fmt.cornerRadius].svg` (mismo que el clip de la carta —
ver KRO-225; clip elíptico).

**El FILL del marco lo resuelve `resolveFoilBorderFill(config)`** (`foil-recipe.ts`,
fuente única — NO reimplementar la precedencia en el host):

1. `border_texture_url` → `{kind:'texture'}` — imagen que rellena el marco
   (cover, centrada, por el proxy). MANDA sobre todo.
2. `border_color_hex` (#RRGGBB válido) → `{kind:'solid'}`.
3. `border_gradient_hex` → `{kind:'custom-gradient', colors, stops}` — ver
   §3-ter (multibanda): hasta 16 colores con peso `@`; 2–4 sin pesos ni
   `border_gradient_cycle` = camino clásico (`foilCustomPatternCss(colors)`,
   ciclo 45%). Caso estrella clásico: `#8e9aa8,#e8edf2,#8e9aa8` = marco
   metálico plateado.
4. `border_color` enum (ahora 13 opciones): `spectrum` → `{kind:'follow-foil'}`
   (el gradiente ACTUAL del foil, incl. paleta custom/none) · cualquier paleta de
   `FOIL_PATTERNS` (aurora/oilslick/sunset/mint/midnight) → `{kind:'palette'}`
   (gradiente FIJO, `foilPatternCss(pattern)`) · forest/obsidian/plum/steel →
   `{kind:'card-bg'}` (degradado oscuro vertical) · none/gold/silver →
   `{kind:'solid'}` (`FOIL_BORDER_SOLID`; desconocido = blanco).

Los gradientes se pintan a `scale% scale%` (mismo size que el foil); el blend
`screen` SOLO con el blanco base (`kind:'solid'` #ffffff con `border_color`
'none' sin overrides) — el resto `normal`. En Flutter: el `borderSVG` sigue de
máscara y el fill se pinta con la primitiva del kind (imagen / color /
LinearGradient de los stops / SweepGradient para aurora).

### 3-bis) Diseño de borde PERSONALIZADO (KRO-259, KRP 5.8.0)

`border_style: 'custom'` + `border_custom_url` (troquel del creador: imagen
donde el **blanco = diseño**, interpretada por **LUMINANCIA** — mismo contrato
visual que los borderSVG de fábrica, que son blanco sobre transparente; con
luminancia valen ambos formatos). Reglas:

- El troquel **sustituye al borderSVG como máscara** del marco; TODO el
  pipeline del fill (tinte / degradado custom / textura / `border_sheen` /
  canto §4.5) se aplica igual encima → separa por capas la FORMA (diseño) del
  RELLENO (material).
- `border_fill` y `border_width` **no aplican** (la forma ya viene dibujada;
  el editor los oculta con `visibleWhen`); un valor residual en el config se
  ignora.
- `border_margin` se aplica como **INSET** del cuadro de la máscara:
  `inset = border_margin / 300` (fracción del ancho de la carta, mismo eje
  visual que el margen del borderSVG), en ambos ejes.
- Troquel vacío / URL rota ⇒ sin marco (como `border_style: 'none'`).
- Flutter: el troquel es un sampler más — luma→alfa (como la máscara del foil)
  y encima el fill; en el single-pass es un término idéntico al del borderSVG
  rasterizado.

### 3-ter) Degradado MULTIBANDA del marco (KRO-264, KRP 5.9.0)

El foil prismático real (QA con la Zapdos ex física) no es un degradado suave de
3–4 colores: son **~15 bandas ESTRECHAS de anchos IRREGULARES**, con casi-blancos
intercalados (el "metal" asoma entre color y color) y un ciclo mucho más
frecuente. Respuesta algorítmica:

- **Spec extendido de `border_gradient_hex`**: `#RRGGBB[@peso],…` con **2–16**
  colores. El `@peso` (0.1–20, default 1) = **ancho relativo de la banda** de ese
  color (la distancia hasta el color siguiente). Parser canónico:
  `parseFoilGradientSpec(raw)` → `FoilGradientStop{color,hex,weight}[] | null`
  (null = inválido → cae al enum, como siempre).
- **`border_gradient_cycle`** (número 6–100, default 45, `FOIL_GRADIENT_SPEC.cycle`;
  solo visible con `border_gradient_hex` no vacío): % del cuadro que ocupa UN
  ciclo completo antes de repetir. Bajarlo = bandas más frecuentes (la
  referencia física ≈ 28).
- **Layout canónico**: `foilGradientPositions(stops, cyclePct)` → posición
  acumulada de cada stop en `[0, cyclePct)` proporcional a los pesos, redondeo a
  3 decimales. El ciclo **cierra repitiendo el primer color** en `cyclePct` (sin
  costura). Flutter: mismas posiciones/colores en un `LinearGradient` con
  `tileMode: repeated` (§3 kind `custom-gradient` usando `stops` en vez de
  `colors`).
- **El multibanda SE DESLIZA con la inclinación** (QA: física real — rotar el
  prismático desplaza las bandas). A tamaño exacto del cuadro el pan del tilt es
  un no-op, así que el lienzo del degradado se pinta **sobredimensionado** a
  `FOIL_MULTIBAND_PAN.sizePct` (200 %) y el ciclo se **compensa en espacio de
  imagen** con `foilMultibandCycle(ciclo)` (= ciclo·100/sizePct; p.ej. 28 → 14)
  para que el ancho VISUAL de banda no cambie. Web:
  `foilWeightedGradientCss(stops, 115, foilMultibandCycle(c))` + `background-size:
  200% 200%` + el MISMO `background-position` del tilt que el resto de fills del
  marco. Flutter: gradiente a 200 % del cuadro paneado por giroscopio (mismo eje
  que el foil).
- **Retro-compat dura**: `isMultibandGradient(stops, cycle?)` decide el camino —
  multibanda si (>4 colores) O (algún peso ≠ 1) O (`border_gradient_cycle`
  explícito). Si no → camino clásico byte a byte (2–4 equiespaciados, ciclo 45%,
  size `scale%`): ninguna carta guardada cambia de aspecto.
- Preset de referencia ("Nácar", editor de Studio; muestreado de la carta física
  de arriba→abajo): `#7784bd@1.2,#caa7fe@0.8,#90a0fc,#dcfefe@1.5,#f9fefe,`
  `#9dbdc3@0.7,#9dfeff,#f0feff@1.4,#a5c0e2@0.9,#b6cfff,#87aee8@0.8,#fdbefe@1.2,`
  `#fce78d,#fcfdec@1.3,#d9fd6f@0.9,#b6f8d5` + `border_gradient_cycle: 28`. Los
  casi-blancos (`#f9fefe`, `#f0feff`, `#fcfdec`) VAN COMO STOPS — son los que dan
  el aspecto metal; no filtrarlos.

## 4) VIDA del efecto — movimiento, destellos y brillo del marco (KRO-256, KRP 5.7.0)

Tres params nuevos ("la carta vive sola", feedback QA de la Zapdos vs la física):

### 4.1 `motion` — movimiento autónomo a elección del diseñador

`foilMotionFlags(config.motion)` → `{drift, hueCycle}` (receta `foil_recipe`):

- **`auto`** (default, retro-compat): comportamiento clásico — vaivén en rejilla,
  paneo con inclinación/giroscopio en focus. Nada cambia.
- **`deriva`** (`drift`): el barrido del foil/sheen corre EN CONTINUO también en
  focus (mismo vaivén ping-pong `alternate` del grid, sin reinicio brusco).
- **`tono`** (`hueCycle`): el matiz del gradiente rota 0→360° en bucle lineal
  ("la rotación del iridiscente"). Compone con el `hue` estático del config.
- **`total`**: ambos.

**Velocidad** = `shimmer` (0–100) vía `FOIL_MOTION_TIMING`: deriva
`foilMotionSweepSec(shimmer)` (5.5s→2.0s, MISMO mapeo que el vaivén clásico);
tono `foilMotionHueSec(shimmer)` (14s→4s por vuelta). En el shader: el giro de
matiz es una rotación de matiz al muestrear el gradiente
(`hueTotal = hue + 360·(t / hueSec % 1)`), coste cero.

### 4.2 `mask_sparkle` — destellos por perforación ('no' | 'pastel' | 'vivo')

Solo con `mask_url`. Una capa EXTRA tras la MISMA máscara/layout: campo
multicolor de grano fino → **cada perforación muestra SU color, distinto del
vecino** (look "cosmos"). **QA 2026-07-12 — el matiz sigue la ROTACIÓN de la
carta por defecto** (como el holográfico de siempre): en focus,
`hueOffset = (holoX + holoY) · 360°` (tilt en Studio, **giroscopio en la
app**); el bucle de reloj (`foilMotionHueSec`) solo en la rejilla (`animated`)
o si el diseñador eligió `motion: 'tono'/'total'`. Receta `FOIL_MASK_SPARKLE`:

- Gradiente = paleta `spectrum` girada `angleOffsetDeg` (−30°) sobre su ángulo
  nativo (cruza la lámina) a `sizePct` (46%) — tamaño pequeño ⇒ vecinos en
  colores distintos.
- Variantes `foilMaskSparkleVariants`: `pastel` = opacity 0.7 · saturate 0.85;
  `vivo` = opacity 1 · saturate 1.6.
- Blend `screen` (enciende los orificios sin oscurecer el arte). Ciclo de matiz
  SIEMPRE activo (es su razón de ser), duración `foilMotionHueSec(shimmer)`.
- En el shader single-pass: `sparkle = hueRotate(spectrum(uv·k), t) · maskLuma`
  añadido en screen — un término más, sin pasada extra.

### 4.3 `border_sheen` — brillo del marco ('no' | 'metalico' | 'iridiscente')

Solo con `border_style`. Capa APARTE encima del fill del marco (mismo
`borderSVG` como máscara) → el "borde metálico por capas" de las cartas
físicas. Receta `FOIL_BORDER_SHEEN`:

- `metalico`: banda especular blanca — gradiente lineal a `angleDeg` (100°) con
  stops alpha 0→0→0.85→0→0 (pos 0/35/50/65/100), a `sizePct` 250%, blend
  `screen`.
- `iridiscente`: la banda usa la paleta `spectrum` completa, atenuada a
  `iridescentOpacity` (0.75).
- **QA 2026-07-12 — posición de la banda**: en focus RECORRE el marco con la
  inclinación/giroscopio (misma fórmula de paneo que el foil, `shiftPos`); el
  barrido en bucle (ping-pong, duración `foilMotionSweepSec(shimmer)`) solo en
  rejilla (`animated`) o con `motion: 'deriva'/'total'`.
- **QA 2026-07-12 bis — banda AFILADA**: stops re-perfilados a
  0/0@42/1.0@50/0@58/0@100 (una banda ancha y tenue leía como "lavado pastel",
  no como metal).

### 4.5 CANTO del marco (`FOIL_BORDER_EDGE`) — QA "el borde se funde con la carta"

SIEMPRE que el marco tenga fill con presencia (todo salvo el blanco base con
blend screen): un contorno fino oscuro (`color` rgba(24,22,34,0.75), radio
`blurPx` 0.6) alrededor de la SILUETA del marco — borde exterior E interior
(la ventana del arte). Es lo que hace que el marco se lea como PIEZA (metal
troquelado) en vez de un degradado fundido con la carta.

- Studio: doble `drop-shadow` sub-píxel sobre la capa del fill (el drop-shadow
  contornea el alfa de la máscara del borderSVG).
- Flutter: **stroke fino del path del borderSVG** con `foilBorderEdge.color`
  (ancho ≈ 2·blurPx lógicos), pintado bajo el fill.
- Combinación estrella (la Zapdos): `border_texture_url` con una textura de
  remolinos foil ("swirl" tipo damasco) + `border_sheen: 'metalico'` + este
  canto = el marco metálico grabado de las cartas físicas premium.

### ⚠️ 4.4 PERF — máscara estática, animación en el hijo (lección Studio)

Animar `filter`/gradiente EN el mismo elemento enmascarado re-rasteriza la
máscara de luminancia POR FRAME (con máscaras grandes tipo 1500×2100 congeló la
página). En Studio la solución es wrapper con máscara/blend ESTÁTICOS + hijo
interior animado (keyframes de filter puros → compositor). **En Flutter el
shader single-pass ya lo evita de serie** (la máscara es un sampler; el giro de
matiz es aritmética en el fragment) — no dupliquéis pasadas de máscara por
frame.

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
- [ ] `visual_effects.dart`: `border_color` +4 opciones, `border_gradient_hex`,
      `border_texture_url` (KRP **5.6.0**).
- [ ] `foil_recipe.dart`: `resolveFoilBorderFill` + `FoilBorderFill` (§3) — la
      precedencia del fill NO se reimplementa a mano.
- [ ] Render app: gradiente (paleta/custom/ángulo) → warp orgánico (fbm) → glare/noise → marco.
- [ ] `border_svg.dart` (ya hecho, PR#64) + clip elíptico (KRO-225).
- [x] `visual_effects.dart`: params `motion`/`mask_sparkle`/`border_sheen` (KRP **5.7.0**) —
      hecho por el chat de Efectos.
- [x] `foil_recipe.dart`: `foilMotions`/`foilMotionTiming`/`foilMotionFlags`/
      `foilMotionSweepSec`/`foilMotionHueSec` + `foilMaskSparkle(+Variants)` +
      `foilBorderSheen` (§4) — hecho por el chat de Efectos.
- [ ] Render app (§4): deriva continua + ciclo de matiz en el shader; capa sparkle
      tras la máscara; banda especular/espectral barriendo el marco (§4.3). PERF §4.4.
