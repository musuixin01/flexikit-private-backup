import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const EXTENSION_PAIR_TTL_MS = 5 * 60 * 1000;
export const EXTENSION_PAIR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateExtensionPairCode(): string {
  // Rejection sampling avoids modulo bias for 32-character alphabet.
  const bytes = randomBytes(10);
  return Array.from(bytes, byte => EXTENSION_PAIR_ALPHABET[byte & 31]).join('');
}

export function extensionPairVerifierHash(verifier: string): string {
  return createHash('sha256').update(verifier, 'utf8').digest('hex');
}

export function matchesExtensionPairVerifier(verifier: string, expectedHash: string): boolean {
  const actual = Buffer.from(extensionPairVerifierHash(verifier), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
