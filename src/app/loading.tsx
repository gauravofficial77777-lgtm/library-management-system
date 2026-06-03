export default function GlobalLoading() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center space-y-4 bg-slate-50">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
      <p className="text-xs font-medium text-gray-500 tracking-wider">Deploying Control Workspace...</p>
    </div>
  )
}
