interface Props {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div className="text-center py-16 text-red-500">
      <p className="font-medium">Something went wrong</p>
      <p className="text-sm mt-1 text-gray-500">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
        >
          Try Again
        </button>
      )}
    </div>
  )
}
