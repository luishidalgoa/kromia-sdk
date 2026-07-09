# Changelog — SDK Kromia

Cambios destacables del **SDK** (`@kromia/core` + `@kromia/react` + `@kromia/mcp`).
Orientado al **consumer del paquete** (qué tipos/helpers/recetas/renderers/tools
cambian), NO un dump del git log.

**Eje de versión = `protocolVersion` del KRP** (== `@kromia/core.version`), que
`generate.ts` auto-bumpea SOLO en cambios de CONTRATO. Los cambios **DATA /
aditivos** (tipos nuevos, helpers, paquetes) **no bumpean** el `protocolVersion` →
se acumulan en `[Unreleased]` hasta el próximo bump de contrato o un corte de
release del SDK. La versión del SDK es independiente de la de las apps
(Studio/backend/Flutter). Los commits de `core_dart`/`flutter` (espejo Dart) son
paridad de otro chat → se resumen como nota, no se listan uno a uno.

> Histórico reconstruido desde 2026-06 (287 commits; límites de versión
> verificados leyendo el `protocolVersion` real del contrato en cada commit).
> Versiones `< 2.2.2` fuera de registro (previas a esta política).

## [Unreleased] (aditivo desde 5.1.0)

_Tras congelar el KRP en 5.1.0 (2026-06-26): tipos DATA / helpers / paquete nuevo
que **no bumpean** el `protocolVersion` (2026-06-29 → 2026-07-04)._

### Added
- **`borderSVG`** movido a `@kromia/core` (antes vivía en Studio): generador SVG paramétrico de los 9 marcos ornamentales de carta (`border_style`/`border_fill`/ancho/margen/radio), blanco-sobre-transparente para usar como máscara/relleno teñido. Render-only, TS puro, fuente única cross-platform (Flutter lo espeja en `core_dart`) (KRO-224).
- Nuevo paquete **`@kromia/mcp`**: servidor MCP de Kromia — catálogo + validación del contrato (F1), tools de construcción `auto_compose`/`apply_template`/`get_template` (F2), `apply_composition` con dry-run por defecto (F3) y transporte remoto Streamable HTTP (F4) (KRO-156).
- Tronco de **cartas físicas**: `CardIdentity`/`CardOwnership`/`TransferToken`/`CardQrPayload` + helper `ownershipBadge` (KRO-215).
- **QR firmado** de carta física: contrato del payload + verificación pública offline ECDSA P-256 (KRO-16).
- Tipo **`CardTransferBundle`**: envoltorio de transferencia A→B por un solo escaneo (KRO-16).
- Modelo del **reverso** de carta: `CardBackComposition` + `resolveCardBack` (KRO-227).
- Entidad **`Tirada`** + `TiradaStatus` + helper `composeTirada` (composición por sobres ponderada por rareza) (KRO-216).
- **Siluetas de carta** `CardFormat.shape`: `shape:'custom'` + `shapePath` + `validateShapePath` (gramática M/L/C/Q/Z), `shapeScale`, catálogo `standard`+`custom` (KRO-230/232).
- Tipos `PrintProviderProfile` + helper `matchProviderToTirada` (directorio de proveedores; fase inerte) (KRO-233).
- Tipo **`Favorite`** + helper `favoriteKey` (KRO-129).

### Fixed
- `validateShapePath` admite triángulos (2 segmentos + cierre Z) (KRO-230).

### Notes
- Paridad Dart (`core_dart`) al día para todo el bloque (cartas físicas, `CardBack`, QR firmado, `CardTransferBundle`, siluetas, `Favorite`) — la lleva el chat de Flutter.
- Research de imprenta + plantillas de contacto (docs, no contrato) (KRO-216).

## [5.1.0] - 2026-06-26
### Added
- Color de borde personalizado del marco iridiscente: `border_color_hex` (KRO-202).

## [5.0.0] - 2026-06-26
### Added
- Patrón `midnight` del `iridescent_foil` + colores de borde "fondo de carta" (KRO-202).

## [4.3.0] - 2026-06-26
### Added
- Parámetro `border_margin` del marco iridiscente (KRO-202).

## [4.2.0] - 2026-06-26
### Added
- Marco ornamental del `iridescent_foil`: `border_style` + `border_fill` (KRO-202).

## [4.1.0] - 2026-06-26
### Added
- Efecto de catálogo **`iridescent_foil`** parametrizable + `EffectTemplate` con validadores (KRO-202).
- Redondeado de carta `CardFormat.cornerRadius` (en %, consistente entre tamaños) (KRO-225).

## [4.0.0] - 2026-06-24
_MAJOR: renombrado del catálogo de componentes (nombres/descripciones genéricos + reorganización de categorías)._
### Changed
- Componentes: nombres y descripciones genéricos + reorganización de categorías (KRO-198).
### Added
- Disposición de chips en rejilla 2D: `chipGrid` + `chipPlacements` + `chipWidth` (`fill`/`content`) + "Mostrar como" (text/badge) por chip (KRO-198/220).
- Apariencia **por-field** en slots componibles (`fieldAppearances`): tipografía/fondo/recorte/caja completos (KRO-198/221).
- Estilos de acento (`accentStyle`): `bar`/`rounded`/`glow`/`gradient`/`ambient` (KRO-198/219).
- Catálogo de tipografías (`font`) ampliado a 11 familias (KRO-198/218).
- "Estilo por valor" v2 (`conditionalStyle`): target por chip + cláusula `otherwise` (KRO-198).
- `GridPlacement.minHeight`, componente `chips_row`, `labelForField`, `ContainerSurface.textColor` (cascada), `PALETTE_NEUTRALS`, `cornerRadii`, padding por lado, `screenBgHex`, `THEME_PRESETS` (KRO-198).
### Fixed
- El detalle llena la altura de pantalla (content-start); el render honra la apariencia por-chip/por-field en todas las ramas; `sans`→`font-sans`, alineación de chips vía `justify-content` (KRO-198).
### Notes
- Paridad Dart del bloque KRO-198 trackeada como Drift Sync KRO-218/219/220/221.

## [3.4.0] - 2026-06-23
### Added
- Componente "Fila de chips" (`chips_row`) — primera versión (KRO-198).

## [3.3.0] - 2026-06-19
### Added
- Contrato de **CONTAINER** (surface + track sizing) volcado al `.json` del KRP (anti-drift) (KRO-133).
- `ImageTransform` + `CalibrationState`: calibración de imágenes por carta; `imageTransform` en el render + `slotImageTransform` (KRO-33).

## [3.2.0] - 2026-06-19
### Added
- Contrato de **APPEARANCE** volcado al `.json` del KRP (anti-drift) (KRO-133).

## [3.1.0] - 2026-06-15
### Added
- Motor de árbol de **LAYOUT** + `LayoutRenderer` genérico: grid 2D con placement (celdas + spans), self-align, track sizing, posición absoluta, `overlap`, altura mínima, contenedores renombrables (KRO-133).
- Nodo `component` + catálogo de **componentes prefabricados**: `hero_header`, `stats_row`, `badge_row`, `section_title`, carruseles, `feature_card`/`split_panel`/`stat_tile`/`cover_band` + config genérico + divider (KRO-133/155).
- `recipeToComposition`, `TargetComposition` editable, `LayoutComponentNode.hidden`; `CardRefResolver` (mini-cartas con apariencia real + `refSize`); `layoutTemplatesFor`/`applyLayoutTemplate` (KRO-133/178).
- `SECTION_ICONS` + `suggestSectionIcon` (+24 iconos, glifos SVG inline) (KRO-189).
- Tipografía rica + caja/efectos por slot (`textShadow`, scrim), decoración de contenedor (borde atómico/multi-lado, radio por esquina), paleta amplia, `font` como prop (KRO-147/155/162/169).
- Validadores de layout (`validateComposition` del layout, geometría canónica + solapes, `pruneLayoutSlots`, ratchet de conformidad, `parseInlineMarkdown`) + render por behavior en el motor + galería con zoom (KRO-131/133/164/165/166/167).
### Changed
- Detalle de carta unificado (Ficha/Perfil) block-native, con fidelidad estructural revisada (KRO-133).
### Notes
- Paridad Dart a 3.1.0 (capas 3D/foil, layout-conformance, markdown, iconos, grid 2D) + motor de render `kromia_flutter`; drift-CI TS↔Dart = fallo DURO (KRO-133/83/78/64).

## [3.0.0] - 2026-06-10
_MAJOR: eliminación de la receta "Ficha" (`detail_panel`)._
### Removed
- Receta "Ficha" (`detail_panel`) — sustituida por el detalle unificado por bloques (KRO-133).
### Added
- Componentes `badge_row` + `section_title` (KRO-155).
### Fixed
- La raya de acento ya no se tapa; Editorial/Momento sin border/rounded en el wrapper (KRO-133).

## [2.8.0] - 2026-06-10
### Added
- Nodo `component` + catálogo de componentes prefabricados (KRO-133 Capa 2); `hero_header` + preset híbrido, carruseles + categoría, `stats_row` (KRO-133).
### Fixed
- Fidelidad fina del detalle por bloques (acento, divisores, body sin truncar) (KRO-133).

## [2.7.0] - 2026-06-09
### Added
- Plantillas de detalle block-native: **Ficha** + **Perfil** (KRO-133).

## [2.6.0] - 2026-06-08
### Added
- 4 recetas "block-native": `feature_card`/`split_panel`/`stat_tile`/`cover_band` (KRO-133).

## [2.5.0] - 2026-06-05
### Added
- Capa pura de ruta/slug de medios por-álbum + cuota; `DRAFT_MEDIA_SLUG` (KRO-132).
- Contrato de capas de profundidad (parallax) por carta (KRO-130).
- `mediaCapability`: autoridad pura de acceso a medios (KRO-101).
### Fixed
- `auto-detail` recipe-aware (mapea a los slots reales del `targetRecipe`); `albumMediaNamespace` preserva el case (KRO-130).
### Notes
- Paridad Dart 2.5.0 (rareza KRO-28 + media-path KRO-132).

## [2.4.0] - 2026-06-04
### Added
- Contrato de **foil** importable: `EffectLayer`/`CardEffect3D` + `TagStyle.customLayers`; `custom_foil` validando capas (KRO-122).
- Insignia con imagen propia + separación ajustable (KRO-123); combinar varios efectos sobre un valor (KRO-127); `TagStyle.fieldKey` (anclar efecto a campo) (KRO-120).
- Render de markdown inline en `body`; validador avisa de slot obligatorio vacío; renderers honran `disabled`.
### Fixed
- Foil personalizado incompleto = warn, no error (KRO-123).

## [2.3.0] - 2026-06-02
### Added
- Contrato SDK de **efectos visuales por valor de tag** (KRO-30) y de **fuente de rareza** (KRO-28, + fix de bump espurio).
- `resolveTapAction` (interactividad pura) (KRO-74); cadena de navegación multi-salto `targetComposition` (`resolveTargetChain`) fase B (KRO-94).
- `buildAutoListComposition` (auto-default de lista); `isSchemaOutdated` (desactualización por MAJOR) (KRO-115).
### Notes
- Paridad Dart 2.3.0 (visual-effects, tag-styles, interaction, `resolveTargetChain`, `isSchemaOutdated`); drift-CI de paridad de API TS↔Dart (KRO-30/74/94/115/118).

---

_`< 2.2.2`: previo a 2026-06, sin registro (esta política de CHANGELOG arranca aquí)._
