import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: (error: Error, retry: () => void) => ReactNode };

export class ErrorBoundary extends Component<Props, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  retry = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback(this.state.error!, this.retry);

      return (
        <div className="grid min-h-dvh place-items-center bg-canvas px-4">
          <div className="flex w-full max-w-sm flex-col gap-4 text-center">
            <h1 className="text-lg font-semibold text-ink">Algo deu errado</h1>
            <p className="text-sm text-muted">
              Ocorreu um erro inesperado. Confira o console para detalhes e tente recarregar.
            </p>
            <button
              type="button"
              onClick={this.retry}
              className="rounded-[8px] border border-line bg-elevated px-4 py-2 text-sm text-ink transition-colors hover:border-line-strong hover:bg-surface"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-xs text-faint underline hover:text-muted"
            >
              Recarregar a página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
