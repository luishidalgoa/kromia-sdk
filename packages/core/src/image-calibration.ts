/**
 * `image-calibration.ts` — KRO-33. Calibración fina de imágenes POR CARTA.
 *
 * El publisher sube cromos a un `cardFormat` (p.ej. 1:1 sobre un frame 2:3) y la
 * imagen se recorta. En vez de un cropper web (Studio = editor estructural), el
 * encuadre se ajusta en Flutter (pinch/zoom/drag, renderer real → cero drift) y
 * se hace WRITE-BACK a Studio. Studio NO recorta el blob: guarda solo un
 * `ImageTransform` por imagen como metadata → recalibrable sin perder calidad.
 *
 * Lógica PURA (lectura/validación/escritura del dato + catálogo de estados),
 * compartida por Studio (CSS `imageTransformStyle`) y Flutter (`Transform`). Los
 * datos viven en el DATO de la carta bajo claves reservadas; NO entran al `.json`
 * del contrato → sin bump de PROTOCOL_VERSION (mismo patrón que `card-layers.ts`).
 */
import type { ImageTransform, CalibrationState } from './types';

/** Campo reservado del dato de la carta: mapa `fieldKey` → `ImageTransform`. */
export const IMAGE_TRANSFORMS_KEY = '__imageTransforms';
/** Campo reservado del dato de la carta: estado de calibración (`CalibrationState`). */
export const CALIBRATION_STATE_KEY = '__calibrationState';

/** Catálogo cerrado de estados (orden lógico pending → calibrated → auto). */
export const CALIBRATION_STATES: readonly CalibrationState[] = [
  'pending_calibration',
  'calibrated',
  'auto_calibrated',
];

/** Transform identidad: fit natural, centrado, sin zoom ni rotación. */
export const IDENTITY_IMAGE_TRANSFORM: ImageTransform = { offsetX: 0.5, offsetY: 0.5, scale: 1 };

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

/** ¿Tiene `t` forma de `ImageTransform` válido? (offset ∈ [0,1], scale ≥ 1). */
export function isValidImageTransform(t: unknown): t is ImageTransform {
  if (!t || typeof t !== 'object') return false;
  const o = t as Record<string, unknown>;
  return (
    typeof o.offsetX === 'number' && o.offsetX >= 0 && o.offsetX <= 1 &&
    typeof o.offsetY === 'number' && o.offsetY >= 0 && o.offsetY <= 1 &&
    typeof o.scale === 'number' && o.scale >= 1 &&
    (o.rotation === undefined || typeof o.rotation === 'number')
  );
}

/** Normaliza un transform (clamp de rangos). Úsalo al recibir uno del write-back. */
export function normalizeImageTransform(t: ImageTransform): ImageTransform {
  const out: ImageTransform = {
    offsetX: clamp01(t.offsetX),
    offsetY: clamp01(t.offsetY),
    scale: Number.isFinite(t.scale) ? Math.max(1, t.scale) : 1,
  };
  if (typeof t.rotation === 'number' && Number.isFinite(t.rotation)) {
    out.rotation = ((t.rotation % 360) + 360) % 360;
  }
  return out;
}

/** Lee el mapa `fieldKey` → `ImageTransform` de una carta (descarta malformados). */
export function getCardImageTransforms(
  card: Record<string, unknown> | null | undefined,
): Record<string, ImageTransform> {
  if (!card || typeof card !== 'object') return {};
  const raw = (card as Record<string, unknown>)[IMAGE_TRANSFORMS_KEY];
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, ImageTransform> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (isValidImageTransform(val)) out[key] = val;
  }
  return out;
}

/** Transform de un campo de imagen concreto (o `undefined` si no está calibrado). */
export function getCardImageTransform(
  card: Record<string, unknown> | null | undefined,
  fieldKey: string,
): ImageTransform | undefined {
  return getCardImageTransforms(card)[fieldKey];
}

/**
 * Estado de calibración EFECTIVO de una carta. Devuelve el guardado si es válido;
 * si no, lo deriva: con transforms → `calibrated`; sin ellos → `pending_calibration`.
 * (`auto_calibrated` solo se alcanza explícitamente vía `markCardAutoCalibrated`.)
 */
export function getCardCalibrationState(
  card: Record<string, unknown> | null | undefined,
): CalibrationState {
  if (card && typeof card === 'object') {
    const stored = (card as Record<string, unknown>)[CALIBRATION_STATE_KEY];
    if (typeof stored === 'string' && (CALIBRATION_STATES as readonly string[]).includes(stored)) {
      return stored as CalibrationState;
    }
    if (Object.keys(getCardImageTransforms(card)).length > 0) return 'calibrated';
  }
  return 'pending_calibration';
}

/** Setea (inmutable) el transform de un campo de imagen y marca la carta `calibrated`. */
export function setCardImageTransform<T extends Record<string, unknown>>(
  card: T,
  fieldKey: string,
  transform: ImageTransform,
): T {
  const transforms = { ...getCardImageTransforms(card), [fieldKey]: normalizeImageTransform(transform) };
  return { ...card, [IMAGE_TRANSFORMS_KEY]: transforms, [CALIBRATION_STATE_KEY]: 'calibrated' } as T;
}

/** Marca (inmutable) la carta como `auto_calibrated` (acepta cover+center, sin transform). */
export function markCardAutoCalibrated<T extends Record<string, unknown>>(card: T): T {
  return { ...card, [CALIBRATION_STATE_KEY]: 'auto_calibrated' } as T;
}

/** Setea (inmutable) el estado de calibración crudo (resets/migraciones). */
export function setCardCalibrationState<T extends Record<string, unknown>>(
  card: T,
  state: CalibrationState,
): T {
  return { ...card, [CALIBRATION_STATE_KEY]: state } as T;
}
