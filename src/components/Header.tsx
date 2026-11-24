import React from 'react';
import { History, Smile, CloudDownload } from 'lucide-react';
import { soundFx } from '../utils/sound';

interface HeaderProps {
  onOpenHistory: () => void;
  onOpenGitHubConfig: () => void;
  onHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenHistory, onOpenGitHubConfig, onHome }) => {
  return (
    <header className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white shadow-2xl sticky top-0 z-50 border-b-4 border-yellow-300">
      <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <div
          onClick={() => {
            soundFx.playClick();
            onHome();
          }}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/25 flex items-center justify-center border-2 border-yellow-300 group-hover:scale-110 transition-all shadow-lg animate-bounce">
            <Smile className="w-7 h-7 text-yellow-300 fill-yellow-300" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-wider flex items-center gap-2 drop-shadow-md">
              OlyEnglish{' '}
              <span className="text-xs bg-yellow-400 text-purple-950 font-black px-2.5 py-1 rounded-full uppercase shadow animate-pulse">
                🎯 Siêu Sao
              </span>
            </h1>
            <p className="text-xs text-pink-200 hidden sm:block font-semibold">
              Đấu trường thi tiếng Anh vui nhộn & thông minh cho bé
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              soundFx.playClick();
              onOpenGitHubConfig();
            }}
            className="flex items-center space-x-2 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-teal-950 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition shadow-lg transform hover:scale-105 border-2 border-white/60 cursor-pointer"
          >
            <CloudDownload className="w-4 h-4 stroke-[2.5]" />
            <span>Tải đề</span>
          </button>

          <button
            onClick={() => {
              soundFx.playClick();
              onOpenHistory();
            }}
            className="flex items-center space-x-2 bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 text-purple-950 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition shadow-lg transform hover:scale-105 border-2 border-white/40 cursor-pointer"
          >
            <History className="w-4 h-4" />
            <span>Lịch Sử Thi</span>
          </button>
        </div>
      </div>
    </header>
  );
};
