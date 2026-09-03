import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
          <div className="text-5xl">😵</div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
            Noget gik galt
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md text-center">
            {this.state.error?.message ?? 'En uventet fejl opstod.'}
          </p>
          <button
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Prøv igen
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
