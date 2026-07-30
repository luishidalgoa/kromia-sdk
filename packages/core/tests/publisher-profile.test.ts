/**
 * KRO-285 — contrato del perfil público de un publisher.
 *
 * Lo que se fija aquí es la división que gobierna el tipo: qué escribe el
 * publisher y qué pone el servidor. Y que un perfil VACÍO es válido — es el
 * estado de todo publisher recién creado, no un error.
 */
import { describe, it, expect } from 'vitest';
import {
  PROFILE_BAND_COLORS,
  BAND_COLOR_VALUES,
  DEFAULT_BAND_COLOR,
  PROFILE_LIMITS,
  isBandColor,
  validatePublisherProfile,
  profileIsBare,
} from '../src/publisher-profile';

const base = { displayName: 'Cinabrio' };

describe('KRO-285 · perfil público del publisher', () => {
  describe('el color de la banda', () => {
    it('es un conjunto CERRADO, no un hex libre', () => {
      expect(isBandColor('green')).toBe(true);
      expect(isBandColor('#ff00ff')).toBe(false);
      expect(isBandColor('fucsia')).toBe(false);
      expect(isBandColor(undefined)).toBe(false);
    });

    it('cada color tiene su valor Y su color de texto', () => {
      // El `fg` va en el contrato para garantizar que el nombre se LEA sobre la
      // banda. Dejarlo al criterio de cada host es cómo aparece blanco sobre oro.
      for (const c of PROFILE_BAND_COLORS) {
        const v = BAND_COLOR_VALUES[c];
        expect(v.bg).toMatch(/^#[0-9A-F]{6}$/i);
        expect(v.fg).toMatch(/^#[0-9A-F]{6}$/i);
        expect(v.bg).not.toBe(v.fg);
      }
    });

    it('el default es la banda de quien no ha elegido, y existe', () => {
      expect(isBandColor(DEFAULT_BAND_COLOR)).toBe(true);
    });
  });

  describe('validación', () => {
    it('con nombre basta: TODO lo demás es opcional', () => {
      // Un perfil recién creado no tiene nada, y es el estado normal de
      // cualquier publisher que acaba de darse de alta.
      expect(validatePublisherProfile(base).valid).toBe(true);
    });

    it('el nombre es obligatorio y acotado', () => {
      expect(validatePublisherProfile({}).valid).toBe(false);
      expect(validatePublisherProfile({ displayName: '   ' }).valid).toBe(false);
      expect(validatePublisherProfile({
        displayName: 'x'.repeat(PROFILE_LIMITS.displayName.max + 1),
      }).valid).toBe(false);
    });

    it('el lema es de UNA línea, y el tope es lo que lo hace serlo', () => {
      expect(PROFILE_LIMITS.tagline.max).toBeLessThan(PROFILE_LIMITS.description.max);
      const r = validatePublisherProfile({ ...base, tagline: 'x'.repeat(PROFILE_LIMITS.tagline.max + 1) });
      expect(r.valid).toBe(false);
      expect(r.issues[0].field).toBe('tagline');
    });

    it('acota descripción y ciudad', () => {
      expect(validatePublisherProfile({ ...base, description: 'x'.repeat(601) }).valid).toBe(false);
      expect(validatePublisherProfile({ ...base, city: 'x'.repeat(61) }).valid).toBe(false);
    });

    it('rechaza un color de banda inventado', () => {
      const r = validatePublisherProfile({ ...base, bandColor: 'fucsia' as any });
      expect(r.valid).toBe(false);
      expect(r.issues[0].field).toBe('bandColor');
    });

    it('IGNORA los calculados en vez de rechazarlos', () => {
      // Un cliente que reenvíe el objeto entero que acaba de leer es un cliente
      // razonable; hacerle fallar por eso solo le obliga a limpiar a mano.
      const conCalculados = {
        ...base, followersCount: 9999, albumsCount: 40, joinedAt: '2020-01-01T00:00:00Z',
      } as any;
      expect(validatePublisherProfile(conCalculados).valid).toBe(true);
    });
  });

  describe('profileIsBare — señal, no validación', () => {
    it('un perfil sin lema, descripción ni logo está pelado', () => {
      expect(profileIsBare(base)).toBe(true);
      expect(profileIsBare(null)).toBe(true);
      expect(profileIsBare({ ...base, tagline: '   ' })).toBe(true);
    });

    it('con cualquiera de los tres, ya no', () => {
      expect(profileIsBare({ ...base, tagline: 'Cromos de bestias' })).toBe(false);
      expect(profileIsBare({ ...base, description: 'Hola' })).toBe(false);
      expect(profileIsBare({ ...base, logoKey: 'publishers/cinabrio/logo.webp' })).toBe(false);
    });

    it('pelado NO significa inválido: son preguntas distintas', () => {
      expect(profileIsBare(base)).toBe(true);
      expect(validatePublisherProfile(base).valid).toBe(true);
    });
  });
});
