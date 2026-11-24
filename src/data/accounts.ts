import { GradeLevel } from '../types';

export interface AccountValidationResult {
  valid: boolean;
  isAdmin: boolean;
  normalized: string;
  grade: GradeLevel | null;
  idNumber: string | null;
}

/** Số lượng tài khoản hợp lệ tối đa cho mỗi khối lớp: 99.999 ID (l{khối}_00001 -> l{khối}_99999) */
export const MAX_ACCOUNTS_PER_GRADE = 99999;

/** Thời hạn sử dụng sau khi kích hoạt đúng ID & mật khẩu: 1 năm (365 ngày) */
export const ACTIVATION_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

/** Email Admin mặc định (Bootstrapped Admin trên Firestore Rules) */
export const BOOTSTRAPPED_ADMIN_EMAIL = 'junvu1707@gmail.com';

/** Danh sách mã tài khoản Admin có toàn quyền truy cập kho đề tất cả khối Lớp 1-9 và mọi tính năng */
export const ADMIN_ACCOUNTS: readonly string[] = ['uyenlp1310'];

/** Mật khẩu kích hoạt tài khoản dùng trong 1 năm */
const ACCOUNT_ACCESS_PASS = 'kdepass';

/**
 * Pattern hợp lệ khớp verbatim với firebase-blueprint.json & firestore.rules:
 * - Học sinh: l{1..9}_{3 đến 5 chữ số}, giá trị số từ 1 đến 99999 (hỗ trợ cả l1_001 và l1_00001..l1_99999)
 * - Admin: uyenlp1310
 */
const STUDENT_ID_REGEX = /^l([1-9])_([0-9]{3,5})$/;

export function formatStudentAccountId(grade: GradeLevel, seq: number): string {
  const clamped = Math.max(1, Math.min(MAX_ACCOUNTS_PER_GRADE, Math.floor(seq)));
  return `l${grade}_${String(clamped).padStart(5, '0')}`;
}

export function isValidAccountPassword(rawPassword: string): boolean {
  return rawPassword.trim() === ACCOUNT_ACCESS_PASS;
}

export function isBootstrappedAdminEmail(email?: string | null, emailVerified?: boolean): boolean {
  return Boolean(emailVerified && email && email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL);
}

/**
 * Kiểm tra tài khoản nhập vào có nằm trong danh sách hợp lệ không (899.991 ID học sinh = 9 lớp × 99.999 ID + Admin uyenlp1310).
 */
export function validateAccountId(rawInput: string): AccountValidationResult {
  const normalized = rawInput.trim().toLowerCase();
  if (!normalized || normalized.length > 32) {
    return { valid: false, isAdmin: false, normalized: '', grade: null, idNumber: null };
  }

  if (ADMIN_ACCOUNTS.includes(normalized)) {
    return { valid: true, isAdmin: true, normalized, grade: null, idNumber: 'ADMIN' };
  }

  const match = normalized.match(STUDENT_ID_REGEX);
  if (!match) {
    return { valid: false, isAdmin: false, normalized, grade: null, idNumber: null };
  }

  const grade = Number(match[1]) as GradeLevel;
  const numPart = match[2];
  const seq = parseInt(numPart, 10);

  if (Number.isNaN(seq) || seq < 1 || seq > MAX_ACCOUNTS_PER_GRADE) {
    return { valid: false, isAdmin: false, normalized, grade: null, idNumber: null };
  }

  return { valid: true, isAdmin: false, normalized, grade, idNumber: numPart };
}

/**
 * Tạo mã phiên duy nhất cho mỗi trình duyệt/thiết bị (<= 64 ký tự, khớp regex ^[a-zA-Z0-9_\-]+$).
 */
export function generateSessionId(): string {
  const rand = Math.random().toString(36).slice(2, 12);
  const ts = Date.now().toString(36);
  return `sess_${ts}_${rand}`.slice(0, 64);
}

/**
 * Lấy nhãn mô tả ngắn gọn của thiết bị/trình duyệt hiện tại (<= 120 ký tự theo firebase-blueprint.json).
 */
export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Web Browser';
  const ua = navigator.userAgent || '';

  let browser = 'Trình duyệt';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';

  let os = 'Máy tính';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  return `${browser} • ${os}`.slice(0, 120);
}

/**
 * Chuẩn hóa tên học sinh theo ràng buộc maxLength: 100 của firebase-blueprint.json.
 */
export function sanitizeOwnerName(rawName: string): string {
  const trimmed = rawName.trim();
  return (trimmed || 'Học sinh').slice(0, 100);
}
