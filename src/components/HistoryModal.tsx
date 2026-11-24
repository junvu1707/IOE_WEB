import React, { useMemo, useState } from 'react';
import { ExamResultData, Question } from '../types';
import { X, Trophy, Calendar, GraduationCap, Eye, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { soundFx } from '../utils/sound';
import { FormattedText } from './FormattedText';

interface ScoreChartPoint {
  label: string;
  percentage: number;
  score: number;
  totalQuestions: number;
  roundName: string;
  grade: number;
  studentName: string;
  dateTime: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ScoreChartPoint }>;
}

const ScoreTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;

  return (
    <div className="bg-white/95 backdrop-blur-sm border-2 border-purple-300 rounded-2xl p-3 shadow-xl text-xs space-y-1 max-w-[230px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-black text-purple-950">{data.roundName}</span>
        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md font-extrabold">
          Lớp {data.grade}
        </span>
      </div>
      <p className="text-gray-600 font-semibold">Thí sinh: {data.studentName}</p>
      <div className="pt-1 border-t border-purple-100 flex items-baseline justify-between gap-3">
        <span className="font-bold text-gray-500">Điểm số:</span>
        <span className="font-black text-sm text-pink-600">
          {data.score}/{data.totalQuestions} ({data.percentage}%)
        </span>
      </div>
      <p className="text-[11px] text-gray-400 font-medium">{data.dateTime}</p>
    </div>
  );
};

function formatHistoryAnswer(q: Question, userAns: any): string {
  if (!userAns || userAns === '(Chưa trả lời)') return '(Chưa trả lời)';
  if (q.type === 'noi' && q.matchingPairs && typeof userAns === 'object') {
    return q.matchingPairs
      .map((pair) => `${pair.left} → ${userAns[pair.id] || '(Chưa nối)'}`)
      .join(' | ');
  }
  return String(userAns);
}

interface HistoryModalProps {
  history: ExamResultData[];
  onClose: () => void;
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ history, onClose, onClearHistory }) => {
  const [selectedAttempt, setSelectedAttempt] = useState<ExamResultData | null>(null);

  const chartData = useMemo<ScoreChartPoint[]>(() => {
    const recent = history.slice(0, 10).reverse();
    return recent.map((item, idx) => {
      const dt = new Date(item.completedAt);
      const dateStr = dt.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      return {
        label: `Bài ${idx + 1}`,
        percentage: item.percentage,
        score: item.score,
        totalQuestions: item.totalQuestions,
        roundName: item.roundName,
        grade: item.grade,
        studentName: item.studentName,
        dateTime: `${dateStr} • ${timeStr}`,
      };
    });
  }, [history]);

  const averagePercentage = useMemo(() => {
    if (chartData.length === 0) return 0;
    const sum = chartData.reduce((acc, item) => acc + item.percentage, 0);
    return Math.round(sum / chartData.length);
  }, [chartData]);

  const bestPercentage = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.max(...chartData.map((item) => item.percentage));
  }, [chartData]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m} phút ${s} giây`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="w-6 h-6 text-yellow-300" />
            <h3 className="text-xl font-extrabold">
              {selectedAttempt ? 'Chi Tiết Bài Làm Của Lịch Sử' : 'Lịch Sử Thi Đấu & Chi Tiết Đề'}
            </h3>
          </div>
          <button
            onClick={() => {
              soundFx.playClick();
              if (selectedAttempt) setSelectedAttempt(null);
              else onClose();
            }}
            className="w-9 h-9 bg-white/15 hover:bg-white/30 rounded-xl flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {selectedAttempt ? (
            <div className="space-y-6">
              <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="font-black text-purple-950 text-lg">
                    {selectedAttempt.roundName} (Lớp {selectedAttempt.grade})
                  </h4>
                  <p className="text-xs text-purple-700 font-bold mt-0.5">
                    Thí sinh: <strong>{selectedAttempt.studentName}</strong> • Thời gian làm bài:{' '}
                    {formatTime(selectedAttempt.timeSpentSeconds)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="block text-xs font-bold text-gray-500">Điểm số đạt được</span>
                  <span className="text-xl font-black text-purple-700">
                    {selectedAttempt.score} / {selectedAttempt.totalQuestions} ({selectedAttempt.percentage}%)
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <h5 className="font-black text-purple-950 text-base">Chi tiết các câu hỏi & đáp án:</h5>
                {selectedAttempt.answers && selectedAttempt.answers.length > 0 && selectedAttempt.questions ? (
                  selectedAttempt.questions.map((q, idx) => {
                    const ansRecord = selectedAttempt.answers.find((a) => a.questionId === q.id);
                    const isCorrect = ansRecord ? ansRecord.isCorrect : false;
                    const userAns = ansRecord ? ansRecord.userAnswer : '(Không có dữ liệu)';

                    return (
                      <div
                        key={`${q.id}_${idx}`}
                        className={`p-4 rounded-2xl border-3 ${
                          isCorrect ? 'bg-emerald-50/60 border-emerald-200' : 'bg-red-50/60 border-red-200'
                        } space-y-2`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            {isCorrect ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <span className="font-black text-purple-950 text-sm sm:text-base">
                                Câu {idx + 1}: <FormattedText text={q.question} />
                              </span>
                              {q.topic && (
                                <span className="ml-2 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800">
                                  {q.topic}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm pl-7">
                          <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                            <span className="font-bold text-gray-500 block">Học sinh chọn:</span>
                            <span className={`font-extrabold break-words ${isCorrect ? 'text-emerald-800' : 'text-red-700'}`}>
                              <FormattedText text={formatHistoryAnswer(q, userAns)} />
                            </span>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                            <span className="font-bold text-gray-500 block">Đáp án đúng:</span>
                            <span className="font-extrabold text-emerald-800 break-words">
                              <FormattedText
                                text={
                                  q.type === 'noi' && q.matchingPairs
                                    ? q.matchingPairs.map((p) => `${p.left} → ${p.right}`).join(' | ')
                                    : String(q.correct || '')
                                }
                              />
                            </span>
                          </div>
                        </div>

                        {q.explanation && (
                          <div className="pl-7 text-xs text-purple-900 font-medium bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                            💡 <strong>Giải thích:</strong> <FormattedText text={q.explanation} />
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500 italic">Bài thi này lưu điểm tổng kết (chi tiết câu hỏi được lưu cho các bài thi mới nhất).</p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setSelectedAttempt(null);
                  }}
                  className="px-5 py-2.5 bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold rounded-xl text-sm transition cursor-pointer"
                >
                  ← Quay lại danh sách lịch sử
                </button>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <h4 className="font-black text-purple-950 text-lg">Chưa có lịch sử thi nào</h4>
              <p className="text-gray-500 text-sm mt-1">Hãy hoàn thành các bài thi để lưu lại lịch sử chi tiết tại đây.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Score Progression Chart (Last 10 Exams) */}
              <div className="bg-gradient-to-br from-purple-50/80 via-white to-pink-50/70 border-2 border-purple-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-purple-950 text-sm sm:text-base">
                        Biểu Đồ Tiến Bộ Điểm Số ({chartData.length} bài gần nhất)
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Theo dõi tỷ lệ trả lời đúng (%) qua các lần thi gần đây
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-extrabold">
                    <span className="px-2.5 py-1 rounded-xl bg-purple-100 text-purple-800">
                      TB: {averagePercentage}%
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800">
                      Cao nhất: {bestPercentage}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-56 pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#6b21a8', fontWeight: 700 }}
                        axisLine={{ stroke: '#d8b4fe' }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ScoreTooltip />} />
                      {chartData.length > 1 && (
                        <ReferenceLine
                          y={averagePercentage}
                          stroke="#c084fc"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="percentage"
                        name="Điểm (%)"
                        stroke="#9333ea"
                        strokeWidth={3}
                        dot={{ r: 5, fill: '#ec4899', stroke: '#ffffff', strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: '#9333ea', stroke: '#fde047', strokeWidth: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Exam History List */}
              <div className="space-y-3">
                {history.map((item, idx) => (
              <div
                key={item.id || idx}
                className="bg-purple-50/40 hover:bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-purple-600 text-white rounded-md text-xs font-black">
                      Lớp {item.grade}
                    </span>
                    <span className="font-black text-purple-950 text-base">{item.roundName}</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium flex items-center gap-2 flex-wrap">
                    <span>Thí sinh: <strong>{item.studentName}</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-purple-600" />
                      {new Date(item.completedAt).toLocaleDateString('vi-VN')}{' '}
                      {new Date(item.completedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-purple-200">
                  <div className="text-right">
                    <span className="block text-xs font-bold text-gray-500">Điểm số</span>
                    <span className="text-lg font-black text-purple-700">
                      {item.score} / {item.totalQuestions} ({item.percentage}%)
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      soundFx.playClick();
                      setSelectedAttempt(item);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Xem chi tiết</span>
                  </button>
                </div>
              </div>
            ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!selectedAttempt && history.length > 0 && (
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <button
              onClick={() => {
                soundFx.playClick();
                onClearHistory();
              }}
              className="text-xs text-red-600 hover:text-red-700 font-bold px-3 py-2 rounded-lg transition cursor-pointer"
            >
              Xóa toàn bộ lịch sử
            </button>
            <button
              onClick={() => {
                soundFx.playClick();
                onClose();
              }}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm transition shadow cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
