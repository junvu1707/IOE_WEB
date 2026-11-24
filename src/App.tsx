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
} from './types';
import {
  fetchGitHubRepoIndex,
  loadQuestionsForSelection,
  generateExamQuestions,
  getExamKey,
} from './data/questionBank';
import {
  getAccountAccessState,
  activateAccountWithPassword,
  isAccountAuthorizedForGrade,
  isAuthenticatedAdmin,
} from './data/accounts';

export default function App() {
  const [view, setView] = useState<'setup' | 'exam' | 'result'>('setup');
  const [accountId, setAccountId] = useState<string>(() => localStorage.getItem('oly_account_id') || '');
  const [accountPassword, setAccountPassword] = useState<string>('');
  const isAdmin = isAuthenticatedAdmin(accountId, accountPassword);
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(() => {
    const saved = localStorage.getItem('oly_account_id') || '';
    const access = getAccountAccessState(saved, '');
    return access.isActivated && access.grade ? access.grade : 4;
  });
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

  const loadRequestIdRef = useRef(0);

  const loadPool = useCallback(
    async (
      grade: GradeLevel,
      round: ContestRound,
      indexOverride?: GitHubRepoIndex | null,
      forceRefresh = false,
      accountOverride?: string,
      passwordOverride?: string
    ) => {
      const activeAccount = accountOverride !== undefined ? accountOverride : accountId;
      const activePassword = passwordOverride !== undefined ? passwordOverride : accountPassword;
      const allowGitHub = isAccountAuthorizedForGrade(activeAccount, grade, activePassword);
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
    [repoIndex, accountId, accountPassword]
  );

  // Startup: Load history and automatically sync GitHub repo index + initial exam (GitHub enabled only if account has active 1-year activation)
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

    const initGitHub = async () => {
      setIsLoadingPool(true);
      const index = await fetchGitHubRepoIndex(undefined, true);
      if (cancelled) return;
      setRepoIndex(index);

      const savedAccount = localStorage.getItem('oly_account_id') || '';
      const access = getAccountAccessState(savedAccount, '');
      const initialGrade: GradeLevel = access.isActivated && access.grade ? access.grade : 4;
      let initialRound: ContestRound = 1;

      if (access.isActivated && index && !index.apiLimited) {
        const hasC1 = Boolean(index.availableMap[getExamKey(initialGrade, 1)]);
        if (!hasC1) {
          const firstForGrade = index.files.find((f) => f.grade === initialGrade);
          if (firstForGrade) {
            initialRound = firstForGrade.round;
          }
        }
      }

      setSelectedGrade(initialGrade);
      setSelectedRound(initialRound);
      await loadPool(initialGrade, initialRound, index, false, savedAccount, '');
    };

    initGitHub();

    return () => {
      cancelled = true;
    };
  }, []);

  const syncAccountCredentials = (nextAccountId: string, nextPassword: string) => {
    activateAccountWithPassword(nextAccountId, nextPassword);
    const access = getAccountAccessState(nextAccountId, nextPassword);

    if (access.isActivated && (access.isAdmin || access.grade)) {
      const targetGrade = access.isAdmin ? selectedGrade : access.grade!;
      let targetRound = selectedRound;

      if (repoIndex && !repoIndex.apiLimited) {
        const hasCurrentRound = Boolean(repoIndex.availableMap[getExamKey(targetGrade, targetRound)]);
        if (!hasCurrentRound) {
          const firstForGrade = repoIndex.files.find((f) => f.grade === targetGrade);
          if (firstForGrade) {
            targetRound = firstForGrade.round;
          }
        }
      }

      setSelectedGrade(targetGrade);
      setSelectedRound(targetRound);
      loadPool(targetGrade, targetRound, repoIndex, false, nextAccountId, nextPassword);
    } else {
      loadPool(selectedGrade, selectedRound, repoIndex, false, nextAccountId, nextPassword);
    }
  };

  const handleAccountIdChange = (newAccountId: string) => {
    setAccountId(newAccountId);
    if (newAccountId.trim()) {
      localStorage.setItem('oly_account_id', newAccountId.trim());
    } else {
      localStorage.removeItem('oly_account_id');
    }
    syncAccountCredentials(newAccountId, accountPassword);
  };

  const handleAccountPasswordChange = (newPassword: string) => {
    setAccountPassword(newPassword);
    syncAccountCredentials(accountId, newPassword);
  };

  const handleSelectGrade = (newGrade: GradeLevel) => {
    let nextRound = selectedRound;

    // If authorized for newGrade and current round isn't on GitHub, auto-select the first available GitHub round
    if (isAccountAuthorizedForGrade(accountId, newGrade, accountPassword) && repoIndex && !repoIndex.apiLimited) {
      const hasCurrentRound = Boolean(repoIndex.availableMap[getExamKey(newGrade, selectedRound)]);
      if (!hasCurrentRound) {
        const firstForGrade = repoIndex.files.find((f) => f.grade === newGrade);
        if (firstForGrade) {
          nextRound = firstForGrade.round;
        }
      }
    }

    setSelectedGrade(newGrade);
    setSelectedRound(nextRound);
    loadPool(newGrade, nextRound, repoIndex, false, accountId, accountPassword);
  };

  const handleSelectRound = (newRound: ContestRound) => {
    setSelectedRound(newRound);
    loadPool(selectedGrade, newRound, repoIndex, false, accountId, accountPassword);
  };

  const handleRefreshGitHub = async () => {
    setIsLoadingPool(true);
    const freshIndex = await fetchGitHubRepoIndex(undefined, true);
    setRepoIndex(freshIndex);
    await loadPool(selectedGrade, selectedRound, freshIndex, true, accountId, accountPassword);
  };

  const handleStartExam = async (config: ExamConfig) => {
    const allowGitHub = isAccountAuthorizedForGrade(accountId, config.grade, accountPassword);
    let pool = loadedPool;
    if (
      !pool ||
      pool.grade !== config.grade ||
      pool.round !== config.round ||
      (!allowGitHub && (pool.source === 'github' || pool.source === 'merged')) ||
      (allowGitHub && pool.source === 'test')
    ) {
      pool = await loadPool(config.grade, config.round, repoIndex, false, accountId, accountPassword);
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
        isAdmin={isAdmin}
        onOpenHistory={() => setShowHistoryModal(true)}
        onOpenGitHubConfig={() => setShowGitHubModal(true)}
        onHome={() => setView('setup')}
      />

      <main className="flex-1 py-6">
        {view === 'setup' && (
          <ExamSetup
            selectedGrade={selectedGrade}
            selectedRound={selectedRound}
            accountId={accountId}
            accountPassword={accountPassword}
            repoIndex={repoIndex}
            loadedPool={loadedPool}
            isLoadingPool={isLoadingPool}
            onSelectGrade={handleSelectGrade}
            onSelectRound={handleSelectRound}
            onChangeAccountId={handleAccountIdChange}
            onChangeAccountPassword={handleAccountPasswordChange}
            onRefreshGitHub={handleRefreshGitHub}
            onOpenGitHubConfig={() => setShowGitHubModal(true)}
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
            loadPool(selectedGrade, selectedRound, nextIndex, true, accountId, accountPassword);
          }}
        />
      )}
    </div>
  );
}
