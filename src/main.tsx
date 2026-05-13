import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { BookOpen, Settings, ExternalLink } from 'lucide-react'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="w-80 h-96 bg-slate-900 text-white flex flex-col">
      <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex items-center justify-center gap-2">
        <h1 className="text-lg font-bold tracking-wider text-indigo-400">GOBLIN</h1>
        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded">Beta</span>
      </div>
      
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
        <BookOpen size={48} className="text-indigo-400 opacity-80" />
        <div>
          <h2 className="font-semibold text-lg">YouTube Learn Mode</h2>
          <p className="text-sm text-slate-400 mt-2">
            Open any YouTube video to start taking smart notes, generating quizzes, and tracking your progress.
          </p>
        </div>
      </div>
      
      <div className="p-4 border-t border-slate-800 flex justify-between bg-slate-900">
        <button className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
          <Settings size={16} />
          Settings
        </button>
        <button className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
          Dashboard
          <ExternalLink size={16} />
        </button>
      </div>
    </div>
  </React.StrictMode>,
)
