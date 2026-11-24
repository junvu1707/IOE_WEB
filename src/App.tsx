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

export default function App() {
  const [view, setView] = useState<'setup' | 'exam' | 'result'>('setup');
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

  const loadRequestIdRef = useRef(0);

  const loadPool = useCallback(
    async (
      grade: GradeLevel,
      round: ContestRound,
      indexOverride?: GitHubRepoIndex | null,
      forceRefresh = false
    ) => {
      const requestId = ++loadRequestIdRef.current;
      setIsLoadingPool(true);
      try {
        const pool = await loadQuestionsForSelection(grade, round, {
          forceRefresh,
          repoIndex: indexOverride !== undefined ? indexOverride : repoIndex,
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
    [repoIndex]
  );

  // Startup: Load history and automatically sync GitHub repo index + initial exam
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

      const initialGrade: GradeLevel = 4;
      let initialRound: ContestRound = 1;

      // If Grade 4 doesn't have c1 yet on GitHub, auto-pick the first available GitHub round for Grade 4 (e.g. c2)
      if (index && !index.apiLimited) {
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
      await loadPool(initialGrade, initialRound, index, false);
    };

    initGitHub();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectGrade = (newGrade: GradeLevel) => {
    let nextRound = selectedRound;

    // If current round isn't on GitHub for this grade, auto-select the first available GitHub round for this grade
    if (repoIndex && !repoIndex.apiLimited) {
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
    loadPool(newGrade, nextRound, repoIndex, false);
  };

  const handleSelectRound = (newRound: ContestRound) => {
    setSelectedRound(newRound);
    loadPool(selectedGrade, newRound, repoIndex, false);
  };

  const handleRefreshGitHub = async () => {
    setIsLoadingPool(true);
    const freshIndex = await fetchGitHubRepoIndex(undefined, true);
    setRepoIndex(freshIndex);
    await loadPool(selectedGrade, selectedRound, freshIndex, true);
  };

  const handleStartExam = async (config: ExamConfig) => {
    let pool = loadedPool;
    if (!pool || pool.grade !== config.grade || pool.round !== config.round) {
      pool = await loadPool(config.grade, config.round, repoIndex, false);
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
        onOpenHistory={() => setShowHistoryModal(true)}
        onOpenGitHubConfig={() => setShowGitHubModal(true)}
        onHome={() => setView('setup')}
      />

      <main className="flex-1 py-6">
        {view === 'setup' && (
          <ExamSetup
            selectedGrade={selectedGrade}
            selectedRound={selectedRound}
            repoIndex={repoIndex}
            loadedPool={loadedPool}
            isLoadingPool={isLoadingPool}
            onSelectGrade={handleSelectGrade}
            onSelectRound={handleSelectRound}
            onRefreshGitHub={handleRefreshGitHub}
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
    </div>
  );
}
