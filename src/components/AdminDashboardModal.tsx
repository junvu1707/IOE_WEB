import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  ShieldCheck,
  Search,
  Ban,
  CheckCircle2,
  LogOut,
  CalendarPlus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Users,
  Sparkles,
  Laptop,
} from 'lucide-react';
import { GradeLevel } from '../types';
import { formatStudentAccountId, MAX_ACCOUNTS_PER_GRADE } from '../data/accounts';
import {
  LicenseRecord,
  subscribeAllLicenses,
  adminSetLicenseStatus,
  adminForceKickSession,
  adminExtendLicenseOneYear,
  adminDeleteLicense,
  formatLicenseDate,
  formatLicenseDateTime,
} from '../services/licenseService';
import { soundFx } from '../utils/sound';

interface AdminDashboardModalProps {
  onClose: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'licenses' | 'generator'>('licenses');
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked' | 'warning'>('all');

  // Batch ID Generator (up to 99,999 IDs per grade)
  const [genGrade, setGenGrade] = useState<GradeLevel>(4);
  const [genStart, setGenStart] = useState<number>(1);
  const [genCount, setGenCount] = useState<number>(20);
  const [copiedBatch, setCopiedBatch] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeAllLicenses(
      (items) => {
        setLicenses(items);
        setLoading(false);
        setErrorMsg(null);
      },
      (err) => {
        setLoading(false);
        setErrorMsg(err.message);
      }
    );
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const total = licenses.length;
    const active = licenses.filter((l) => l.status === 'active').length;
    const revoked = licenses.filter((l) => l.status === 'revoked').length;
    const suspicious = licenses.filter((l) => (l.loginCount || 0) >= 3).length;
    return { total, active, revoked, suspicious };
  }, [licenses]);

  const filteredLicenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return licenses.filter((item) => {
      if (q) {
        const matchId = item.accountId.toLowerCase().includes(q);
        const matchName = (item.ownerName || '').toLowerCase().includes(q);
        const matchDevice = (item.deviceLabel || '').toLowerCase().includes(q);
        if (!matchId && !matchName && !matchDevice) return false;
      }
      if (gradeFilter !== 'all' && String(item.grade) !== gradeFilter) return false;
      if (statusFilter === 'active' && item.status !== 'active') return false;
      if (statusFilter === 'revoked' && item.status !== 'revoked') return false;
      if (statusFilter === 'warning' && (item.loginCount || 0) < 3) return false;
      return true;
    });
  }, [licenses, searchQuery, gradeFilter, statusFilter]);

  const generatedIds = useMemo(() => {
    const start = Math.max(1, Math.min(MAX_ACCOUNTS_PER_GRADE, Math.floor(genStart || 1)));
    const count = Math.max(1, Math.min(200, Math.floor(genCount || 1)));
    const list: string[] = [];
    for (let i = 0; i < count && start + i <= MAX_ACCOUNTS_PER_GRADE; i++) {
      list.push(formatStudentAccountId(genGrade, start + i));
    }
    return list;
  }, [genGrade, genStart, genCount]);

  const runAction = async (accountId: string, fn: () => Promise<void>) => {
    soundFx.playClick();
    setActionBusyId(accountId);
    setErrorMsg(null);
    try {
      await fn();
      setConfirmDeleteId(null);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể thực hiện thao tác.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleCopyBatch = async () => {
    soundFx.playClick();
    try {
      await navigator.clipboard.writeText(generatedIds.join('\n'));
      setCopiedBatch(true);
      setTimeout(() => setCopiedBatch(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-300/25 border-2 border-amber-300 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h3 className="text-xl font-black">Quản Trị Tài Khoản & Chống Chia Sẻ (Real-time)</h3>
              <p className="text-xs text-pink-100 font-semibold">
                Hệ thống hỗ trợ 99.999 ID / khối lớp • Tự động đá máy cũ khi đăng nhập nơi khác
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="w-9 h-9 bg-white/15 hover:bg-white/30 rounded-xl flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setActiveTab('licenses');
            }}
            className={`py-3 px-5 font-black text-sm border-b-3 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'licenses'
                ? 'border-purple-600 text-purple-800 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Tài khoản đã kích hoạt ({stats.total})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setActiveTab('generator');
            }}
            className={`py-3 px-5 font-black text-sm border-b-3 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'generator'
                ? 'border-purple-600 text-purple-800 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Tạo danh sách mã ID (99.999 / lớp)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50 border-2 border-red-200 text-red-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="break-words">{errorMsg}</span>
            </div>
          )}

          {activeTab === 'licenses' ? (
            <>
              {/* Stats cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-3.5">
                  <span className="text-xs font-bold text-purple-700 block">Tổng kích hoạt</span>
                  <span className="text-2xl font-black text-purple-950">{stats.total}</span>
                </div>
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-3.5">
                  <span className="text-xs font-bold text-emerald-700 block">Đang hoạt động</span>
                  <span className="text-2xl font-black text-emerald-900">{stats.active}</span>
                </div>
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-3.5">
                  <span className="text-xs font-bold text-red-700 block">Đã khóa (Ban)</span>
                  <span className="text-2xl font-black text-red-900">{stats.revoked}</span>
                </div>
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3.5">
                  <span className="text-xs font-bold text-amber-800 block">Đổi máy ≥ 3 lần</span>
                  <span className="text-2xl font-black text-amber-900">{stats.suspicious}</span>
                </div>
              </div>

              {/* Filter row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo mã ID, tên bé, thiết bị..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-purple-200 focus:border-purple-600 outline-none text-sm font-bold text-gray-800"
                  />
                </div>

                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border-2 border-purple-200 focus:border-purple-600 outline-none text-sm font-bold text-gray-800 bg-white"
                >
                  <option value="all">Tất cả khối lớp</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                    <option key={g} value={String(g)}>
                      Lớp {g}
                    </option>
                  ))}
                  <option value="0">Admin (Toàn khối)</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3.5 py-2.5 rounded-xl border-2 border-purple-200 focus:border-purple-600 outline-none text-sm font-bold text-gray-800 bg-white"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="revoked">Đã khóa</option>
                  <option value="warning">Cảnh báo đổi máy (≥ 3 lần)</option>
                </select>
              </div>

              {/* Live list */}
              {loading ? (
                <div className="py-12 text-center text-sm font-bold text-purple-700">
                  Đang đồng bộ danh sách tài khoản từ Firebase...
                </div>
              ) : filteredLicenses.length === 0 ? (
                <div className="py-12 text-center bg-purple-50/40 rounded-2xl border-2 border-dashed border-purple-200">
                  <p className="font-black text-purple-950 text-base">Chưa có tài khoản nào khớp bộ lọc</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Khi học sinh đăng nhập và kích hoạt mã ID, trạng thái thiết bị sẽ tự động hiện tại đây theo thời gian thực.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLicenses.map((item) => {
                    const isExpired = item.expiresAt ? item.expiresAt.toMillis() <= Date.now() : false;
                    const isBusy = actionBusyId === item.accountId;
                    const isSuspicious = (item.loginCount || 0) >= 3;

                    return (
                      <div
                        key={item.accountId}
                        className={`rounded-2xl border-2 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition ${
                          item.status === 'revoked'
                            ? 'bg-red-50/60 border-red-200'
                            : isSuspicious
                            ? 'bg-amber-50/60 border-amber-300'
                            : 'bg-purple-50/30 border-purple-200'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-black text-base text-purple-950 bg-white px-2.5 py-0.5 rounded-lg border border-purple-200">
                              {item.accountId}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-xs font-black bg-indigo-600 text-white">
                              {item.isAdminAccount ? 'ADMIN' : `Lớp ${item.grade}`}
                            </span>
                            {item.status === 'revoked' ? (
                              <span className="px-2 py-0.5 rounded-md text-xs font-black bg-red-600 text-white">
                                ĐÃ KHÓA
                              </span>
                            ) : isExpired ? (
                              <span className="px-2 py-0.5 rounded-md text-xs font-black bg-gray-600 text-white">
                                HẾT HẠN
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-xs font-black bg-emerald-600 text-white">
                                ĐANG HOẠT ĐỘNG
                              </span>
                            )}
                            {isSuspicious && (
                              <span className="px-2 py-0.5 rounded-md text-xs font-black bg-amber-500 text-white flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{item.loginCount} lượt đăng nhập</span>
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-gray-700 font-semibold flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>
                              Học sinh: <strong className="text-purple-950">{item.ownerName}</strong>
                            </span>
                            <span className="inline-flex items-center gap-1 text-indigo-800">
                              <Laptop className="w-3.5 h-3.5" />
                              {item.deviceLabel || 'Không rõ thiết bị'}
                            </span>
                            <span>
                              Lượt vào: <strong>{item.loginCount || 1}</strong>
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-500 font-medium flex flex-wrap gap-x-3 gap-y-1">
                            <span>Kích hoạt: {formatLicenseDate(item.activatedAt)}</span>
                            <span>
                              HSD: <strong className="text-purple-900">{formatLicenseDate(item.expiresAt)}</strong>
                            </span>
                            <span>Cập nhật gần nhất: {formatLicenseDateTime(item.updatedAt)}</span>
                          </div>
                        </div>

                        {/* Admin Actions */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => runAction(item.accountId, () => adminForceKickSession(item.accountId))}
                            className="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                            title="Ngắt kết nối ngay lập tức trên thiết bị đang đăng nhập"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Đá máy</span>
                          </button>

                          {item.status === 'active' ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                runAction(item.accountId, () => adminSetLicenseStatus(item.accountId, 'revoked'))
                              }
                              className="px-3 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Khóa</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                runAction(item.accountId, () => adminSetLicenseStatus(item.accountId, 'active'))
                              }
                              className="px-3 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Mở khóa</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              runAction(item.accountId, () =>
                                adminExtendLicenseOneYear(item.accountId, item.expiresAt)
                              )
                            }
                            className="px-3 py-2 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            <span>+1 năm</span>
                          </button>

                          {confirmDeleteId === item.accountId ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => runAction(item.accountId, () => adminDeleteLicense(item.accountId))}
                              className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs transition cursor-pointer"
                            >
                              Xác nhận xóa?
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteId(item.accountId)}
                              className="p-2 rounded-xl bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-700 transition cursor-pointer"
                              title="Xóa bản ghi để đặt lại mã tài khoản"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-5">
              <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 space-y-4">
                <p className="text-sm font-black text-purple-950">
                  Sinh danh sách mã tài khoản theo khối lớp (tối đa {MAX_ACCOUNTS_PER_GRADE.toLocaleString('vi-VN')} ID / khối)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-purple-900 mb-1">Chọn khối lớp:</label>
                    <select
                      value={genGrade}
                      onChange={(e) => setGenGrade(Number(e.target.value) as GradeLevel)}
                      className="w-full px-3.5 py-2.5 rounded-xl border-2 border-purple-200 bg-white font-bold text-sm"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                        <option key={g} value={g}>
                          Lớp {g} (l{g}_00001 – l{g}_99999)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-purple-900 mb-1">Số bắt đầu (1 – 99999):</label>
                    <input
                      type="number"
                      min={1}
                      max={MAX_ACCOUNTS_PER_GRADE}
                      value={genStart}
                      onChange={(e) => setGenStart(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border-2 border-purple-200 bg-white font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-purple-900 mb-1">Số lượng cần lấy (1 – 200):</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={genCount}
                      onChange={(e) => setGenCount(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border-2 border-purple-200 bg-white font-bold text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-900">
                    Danh sách {generatedIds.length} mã ID:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyBatch}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                  >
                    {copiedBatch ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedBatch ? 'Đã sao chép!' : 'Sao chép danh sách'}</span>
                  </button>
                </div>

                <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 max-h-64 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {generatedIds.map((code) => (
                    <span
                      key={code}
                      className="px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg font-mono text-xs font-black text-purple-900 text-center"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm transition shadow cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
