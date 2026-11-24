import React, { useState } from 'react';
import { ExamResultData, Question } from '../types';
import { X, Trophy, Clock, Calendar, GraduationCap, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { soundFx } from '../utils/sound';
import { FormattedText } from './FormattedText';

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
            history.map((item, idx) => (
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
            ))
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
