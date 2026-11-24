import React, { useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { GradeLevel, ContestRound, ExamConfig, GitHubRepoIndex, LoadedExamPool } from '../types';
import {
  User,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
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
  LogIn,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { soundFx } from '../utils/sound';
import { LicenseRecord, formatLicenseDate } from '../services/licenseService';

interface ExamSetupProps {
  user: FirebaseUser | null;
  authReady: boolean;
  isAdmin: boolean;
  activeLicense: LicenseRecord | null;
  selectedGrade: GradeLevel;
  selectedRound: ContestRound;
  accountId: string;
  accountPassword: string;
  isActivating: boolean;
  activationError: string | null;
  kickedMessage: string | null;
  repoIndex: GitHubRepoIndex | null;
  loadedPool: LoadedExamPool | null;
  isLoadingPool: boolean;
  onSelectGrade: (grade: GradeLevel) => void;
  onSelectRound: (round: ContestRound) => void;
  onChangeAccountId: (accountId: string) => void;
  onChangeAccountPassword: (password: string) => void;
  onActivateLicense: (studentName: string) => void;
  onSignIn: () => void;
  onDismissKicked: () => void;
  onRefreshGitHub: () => void;
  onOpenGitHubConfig: () => void;
  onOpenAdminDashboard: () => void;
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
  user,
  authReady,
  isAdmin,
  activeLicense,
  selectedGrade,
  selectedRound,
  accountId,
  accountPassword,
  isActivating,
  activationError,
  kickedMessage,
  repoIndex,
  loadedPool,
  isLoadingPool,
  onSelectGrade,
  onSelectRound,
  onChangeAccountId,
  onChangeAccountPassword,
  onActivateLicense,
  onSignIn,
  onDismissKicked,
  onRefreshGitHub,
  onOpenGitHubConfig,
  onOpenAdminDashboard,
  onStartExam,
}) => {
  const [studentName, setStudentName] = useState(localStorage.getItem('oly_student_name') || '');
  const [questionCount, setQuestionCount] = useState<number>(200);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(30);
  const [nameError, setNameError] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (studentName.trim()) {
      setNameError('');
    }
  }, [studentName]);

  const gradeHasGitHubFiles = (g: GradeLevel): boolean => {
    if (!repoIndex || repoIndex.apiLimited) return false;
    return repoIndex.files.some((f) => f.grade === g);
  };

  const isGradeAuthorized = (g: GradeLevel): boolean => {
    if (isAdmin) return true;
    if (!activeLicense || activeLicense.status !== 'active') return false;
    if (activeLicense.isAdminAccount) return true;
    return activeLicense.grade === g;
  };

  const normalizedInputId = accountId.trim().toLowerCase();
  const isCurrentInputActivated = Boolean(
    activeLicense &&
      activeLicense.status === 'active' &&
      (!normalizedInputId || activeLicense.accountId === normalizedInputId)
  );

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
      accountId: activeLicense?.accountId,
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
          {/* Real-time Anti-Sharing Kicked Alert */}
          {kickedMessage && (
            <div className="bg-red-50 border-3 border-red-300 rounded-2xl p-4 flex items-start justify-between gap-3 shadow-md animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-red-900">
                  <p className="font-black text-red-700">Phiên đăng nhập đã bị ngắt kết nối</p>
                  <p className="font-semibold mt-0.5">{kickedMessage}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onDismissKicked}
                className="px-3 py-1 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 font-black text-xs shrink-0 cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          )}

          {/* 1. Student Name, Account ID & Password */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Col 1: Student Name (no example) */}
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
                  placeholder="Nhập họ và tên..."
                  className={`w-full px-4 py-3.5 rounded-2xl border-3 focus:ring-4 outline-none transition text-gray-800 font-extrabold text-base sm:text-lg shadow-inner bg-purple-50/50 ${
                    nameError
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                      : 'border-purple-200 focus:border-purple-600 focus:ring-purple-100'
                  }`}
                />
                {nameError && <p className="text-xs font-bold text-red-600">{nameError}</p>}
              </div>

              {/* Col 2: Account ID (no example) */}
              <div className="space-y-2">
                <label className="block text-sm font-black text-purple-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-600" />
                  <span>Tài khoản:</span>
                </label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => onChangeAccountId(e.target.value)}
                  placeholder="Nhập tài khoản..."
                  autoComplete="off"
                  spellCheck={false}
                  className={`w-full px-4 py-3.5 rounded-2xl border-3 focus:ring-4 outline-none transition text-gray-800 font-extrabold text-base sm:text-lg shadow-inner bg-purple-50/50 ${
                    isCurrentInputActivated && activeLicense
                      ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100 bg-emerald-50/30'
                      : activationError
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-100 bg-red-50/30'
                      : 'border-purple-200 focus:border-indigo-600 focus:ring-indigo-100'
                  }`}
                />
              </div>

              {/* Col 3: Password (left completely blank) */}
              <div className="space-y-2">
                <label className="block text-sm font-black text-purple-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-purple-600" />
                  <span>Mật khẩu:</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={accountPassword}
                    onChange={(e) => onChangeAccountPassword(e.target.value)}
                    placeholder=""
                    autoComplete="new-password"
                    spellCheck={false}
                    className={`w-full pl-4 pr-11 py-3.5 rounded-2xl border-3 focus:ring-4 outline-none transition text-gray-800 font-extrabold text-base sm:text-lg shadow-inner bg-purple-50/50 ${
                      activationError
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-100 bg-red-50/30'
                        : isCurrentInputActivated && activeLicense
                        ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100 bg-emerald-50/30'
                        : 'border-purple-200 focus:border-purple-600 focus:ring-purple-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-500 hover:text-purple-800 p-1 cursor-pointer"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Activation Action & Real-Time Session Status Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex-1 min-w-[220px]">
                {activationError ? (
                  <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{activationError}</span>
                  </p>
                ) : activeLicense && isCurrentInputActivated ? (
                  activeLicense.isAdminAccount || isAdmin ? (
                    <p className="text-xs font-black text-purple-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>
                        Đang đăng nhập phiên <strong>{activeLicense.accountId}</strong> • Toàn quyền Lớp 1–9 (HSD:{' '}
                        {formatLicenseDate(activeLicense.expiresAt)})
                      </span>
                    </p>
                  ) : activeLicense.grade === selectedGrade ? (
                    <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        Đã kích hoạt <strong>{activeLicense.accountId}</strong> (Lớp {activeLicense.grade}) • HSD:{' '}
                        <strong>{formatLicenseDate(activeLicense.expiresAt)}</strong> • Chống dùng chung real-time
                      </span>
                    </p>
                  ) : (
                    <div className="text-xs font-bold text-amber-700 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>
                          Tài khoản {activeLicense.accountId} thuộc Lớp {activeLicense.grade} (HSD:{' '}
                          {formatLicenseDate(activeLicense.expiresAt)}).
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          onSelectGrade(activeLicense.grade as GradeLevel);
                        }}
                        className="px-2.5 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-black transition cursor-pointer"
                      >
                        Chuyển sang Lớp {activeLicense.grade}
                      </button>
                    </div>
                  )
                ) : !authReady ? (
                  <p className="text-xs text-gray-500 font-semibold">Đang kiểm tra phiên đăng nhập...</p>
                ) : !user ? (
                  <p className="text-xs text-purple-800 font-semibold">
                    Đăng nhập Google rồi nhập Tài khoản & Mật khẩu để kích hoạt kho đề theo lớp (hiệu lực 1 năm).
                  </p>
                ) : isAdmin ? (
                  <p className="text-xs font-black text-purple-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Đã xác thực quyền Admin ({user.email}) • Toàn quyền Lớp 1–9 & Quản trị tài khoản</span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-600 font-semibold">
                    Nhập Tài khoản & Mật khẩu rồi bấm <strong>Kích hoạt</strong> để mở khóa kho đề lớp trong 1 năm.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!user ? (
                  <button
                    type="button"
                    disabled={!authReady}
                    onClick={() => {
                      soundFx.playClick();
                      onSignIn();
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Đăng nhập Google</span>
                  </button>
                ) : (
                  (!isCurrentInputActivated || accountPassword.trim().length > 0) &&
                  accountId.trim().length > 0 && (
                    <button
                      type="button"
                      disabled={isActivating}
                      onClick={() => {
                        soundFx.playClick();
                        onActivateLicense(studentName);
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs flex items-center gap-1.5 shadow transition cursor-pointer disabled:opacity-50"
                    >
                      {isActivating ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>{isActivating ? 'Đang kích hoạt...' : 'Kích hoạt tài khoản'}</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Admin Quick Control Panel (visible only for verified Admin) */}
          {isAdmin && (
            <div className="bg-gradient-to-r from-amber-50 via-purple-50 to-indigo-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-purple-600 text-white flex items-center justify-center shrink-0 shadow">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-xs sm:text-sm">
                  <p className="font-black text-purple-950">
                    Bảng điều khiển Admin ({user?.email || activeLicense?.accountId})
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    onOpenAdminDashboard();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-purple-950 font-black text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Quản trị TK</span>
                </button>
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
                const hasGh = isGradeAuthorized(gradeVal) && gradeHasGitHubFiles(gradeVal);
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
                        title={`Lớp ${g} đã sẵn sàng kho đề`}
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
