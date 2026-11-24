import React, { useState } from 'react';
import { X, Github, CheckCircle2, AlertCircle, RefreshCw, FileCode, Upload, FolderGit2 } from 'lucide-react';
import {
  DEFAULT_GITHUB_REPO,
  getConfiguredGitHubUrl,
  fetchGitHubRepoIndex,
  clearGitHubCache,
  normalizeQuestionArray,
} from '../data/questionBank';
import { GitHubRepoIndex } from '../types';

interface GitHubConfigModalProps {
  repoIndex: GitHubRepoIndex | null;
  onClose: () => void;
  onQuestionsLoaded: (newIndex?: GitHubRepoIndex | null) => void;
}

export const GitHubConfigModal: React.FC<GitHubConfigModalProps> = ({
  repoIndex,
  onClose,
  onQuestionsLoaded,
}) => {
  const [activeTab, setActiveTab] = useState<'github' | 'paste'>('github');
  const [url, setUrl] = useState(getConfiguredGitHubUrl());
  const [jsonInput, setJsonInput] = useState(localStorage.getItem('oly_custom_json') || '');
  const [loading, setLoading] = useState(false);
  const [localIndex, setLocalIndex] = useState<GitHubRepoIndex | null>(repoIndex);
  const [statusMsg, setStatusMsg] = useState<{ success?: boolean; text?: string } | null>(null);

  const handleSaveGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    try {
      const targetUrl = url.trim() || DEFAULT_GITHUB_REPO;
      localStorage.removeItem('oly_custom_json');
      localStorage.setItem('oly_github_url', targetUrl);
      clearGitHubCache();

      const index = await fetchGitHubRepoIndex(targetUrl, true);
      setLocalIndex(index);

      if (index && index.files.length > 0) {
        setStatusMsg({
          success: true,
          text: `Đã kết nối thành công kho đề GitHub (${index.owner}/${index.repo})! Tìm thấy ${index.files.length} file đề thi.`,
        });
      } else if (index && index.apiLimited) {
        setStatusMsg({
          success: true,
          text: `Đã lưu kho đề GitHub (${index.owner}/${index.repo}). Đề sẽ được tải trực tiếp từ raw.githubusercontent.com theo lớp & vòng.`,
        });
      } else {
        setStatusMsg({
          success: true,
          text: `Đã lưu nguồn GitHub. Hệ thống sẽ tự động tải file l{lớp}_c{vòng}.json tương ứng khi chọn lớp/vòng.`,
        });
      }
      onQuestionsLoaded(index);
    } catch (err: any) {
      setStatusMsg({ success: false, text: 'Lỗi kết nối: ' + (err.message || 'Không thể tải từ GitHub.') });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJson = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    try {
      const parsed = JSON.parse(jsonInput.trim());
      const normalized = normalizeQuestionArray(parsed, undefined, undefined, 'custom');
      if (normalized.length === 0) {
        throw new Error('Không tìm thấy câu hỏi hợp lệ trong dữ liệu JSON.');
      }

      localStorage.setItem('oly_custom_json', jsonInput.trim());
      setStatusMsg({
        success: true,
        text: `Đã lưu thành công ${normalized.length} câu hỏi từ JSON tùy chỉnh! Các lớp/vòng khác vẫn tự động tải từ GitHub.`,
      });
      onQuestionsLoaded(localIndex);
    } catch (err: any) {
      setStatusMsg({ success: false, text: 'JSON không hợp lệ: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleMultipleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setStatusMsg(null);

    try {
      const allMergedQuestions: any[] = [];

      const existingCustom = localStorage.getItem('oly_custom_json');
      if (existingCustom) {
        try {
          const parsedExisting = JSON.parse(existingCustom);
          if (Array.isArray(parsedExisting)) {
            allMergedQuestions.push(...parsedExisting);
          }
        } catch (e) {}
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (evt) => resolve((evt.target?.result as string) || '');
          reader.onerror = (err) => reject(err);
          reader.readAsText(file);
        });

        const parsedFileJson = JSON.parse(text);
        if (Array.isArray(parsedFileJson)) {
          allMergedQuestions.push(...parsedFileJson);
        } else if (typeof parsedFileJson === 'object' && parsedFileJson !== null) {
          allMergedQuestions.push(parsedFileJson);
        }
      }

      const combinedString = JSON.stringify(allMergedQuestions, null, 2);
      setJsonInput(combinedString);
      localStorage.setItem('oly_custom_json', combinedString);

      setStatusMsg({
        success: true,
        text: `Đã tải và gộp thành công ${files.length} file JSON! Tổng số câu hỏi tùy chỉnh: ${allMergedQuestions.length}.`,
      });
      onQuestionsLoaded(localIndex);
    } catch (err: any) {
      setStatusMsg({ success: false, text: 'Lỗi khi đọc file: ' + (err.message || 'File JSON không hợp lệ.') });
    } finally {
      setLoading(false);
    }
  };

  const handleResetDefault = async () => {
    setLoading(true);
    localStorage.removeItem('oly_custom_json');
    localStorage.setItem('oly_github_url', DEFAULT_GITHUB_REPO);
    setUrl(DEFAULT_GITHUB_REPO);
    setJsonInput('');
    clearGitHubCache();

    const index = await fetchGitHubRepoIndex(DEFAULT_GITHUB_REPO, true);
    setLocalIndex(index);
    setStatusMsg({
      success: true,
      text: `Đã khôi phục kho GitHub mặc định (${DEFAULT_GITHUB_REPO}).`,
    });
    onQuestionsLoaded(index);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-gradient-to-r from-indigo-700 to-purple-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FolderGit2 className="w-6 h-6 text-yellow-300" />
            <h3 className="text-xl font-extrabold">Tải Đề & Cấu Hình Nguồn Đề</h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50 px-6">
          <button
            onClick={() => setActiveTab('github')}
            className={`py-3 px-6 font-bold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'github' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500'
            }`}
          >
            <Github className="w-4 h-4" />
            <span>Kho đề GitHub</span>
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`py-3 px-6 font-bold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'paste' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Tải Nhiều File JSON / Dán</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'github' ? (
            <form onSubmit={handleSaveGitHub} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Link Repository GitHub (hoặc link Raw JSON):
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Quy tắc đặt tên file tự động trong repo: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono font-bold text-purple-700">l&#123;lớp&#125;_c&#123;vòng&#125;.json</code> (ví dụ: <code>l4_c1.json</code>, <code>l4_c2.json</code>, <code>l9_c3.json</code>). Mỗi lần bật web hoặc chọn lớp/vòng, hệ thống sẽ tự động tải bản mới nhất từ GitHub.
                </p>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={DEFAULT_GITHUB_REPO}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-600 outline-none text-sm font-medium text-gray-800"
                />
              </div>

              {localIndex && localIndex.files.length > 0 && (
                <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-black text-purple-900">
                    Các bộ đề hiện có trên GitHub ({localIndex.owner}/{localIndex.repo}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {localIndex.files.map((f) => (
                      <span
                        key={f.filename}
                        className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg text-xs font-mono font-bold shadow-xs"
                      >
                        {f.filename} (Lớp {f.grade} - Vòng {f.round})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Đồng bộ & Lưu nguồn GitHub</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleSaveJson} className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-sm font-bold text-gray-700">Chọn nhiều file JSON hoặc dán trực tiếp:</label>
                <label className="cursor-pointer px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow">
                  <Upload className="w-4 h-4" />
                  <span>Chọn nhiều file .json cùng lúc</span>
                  <input type="file" accept=".json" multiple onChange={handleMultipleFilesUpload} className="hidden" />
                </label>
              </div>

              <textarea
                rows={9}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='[ { "id": "l4_c1_tn_0001", "grade": 4, "round": 1, "type": "tn", ... } ]'
                className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-purple-600 outline-none font-mono text-xs text-gray-800 bg-gray-50"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>Lưu & Gộp bộ đề JSON tùy chỉnh</span>
              </button>
            </form>
          )}

          {statusMsg && (
            <div
              className={`p-4 rounded-xl text-sm flex items-start gap-2.5 ${
                statusMsg.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {statusMsg.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <button
            type="button"
            onClick={handleResetDefault}
            className="text-xs text-purple-700 hover:text-purple-900 font-bold px-3 py-2 rounded-lg transition cursor-pointer"
          >
            Khôi phục kho đề mặc định
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-sm transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
