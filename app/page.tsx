export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Top header bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 h-12 shrink-0">
        <span className="text-sm font-semibold tracking-wide text-gray-100">
          KnowledgeOS
        </span>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors">
            ⌘N
          </button>
          <button className="px-2 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors">
            ⌘/
          </button>
          <button className="px-2 py-1 text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded transition-colors">
            ⌘G
          </button>
        </div>
      </header>

      {/* Main content below header */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
          {/* Sidebar header */}
          <div className="px-4 py-3 border-b border-gray-800">
            <h1 className="text-sm font-semibold text-gray-100 tracking-wide">
              KnowledgeOS
            </h1>
          </div>

          {/* View tabs */}
          <div className="flex gap-1 px-3 py-2 border-b border-gray-800">
            <button className="flex-1 px-3 py-1.5 text-xs font-medium rounded bg-gray-800 text-gray-100 transition-colors">
              Raw
            </button>
            <button className="flex-1 px-3 py-1.5 text-xs font-medium rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors">
              Wiki
            </button>
          </div>

          {/* Notes list placeholder */}
          <div className="flex-1 flex items-center justify-center px-4">
            <p className="text-xs text-gray-600">No notes yet</p>
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex-1 bg-gray-950 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-gray-600">Select a note</p>
          </div>
        </main>
      </div>
    </div>
  );
}
