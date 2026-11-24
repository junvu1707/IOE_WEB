/**
 * Security TDD Specification Runner for OlyEnglish Firestore Rules.
 * Verifies all "Dirty Dozen" adversarial payloads are rejected with PERMISSION_DENIED,
 * and valid Student Activation, Session Takeover, and Admin Management flows succeed.
 *
 * Run against Firebase Local Emulator Suite when available:
 *   npx firebase emulators:exec "npx tsx firestore.rules.test.ts"
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  actor: 'anon' | 'unverified_admin' | 'student_a' | 'student_b' | 'admin';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const TEN_YEARS_MS = 3650 * 24 * 60 * 60 * 1000;

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated read on license document',
    actor: 'anon',
    operation: 'get',
    path: '/licenses/l4_00001',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email spoofing bootstrapped admin',
    actor: 'unverified_admin',
    operation: 'list',
    path: '/licenses',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Non-admin attempting to create /admins/{uid}',
    actor: 'student_a',
    operation: 'create',
    path: '/admins/student_a',
    payload: { uid: 'student_a', displayName: 'Hacker', createdAt: 'SERVER_TIMESTAMP' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Student attempting to create admin license uyenlp1310',
    actor: 'student_a',
    operation: 'create',
    path: '/licenses/uyenlp1310',
    payload: {
      accountId: 'uyenlp1310',
      grade: 0,
      isAdminAccount: true,
      ownerUid: 'student_a',
      ownerName: 'Hacker',
      activeSessionId: 'sess_hack',
      deviceLabel: 'Chrome',
      status: 'active',
      activatedAt: 'SERVER_TIMESTAMP',
      expiresAt: Date.now() + ONE_YEAR_MS,
      updatedAt: 'SERVER_TIMESTAMP',
      loginCount: 1,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Grade mismatch spoofing (l4_00001 claiming grade 9)',
    actor: 'student_a',
    operation: 'create',
    path: '/licenses/l4_00001',
    payload: {
      accountId: 'l4_00001',
      grade: 9,
      isAdminAccount: false,
      ownerUid: 'student_a',
      ownerName: 'Student A',
      activeSessionId: 'sess_a1',
      deviceLabel: 'Chrome',
      status: 'active',
      activatedAt: 'SERVER_TIMESTAMP',
      expiresAt: Date.now() + ONE_YEAR_MS,
      updatedAt: 'SERVER_TIMESTAMP',
      loginCount: 1,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Expiration forgery (10-year expiry instead of 1 year)',
    actor: 'student_a',
    operation: 'create',
    path: '/licenses/l4_00002',
    payload: {
      accountId: 'l4_00002',
      grade: 4,
      isAdminAccount: false,
      ownerUid: 'student_a',
      ownerName: 'Student A',
      activeSessionId: 'sess_a2',
      deviceLabel: 'Chrome',
      status: 'active',
      activatedAt: 'SERVER_TIMESTAMP',
      expiresAt: Date.now() + TEN_YEARS_MS,
      updatedAt: 'SERVER_TIMESTAMP',
      loginCount: 1,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Backdated client timestamp on activatedAt',
    actor: 'student_a',
    operation: 'create',
    path: '/licenses/l4_00003',
    payload: {
      accountId: 'l4_00003',
      grade: 4,
      isAdminAccount: false,
      ownerUid: 'student_a',
      ownerName: 'Student A',
      activeSessionId: 'sess_a3',
      deviceLabel: 'Chrome',
      status: 'active',
      activatedAt: Date.now() - 86400000,
      expiresAt: Date.now() + ONE_YEAR_MS,
      updatedAt: 'SERVER_TIMESTAMP',
      loginCount: 1,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Shadow / ghost field injection (isVip: true)',
    actor: 'student_a',
    operation: 'create',
    path: '/licenses/l4_00004',
    payload: {
      accountId: 'l4_00004',
      grade: 4,
      isAdminAccount: false,
      ownerUid: 'student_a',
      ownerName: 'Student A',
      activeSessionId: 'sess_a4',
      deviceLabel: 'Chrome',
      status: 'active',
      activatedAt: 'SERVER_TIMESTAMP',
      expiresAt: Date.now() + ONE_YEAR_MS,
      updatedAt: 'SERVER_TIMESTAMP',
      loginCount: 1,
      isVip: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Student attempting to reactivate or take over a revoked license',
    actor: 'student_b',
    operation: 'update',
    path: '/licenses/l4_00005',
    payload: {
      status: 'active',
      ownerUid: 'student_b',
      activeSessionId: 'sess_b5',
      loginCount: 2,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Student attempting to extend expiresAt during session takeover',
    actor: 'student_b',
    operation: 'update',
    path: '/licenses/l4_00006',
    payload: {
      ownerUid: 'student_b',
      ownerName: 'Student B',
      activeSessionId: 'sess_b6',
      deviceLabel: 'Edge',
      expiresAt: Date.now() + TEN_YEARS_MS,
      loginCount: 2,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Identity spoofing: setting ownerUid to another user on takeover',
    actor: 'student_b',
    operation: 'update',
    path: '/licenses/l4_00007',
    payload: {
      ownerUid: 'victim_uid',
      ownerName: 'Spoofed',
      activeSessionId: 'sess_b7',
      deviceLabel: 'Safari',
      loginCount: 2,
      updatedAt: 'SERVER_TIMESTAMP',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Student attempting to list/scrape /licenses collection',
    actor: 'student_a',
    operation: 'list',
    path: '/licenses',
    expected: 'PERMISSION_DENIED',
  },
];
