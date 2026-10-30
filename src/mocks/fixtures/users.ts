import type { User } from '@/shared/contracts'

/**
 * Simulated accounts. Passwords are never stored in clear: `passwordHash` is
 * SHA-256(`${salt}:${password}`) (see mocks/auth/password.ts). The demo credentials are
 * fictitious and documented in README.md.
 */
export interface UserRecord extends User {
  passwordSalt: string
  passwordHash: string
  createdAt: string
}

export const userFixtures: UserRecord[] = [
  {
    id: 'user-ana',
    name: 'Ana Colecionadora',
    username: 'ana.kurio',
    email: 'ana@kurio.test',
    avatarUrl: null,
    bio: '',
    passwordSalt: 'a1f3c9e27b5d4086',
    passwordHash: '2b55704f8cd380d3542c19fa3126026358f26869def5a4f35f98834be800382e',
    createdAt: '2026-01-05T12:00:00.000Z',
  },
  {
    id: 'user-bruno',
    name: 'Bruno Cunhagem',
    username: 'bruno.kurio',
    email: 'bruno@kurio.test',
    avatarUrl: null,
    bio: '',
    passwordSalt: '7c2e9b14d0a85f63',
    passwordHash: '6f1544f5fc5de6bfe94a68a601d79e0f9277e201cfecbcf4a4d4d325bd76a2dc',
    createdAt: '2026-01-06T12:00:00.000Z',
  },
]

/** Independent seed favorites per user (most recent first). */
export const favoriteFixtures: Record<string, string[]> = {
  'user-ana': ['nft-distant-galaxy', 'nft-005'],
  'user-bruno': ['nft-life-on-edena'],
}
