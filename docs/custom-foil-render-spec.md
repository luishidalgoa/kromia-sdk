# Render del `custom_foil` — spec cross-platform (KRO-122)

Fuente canónica del RENDER del **foil PERSONALIZADO** (`custom_foil`) para que
**Flutter lo espeje 1:1** sin drift. A diferencia del `iridescent_foil` (un efecto
de catálogo con params), el `custom_foil` es una **PILA DE CAPAS que aporta el
creador**: cada capa = una imagen de textura + una máscara opcional + una fusión +
una intensidad. No hay contrato KRP que lo gobierne (las capas son DATA de álbum,
`TagStyle.customLayers`); esta spec es la **capa C** (cómo se PINTA), y sus datos
viven en `@kromia/core/custom-foil-recipe.ts`. Referencia de Studio:
`FoilLayer.tsx` (+ `CustomFoilLayers` en `VisualEffectLayers.tsx`).

> ⚠️ **Estado**: `custom_foil` quedó DESCARTADO en la app tras KRO-224 (se lavaba,
> igual que el iridiscente). El iridiscente + holographic se reactivaron vía
> **ShaderMask** (`color-dodge(arte, foil)` real). Este doc es la receta para
> hacer lo MISMO con la pila de capas del custom foil. **La causa del "amarillo
> plano" que tapa el arte casi siempre es una de estas dos: (a) el blend se compone
> contra el FONDO de la celda en vez de contra el arte, o (b) la máscara no se
> aplica por LUMINANCIA.** Ver §2 y §4.

## 1) Modelo de datos (ya en el SDK)

Una carta con un `TagStyle` cuyo `customLayers` no está vacío usa ESAS capas en vez
de un efecto de catálogo (`resolveCardEffects` → `ResolvedEffect.customLayers`).
Cada capa es un `EffectLayer` (`types.ts`):

| campo | tipo | qué es |
|---|---|---|
| `kind` | `'foil' \| 'glitter' \| 'pattern'` | naturaleza → orienta el LAYOUT de la textura (§3) |
| `textureUrl` | string | la lámina/tornasol/glitter/patrón que se superpone |
| `maskUrl?` | string | máscara en GRISES (blanco=brilla, negro=oculta). Opcional |
| `blend` | `EffectBlendMode` | modo de FUSIÓN (§2) |
| `intensity?` | number 0..1 | opacidad efectiva de la capa (default **0.6**) |
| `motion?` | number 0..1 | RESERVADO (hoy no se lee — ver §5) |

## 2) Fusión (blend) — los 5 modos + el compositing ⭐

`EFFECT_BLEND_MODES` = `['color-dodge','overlay','screen','soft-light','hard-light']`.
Las keys == nombres de CSS `mix-blend-mode`. Mapeo canónico a Flutter (fuente única
`EFFECT_BLEND_TO_FLUTTER`, NO mapear a mano):

| blend | CSS `mix-blend-mode` | Flutter `dart:ui` `BlendMode` | carácter |
|---|---|---|---|
| `color-dodge` | color-dodge | `BlendMode.colorDodge` | aclara mucho; el tornasol relumbra en zonas claras (default) |
| `overlay` | overlay | `BlendMode.overlay` | realza contraste; equilibrado |
| `screen` | screen | `BlendMode.screen` | solo aclara; brillo suave |
| `soft-light` | soft-light | `BlendMode.softLight` | luz tenue; sutil |
| `hard-light` | hard-light | `BlendMode.hardLight` | foco potente; muy marcado |

**EL PUNTO CRÍTICO (causa del lavado):** el blend de una capa se aplica CONTRA el
resultado compuesto hasta ahí — **el arte de la carta + las capas previas** — NO
contra el fondo de la celda. En web, `mix-blend-mode` compone contra lo que hay
DEBAJO en el DOM (el arte), por eso se ve bien sin más. En Flutter, si pintas la
capa con `saveLayer` + `BlendMode.colorDodge` sobre un árbol donde el arte está en
una CAPA DE COMPOSITING AISLADA (p.ej. `KromiaImage` con su `AnimatedSwitcher`, o
`DepthLayerStack` con `Transform`), el `saveLayer` compone contra el FONDO CLARO de
la celda → satura a blanco/plano. **Es exactamente el bug de KRO-224.** La solución
que ya usáis para el iridiscente aplica igual aquí: **envolver el arte con un
`ShaderMask` / fragment shader que reciba el arte como sampler** y aplique el blend
de cada capa PÍXEL a PÍXEL contra el arte real. La pila de capas se aplica en orden
(§6) sobre ese mismo sampler.

## 3) Textura — layout por `kind` (`foilTextureLayout(kind)`)

| kind | repeat | size (en % del cuadro) | por qué |
|---|---|---|---|
| `pattern` | **sí** (tesela) | `160% auto` | patrón que se repite sin costura; `auto` conserva su aspect |
| `foil` / `glitter` | no | `250% 100%` | lámina ÚNICA SOBREDIMENSIONADA → deja recorrido para el paneo por tilt (§5) |

La textura va SIEMPRE por el proxy same-origin de imágenes (en Studio `toThumbUrl`
→ `/api/images/<key>`): el MinIO es PRIVADO, la URL cruda da AccessDenied, y para
`mask-image` una URL cross-origin dispara CORS. **Flutter debe cargar textura Y
máscara por el proxy autenticado igual** (no la URL cruda de MinIO).

## 4) Máscara — SIEMPRE por LUMINANCIA ⭐ (`CUSTOM_FOIL_MASK`)

La máscara es una imagen en GRISES que limita DÓNDE brilla la textura: **blanco =
brilla, negro = oculta**. Se interpreta por **LUMINANCIA, NO por alfa**. Sin
`maskUrl` → la capa brilla ENTERA.

- **Studio (CSS)**: `mask-mode: luminance; mask-size: cover; mask-position: center;
  mask-repeat: no-repeat`.
- **Flutter**: convertir la máscara luma→alfa y aplicarla como `BlendMode.dstIn`
  sobre la capa de textura. **NO uses el alfa crudo de la máscara** (una máscara PNG
  opaca en negro tiene alfa=1 en todos los píxeles → por alfa no recortaría NADA y
  la textura taparía la carta = el bug del "amarillo plano"). Convierte por
  luminancia: `alpha = luma(rgb)` (p.ej. un `ColorFilter.matrix` que vuelca RGB→A, o
  el canal de luminancia en el shader).
- Encaje `cover` + `center` porque la máscara se genera del MISMO arte (mismo
  aspect) → el contorno cae justo sobre los bordes del dibujo.
- **KRO-248 — layout `tile`** (KRP 5.5.0): `EffectLayer` gana `maskLayout?:
  'cover'|'tile'` + `maskScale?: number` (5–100 = % del ancho por tesela;
  ausente = `cover`, retro-compat). Con `tile` la máscara se REPITE
  (`mask-repeat: repeat`, `mask-size: <scale>% auto`, anclada `top left`) →
  patrones tipo "papel perforado"/cosmos-holo. Fuente única
  **`foilMaskLayout(layout, scale)`** (`custom-foil-recipe.ts`) — NO hardcodear
  el layout en el host. La interpretación sigue siendo por LUMINANCIA. En
  Flutter: wrap-repeat de la tesela a esa escala antes del luma→alfa. El
  iridiscente usa el MISMO layout vía sus params `mask_url`/`mask_layout`/
  `mask_scale` (ver `iridescent-foil-render-spec.md` §1-ter).

## 5) Tilt / movimiento (`CUSTOM_FOIL_TILT`)

La textura sobredimensionada (§3) se PANEA con la inclinación: el host publica un
punto normalizado `(hx, hy)` 0..1 (Studio: CSS vars `--holo-x`/`--holo-y` que
publica `HoloCard`; Flutter: giroscopio/drag) y la textura se posiciona ahí → el
tornasol se desplaza al mover la carta. `defaultPoint: 0.5` (centro), transición
`followMs: 140`. En rejilla (sin tilt) hay un vaivén suave `CUSTOM_FOIL_SHIMMER`
(`durationBaseS 3.4 + index*0.5`, `delayStepS 0.3` por capa para desincronizar).

⚠️ `EffectLayer.motion` está **RESERVADO**: hoy el paneo es a fuerza completa en
AMBOS hosts (Studio no lo lee). Si algún día se implementa, escalaría el paneo
alrededor del centro: `pos = 0.5 + (h - 0.5) * motion`. **No inventar otra fórmula**
(eso reintroduce drift) — coordinar el cambio en el SDK primero.

## 6) Orden de pintado (`CUSTOM_FOIL_LAYER_ORDER = 'array-order'`)

Las capas se superponen en el **orden del array** `customLayers`: `[0]` la más al
fondo, la última la más arriba. El publisher controla el z-order reordenando en el
editor. El glare y el tilt 3D los pone el renderer (no se autoran por capa).

## Checklist de paridad Flutter

- [ ] `foil_recipe.dart` (o equivalente): `EFFECT_BLEND_MODES`, `EFFECT_LAYER_KINDS`,
      `foilTextureLayout`, `foilLayerOpacity` (default 0.6 + clamp), `CUSTOM_FOIL_MASK`,
      `EFFECT_BLEND_TO_FLUTTER`. Espejo de `custom-foil-recipe.ts`.
- [ ] Compositing: el blend de cada capa se aplica CONTRA EL ARTE (ShaderMask/shader
      con el arte como sampler), NO contra el fondo de la celda. (= fix KRO-224.)
- [ ] Máscara por LUMINANCIA→alfa (`dstIn`), NO alfa crudo.
- [ ] Textura + máscara por el proxy autenticado (no URL cruda de MinIO).
- [ ] Layout por kind (pattern tesela 160%; foil/glitter lámina 250%×100%).
- [ ] Paneo por tilt (giroscopio/drag) con el punto 0..1; shimmer en rejilla.
- [ ] Orden = orden del array; recorte al redondeado/silueta de la carta.

> Nota de paridad: como con el iridiscente, el ruido/anti-alias exacto puede diferir
> entre CSS y shader — apunta al LOOK (lámina que reluce confinada por la máscara),
> no al píxel.
