# Flip al reverso = giro del MODELO 3D entero + gesto de "forzar el giro"

> **Audiencia**: chat/equipo de **kromia-flutter** (app; no toca `core_dart`).
> **Autor**: chat de Studio. **Tracking**: issue Drift Sync (hijo de KRO-227,
> hermano de KRO-228). **Tipo**: RENDER-only — NO bumpea el KRP, NO toca el
> modelo (el modelo `CardBackComposition` + `resolveCardBack` ya está espejado
> en `core_dart`, PR kromia-sdk#15).

## 0. Qué cambia respecto a lo que ya shipeaste (mobile#8)

Vuestro `CardFlip` (KRO-228) rota **la carta plana** front↔back. En Studio eso
mismo fue rechazado por el user con la misma queja que motivó el grosor de
cartulina: *"la imagen no debería ser la que rotase, debería ser el modelo 3D"*.
La versión buena (Studio `HoloCard.tsx`, commits de KRO-227) hace **dos** cosas:

1. **El flip gira el MODELO ENTERO**: cara frontal + **canto de cartulina**
   (las lonchas de grosor) + dorso. El dorso es una **cara del sólido**, no un
   crossfade ni un widget intercambiado: durante el giro se ve el canto de
   perfil, como al voltear un cromo físico.
2. **El gesto que dispara el giro es "forzar el tilt"**: arrastras (puntero
   pulsado) más allá del borde de la carta — cuando el arrastre se pasa **un
   25 % del recorrido** (overshoot ≥ 1.25), la carta se voltea. Una vez por
   gesto. El botón "Reverso/Anverso" queda como fallback accesible.

## 1. Estructura de capas (orden EXACTO de transforms)

Referencia: `kromia-studio/src/components/album/visual-effects/HoloCard.tsx`.

```text
[perspectiva]  perspective: 820px (focus usa 720px)         ← NO rota
└─ [FLIP]      preserve-3d · rotateY(flipped ? 180° : 0°)
   │           transition 620ms cubic-bezier(.3,.7,.35,1)
   │           prefers-reduced-motion → SIN transición (giro instantáneo)
   └─ [TILT]   preserve-3d · rotateX(±maxTilt)·rotateY(±maxTilt)  (80ms)
      ├─ CANTO: N lonchas translateZ(-1 … -N)  (N = depthPx, focus 24)
      │   └─ tapa trasera  translateZ(-(N+1))  bg hsl(34 20% 40%)
      │   └─ DORSO (backFace)  translateZ(-(N+1.5)) · rotateY(180°)
      │       (overflow hidden + radius heredado — mira “hacia atrás”,
      │        solo visible con el modelo volteado)
      ├─ CARA frontal (arte + efectos + bisel)
      └─ glare  translateZ(1px)
```

Claves de la fidelidad:

- El FLIP es una **capa propia entre la perspectiva y el tilt**: su transición
  (620 ms) no pelea con la del tilt (80 ms) y el **tilt sigue funcionando con
  la carta volteada** (inclinas el dorso igual que el anverso).
- El **dorso va DETRÁS de la tapa del canto** (`-(N+1.5)` vs `-(N+1)`) con
  `rotateY(180°)` propio: de frente no se ve (lo tapa el modelo); tras el flip
  del modelo queda mirando al usuario y **cubre la tapa kraft**.
- En Flutter: un único `Transform` con matriz de perspectiva
  (`Matrix4.identity()..setEntry(3, 2, -1/720)..rotateY(angle)`) que envuelve
  **todo** el stack del sólido (canto incluido). El dorso, dentro del mismo
  stack, lleva su `Transform(rotateY(pi))` + translate en Z. Animación:
  `AnimationController` 620 ms con `Curve = Cubic(0.3, 0.7, 0.35, 1.0)`;
  con `MediaQuery.disableAnimations` → salto directo al ángulo final.
- NADA de `AnimatedSwitcher`/crossfade ni de rotar solo la imagen.

## 2. El gesto de "forzar el giro"

Referencia: `HoloCard.tsx` (`onDown`/`onMove`/`onUp`) — matemática exacta:

```text
rawX      = (puntero.x - carta.left) / carta.width      // 0..1 dentro de la carta
overshoot = |rawX - 0.5| * 2                            // 1.0 = borde de la carta
DISPARA cuando: arrastrando (puntero PULSADO) && overshoot >= 1.25
```

- **Una activación por gesto**: flag `fired` que se resetea al soltar
  (pointer up / cancel). Sin `fired`, cruzar el umbral varias veces en el
  mismo arrastre haría flip-flop.
- **Pointer capture**: el arrastre se sigue trackeando aunque el dedo/puntero
  salga de la carta — imprescindible, porque el umbral (1.25) está FUERA de
  sus límites. En Flutter un `GestureDetector.onPanUpdate` con
  `details.localPosition` ya recibe updates fuera del child mientras dura el
  pan: calcula `rawX = localPosition.dx / size.width` sin clampear.
- El **tilt durante el arrastre** ya está al tope en el borde (|ratio| = 1,
  `maxTiltDeg`, focus = 18°): la señal para el usuario es "la carta no gira
  más por mucho que empuje" → sigue empujando → se voltea. Mantén ese clamp.
- El gesto solo se registra si la carta **tiene reverso** (ver §3); si no,
  ni pan-handler (no robes gestos al scroll).

## 3. Cuándo hay reverso (gate) + botón fallback

Referencia: `kromia-studio/src/components/album/CardFocusOverlay.tsx`.

```text
backResolved = resolveCardBack(cardBackDesign, card)   // section: null (acordado)
hasBack      = backResolved.image != null
               || (album.physicalTracking == 'qr' && backResolved.qr != null)
```

- `hasBack == false` → sin gesto, sin botón, sin cara trasera montada.
- Botón fallback (accesibilidad + descubribilidad): pill bajo la carta,
  icono ⟳ (rota 180° con el estado) + texto `Reverso`/`Anverso`, toggle del
  mismo estado que el gesto. En Studio: `bg-black/45 → hover /65`, texto
  blanco 90 %, 11px, `rounded-full`, `px-3 py-1`.
- El dorso pinta lo que ya tenéis en `CardBackView` (imagen a sangre + QR
  cuadrado `(x%, y%)` lado `size%`, gates de KRO-228 sin cambios). Sin diseño
  de imagen: superficie oscura `#1a1713` con un halo radial dorado sutil
  (`radial-gradient(120% 90% at 50% 30%, rgba(240,180,41,.10), transparent 60%)`)
  — referencia `CardBackFace.tsx`.

## 4. Extra menor en el mismo paquete (DATA, sin bump)

`chipWidth: 'fill'` ahora también aplica al **badge de slot ÚNICO** (no solo
dentro de `chipGrid`): la pastilla se estira al 100 % del contenedor y `align`
pasa a `justify-content`. Default sigue siendo `content`. Fuente:
`@kromia/react` `recipe-utils.tsx` (SDK `f633dd1`), rama `BadgeSlot`. Es la
misma familia de gaps que KRO-220 (chips) — un if de dos líneas en vuestro
builder de badge.

## Last verified

2026-07-02 — sesión Studio, contra `HoloCard.tsx` / `CardBackFace.tsx` /
`CardFocusOverlay.tsx` reales (verificado visualmente por el user en focus).
