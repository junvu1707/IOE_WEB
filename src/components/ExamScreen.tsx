import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Question, ExamConfig, ExamResultData, UserAnswer, QuestionType } from '../types';
import {
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  RotateCcw,
  Tag,
  Link2,
  Unlink,
  Check,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Maximize2,
  CornerDownLeft,
} from 'lucide-react';
import { soundFx } from '../utils/sound';
import { isSentenceAnswerCorrect } from '../data/questionBank';
import { FormattedText } from './FormattedText';

interface ExamScreenProps {
  questions: Question[];
  config: ExamConfig;
  initialStudySeconds?: number;
  onSubmitExam: (result: ExamResultData) => void;
  onQuit: () => void;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, { label: string; color: string }> = {
  tn: { label: 'Trắc nghiệm', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  noi: { label: 'Nối 2 vế', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  dt: { label: 'Điền từ', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  sx: { label: 'Sắp xếp câu', color: 'bg-pink-100 text-pink-800 border-pink-200' },
};

const PAIR_COLOR_THEMES = [
  { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-950', badge: 'bg-rose-600 text-white', lightBadge: 'bg-rose-100 text-rose-800' },
  { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-950', badge: 'bg-blue-600 text-white', lightBadge: 'bg-blue-100 text-blue-800' },
  { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-950', badge: 'bg-emerald-600 text-white', lightBadge: 'bg-emerald-100 text-emerald-800' },
  { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-950', badge: 'bg-amber-600 text-white', lightBadge: 'bg-amber-100 text-amber-800' },
  { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-950', badge: 'bg-purple-600 text-white', lightBadge: 'bg-purple-100 text-purple-800' },
  { bg: 'bg-cyan-50', border: 'border-cyan-400', text: 'text-cyan-950', badge: 'bg-cyan-600 text-white', lightBadge: 'bg-cyan-100 text-cyan-800' },
];

export const ExamScreen: React.FC<ExamScreenProps> = ({
  questions,
  config,
  initialStudySeconds = 0,
  onSubmitExam,
  onQuit,
}) => {
  const isAdminMode = Boolean(config.isAdminMode);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const answersRef = useRef<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(config.timeLimitSeconds);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime] = useState(Date.now());
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);
  const [parentInputPin, setParentInputPin] = useState('');
  const [parentModalError, setParentModalError] = useState('');
  const [showPinText, setShowPinText] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(document.fullscreenElement));
  const submittedRef = useRef(false);
  const dtInputRef = useRef<HTMLInputElement>(null);
  const autoNextTimerRef = useRef<number | null>(null);

  const clearAutoNextTimer = useCallback(() => {
    if (autoNextTimerRef.current !== null) {
      window.clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
  }, []);

  const [selectedMatchLeft, setSelectedMatchLeft] = useState<string | null>(null);
  const [selectedMatchRight, setSelectedMatchRight] = useState<string | null>(null);

  const currentQ = questions[currentIndex];
  const minStudySeconds = isAdminMode ? 0 : (config.minStudyMinutes || 0) * 60;
  const totalStudySeconds = initialStudySeconds + elapsedSeconds;
  const remainingStudySeconds = Math.max(0, minStudySeconds - totalStudySeconds);
  const parentPinExpected = (config.parentPin || '1234').trim();

  const requestEnterFullscreen = useCallback(() => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      // Ignore fullscreen browser restrictions
    }
  }, []);

  // Enter Fullscreen automatically for non-admin exams and monitor ESC exit
  useEffect(() => {
    if (isAdminMode) return;
    requestEnterFullscreen();

    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, [isAdminMode, requestEnterFullscreen]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    clearAutoNextTimer();
    setSelectedMatchLeft(null);
    setSelectedMatchRight(null);
    // Auto-focus fill-in-the-blank input when landing on a 'dt' question
    if (questions[currentIndex]?.type === 'dt') {
      setTimeout(() => {
        dtInputRef.current?.focus();
      }, 30);
    }
    return () => clearAutoNextTimer();
  }, [currentIndex, questions, clearAutoNextTimer]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!submittedRef.current) {
            soundFx.playError();
            handleSubmitExam();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (qId: string, val: any, playSound = true) => {
    if (playSound) soundFx.playClick();
    setAnswers((prev) => {
      const next = { ...prev, [qId]: val };
      answersRef.current = next;
      return next;
    });
  };

  const isQuestionAnswered = (q: Question, ansMap: Record<string, any>): boolean => {
    const val = ansMap[q.id];
    if (val === undefined || val === null || val === '') return false;
    if (q.type === 'noi' && typeof val === 'object') {
      return Object.values(val).some((v) => typeof v === 'string' && v.trim() !== '');
    }
    return String(val).trim() !== '';
  };

  const handleSubmitExam = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const latestAnswers = answersRef.current;
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    let correctCount = 0;
    const userAnswersList: UserAnswer[] = [];
    const incorrectList: { question: Question; userAnswer: any }[] = [];

    questions.forEach((q) => {
      const userAns = latestAnswers[q.id];
      let isCorrect = false;

      if (q.type === 'tn' || q.type === 'dt') {
        if (
          userAns &&
          String(userAns).trim().toLowerCase() === String(q.correct || '').trim().toLowerCase()
        ) {
          isCorrect = true;
        }
      } else if (q.type === 'sx') {
        if (userAns && isSentenceAnswerCorrect(String(userAns), String(q.correct || ''))) {
          isCorrect = true;
        }
      } else if (q.type === 'noi' && q.matchingPairs && q.matchingPairs.length > 0) {
        let allMatch = true;
        q.matchingPairs.forEach((pair) => {
          if (!userAns || userAns[pair.id] !== pair.right) {
            allMatch = false;
          }
        });
        isCorrect = allMatch;
      }

      if (isCorrect) {
        correctCount++;
      } else {
        incorrectList.push({
          question: q,
          userAnswer: userAns || '(Chưa trả lời)',
        });
      }

      userAnswersList.push({
        questionId: q.id,
        userAnswer: userAns || '',
        isCorrect,
        timeSpentSeconds: 0,
      });
    });

    const percentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const roundNamesMap: Record<number, string> = {
      1: 'Khởi động',
      2: 'Vượt chướng ngại vật',
      3: 'Tranh tài',
      4: 'Tăng tốc',
      5: 'Chinh phục đỉnh cao',
    };

    if (percentage >= 50) soundFx.playSuccess();
    else soundFx.playError();

    const resultData: ExamResultData = {
      id: 'exam_' + Date.now(),
      studentName: config.studentName,
      grade: config.grade,
      round: config.round,
      roundName: roundNamesMap[config.round] || 'Vòng Thi',
      score: correctCount,
      totalQuestions: questions.length,
      percentage,
      timeSpentSeconds: timeSpent,
      completedAt: new Date().toISOString(),
      answers: userAnswersList,
      incorrectQuestions: incorrectList,
      source: config.source,
      sourceFileName: config.sourceFileName,
      questions: questions,
    };

    onSubmitExam(resultData);
  };

  const handleNextQuestion = useCallback(
    (playSound = true) => {
      clearAutoNextTimer();
      if (playSound) soundFx.playClick();
      const latestAns = answersRef.current;
      const nextUnanswered = questions.findIndex(
        (q, idx) => idx > currentIndex && !isQuestionAnswered(q, latestAns)
      );
      if (nextUnanswered !== -1) {
        setCurrentIndex(nextUnanswered);
      } else {
        const firstUnansweredAny = questions.findIndex((q) => !isQuestionAnswered(q, latestAns));
        if (firstUnansweredAny !== -1) {
          setCurrentIndex(firstUnansweredAny);
        } else {
          setCurrentIndex((prev) => (prev + 1) % questions.length);
        }
      }
    },
    [questions, currentIndex, clearAutoNextTimer]
  );

  const handlePrevQuestion = () => {
    clearAutoNextTimer();
    soundFx.playClick();
    setCurrentIndex((prev) => (prev === 0 ? questions.length - 1 : prev - 1));
  };

  // Press Enter anywhere on the exam screen to advance to the next question
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (e.isComposing || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      if (showSubmitModal || showParentModal) return;

      e.preventDefault();
      handleNextQuestion();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextQuestion, showSubmitModal, showParentModal]);

  const renderQuestionInput = () => {
    if (!currentQ) return null;

    if (currentQ.type === 'tn' && currentQ.options) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {currentQ.options.map((opt, idx) => {
            const isSelected = answers[currentQ.id] === opt;
            const letter = String.fromCharCode(65 + idx);
            return (
              <button
                type="button"
                key={idx}
                onClick={() => {
                  handleAnswerChange(currentQ.id, opt);
                  clearAutoNextTimer();
                  autoNextTimerRef.current = window.setTimeout(() => {
                    autoNextTimerRef.current = null;
                    handleNextQuestion(false);
                  }, 220);
                }}
                className={`p-5 rounded-3xl border-3 text-left font-extrabold transition-all flex items-center gap-4 transform hover:scale-[1.02] shadow-md cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-600 border-yellow-300 text-white shadow-purple-300/50 scale-[1.02] ring-4 ring-purple-200'
                    : 'bg-white border-purple-100 hover:border-purple-300 text-purple-950 hover:bg-purple-50/50'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-base shadow shrink-0 ${
                    isSelected ? 'bg-yellow-300 text-purple-950' : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {letter}
                </div>
                <span className="text-lg sm:text-xl">
                  <FormattedText text={opt} />
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    if (currentQ.type === 'dt') {
      return (
        <div className="mt-6 space-y-3">
          <label className="block text-sm font-black text-purple-900">
            Điền từ đúng vào ô trống (nhấn Enter để sang câu tiếp):
          </label>
          <input
            ref={dtInputRef}
            type="text"
            value={answers[currentQ.id] || ''}
            onChange={(e) => handleAnswerChange(currentQ.id, e.target.value, false)}
            placeholder="Gõ đáp án của bé ở đây..."
            autoComplete="off"
            spellCheck={false}
            className="w-full px-6 py-4 rounded-3xl border-3 border-purple-200 focus:border-purple-600 focus:ring-4 focus:ring-purple-100 outline-none text-2xl font-black text-purple-950 bg-purple-50/40 shadow-inner"
          />
        </div>
      );
    }

    if (currentQ.type === 'sx' && currentQ.scrambledWords) {
      const currentSelected: string[] = answers[currentQ.id + '_selected'] || [];

      return (
        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-black text-purple-900">Câu đã sắp xếp:</p>
              {currentSelected.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setAnswers((prev) => {
                      const next = { ...prev, [currentQ.id + '_selected']: [], [currentQ.id]: '' };
                      answersRef.current = next;
                      return next;
                    });
                  }}
                  className="text-xs font-bold text-pink-600 hover:text-pink-700 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Xếp lại</span>
                </button>
              )}
            </div>
            <div className="min-h-[76px] p-4 bg-purple-50 border-3 border-dashed border-purple-300 rounded-3xl flex flex-wrap gap-2 items-center shadow-inner">
              {currentSelected.length === 0 && (
                <span className="text-purple-400 italic font-bold text-sm">
                  Chạm vào các từ bên dưới theo đúng thứ tự để ghép thành câu nhé! ✨
                </span>
              )}
              {currentSelected.map((item, idx) => {
                const word = item.slice(0, item.lastIndexOf('_'));
                return (
                  <button
                    type="button"
                    key={item}
                    onClick={() => {
                      soundFx.playClick();
                      const updated = currentSelected.filter((_, i) => i !== idx);
                      const sentence = updated.map((u) => u.slice(0, u.lastIndexOf('_'))).join(' ');
                      setAnswers((prev) => {
                        const next = {
                          ...prev,
                          [currentQ.id + '_selected']: updated,
                          [currentQ.id]: sentence,
                        };
                        answersRef.current = next;
                        return next;
                      });
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-black shadow-md hover:scale-105 transition cursor-pointer"
                  >
                    {word} ✕
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-black text-purple-900 mb-2">Các từ xáo trộn (chạm để chọn):</p>
            <div className="flex flex-wrap gap-3">
              {currentQ.scrambledWords.map((word, idx) => {
                const uniqueKey = `${word}_${idx}`;
                const isChosen = currentSelected.includes(uniqueKey);
                if (isChosen) return null;
                return (
                  <button
                    type="button"
                    key={uniqueKey}
                    onClick={() => {
                      soundFx.playClick();
                      const updated = [...currentSelected, uniqueKey];
                      const sentence = updated.map((u) => u.slice(0, u.lastIndexOf('_'))).join(' ');
                      setAnswers((prev) => {
                        const next = {
                          ...prev,
                          [currentQ.id + '_selected']: updated,
                          [currentQ.id]: sentence,
                        };
                        answersRef.current = next;
                        return next;
                      });
                    }}
                    className="px-5 py-3 bg-white border-3 border-purple-200 hover:border-purple-600 text-purple-950 rounded-2xl font-black shadow-md transition transform hover:scale-105 hover:bg-purple-50 cursor-pointer"
                  >
                    {word}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (currentQ.type === 'noi' && currentQ.matchingPairs) {
      const userPairMap: Record<string, string> = answers[currentQ.id] || {};
      const rightChoices =
        currentQ.rightOptions && currentQ.rightOptions.length > 0
          ? currentQ.rightOptions
          : currentQ.matchingPairs.map((p) => p.right);

      const connectPair = (leftId: string, rightText: string) => {
        const newMap: Record<string, string> = {};
        Object.entries(userPairMap).forEach(([k, v]) => {
          if (k !== leftId && v !== rightText) {
            newMap[k] = v;
          }
        });
        newMap[leftId] = rightText;
        soundFx.playSuccess();
        handleAnswerChange(currentQ.id, newMap, false);
        setSelectedMatchLeft(null);
        setSelectedMatchRight(null);
      };

      const handleLeftClick = (leftId: string) => {
        if (selectedMatchLeft === leftId) {
          soundFx.playClick();
          setSelectedMatchLeft(null);
          return;
        }
        if (selectedMatchRight !== null) {
          connectPair(leftId, selectedMatchRight);
          return;
        }
        if (userPairMap[leftId]) {
          soundFx.playClick();
          const newMap = { ...userPairMap };
          delete newMap[leftId];
          handleAnswerChange(currentQ.id, newMap, false);
          return;
        }
        soundFx.playClick();
        setSelectedMatchLeft(leftId);
      };

      const handleRightClick = (rightText: string, connectedLeftId?: string) => {
        if (selectedMatchRight === rightText) {
          soundFx.playClick();
          setSelectedMatchRight(null);
          return;
        }
        if (selectedMatchLeft !== null) {
          connectPair(selectedMatchLeft, rightText);
          return;
        }
        if (connectedLeftId) {
          soundFx.playClick();
          const newMap = { ...userPairMap };
          delete newMap[connectedLeftId];
          handleAnswerChange(currentQ.id, newMap, false);
          return;
        }
        soundFx.playClick();
        setSelectedMatchRight(rightText);
      };

      return (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-black text-purple-900 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-purple-600" />
              <span>Chạm 1 lần để chọn nối, chạm lần 2 tại ô đó để bỏ chọn (các cặp nối có màu giống nhau):</span>
            </p>
            {Object.keys(userPairMap).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  handleAnswerChange(currentQ.id, {});
                  setSelectedMatchLeft(null);
                  setSelectedMatchRight(null);
                }}
                className="text-xs font-bold text-pink-600 hover:text-pink-700 flex items-center gap-1 cursor-pointer bg-pink-50 px-2.5 py-1 rounded-xl border border-pink-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa kết nối</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Left Column */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-purple-700 tracking-wider bg-purple-100/80 px-3 py-1.5 rounded-xl text-center">
                Cột A (Vế trái)
              </h4>
              {currentQ.matchingPairs.map((pair, idx) => {
                const isSelected = selectedMatchLeft === pair.id;
                const connectedRight = userPairMap[pair.id];
                const isConnected = Boolean(connectedRight);
                const theme = PAIR_COLOR_THEMES[idx % PAIR_COLOR_THEMES.length];

                return (
                  <div
                    key={pair.id}
                    onClick={() => handleLeftClick(pair.id)}
                    className={`p-4 rounded-2xl border-3 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-md ${
                      isSelected
                        ? 'bg-purple-600 border-yellow-300 text-white ring-4 ring-purple-200 scale-[1.02]'
                        : isConnected
                        ? `${theme.bg} ${theme.border} ${theme.text} shadow-sm ring-2 ring-current/20`
                        : selectedMatchRight
                        ? 'bg-purple-50 border-purple-400 hover:border-purple-600 text-purple-950 animate-pulse'
                        : 'bg-white border-purple-200 hover:border-purple-400 text-purple-950 hover:bg-purple-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-yellow-300 text-purple-950'
                            : isConnected
                            ? theme.badge
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {pair.id || String.fromCharCode(65 + idx)}
                      </span>
                      <span className="font-extrabold text-base break-words leading-snug">
                        <FormattedText text={pair.left} />
                      </span>
                    </div>

                    {isConnected ? (
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0 ${theme.lightBadge}`}
                      >
                        <Check className="w-3 h-3" />
                        <span className="truncate max-w-[130px]">
                          <FormattedText text={connectedRight} />
                        </span>
                      </span>
                    ) : (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                          isSelected
                            ? 'bg-yellow-300 text-purple-950'
                            : selectedMatchRight
                            ? 'bg-purple-200 text-purple-900'
                            : 'text-gray-400 bg-gray-100'
                        }`}
                      >
                        {isSelected ? 'Bỏ chọn ✕' : selectedMatchRight ? 'Nhấn nối 👈' : 'Chạm chọn'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-indigo-700 tracking-wider bg-indigo-100/80 px-3 py-1.5 rounded-xl text-center">
                Cột B (Đáp án phải)
              </h4>
              {rightChoices.map((rightText, rIdx) => {
                const connectedLeftId = Object.keys(userPairMap).find(
                  (lId) => userPairMap[lId] === rightText
                );
                const isConnected = Boolean(connectedLeftId);
                const isSelected = selectedMatchRight === rightText;
                const matchingPairIdx = connectedLeftId
                  ? currentQ.matchingPairs?.findIndex((p) => p.id === connectedLeftId) ?? -1
                  : -1;
                const theme =
                  matchingPairIdx !== -1
                    ? PAIR_COLOR_THEMES[matchingPairIdx % PAIR_COLOR_THEMES.length]
                    : null;

                return (
                  <div
                    key={`${rIdx}_${rightText}`}
                    onClick={() => handleRightClick(rightText, connectedLeftId)}
                    className={`p-4 rounded-2xl border-3 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-md ${
                      isSelected
                        ? 'bg-indigo-600 border-yellow-300 text-white ring-4 ring-indigo-200 scale-[1.02]'
                        : isConnected && theme
                        ? `${theme.bg} ${theme.border} ${theme.text} shadow-sm ring-2 ring-current/20`
                        : selectedMatchLeft
                        ? 'bg-indigo-50 border-indigo-400 hover:border-indigo-600 text-indigo-950 animate-pulse'
                        : 'bg-white border-purple-200 hover:border-indigo-400 text-purple-950 hover:bg-indigo-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-yellow-300 text-indigo-950'
                            : isConnected && theme
                            ? theme.badge
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {rIdx + 1}
                      </span>
                      <span className="font-extrabold text-base break-words leading-snug">
                        <FormattedText text={rightText} />
                      </span>
                    </div>

                    {isConnected && theme ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${theme.lightBadge}`}
                        >
                          <Check className="w-3 h-3" />
                          <span>Nối ({connectedLeftId})</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            soundFx.playClick();
                            const newMap = { ...userPairMap };
                            delete newMap[connectedLeftId!];
                            handleAnswerChange(currentQ.id, newMap, false);
                          }}
                          className="w-7 h-7 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition cursor-pointer"
                          title="Hủy kết nối"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                          isSelected
                            ? 'bg-yellow-300 text-indigo-950'
                            : selectedMatchLeft
                            ? 'bg-indigo-200 text-indigo-900'
                            : 'text-gray-400 bg-gray-100'
                        }`}
                      >
                        {isSelected ? 'Bỏ chọn ✕' : selectedMatchLeft ? 'Nhấn nối 👉' : 'Chạm chọn'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const answeredCount = questions.filter((q) => isQuestionAnswered(q, answers)).length;
  const typeMeta = currentQ ? QUESTION_TYPE_LABELS[currentQ.type] : null;

  const handleRequestQuit = () => {
    soundFx.playClick();
    if (isAdminMode) {
      onQuit();
      return;
    }
    setParentInputPin('');
    setParentModalError('');
    setShowParentModal(true);
  };

  const handleVerifyParentPinAndQuit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const entered = parentInputPin.trim();
    const emailPass = (config.parentEmailPassword || '').trim();
    if (entered && (entered === parentPinExpected || (emailPass && entered === emailPass))) {
      soundFx.playSuccess();
      setShowParentModal(false);
      onQuit();
    } else {
      soundFx.playError();
      setParentModalError('Mật khẩu Phụ huynh không đúng!');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Fullscreen Reminder Banner when student presses ESC during locked exam */}
      {!isAdminMode && !isFullscreen && (
        <div className="mb-4 bg-amber-50 border-3 border-amber-300 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5 text-amber-950 text-xs sm:text-sm font-bold">
            <Maximize2 className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Bài thi đang ở chế độ tập trung toàn màn hình. Bấm nút bên cạnh để mở lại toàn màn hình nhé!</span>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              requestEnterFullscreen();
            }}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-purple-950 font-black text-xs flex items-center gap-1.5 shadow cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Mở toàn màn hình</span>
          </button>
        </div>
      )}

      {/* Top status bar */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl border-3 border-purple-200 p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 text-white flex items-center justify-center font-black text-lg shadow-md border-2 border-yellow-300">
            {config.grade}
          </div>
          <div>
            <h3 className="font-black text-purple-950 text-lg">{config.studentName}</h3>
            <p className="text-xs text-purple-600 font-bold">
              Lớp {config.grade} • Cấp {config.round} (
              {(
                {
                  1: 'Khởi động',
                  2: 'Vượt chướng ngại vật',
                  3: 'Tranh tài',
                  4: 'Tăng tốc',
                  5: 'Chinh phục đỉnh cao',
                } as Record<number, string>
              )[config.round] || `Vòng ${config.round}`}
              )
              {!isAdminMode && minStudySeconds > 0 && (
                <span className="ml-2 text-indigo-700">
                  • Đã học: {formatTime(totalStudySeconds)}/{config.minStudyMinutes}p
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center space-x-2 bg-purple-100 px-4 py-2.5 rounded-2xl border-2 border-purple-300 shadow-inner">
            <Clock className={`w-5 h-5 ${timeLeft < 300 ? 'text-red-600 animate-bounce' : 'text-purple-700'}`} />
            <span className={`font-mono font-black text-xl ${timeLeft < 300 ? 'text-red-600' : 'text-purple-950'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setShowSubmitModal(true);
            }}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl shadow-lg transition transform hover:scale-105 flex items-center gap-2 border-2 border-white/40 cursor-pointer"
          >
            <Send className="w-5 h-5" />
            <span>NỘP BÀI 🎯</span>
          </button>

          <button
            type="button"
            onClick={handleRequestQuit}
            className="px-4 py-3 bg-red-100 hover:bg-red-200 text-red-700 font-black rounded-2xl shadow transition flex items-center gap-1.5 text-xs cursor-pointer"
            title={isAdminMode ? 'Thoát về trang chủ' : 'Thoát cần mật khẩu Phụ huynh'}
          >
            {isAdminMode ? <LogOut className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            <span>{isAdminMode ? 'Thoát' : 'Thoát (Khóa PH)'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main question box */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border-3 border-purple-200 p-6 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
              <div className="flex items-center flex-wrap gap-2">
                <span className="px-4 py-1.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full text-xs font-black uppercase tracking-wider shadow">
                  Câu {currentIndex + 1} / {questions.length}
                </span>
                {typeMeta && (
                  <span className={`px-3 py-1 rounded-full text-xs font-black border ${typeMeta.color}`}>
                    {typeMeta.label}
                  </span>
                )}
                {currentQ?.topic && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {currentQ.topic}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {currentQ?.id && (
                  <span className="text-[11px] font-mono font-bold text-gray-400">{currentQ.id}</span>
                )}
                <span className="text-xs font-black text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                  Đã làm: {answeredCount}/{questions.length}
                </span>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-purple-950 leading-snug">
              <FormattedText text={currentQ?.question} />
            </h2>

            {renderQuestionInput()}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between gap-3 pt-8 mt-10 border-t-2 border-purple-100">
            <button
              type="button"
              onClick={handlePrevQuestion}
              className="px-6 py-3 rounded-2xl font-black flex items-center gap-2 transition bg-purple-100 hover:bg-purple-200 text-purple-900 shadow cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
              <span>Câu trước</span>
            </button>

            <button
              type="button"
              onClick={() => handleNextQuestion()}
              className="px-7 py-3 rounded-2xl font-black flex items-center gap-2 transition shadow-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-indigo-700 text-white transform hover:scale-105 cursor-pointer"
            >
              <span>Câu tiếp (chưa làm)</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-white/20 px-2 py-0.5 rounded-lg font-bold">
                <CornerDownLeft className="w-3 h-3" />
                Enter
              </span>
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Question palette sidebar */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border-3 border-purple-200 p-4 flex flex-col h-[540px]">
          <h4 className="font-black text-purple-950 mb-3 text-sm flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            <span>Danh sách câu hỏi</span>
          </h4>
          <div className="grid grid-cols-10 gap-1.5 overflow-y-auto pr-1 flex-1 content-start">
            {questions.map((q, idx) => {
              const isAnswered = isQuestionAnswered(q, answers);
              const isCurrent = currentIndex === idx;

              return (
                <button
                  type="button"
                  key={`${q.id}_${idx}`}
                  onClick={() => {
                    soundFx.playClick();
                    setCurrentIndex(idx);
                  }}
                  className={`h-9 rounded-xl font-black text-[11px] transition flex items-center justify-center border-2 shadow-sm cursor-pointer ${
                    isCurrent
                      ? 'ring-2 ring-pink-300 bg-gradient-to-r from-pink-500 to-purple-600 text-white scale-105 z-10'
                      : isAnswered
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                      : 'bg-purple-50/50 border-purple-200 text-purple-800 hover:bg-purple-100'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-4 mt-4 border-t-2 border-purple-100 text-xs font-bold text-gray-600 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 bg-emerald-100 border-2 border-emerald-400 rounded-lg"></div>
              <span>Đã trả lời</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 bg-purple-50 border-2 border-purple-200 rounded-lg"></div>
              <span>Chưa trả lời</span>
            </div>
            <p className="text-[11px] text-purple-600 pt-1">
              Mẹo: Nhấn phím <strong>Enter</strong> để chuyển nhanh sang câu tiếp theo.
            </p>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border-4 border-purple-300 animate-in fade-in zoom-in duration-200 text-center">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 border-2 border-amber-300 animate-bounce">
              <AlertCircle className="w-9 h-9" />
            </div>
            <h3 className="text-2xl font-black text-purple-950 mb-2">Xác nhận nộp bài?</h3>
            <p className="text-gray-600 text-base mb-6 font-medium">
              Bé đã trả lời <strong className="text-purple-600">{answeredCount}</strong> / {questions.length} câu hỏi. Bé có chắc chắn muốn nộp bài ngay không?
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setShowSubmitModal(false);
                }}
                className="py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition cursor-pointer"
              >
                Làm tiếp
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFx.playSuccess();
                  handleSubmitExam();
                }}
                className="py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl shadow-lg transition cursor-pointer"
              >
                Nộp bài luôn! 🎯
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parent PIN / Password Modal for Exiting to Main Screen */}
      {showParentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleVerifyParentPinAndQuit}
            className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border-4 border-indigo-300 animate-in fade-in zoom-in duration-200"
          >
            <div className="w-16 h-16 rounded-3xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto mb-4 border-2 border-indigo-300">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-purple-950 text-center mb-2">Xác thực Phụ huynh</h3>
            <p className="text-gray-600 text-sm text-center mb-5 font-medium">
              {remainingStudySeconds > 0
                ? `Chưa đạt thời gian học tối thiểu (${config.minStudyMinutes} phút, còn thiếu ${formatTime(remainingStudySeconds)}). Nhập Mật khẩu Phụ huynh để thoát về giao diện chính.`
                : 'Vui lòng nhập Mật khẩu Phụ huynh để thoát bài thi về giao diện chính.'}
            </p>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type={showPinText ? 'text' : 'password'}
                  value={parentInputPin}
                  onChange={(e) => {
                    setParentInputPin(e.target.value);
                    setParentModalError('');
                  }}
                  placeholder="Nhập mật khẩu phụ huynh..."
                  autoFocus
                  className="w-full pl-4 pr-11 py-3.5 rounded-2xl border-3 border-indigo-200 focus:border-indigo-600 bg-indigo-50/50 font-black text-gray-800 text-center text-xl shadow-inner outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPinText((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-800 p-1 cursor-pointer"
                >
                  {showPinText ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {parentModalError && <p className="text-xs font-bold text-red-600 text-center">{parentModalError}</p>}

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setShowParentModal(false);
                  }}
                  className="py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition cursor-pointer"
                >
                  Quay lại thi
                </button>
                <button
                  type="submit"
                  className="py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-2xl shadow-lg transition cursor-pointer"
                >
                  Xác nhận thoát
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
