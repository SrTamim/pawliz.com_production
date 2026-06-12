export default function LoadingOverlay({ isLoading, message = "Loading..." }: any) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00e5a0]" />
        <p className="text-gray-700 dark:text-gray-200">{message}</p>
      </div>
    </div>
  );
}
