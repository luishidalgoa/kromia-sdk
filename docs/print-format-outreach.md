# Contacto con imprentas — tirada piloto de cartas físicas (KRO-216)

> Plantillas listas para enviar a imprentas de cartas coleccionables, para cerrar
> las decisiones B1/B2/B3 y los parámetros de la spec (`print-format-spec.md`).
> Objetivo: piloto corto (≈50-200 cartas), poker/TCG 63×88 mm, foil + QR único por
> carta. Rellenar `[Nombre]`. El anexo técnico (§3) se manda como 2º mensaje una
> vez confirman que encajan.

## 1 · Email de primer contacto (ES) — imprentas ES/EU

**Asunto:** Consulta — tirada piloto de cartas coleccionables con foil y QR único por carta

Hola,

Somos una plataforma de álbumes de cromos coleccionables y vamos a lanzar una
**edición física**. Estamos buscando imprenta para una **tirada piloto corta
(≈50-200 cartas)** tamaño **poker/TCG (63×88 mm)**, con vistas a tiradas mayores
si el piloto sale bien.

Antes de entrar en detalle, tenemos **dos requisitos que son decisivos** y me
gustaría confirmar si los cubrís:

1. **Foil / acabado holográfico**, idealmente con la posibilidad de que el
   **diseño de foil sea distinto en cada carta** (dato variable, sin plancha
   nueva por diseño).
2. Un **código QR único e irrepetible impreso en cada carta** (impresión de datos
   variables / VDP).

¿Ofrecéis ambos? Y si es así, ¿cuál sería el **pedido mínimo (MOQ)**, y un
**presupuesto y plazo orientativos** para esa tirada piloto?

Tenemos ya un pliego técnico con todos los detalles (sangrado, perfil de color,
formato de la capa de foil, tamaño del QR, material…) que os paso encantado en
cuanto me confirméis que encajáis. Si tenéis una **plantilla oficial** con las
capas de corte/sangrado/foil/QR, agradeceríamos recibirla.

Muchas gracias,
[Nombre] · Kromia

## 2 · First-contact email (EN) — MPC / QP Market / Shuffled Ink…

**Subject:** Inquiry — pilot run of collectible cards with foil and a unique QR per card

Hi,

We run a collectible-card album platform and are launching a **physical edition**.
We're looking for a printer for a **short pilot run (~50–200 cards)** in
**poker/TCG size (63×88 mm / 2.5″×3.5″)**, with larger runs to follow if the pilot
goes well.

Before getting into detail, we have **two make-or-break requirements** and I'd
like to confirm you can cover them:

1. **Foil / holographic finish**, ideally supporting a **different foil design on
   each card** (variable data, no new plate per design).
2. A **unique, non-repeating QR code printed on every card** (variable-data
   printing / VDP).

Do you offer both? If so, what would be your **minimum order quantity (MOQ)**, and
a **ballpark quote and lead time** for that pilot run?

We have a full technical brief ready (bleed, color profile, foil-layer format, QR
size, stock…) that I'll gladly send once you confirm you're a fit. If you have an
**official template** with cut/bleed/foil/QR layers, we'd love a copy.

Thanks a lot,
[Name] · Kromia

## 3 · Anexo técnico — cuestionario (ES)

> Segundo mensaje / adjunto. Cada bloque fija un parámetro del archivo que
> entregaremos. Equivalencias con la spec en `print-format-spec.md §7`.

**1 · Tamaño y corte**
- ¿Tamaño de corte para poker/TCG: 63×88 mm o 2,5″×3,5″ (63,5×88,9 mm)?
- ¿Cuánto **sangrado** por lado (2/3 mm o 1/8″)? ¿Zona segura interior? ¿Tolerancia real de corte en ±mm?
- ¿Radio de esquina del troquel (~3 mm)? ¿Confirmáis que entregamos **rectángulo con sangrado** y el redondeo lo hacéis vosotros?
- ¿Tenéis **plantilla oficial** descargable (InDesign/PDF/SVG) con capas de corte/sangrado/seguridad/foil/QR?

**2 · Resolución, archivo y color**
- ¿A qué **DPI** queréis el arte, a tamaño final con sangrado? ¿Aceptáis el anverso **vectorial** (PDF/X-4) o exigís ráster?
- ¿Entregamos en **RGB con sRGB** y convertís vosotros, o en **CMYK con vuestro perfil ICC** (¿cuál: FOGRA39, PSO Coated v3, GRACoL 2006, CRPC6…)? ¿Límite de cobertura de tinta (TAC)?
- Tenemos dos colores de marca muy saturados (un dorado y un verde) fuera de gama CMYK: ¿ofrecéis **tinta Pantone** para ellos? ¿El dorado lo conseguimos con **foil metálico**?

**3 · Foil**
- ¿Qué **proceso** ofrecéis para foil distinto por carta: estampado en caliente (plancha), cold foil en línea, o **foil digital** (p. ej. MGI)? ¿El coste por plancha os obliga a un mismo diseño de foil por lote o soportáis **dato variable**?
- ¿En qué **formato** queréis la capa de foil: vector 100 % K en capa/tinta separada (¿qué nombre esperáis?) o **ráster en escala de grises** (¿TIFF, qué DPI?)? ¿Binario o admitís gris intermedio?
- ¿Qué **patrones holográficos** tenéis en catálogo y cómo os indicamos cuál por zona? (asumimos que la lámina física la ponéis vosotros).
- ¿**Detalle mínimo** de foil (trazo/hueco/texto en mm) y **tolerancia de registro** foil↔color? ¿Un foil que sigue el contorno fino del dibujo aguanta o mejor zonas macizas? ¿**Cobertura máxima** recomendada? ¿Se puede imprimir color **encima** del foil?

**4 · QR (único por carta)**
- El QR es **único e irrepetible** en cada carta (≈220 bytes de datos). ¿Qué **tamaño físico y tamaño de módulo mínimos** (en mm) garantizáis escaneables? ¿Nivel de corrección de errores y zona de silencio recomendados?
- ¿Lo imprimís en **negro puro (K100)**? ¿Podéis dejar una **ventana mate sin foil ni barniz brillante** sobre el QR y su margen, para que no refleje y siga leyéndose? ¿En qué formato os pasamos esa zona?

**5 · Datos variables (VDP)**
- ¿Soportáis **datos variables** (QR/serie única por carta)? ¿Preferís **plantilla estática + dataset (CSV/JSON)** que imponéis vosotros, o un pliego ya montado por nosotros? ¿Qué motor/formato de datos usáis?

**6 · Material y acabado**
- ¿Qué **cartones/gramajes** ofrecéis (con **núcleo negro / black-core**, 300-330 g)? ¿Qué **laminado** recomendáis para que un QR de ~20-25 mm escanee bien (mate/silk)? ¿El linen no se lamina? ¿Separación mínima entre foil y spot-UV?

**7 · Comercial**
- **MOQ**, **precio y plazo** orientativos para el piloto (50-200 cartas con foil + QR único), y ¿hacéis **prueba de color física** de 1-2 cartas antes de la tirada completa?

---

_Anexo técnico en inglés: pendiente de traducir si se contacta a las imprentas
internacionales (MPC/QP Market/Shuffled Ink). Ver `print-format-spec.md` (KRO-216)
para el porqué de cada pregunta._
