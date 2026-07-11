# Sistema de EFECTOS de Kromia — mapa cross-platform (SDK · Studio · Mobile)

> **Para el agente "Efectos"** (y cualquiera que toque efectos). Esta es la doc
> canónica de CÓMO funciona el sistema de efectos visuales de una carta, de punta a
> punta, en las 3 plataformas. Foco especial en el **iridiscente**. La regla de oro:
> **el modelo, la lógica y la RECETA de render viven en el SDK (`@kromia/core`); Studio
> (web) y Mobile (Flutter) son HOSTS que los ESPEJAN. Nunca dupliques; centraliza en el
> SDK y espeja en ambos.**

## 0. Qué es un "efecto" y cómo se aplica a una carta

- El publisher NO pinta efectos a mano por carta. Declara, a nivel de ÁLBUM
  (`albumSchema.tagStyles`), un mapeo **valor-de-campo → efecto**: p.ej.
  `{ fieldKey:'rareza', value:'Legendaria', effect:'iridescent_foil', config:{…} }`.
  Modelo: `TagStyle` (`@kromia/core/types.ts`).
- Al renderizar, cada host llama a **`resolveCardEffects(item, fieldDefs, tagStyles)`**
  (`@kromia/core/effect-resolve.ts`) → devuelve los `ResolvedEffect[]` que aplican
  (dedup + orden = z-order que controla el publisher). El host pinta esas capas.
- Un efecto es un **id del catálogo** (`visual-effects.ts`) **o** un **foil
  personalizado** (`custom_foil`, capas propias en `TagStyle.customLayers`).
- Plantillas reutilizables: `EffectTemplate` (`albumSchema.effectTemplates`) — guarda
  un efecto+config con nombre para reaplicarlo. `custom_foil` puede llevar `customLayers`.

## 1. El catálogo de efectos (`packages/core/src/registries/visual-effects.ts`)

`VisualEffectDefinition` = `{ id, displayName, description, layer, config[], whenToUse,
related, aliases }`. `layer` ∈ `overlay | badge | filter | border`. Los efectos:

| id | nombre | layer | qué es |
|---|---|---|---|
| `holographic_effect` | Holográfico | overlay | foil holográfico PRESET (cerrado) |
| **`iridescent_foil`** | **Iridiscente** | **overlay** | **foil arcoíris AJUSTABLE en vivo — el efecto estrella (§3)** |
| `crown_badge` | Insignia | badge | corona/badge sobre la carta |
| `vintage_filter` | Filtro vintage | filter | filtro de color envejecido |
| `glow_border` | Borde luminoso | border | halo/borde que reluce |
| `frozen` | Congelado | overlay | escarcha/hielo |
| `signed` | Firmada | overlay | firma del autor |

Más el **`custom_foil`** (§4), que NO es un id de catálogo: es una pila de capas
importada por el creador.

`config[]` = params del efecto (`VisualEffectConfigParam`): `{ key, label, type
('enum'|'number'|'string'), options?, min?, max?, default?, visibleWhen? }`.
`visibleWhen: { key, equals?|notEquals? }` = visibilidad EDITOR-ONLY (no entra al `.json`).
Validación: **`validateTagStyles`/`isTagStyleValid`** (`tag-styles.ts`) — el backend la
usa con el MISMO `@kromia/core` → paridad cliente↔servidor.

## 2. El CONTRATO (KRP) — qué bumpea versión y qué no ⚠️

- **`contracts/kromia-recipe-protocol-v1.json`** (KRP) = el modelo serializado + versionado
  (SemVer auto-bump en `generate.ts`). `protocolVersion` == `@kromia/core.version`.
- **Los `config[]` de un efecto SÍ van al `.json`** → añadir/cambiar un param **bumpea**
  el KRP (minor si aditivo). Corre `pnpm gen` en `packages/core` (regenera + auto-bumpea);
  `contract-drift.test.ts` sale ROJO si tocaste un registry y olvidaste `pnpm gen`.
- **La RECETA de render NO va al `.json`** (foil-recipe.ts, custom-foil-recipe.ts,
  border-svg.ts, effect-resolve.ts): es política de pintado → **DATA render-only**, no
  bumpea. Se acumula en el `CHANGELOG [Unreleased]` del SDK.
- **La doc** (whenToUse/description/aliases) se excluye del `.json` (`generate.ts`) → NO bumpea.
- Regla mental: **¿un renderer NECESITA este dato para pintar? → contrato. ¿Es CÓMO se
  pinta? → render-only.**

## 3. ⭐ EL IRIDISCENTE (`iridescent_foil`) — a fondo

El foil arcoíris ajustable en vivo. El que más se toca. Dos piezas: el **config**
(contrato) y la **receta de render** (`foil-recipe.ts`, DATA render-only).

### 3.1 Config (params del contrato, `visual-effects.ts:114-213`)

`pattern` (Paleta, enum: spectrum/oilslick/sunset/mint/aurora/midnight) · `pattern_hex`
(Paleta personalizada, 2–4 hex `#RRGGBB`, MANDA sobre pattern) · `angle` (Orientación
0–360°, giro sobre el ángulo nativo del patrón) · `hue` (Tono 0–360) · `opacity`
(Intensidad 0–100=95) · `glow` (Resplandor=35) · `sheen` (Reflejo=40) · `shimmer`
(Destello=50) · `noise` (Grano=16) · `brightness` (50–150=105) · `contrast` (50–150=100)
· `scale` (100–320=210) · `blend` (Fusión: color-dodge/overlay/screen/soft-light/hard-light)
· **`geometry`** (bandas|organico, default bandas) · **`warp`** (Ondulación 0–100=55,
`visibleWhen geometry=organico`) · marco: `border_style` (9 diseños) · `border_fill`
(hueco/borde/marco) · `border_width` · `border_margin` · `border_color` (enum de tonos)
· `border_color_hex` (MANDA sobre border_color).

### 3.2 Receta de render (`packages/core/src/foil-recipe.ts`, DATA)

- **`FOIL_PATTERNS`** = los 6 patterns como DATOS estructurados (stops + ángulo nativo),
  NO strings CSS: cada host construye su gradiente nativo (Studio CSS
  `repeating-linear`/`conic`; Flutter `LinearGradient`/`SweepGradient`) → color idéntico
  sin copiar strings. `foilPatternCss(pattern, rotate)` = builder WEB.
- **Paleta custom**: `parseFoilPatternHex(raw)` (2–4 hex) + `foilCustomPatternCss(colors, angle)`
  (ciclo 45% equiespaciado). Compartido cross-platform.
- **Orientación**: `foilPatternBaseAngle(pattern)` + `foilEffectiveAngle(pattern, rotate)`.
- **Geometría orgánica** (`geometry:'organico'`): `FOIL_ORGANIC_WARP` (baseFreq X/Y,
  octaves, seed, maxDisplacement, overscan) + `foilWarpDisplacement(warp)`. Las bandas
  rectas se curvan por RUIDO FRACTAL (difracción tipo lámina holográfica real, ref. ISKRA).
  **Studio**: filtro SVG `feTurbulence`+`feDisplacementMap` sobre foil+sheen. **Flutter**:
  fbm en el fragment shader (`foil_warp.frag`). ⚠️ El ruido difiere (Perlin-SVG vs fbm) →
  NO bit-idéntico; converge en carácter. Spec: **`docs/iridescent-foil-render-spec.md`**.
- **Marco/tintes**: `borderSVG(...)` (`border-svg.ts`, 9 diseños) + `FOIL_BORDER_SOLID` /
  `FOIL_CARD_BG` / `foilCardBgCss`.
- **Presets de fábrica**: `EFFECT_FACTORY_PRESETS` (chips 1-clic del editor). `holographicOpacity`.

### 3.3 Orden de capas (canónico, ambos hosts)

`foil` → `sheen` (screen) → `glare` (soft-light) → `noise` (overlay) → `borde`. El `blend`
de la capa foil = `config.blend` (default color-dodge, que **preserva el negro** → el arte
oscuro sobrevive bajo el brillo). **Compositing crítico (aprendido en KRO-224):** el blend
debe componer CONTRA EL ARTE, no contra el fondo de la celda → en Flutter = ShaderMask con
el arte como sampler (si no, LAVA a blanco). Detalle: `iridescent-foil-render-spec.md`.

## 4. Foil PERSONALIZADO (`custom_foil`) — pila de capas

El creador aporta una PILA DE CAPAS (`TagStyle.customLayers: EffectLayer[]`). Cada
`EffectLayer` = `{ kind (foil|glitter|pattern), textureUrl, maskUrl?, blend
(EffectBlendMode), intensity?, motion? }`. Receta: **`packages/core/src/custom-foil-recipe.ts`**:
`EFFECT_LAYER_KINDS`, `EFFECT_BLEND_MODES` (5 fusiones == CSS mix-blend-mode),
`CUSTOM_FOIL_LAYER_DEFAULTS` (blend color-dodge, intensity 0.6), `foilLayerOpacity`,
`foilTextureLayout(kind)` (pattern=tesela 160% · foil/glitter=lámina 250%×100%),
**`CUSTOM_FOIL_MASK`** (máscara por **LUMINANCIA** no alfa, cover/center),
`CUSTOM_FOIL_TILT`, `CUSTOM_FOIL_SHIMMER`, **`EFFECT_BLEND_TO_FLUTTER`** (mapeo fusión→BlendMode).
Spec: **`docs/custom-foil-render-spec.md`**. Resolución: `resolveCardEffects` marca
`customLayers` en el `ResolvedEffect`.

## 5. Capas 3D / profundidad / holográfico (KRO-130)

`CardDepthLayer` (`types.ts`): la ilustración se descompone en cutouts a distinta
profundidad (back/mid/front) → parallax 3D al inclinar. Cada capa puede llevar su propio
`foil` (`EffectLayer`). `CardEffect3D` = pila de capas + `depth`. Spec:
**`docs/holographic-3d-foil-spec.md`**.

## 6. Mapa de FICHEROS por plataforma

### SDK — `@kromia/core` (fuente única, TS canónico) · `packages/core/src/`
- `registries/visual-effects.ts` — catálogo + config (CONTRATO).
- `foil-recipe.ts` — receta del iridiscente (DATA). · `custom-foil-recipe.ts` — receta del custom foil (DATA).
- `effect-resolve.ts` — `resolveCardEffects`/`cardTagValues`/`ResolvedEffect`. · `border-svg.ts` — marcos.
- `tag-styles.ts` — `validateTagStyles`/`isTagStyleValid`. · `types.ts` — `TagStyle`/`EffectLayer`/`EffectTemplate`/`CardEffect3D`/`CardDepthLayer`.
- `contracts/kromia-recipe-protocol-v1.json` + `generate.ts` (auto-bump). `@kromia/react` = renderers web reusables.

### Studio (web, React/Next) · `kromia-studio/src/components/album/visual-effects/`
- `VisualEffectLayers.tsx` — renderer de capas (IridescentFoil, CustomFoilLayers…). · `FoilLayer.tsx` — 1 capa foil (consume la receta del SDK).
- `HoloCard.tsx` — carta 3D (tilt). · `DepthLayerStack.tsx` — capas de profundidad.
- `TagStylesEditor.tsx` — editor efecto-por-valor (+ CustomFoilEditor, presets, número editable). · `effect-i18n.ts` — labels/hints (fusión, geometría…).
- `BorderStylePicker.tsx`, `VisualEffectPreviewMockup.tsx`, `CustomFoilHelpCarousel.tsx`, `CardFoilDialog.tsx`. · `effect-resolve.ts`/`border-svg.ts` re-exportan del SDK.

### Backend · `Kromia_NodeJS` — consume `@kromia/core` para **validar** `tagStyles` (mismo submódulo → cero drift). Al tocar el SDK, re-linkear también el backend.

### Mobile (Flutter) · `kromia-mobile` — **⚠️ SECCIÓN A COMPLETAR POR EL CHAT DE MOBILE.**
Espejo Dart en el propio repo del SDK: `packages/core_dart/lib/src/` (`foil_recipe.dart`,
`custom_foil_recipe.dart`, `extract_accent.dart`, `classify.dart`, `format_scalar.dart`,
`composition.dart`, `visual_effects.dart`) + `packages/flutter/lib/src/` (render:
`layout_renderer.dart`, shaders `foil_warp.frag`/`foil_mask.frag`, `component_content.dart`).
La app: `kromia-mobile`. **El chat de mobile debe rellenar aquí los ficheros exactos + su
pipeline de render (ShaderMask, giroscopio, etc.).**

## 7. La DISCIPLINA anti-drift (imprescindible) — ver el playbook

**Todo cambio de efecto se espeja en Studio Y Mobile vía el SDK.** El flujo canónico está
en **`kromia-sdk/playbooks/mirror-effect.md`**. Resumen:
1. **SDK primero**: el dato/receta va a `@kromia/core` (`pnpm gen` si tocaste `config[]`).
2. **Studio** consume la receta (no hardcodear; refactorizar a consumir el SDK).
3. **Mobile** la espeja en `core_dart` + su render (lo hace el chat de mobile).
4. **Handoff + paridad**: `COORDINATION.md` + issue `Drift Sync` en Jira + spec en `docs/`.
5. **Verificar** en vivo en ambos (Studio corriendo + build de la app).

Lecciones caras ya aprendidas (no repetir): la receta hardcodeada en Studio = drift
(pasó con el warp orgánico y el custom foil → se movió a DATA en el SDK); el blend que
compone contra el fondo = lavado (ShaderMask contra el arte); la máscara por alfa en vez
de luminancia = tapa el arte; el ruido fbm≠Perlin = apunta al look, no al píxel.

## 8. Coordinación cross-chat

Reparto + canal + cola de handoffs → **`kromia-sdk/COORDINATION.md`**. Specs cross-platform
→ **`kromia-sdk/docs/*.md`** (las 3 de foil ya existen). Paridad en Jira = status `Drift Sync`
(proyecto KRO). El chat de mobile edita `core_dart`/`kromia_flutter`/la app; Studio edita
`@kromia/core`/`@kromia/react`/Studio/backend. **Nadie edita los ficheros del otro**; los
cambios de contrato los hace Studio en el SDK (+ bump) y mobile los espeja.
