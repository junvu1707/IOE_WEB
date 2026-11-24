import React, { useEffect, useState } from 'react';
import { ExamResultData, Question } from '../types';
import { Trophy, CheckCircle2, XCircle, Sparkles, RefreshCcw, Home, Brain, Star, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFx } from '../utils/sound';
import { FormattedText } from './FormattedText';

interface ExamResultProps {
  result: ExamResultData;
  onRetry: () => void;
  onHome: () => void;
}

function formatUserAnswer(q: Question, userAns: any): string {
  if (!userAns || userAns === '(Chưa trả lời)') return '(Chưa trả lời)';
  if (q.type === 'noi' && q.matchingPairs && typeof userAns === 'object') {
    const entries = q.matchingPairs.map((pair) => {
      const chosen = userAns[pair.id] || '(Chưa nối)';
      return `${pair.left} → ${chosen}`;
    });
    return entries.join(' | ');
  }
  return String(userAns);
}

function formatCorrectAnswer(q: Question): string {
  if (q.type === 'noi' && q.matchingPairs) {
    return q.matchingPairs.map((pair) => `${pair.left} → ${pair.right}`).join(' | ');
  }
  return String(q.correct || '');
}

export const ExamResult: React.FC<ExamResultProps> = ({ result, onRetry, onHome }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>(result.aiAnalysis || '');
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'incorrect' | 'ai'>('overview');

  useEffect(() => {
    if (result.percentage >= 50) {
      soundFx.playSuccess();
      confetti({
        particleCount: 180,
        spread: 100,
        origin: { y: 0.6 },
      });
    } else {
      soundFx.playError();
    }

    if (!aiAnalysis) {
      fetchAiAnalysis();
    }
  }, []);

  const buildLocalFallbackAnalysis = (): string => {
    const incorrect = result.incorrectQuestions;
    if (incorrect.length === 0) {
      return `🎉 Xuất sắc! ${result.studentName} đã trả lời đúng toàn bộ ${result.totalQuestions}/${result.totalQuestions} câu ở ${result.roundName} (Lớp ${result.grade}). Hãy thử sức ở vòng thi cao hơn để tiếp tục bứt phá nhé!`;
    }

    const typeLabels: Record<string, string> = {
      tn: 'Trắc nghiệm',
      noi: 'Nối 2 vế',
      dt: 'Điền từ',
      sx: 'Sắp xếp câu',
    };

    const topicCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();

    incorrect.forEach(({ question }) => {
      const topic = question.topic?.trim() || 'Kiến thức tổng hợp';
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      const tLabel = typeLabels[question.type] || question.type;
      typeCounts.set(tLabel, (typeCounts.get(tLabel) || 0) + 1);
    });

    const topTopics = [...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => `- **${topic}**: sai ${count} câu`)
      .join('\n');

    const topTypes = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tLabel, count]) => `- **${tLabel}**: sai ${count} câu`)
      .join('\n');

    return `### 1. Tổng quan bài làm
- Thí sinh: **${result.studentName}** — Lớp ${result.grade} (${result.roundName})
- Kết quả: **${result.score}/${result.totalQuestions} câu đúng (${result.percentage}%)**

### 2. Các chủ điểm cần ôn tập ưu tiên
${topTopics}

### 3. Phân bố lỗi sai theo dạng bài
${topTypes}

### 4. Gợi ý cải thiện cho bé
- Mở tab **❌ Câu trả lời sai** bên cạnh để đọc kỹ phần **Giải thích** cho từng câu vừa làm nhầm.
- Ôn lại 2–3 chủ điểm sai nhiều nhất ở trên, sau đó bấm **Thi lại / Đề mới** để hệ thống sinh bộ đề ngẫu nhiên mới và kiểm tra sự tiến bộ nhé!`;
  };

  const fetchAiAnalysis = async () => {
    setLoadingAi(true);
    try {
      const res = await fetch('/api/analyze-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: result.studentName,
          grade: result.grade,
          roundName: result.roundName,
          score: result.score,
          totalQuestions: result.totalQuestions,
          incorrectAnswers: result.incorrectQuestions.slice(0, 15).map((item) => ({
            id: item.question.id,
            type: item.question.type,
            topic: item.question.topic || '',
            question: item.question.question,
            userAnswer: formatUserAnswer(item.question, item.userAnswer),
            correctAnswer: formatCorrectAnswer(item.question),
            explanation: item.question.explanation || '',
          })),
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.analysis) {
        setAiAnalysis(data.analysis);
      } else {
        setAiAnalysis(buildLocalFallbackAnalysis());
      }
    } catch (err) {
      console.warn('AI analysis endpoint unavailable, using local breakdown:', err);
      setAiAnalysis(buildLocalFallbackAnalysis());
    } finally {
      setLoadingAi(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m} phút ${s} giây`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border-4 border-purple-200 overflow-hidden">
        {/* Top Celebration Banner */}
        <div className="bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <Star className="w-10 h-10 text-yellow-300 fill-yellow-300 animate-spin" />
          </div>
          <div className="w-24 h-24 bg-white/20 border-3 border-yellow-300 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl backdrop-blur-md animate-bounce">
            <Trophy className="w-12 h-12 text-yellow-300" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-2 tracking-tight drop-shadow-md">
            {result.percentage >= 80 ? 'XUẤT SẮC! BÉ LÀ SIÊU SAO 🌟' : result.percentage >= 50 ? 'LÀM TỐT LẮM! 🏅' : 'CỐ GẮNG HƠN NỮA NHÉ! 💪'}
          </h2>
          <p className="text-pink-100 font-bold text-base">Thí sinh: <strong className="text-yellow-300">{result.studentName}</strong> • {result.roundName} (Lớp {result.grade})</p>

          <div className="flex justify-center gap-4 mt-6">
            <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-white/30 text-center shadow-lg">
              <span className="block text-xs font-bold text-pink-200">Điểm số</span>
              <span className="text-3xl font-black text-yellow-300">{result.score} / {result.totalQuestions}</span>
            </div>
            <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-white/30 text-center shadow-lg">
              <span className="block text-xs font-bold text-pink-200">Tỷ lệ đúng</span>
              <span className="text-3xl font-black text-emerald-300">{result.percentage}%</span>
            </div>
            <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-white/30 text-center shadow-lg">
              <span className="block text-xs font-bold text-pink-200">Thời gian</span>
              <span className="text-xl font-black text-white">{formatTime(result.timeSpentSeconds)}</span>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b-2 border-purple-100 bg-purple-50/50 px-6">
          <button
            onClick={() => {
              soundFx.playClick();
              setActiveTab('overview');
            }}
            className={`py-4 px-6 font-black text-sm sm:text-base border-b-4 transition ${
              activeTab === 'overview'
                ? 'border-purple-600 text-purple-900 bg-white shadow-sm'
                : 'border-transparent text-purple-400 hover:text-purple-700'
            }`}
          >
            🎯 Tổng quan kết quả
          </button>
          <button
            onClick={() => {
              soundFx.playClick();
              setActiveTab('incorrect');
            }}
            className={`py-4 px-6 font-black text-sm sm:text-base border-b-4 transition flex items-center gap-2 ${
              activeTab === 'incorrect'
                ? 'border-purple-600 text-purple-900 bg-white shadow-sm'
                : 'border-transparent text-purple-400 hover:text-purple-700'
            }`}
          >
            <span>❌ Câu trả lời sai ({result.incorrectQuestions.length})</span>
          </button>
          <button
            onClick={() => {
              soundFx.playClick();
              setActiveTab('ai');
            }}
            className={`py-4 px-6 font-black text-sm sm:text-base border-b-4 transition flex items-center gap-2 ${
              activeTab === 'ai'
                ? 'border-purple-600 text-purple-900 bg-white shadow-sm'
                : 'border-transparent text-purple-400 hover:text-purple-700'
            }`}
          >
            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
            <span>🤖 Phân tích AI & Gợi ý</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 sm:p-10">
          {activeTab === 'overview' && (
            <div className="space-y-6 text-center py-6">
              <div className="max-w-lg mx-auto bg-gradient-to-br from-purple-50 to-pink-50 border-3 border-purple-200 rounded-3xl p-8 text-purple-950 shadow-xl">
                <h3 className="font-black text-xl mb-3 flex items-center justify-center gap-2">
                  <Award className="w-7 h-7 text-yellow-500" />
                  <span>Lời nhận xét cho bé</span>
                </h3>
                <p className="text-base text-purple-900 font-bold leading-relaxed">
                  {result.percentage >= 80
                    ? '🌟 Bé đã hoàn thành bài thi cực kỳ xuất sắc! Kiến thức tiếng Anh của bé vững vàng như một chú ong chăm chỉ!'
                    : result.percentage >= 50
                    ? '🏅 Bé làm rất tốt! Hãy tiếp tục rèn luyện thêm một chút để đạt điểm tuyệt đối ở vòng thi sau nhé!'
                    : '💪 Đừng nản lòng bé nhé! Hãy cùng AI xem lại các câu chưa đúng để ôn tập thêm nha!'}
                </p>
              </div>

              <div className="flex justify-center gap-4 pt-4">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onRetry();
                  }}
                  className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black rounded-2xl shadow-xl transition transform hover:scale-105 flex items-center gap-2 border-2 border-yellow-300"
                >
                  <RefreshCcw className="w-5 h-5" />
                  <span>THI LẠI / ĐỀ MỚI 🚀</span>
                </button>
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onHome();
                  }}
                  className="px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black rounded-2xl transition flex items-center gap-2 shadow"
                >
                  <Home className="w-5 h-5" />
                  <span>VỀ TRANG CHỦ</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'incorrect' && (
            <div className="space-y-4">
              {result.incorrectQuestions.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3 animate-bounce" />
                  <h3 className="text-2xl font-black text-purple-950">Quá đỉnh! Không có câu nào sai! 🌟</h3>
                  <p className="text-gray-500 text-base mt-1 font-semibold">Bé đã giành trọn điểm 10 tuyệt đối!</p>
                </div>
              ) : (
                result.incorrectQuestions.map((item, idx) => (
                  <div key={`${item.question.id}_${idx}`} className="bg-red-50/70 border-3 border-red-200 rounded-3xl p-6 space-y-3 shadow-md">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-6 h-6 text-red-600 shrink-0" />
                        <span className="font-black text-purple-950 text-base sm:text-lg">
                          Câu {idx + 1}: <FormattedText text={item.question.question} />
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.question.topic && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                            {item.question.topic}
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-gray-500">{item.question.id}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pl-8">
                      <div className="bg-white p-4 rounded-2xl border-2 border-red-100 shadow-sm">
                        <span className="block text-xs font-black text-red-600 mb-1">Bé đã chọn:</span>
                        <span className="font-extrabold text-gray-800 text-sm sm:text-base break-words">
                          <FormattedText text={formatUserAnswer(item.question, item.userAnswer)} />
                        </span>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border-2 border-emerald-100 shadow-sm">
                        <span className="block text-xs font-black text-emerald-600 mb-1">Đáp án đúng:</span>
                        <span className="font-extrabold text-emerald-800 text-sm sm:text-base break-words">
                          <FormattedText text={formatCorrectAnswer(item.question)} />
                        </span>
                      </div>
                    </div>
                    {item.question.explanation && (
                      <div className="pl-8 text-xs sm:text-sm text-purple-950 font-medium bg-amber-50 p-4 rounded-2xl border-2 border-amber-200 shadow-inner">
                        💡 <strong>Giải thích cho bé:</strong>{' '}
                        <FormattedText text={item.question.explanation} />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-6">
              {loadingAi ? (
                <div className="text-center py-16 space-y-4">
                  <Brain className="w-14 h-14 text-purple-600 animate-spin mx-auto" />
                  <p className="font-black text-purple-950 text-lg">Trợ lý AI đang phân tích bài làm của bé và lập lộ trình ôn tập...</p>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 border-3 border-purple-300 rounded-3xl p-6 sm:p-10 space-y-5 shadow-xl">
                  <div className="flex items-center gap-3 border-b-2 border-purple-200 pb-4">
                    <Sparkles className="w-7 h-7 text-purple-600 animate-pulse" />
                    <h3 className="text-2xl font-black text-purple-950">Phân Tích Thông Minh & Lời Khuyên Từ AI</h3>
                  </div>
                  <div className="prose prose-purple max-w-none text-purple-950 leading-relaxed space-y-3 whitespace-pre-line text-base font-medium">
                    {aiAnalysis}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
