import { describe, it, expect } from 'vitest';
import { ownershipBadge, isVerifiedOwnership } from '../src/card-ownership';
import type { CardOwnership } from '../src/types';

const base: Omit<CardOwnership, 'source' | 'verified'> = {
  userId: 'u1', albumId: 'a1', cardIndex: 5, quantity: 1, acquiredAt: '2026-01-01T00:00:00.000Z',
};

describe('ownershipBadge (KRO-215)', () => {
  it('qr + verified → verified', () => {
    const o: CardOwnership = { ...base, source: 'qr', verified: true, identityId: 'id1' };
    expect(ownershipBadge(o)).toBe('verified');
    expect(isVerifiedOwnership(o)).toBe(true);
  });

  it('qr pero NO verified → declared (verified es derivado, no auto-declarable)', () => {
    const o: CardOwnership = { ...base, source: 'qr', verified: false };
    expect(ownershipBadge(o)).toBe('declared');
    expect(isVerifiedOwnership(o)).toBe(false);
  });

  it('manual → declared (aunque verified estuviera mal puesto a true)', () => {
    expect(ownershipBadge({ ...base, source: 'manual', verified: false })).toBe('declared');
    expect(ownershipBadge({ ...base, source: 'manual', verified: true })).toBe('declared');
  });

  it('code y photo → declared', () => {
    expect(ownershipBadge({ ...base, source: 'code', verified: false })).toBe('declared');
    expect(ownershipBadge({ ...base, source: 'photo', verified: false })).toBe('declared');
  });

  it('ownedCards legacy {index,quantity} ≡ manual/no-verificado → declared', () => {
    // Compat §2.2: los registros viejos se leen como self-declared manual.
    const legacy: CardOwnership = { ...base, source: 'manual', verified: false, quantity: 3 };
    expect(ownershipBadge(legacy)).toBe('declared');
  });
});
