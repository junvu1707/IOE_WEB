import React, { useState, useEffect, useRef } from 'react';
import {
  GradeLevel,
  ContestRound,
  ExamConfig,
  GitHubRepoIndex,
  LoadedExamPool,
  RoundCountSummary,
} from '../types';
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
  Users,
  Mail,
  Key,
} from 'lucide-react';
import { soundFx } from '../utils/sound';
import { validateAccountId } from '../data/accounts';

interface ExamSetupProps {
  selectedGrade: GradeLevel;
  selectedRound: ContestRound;
  accountId: string;
  repoIndex: GitHubRepoIndex | null;
  loadedPool: LoadedExamPool | null;
  isLoadingPool: boolean;
  roundCounts: Partial<Record<ContestRound, RoundCountSummary>>;
  isLoadingRoundCounts: boolean;
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
  roundCounts,
  isLoadingRoundCounts,
  onSelectGrade,
  onSelectRound,
  onChangeAccountId,
  onRefreshGitHub,
  onOpenGitHubConfig,
  onStartExam,
}) => {
  const [studentName, setStudentName] = useState(localStorage.getItem('oly_student_name') || '');
  const [parentEmail, setParentEmail] = useState(localStorage.getItem('oly_parent_email') || '');
  const [parentEmailPassword, setParentEmailPassword] = useState(
    localStorage.getItem('oly_parent_email_password') || ''
  );
  const [minStudyMinutes, setMinStudyMinutes] = useState<number>(
    Number(localStorage.getItem('oly_min_study_minutes') || '0')
  );
  const [parentPin, setParentPin] = useState(localStorage.getItem('oly_parent_pin') || '1234');

  const [questionCount, setQuestionCount] = useState<number>(200);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(30);
  const [nameError, setNameError] = useState<string>('');
  const [showEmailPassword, setShowEmailPassword] = useState<boolean>(false);
  const [showParentPin, setShowParentPin] = useState<boolean>(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const accountCheck = validateAccountId(accountId);
  const isAdminAccountId = accountCheck.isAdmin;

  useEffect(() => {
    if (studentName.trim() || isAdminAccountId) {
      setNameError('');
    }
  }, [studentName, isAdminAccountId]);

  const gradeHasGitHubFiles = (g: GradeLevel): boolean => {
    if (!repoIndex || repoIndex.apiLimited) return false;
    return repoIndex.files.some((f) => f.grade === g);
  };

  const isGradeAuthorized = (g: GradeLevel): boolean => {
    if (isAdminAccountId) return true;
    return accountCheck.valid && accountCheck.grade === g;
  };

  const totalRealQuestionsForGrade = ([1, 2, 3, 4, 5] as ContestRound[]).reduce((sum, r) => {
    const info = roundCounts[r];
    if (!info || info.isTestOnly) return sum;
    return sum + info.count;
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Riêng tài khoản Admin uyenlp1310 không bắt buộc nhập bất cứ thông tin nào
    if (!isAdminAccountId && !studentName.trim()) {
      soundFx.playError();
      setNameError('Vui lòng nhập họ và tên của bé trước khi bắt đầu nhé!');
      nameInputRef.current?.focus();
      return;
    }

    soundFx.playSuccess();
    const resolvedName = studentName.trim() || (isAdminAccountId ? 'Admin (uyenlp1310)' : 'Học sinh');

    if (studentName.trim()) {
      localStorage.setItem('oly_student_name', studentName.trim());
    }
    if (!isAdminAccountId) {
      localStorage.setItem('oly_parent_email', parentEmail.trim());
      localStorage.setItem('oly_parent_email_password', parentEmailPassword);
      localStorage.setItem('oly_min_study_minutes', String(minStudyMinutes));
      localStorage.setItem('oly_parent_pin', parentPin.trim() || '1234');
    }

    onStartExam({
      studentName: resolvedName,
      accountId: accountCheck.valid ? accountCheck.normalized : accountId.trim() || undefined,
      isAdminMode: isAdminAccountId,
      parentEmail: isAdminAccountId ? undefined : parentEmail.trim(),
      parentEmailPassword: isAdminAccountId ? undefined : parentEmailPassword,
      grade: selectedGrade,
      round: selectedRound,
      questionCount,
      timeLimitSeconds: timeLimitMinutes * 60,
      minStudyMinutes: isAdminAccountId ? 0 : minStudyMinutes,
      parentPin: isAdminAccountId ? undefined : parentPin.trim() || '1234',
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
          {/* 1. Student Name, Account ID, Parent Email & Email Password (Local Only) */}
          <div className="space-y-4 bg-purple-50/60 p-6 rounded-3xl border-2 border-purple-200">
            <h3 className="text-base font-black text-purple-950 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <span>Thông tin tài khoản (Lưu cục bộ trên máy)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Col 1: Student Name (no example) */}
              <div className="space-y-2">
                <label className="block text-sm font-black text-purple-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-pink-600" />
                  <span>Họ và tên của bé:</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Nhập họ và tên..."
                  className={`w-full px-4 py-3 rounded-2xl border-3 focus:ring-4 outline-none transition text-gray-800 font-extrabold text-base shadow-inner bg-white ${
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
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                  <span>ID tài khoản:</span>
                </label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => onChangeAccountId(e.target.value)}
                  placeholder="Nhập ID tài khoản..."
                  autoComplete="off"
                  spellCheck={false}
                  className={`w-full px-4 py-3 rounded-2xl border-3 focus:ring-4 outline-none transition text-gray-800 font-extrabold text-base shadow-inner bg-white ${
                    accountCheck.valid
                      ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100 bg-emerald-50/30'
                      : accountId.trim()
                      ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-100'
                      : 'border-purple-200 focus:border-indigo-600 focus:ring-indigo-100'
                  }`}
                />
              </div>

              {/* Col 3 & 4: Parent Email & Email Password (hidden for Admin uyenlp1310 since Admin needs nothing) */}
              {!isAdminAccountId && (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-black text-purple-900 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-purple-600" />
                      <span>Email:</span>
                    </label>
                    <input
                      type="email"
                      value={parentEmail}
                      onChange={(e) => {
                        setParentEmail(e.target.value);
                        localStorage.setItem('oly_parent_email', e.target.value);
                      }}
                      placeholder="Email PH dùng đăng ký..."
                      autoComplete="email"
                      className="w-full px-4 py-3 rounded-2xl border-3 border-purple-200 focus:border-purple-600 focus:ring-4 focus:ring-purple-100 outline-none transition text-gray-800 font-extrabold text-base shadow-inner bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-black text-purple-900 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-purple-600" />
                      <span>Mật khẩu:</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showEmailPassword ? 'text' : 'password'}
                        value={parentEmailPassword}
                        onChange={(e) => {
                          setParentEmailPassword(e.target.value);
                          localStorage.setItem('oly_parent_email_password', e.target.value);
                        }}
                        placeholder="Mật khẩu email..."
                        autoComplete="current-password"
                        className="w-full pl-4 pr-11 py-3 rounded-2xl border-3 border-purple-200 focus:border-purple-600 focus:ring-4 focus:ring-purple-100 outline-none transition text-gray-800 font-extrabold text-base shadow-inner bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-500 hover:text-purple-800 p-1 cursor-pointer"
                        aria-label={showEmailPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showEmailPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Account recognition status line */}
            {isAdminAccountId ? (
              <p className="text-xs font-black text-purple-800 flex items-center gap-1.5 pt-1">
                <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  Tài khoản Admin <strong>{accountCheck.normalized}</strong> • Không cần nhập thêm thông tin hay khóa phụ huynh • Toàn quyền Lớp 1–9 & xem số câu mỗi vòng
                </span>
              </p>
            ) : accountCheck.valid && accountCheck.grade ? (
              accountCheck.grade === selectedGrade ? (
                <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Đã kích hoạt tài khoản <strong>{accountCheck.normalized}</strong> (Kho đề Lớp {accountCheck.grade})
                  </span>
                </p>
              ) : (
                <div className="text-xs font-bold text-amber-700 flex items-center gap-2 flex-wrap pt-1">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      Tài khoản <strong>{accountCheck.normalized}</strong> thuộc Lớp {accountCheck.grade}.
                    </span>
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
              )
            ) : accountId.trim() ? (
              <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5 pt-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>ID tài khoản chưa hợp lệ (đang dùng chế độ làm thử).</span>
              </p>
            ) : null}
          </div>

          {/* Parent Controls: Min Study Time & Parent PIN (not needed for Admin uyenlp1310) */}
          {!isAdminAccountId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-indigo-50/60 p-6 rounded-3xl border-2 border-indigo-200">
              <div className="space-y-2">
                <label className="block text-sm font-black text-indigo-950 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Thời gian học tối thiểu:</span>
                </label>
                <select
                  value={minStudyMinutes}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMinStudyMinutes(val);
                    localStorage.setItem('oly_min_study_minutes', String(val));
                  }}
                  className="w-full px-4 py-3 rounded-2xl border-3 border-indigo-200 focus:border-indigo-600 bg-white font-bold text-gray-800 shadow-inner"
                >
                  <option value={0}>Không giới hạn (Thoải mái)</option>
                  <option value={10}>Tối thiểu 10 phút</option>
                  <option value={15}>Tối thiểu 15 phút</option>
                  <option value={30}>Tối thiểu 30 phút</option>
                  <option value={45}>Tối thiểu 45 phút</option>
                  <option value={60}>Tối thiểu 60 phút</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-black text-indigo-950 flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-600" />
                  <span>Mật khẩu Phụ huynh (để thoát chế độ thi):</span>
                </label>
                <div className="relative">
                  <input
                    type={showParentPin ? 'text' : 'password'}
                    value={parentPin}
                    onChange={(e) => {
                      setParentPin(e.target.value);
                      localStorage.setItem('oly_parent_pin', e.target.value);
                    }}
                    placeholder="Mặc định: 1234"
                    maxLength={16}
                    className="w-full pl-4 pr-11 py-3 rounded-2xl border-3 border-indigo-200 focus:border-indigo-600 bg-white font-black text-gray-800 shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowParentPin((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-800 p-1 cursor-pointer"
                    aria-label={showParentPin ? 'Ẩn mật khẩu phụ huynh' : 'Hiện mật khẩu phụ huynh'}
                  >
                    {showParentPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Admin Quick Control Panel (visible only for Admin ID uyenlp1310) */}
          {isAdminAccountId && (
            <div className="bg-gradient-to-r from-amber-50 via-purple-50 to-indigo-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-purple-600 text-white flex items-center justify-center shrink-0 shadow">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-xs sm:text-sm">
                  <p className="font-black text-purple-950">
                    Bảng điều khiển Admin ({accountCheck.normalized}) • Tổng đề Lớp {selectedGrade}:{' '}
                    <span className="text-emerald-700">
                      {isLoadingRoundCounts ? 'Đang đếm...' : `${totalRealQuestionsForGrade.toLocaleString('vi-VN')} câu`}
                    </span>
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
                    onRefreshGitHub();
                  }}
                  disabled={isLoadingPool || isLoadingRoundCounts}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-purple-100 border-2 border-purple-200 text-purple-900 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPool || isLoadingRoundCounts ? 'animate-spin' : ''}`} />
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

          {/* 3. Select Contest Round (Icon on top, text below; Admin sees exact question counts per round) */}
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
                const countInfo = roundCounts[roundVal];

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

                    {/* Per-round question count badge — ONLY visible for Admin uyenlp1310 */}
                    {isAdminAccountId && (
                      <div className="mt-auto pt-1 w-full">
                        {isLoadingRoundCounts && !countInfo ? (
                          <span className="inline-block px-2 py-0.5 rounded-lg text-[11px] font-bold bg-purple-100 text-purple-700 animate-pulse">
                            Đang đếm...
                          </span>
                        ) : countInfo ? (
                          countInfo.isTestOnly ? (
                            <span className="inline-block px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Chưa có đề (Test: {countInfo.count})
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {countInfo.count.toLocaleString('vi-VN')} câu
                              </span>
                              <div className="text-[10px] font-bold text-purple-700 leading-tight">
                                TN:{countInfo.typeCounts.tn} • Nối:{countInfo.typeCounts.noi}
                                <br />
                                ĐT:{countInfo.typeCounts.dt} • SX:{countInfo.typeCounts.sx}
                              </div>
                            </div>
                          )
                        ) : null}
                      </div>
                    )}
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
              <span>
                {isLoadingPool
                  ? 'ĐANG TẢI ĐỀ THI...'
                  : isAdminAccountId
                  ? 'BẮT ĐẦU VÀO THI NGAY 🚀'
                  : 'BẮT ĐẦU VÀO THI NGAY (TOÀN MÀN HÌNH) 🚀'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
