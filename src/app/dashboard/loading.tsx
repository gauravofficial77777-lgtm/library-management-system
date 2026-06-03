export default function Loading() {
  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center space-y-4 rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <div className="absolute h-full w-full animate-spin rounded-full border-4 border-gray-100 border-t-indigo-600" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700">Syncing Live Data Grid</p>
        <p className="text-[11px] text-gray-400 mt-0.5">Fetching latest library logs from database...</p>
      </div>
    </div>
  )
}
