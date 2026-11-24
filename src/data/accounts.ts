import { GradeLevel } from '../types';

export interface AccountValidationResult {
  valid: boolean;
  isAdmin: boolean;
  normalized: string;
  grade: GradeLevel | null;
  idNumber: string | null;
}

export interface ActivatedAccountRecord {
  accountId: string;
  isAdmin: boolean;
  grade: GradeLevel | null;
  activatedAt: number;
  expiresAt: number;
}

export interface AccountAccessState {
  validId: boolean;
  isAdmin: boolean;
  normalized: string;
  grade: GradeLevel | null;
  idNumber: string | null;
  isActivated: boolean;
  isExpired: boolean;
  wrongPassword: boolean;
  expiresAt: number | null;
  expiresAtLabel: string | null;
}

const GRADES: GradeLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const MAX_ACCOUNTS_PER_GRADE = 999;

/** Thời hạn sử dụng sau khi kích hoạt đúng ID & mật khẩu: 1 năm (365 ngày) */
export const ACTIVATION_DURATION_MS = 365 * 24 * 60 * 60 * 1000;
const ACTIVATION_STORAGE_KEY = 'oly_account_activations';

/**
 * Danh sách tài khoản Admin có toàn quyền truy cập kho đề tất cả khối Lớp 1-9 và mọi tính năng.
 */
export const ADMIN_ACCOUNTS: readonly string[] = ['uyenlp1310'];

/**
 * Mật khẩu kích hoạt tài khoản dùng trong 1 năm.
 */
const ACCOUNT_ACCESS_PASS = 'kdepass';

/**
 * Danh sách tài khoản hợp lệ cho từng khối lớp (Lớp 1 -> Lớp 9, mỗi lớp 999 ID).
 * Định dạng: l{lớp}_{001..999}
 */
export const VALID_ACCOUNTS_BY_GRADE: Record<GradeLevel, string[]> = GRADES.reduce(
  (acc, grade) => {
    const list: string[] = [];
    for (let i = 1; i <= MAX_ACCOUNTS_PER_GRADE; i++) {
      list.push(`l${grade}_${String(i).padStart(3, '0')}`);
    }
    acc[grade] = list;
    return acc;
  },
  {} as Record<GradeLevel, string[]>
);

/**
 * Bảng tra cứu nhanh O(1) toàn bộ 8.991 tài khoản học sinh (9 khối × 999 ID) -> khối lớp tương ứng.
 */
export const VALID_ACCOUNT_MAP: ReadonlyMap<string, GradeLevel> = (() => {
  const map = new Map<string, GradeLevel>();
  for (const grade of GRADES) {
    for (const accountId of VALID_ACCOUNTS_BY_GRADE[grade]) {
      map.set(accountId, grade);
    }
  }
  return map;
})();

function readActivationStore(): Record<string, ActivatedAccountRecord> {
  try {
    const raw = localStorage.getItem(ACTIVATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeActivationStore(store: Record<string, ActivatedAccountRecord>): void {
  try {
    localStorage.setItem(ACTIVATION_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Kiểm tra mật khẩu nhập vào có khớp không.
 */
export function isValidAccountPassword(rawPassword: string): boolean {
  return rawPassword.trim() === ACCOUNT_ACCESS_PASS;
}

/**
 * Kiểm tra tài khoản nhập vào có nằm trong danh sách hợp lệ (Admin hoặc học sinh theo khối) không.
 */
export function validateAccountId(rawInput: string): AccountValidationResult {
  const normalized = rawInput.trim().toLowerCase();
  if (!normalized) {
    return { valid: false, isAdmin: false, normalized: '', grade: null, idNumber: null };
  }

  if (ADMIN_ACCOUNTS.includes(normalized)) {
    return { valid: true, isAdmin: true, normalized, grade: null, idNumber: 'ADMIN' };
  }

  const grade = VALID_ACCOUNT_MAP.get(normalized) ?? null;
  if (!grade) {
    return { valid: false, isAdmin: false, normalized, grade: null, idNumber: null };
  }

  const idNumber = normalized.split('_')[1] || null;
  return { valid: true, isAdmin: false, normalized, grade, idNumber };
}

/**
 * Lấy thông tin kích hoạt còn hiệu lực (trong vòng 1 năm) của tài khoản nếu có.
 */
export function getActiveActivation(rawAccountId: string): ActivatedAccountRecord | null {
  const normalized = rawAccountId.trim().toLowerCase();
  if (!normalized) return null;

  const store = readActivationStore();
  const record = store[normalized];
  if (!record || typeof record.expiresAt !== 'number') return null;

  if (Date.now() < record.expiresAt) {
    return record;
  }
  return null;
}

/**
 * Kiểm tra tài khoản từng kích hoạt nhưng hiện đã hết hạn 1 năm.
 */
export function hasExpiredActivation(rawAccountId: string): boolean {
  const normalized = rawAccountId.trim().toLowerCase();
  if (!normalized) return false;

  const store = readActivationStore();
  const record = store[normalized];
  return Boolean(record && typeof record.expiresAt === 'number' && Date.now() >= record.expiresAt);
}

/**
 * Kích hoạt tài khoản trong 1 năm (365 ngày) khi nhập đúng ID hợp lệ và mật khẩu.
 */
export function activateAccountWithPassword(
  rawAccountId: string,
  rawPassword: string
): ActivatedAccountRecord | null {
  const check = validateAccountId(rawAccountId);
  if (!check.valid || !isValidAccountPassword(rawPassword)) {
    return null;
  }

  const existing = getActiveActivation(check.normalized);
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const record: ActivatedAccountRecord = {
    accountId: check.normalized,
    isAdmin: check.isAdmin,
    grade: check.grade,
    activatedAt: now,
    expiresAt: now + ACTIVATION_DURATION_MS,
  };

  const store = readActivationStore();
  store[check.normalized] = record;
  writeActivationStore(store);
  return record;
}

/**
 * Đánh giá trạng thái truy cập hiện tại của tài khoản (đã kích hoạt 1 năm hay chưa, hết hạn, sai pass...).
 */
export function getAccountAccessState(rawAccountId: string, rawPassword = ''): AccountAccessState {
  const check = validateAccountId(rawAccountId);
  if (!check.valid) {
    return {
      validId: false,
      isAdmin: false,
      normalized: check.normalized,
      grade: null,
      idNumber: null,
      isActivated: false,
      isExpired: false,
      wrongPassword: false,
      expiresAt: null,
      expiresAtLabel: null,
    };
  }

  let activeRecord = getActiveActivation(check.normalized);
  if (!activeRecord && isValidAccountPassword(rawPassword)) {
    activeRecord = activateAccountWithPassword(check.normalized, rawPassword);
  }

  const isActivated = Boolean(activeRecord);
  const expiresAt = activeRecord ? activeRecord.expiresAt : null;
  const expiresAtLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  const isExpired = !isActivated && hasExpiredActivation(check.normalized);
  const wrongPassword = !isActivated && rawPassword.trim().length > 0 && !isValidAccountPassword(rawPassword);

  return {
    validId: true,
    isAdmin: check.isAdmin && isActivated,
    normalized: check.normalized,
    grade: check.grade,
    idNumber: check.idNumber,
    isActivated,
    isExpired,
    wrongPassword,
    expiresAt,
    expiresAtLabel,
  };
}

/**
 * Kiểm tra tài khoản đã xác thực Admin (đúng ID uyenlp1310 và đã nhập đúng pass còn hạn 1 năm).
 */
export function isAuthenticatedAdmin(rawAccountId: string, rawPassword = ''): boolean {
  return getAccountAccessState(rawAccountId, rawPassword).isAdmin;
}

/**
 * Kiểm tra tài khoản có quyền tải bộ đề GitHub cho khối lớp chỉ định hay không.
 * Yêu cầu đúng ID + mật khẩu (còn hiệu lực 1 năm). Admin có toàn quyền tất cả khối 1 -> 9.
 */
export function isAccountAuthorizedForGrade(
  rawAccountId: string,
  grade: GradeLevel,
  rawPassword = ''
): boolean {
  const access = getAccountAccessState(rawAccountId, rawPassword);
  return access.isActivated && (access.isAdmin || access.grade === grade);
}
