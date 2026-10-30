/**
 * Salted SHA-256 for the simulated backend, so no password is ever stored in clear.
 * Fine for a mock; a real backend would use a slow KDF (Argon2/bcrypt) server-side.
 */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function hashPassword(password: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${password}`)
}

export function newSalt(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 16)
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  return (await hashPassword(password, salt)) === expectedHash
}
