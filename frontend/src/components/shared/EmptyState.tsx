interface Props {
  message?: string
}

export function EmptyState({ message }: Props) {
  return (
    <div className="text-center py-16 text-gray-500 dark:text-gray-400">
      <p className="font-medium text-lg">No ads found</p>
      <p className="text-sm mt-1">{message || 'Try a different brand name or check the spelling.'}</p>
    </div>
  )
}
