import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Đã xảy ra lỗi không mong muốn.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && parsed.error) {
          displayMessage = parsed.error.includes('Quota exceeded')
            ? 'Hệ thống cơ sở dữ liệu đã đạt hạn mức miễn phí trong ngày, vui lòng thử lại vào ngày mai.'
            : `Lỗi truy cập dữ liệu (${parsed.operationType || 'firebase'}): ${parsed.error}`;
        }
      } catch {
        // Keep plain message
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border-4 border-red-200 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-black text-purple-950">Đã xảy ra sự cố tạm thời</h2>
            <p className="text-sm text-gray-600 font-medium break-words">{displayMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-black text-sm inline-flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Tải lại trang</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
