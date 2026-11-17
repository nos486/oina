/** PBKDF2-SHA256 password hashing with WebCrypto (100k iterations is the Workers maximum). */
const ITERATIONS = 100_000;
const enc = new TextEncoder();

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Format: pbkdf2$<iterations>$<salt base64>$<hash base64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return ['pbkdf2', ITERATIONS, toB64(salt), toB64(await derive(password, salt, ITERATIONS))].join('$');
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parts = (stored ?? '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    // Still do the work so an unknown user takes as long as a wrong password.
    await derive(password, new Uint8Array(16), ITERATIONS);
    return false;
  }
  const iterations = Number(parts[1]);
  const expected = fromB64(parts[3]!);
  const actual = await derive(password, fromB64(parts[2]!), iterations);
  let diff = expected.length ^ actual.length;
  for (let i = 0; i < Math.min(expected.length, actual.length); i++) diff |= expected[i]! ^ actual[i]!;
  return diff === 0;
}
