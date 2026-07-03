# Formato de imprenta para cartas físicas — spec + gap analysis (KRO-216)

> **Estado**: research completo (2026-07-03), anclado al código real y con las
> cifras clave del QR **medidas**, no estimadas. Es el spec base para elegir
> imprenta piloto y ajustar el export de la tirada. **No es definitivo**: los
> valores marcados _[confirmar]_ los fija la imprenta piloto vía el cuestionario
> (§7). No codificar el modo print-ready hasta cerrar las **decisiones
> bloqueantes** (§1).

## 0. TL;DR

El export actual de la tirada (`MintTiradaDialog.tsx`) es un buen **origen /
preview** pero **no es print-ready** para ninguna imprenta profesional. Tres
cosas lo bloquean, por orden de importancia:

1. **El QR no cabe legible al tamaño que se coloca hoy** (medido, §2). Con el
   payload actual (221 B) y un placement del 25-30%, el módulo cae a
   ~0.28-0.31 mm, por debajo del suelo de imprenta (~0.4 mm). Hay que **agrandar
   el QR (~25 mm, ECC M) o recortar el payload** — y esto último toca la
   propiedad núcleo (verificación offline).
2. **No hay sangrado ni geometría física**: todo se rasteriza `object-cover` al
   trim exacto, en px arbitrarios (`PRINT_W=2000`), sin mm/DPI/bleed. Cualquier
   desvío de cuchilla deja borde blanco.
3. **La máscara de foil está en el formato equivocado**: escala de grises por
   luminancia y con convención **invertida** (claro=foil; el estándar es
   negro K100=foil). Y falta decidir la **ruta de foil** (clásica vs digital),
   que determina si la máscara va como vector binario o ráster gris.

**Entregable objetivo**: PDF/X-4 (arte CMYK + foil spot + dieline en capas) +
dataset CSV/JSON para datos variables (VDP) + manifest enriquecido, generado en
un **paso de servidor** (el canvas del navegador solo produce RGB). El ZIP de
PNGs actual se conserva como paquete de **prueba/preview/Flutter**.

---

## 1. Decisiones BLOQUEANTES (antes de tocar código)

Estas tres no son técnicas de imprenta: son decisiones de **producto** que
condicionan todo el export. Hay que cerrarlas primero.

| # | Decisión | Opciones | Impacto |
|---|----------|----------|---------|
| B1 | **Ruta de foil** | (a) clásica hot/cold con plancha · (b) **digital / VDP** (MGI JETvarnish, cold foil en línea) | Determina el formato de la máscara: vector binario 100%K (clásica) vs ráster gris invertido (digital). La clásica NO soporta foil distinto por carta sin multiplicar coste; para coleccionables variados con QR único, la **digital** es la única viable. |
| B2 | **Tamaño del QR vs payload** | (a) QR grande **≥25 mm** (~41% del reverso) manteniendo el payload firmado · (b) **recortar el payload** para bajar de versión | (b) puede **romper la verificación OFFLINE** si se saca la firma del QR → deja de ser una decisión de tamaño y pasa a ser de arquitectura de seguridad. Ver §2. |
| B3 | **Imprenta piloto** | (a) POD tipo QPMN/MPC (MOQ≈1, foil+VDP sin mínimo) · (b) industrial tipo Cartamundi (MOQ≈2500) | Decide si Kromia puede hacer **tiradas cortas** y si CMYK+ICC es obligatorio. |

---

## 2. El QR — cifras MEDIDAS (riesgo nº 1)

> Medido el 2026-07-03 contra una identidad real (`cardidentities`), serializando
> el `CardQrPayload` exacto (`serializeCardQrPayload`, `card-qr.ts`) con firma
> P-256 P1363 (64 B → 86 chars base64url). **No es una estimación.**

**Payload real = 221 bytes**: `id` UUID v4 (36) + `albumId` ObjectId (24) +
`cardIndex` (num) + `kind:'card-identity'` + firma (86) + andamiaje JSON.

Versión de QR y tamaño de módulo resultante (con quiet zone de 4 módulos):

| ECC | Versión | Módulos | Tamaño para módulo ≥0.4 mm | % del ancho (63 mm) |
|-----|---------|---------|----------------------------|---------------------|
| L | 9 | 53×53 | ~24-25 mm | ~40% |
| **M** | **10** | **57×57** | **~25-26 mm** | **~41%** |
| Q | 12 | 65×65 | ~30 mm | ~48% |
| H | 15 | 77×77 | ~34 mm | ~54% |

Módulo (mm) por tamaño físico y ECC:

| Tamaño | ECC L | ECC M | ECC Q | ECC H |
|--------|-------|-------|-------|-------|
| 15 mm (24%) | 0.246 | 0.231 | 0.205 | 0.176 |
| 18 mm (29%) | 0.295 | 0.277 | 0.247 | 0.212 |
| 20 mm (32%) | 0.328 | 0.308 | 0.274 | 0.235 |
| 22 mm (35%) | 0.361 | 0.338 | 0.301 | 0.259 |
| **25 mm (40%)** | 0.410 | **0.385** | 0.342 | 0.294 |
| 28 mm (44%) | 0.459 | 0.431 | 0.384 | 0.329 |

**Lecturas**:

- El **suelo de imprenta** habitual es ~0.4 mm/módulo (absoluto ~0.33 mm = 4 dots
  @300 dpi). Verde = seguro, ámbar = límite, rojo = por debajo.
- Hoy el QR se coloca en el `%` del publisher **sin validar** (`qrPlacement.size`).
  A 25-30% (16-19 mm) el módulo cae a **0.28-0.31 mm** → **QR de fábrica en
  riesgo aunque escanee en pantalla**.
- **Contradicción ECC vs módulo resuelta con datos**: subir a ECC Q/H (más
  robusto) engorda la versión y **encoge** el módulo. Con 221 B no se puede tener
  "ECC Q + módulo ≥0.4 mm + QR pequeño". Recomendación: **ECC M + QR ≥25 mm**, o
  recortar payload.
- **Palanca de payload** (decisión B2): `albumId` (24 B) es redundante dentro del
  QR si el `id` (UUID único global) ya identifica la carta y el backend resuelve
  el resto. Quitar `albumId` + acortar `id` (p.ej. base64url de 16 B en vez de
  UUID de 36) baja ~40-50 B → probablemente 1 versión menos → módulo mayor al
  mismo tamaño. **Pero** la firma (86 B) es el grueso y **no se puede quitar sin
  perder la verificación offline** (la propiedad núcleo de KRO-16). Si se saca la
  firma del QR, el escaneo pasa a requerir red → es un cambio de arquitectura,
  no un ajuste de tamaño. Documentar la decisión antes de tocar el modelo.

### Payloads candidatos (medido 2026-07-03, ECC M)

| Payload | Versión | módulo @20 mm (32%) | @25 mm (40%) |
|---------|---------|---------------------|--------------|
| **Actual** (v+kind+uuid36+albumId24+idx+sig) 221 B | v10 | 0.308 ❌ | 0.385 ⚠️ |
| sin `albumId` (uuid36) 184 B | v9 | 0.328 ❌ | 0.410 ✅ |
| sin `albumId` + `id` corto (16 B→~22 ch) 170 B | v8 | 0.351 ⚠️ | 0.439 ✅ |
| **compacto** no-JSON (`id16`+`idx`+`sig`) 109 B | v5 | **0.444 ✅** | 0.556 ✅ |

**Conclusión medida**: recortar campos del JSON ayuda poco (v10→v8; a 20 mm sigue
<0.4 mm). El **único** camino a un QR pequeño (20 mm) y seguro es el **formato
compacto no-JSON**. **PERO** — restricción dura (la firma cubre
`v\nkind\nid\nalbumId\ncardIndex\nserial`, `cardQrSigningInput`): **todo campo que
se quite del QR debe salir también del input de firma**, o la **verificación
offline se rompe** (el verificador necesita esos campos para reconstruir lo
firmado). Es decir, QR pequeño ⇒ **cambio de contrato del QR + bump de `v` +
espejo en Flutter (`core_dart`)**, no un simple ajuste. Sacar la firma del QR
(dejar solo `id`) haría el QR diminuto pero **elimina la verificación offline** —
es la decisión B2, de producto, no de tamaño.

**Fixes de QR baratos e inmediatos** (no dependen de la imprenta; **hechos**
2026-07-03 salvo lo indicado): `margin: 2 → 4` ✅ (quiet zone ISO 18004), isla
blanca **cuadrada** en vez de `roundRect` ✅ (que muerde la quiet zone),
`width: 640 → 1024` ✅. **Pendiente**: validación en el editor (avisar si el QR
queda a <safe mm del borde o si el módulo estimado < umbral) — **diferida hasta
B2** (el umbral seguro depende del formato de payload elegido) y a que la
impresión física sea una capacidad real. Exportar el QR **vectorial** (SVG) en vez
de PNG = parte del modo print-ready de servidor.

---

## 3. Parámetros consolidados

Confianza: **alta** salvo lo marcado. _[confirmar]_ = lo fija la imprenta piloto.

### Geometría
- **Trim (corte final)**: 63 × 88 mm (poker/TCG estándar; 2.5"×3.5" = 63.5×88.9 mm
  es equivalente, ~0.5 mm de diferencia). **Fijar la retícula en mm reales** y
  derivar px = `mm/25.4*dpi`, no al revés.
- **Sangrado (bleed)**: **3 mm/lado** _[confirmar: algunas UE aceptan 2 mm]_ →
  lienzo total **69 × 94 mm**. El arte debe **desbordar** el trim.
- **Zona segura**: **3 mm** hacia dentro del trim _[confirmar: alguna fuente pide
  5 mm]_ → caja útil ~57 × 82 mm. Todo QR/texto/logo crítico **dentro**.
- **Esquinas**: **no** hornear el redondeo en el PNG; se entrega rectángulo con
  bleed y el **troquel** las redondea (~3 mm de radio). El `cornerRadius` en % del
  editor (`options.ts`, xl≈28%≈17.6 mm a 63 mm es irrealizable) es **visual**;
  mapearlo a mm real o marcarlo como tal.

### Resolución
- **DPI objetivo**: **600 dpi** sobre el lienzo con bleed → ~1630 × 2220 px
  (mín. universal 300 dpi). El `PRINT_W=2000` fijo es un número arbitrario sin
  bleed; derivar de mm+dpi.
- **Anverso** (nace de **SVG**): idealmente entregarlo **vectorial** (PDF/X-4 o
  SVG crudo) — escala sin pérdida, texto/line-art nítido. Es la mejora de mayor
  impacto/menor coste. Si se mantiene PNG, ≥2250 px de ancho para cubrir 600 dpi
  con bleed.

### Color
- **Corto plazo**: **embeber sRGB** en los PNG + declarar `colorSpace:'sRGB'` en
  el manifest y dejar **una** conversión CMYK a la imprenta. (Hoy los PNG salen
  RGB **sin perfil** pero el README los rotula "(CMYK)" → desajuste a corregir.)
- **Print-ready**: CMYK con perfil pactado _[confirmar: FOGRA39 UE / GRACoL 2006
  o CRPC6 NA]_, TAC objetivo 300-330%.
- **Marca fuera de gamut**: dorado `#F0B429` → vía **foil metálico** (en CMYK sale
  mostaza) o Pantone spot; verde `#2D6B45` → Pantone spot o aprobar desvío contra
  prueba. Equivalentes CMYK **solo de referencia** (dependen del perfil).

### Foil (depende de B1)
- **Máscara** — ruta **clásica**: vector PDF/SVG, formas **sólidas**, binario
  **100%K negro = foil**, spot nombrado _[confirmar: "Foil"/"Gold"/"Spot1"]_. Ruta
  **digital**: ráster gris (TIFF, ≥600 dpi). **En ambas: negro = aplicar foil**
  (hoy la máscara está en gris por luminancia **e invertida** → hay que
  **invertirla** _[re-verificar el signo en el código antes de invertir]_).
- **Textura holográfica**: **no es imprimible** (es micro-relieve óptico). La
  aporta la imprenta de su catálogo. Enviar un `foilStyle` **nombrado** por zona
  (`rainbow`/`cracked-ice`/`confetti`/`light-columns`/`gold`/`silver`), no el
  bitmap. Reetiquetar `foilTextures/` como "preview only".
- **Cobertura y detalle** _[confirmar por proceso]_: spot ≤~30% del área; si
  >~60-70% → cartón holográfico full-surface. Trazo mín. ~0.2-0.3 mm. El
  **contour-mask fino es el peor caso de registro** (el brillo "baila" ±1-2 mm) →
  engordar/simplificar la máscara o reservar foil a zonas macizas.
- **Separación foil ↔ spot-UV**: ≥~1.6 mm, nunca solapar _[confirmar]_.

### QR
Ver §2. Resumen: **ECC M**, **≥25 mm** dentro de la safe zone, **margin 4**,
negro **K-only** sobre isla blanca, **ventana mate knockout** (sin foil ni
laminado brillante sobre el QR + quiet zone), reverso **black-core** opaco, QR
**vectorial**.

### Material
- **Black-core 310 gsm** (300-330), calibre ~0.37-0.42 mm — opacidad alta
  (imprescindible con QR + doble cara).
- Laminado **mate o silk/soft-touch** — mejor base de foil (el gloss lo agrieta)
  y mejor para el escaneo del QR (menos reflejo). Linen **no** se lamina.

### Producción (VDP)
- Cada carta = QR firmado único → es **datos variables** puro. Entregar
  **plantilla estática PDF/X-4** (1 carta: arte+foil+dieline) + **dataset
  CSV/JSON** (`id`, `qrPayload`, `cardIndex`→front, reverso). La **imposición**
  (n-up) la hace la imprenta. Conservar `backs/<id>.png` como fallback.

---

## 4. Gap analysis del export actual

`src/components/album/MintTiradaDialog.tsx` salvo indicación.

| Sev | Actual | Necesario | Acción |
|-----|--------|-----------|--------|
| 🔴 bloq | Máscara de foil = PNG gris por luminancia, convención **invertida** (claro=foil), sobre fondo negro (~L372-386) | Negro K100 = foil; vector binario (clásica) o TIFF gris (digital) | Decidir B1; invertir _[re-verificar signo]_; idealmente trazar silueta como path desde el SVG crudo; documentar "black=foil" |
| 🔴 bloq | `drawCover` object-cover al **trim exacto**, `PRINT_W=2000` sin bleed | Lienzo **trim+3 mm/lado** (69×94 mm) a DPI derivado de mm; arte hasta el borde del bleed | Sustituir el marco; añadir `trimMm/bleedMm/safeMm/dpi` + rects `trimBox/safeBox` al manifest |
| 🔴 bloq | QR `margin:2`, `width:640` fijo, pad `roundRect`, tamaño = %·ancho **sin validar**; módulo puede caer a 0.28-0.31 mm | ≥25 mm, `margin:4`, pad cuadrado, ECC M, módulo ≥0.4 mm, QR vectorial, validación en editor | Ver §2; recortar payload (B2) o forzar tamaño mínimo |
| 🔴 bloq | QR sobre reverso sin zona prohibida; el editor no impide QR sobre dorado/verde/foil | Ventana **mate knockout** sin foil/barniz sobre QR+quiet zone; K-only sobre isla blanca | Emitir rect del QR como zona prohibida en manifest + máscara `finishing/qr-knockout/<id>.png` |
| 🟠 imp | PNG RGB **sin** perfil, README rotula "(CMYK)" | sRGB embebido + `colorSpace` en manifest (o CMYK+perfil en print-ready) | Corregir el README; embeber sRGB; metadatos de color al manifest |
| 🟠 imp | El modelo solo conoce `aspect` (ratio); manifest todo en px | Tamaño físico en **mm** + DPI + perfil | Bloque `print{ widthMm, heightMm, bleedMm, safeMm, dpi, colorSpace, cornerRadiusMm }` |
| 🟠 imp | `#F0B429`/`#2D6B45` no declarados como spot | Pantone spot (dorado ideal vía foil) | Añadir `spotColors` al manifest; pedir Pantone a la imprenta |
| 🟠 imp | `foilTextures/` se entrega como imprimible | `foilStyle` nombrado por zona | Reetiquetar "preview only"; campo textual `foilStyle` |
| 🟠 imp | **No** se genera ningún PDF; ZIP de PNGs no es print-ready | Modo print-ready PDF/X-4 + CSV VDP + QR SVG | Requiere **paso de servidor** (backend); mantener el ZIP como paquete de prueba |
| 🟡 nice | `cornerRadius` en % irrealizable | Radio en mm (~3) o marcar "visual" | Documentar rectángulo+bleed; radio real al manifest |
| 🟡 nice | Sin dieline; full-card foil no avisa de cobertura/solape | Dieline spot `CutContour`; avisos de cobertura/gap | Emitir dieline + validaciones en el editor |

---

## 5. Riesgos abiertos que el research NO cubrió (del crítico)

- **Registro anverso↔reverso** (see-through): tolerancia de alineación cara-cara
  ±1-2 mm no tratada; afecta a arte/QR cerca del borde.
- **Show-through** del anverso al reverso vs contraste del QR: cuantificar la
  opacidad mínima; ¿black-core **obligatorio** cuando hay QR?
- **Sobre/pack físico**: material, sellado, colación/aleatorización de rarezas,
  mapeo orden-de-impresión → sobres. Afecta al coste, no tratado.
- **Cantos** (edge coloring/gilding) y su interacción con el bleed.
- **Coste y plazos reales** por unidad para 50-200 cartas con foil + QR único.
- **Prueba de color física** (hard proof) + aprobación como **gate obligatorio**
  antes de la tirada completa.
- **Durabilidad del QR** a años (abrasión/UV) vs ECC elegido.
- **Pipeline de servidor** para CMYK/PDF-X: dimensionar (¿Ghostscript/ICC en
  Node? reparto Studio↔backend?).

---

## 6. Contradicciones a reconciliar con la imprenta

- **Bleed** 2 vs 3 mm (fuentes UE vs MPC/DriveThru). Codificar tras confirmar.
- **Safe zone** 3 vs 5 mm. 5 mm reduce el área útil y **compite con el QR ≥25 mm**.
- **Formato de máscara de foil**: vector binario (clásica) vs ráster gris
  (digital) son **opuestos** → depende de B1.
- **Dorado de marca**: foil metálico vs Pantone spot vs CMYK proceso — tres rutas
  sin decidir; afecta a si el dorado es una **zona de foil** (cambio de modelo).

---

## 7. Cuestionario para la imprenta piloto

Mandar a 2-3 imprentas (una POD MOQ≈1 tipo QPMN/MPC + una con **foil digital/VDP**
para cartas). Cada pregunta apunta a una decisión de Kromia.

1. **Geometría**: ¿trim exacto (63×88 mm o 2.5×3.5"), bleed/lado (2/3 mm o 1/8"),
   zona segura, y tolerancia real de corte en ±mm?
2. **Esquinas**: ¿radio de troquel (~3/3.5 mm) y confirmáis que entregamos
   rectángulo con bleed (no redondeamos en el archivo)?
3. **Resolución**: ¿DPI del arte (300/400/600) a tamaño final con bleed?
   ¿aceptáis el anverso **vectorial** (PDF/X-4) o exigís ráster? ¿resolución mín.
   para rásters reales (arte subido) y avisáis si no llega?
4. **Color**: ¿RGB con sRGB embebido y convertís vosotros, o CMYK con vuestro
   perfil (nombre exacto)? ¿límite de TAC? Si no saben el perfil = señal de alarma.
5. **Marca**: `#F0B429`/`#2D6B45` fuera de gamut — ¿5ª tinta Pantone spot?
   ¿dorado vía foil metálico? ¿qué Pantone recomendáis?
6. **Foil (proceso)** ⚑ bloqueante: ¿hot/cold con plancha o **foil digital**
   (MGI)? ¿soportáis foil **distinto por carta** (VDP) sin plancha nueva?
7. **Foil (formato)**: ¿vector 100%K en capa/spot nombrado (¿qué nombre?), o
   ráster gris (TIFF, ¿DPI?)? ¿binario o admite gris intermedio? ¿umbral?
8. **Holográfico**: ¿lo aportáis con vuestra lámina? ¿qué patrones de catálogo?
   ¿cómo os indicamos cuál por zona? ¿confirmáis que nuestra textura es solo
   orientativa?
9. **Foil (límites)**: ¿detalle mínimo (trazo/hueco/texto en mm)? ¿tolerancia de
   registro foil↔CMYK? ¿un foil de contorno fino aguanta o solo zonas macizas?
   ¿cobertura máx.? ¿se puede imprimir CMYK **encima** del foil?
10. **QR** ⚑: es único por carta (firmado, ~221 B → QR v10 a ECC M). ¿tamaño y
    módulo mínimo en mm que **garantizáis** escaneable? ¿ECC/quiet zone? ¿lo
    procesáis K100? ¿podéis dejar **ventana mate** sin foil/barniz sobre el
    QR+quiet zone, y en qué formato la máscara?
11. **VDP**: ¿soportáis datos variables (QR único por carta)? ¿plantilla PDF/X +
    dataset CSV/JSON que imponéis vosotros, o pliego ya impuesto? ¿motor VDP y
    formato de datos? ¿MOQ y recargo para 50-200 cartas piloto?
12. **Material**: ¿cartones/gramajes (black-core 300/310/330), laminados
    recomendados para que un QR de ~25 mm escanee, confirmáis que el linen no se
    lamina, separación mín. foil↔spot-UV? ¿tenéis **plantilla oficial**
    descargable con capas de corte/bleed/safe/foil/QR?

---

## 8. Próximos pasos (roadmap, mapeado a Jira)

**Antes de tocar código (research/decisión)**:
- [x] Medir el payload real del QR y su versión → **221 B, v10 @ECC M** (§2).
- [ ] **B1** decidir ruta de foil con la imprenta piloto.
- [ ] **B2** decidir tamaño de QR vs recorte de payload (¿firma dentro del QR?).
- [ ] **B3** enviar el cuestionario (§7) y elegir imprenta piloto; pedir su
  plantilla oficial + una **prueba de color física** de 1-2 cartas.

**Fixes baratos, ya (no bloquean, no dependen de la imprenta)**:
- [ ] Dejar de rotular "(CMYK)" en el README; embeber sRGB + `colorSpace` en el
  manifest.
- [ ] QR: `margin:2→4`, pad cuadrado, validación de tamaño/margen en el editor
  (verificar antes que no rompe el WYSIWYG del preview).
- [ ] Enriquecer el `manifest.json` con el bloque `print{}` + `trimBox/safeBox` +
  zona knockout del QR + `foilStyle` + `spotColors` + convención "negro=foil".
  **DATA, no bumpea el KRP.**

**Print-ready (servidor, cuando estén B1-B3)**:
- [ ] Modo print-ready en el **backend** (Node): rasterizar el anverso desde el
  SVG crudo a lienzo trim+bleed derivado de mm+dpi, conversión CMYK con perfil,
  ensamblar PDF/X-4 (capas Art+Foil+Dieline) + CSV VDP + QR SVG. Mantener el ZIP
  de PNGs actual como paquete de prueba/preview/Flutter.

---

_Research generado por un barrido multi-agente (8 dimensiones web-grounded +
síntesis + crítico adversarial), verificado contra el código real y con las
cifras del QR medidas contra la BBDD. Ver KRO-216._
