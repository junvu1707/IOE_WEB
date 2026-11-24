import { GradeLevel } from '../types';

export interface AccountValidationResult {
  valid: boolean;
  isAdmin: boolean;
  normalized: string;
  grade: GradeLevel | null;
  idNumber: string | null;
}

const GRADES: GradeLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const MAX_ACCOUNTS_PER_GRADE = 999;

/**
 * Danh sách tài khoản Admin có toàn quyền truy cập kho đề tất cả khối Lớp 1-9 và mọi tính năng.
 */
export const ADMIN_ACCOUNTS: readonly string[] = ['uyenlp1310'];

/**
 * Danh sách tài khoản hợp lệ cho từng khối lớp (Lớp 1 -> Lớp 9, mỗi lớp 999 ID).
 * Định dạng: l{lớp}_{001..999}
 * Ví dụ: l1_001 -> l1_999 (Lớp 1), l4_001 -> l4_999 (Lớp 4), l9_001 -> l9_999 (Lớp 9)
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

/**
 * Kiểm tra tài khoản có phải Admin hay không (không phân biệt hoa/thường).
 */
export function isAdminAccount(rawInput: string): boolean {
  const normalized = rawInput.trim().toLowerCase();
  return Boolean(normalized) && ADMIN_ACCOUNTS.includes(normalized);
}

/**
 * Kiểm tra tài khoản nhập vào có nằm trong danh sách hợp lệ (Admin hoặc học sinh theo khối) không.
 * Hỗ trợ không phân biệt hoa/thường và tự loại bỏ khoảng trắng thừa.
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
 * Kiểm tra tài khoản có quyền tải bộ đề GitHub cho khối lớp chỉ định hay không.
 * Tài khoản Admin có toàn quyền trên tất cả khối lớp 1 -> 9.
 */
export function isAccountAuthorizedForGrade(rawInput: string, grade: GradeLevel): boolean {
  const result = validateAccountId(rawInput);
  return result.valid && (result.isAdmin || result.grade === grade);
}
