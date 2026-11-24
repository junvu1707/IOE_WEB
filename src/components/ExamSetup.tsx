import React, { useState, useEffect, useRef } from 'react';
import { GradeLevel, ContestRound, ExamConfig, GitHubRepoIndex, LoadedExamPool } from '../types';
import {
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  CloudDownload,
  GraduationCap,
  Trophy,
  Clock,
  FileText,
  Play,
  Rocket,
} from 'lucide-react';
import { soundFx } from '../utils/sound';
import { validateAccountId, isAccountAuthorizedForGrade } from '../data/accounts';

interface ExamSetupProps {
  selectedGrade: GradeLevel;
  selectedRound: ContestRound;
  accountId: string;
  repoIndex: GitHubRepoIndex | null;
  loadedPool: LoadedExamPool | null;
  isLoadingPool: boolean;
  onSelectGrade: (grade: GradeLevel) => void;
  onSelectRound: (round: ContestRound) => void;
  onChangeAccountId: (accountId: string) => void;
  onRefreshGitHub: () => void;
  onOpenGitHubConfig: () => void;
  onStartExam: (config: ExamConfig) => void;
}

const ROUND_NAMES: Record<
  ContestRound,
  { name: string; badge: string; emoji: string; color: string }
> = {
  1: {
    name: 'Khởi động',
    badge: 'Cấp 1',
    emoji: '🌱',
    color: 'from-emerald-500 to-teal-600',
  },
  2: {
    name: 'Vượt chướng ngại vật',
    badge: 'Cấp 2',
    emoji: '🎒',
    color: 'from-blue-500 to-indigo-600',
  },
  3: {
    name: 'Tranh tài',
    badge: 'Cấp 3',
    emoji: '🏅',
    color: 'from-purple-500 to-violet-600',
  },
  4: {
    name: 'Tăng tốc',
    badge: 'Cấp 4',
    emoji: '🏆',
    color: 'from-amber-500 to-orange-600',
  },
  5: {
    name: 'Chinh phục đỉnh cao',
    badge: 'Cấp 5',
    emoji: '👑',
    color: 'from-rose-500 to-pink-600',
  },
};

export const ExamSetup: React.FC<ExamSetupProps> = ({
  selectedGrade,
  selectedRound,
  accountId,
  repoIndex,
  loadedPool,
  isLoadingPool,
  onSelectGrade,
  onSelectRound,
  onChangeAccountId,
  onRefreshGitHub,
  onOpenGitHubConfig,
  onStartExam,
}) => {
  const [studentName, setStudentName] = useState(localStorage.getItem('oly_student_name') || '');
  const [questionCount, setQuestionCount] = useState<number>(200);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(30);
  const [nameError, setNameError] = useState<string>('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const accountCheck = validateAccountId(accountId);

  useEffect(() => {
    if (studentName.trim()) {
      setNameError('');
    }
  }, [studentName]);

  const gradeHasGitHubFiles = (g: GradeLevel): boolean => {
    if (!repoIndex || repoIndex.apiLimited) return false;
    return repoIndex.files.some((f) => f.grade === g);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      soundFx.playError();
      setNameError('Vui lòng nhập họ và tên của bé trước khi bắt đầu nhé!');
      nameInputRef.current?.focus();
      return;
    }
    soundFx.playSuccess();
    localStorage.setItem('oly_student_name', studentName.trim());
    onStartExam({
      studentName: studentName.trim(),
      accountId: accountCheck.valid ? accountCheck.normalized : undefined,
      grade: selectedGrade,
      round: selectedRound,
      questionCount,
      timeLimitSeconds: timeLimitMinutes * 60,
      source: loadedPool?.source,
      sourceFileName: loadedPool?.fileName,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border-4 border-purple-200 overflow-hidden relative">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-300 rounded-full blur-2xl opacity-40 pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-45 h-45 bg-yellow-300 rounded-full blur-2xl opacity-40 pointer-events-none"></div>

        {/* Banner header */}
        <div className="bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 p-8 text-white text-center relative overflow-hidden">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner border-2 border-yellow-300 animate-bounce">
            <Rocket className="w-9 h-9 text-yellow-300" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-2 tracking-tight drop-shadow-md">
            ĐẤU TRƯỜNG TIẾNG ANH CHO BÉ
          </h2>
          <p className="text-pink-100 text-sm sm:text-base max-w-xl mx-auto font-medium">
            Vừa học vừa chơi, chinh phục đỉnh cao tiếng Anh từ Lớp 1 đến Lớp 9 với vô số phần thưởng bất ngờ! 🚀
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-8 relative z-10">
          {/* 1. Student Name & Account ID (Split 50/50) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left: Student Name */}
            <div className="space-y-2">
              <label className="block text-sm font-black text-purple-900 flex items-center gap-2">
                <User className="w-5 h-5 text-pink-600" />
                <span>Họ và tên của bé:</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Nhập tên bé (Ví dụ: Bảo Nam)..."
                className={`w-full px-5 py-4 rounded-2xl border-3 focus:ring-4 outline-none transition text-gray-800 font-extrabold text-lg sm:text-xl shadow-inner bg-purple-50/50 ${
                  nameError
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                    : 'border-purple-200 focus:border-purple-600 focus:ring-purple-100'
                }`}
              />
              {nameError && <p className="text-xs sm:text-sm font-bold text-red-600">{nameError}</p>}
            </div>

            {/* Right: Account ID */}
            <div className="space-y-2">
              <label className="block text-sm font-black text-purple-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-600" />
                <span>Tài khoản:</span>
              </label>
              <input
                type="text"
                value={accountId}
                onChange={(e) => onChangeAccountId(e.target.value)}
                placeholder="Nhập mã tài khoản (VD: l1_001)..."
                autoComplete="off"
                spellCheck={false}
                className={`w-full px-5 py-4 rounded-2xl border-3 focus:ring-4 outline-none transition text-gray-800 font-extrabold text-lg sm:text-xl shadow-inner bg-purple-50/50 ${
                  accountId.trim() === ''
                    ? 'border-purple-200 focus:border-indigo-600 focus:ring-indigo-100'
                    : accountCheck.isAdmin
                    ? 'border-amber-400 focus:border-purple-600 focus:ring-amber-100 bg-amber-50/40'
                    : accountCheck.valid && accountCheck.grade === selectedGrade
                    ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100 bg-emerald-50/30'
                    : accountCheck.valid
                    ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-100 bg-amber-50/30'
                    : 'border-red-400 focus:border-red-500 focus:ring-red-100 bg-red-50/30'
                }`}
              />

              {accountId.trim() === '' ? (
                <p className="text-xs text-gray-500 font-semibold">
                  Định dạng <span className="font-mono font-bold text-purple-700">l1_001</span> –{' '}
                  <span className="font-mono font-bold text-purple-700">l9_999</span> để tải đề theo khối.
                </p>
              ) : accountCheck.isAdmin ? (
                <p className="text-xs font-black text-purple-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    Tài khoản <strong>Admin</strong> • Toàn quyền tất cả khối Lớp 1–9 & mọi tính năng
                  </span>
                </p>
              ) : accountCheck.valid && accountCheck.grade === selectedGrade ? (
                <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Tài khoản hợp lệ • Đã mở kho đề <strong>Lớp {accountCheck.grade}</strong> (ID: {accountCheck.idNumber})
                  </span>
                </p>
              ) : accountCheck.valid && accountCheck.grade ? (
                <div className="text-xs font-bold text-amber-700 flex items-center justify-between gap-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Tài khoản thuộc Lớp {accountCheck.grade}.</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      onSelectGrade(accountCheck.grade!);
                    }}
                    className="px-2.5 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-black transition cursor-pointer"
                  >
                    Chuyển sang Lớp {accountCheck.grade}
                  </button>
                </div>
              ) : (
                <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Tài khoản chưa đúng (định dạng: l1_001 đến l9_999).</span>
                </p>
              )}
            </div>
          </div>

          {/* Admin Quick Control Panel (visible only for Admin account) */}
          {accountCheck.isAdmin && (
            <div className="bg-gradient-to-r from-amber-50 via-purple-50 to-indigo-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-purple-600 text-white flex items-center justify-center shrink-0 shadow">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-xs sm:text-sm">
                  <p className="font-black text-purple-950">
                    Bảng điều khiển Admin ({accountCheck.normalized})
                  </p>
                  <p className="text-purple-800 font-semibold mt-0.5">
                    {isLoadingPool
                      ? 'Đang tải kho đề...'
                      : loadedPool
                      ? `Lớp ${loadedPool.grade} • Cấp ${loadedPool.round}: ${loadedPool.questions.length} câu (${loadedPool.sourceLabel}) — TN: ${loadedPool.typeCounts.tn}, Nối: ${loadedPool.typeCounts.noi}, Điền từ: ${loadedPool.typeCounts.dt}, Sắp xếp: ${loadedPool.typeCounts.sx}`
                      : 'Sẵn sàng truy cập kho đề toàn bộ 9 khối lớp.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    onRefreshGitHub();
                  }}
                  disabled={isLoadingPool}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-purple-100 border-2 border-purple-200 text-purple-900 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPool ? 'animate-spin' : ''}`} />
                  <span>Cập nhật đề</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    onOpenGitHubConfig();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <CloudDownload className="w-3.5 h-3.5" />
                  <span>Quản lý đề</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. Select Grade (1 -> 9) */}
          <div className="space-y-3">
            <label className="block text-sm font-black text-purple-900 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-purple-600" />
              <span>Chọn Lớp của bé:</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-9 gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => {
                const gradeVal = g as GradeLevel;
                const hasGh = isAccountAuthorizedForGrade(accountId, gradeVal) && gradeHasGitHubFiles(gradeVal);
                const isSelected = selectedGrade === gradeVal;
                return (
                  <button
                    type="button"
                    key={g}
                    onClick={() => {
                      soundFx.playClick();
                      onSelectGrade(gradeVal);
                    }}
                    className={`relative py-3.5 rounded-2xl font-black text-base sm:text-lg transition flex flex-col items-center justify-center border-3 shadow-md transform hover:scale-110 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-br from-pink-500 to-purple-600 border-yellow-300 text-white shadow-pink-300/50 scale-105 ring-4 ring-purple-200'
                        : 'bg-gradient-to-br from-gray-50 to-purple-50/40 border-purple-200 text-purple-900 hover:bg-purple-100'
                    }`}
                  >
                    {hasGh && (
                      <span
                        title={`Lớp ${g} đã có đề trên GitHub`}
                        className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${
                          isSelected ? 'bg-yellow-300 ring-2 ring-white' : 'bg-emerald-500'
                        }`}
                      />
                    )}
                    <span className="text-xs uppercase tracking-wider opacity-90">Lớp</span>
                    <span className="text-xl font-black">{g}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Select Contest Round (Icon on top, text below) */}
          <div className="space-y-3">
            <label className="block text-sm font-black text-purple-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span>Chọn Vòng Thi:</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((r) => {
                const roundVal = r as ContestRound;
                const info = ROUND_NAMES[roundVal];
                const isSelected = selectedRound === roundVal;

                return (
                  <button
                    type="button"
                    key={r}
                    onClick={() => {
                      soundFx.playClick();
                      onSelectRound(roundVal);
                    }}
                    className={`p-4 rounded-2xl text-center border-3 transition relative flex flex-col items-center justify-start gap-2 shadow-md transform hover:scale-105 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-600 shadow-lg ring-4 ring-purple-200'
                        : 'bg-white border-purple-100 hover:border-purple-300 hover:bg-purple-50/30'
                    }`}
                  >
                    <span className="text-5xl drop-shadow-md select-none leading-none my-1">{info.emoji}</span>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black text-white whitespace-nowrap bg-gradient-to-r ${info.color}`}
                    >
                      {info.badge}
                    </span>
                    <h4
                      className={`font-black text-sm sm:text-base leading-tight ${
                        isSelected ? 'text-purple-950' : 'text-gray-800'
                      }`}
                    >
                      {info.name}
                    </h4>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Exam Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t-2 border-purple-100">
            <div className="space-y-2">
              <label className="block text-sm font-black text-purple-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Số lượng câu hỏi:</span>
              </label>
              <select
                value={questionCount}
                onChange={(e) => {
                  soundFx.playClick();
                  setQuestionCount(Number(e.target.value));
                }}
                className="w-full px-4 py-3.5 rounded-2xl border-3 border-purple-200 focus:border-purple-600 bg-purple-50/50 font-bold text-gray-800 shadow-inner"
              >
                <option value={20}>20 câu (Luyện tập nhanh)</option>
                <option value={50}>50 câu (Thử sức vừa)</option>
                <option value={100}>100 câu (Thử thách cao)</option>
                <option value={200}>200 câu (Đề thi chuẩn 30 phút)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-black text-purple-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>Thời gian thi:</span>
              </label>
              <select
                value={timeLimitMinutes}
                onChange={(e) => {
                  soundFx.playClick();
                  setTimeLimitMinutes(Number(e.target.value));
                }}
                className="w-full px-4 py-3.5 rounded-2xl border-3 border-purple-200 focus:border-purple-600 bg-purple-50/50 font-bold text-gray-800 shadow-inner"
              >
                <option value={15}>15 phút</option>
                <option value={30}>30 phút (Tiêu chuẩn)</option>
                <option value={45}>45 phút</option>
                <option value={60}>60 phút (Thoải mái)</option>
              </select>
            </div>
          </div>

          {/* Start Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoadingPool}
              className="w-full py-5 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 disabled:opacity-60 text-white font-black text-xl rounded-3xl shadow-xl hover:shadow-2xl transition transform hover:scale-[1.02] flex items-center justify-center gap-3 cursor-pointer border-4 border-yellow-300"
            >
              <Play className="w-7 h-7 fill-current animate-bounce text-yellow-300" />
              <span>{isLoadingPool ? 'ĐANG TẢI ĐỀ THI...' : 'BẮT ĐẦU VÀO THI NGAY 🚀'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
