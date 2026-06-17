/**
 * KRO-33 — núcleo puro de la calibración de imágenes por carta.
 * Verifica lectura/validación/escritura del transform + estado, sobre el dato
 * de la carta (claves reservadas). Compartido por Studio (CSS) y Flutter.
 */
import { describe, it, expect } from 'vitest';
import {
  IMAGE_TRANSFORMS_KEY,
  CALIBRATION_STATE_KEY,
  CALIBRATION_STATES,
  IDENTITY_IMAGE_TRANSFORM,
  isValidImageTransform,
  normalizeImageTransform,
  getCardImageTransforms,
  getCardImageTransform,
  getCardCalibrationState,
  setCardImageTransform,
  markCardAutoCalibrated,
  setCardCalibrationState,
} from '../src/image-calibration';
import type { ImageTransform } from '../src/types';

const T: ImageTransform = { offsetX: 0.3, offsetY: 0.7, scale: 1.5, rotation: 90 };

describe('isValidImageTransform', () => {
  it('acepta un transform en rango (rotation opcional)', () => {
    expect(isValidImageTransform(T)).toBe(true);
    expect(isValidImageTransform({ offsetX: 0, offsetY: 1, scale: 1 })).toBe(true);
  });
  it('rechaza offsets fuera de [0,1], scale<1 y no-objetos', () => {
    expect(isValidImageTransform({ offsetX: -0.1, offsetY: 0.5, scale: 1 })).toBe(false);
    expect(isValidImageTransform({ offsetX: 0.5, offsetY: 1.2, scale: 1 })).toBe(false);
    expect(isValidImageTransform({ offsetX: 0.5, offsetY: 0.5, scale: 0.5 })).toBe(false);
    expect(isValidImageTransform({ offsetX: 0.5, offsetY: 0.5, scale: 1, rotation: 'x' })).toBe(false);
    expect(isValidImageTransform(null)).toBe(false);
    expect(isValidImageTransform('nope')).toBe(false);
  });
});

describe('normalizeImageTransform', () => {
  it('clampa offsets a [0,1] y scale a ≥1', () => {
    expect(normalizeImageTransform({ offsetX: -1, offsetY: 5, scale: 0.2 }))
      .toEqual({ offsetX: 0, offsetY: 1, scale: 1 });
  });
  it('envuelve rotation a [0,360) y la omite si no es número', () => {
    expect(normalizeImageTransform({ offsetX: 0.5, offsetY: 0.5, scale: 1, rotation: 450 }).rotation).toBe(90);
    expect(normalizeImageTransform({ offsetX: 0.5, offsetY: 0.5, scale: 1, rotation: -90 }).rotation).toBe(270);
    expect('rotation' in normalizeImageTransform({ offsetX: 0.5, offsetY: 0.5, scale: 1 })).toBe(false);
  });
  it('offsets no finitos → centro (0.5)', () => {
    expect(normalizeImageTransform({ offsetX: NaN, offsetY: 0.5, scale: 1 }).offsetX).toBe(0.5);
  });
});

describe('getCardImageTransforms / getCardImageTransform', () => {
  it('lee el mapa y descarta entradas malformadas', () => {
    const card = { [IMAGE_TRANSFORMS_KEY]: { image: T, bad: { offsetX: 9 } } };
    expect(getCardImageTransforms(card)).toEqual({ image: T });
    expect(getCardImageTransform(card, 'image')).toEqual(T);
    expect(getCardImageTransform(card, 'nope')).toBeUndefined();
  });
  it('carta vacía/sin clave → {}', () => {
    expect(getCardImageTransforms({})).toEqual({});
    expect(getCardImageTransforms(null)).toEqual({});
    expect(getCardImageTransforms(undefined)).toEqual({});
  });
});

describe('getCardCalibrationState', () => {
  it('devuelve el estado guardado si es válido', () => {
    expect(getCardCalibrationState({ [CALIBRATION_STATE_KEY]: 'auto_calibrated' })).toBe('auto_calibrated');
  });
  it('deriva calibrated si hay transforms y no hay estado guardado', () => {
    expect(getCardCalibrationState({ [IMAGE_TRANSFORMS_KEY]: { image: T } })).toBe('calibrated');
  });
  it('deriva pending_calibration por defecto', () => {
    expect(getCardCalibrationState({})).toBe('pending_calibration');
    expect(getCardCalibrationState(null)).toBe('pending_calibration');
  });
  it('ignora un estado guardado inválido y deriva', () => {
    expect(getCardCalibrationState({ [CALIBRATION_STATE_KEY]: 'garbage' })).toBe('pending_calibration');
  });
});

describe('setCardImageTransform', () => {
  it('escribe el transform (normalizado) y marca calibrated, inmutable', () => {
    const card = { number: 12 };
    const next = setCardImageTransform(card, 'image', { offsetX: 2, offsetY: 0.4, scale: 0.1 });
    expect(next).not.toBe(card);
    expect((card as Record<string, unknown>)[IMAGE_TRANSFORMS_KEY]).toBeUndefined();
    expect(getCardImageTransform(next, 'image')).toEqual({ offsetX: 1, offsetY: 0.4, scale: 1 });
    expect(getCardCalibrationState(next)).toBe('calibrated');
    expect(next.number).toBe(12);
  });
  it('preserva transforms de otros campos al añadir uno', () => {
    const card = setCardImageTransform({}, 'front', T);
    const next = setCardImageTransform(card, 'back', IDENTITY_IMAGE_TRANSFORM);
    expect(Object.keys(getCardImageTransforms(next)).sort()).toEqual(['back', 'front']);
  });
});

describe('markCardAutoCalibrated / setCardCalibrationState', () => {
  it('markCardAutoCalibrated marca auto sin tocar transforms', () => {
    const card = setCardImageTransform({}, 'image', T);
    const next = markCardAutoCalibrated(card);
    expect(getCardCalibrationState(next)).toBe('auto_calibrated');
    expect(getCardImageTransform(next, 'image')).toEqual(T); // el transform sigue ahí
  });
  it('setCardCalibrationState fija el estado crudo', () => {
    expect(getCardCalibrationState(setCardCalibrationState({}, 'pending_calibration'))).toBe('pending_calibration');
  });
});

describe('catálogo + identidad', () => {
  it('CALIBRATION_STATES tiene los 3 estados', () => {
    expect([...CALIBRATION_STATES]).toEqual(['pending_calibration', 'calibrated', 'auto_calibrated']);
  });
  it('IDENTITY = centro, sin zoom', () => {
    expect(IDENTITY_IMAGE_TRANSFORM).toEqual({ offsetX: 0.5, offsetY: 0.5, scale: 1 });
  });
});
