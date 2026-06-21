# Sistema holográfico 3D / foil / contornos — contrato cross-platform

> **Audiencia**: el chat/equipo de **kromia-flutter** (núcleo `core_dart` + app).
> **Autor**: chat de Studio (SDK-TS + Studio + backend).
> **Objetivo**: que Flutter renderice los efectos **idénticos** a Studio, leyendo
> el **mismo dato** y los **mismos constantes**. Énfasis en la interpretación
> correcta de **máscaras de contorno blanco/negro**.

Toda referencia de código apunta al repo `kromia-sdk` (SDK) o `kromia-studio`
(Studio web). Las rutas y constantes de aquí están **verificadas contra el
source real** (no inferidas).

---

## 0. TL;DR — por qué Flutter lo está construyendo mal

El sistema de efectos está **partido en tres capas** y la causa del drift es que
**solo una** de ellas está cubierta por el contrato versionado:

| Capa | Dónde vive | ¿En el `.json` del KRP? | ¿Espejada en `core_dart`? | ¿La ve el drift-test? |
|---|---|:--:|:--:|:--:|
| **A. Catálogo** de 6 efectos (`VisualEffectDefinition`) | `core/src/registries/visual-effects.ts` | ✅ sí (`serializeVisualEffect`) | ✅ `visual_effects.dart` | ✅ **sí** |
| **B. Modelo de DATO** (foil, capas 3D, binding por rareza) | `core/src/types.ts` + `core/src/card-layers.ts` | ❌ **no** (es data de álbum/carta) | ⚠️ **parcial / falta** | ❌ **no** |
| **C. RENDER** (tilt, máscara, blend, parallax, contornos) | **solo `kromia-studio`** | — | ❌ **nada** | ❌ no |

**Conclusión (la sospecha del user, confirmada):**

1. El **catálogo** (qué efectos existen y su espacio de config) sí está en el
   contrato y el drift-sync lo vigila. Eso funciona bien.
2. El **modelo de dato del foil/3D** (`EffectLayer`, `CardDepthLayer`,
   `TagStyle.fieldKey`, `TagStyle.customLayers`, factores de parallax) está
   definido en TypeScript en `@kromia/core` **pero se excluye a propósito del
   `.json`** (es data, no catálogo). Por eso `contract-drift.test.ts` **nunca lo
   compara** → el drift-sync es **ciego** a esta capa.
3. Peor aún: gran parte de esa capa **no está espejada en `core_dart`**:
   - `tag_styles.dart` espeja `TagStyle` **pero le faltan `fieldKey` (KRO-120) y
     `customLayers` (KRO-122)**.
   - **No existe `card_layers.dart`** → `EffectLayer`, `EffectBlendMode`,
     `CardDepthLayer`, `LayerDepth`, los factores de parallax, `getCardDepthLayers`,
     `DEPTH_LAYERS_KEY`, `validateCardDepthLayers` **no existen en Dart**.
4. **Todo el render** (matemática del tilt, interpretación de la máscara por
   luminancia, mapeo de blend modes, desplazamiento de parallax, generación de la
   máscara de contornos) vive **solo en Studio** — ni siquiera en `@kromia/react`.
   Flutter lo está reimplementando a ciegas, sin un contrato de referencia. **Ese
   es el origen real del "no lo está construyendo correctamente".**

**Lo que hay que hacer en el núcleo Flutter** (resumen, detalle en §10):
- Espejar `card-layers.ts` → `card_layers.dart` (tipos + factores de parallax + helpers).
- Añadir `fieldKey` + `customLayers` (+ `EffectLayer`/`EffectBlendMode`) a `tag_styles.dart`.
- Espejar el resolver `resolveCardEffects` (efecto por rareza/tags/PK).
- Implementar el render respetando los constantes de §4–§9 **al pie de la letra**.
- (Opcional pero recomendado) extender el drift-test para cubrir esta capa B.

---

## 1. El dato que Flutter recibe (qué leer)

Hay **dos** sitios donde vive un efecto. Flutter debe leer **ambos**:

### 1.1 `albumSchema.tagStyles[]` — efectos por VALOR (compartidos)
Mapeo "valor de tag/rareza → efecto". No entra al `.json` (es data de álbum).

```jsonc
// albumSchema.tagStyles
[
  // (a) Efecto de catálogo disparado por la RAREZA (ordinal_enum/enum/rating):
  { "fieldKey": "rareza", "value": "legend", "effect": "holographic_effect",
    "config": { "intensity": "high" } },

  // (b) Efecto disparado por un campo con behavior `tags` (clásico, sin fieldKey):
  { "value": "Holográfica", "effect": "holographic_effect" },

  // (c) FOIL PERSONALIZADO de toda la carta, "solo a esta carta":
  //     es un TagStyle anclado al PK del cardSchema (fieldKey=PK, value=PK de la carta)
  { "fieldKey": "numero", "value": "6", "effect": "custom_foil",
    "customLayers": [ /* EffectLayer[] — ver §4 */ ] }
]
```

> **Clave**: el modal "Efecto de la carta N" (per-carta, "aplicado solo a esta
> carta") **no usa un campo per-carta**: escribe en el MISMO `tagStyles[]` del
> álbum con `{fieldKey: <PK>, value: <valor PK de la carta>}` (ver
> `kromia-studio/src/components/album/CardFoilDialog.tsx`). Flutter no necesita un
> almacén nuevo: con resolver bien `tagStyles` (§5) cubre catálogo, rareza, tags
> y per-carta a la vez.

### 1.2 `card.__depthLayers[]` — capas de profundidad 3D (per-carta)
El arte 3D es único por carta → vive en el DATO de la carta bajo la clave
reservada `__depthLayers` (`DEPTH_LAYERS_KEY`). No entra al `.json`.

```jsonc
// card["__depthLayers"]  (orden lógico back→mid→front; el helper lo reordena)
[
  { "url": "…/fondo.png",  "depth": "back" },
  { "url": "…/sujeto.png", "depth": "mid",
    "foil": { "kind":"foil", "textureUrl":"…/foil.png", "maskUrl":"…/mask.png",
              "blend":"color-dodge", "intensity":0.6 } },   // foil VINCULADO a esta capa 3D
  { "url": "…/particulas.png", "depth": "front" }
]
```

Otras claves reservadas del dato de la carta (ya espejadas en
`image_calibration.dart`): `__imageTransforms`, `__calibrationState`.

---

## 2. Tipos del modelo (source TS — `core/src/types.ts`)

Verbatim (líneas 579–693). **Flutter debe espejar estos en Dart.**

```ts
// Foil importable (KRO-122) — render-agnóstico, NO entra al .json
export type EffectLayerKind = 'foil' | 'glitter' | 'pattern';
export type EffectBlendMode =
  | 'color-dodge' | 'overlay' | 'screen' | 'soft-light' | 'hard-light';

export interface EffectLayer {
  kind: EffectLayerKind;
  textureUrl: string;          // lámina tornasolada / glitter / patrón
  maskUrl?: string;            // grises: BLANCO = brilla, NEGRO = no  ← crítico
  blend: EffectBlendMode;
  intensity?: number;          // 0..1 (opacidad efectiva). default render 0.6
  motion?: number;             // 0..1 cuánto se desplaza con el tilt
}

export interface CardEffect3D {  // pila de capas + profundidad (poco usado hoy)
  layers: EffectLayer[];
  depth?: number;              // 0..1
}

// Capa de profundidad 3D (KRO-130) — per-carta, NO entra al .json
export type LayerDepth = 'back' | 'mid' | 'front';
export interface CardDepthLayer {
  url: string;                 // cutout PNG con transparencia
  depth: LayerDepth;
  foil?: EffectLayer;          // foil propio de ESTA capa (opcional)
}

// Mapeo valor→efecto (KRO-30/120/122) — NO entra al .json
export interface TagStyle {
  value: string;               // valor EXACTO que dispara
  effect: string;              // id del catálogo, o 'custom_foil'
  config?: Record<string, string | number>;
  fieldKey?: string;           // KRO-120: ancla a un campo (incl. rareza). sin él = matchea campos `tags`
  customLayers?: EffectLayer[];// KRO-122: si presente, render usa estas capas en vez del catálogo
}

// Fuente de rareza (KRO-28) — vive en cardSchema.raritySource. YA espejado (rarity.dart)
export interface RarityBucket { value?: string; range?: [number, number]; weight: number; }
export interface RaritySource { fieldKey: string; buckets: RarityBucket[]; }
```

**Estado en `core_dart`** (verificado):
- `RaritySource`/`RarityBucket` → ✅ `rarity.dart`.
- `TagStyle` → ⚠️ `tag_styles.dart` tiene `value`/`effect`/`config` pero **NO**
  `fieldKey` ni `customLayers`. **Hay que añadirlos.**
- `EffectLayer`/`EffectBlendMode`/`CardEffect3D`/`CardDepthLayer`/`LayerDepth` →
  ❌ **no existen en Dart**. **Hay que crearlos** (sugerido: `card_layers.dart`).

---

## 3. Catálogo de 6 efectos (capa A — sí en contrato)

`core/src/registries/visual-effects.ts` → serializado a
`contracts/*.json` (`visualEffects[]`) → espejado en `visual_effects.dart`.
Esto **ya funciona** en Flutter; aquí solo para referencia del render (§ render
de cada uno en Studio: `VisualEffectLayers.tsx`).

| id | layer | config | render (resumen Studio) |
|---|---|---|---|
| `holographic_effect` | `overlay` | `intensity` enum low/medium/high | gradiente arcoíris 115°, `mix-blend:overlay`, opacidad 0.18/0.32/0.48 |
| `crown_badge` | `badge` | `color`,`position`,`image_url?`,`padding_x/y` | corona/imagen en esquina |
| `vintage_filter` | `filter` | `strength` enum | CSS `sepia()/grayscale()/contrast()` sobre la imagen |
| `glow_border` | `border` | `color` enum | doble `box-shadow inset` + pulso de brillo |
| `frozen` | `overlay` | — | radial+linear azulado, `mix-blend:screen`, shimmer opacidad |
| `signed` | `overlay` | `signature_url?` | firma rotada -6° abajo-derecha (o glifo cursiva) |

Constantes de render exactas en §8.2 (por si Flutter quiere paridad fina).

`layer` orienta el orden de compositing del render:
`filter` (sobre la imagen) → `overlay` (encima) → `border` (perímetro) →
`badge` (esquina, lo más arriba).

---

## 4. Foil personalizado (`EffectLayer`) — render + MÁSCARA

Source de render: `kromia-studio/src/components/album/visual-effects/FoilLayer.tsx`.

### 4.1 La capa foil
- `textureUrl`: imagen de la lámina (tornasol/glitter/patrón). Se sirve **por el
  proxy** `/api/images` (en Studio: `toThumbUrl`) — Flutter usa la URL servida.
- `kind`:
  - `pattern` → textura **en mosaico** (`repeat`), tamaño `160% auto`.
  - `foil` / `glitter` → **sin repetir** (`no-repeat`), tamaño `250% 100%`
    (sobredimensionada para que el "barrido" del brillo tenga recorrido).
- `intensity` → **opacidad** de la capa (0..1, default **0.6**).
- `blend` → modo de fusión (§4.3).
- `motion` → cuánto se desplaza con el ángulo (0..1).

### 4.2 LA MÁSCARA — interpretación blanco/negro (lo crítico)

> **Regla canónica**: la máscara es una imagen en **grises** interpretada por
> **LUMINANCIA**, no por canal alfa.
> **BLANCO (255) = el foil SE VE / brilla. NEGRO (0) = el foil NO se ve.
> Gris = parcial.** Sin máscara = el foil cubre toda la carta.

Studio lo consigue con CSS:
```ts
// FoilLayer.tsx
WebkitMaskImage: mask, maskImage: mask,
WebkitMaskSize: 'cover', maskSize: 'cover',          // ← ALINEACIÓN (ver abajo)
WebkitMaskPosition: 'center', maskPosition: 'center',
WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
maskMode: mask ? 'luminance' : undefined,   // ← interpreta GRISES como opacidad
```
`maskMode: 'luminance'` es la línea clave: una PNG en grises **opaca** (sin alfa)
sin este modo se trataría como "todo visible". Con él, el valor de gris ES la
opacidad.

> **⚠️ ALINEACIÓN del contorno (corregido 2026-06-20)**: el `mask-size` DEBE
> espejar el `object-fit` con que se pinta la imagen/cutout que enmascara — en
> Kromia las imágenes van con **`object-cover` centrado**, así que la máscara va
> con **`cover` + `center`**. La máscara se genera de ESA misma imagen (mismo
> aspect), de modo que `cover` la escala y recorta IGUAL → el contorno cae justo
> sobre los bordes del dibujo. **Estirar la máscara a `100% 100%` (fill) la
> deforma** cuando el aspect de la carta ≠ el de la imagen → el contorno queda
> **desajustado** (era el bug). En Flutter: usa el **mismo `BoxFit` y alignment**
> para la imagen y para la máscara (p.ej. ambos `BoxFit.cover`, `Alignment.center`).

**Equivalente en Flutter** (lo que tiene que hacer el render Dart):
- La máscara llega como imagen en grises. **Convertir luminancia → alfa**:
  `alpha = luminance / 255` (luminancia Rec.601: `0.299R + 0.587G + 0.114B`).
- Aplicarla como máscara de la capa foil. Opciones:
  - `ShaderMask` / `BlendMode.dstIn` con una versión de la máscara cuyo **alfa =
    luminancia** (pre-procesar la máscara a alfa, o un shader que muestree
    luminancia). **No** usar la máscara cruda como alfa (es opaca → no enmascara).
  - O un `FragmentShader` que multiplique el foil por `maskLuminance`.
- **Pinta la máscara con el MISMO `BoxFit`/alignment que la imagen** (`cover` +
  `center`) o el contorno se desajusta (mismo bug que Studio tenía).
- Resultado esperado: el tornasol **solo brilla donde la máscara es clara** y
  **sobre los bordes correctos** del dibujo.

### 4.3 Modos de fusión (`EffectBlendMode` → blend)
El valor almacenado es el **técnico CSS**; el label es solo presentación
(`kromia-studio/.../effect-i18n.ts`). Mapeo CSS `mix-blend-mode` → Flutter
`BlendMode` (Skia):

| `EffectBlendMode` (dato) | label es-ES | CSS mix-blend-mode | Flutter `BlendMode` |
|---|---|---|---|
| `color-dodge` | Sobreexposición | `color-dodge` | `BlendMode.colorDodge` |
| `overlay` | Superposición | `overlay` | `BlendMode.overlay` |
| `screen` | Trama | `screen` | `BlendMode.screen` |
| `soft-light` | Luz suave | `soft-light` | `BlendMode.softLight` |
| `hard-light` | Luz fuerte | `hard-light` | `BlendMode.hardLight` |

### 4.4 Animación del brillo del foil
- **Modo grid** (lista de cartas, sin foco): barrido automático
  `background-position 0%→100%` ping-pong, duración `3.4 + index*0.5` s, fase
  desincronizada por carta. (keyframe `kr-foil-shimmer`.)
- **Modo foco** (carta en grande, con tilt): la posición del brillo **sigue al
  tilt** vía variables `--holo-x`/`--holo-y` (0..1):
  `backgroundPosition: calc(--holo-x*100%) calc(--holo-y*100%)`, transición 140ms.
  → En Flutter: el offset de la textura foil = `(tiltX, tiltY)` normalizado.

---

## 5. Resolución del efecto por carta (rareza / tags / per-carta)

Source: `kromia-studio/src/components/album/visual-effects/effect-resolve.ts`
(`resolveCardEffects`). **Flutter debe espejar esta función pura.** Algoritmo:

1. Recolecta `tagValues` = valores de los campos del item con `behavior:'tags'`.
2. Para cada `ts` en `tagStyles` (en orden = z-order que controla el publisher):
   - **match** =
     - si `ts.fieldKey`: el valor del campo `ts.fieldKey` del item == `ts.value`
       (escalar o lista). → **esta rama cubre "holográfico por `ordinal_enum`/
       rareza"** y el per-carta por PK.
     - si no: `tagValues` contiene `ts.value` (tags clásicos standalone).
   - si no matchea → siguiente.
   - si `ts.customLayers?.length > 0` → **foil personalizado**: push
     `{effect: ts.effect||'custom_foil', layer:'overlay', customLayers}` (dedup por
     `custom:<fieldKey>:<value>`).
   - si no → efecto de catálogo: `getVisualEffect(ts.effect)`, push
     `{effect, layer: def.layer, config}` (dedup por `effect`).
3. Devuelve la lista de efectos resueltos (varios → se combinan/apilan).

**"Holográfico por `ordinal_enum`" = caso de `fieldKey`**: un `TagStyle` con
`fieldKey` apuntando al campo de rareza (`rating`/`enum`/`ordinal_enum`) y `value`
= el valor de rareza. NO hay un sistema separado de "efectos por rareza": es el
mismo `tagStyles` resuelto por `fieldKey`. (Y `cardSchema.raritySource` —ya en
`rarity.dart`— es la distribución de probabilidad de pulls, **ortogonal** al
efecto visual.)

---

## 6. Capas de profundidad 3D + parallax

Source de lógica PURA (SDK): `core/src/card-layers.ts`.
Source de render: `kromia-studio/.../DepthLayerStack.tsx`.

### 6.1 Constantes (verbatim — Flutter debe usar EXACTAMENTE estas)
```ts
export const DEPTH_LAYERS_KEY = '__depthLayers';
export const LAYER_DEPTH_ORDER = ['back', 'mid', 'front']; // orden de pintado fondo→frente

const PARALLAX_FACTOR = { back: 0.15, mid: 0.45, front: 1.0 }; // 0..1
export function depthToParallaxFactor(depth) { return PARALLAX_FACTOR[depth] ?? 0.5; }
```

### 6.2 Render / desplazamiento
- Las capas se pintan en orden `back→mid→front` (`getCardDepthLayers` filtra
  malformadas y **reordena** por `LAYER_DEPTH_ORDER`); `z-index = índice`.
- Desplazamiento de cada capa con el ángulo de vista (`--holo-x/y` ∈ [0,1]):
  ```
  amp = amplitudePx * depthToParallaxFactor(depth)
  translate( (holo_x - 0.5) * amp ,  (holo_y - 0.5) * amp )   // ±amp/2 por eje
  ```
  - `amplitudePx`: ~20px en modo foco; **0 en grid** (sin parallax en lista).
  - `overscan = amplitudePx > 0 ? 1.06 : 1` → escala 6% cuando hay parallax, para
    que los bordes transparentes no asomen al desplazar.
  - transición `transform 120ms ease-out`.
- En **Flutter**: `holo_x/holo_y` salen del **giroscopio** (o arrastre). back se
  mueve poco (0.15), mid medio (0.45), front mucho (1.0) → 3D real.

### 6.3 Validación (espejar `validateCardDepthLayers`)
Reglas: `url` no vacía; `depth` ∈ catálogo; si trae `foil`, su `textureUrl` no
vacía. Lista vacía/ausente = válida (es opt-in).

---

## 7. Vincular un foil a una capa 3D ("VINCULADA A CAPA 3D · MEDIO/FRENTE")

Hay **dos tipos** de capa de foil en el modal "Efecto de la carta":

| Tipo en UI | Dónde se persiste | Comportamiento de render |
|---|---|---|
| **"Capa extra (toda la carta)"** | `TagStyle.customLayers[]` (album, por valor) | foil **fijo** sobre toda la carta; **no** hace parallax |
| **"Vinculada a capa 3D · medio/frente"** | `CardDepthLayer.foil` de esa capa (en `card.__depthLayers`) | foil **dentro** de la capa 3D → **se mueve CON el parallax** de esa capa; aparece sobre la imagen de esa capa y bajo las capas más al frente |

Source: `depth-foil-edit.ts` (per-capa) vs `tag-styles-edit.ts` (toda la carta).
En render (`DepthLayerStack.tsx`), el `FoilLayer` del `CardDepthLayer.foil` se
pinta **dentro del div con el transform de parallax de esa capa** → hereda su
desplazamiento. Un foil de capa "medio" brilla y se mueve a ritmo 0.45; uno de
"frente" a 1.0.

**Flutter**: al componer cada `CardDepthLayer`, si tiene `foil`, renderizar el
foil **aplicando el mismo transform de parallax de la capa** (no el de la carta
entera). La máscara del foil se interpreta igual (§4.2).

---

## 8. Render del tilt 3D + efectos de catálogo (constantes para paridad)

Source: `kromia-studio/.../HoloCard.tsx` + `VisualEffectLayers.tsx` + `globals.css`.
Estas no están en el SDK (capa C, Studio-only). Para paridad visual fina:

### 8.1 HoloCard (tilt)
- `perspective` ≈ 820px (foco ~720px); `maxTiltDeg` = **12°**.
- pointer/giroscopio normalizado `ex,ey ∈ [0,1]` →
  `rotY = (ex-0.5)*2*maxTilt`, `rotX = -(ey-0.5)*2*maxTilt`.
- publica `--holo-x = ex`, `--holo-y = ey` (lo consumen foil §4.4 y parallax §6.2).
- transición: 80ms al seguir el cursor, 350ms al volver a plano.
- **Idle** (sin cursor, opt-in): wobble elíptico
  `x = 0.5 + sin(t*0.85)*0.34`, `y = 0.42 + cos(t*0.6)*0.22`.
- **Canto/grosor**: `depthPx`=18 → N slices de 1px en `translateZ(-i)`, color
  `hsl(36 30% L%)` con `L` de 90→46 (degradado kraft); dorso `hsl(34 20% 40%)`.
- **Bisel**: `box-shadow inset 0 1px 1px rgba(255,255,255,.35), inset 0 -3px 6px rgba(0,0,0,.26)`.
- **Glare**: radial blanco en `(ex,ey)`, `mix-blend:overlay`, opacidad 0.5
  activo / 0.16 idle / 0 inactivo.

### 8.2 Efectos de catálogo (constantes verbatim de `VisualEffectLayers.tsx`)
- **holográfico**: `linear-gradient(115deg, transparent 10%, #ff00cc 30%, #00ffff 45%, #ffe100 60%, transparent 85%)`, `background-size:250% 100%`, `mix-blend:overlay`, opacidad por intensidad **0.18 / 0.32 / 0.48** (low/medium/high). Animado: `kr-holo-sweep` 0%→250% 3.4s alternate; foco: posición = `--holo-x`.
- **frozen**: `radial-gradient(circle at 30% 20%, #e0f2ff66, transparent 60%), linear-gradient(160deg, #bae6fd44, #ffffff22)`, `mix-blend:screen`, shimmer opacidad 0.5↔0.95 (2.6s).
- **glow_border**: `box-shadow inset 0 0 0 2px {color}, inset 0 0 13px 2px {color}cc`, pulso `brightness 1→1.35` (1.8s). Colores: gold `#f5c542`, silver `#cbd5e1`, bronze `#cd7f32`, blue `#3b82f6`, green `#22c55e`, red `#ef4444`, purple `#a855f7`.
- **vintage**: filtro CSS — low `sepia(.4) saturate(.9)`; medium `sepia(.7) grayscale(.2) contrast(.95)`; high `sepia(1) grayscale(.35) contrast(.92) brightness(.96)`.
- **signed**: imagen de firma `rotate(-6deg)` abajo-derecha (`bottom/right ~6px`, alto ~28px, `drop-shadow(0 1px 2px rgba(0,0,0,.5))`); fallback glifo cursiva `rotate(-8deg)`.
- **crown_badge**: corona/imagen en esquina (`position` + `padding_x/y`).
- **reduced-motion**: si `prefers-reduced-motion` → sin tilt, sin animaciones.

---

## 9. Máscara de CONTORNOS (generación) — qué produce y cómo interpretarla

Source: `kromia-studio/src/lib/contour-mask.ts` (`sobelContourMask`,
`imageToContourMaskDataUrl`). Es **Studio-only** (se genera en el navegador con
Canvas, sin IA) y el resultado se sube a MinIO y se referencia como
`EffectLayer.maskUrl`.

**Qué hace** (para que Flutter sepa qué representa el píxel):
1. Luminancia Rec.601 de la imagen (`0.299R + 0.587G + 0.114B`).
2. Box blur opcional (default radio 1) para quitar grano.
3. **Sobel** (KX/KY 3×3) → magnitud del gradiente = bordes.
4. Normaliza a [0,1], aplica `gain` (default 1.6), `threshold` (default 0.06,
   corta ruido a negro), opcional `invert`.
5. Sale RGBA en grises: **BLANCO = contorno (borde del dibujo) = donde brillará el
   foil; NEGRO = interior/fondo plano = sin brillo.**

**Implicación para Flutter** (lo que el user recalca):
- La máscara de contornos es un caso de la máscara genérica de §4.2 → se
  interpreta **igual**: blanco brilla, negro no, por **luminancia**.
- El foil enmascarado con contornos hace que el tornasol **siga las líneas del
  dibujo** en vez de cubrir la carta plana. Flutter **no** genera la máscara
  (eso es authoring de Studio); solo la **consume** desde `maskUrl`.
- Si Flutter quisiera generar contornos en cliente (futuro), el algoritmo es
  Sobel sobre luminancia con esos defaults — pero **no es necesario** para
  renderizar; la máscara ya viene servida.

---

## 10. Trabajo recomendado en el núcleo `core_dart` (para cerrar el drift)

Orden sugerido (de mayor a menor impacto):

1. **`tag_styles.dart`**: añadir `fieldKey` y `customLayers` a `TagStyle` (+
   `fromJson`). Sin esto, Flutter no resuelve efectos por rareza ni foil custom.
2. **Nuevo `card_layers.dart`** (espejo de `card-layers.ts`):
   `EffectLayer`, `EffectLayerKind`, `EffectBlendMode`, `CardEffect3D`,
   `CardDepthLayer`, `LayerDepth`, `DEPTH_LAYERS_KEY`, `LAYER_DEPTH_ORDER`,
   `PARALLAX_FACTOR`, `depthToParallaxFactor`, `getCardDepthLayers`,
   `validateCardDepthLayers`. Con corpus de test 1:1 (como el resto de `core_dart`).
3. **Resolver** `resolveCardEffects` (espejo de `effect-resolve.ts`): pure, con
   las mismas reglas de match/dedup de §5.
4. **Render** en la app respetando §4 (máscara por luminancia + blend), §6
   (factores de parallax exactos + overscan + orden), §7 (foil vinculado hereda
   parallax), §8 (tilt: maxTilt 12°, perspective ~820, glare, canto).
5. **(Opcional) extender el drift-test**: hoy `contract-drift.test.ts` solo
   compara el `.json` (capa A). Para que esta capa B no vuelva a derivar, añadir
   un test de paridad TS↔Dart de los **constantes** (`PARALLAX_FACTOR`,
   `EffectBlendMode` set, `LAYER_DEPTH_ORDER`, claves reservadas) — el mismo patrón
   que ya usa `classify_test.dart`. Decisión a coordinar entre los dos chats.

> **Nota de reparto** (ver MEMORY): `core_dart` y la app las lleva el chat de
> Flutter; el SDK-TS canónico (`@kromia/core`) lo lleva el chat de Studio. Si al
> espejar detectáis que el modelo TS debería cambiar (p.ej. promover `EffectLayer`
> al `.json`, o mover un constante), abrid issue cruzado — no toquéis el TS desde
> Flutter.

---

## 11. Índice de ficheros (verificado)

| Qué | Ruta |
|---|---|
| Tipos del modelo (EffectLayer/CardDepthLayer/TagStyle/Rarity) | `kromia-sdk/packages/core/src/types.ts` (579–693) |
| Lógica pura capas 3D + parallax | `kromia-sdk/packages/core/src/card-layers.ts` |
| Catálogo de efectos | `kromia-sdk/packages/core/src/registries/visual-effects.ts` |
| Serialización al .json (capa A) | `kromia-sdk/packages/core/src/generate.ts` (`serializeVisualEffect`) |
| Espejo Dart catálogo | `kromia-sdk/packages/core_dart/lib/src/visual_effects.dart` |
| Espejo Dart TagStyle (PARCIAL) | `kromia-sdk/packages/core_dart/lib/src/tag_styles.dart` |
| Espejo Dart rareza | `kromia-sdk/packages/core_dart/lib/src/rarity.dart` |
| Espejo Dart calibración | `kromia-sdk/packages/core_dart/lib/src/image_calibration.dart` |
| Render tilt 3D | `kromia-studio/src/components/album/visual-effects/HoloCard.tsx` |
| Render foil + máscara | `kromia-studio/src/components/album/visual-effects/FoilLayer.tsx` |
| Render capas 3D parallax | `kromia-studio/src/components/album/visual-effects/DepthLayerStack.tsx` |
| Render efectos catálogo | `kromia-studio/src/components/album/visual-effects/VisualEffectLayers.tsx` |
| Resolver efecto por carta | `kromia-studio/src/components/album/visual-effects/effect-resolve.ts` |
| Generación máscara contornos | `kromia-studio/src/lib/contour-mask.ts` |
| i18n blend/labels | `kromia-studio/src/components/album/visual-effects/effect-i18n.ts` |
| Modal efecto per-carta | `kromia-studio/src/components/album/CardFoilDialog.tsx` |
| Edición foil per-capa-3D | `kromia-studio/src/components/album/visual-effects/depth-foil-edit.ts` |
| Edición tagStyles / foil toda-la-carta | `kromia-studio/src/components/album/visual-effects/tag-styles-edit.ts` |</invoke>
