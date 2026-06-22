# HANDOFF · KRO-198 — Paridad Flutter: `hiddenSlots` + `CardSchema.detailComposition` (Drift Sync)

**Para:** chat Flutter (`core_dart` + `kromia_flutter`)
**De:** chat SDK-TS / Studio
**Tipo:** Drift Sync · **render-only** (NO bumpea `PROTOCOL_VERSION`, contract-drift debe quedar VERDE)
**Fuente canónica TS:** `packages/react/src/recipes/RecipeRenderer.tsx` + `HeroHeader.tsx`

---

## TL;DR

Ya shipeado en TS:
1. `RecipeRenderer` acepta `hiddenSlots?: string[]` → (a) **strip** de esos slot ids de `composition.slots` antes de despachar y (b) **reenvío** del array a `HeroProtagonicoRecipe → HeroHeader`, que con esos ids **no pinta ni el slot ni su placeholder** (banner degradado / avatar con inicial).
2. `CardSchema.detailComposition` (`ViewComposition` opcional, **render-only**, validada con `validateComposition` contra `cardFields`) ya persiste en backend.
3. En Studio, el panel "Detalles" del modo focus renderiza esa composición con `hiddenSlots = [slots de imagen del recipe] + 'title'` → panel "solo datos" (la imagen ya es la HoloCard 3D, el título ya está en la cabecera de la hoja).
4. **NUEVO (5410852)** — el detalle se construye en el **lienzo** (árbol `layout`). Para que siga siendo "solo datos" con layout-tree, `LayoutRenderer` también acepta `hiddenSlots` y oculta los roles del `hero_header` cuyo slotId esté en la lista. La decisión vive en core: **`computeHiddenHeroRoles(roles, nodeHidden, nodeSlots, hiddenSlots)`** (pura) → ver §7.
5. **NUEVO (53808fb)** — render por **behavior** completo: currency/measurement con `behaviorConfig`, `html` seguro (`parseInlineHtml`, allowlist), code/url/email/phone/tags/url_list/email_list → ver §8.
6. **NUEVO 2026-06-22 (§10)** — 4 puntos de render más (todos meta, render-only): `conditionalStyle` (estilo por valor, integrar en `resolveSlot`), chips/tabla/stats **temables**, paridad del **badge** (opacity/shadow + color dinámico), y el contenedor raíz del **detalle llena la pantalla**. Acabados (THEME_PRESETS) y contraste = **solo-edición, Flutter los ignora**.
7. **NUEVO 2026-06-22 (§11)** — decoración: el **wrapper raíz** sigue el radius del surface (4 esquinas), la **caja de imagen** toma `appearance.bgColor`, y nuevo `ContainerSurface.cornerRadii` (radio por esquina, render-only).
8. **NUEVO 2026-06-22 (§12)** — la **raya de acento ya no aplana** las esquinas de su lado (se curva con el radius → 4 esquinas uniformes), y nuevo `screenBgHex(bgColor)`: la **pantalla** (lista/detalle) toma el acabado un punto más oscuro que las cartas → éstas resaltan por elevación.

Flutter debe replicar **exactamente** esta semántica en su renderer Dart.

---

## 0. Modelo de autoría: **BASADO EN CAMPOS** (actualización 2026-06-22)

> **Lee esto primero.** El detalle evolucionó de "elegir una receta con roles
> abstractos" a un modelo **basado en campos**. Esto **NO cambia el trabajo de
> Flutter** (sigues renderizando `detailComposition.layout` + `slots` con
> `hiddenSlots`), pero sí cambia **qué SON los slots** — para que no te confunda
> ver ids que no son `banner`/`avatar`/`title` sino claves de campo.

Qué cambió en la autoría (Studio, canónico):

- **Un slot por CAMPO, no por rol.** El `slot.id` de una `detailComposition` es la
  **clave de un campo** de la carta (`numero`, `nombre`, `arte`, `descubierta`…),
  no un rol de receta. `slot.fields = [esa misma clave]`.
- **Receta portadora `detail_profile`.** La composición declara `recipe:
  'detail_profile'` solo para pasar la validación del SDK; el render usa el árbol
  **`layout`**, no los roles de esa receta. Slots con id de campo que no están en
  el manifest de `detail_profile` son **WARN, no ERROR** en `validateComposition`
  (backend solo bloquea errores) → la composición valida igual.
- **Plantillas = pilas de campos.** Las plantillas pre-diseñadas (Lista,
  Destacado, Reportaje, Efeméride) las construye Studio clasificando los campos por
  tipo y arreglándolos en un `layout` (título destacado, fila de stats, cuerpo…).
  Son **layouts de campos ya armados**, no recetas con roles. Flutter **no** las
  conoce ni las necesita — solo consume el `detailComposition` resultante.
- **`hero_header` casi nunca aparece** en una `detailComposition` por campos (las
  plantillas son grids planos de campos). El gating de §7 (`computeHiddenHeroRoles`)
  sigue siendo **obligatorio espejarlo** por robustez: el publisher *puede* insertar
  un componente hero a mano vía INSERTAR, y si lo hace debe ocultarse igual.

Implicación para `hiddenSlots` (§2/§3): el conjunto a ocultar son las **claves de
campo de tipo imagen** (`arte`, …) **+ la clave del campo título** (el `text`/PK
que actúa de nombre), no roles. Studio lo deriva con `detailHiddenSlots(recipe)` en
`detail-slots.ts` (ver referencias al final). El mecanismo de ocultado es idéntico
al descrito abajo.

**Resumen normativo:** el contrato de render Flutter es el MISMO; solo cambia la
naturaleza de los ids de slot (claves de campo). Renderiza `layout` + `slots`,
aplica `hiddenSlots`, formatea por behavior. No hay nada nuevo que persistir.

---

## 1. Renderer Dart — añadir `hiddenSlots`

Añadir un parámetro opcional `List<String> hiddenSlots = const []` al entry-point del renderer (equivalente Dart de `RecipeRenderer`).

**Regla A — strip ANTES de despachar (todas las recetas):**
Si `hiddenSlots` no está vacío, filtra `composition.slots` quitando las entradas cuyo id esté en `hiddenSlots`, y despacha con esa composición filtrada.

```
final filtered = hiddenSlots.isEmpty
    ? composition
    : composition.copyWith(
        slots: { for (final e in composition.slots.entries)
                   if (!hiddenSlots.contains(e.key)) e.key: e.value },
      );
```

- Recetas como `editorial` / `momento` (y las block-native vía `LayoutRenderer`/`recipeToComposition`) **omiten su imagen al faltar el slot, sin placeholder** → para ellas el strip basta.
- **Importante (paridad de referencia):** sin `hiddenSlots` (ausente/vacío) debe devolverse **la misma composición sin clonar** → cero cambio de comportamiento. No reconstruyas el mapa siempre.

**Regla B — reenvío a la cabecera de imagen (`hero_protagonico`):**
`hero_protagonico` cae a un **banner degradado** y a un **avatar con la inicial del título** cuando no hay slot. Por eso el strip NO basta: hay que **reenviar `hiddenSlots`** a `HeroProtagonicoRecipe → HeroHeader` para que tampoco pinte esos placeholders.

Semántica exacta de `HeroHeader` (a replicar en el `HeroHeader` Dart):
- `isHidden(id) = hiddenSlots.contains(id)`.
- `banner` oculto → no pinta ni la imagen ni el `GradientBanner` fallback **y** se omite el solape (`-mt-12`): sin banner no hay nada que solapar.
- `avatar` oculto → no pinta el avatar (ni el círculo con inicial del título).
- `subtitle` oculto → no pinta el subtítulo.
- `title`: la cabecera lo gobierna por `hiddenSlots` igual que el resto **pero** en Studio el panel de detalle lo oculta vía el strip de `slots` (no hace falta caso especial en el header; con el slot fuera del mapa, `resolveSlot('title')` no resuelve).

> Pasa `composition` **filtrada** a las recetas Y además `hiddenSlots` a las que tienen cabecera de imagen (hero). Las que solo leen `slots` (editorial/momento/compact/row/accordion) reciben únicamente la composición filtrada.

---

## 2. Consumir `CardSchema.detailComposition` en el detalle de carta

- `CardSchema.detailComposition` es un `ViewComposition` **opcional** y **render-only** (no afecta a la edición ni al contrato de datos). Ya viene en el payload del schema desde backend.
- Validación: backend ya la valida con `validateComposition` contra `cardFields`. Flutter **no** revalida estructura; solo la renderiza si está presente. Si es `null`/ausente → no renderizar panel de detalle de datos (sin fallback inventado).
- En la pantalla de **detalle de carta** (la HoloCard 3D abierta), renderiza `detailComposition` con el renderer Dart pasándole:

```
hiddenSlots = [ ...<ids de slots de imagen del recipe>, 'title' ]
```

donde, en el modelo **basado en campos** (§0), "slots a ocultar" = las **claves de los campos de tipo imagen** (`type: image` / `array<image>`) **+** la **clave del campo título** (el campo de texto que actúa de nombre de la carta). Deriva ese conjunto igual que hace Studio (`detailHiddenSlots(recipe)` en `src/components/album/recipes/detail-slots.ts`); **no lo hardcodees** a `'banner'`/`'avatar'`/`'title'`: dependen de la estructura de la carta, no de la receta.

Racional: la imagen ya la muestra la HoloCard 3D y el título ya está en la cabecera de la hoja de detalle → el panel debe ser **"solo datos"**, sin duplicar imagen ni título.

---

## 3. Regla "solo datos" (resumen normativo)

En el panel/sheet de detalle de carta:
- Oculta SIEMPRE: todos los slots de imagen del recipe **+** `'title'`.
- El resto de slots (campos de texto/escalares/related) se renderizan normal.
- Ningún placeholder de imagen debe aparecer (ni banner degradado, ni avatar-inicial): por eso el reenvío de `hiddenSlots` a la cabecera es obligatorio, no opcional.

---

## 4. Drift / contrato

- **NO** se añade ni cambia ningún campo del KRP serializado: `hiddenSlots` es un parámetro **de render del host**, no se persiste en la `ViewComposition`. `detailComposition` ya estaba contemplado en el schema TS y persiste igual.
- Por tanto: **NO bumpear `PROTOCOL_VERSION`**, y el test de **contract-drift debe permanecer VERDE** tras estos cambios en Dart.
- Paridad esperada: dado el mismo `ViewComposition` + `item` + `fieldDefs` + el mismo `hiddenSlots`, el árbol renderizado (qué slots aparecen y la ausencia de placeholders en la cabecera) debe coincidir 1:1 con la salida TS.

---

## 5. Checklist de aceptación Flutter

- [ ] Renderer Dart acepta `hiddenSlots` (default vacío) y hace strip de `slots` antes de despachar.
- [ ] `hiddenSlots` vacío/ausente ⇒ misma composición (sin reconstruir el mapa), comportamiento idéntico al actual.
- [ ] `HeroHeader` Dart respeta `isHidden` para `banner` (incl. quitar el solape `-mt-12`), `avatar`, `subtitle`; sin pintar placeholders.
- [ ] Detalle de carta consume `CardSchema.detailComposition` (si existe) con `hiddenSlots = [slots de imagen del recipe] + 'title'`.
- [ ] `detailComposition` ausente ⇒ no se renderiza panel de datos (sin fallback).
- [ ] `PROTOCOL_VERSION` sin tocar; contract-drift verde.

---

## 7. LayoutRenderer (árbol `layout`) — `hiddenSlots` + `computeHiddenHeroRoles`

El detalle de carta se diseña en el **lienzo** → la composición trae un árbol `layout`
y se renderiza por el motor genérico (`LayoutRenderer`), no por el componente de receta.
El strip de `slots` (§1.A) ya hace que las hojas-slot ocultas resuelvan a nada. **Pero**
el componente prefab `hero_header` reconstruye sus slots desde `node.slots` (mapeo
rol→slotId) y, si falta el slot, pinta el placeholder degradado → hay que cruzarlo con
los `hiddenSlots` globales.

Regla canónica (core, **pura, ya en TS — espejar en Dart**):

```
// computeHiddenHeroRoles(roles, nodeHidden, nodeSlots, hiddenSlots) -> List<String>
// Un rol se oculta si: lo marcó el publisher (nodeHidden) O su slotId
// (nodeSlots[role]) está en los hiddenSlots globales.
Set<String> out = { ...(nodeHidden ?? []) };
for (final role in roles) {                 // roles = [banner, avatar, title, subtitle]
  final sid = nodeSlots?[role];
  if (sid != null && hiddenSlots.contains(sid)) out.add(role);
}
return out.toList();
```

En el `LayoutRenderer` Dart, al pintar un `hero_header`:
- `hiddenRoles = computeHiddenHeroRoles([banner,avatar,title,subtitle], node.hidden, node.slots, hiddenSlots)`.
- NO añadir a `heroSlots` los roles en `hiddenRoles`.
- Pasar `hiddenRoles` como `hiddenSlots` del `HeroHeader` (para que tampoco pinte placeholder).
- `RecipeRenderer` Dart debe **reenviar `hiddenSlots` al `LayoutRenderer`** (ruta layout + default), igual que en TS.

---

## 8. Render por **behavior** del valor de un slot

Cierra los behaviors que caían a texto plano. **Formateo** en core (espejar en `core_dart`),
**presentación** en cada cliente.

**core (`format-scalar` + `html-inline`):**
- `currency` (number): símbolo por `behaviorConfig.currency` (ISO: EUR/USD/GBP/JPY/…; JPY/KRW sin decimales; código desconocido → se usa el propio código). Símbolo SIEMPRE tras el número (es-ES). Default EUR.
- `measurement` (number): unidad por `behaviorConfig.unit` (`"12.5 cm"`); sin unidad → número plano.
- `parseInlineHtml(html)` (behavior `html`): tokeniza un **allowlist** (b/strong, i/em, code, a[href], br, p/li) a los MISMOS `MarkdownToken` que markdown. **Seguro por construcción**: href sanitizado (solo http/https/mailto/tel), entidades decodificadas como texto, tags fuera de la allowlist eliminados, `<script>`/`onerror` fuera. **NUNCA** innerHTML/DOMPurify. Dart: replicar el allowlist + render por tokens (`TextSpan`).

**presentación (cada cliente):**
- `code`: monoespaciado con fondo sutil.
- `url`/`email`/`phone`: enlace navegable con href saneado (`url` sin esquema → `https://`; `email`→`mailto:`; `phone`→`tel:`).
- `tags` (array): chips.
- `url_list`/`email_list` (array): un enlace navegable por elemento (NO el JSON crudo del array).
- markdown: links **inertes** (no navegables) en el preview; html: links **clicables**.

### 8.1 — `SlotComposition.composableDisplay` (NUEVO, `8e8e700`)

Variante de RENDER de un slot COMPOSABLE (cómo se disponen sus varios fields/
valores), elegible por el publisher. **Meta de composición** (como
orientation/separator) → NO entra al contrato KRP, NO bumpea PROTOCOL_VERSION.
Catálogo es-ES en `OPTIONS_COMPOSABLE_DISPLAY` (core/options.ts). **Espejar el
campo en `core_dart` + las 5 ramas en el ComposableSlot de Flutter:**

- `'auto'` (default, y compositions históricas sin el campo): comportamiento
  histórico por behavior — tags→chips, url_list/email_list→enlaces, resto = join
  por `separator` respetando `orientation`. **Backward-compatible: cero drift.**
- `'inline'`: todos los valores en una línea, unidos por `separator`.
- `'list'`: un valor por línea (apilados).
- `'chips'`: cada valor como pastilla/badge.
- `'table'`: filas etiqueta–valor (usa la etiqueta de cada field;
  array-de-un-field sin etiquetas → cae a `list`).
- `'stats'` (**NUEVO `da0007f`**): fila de estadísticas — cada field = VALOR
  grande (números tabulares) + ETIQUETA debajo en mayúsculas, en columnas iguales
  con borde superior/inferior. Replica el componente `stats_row`. Sin etiquetas
  (array-de-un-field) → cae a `chips`. **Importante:** al *descomponer* el
  componente `stats_row` en bloques, Studio auto-setea `composableDisplay:'stats'`
  en el slot resultante para no perder el estilo.

> **Colores TEMABLES (NUEVO `a99f11d`):** en `chips`, `table` y `stats` el color de
> cada pastilla/valor/etiqueta se deriva ahora de la appearance del slot
> (`paletteClass(bgColor,'bg')`/`textColor` con fallback muted), NO hardcodeado. En
> chips el fondo va EN las pastillas (wrapper a transparente). Espéjalo: tus
> chips/tabla/stats deben tomar el color de la appearance.

Ref TS: `packages/react/src/recipe-utils.tsx` `ComposableSlot` (rama
`display !== 'auto'`) + `resolveSlot` (`composableDisplay: sc.composableDisplay ??
'auto'`). Validación: `validate.ts` (junto a `orientation`).

---

## 9. Follow-ups conocidos (NO bloquean)

- ~~Layout-tree explícito → reenviar hiddenSlots al LayoutRenderer~~ **RESUELTO** (§7, `5410852`).
- **Editor de lienzo (canvas DnD)**: en Studio el publisher elige una plantilla
  **basada en campos** (un bloque por campo, sembrada como `layout`) y la edita en el
  `LayoutEditor` — incluida la apariencia por campo (tipografía/color/recorte…). En el
  detalle se ocultan los controles que vuelven al modelo por-roles ("Plantillas",
  "Volver a la receta"). Flutter es **renderer puro**: consume el `detailComposition`
  resultante (con su `layout` + `slots` + `appearance`) — no necesita editor.
- `<u>` (underline) en `html`: no soportado en V1 (su contenido cae a texto).

---

## 10. Cambios 2026-06-22 — más render que espejar (KRO-198 cont.)

Cuatro puntos de RENDER nuevos (todos **meta / render-only**, NO bumpean
`PROTOCOL_VERSION`; contract-drift VERDE). Commits SDK: `a99f11d`, `581ff9d`,
`5bebd85`, `f00d55d`. **Antes de tocar el detalle: el detalle se construye con el
MISMO motor que las SECCIONES** (misma `SlotComposition` + `LayoutRenderer` +
recetas + `resolveSlot`). Investiga cómo tienes montado el render de SECCIONES en
`core_dart` y reutilízalo — no es un sistema nuevo.

### 10.1 — `SlotComposition.conditionalStyle` (estilo por valor) · `5bebd85`

NUEVO campo opcional en `SlotComposition`. Modelo:

```
ConditionalStyle { fieldKey: String, cases: List<ConditionalStyleCase> }
ConditionalStyleCase { op?: String, value?: String, appearance?: SlotAppearance }
// op ∈ eq|neq|contains|gt|gte|lt|lte|truthy|falsy  (default 'eq')
```

Semántica: "la apariencia del slot cambia según el valor de un campo del dato"
(color por rareza, rojo si stock 0…). El **PRIMER caso que matchea gana**; su
`appearance` se **MERGE-a sobre la base** (`slot.appearance`). Sin match / sin
item → base intacta. Comparación de texto case-insensitive + trim; gt/gte/lt/lte
numéricas; truthy/falsy ignoran `value`.

Espejo TS puro en `packages/core/src/conditional-style.ts`:
`matchConditionalCase(case, raw)` + `resolveConditionalAppearance(cond, base, item)`.
**Punto de integración: `resolveSlot`** (donde resuelves la appearance efectiva del
slot) — TS hace `appearance: resolveConditionalAppearance(sc.conditionalStyle,
sc.appearance, item)` y TODOS los renders (SlotContent/LayoutRenderer,
ComposableSlot, recetas) heredan. Hazlo en el mismo sitio en Dart → un solo cambio.
Validación estructural en `validate.ts` (ops + appearance de cada caso).

### 10.2 — chips/tabla/stats TEMABLES · `a99f11d`

Ver el blockquote de §8.1: deriva el color de los elementos internos de la
appearance del slot, no fijo. (Antes hardcodeaban `text-muted-foreground`/`bg-muted`).

### 10.3 — Paridad del BADGE · `a99f11d`

Un slot mostrado como badge (`appearance.display == 'badge'`) debe honrar
**opacity/shadow** (effect classes) **+ color DINÁMICO** (color_hex por campo →
estilo inline), igual que el render del motor de bloques (`SlotContent`). En TS lo
arreglé en `CompactCardRecipe` (su pill no recibía esas clases). Revisa tu receta
lista equivalente en Dart: el badge debe pasar las mismas clases/estilo que el
contenido de un slot badge del LayoutRenderer.

### 10.4 — El contenedor raíz del DETALLE llena la pantalla · `f00d55d` + `19e7ce2`

Un detalle es **pantalla completa**: su contenedor raíz debe **estirarse a la
altura disponible**, no quedar a altura-contenido dejando un hueco vacío bajo el
fondo/decoración. En TS (`LayoutRenderer`): cuando `kind == 'detail'`, el wrapper es
`flex flex-col min-h-full` y el contenedor RAÍZ recibe `grow shrink-0`
(= `flex: 1 0 auto`: crece para llenar, **nunca encoge bajo su contenido** → texto
largo scrollea). El host (pantalla) ya da la altura definida. En Flutter: el body
del Scaffold del detalle debe dar altura completa y la composición raíz llenarla
(`Expanded`/`double.infinity` + el fondo/decoración cubre todo). Solo aplica a
`kind == 'detail'`; las listas no cambian.

**Importante — empacar arriba (`19e7ce2`):** al llenar, la raíz (grid) recibe
también `content-start` (`align-content: start`). En CSS grid, `align-content:
normal` se comporta como **stretch** → sin esto, las filas `auto` se ESTIRAN al
tener un box alto y el contenido queda con huecos enormes. Con start, las filas
quedan a altura-contenido **empacadas ARRIBA** y el sobrante (fondo) llena ABAJO.
En Flutter: al expandir el contenedor de detalle, **alinea los hijos al inicio**
(`MainAxisAlignment.start` / no `spaceBetween`/`stretch` de las filas), o tendrás
el mismo bug de huecos. (El host además puede ir **a sangre** bajo una barra de
nav flotante translúcida — eso es decisión de pantalla de cada cliente, no del
motor: Studio quita el `padding-bottom` reservado en el detalle.)

### 10.5 — SOLO-EDICIÓN (Studio): el renderer Dart NO necesita nada

- **Acabados / `THEME_PRESETS`** (`581ff9d`): `applyThemePreset(composition, id)`
  transforma la composición **en EDICIÓN** → produce `appearance`/`surface`
  NORMAL (recolor coordinado y legible). El renderer solo ve el resultado, que ya
  pinta. Como el editor de layout vive solo en Studio (Flutter = renderer puro),
  **no hay mirror necesario**. Si algún día Flutter edita, espejaría el catálogo.
- **Contraste WCAG** (`paletteContrastRatio`/`contrastLevel` + aviso) y
  **validación de `textShadow`/`display`/`textTransform`**: a11y y validación del
  EDITOR. El render no cambia (Flutter ya pinta `textShadow`).

---

## 11. Cambios 2026-06-22 (cont.) — decoración: esquinas + acabado de imagen

Tres puntos de RENDER más (meta/render-only, NO bumpean PROTOCOL_VERSION;
`cornerRadii` NO entra en `ALL_SURFACE_PROPS`). Commits SDK: `b5ecf71`, `74e36ce`,
`c4219cb`.

### 11.1 — El WRAPPER raíz sigue el radius del surface · `b5ecf71`
El `surface.radius` se aplicaba al grid interno, pero el contenedor que RECORTA
(overflow-hidden, cuyas esquinas se ven) era siempre `rounded-lg`. Como el
AccentFrame solo aplana el lado del acento, el opuesto se quedaba redondo →
'Rectas'/none no llegaba a esas esquinas. Ahora el wrapper raíz toma
`radiusClasses(root.surface)` (respeta radiusCorners/cornerRadii) en las 4
esquinas; sin surface-radius, el default. **En Flutter: aplica el radius del
surface al ClipRRect/Container raíz que recorta, no solo al hijo interno.**

### 11.2 — La caja de IMAGEN toma `appearance.bgColor` · `74e36ce`
`ThumbBox` (caja de imagen/placeholder) usaba `bg-muted` fijo → con un acabado
oscuro dejaba un cuadro claro. Ahora el fondo de la caja sigue
`appearance.bgColor` si está fijado (fallback bg-muted). **Flutter: la caja de
imagen usa el bgColor del slot como fondo del placeholder.** (`applyThemePreset`
fija ese bgColor al papel en los slots de imagen, pero eso es EDIT-only Studio —
Flutter solo ve el resultado.)

### 11.3 — `ContainerSurface.cornerRadii` (radio POR ESQUINA) · `c4219cb`
NUEVO campo opcional `cornerRadii?: { tl?, tr?, bl?, br?: 'none'|'sm'|'md'|'lg'|
'xl'|'full' }`. Cada esquina su propio tamaño; PREVALECE sobre `radius`/
`radiusCorners`; esquinas ausentes = 'none'. **Render-only meta** (NO en
`ALL_SURFACE_PROPS` → contract-drift verde, sin bump). Espeja el campo en
`ContainerSurface` de `core_dart` y aplícalo per-corner en el ClipRRect
(`BorderRadius.only(topLeft, topRight, bottomLeft, bottomRight)`). Ref:
`LayoutRenderer.radiusClasses` (rama `cornerRadii` con precedencia).

---

## 12. Cambios 2026-06-22 (cont.) — esquinas uniformes + fondo de pantalla

Dos puntos de RENDER más (meta/render-only, NO bumpean PROTOCOL_VERSION). Commits
SDK: `5ac8e7f` (esquinas), `163f011` (screenBgHex).

### 12.1 — La raya de acento ya NO aplana las esquinas · `5ac8e7f`
`buildAccentBorderStyle` forzaba `borderRadius: 0` en las dos esquinas del lado del
acento ("ticket con cinta") → con el wrapper ya redondeado (§11.1) el lado del
acento (p.ej. top) quedaba RECTO y el opuesto (bottom) REDONDO = esquinas
asimétricas que el publisher percibía como bug. Ahora `buildAccentBorderStyle` solo
aplica el `box-shadow inset` de la raya (que se CURVA con el radius del wrapper) y
NO toca el border-radius → las 4 esquinas siguen el radius uniformemente.
**En Flutter: la raya/borde de acento NO debe aplanar la esquina de su lado; píntala
como una franja que sigue el ClipRRect (inset), no como un borde recto que corta el
redondeo.** Ref: `recipe-utils.buildAccentBorderStyle` (4 ramas top/bottom/left/right,
ya sin overrides de `border*Radius`).

### 12.2 — Fondo de PANTALLA derivado del papel: `screenBgHex` · `163f011`
NUEVO helper `screenBgHex(bgColor): string|null` en `packages/core/src/palette.ts`.
El acabado teñía las CARTAS pero la PANTALLA (lista de sección / detalle) seguía con
el fondo de app → un álbum oscuro dejaba las cartas oscuras sobre un fondo crema.
Ahora la pantalla toma el color del acabado pero un punto MÁS OSCURO que el papel de
las cartas (mezcla el papel 18% hacia negro) → las cartas RESALTAN por elevación.
`screenBgHex` devuelve `null` para tokens de tema (la pantalla conserva el fondo de
app). Es **pura, render-only, fuera del contrato** (no en el `.json`).
**En Flutter: el fondo de la pantalla que aloja la lista de una sección (y el detalle)
= `screenBgHex(composition.layout.surface.bgColor)`; si null, fondo de app. La carta
conserva su `surface.bgColor` pleno → contraste de elevación idéntico al preview de
Studio.** Mismo factor (0.82) para que el resultado coincida pixel a pixel.
Studio lo aplica en `SectionAppPreview` (body del `PhoneFrame`) y en el backdrop del
lienzo de `LayoutEditor`; Flutter lo aplica en el Scaffold/host de la pantalla real.

---

**Referencias de lectura obligada (TS canónico):**
- `packages/react/src/recipes/RecipeRenderer.tsx` (props `hiddenSlots`, `filteredComposition`, reenvío a hero + LayoutRenderer).
- `packages/react/src/recipes/LayoutRenderer.tsx` (caso `hero_header`, `computeHiddenHeroRoles`).
- `packages/react/src/recipes/HeroHeader.tsx` (`isHidden`, gating banner/avatar/subtitle, `-mt-12` condicional).
- `packages/core/src/layout.ts` (`computeHiddenHeroRoles`), `format-scalar.ts`, `html-inline.ts`.
- `packages/react/src/recipe-utils.tsx` (`ScalarText`/`ComposableSlot`/`HtmlText`/`renderInlineToken`).
- Studio: `src/components/album/recipes/detail-slots.ts` (`detailHiddenSlots`, `imageSlotIds` — fuente única de qué ocultar) · `CardFocusOverlay.tsx` (lo consume) · `detail-templates.ts` (plantillas basadas en campos) · `DetailCompositionEditor.tsx` (selector + lienzo del detalle).
