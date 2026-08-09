import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check, Bug, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }




  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorDetails = `Error: ${error?.name || 'Unknown Error'}: ${error?.message || ''}\n\nStack:\n${error?.stack || ''}\n\nComponent Stack:\n${errorInfo?.componentStack || ''}`;
    
    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }).catch((err) => {
      console.error('Failed to copy error details:', err);
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans selection:bg-rose-500/30 selection:text-rose-200">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl shrink-0">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    Application Error
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Unhandled Exception Caught
                  </span>
                </div>
                <h1 className="text-xl font-bold text-slate-100 tracking-tight">
                  Something went wrong in the application
                </h1>
                <p className="text-sm text-slate-400 leading-relaxed">
                  An unexpected runtime error occurred. You can attempt to recover by clicking "Try Again" or reload the application.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="bg-slate-950 border border-rose-900/30 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-rose-300 font-semibold border-b border-rose-900/20 pb-2">
                <span className="flex items-center space-x-1.5">
                  <Bug className="w-3.5 h-3.5 text-rose-400" />
                  <span>{this.state.error?.name || 'Error'}</span>
                </span>
                <button
                  type="button"
                  onClick={this.handleCopyError}
                  className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors bg-slate-900 px-2 py-1 rounded border border-slate-800"
                  title="Copy error details"
                >
                  {this.state.copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Details</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-rose-200 font-bold break-all leading-snug">
                {this.state.error?.message || 'Unknown error occurred'}
              </div>

              {this.state.error?.stack && (
                <details className="mt-2 text-slate-400">
                  <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300 select-none transition-colors">
                    View stack trace & component hierarchy
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-900 rounded-lg text-[10px] leading-relaxed text-slate-300 overflow-x-auto max-h-48 border border-slate-800/80 font-mono whitespace-pre-wrap break-all">
                    {this.state.error.stack}
                    {this.state.errorInfo?.componentStack && `\n\nComponent Hierarchy:${this.state.errorInfo.componentStack}`}
                  </pre>
                </details>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center space-x-2 text-slate-500 text-xs">
                <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Error details logged to browser console</span>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-700"
                >
                  Reload App
                </button>
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-rose-600/20"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
