import React, { useState, useEffect, useRef } from 'react';
import { Question, ExamConfig, ExamResultData, UserAnswer, QuestionType, MatchingPair } from '../types';
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
} from 'lucide-react';
import { soundFx } from '../utils/sound';
import { isSentenceAnswerCorrect } from '../data/questionBank';
import { FormattedText } from './FormattedText';

interface ExamScreenProps {
  questions: Question[];
  config: ExamConfig;
  onSubmitExam: (result: ExamResultData) => void;
  onQuit: () => void;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, { label: string; color: string }> = {
  tn: { label: 'Trắc nghiệm', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  noi: { label: 'Nối 2 vế', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  dt: { label: 'Điền từ', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  sx: { label: 'Sắp xếp câu', color: 'bg-pink-100 text-pink-800 border-pink-200' },
};

// Distinct color themes for matching pairs so each connected pair shares the same color
const PAIR_COLOR_THEMES = [
  { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-950', badge: 'bg-rose-600 text-white', lightBadge: 'bg-rose-100 text-rose-800' },
  { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-950', badge: 'bg-blue-600 text-white', lightBadge: 'bg-blue-100 text-blue-800' },
  { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-950', badge: 'bg-emerald-600 text-white', lightBadge: 'bg-emerald-100 text-emerald-800' },
  { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-950', badge: 'bg-amber-600 text-white', lightBadge: 'bg-amber-100 text-amber-800' },
  { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-950', badge: 'bg-purple-600 text-white', lightBadge: 'bg-purple-100 text-purple-800' },
  { bg: 'bg-cyan-50', border: 'border-cyan-400', text: 'text-cyan-950', badge: 'bg-cyan-600 text-white', lightBadge: 'bg-cyan-100 text-cyan-800' },
];

export const ExamScreen: React.FC<ExamScreenProps> = ({ questions, config, onSubmitExam }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const answersRef = useRef<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(config.timeLimitSeconds);
  const [startTime] = useState(Date.now());
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const submittedRef = useRef(false);

  // For interactive matching question: selected left item ID
  const [selectedMatchLeft, setSelectedMatchLeft] = useState<string | null>(null);

  const currentQ = questions[currentIndex];

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    setSelectedMatchLeft(null);
  }, [currentIndex]);

  useEffect(() => {
    const timer = setInterval(() => {
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
  }, []);

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
      1: 'Vòng Loại',
      2: 'Vòng Trường',
      3: 'Vòng Phường/Quận',
      4: 'Vòng Tỉnh/Thành phố',
      5: 'Vòng Quốc Gia',
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

  const handleNextQuestion = () => {
    soundFx.playClick();
    const nextUnanswered = questions.findIndex(
      (q, idx) => idx > currentIndex && !isQuestionAnswered(q, answers)
    );
    if (nextUnanswered !== -1) {
      setCurrentIndex(nextUnanswered);
    } else {
      const firstUnansweredAny = questions.findIndex((q) => !isQuestionAnswered(q, answers));
      if (firstUnansweredAny !== -1) {
        setCurrentIndex(firstUnansweredAny);
      } else {
        setCurrentIndex((prev) => (prev + 1) % questions.length);
      }
    }
  };

  const handlePrevQuestion = () => {
    soundFx.playClick();
    setCurrentIndex((prev) => (prev === 0 ? questions.length - 1 : prev - 1));
  };

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
                onClick={() => handleAnswerChange(currentQ.id, opt)}
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
          <label className="block text-sm font-black text-purple-900">Điền từ đúng vào ô trống:</label>
          <input
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

      return (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-purple-900 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-purple-600" />
              <span>Nối cột trái với cột phải (Các cặp đã nối sẽ có màu giống nhau):</span>
            </p>
            {Object.keys(userPairMap).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  handleAnswerChange(currentQ.id, {});
                  setSelectedMatchLeft(null);
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
                    onClick={() => {
                      soundFx.playClick();
                      setSelectedMatchLeft(pair.id);
                    }}
                    className={`p-4 rounded-2xl border-3 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-md ${
                      isSelected
                        ? 'bg-purple-600 border-yellow-300 text-white ring-4 ring-purple-200 scale-[1.02]'
                        : isConnected
                        ? `${theme.bg} ${theme.border} ${theme.text} shadow-sm ring-2 ring-current/20`
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
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0 ${
                          isConnected ? theme.lightBadge : ''
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span className="truncate max-w-[130px]">
                          <FormattedText text={connectedRight} />
                        </span>
                      </span>
                    ) : (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                          isSelected ? 'bg-yellow-300 text-purple-950 animate-pulse' : 'text-gray-400 bg-gray-100'
                        }`}
                      >
                        {isSelected ? 'Đang chọn 👆' : 'Chạm nối'}
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
                    onClick={() => {
                      if (!selectedMatchLeft) {
                        soundFx.playError();
                        return;
                      }
                      soundFx.playSuccess();
                      const newMap = { ...userPairMap, [selectedMatchLeft]: rightText };
                      handleAnswerChange(currentQ.id, newMap);
                      setSelectedMatchLeft(null);
                    }}
                    className={`p-4 rounded-2xl border-3 transition-all flex items-center justify-between gap-3 shadow-md ${
                      isConnected && theme
                        ? `${theme.bg} ${theme.border} ${theme.text} shadow-sm ring-2 ring-current/20`
                        : selectedMatchLeft
                        ? 'bg-indigo-50 border-indigo-400 hover:border-indigo-600 text-indigo-950 cursor-pointer animate-pulse'
                        : 'bg-white border-purple-200 text-purple-950 opacity-90'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${
                          isConnected && theme ? theme.badge : 'bg-indigo-100 text-indigo-700'
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
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${theme.lightBadge}`}>
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
                            handleAnswerChange(currentQ.id, newMap);
                          }}
                          className="w-7 h-7 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition cursor-pointer"
                          title="Hủy kết nối"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg shrink-0">
                        {selectedMatchLeft ? 'Nhấn nối 👉' : 'Chưa nối'}
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Top status bar */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-xl border-3 border-purple-200 p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 text-white flex items-center justify-center font-black text-lg shadow-md border-2 border-yellow-300">
            {config.grade}
          </div>
          <div>
            <h3 className="font-black text-purple-950 text-lg">{config.studentName}</h3>
            <p className="text-xs text-purple-600 font-bold">
              Lớp {config.grade} • Vòng {config.round}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-purple-100 px-4 py-2.5 rounded-2xl border-2 border-purple-300 shadow-inner">
            <Clock className={`w-5 h-5 ${timeLeft < 300 ? 'text-red-600 animate-bounce' : 'text-purple-700'}`} />
            <span className={`font-mono font-black text-xl ${timeLeft < 300 ? 'text-red-600' : 'text-purple-950'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>

          <button
            onClick={() => {
              soundFx.playClick();
              setShowSubmitModal(true);
            }}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl shadow-lg transition transform hover:scale-105 flex items-center gap-2 border-2 border-white/40 cursor-pointer"
          >
            <Send className="w-5 h-5" />
            <span>NỘP BÀI 🎯</span>
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
          <div className="flex items-center justify-between pt-8 mt-10 border-t-2 border-purple-100">
            <button
              onClick={handlePrevQuestion}
              className="px-6 py-3 rounded-2xl font-black flex items-center gap-2 transition bg-purple-100 hover:bg-purple-200 text-purple-900 shadow cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6" />
              <span>Câu trước</span>
            </button>

            <button
              onClick={handleNextQuestion}
              className="px-8 py-3 rounded-2xl font-black flex items-center gap-2 transition shadow-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white transform hover:scale-105 cursor-pointer"
            >
              <span>Câu tiếp (chưa làm)</span>
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Question palette sidebar (10 questions per row) */}
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
                onClick={() => {
                  soundFx.playClick();
                  setShowSubmitModal(false);
                }}
                className="py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition cursor-pointer"
              >
                Làm tiếp
              </button>
              <button
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
    </div>
  );
};
