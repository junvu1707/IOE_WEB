import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { GradeLevel } from '../types';
import {
  ACTIVATION_DURATION_MS,
  generateSessionId,
  getDeviceLabel,
  isBootstrappedAdminEmail,
  isValidAccountPassword,
  sanitizeOwnerName,
  validateAccountId,
} from '../data/accounts';

export interface LicenseRecord {
  accountId: string;
  grade: number; // 0 = admin all grades, 1..9 = student grade
  isAdminAccount: boolean;
  ownerUid: string;
  ownerName: string;
  activeSessionId: string;
  deviceLabel: string;
  status: 'active' | 'revoked';
  activatedAt: Timestamp | null;
  expiresAt: Timestamp | null;
  updatedAt: Timestamp | null;
  loginCount: number;
}

export interface ActivationAttemptResult {
  ok: boolean;
  error?: string;
  sessionId?: string;
  license?: LicenseRecord;
}

const LOCAL_SESSION_STORAGE_KEY = 'oly_active_session';

export interface StoredLocalSession {
  accountId: string;
  sessionId: string;
  uid: string;
}

export function getStoredLocalSession(): StoredLocalSession | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.accountId === 'string' && typeof parsed.sessionId === 'string' && typeof parsed.uid === 'string') {
      return parsed as StoredLocalSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredLocalSession(session: StoredLocalSession): void {
  try {
    localStorage.setItem(LOCAL_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearStoredLocalSession(): void {
  try {
    localStorage.removeItem(LOCAL_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function formatLicenseDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatLicenseDateTime(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  const d = ts.toDate();
  return `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

export async function checkIsAdminUser(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (isBootstrappedAdminEmail(user.email, user.emailVerified)) return true;

  const adminPath = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, adminPath);
  }
}

/**
 * Kích hoạt tài khoản mới (hạn 1 năm tính theo giờ server) hoặc tiếp quản phiên đang mở
 * (đá thiết bị cũ ngay lập tức thông qua thay đổi activeSessionId).
 */
export async function activateOrTakeoverLicense(params: {
  user: User;
  accountId: string;
  password: string;
  studentName: string;
  isUserAdmin: boolean;
}): Promise<ActivationAttemptResult> {
  const { user, accountId, password, studentName, isUserAdmin } = params;

  if (!user.emailVerified) {
    return { ok: false, error: 'Tài khoản Google chưa xác minh email.' };
  }

  const check = validateAccountId(accountId);
  if (!check.valid) {
    return { ok: false, error: 'Tài khoản không hợp lệ.' };
  }

  if (check.isAdmin && !isUserAdmin) {
    return {
      ok: false,
      error: 'Tài khoản quản trị chỉ sử dụng được với email Admin đã được cấp quyền.',
    };
  }

  // Tài khoản Admin (uyenlp1310) không cần nhập mật khẩu; tài khoản học sinh bắt buộc đúng mật khẩu
  if (!check.isAdmin && !isValidAccountPassword(password)) {
    return { ok: false, error: 'Mật khẩu chưa đúng.' };
  }

  const normalizedId = check.normalized;
  const docPath = `licenses/${normalizedId}`;
  const docRef = doc(db, 'licenses', normalizedId);

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  const newSessionId = generateSessionId();
  const deviceLabel = getDeviceLabel();
  const safeName = sanitizeOwnerName(studentName || user.displayName || 'Học sinh');

  if (!existingSnap.exists()) {
    const expiresAt = Timestamp.fromMillis(Date.now() + ACTIVATION_DURATION_MS);
    const payload = {
      accountId: normalizedId,
      grade: check.isAdmin ? 0 : (check.grade as GradeLevel),
      isAdminAccount: check.isAdmin,
      ownerUid: user.uid,
      ownerName: safeName,
      activeSessionId: newSessionId,
      deviceLabel,
      status: 'active' as const,
      activatedAt: serverTimestamp(),
      expiresAt,
      updatedAt: serverTimestamp(),
      loginCount: 1,
    };

    try {
      await setDoc(docRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }

    saveStoredLocalSession({ accountId: normalizedId, sessionId: newSessionId, uid: user.uid });
    return {
      ok: true,
      sessionId: newSessionId,
      license: {
        ...payload,
        activatedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    };
  }

  // Tài khoản đã từng được kích hoạt trước đó
  const existingData = existingSnap.data() as LicenseRecord;

  if (existingData.status === 'revoked' && !isUserAdmin) {
    return { ok: false, error: 'Tài khoản này đã bị Admin khóa quyền truy cập.' };
  }

  if (existingData.expiresAt && existingData.expiresAt.toMillis() <= Date.now() && !isUserAdmin) {
    return {
      ok: false,
      error: `Tài khoản này đã hết hạn sử dụng vào ngày ${formatLicenseDate(existingData.expiresAt)}. Vui lòng liên hệ Admin để gia hạn.`,
    };
  }

  if (existingData.isAdminAccount && !isUserAdmin) {
    return { ok: false, error: 'Không có quyền sử dụng tài khoản quản trị.' };
  }

  // Thực hiện tiếp quản phiên (Session Takeover) -> Thiết bị cũ sẽ nhận snapshot mới và bị đá ra ngay lập tức!
  const nextLoginCount = Math.min(1000000, (existingData.loginCount || 0) + 1);
  try {
    await updateDoc(docRef, {
      ownerUid: user.uid,
      ownerName: safeName,
      activeSessionId: newSessionId,
      deviceLabel,
      loginCount: nextLoginCount,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }

  saveStoredLocalSession({ accountId: normalizedId, sessionId: newSessionId, uid: user.uid });
  return {
    ok: true,
    sessionId: newSessionId,
    license: {
      ...existingData,
      ownerUid: user.uid,
      ownerName: safeName,
      activeSessionId: newSessionId,
      deviceLabel,
      loginCount: nextLoginCount,
      updatedAt: Timestamp.now(),
    },
  };
}

/**
 * Lắng nghe thời gian thực (Real-time onSnapshot) phiên hoạt động của tài khoản.
 * Nếu có máy thứ 2 đăng nhập chung ID, hoặc Admin khóa/đá phiên, thiết bị này lập tức bị đăng xuất!
 */
export function subscribeToActiveLicense(params: {
  accountId: string;
  localSessionId: string;
  onActive: (license: LicenseRecord) => void;
  onKicked: (reason: string) => void;
  onError: (err: Error) => void;
}): () => void {
  const { accountId, localSessionId, onActive, onKicked, onError } = params;
  const docPath = `licenses/${accountId}`;
  const docRef = doc(db, 'licenses', accountId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        clearStoredLocalSession();
        onKicked('Tài khoản này đã bị Admin thu hồi hoặc đặt lại.');
        return;
      }

      const data = snapshot.data() as LicenseRecord;

      if (data.status === 'revoked') {
        clearStoredLocalSession();
        onKicked('Tài khoản này vừa bị Admin khóa quyền truy cập.');
        return;
      }

      if (data.expiresAt && data.expiresAt.toMillis() <= Date.now()) {
        clearStoredLocalSession();
        onKicked(`Tài khoản đã hết hạn sử dụng 1 năm (${formatLicenseDate(data.expiresAt)}).`);
        return;
      }

      if (data.activeSessionId !== localSessionId) {
        clearStoredLocalSession();
        const isManualKick = data.activeSessionId.startsWith('kicked_');
        onKicked(
          isManualKick
            ? 'Phiên đăng nhập của máy này đã bị Admin ngắt kết nối.'
            : `Tài khoản vừa được đăng nhập trên thiết bị khác (${data.deviceLabel || 'thiết bị mới'}). Thiết bị này đã tự động đăng xuất để chống chia sẻ tài khoản!`
        );
        return;
      }

      onActive(data);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, docPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

/**
 * Admin: Lắng nghe danh sách toàn bộ tài khoản đã kích hoạt theo thời gian thực.
 */
export function subscribeAllLicenses(
  onData: (licenses: LicenseRecord[]) => void,
  onError: (err: Error) => void
): () => void {
  const colPath = 'licenses';
  const q = query(collection(db, colPath), orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as LicenseRecord);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, colPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function adminSetLicenseStatus(
  accountId: string,
  status: 'active' | 'revoked'
): Promise<void> {
  const docPath = `licenses/${accountId}`;
  try {
    await updateDoc(doc(db, 'licenses', accountId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function adminForceKickSession(accountId: string): Promise<void> {
  const docPath = `licenses/${accountId}`;
  try {
    await updateDoc(doc(db, 'licenses', accountId), {
      activeSessionId: `kicked_${Date.now().toString(36)}`,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function adminExtendLicenseOneYear(
  accountId: string,
  currentExpiresAt: Timestamp | null
): Promise<void> {
  const docPath = `licenses/${accountId}`;
  const baseMs = Math.max(Date.now(), currentExpiresAt ? currentExpiresAt.toMillis() : Date.now());
  const nextExpiresAt = Timestamp.fromMillis(baseMs + ACTIVATION_DURATION_MS);

  try {
    await updateDoc(doc(db, 'licenses', accountId), {
      expiresAt: nextExpiresAt,
      status: 'active',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function adminDeleteLicense(accountId: string): Promise<void> {
  const docPath = `licenses/${accountId}`;
  try {
    await deleteDoc(doc(db, 'licenses', accountId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
