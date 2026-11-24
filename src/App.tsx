import React, { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Header } from './components/Header';
import { ExamSetup } from './components/ExamSetup';
import { ExamScreen } from './components/ExamScreen';
import { ExamResult } from './components/ExamResult';
import { HistoryModal } from './components/HistoryModal';
import { GitHubConfigModal } from './components/GitHubConfigModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import {
  ExamConfig,
  ExamResultData,
  Question,
  GradeLevel,
  ContestRound,
  GitHubRepoIndex,
  LoadedExamPool,
} from './types';
import {
  fetchGitHubRepoIndex,
  loadQuestionsForSelection,
  generateExamQuestions,
  getExamKey,
} from './data/questionBank';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import {
  LicenseRecord,
  activateOrTakeoverLicense,
  checkIsAdminUser,
  clearStoredLocalSession,
  getStoredLocalSession,
  subscribeToActiveLicense,
} from './services/licenseService';
import { soundFx } from './utils/sound';

export default function App() {
  const [view, setView] = useState<'setup' | 'exam' | 'result'>('setup');

  // Firebase Auth & Real-time License Session state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const [accountId, setAccountId] = useState<string>(() => localStorage.getItem('oly_account_id') || '');
  const [accountPassword, setAccountPassword] = useState<string>('');
  const [activeLicense, setActiveLicense] = useState<LicenseRecord | null>(null);
  const [activeSession, setActiveSession] = useState<{ accountId: string; sessionId: string } | null>(null);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);

  // Exam selection & GitHub pool state
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(4);
  const [selectedRound, setSelectedRound] = useState<ContestRound>(1);
  const [repoIndex, setRepoIndex] = useState<GitHubRepoIndex | null>(null);
  const [loadedPool, setLoadedPool] = useState<LoadedExamPool | null>(null);
  const [isLoadingPool, setIsLoadingPool] = useState<boolean>(true);

  const [examConfig, setExamConfig] = useState<ExamConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examResult, setExamResult] = useState<ExamResultData | null>(null);
  const [history, setHistory] = useState<ExamResultData[]>([]);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const loadRequestIdRef = useRef(0);

  const isGradeAuthorizedNow = useCallback(
    (grade: GradeLevel, adminFlag = isAdmin, licenseObj = activeLicense): boolean => {
      if (adminFlag) return true;
      if (!licenseObj || licenseObj.status !== 'active') return false;
      if (licenseObj.expiresAt && licenseObj.expiresAt.toMillis() <= Date.now()) return false;
      if (licenseObj.isAdminAccount) return true;
      return licenseObj.grade === grade;
    },
    [isAdmin, activeLicense]
  );

  const loadPool = useCallback(
    async (
      grade: GradeLevel,
      round: ContestRound,
      indexOverride?: GitHubRepoIndex | null,
      forceRefresh = false,
      allowGitHubOverride?: boolean
    ) => {
      const allowGitHub =
        allowGitHubOverride !== undefined ? allowGitHubOverride : isGradeAuthorizedNow(grade);
      const requestId = ++loadRequestIdRef.current;
      setIsLoadingPool(true);
      try {
        const pool = await loadQuestionsForSelection(grade, round, {
          forceRefresh,
          repoIndex: indexOverride !== undefined ? indexOverride : repoIndex,
          allowGitHub,
        });
        if (requestId === loadRequestIdRef.current) {
          setLoadedPool(pool);
        }
        return pool;
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setIsLoadingPool(false);
        }
      }
    },
    [repoIndex, isGradeAuthorizedNow]
  );

  // 1. Firebase Auth listener + Admin check + Restore previously activated session on this device
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        setIsAdmin(false);
        setActiveLicense(null);
        setActiveSession(null);
        return;
      }

      try {
        const adminStatus = await checkIsAdminUser(firebaseUser);
        setIsAdmin(adminStatus);
      } catch (err) {
        console.error(err);
        setIsAdmin(false);
      }

      // Restore active single-device session if this browser already activated a license for this UID
      const stored = getStoredLocalSession();
      if (stored && stored.uid === firebaseUser.uid) {
        setAccountId(stored.accountId);
        setActiveSession({ accountId: stored.accountId, sessionId: stored.sessionId });
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore listener on the active license (Anti-Sharing Single Session Kick)
  useEffect(() => {
    if (!authReady || !user || !activeSession) {
      return;
    }

    const unsub = subscribeToActiveLicense({
      accountId: activeSession.accountId,
      localSessionId: activeSession.sessionId,
      onActive: (license) => {
        setActiveLicense(license);
        setActivationError(null);
      },
      onKicked: (reason) => {
        soundFx.playError();
        setActiveLicense(null);
        setActiveSession(null);
        setKickedMessage(reason);
        // Immediately pull user out of an active exam if kicked by another device or Admin!
        setView((prev) => (prev === 'exam' ? 'setup' : prev));
      },
      onError: (err) => {
        console.error('License snapshot error:', err);
      },
    });

    return () => unsub();
  }, [authReady, user, activeSession]);

  // 3. Startup: Load local exam history and GitHub repo index
  useEffect(() => {
    const savedHistory = localStorage.getItem('oly_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error(e);
      }
    }

    let cancelled = false;
    const initRepo = async () => {
      const index = await fetchGitHubRepoIndex(undefined, true);
      if (cancelled) return;
      setRepoIndex(index);
    };
    initRepo();

    return () => {
      cancelled = true;
    };
  }, []);

  // 4. Auto-sync question pool whenever grade, round, repoIndex, admin status, or activeLicense changes
  useEffect(() => {
    const authorized = isGradeAuthorizedNow(selectedGrade, isAdmin, activeLicense);
    let targetRound = selectedRound;

    if (authorized && repoIndex && !repoIndex.apiLimited) {
      const hasCurrentRound = Boolean(repoIndex.availableMap[getExamKey(selectedGrade, targetRound)]);
      if (!hasCurrentRound) {
        const firstForGrade = repoIndex.files.find((f) => f.grade === selectedGrade);
        if (firstForGrade && firstForGrade.round !== selectedRound) {
          setSelectedRound(firstForGrade.round);
          return;
        }
      }
    }

    loadPool(selectedGrade, targetRound, repoIndex, false, authorized);
  }, [selectedGrade, selectedRound, repoIndex, isAdmin, activeLicense, isGradeAuthorizedNow, loadPool]);

  // Auto-select the license's grade as soon as a student license becomes active
  useEffect(() => {
    if (activeLicense && !activeLicense.isAdminAccount && activeLicense.grade >= 1 && activeLicense.grade <= 9) {
      setSelectedGrade(activeLicense.grade as GradeLevel);
    }
  }, [activeLicense?.accountId, activeLicense?.grade, activeLicense?.isAdminAccount]);

  const handleSignIn = async () => {
    setActivationError(null);
    setKickedMessage(null);
    try {
      const cred = await signInWithGoogle();
      const signedInUser = cred.user;
      const adminStatus = await checkIsAdminUser(signedInUser);
      setIsAdmin(adminStatus);

      // If user already typed Account ID & Password before clicking Sign In, activate immediately in one flow
      if (accountId.trim() && accountPassword.trim()) {
        setIsActivating(true);
        try {
          const result = await activateOrTakeoverLicense({
            user: signedInUser,
            accountId,
            password: accountPassword,
            studentName: localStorage.getItem('oly_student_name') || signedInUser.displayName || 'Học sinh',
            isUserAdmin: adminStatus,
          });
          if (result.ok && result.sessionId && result.license) {
            soundFx.playSuccess();
            setActiveSession({ accountId: result.license.accountId, sessionId: result.sessionId });
            setActiveLicense(result.license);
            setAccountId(result.license.accountId);
            localStorage.setItem('oly_account_id', result.license.accountId);
            setAccountPassword('');
          } else if (result.error) {
            setActivationError(result.error);
          }
        } finally {
          setIsActivating(false);
        }
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setActivationError('Không thể đăng nhập Google: ' + (err?.message || 'Vui lòng thử lại.'));
      }
    }
  };

  const handleSignOut = async () => {
    clearStoredLocalSession();
    setActiveLicense(null);
    setActiveSession(null);
    setAccountPassword('');
    setIsAdmin(false);
    setShowAdminModal(false);
    setView('setup');
    await signOutUser();
  };

  const handleAccountIdChange = (newAccountId: string) => {
    setAccountId(newAccountId);
    setActivationError(null);
    if (newAccountId.trim()) {
      localStorage.setItem('oly_account_id', newAccountId.trim());
    } else {
      localStorage.removeItem('oly_account_id');
      clearStoredLocalSession();
      setActiveLicense(null);
      setActiveSession(null);
    }
  };

  const handleAccountPasswordChange = (newPassword: string) => {
    setAccountPassword(newPassword);
    setActivationError(null);
  };

  const handleActivateLicense = async (studentName: string) => {
    if (!user) {
      await handleSignIn();
      return;
    }

    setIsActivating(true);
    setActivationError(null);
    setKickedMessage(null);

    try {
      const result = await activateOrTakeoverLicense({
        user,
        accountId,
        password: accountPassword,
        studentName,
        isUserAdmin: isAdmin,
      });

      if (!result.ok || !result.sessionId || !result.license) {
        soundFx.playError();
        setActivationError(result.error || 'Không thể kích hoạt tài khoản.');
        return;
      }

      soundFx.playSuccess();
      setActiveSession({ accountId: result.license.accountId, sessionId: result.sessionId });
      setActiveLicense(result.license);
      setAccountId(result.license.accountId);
      localStorage.setItem('oly_account_id', result.license.accountId);
      setAccountPassword(''); // Clear password input after successful 1-year activation
    } catch (err: any) {
      soundFx.playError();
      setActivationError(err?.message || 'Lỗi kích hoạt tài khoản trên máy chủ.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleSelectGrade = (newGrade: GradeLevel) => {
    setSelectedGrade(newGrade);
  };

  const handleSelectRound = (newRound: ContestRound) => {
    setSelectedRound(newRound);
  };

  const handleRefreshGitHub = async () => {
    setIsLoadingPool(true);
    const freshIndex = await fetchGitHubRepoIndex(undefined, true);
    setRepoIndex(freshIndex);
    await loadPool(selectedGrade, selectedRound, freshIndex, true);
  };

  const handleStartExam = async (config: ExamConfig) => {
    const allowGitHub = isGradeAuthorizedNow(config.grade);
    let pool = loadedPool;
    if (
      !pool ||
      pool.grade !== config.grade ||
      pool.round !== config.round ||
      (!allowGitHub && (pool.source === 'github' || pool.source === 'merged')) ||
      (allowGitHub && pool.source === 'test')
    ) {
      pool = await loadPool(config.grade, config.round, repoIndex, false, allowGitHub);
    }

    const generated = generateExamQuestions(
      pool.questions,
      config.grade,
      config.round,
      config.questionCount
    );

    setExamConfig({
      ...config,
      source: pool.source,
      sourceFileName: pool.fileName,
    });
    setQuestions(generated);
    setView('exam');
  };

  const handleSubmitExam = (result: ExamResultData) => {
    setExamResult(result);
    const newHistory = [result, ...history];
    setHistory(newHistory);
    localStorage.setItem('oly_history', JSON.stringify(newHistory));
    setView('result');
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('oly_history');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 font-sans flex flex-col text-gray-900">
      <Header
        user={user}
        isAdmin={isAdmin}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onOpenAdminDashboard={() => setShowAdminModal(true)}
        onOpenHistory={() => setShowHistoryModal(true)}
        onOpenGitHubConfig={() => setShowGitHubModal(true)}
        onHome={() => setView('setup')}
      />

      <main className="flex-1 py-6">
        {view === 'setup' && (
          <ExamSetup
            user={user}
            authReady={authReady}
            isAdmin={isAdmin}
            activeLicense={activeLicense}
            selectedGrade={selectedGrade}
            selectedRound={selectedRound}
            accountId={accountId}
            accountPassword={accountPassword}
            isActivating={isActivating}
            activationError={activationError}
            kickedMessage={kickedMessage}
            repoIndex={repoIndex}
            loadedPool={loadedPool}
            isLoadingPool={isLoadingPool}
            onSelectGrade={handleSelectGrade}
            onSelectRound={handleSelectRound}
            onChangeAccountId={handleAccountIdChange}
            onChangeAccountPassword={handleAccountPasswordChange}
            onActivateLicense={handleActivateLicense}
            onSignIn={handleSignIn}
            onDismissKicked={() => setKickedMessage(null)}
            onRefreshGitHub={handleRefreshGitHub}
            onOpenGitHubConfig={() => setShowGitHubModal(true)}
            onOpenAdminDashboard={() => setShowAdminModal(true)}
            onStartExam={handleStartExam}
          />
        )}

        {view === 'exam' && examConfig && (
          <ExamScreen
            questions={questions}
            config={examConfig}
            onSubmitExam={handleSubmitExam}
            onQuit={() => setView('setup')}
          />
        )}

        {view === 'result' && examResult && (
          <ExamResult
            result={examResult}
            onRetry={() => {
              if (examConfig) handleStartExam(examConfig);
              else setView('setup');
            }}
            onHome={() => setView('setup')}
          />
        )}
      </main>

      {/* Modals */}
      {showHistoryModal && (
        <HistoryModal
          history={history}
          onClose={() => setShowHistoryModal(false)}
          onClearHistory={handleClearHistory}
        />
      )}

      {showGitHubModal && (
        <GitHubConfigModal
          repoIndex={repoIndex}
          onClose={() => setShowGitHubModal(false)}
          onQuestionsLoaded={(newIndex) => {
            const nextIndex = newIndex !== undefined ? newIndex : repoIndex;
            setRepoIndex(nextIndex);
            loadPool(selectedGrade, selectedRound, nextIndex, true);
          }}
        />
      )}

      {showAdminModal && isAdmin && (
        <AdminDashboardModal onClose={() => setShowAdminModal(false)} />
      )}
    </div>
  );
}
