interface ErrorFallbackProps {
  error: unknown;
  resetError: () => void;
}

const ErrorFallback = ({ error, resetError }: ErrorFallbackProps) => {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold text-red-400">Something went wrong</h2>
        <p className="text-gray-400">
          An unexpected error occurred. Please try refreshing the page.
        </p>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-300">
            Error details
          </summary>
          <pre className="mt-2 text-xs bg-black/50 p-3 rounded overflow-auto">
            {error instanceof Error ? error.toString() : String(error)}
          </pre>
        </details>
        <button
          onClick={resetError}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
};

export default ErrorFallback;