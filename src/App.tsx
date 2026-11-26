import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { ExamSetup } from './components/ExamSetup';
import { ExamScreen } from './components/ExamScreen';
import { ExamResult } from './components/ExamResult';
import { HistoryModal } from './components/HistoryModal';
import { GitHubConfigModal } from './components/GitHubConfigModal';
import {
  ExamConfig,
  ExamResultData,
  Question,
  GradeLevel,
  ContestRound,
  GitHubRepoIndex,
  LoadedExamPool,
  RoundCountSummary,
} from './types';
import {
  fetchGitHubRepoIndex,
  loadQuestionsForSelection,
  loadRoundCountsForGrade,
  generateExamQuestions,
  getExamKey,
} from './data/questionBank';
import { validateAccountId } from './data/accounts';

export default function App() {
  const [view, setView] = useState<'setup' | 'exam' | 'result'>('setup');

  // Local-only Account ID (stored strictly on user's device)
  const [accountId, setAccountId] = useState<string>(() => localStorage.getItem('oly_account_id') || '');

  // Exam selection & GitHub pool state
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(() => {
    const savedId = localStorage.getItem('oly_account_id') || '';
    const check = validateAccountId(savedId);
    if (check.valid && !check.isAdmin && check.grade) {
      return check.grade;
    }
    return 4;
  });
  const [selectedRound, setSelectedRound] = useState<ContestRound>(1);
  const [repoIndex, setRepoIndex] = useState<GitHubRepoIndex | null>(null);
  const [loadedPool, setLoadedPool] = useState<LoadedExamPool | null>(null);
  const [isLoadingPool, setIsLoadingPool] = useState<boolean>(true);

  // Per-round question counts for Admin (uyenlp1310)
  const [roundCounts, setRoundCounts] = useState<Partial<Record<ContestRound, RoundCountSummary>>>({});
  const [isLoadingRoundCounts, setIsLoadingRoundCounts] = useState<boolean>(false);

  const [examConfig, setExamConfig] = useState<ExamConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examResult, setExamResult] = useState<ExamResultData | null>(null);
  const [history, setHistory] = useState<ExamResultData[]>([]);
  const [sessionStudySeconds, setSessionStudySeconds] = useState<number>(0);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);

  const loadRequestIdRef = useRef(0);
  const roundCountRequestIdRef = useRef(0);

  const accountCheck = validateAccountId(accountId);
  const isAdminAccountId = accountCheck.isAdmin;

  const isGradeAuthorizedNow = useCallback(
    (grade: GradeLevel): boolean => {
      const check = validateAccountId(accountId);
      if (check.isAdmin) return true;
      return check.valid && check.grade === grade;
    },
    [accountId]
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

  const refreshAdminRoundCounts = useCallback(
    async (grade: GradeLevel, indexOverride?: GitHubRepoIndex | null, forceRefresh = false) => {
      const requestId = ++roundCountRequestIdRef.current;
      setIsLoadingRoundCounts(true);
      try {
        const counts = await loadRoundCountsForGrade(grade, {
          forceRefresh,
          repoIndex: indexOverride !== undefined ? indexOverride : repoIndex,
        });
        if (requestId === roundCountRequestIdRef.current) {
          setRoundCounts(counts);
        }
      } finally {
        if (requestId === roundCountRequestIdRef.current) {
          setIsLoadingRoundCounts(false);
        }
      }
    },
    [repoIndex]
  );

  // 1. Startup: Load local exam history and GitHub repo index
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

  // 2. Auto-sync question pool whenever grade, round, repoIndex, or accountId changes
  useEffect(() => {
    const authorized = isGradeAuthorizedNow(selectedGrade);
    const targetRound = selectedRound;

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
  }, [selectedGrade, selectedRound, repoIndex, accountId, isGradeAuthorizedNow, loadPool]);

  // 3. For Admin uyenlp1310: load exact question counts for all 5 rounds of the selected grade
  useEffect(() => {
    if (!isAdminAccountId) {
      setRoundCounts({});
      return;
    }
    setRoundCounts({});
    refreshAdminRoundCounts(selectedGrade, repoIndex, false);
  }, [isAdminAccountId, selectedGrade, repoIndex, refreshAdminRoundCounts]);

  const handleAccountIdChange = (newAccountId: string) => {
    setAccountId(newAccountId);
    const trimmed = newAccountId.trim();
    if (trimmed) {
      localStorage.setItem('oly_account_id', trimmed);
      const check = validateAccountId(trimmed);
      if (check.valid && !check.isAdmin && check.grade) {
        setSelectedGrade(check.grade);
      }
    } else {
      localStorage.removeItem('oly_account_id');
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
    if (isAdminAccountId) {
      await refreshAdminRoundCounts(selectedGrade, freshIndex, true);
    }
  };

  const exitFullscreenSafely = () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Ignore fullscreen exit errors
    }
  };

  const handleReturnHome = () => {
    exitFullscreenSafely();
    setSessionStudySeconds(0);
    setView('setup');
  };

  const handleStartExam = async (config: ExamConfig, resetStudyTimer = true) => {
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

    if (resetStudyTimer) {
      setSessionStudySeconds(0);
    }

    setExamConfig({
      ...config,
      source: pool.source,
      sourceFileName: pool.fileName,
    });
    setQuestions(generated);
    setView('exam');
  };

  const handleSubmitExam = (result: ExamResultData) => {
    setSessionStudySeconds((prev) => prev + (result.timeSpentSeconds || 0));
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

  // Hide top navigation header during locked (non-admin) exam & result screens so students cannot escape to main screen
  const isLockedStudySession = Boolean((view === 'exam' || view === 'result') && examConfig && !examConfig.isAdminMode);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 font-sans flex flex-col text-gray-900">
      {!isLockedStudySession && (
        <Header
          onOpenHistory={() => setShowHistoryModal(true)}
          onOpenGitHubConfig={() => setShowGitHubModal(true)}
          onHome={handleReturnHome}
        />
      )}

      <main className="flex-1 py-6">
        {view === 'setup' && (
          <ExamSetup
            selectedGrade={selectedGrade}
            selectedRound={selectedRound}
            accountId={accountId}
            repoIndex={repoIndex}
            loadedPool={loadedPool}
            isLoadingPool={isLoadingPool}
            roundCounts={roundCounts}
            isLoadingRoundCounts={isLoadingRoundCounts}
            onSelectGrade={handleSelectGrade}
            onSelectRound={handleSelectRound}
            onChangeAccountId={handleAccountIdChange}
            onRefreshGitHub={handleRefreshGitHub}
            onOpenGitHubConfig={() => setShowGitHubModal(true)}
            onStartExam={(cfg) => handleStartExam(cfg, true)}
          />
        )}

        {view === 'exam' && examConfig && (
          <ExamScreen
            questions={questions}
            config={examConfig}
            initialStudySeconds={sessionStudySeconds}
            onSubmitExam={handleSubmitExam}
            onQuit={handleReturnHome}
          />
        )}

        {view === 'result' && examResult && (
          <ExamResult
            result={examResult}
            isLocked={Boolean(examConfig && !examConfig.isAdminMode)}
            minStudyMinutes={examConfig?.minStudyMinutes || 0}
            totalStudySeconds={sessionStudySeconds}
            parentPin={examConfig?.parentPin}
            parentEmailPassword={examConfig?.parentEmailPassword}
            onRetry={() => {
              if (examConfig) handleStartExam(examConfig, false);
              else handleReturnHome();
            }}
            onHome={handleReturnHome}
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
            if (isAdminAccountId) {
              refreshAdminRoundCounts(selectedGrade, nextIndex, true);
            }
          }}
        />
      )}
    </div>
  );
}
