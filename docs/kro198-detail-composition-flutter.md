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

Flutter debe replicar **exactamente** esta semántica en su renderer Dart.

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

donde "slots de imagen del recipe" = los slot ids del recipe cuyos `accepts` son todos de imagen (`image` / `image-array` / aliases `image-avatar|banner|cover`). Deriva ese conjunto del recipe igual que hace Studio (`detailHiddenSlots` en `CardFocusOverlay.tsx`); **no lo hardcodees** a `'banner'`/`'avatar'`: depende del recipe. El `'title'` se añade siempre.

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

## 6. Follow-ups conocidos (V2, NO bloquean V1)

- **Layout-tree explícito**: si en el futuro se persiste un `detailComposition` con árbol `layout` (diseño por bloques), el strip de `slots` no quita la imagen del árbol → habría que reenviar `hiddenSlots` también al `LayoutRenderer` o hacer el strip layout-aware. En V1 NO se alcanza: el editor solo emite `buildAutoDetailComposition` (sin `layout`).
- **Fine-tuning por slot**: V1 del editor solo elige la receta (auto-mapeo de slots). El editor de slots completo del detalle llegará reutilizando `ViewCompositionEditor`.

---

**Referencias de lectura obligada (TS canónico):**
- `packages/react/src/recipes/RecipeRenderer.tsx` (props `hiddenSlots`, bloque `filteredComposition`, reenvío a hero).
- `packages/react/src/recipes/HeroHeader.tsx` (`isHidden`, banner/avatar/subtitle gating, `-mt-12` condicional al banner).
- Studio: `src/components/album/CardFocusOverlay.tsx` (`detailHiddenSlots`, `IMAGE_ACCEPT_KINDS`, panel "solo datos").
