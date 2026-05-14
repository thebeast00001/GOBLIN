import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, GraduationCap, Brain, PlayCircle, X, Settings as SettingsIcon, Save, Send, Clock, Pin, PinOff, Plus, Trash2, Copy, Check, Camera, Image as ImageIcon, Paperclip, FileText, Clapperboard, Network, Scissors, ShieldCheck, Link } from 'lucide-react';
import { getYouTubeTranscript, getYouTubeMetadata, formatTime } from './youtubeUtils';
import { chatWithVideo, performWebSearch } from './aiUtils';
import { parseDocument } from './documentParser';
import type { AIProvider, AISettings, ChatMessage } from './aiUtils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MindMapGraph } from './MindMapGraph';
import type { MindMapData } from './MindMapGraph';

export interface ChatSession {
  id: string;
  videoId: string;
  videoTitle: string;
  messages: ChatMessage[];
  pinned: boolean;
  updatedAt: number;
}

export const Sidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'mindmap' | 'shorts' | 'settings'>('chat');
  
  const [mindMapData, setMindMapData] = useState<MindMapData | null>(null);
  
  // Auto-Shorts State
  const [godModePlaylist, setGodModePlaylist] = useState<{start: number, end: number, topic: string}[] | null>(null);
  const [currentGodModeIndex, setCurrentGodModeIndex] = useState<number>(0);
  
  const [aiSettings, setAiSettings] = useState<AISettings>({
    provider: 'openrouter',
    apiKey: '',
    model: 'google/gemini-2.5-flash',
    baseUrl: 'http://localhost:11434'
  });

  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Draggable HUD State
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number } | null>(null);

  // Draggable Toggle State
  const [togglePosition, setTogglePosition] = useState({ x: window.innerWidth - 60, y: 100 });
  const [isDraggingToggle, setIsDraggingToggle] = useState(false);
  const [toggleOrientation, setToggleOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const toggleDragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number, dragged: boolean } | null>(null);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['goblin_ai_settings', 'goblin_chat_history'], (result) => {
        if (result.goblin_ai_settings?.provider) {
          setAiSettings(result.goblin_ai_settings);
        }
        if (result.goblin_chat_history) {
          setChatHistory(result.goblin_chat_history);
        }
      });
    }
  }, []);

  const saveSettings = (settings: AISettings) => {
    setAiSettings(settings);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ goblin_ai_settings: settings });
    }
  };

  const saveChat = (id: string, videoId: string, videoTitle: string, updatedMessages: ChatMessage[]) => {
    setChatHistory(prev => {
      const existing = prev.find(c => c.id === id);
      const updated = existing 
        ? prev.map(c => c.id === id ? { ...c, messages: updatedMessages, updatedAt: Date.now() } : c)
        : [{ id, videoId, videoTitle, messages: updatedMessages, pinned: false, updatedAt: Date.now() }, ...prev];
      
      if (typeof chrome !== 'undefined' && chrome.storage) chrome.storage.local.set({ goblin_chat_history: updated });
      return updated;
    });
  };

  const togglePin = (id: string) => {
    setChatHistory(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c);
      if (typeof chrome !== 'undefined' && chrome.storage) chrome.storage.local.set({ goblin_chat_history: updated });
      return updated;
    });
  };

  const deleteChat = (id: string) => {
    setChatHistory(prev => {
      const updated = prev.filter(c => c.id !== id);
      if (typeof chrome !== 'undefined' && chrome.storage) chrome.storage.local.set({ goblin_chat_history: updated });
      return updated;
    });
    if (currentChatId === id) {
      setCurrentChatId(null);
      setActiveTab('chat');
    }
  };


  const stopPropagation = (e: React.KeyboardEvent | React.MouseEvent) => {
    e.stopPropagation();
    if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  if (!isOpen) {
    const safeToggleX = Math.max(0, Math.min(togglePosition.x, window.innerWidth - 50));
    const safeToggleY = Math.max(0, Math.min(togglePosition.y, window.innerHeight - 100));

    return (
      <div 
        className="fixed z-[9999] cursor-grab active:cursor-grabbing touch-none"
        style={{ left: safeToggleX, top: safeToggleY }}
        onPointerDown={(e) => {
          setIsDraggingToggle(true);
          toggleDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: togglePosition.x,
            initialY: togglePosition.y,
            dragged: false
          };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!isDraggingToggle || !toggleDragRef.current) return;
          const dx = e.clientX - toggleDragRef.current.startX;
          const dy = e.clientY - toggleDragRef.current.startY;
          
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            toggleDragRef.current.dragged = true;
          }

          setTogglePosition({
            x: Math.max(0, Math.min(window.innerWidth - 50, toggleDragRef.current.initialX + dx)),
            y: Math.max(0, Math.min(window.innerHeight - 100, toggleDragRef.current.initialY + dy))
          });
        }}
        onPointerUp={(e) => {
          setIsDraggingToggle(false);
          if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          }
          if (toggleDragRef.current && !toggleDragRef.current.dragged) {
            setIsOpen(true);
          }
          toggleDragRef.current = null;
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setToggleOrientation(prev => prev === 'vertical' ? 'horizontal' : 'vertical');
        }}
      >
        <div className={`bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white font-semibold py-3 px-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.8)] transition-all group pointer-events-none flex ${toggleOrientation === 'vertical' ? 'flex-col items-center gap-3' : 'flex-row items-center gap-3 px-4 py-2'}`}>
          <div className="bg-red-600 p-2 rounded-lg group-hover:scale-110 transition-transform shadow-lg shadow-red-600/20 shrink-0">
            <GraduationCap size={24} className="text-white" />
          </div>
          <span 
            className={`text-[10px] font-bold tracking-widest uppercase opacity-90 transition-all ${toggleOrientation === 'vertical' ? 'mt-1' : 'ml-1 text-[12px]'}`} 
            style={{ writingMode: toggleOrientation === 'vertical' ? 'vertical-rl' : 'horizontal-tb' }}
          >
            GOBLIN
          </span>
        </div>
      </div>
    );
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 400, dragRef.current.initialX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.initialY + dy))
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    dragRef.current = null;
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  // Ensure the HUD is always visible, even if the window is resized
  const safeX = Math.max(0, Math.min(position.x, window.innerWidth - 420));
  const safeY = Math.max(0, Math.min(position.y, window.innerHeight - 520));

  return (
    <div 
      className={`fixed w-[400px] h-[85vh] min-h-[500px] max-h-[900px] bg-neutral-950 text-slate-200 shadow-[0_0_80px_rgba(0,0,0,0.9)] z-[10000] flex flex-col border border-neutral-800 rounded-2xl overflow-hidden ${isDragging ? 'shadow-red-900/20' : 'transition-shadow'}`}
      style={{ left: `${safeX}px`, top: `${safeY}px` }}
      onKeyDown={stopPropagation} onKeyUp={stopPropagation} onKeyPress={stopPropagation}
    >
      {/* Header - Drag Handle */}
      <div 
        className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950 shrink-0 cursor-move"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded-lg shadow-md shadow-red-600/20">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white tracking-tight leading-none">GOBLIN</h2>
            <p className="text-[10px] text-red-500 font-bold tracking-widest uppercase mt-1">AI Companion</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setActiveTab('chat'); setCurrentChatId(null); }} className="p-2 hover:bg-neutral-800 hover:text-white rounded-full transition-all duration-300 text-neutral-400" title="New Chat">
            <Plus size={20} />
          </button>
          <button onClick={() => setActiveTab('history')} className={`p-2 rounded-full transition-all duration-300 ${activeTab === 'history' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`} title="Chat History">
            <Clock size={20} />
          </button>
          <button onClick={() => setActiveTab('settings')} className={`p-2 rounded-full transition-all duration-300 ${activeTab === 'settings' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`} title="Settings">
            <SettingsIcon size={20} />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-neutral-800 hover:text-white rounded-full transition-all duration-300 text-neutral-400">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-3 gap-2 border-b border-neutral-800 bg-neutral-950 shrink-0">
        <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageCircle size={16} />} label="Chat" />
        <TabButton active={activeTab === 'mindmap'} onClick={() => setActiveTab('mindmap')} icon={<Network size={16} />} label="Mind Map" />
        <TabButton active={activeTab === 'shorts'} onClick={() => setActiveTab('shorts')} icon={<Scissors size={16} />} label="Auto-Shorts" />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto relative flex flex-col bg-neutral-950">
        <div style={{ display: activeTab === 'chat' ? 'flex' : 'none', flex: 1, flexDirection: 'column' }}>
          <ChatPanel 
            aiSettings={aiSettings} 
            stopPropagation={stopPropagation} 
            saveChat={saveChat} 
            chatId={currentChatId} 
            setChatId={setCurrentChatId} 
            initialSession={chatHistory.find(c => c.id === currentChatId)} 
            setGodModePlaylist={setGodModePlaylist}
            setCurrentGodModeIndex={setCurrentGodModeIndex}
            setMindMapData={setMindMapData}
            setActiveTab={setActiveTab}
          />
        </div>
        <div style={{ display: activeTab === 'history' ? 'block' : 'none' }}>
          <HistoryPanel 
            history={chatHistory} 
            onSelectChat={(id) => { setCurrentChatId(id); setActiveTab('chat'); }} 
            onTogglePin={togglePin} 
            onDeleteChat={deleteChat}
          />
        </div>
        <div style={{ display: activeTab === 'mindmap' ? 'block' : 'none' }} className="absolute inset-0 z-50">
          <MindMapGraph data={mindMapData} />
        </div>
        <div style={{ display: activeTab === 'shorts' ? 'block' : 'none' }} className="absolute inset-0 z-50 bg-neutral-950">
          <ShortsPlayer 
            playlist={godModePlaylist} 
            currentIndex={currentGodModeIndex} 
            setIndex={setCurrentGodModeIndex} 
            videoId={chatHistory.find(c => c.id === currentChatId)?.videoId || document.querySelector('video')?.baseURI.split('v=')[1]?.split('&')[0]} 
          />
        </div>
        <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }} className="p-5">
          <SettingsPanel settings={aiSettings} onSave={saveSettings} stopPropagation={stopPropagation} />
        </div>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${active ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}>
    {icon} {label}
  </button>
);

const HistoryPanel = ({ history, onSelectChat, onTogglePin, onDeleteChat }: any) => {
  const pinned = history.filter((c: any) => c.pinned);
  const unpinned = history.filter((c: any) => !c.pinned);

  return (
    <div className="p-4 space-y-6">
      {pinned.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3 px-1">Pinned Chats</h3>
          <div className="space-y-2">
            {pinned.map((c: any) => <HistoryCard key={c.id} chat={c} onSelect={onSelectChat} onTogglePin={onTogglePin} onDelete={onDeleteChat} />)}
          </div>
        </div>
      )}
      <div>
        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3 px-1">Recent Chats</h3>
        {unpinned.length === 0 && <p className="text-sm text-neutral-500 px-1">No recent chats.</p>}
        <div className="space-y-2">
          {unpinned.map((c: any) => <HistoryCard key={c.id} chat={c} onSelect={onSelectChat} onTogglePin={onTogglePin} onDelete={onDeleteChat} />)}
        </div>
      </div>
    </div>
  );
};

const HistoryCard = ({ chat, onSelect, onTogglePin, onDelete }: any) => (
  <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 p-3 rounded-xl hover:border-neutral-600 transition-all cursor-pointer group" onClick={() => onSelect(chat.id)}>
    <div className="flex-1 min-w-0">
      <h4 className="text-sm font-semibold text-white truncate">{chat.videoTitle || 'Untitled Chat'}</h4>
      <p className="text-xs text-neutral-500 truncate mt-0.5">{chat.messages[0]?.text || 'No messages'}</p>
    </div>
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={(e) => { e.stopPropagation(); onTogglePin(chat.id); }} className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md">
        {chat.pinned ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
      <button onClick={(e) => { e.stopPropagation(); onDelete(chat.id); }} className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-neutral-800 rounded-md">
        <Trash2 size={14} />
      </button>
    </div>
  </div>
);

const ShortsPlayer = ({ playlist, currentIndex, setIndex, videoId }: any) => {
  const currentClip = playlist?.[currentIndex];
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!currentClip) return;
    const video = document.querySelector('video');
    if (!video) return;

    // Start playing current clip
    video.currentTime = currentClip.start;
    video.play();

    const handleTimeUpdate = () => {
      const duration = currentClip.end - currentClip.start;
      const elapsed = video.currentTime - currentClip.start;
      const currentProgress = Math.max(0, Math.min(100, (elapsed / duration) * 100));
      setProgress(currentProgress);

      if (video.currentTime >= currentClip.end) {
        if (currentIndex < playlist.length - 1) {
          setIndex(currentIndex + 1);
        } else {
          video.pause();
        }
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [currentIndex, currentClip, playlist, setIndex]);

  if (!playlist || playlist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-neutral-500 h-full p-6 text-center">
        <Scissors size={48} className="text-neutral-700 mb-4" />
        <h3 className="text-xl font-bold text-neutral-300 mb-2">Auto-Shorts Generator</h3>
        <p className="text-sm max-w-[250px]">Click the Scissors icon in the chat to auto-generate a highlight reel of this video.</p>
      </div>
    );
  }

  if (!currentClip || !videoId) return null;

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Video Player Area */}
      <div className="relative w-full aspect-[9/16] bg-black max-h-[50vh] flex-shrink-0 mx-auto max-w-[360px] overflow-hidden rounded-b-2xl border-b border-neutral-800 shadow-2xl">
        <img 
          src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`} 
          alt="Video Thumbnail" 
          className="absolute inset-0 w-full h-full object-cover opacity-50 blur-sm scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40"></div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-red-600/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full font-bold text-xs tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(239,68,68,0.5)] flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            Live Control
          </div>
        </div>
        {/* Overlay to block interaction and show topic */}
        <div className="absolute bottom-6 left-4 right-4 z-10 text-white shadow-xl rounded-xl overflow-hidden backdrop-blur-xl bg-black/40 border border-white/10 p-4">
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1.5 flex justify-between">
              <span>Segment {currentIndex + 1}/{playlist.length}</span>
              <span className="text-neutral-400">{Math.round(progress)}%</span>
            </p>
            <p className="text-sm font-bold leading-snug line-clamp-2">{currentClip.topic}</p>
        </div>
      </div>
      
      {/* Playlist Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4 px-1">Highlight Reel Queue</h3>
        <div className="space-y-3">
          {playlist.map((clip: any, i: number) => (
            <div 
              key={i} 
              onClick={() => setIndex(i)}
              className={`relative overflow-hidden p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${currentIndex === i ? 'bg-neutral-900 border-red-500/40 shadow-[0_4px_20px_rgba(239,68,68,0.15)] scale-[1.02]' : 'bg-[#0a0a0a] border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900 opacity-70 hover:opacity-100'}`}
            >
              {currentIndex === i && (
                <div 
                  className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-red-600 to-orange-500 shadow-[0_0_10px_rgba(239,68,68,1)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              )}
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-mono font-bold ${currentIndex === i ? 'text-red-400' : 'text-neutral-500'}`}>{formatTime(clip.start)} - {formatTime(clip.end)}</span>
                {currentIndex === i && <span className="flex w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>}
              </div>
              <p className={`text-[13px] leading-snug ${currentIndex === i ? 'text-white font-bold' : 'text-neutral-400 font-medium'}`}>{clip.topic}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SettingsPanel = ({ settings, onSave, stopPropagation }: { settings: AISettings, onSave: (s: AISettings) => void, stopPropagation: any }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-700">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2 text-sm">
          <SettingsIcon size={18} className="text-red-500" /> Bring Your Own Key (BYOK)
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">AI Provider</label>
            <select value={localSettings.provider} onChange={(e) => setLocalSettings({...localSettings, provider: e.target.value as AIProvider})} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600 transition-all appearance-none">
              <option value="openrouter">OpenRouter (Recommended)</option>
              <option value="gemini">Google Gemini API (with Web Search)</option>
              <option value="openai">OpenAI</option>
              <option value="claude">Anthropic Claude</option>
              <option value="ollama">Ollama (Local AI)</option>
            </select>
          </div>
          {localSettings.provider !== 'ollama' && (
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">API Key</label>
              <input type="password" placeholder={`Enter your ${localSettings.provider} API key`} value={localSettings.apiKey} onChange={(e) => setLocalSettings({...localSettings, apiKey: e.target.value})} onKeyDown={stopPropagation} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600 placeholder:text-neutral-500 transition-all" />
            </div>
          )}
          {localSettings.provider === 'ollama' && (
            <div>
              <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Ollama Base URL</label>
              <input type="text" placeholder="http://localhost:11434" value={localSettings.baseUrl} onChange={(e) => setLocalSettings({...localSettings, baseUrl: e.target.value})} onKeyDown={stopPropagation} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600 transition-all" />
            </div>
          )}
          <div>
            <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Model Name</label>
            <input type="text" placeholder={localSettings.provider === 'openrouter' ? 'google/gemini-1.5-pro' : 'gpt-4o-mini'} value={localSettings.model} onChange={(e) => setLocalSettings({...localSettings, model: e.target.value})} onKeyDown={stopPropagation} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-red-600 placeholder:text-neutral-500 transition-all" />
          </div>
          <button onClick={handleSave} className="w-full mt-6 bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold transition-all flex justify-center items-center gap-2 active:scale-[0.98]">
            {saved ? <span className="text-white flex items-center gap-2"><Save size={16}/> Saved Successfully!</span> : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatPanel = ({ aiSettings, stopPropagation, saveChat, chatId, setChatId, initialSession, setGodModePlaylist, setCurrentGodModeIndex, setMindMapData, setActiveTab }: any) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialSession ? initialSession.messages : []);
  const [input, setInput] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [attachedDocument, setAttachedDocument] = useState<{name: string, content: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(true);
  const [transcript, setTranscript] = useState<string>('');
  const [videoId, setVideoId] = useState<string>('');
  const [videoMetadata, setVideoMetadata] = useState<{title: string, channelName: string, description: string}>({ title: '', channelName: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialSession) {
      setMessages(initialSession.messages);
    } else if (!loading) {
      setMessages([]);
    }
  }, [initialSession]);

  useEffect(() => {
    const init = async () => {
      setIsExtracting(true);
      try {
        const urlParams = new URLSearchParams(window.location.search);
        let currentVideoId = urlParams.get('v');
        if (!currentVideoId && window.location.pathname === '/watch') {
          currentVideoId = window.location.href.split('v=')[1]?.split('&')[0];
        }

        if (!currentVideoId) {
          setError("Open a YouTube video to get transcript context.");
          setIsExtracting(false);
          return;
        }

        setVideoId(currentVideoId);
        const metadata = await getYouTubeMetadata();
        setVideoMetadata(metadata);

        const data = await getYouTubeTranscript(currentVideoId);
        if (!data || data.length === 0) {
          setError("No transcript available, but you can still chat!");
          setIsExtracting(false);
          return;
        }
        
        const fullTranscript = data.map((d: any) => `[${formatTime(d.start)}] ${d.text}`).join(' ');
        setTranscript(fullTranscript);
      } catch (err: any) {
        setError(err.message || "Could not load transcript, but you can still chat.");
      } finally {
        setIsExtracting(false);
      }
    };
    
    init();
    
    const handleUrlChange = () => init();
    window.addEventListener('yt-navigate-finish', handleUrlChange);
    return () => window.removeEventListener('yt-navigate-finish', handleUrlChange);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (overrideMessage?: string) => {
    const messageToSend = overrideMessage || input;
    if (!messageToSend.trim() && !capturedImage && !attachedDocument && !loading) return;
    if (loading) return;
    
    if (aiSettings.provider !== 'ollama' && !aiSettings.apiKey) {
      setError("Please configure your API key in Settings first!");
      return;
    }

    // If there is an attached document, we prepend it to the user's message invisibly
    let userMessage = messageToSend.trim();
    if (attachedDocument) {
      userMessage = `[ATTACHED DOCUMENT: ${attachedDocument.name}]\n\n${attachedDocument.content}\n\n---\nUser Question: ${userMessage}`;
    }

    const attachedImage = capturedImage;
    
    setInput('');
    setCapturedImage(null);
    setAttachedDocument(null);
    setError(null);
    setLoading(true);

    const activeId = chatId || `chat_${Date.now()}`;
    if (!chatId) setChatId(activeId);

    // Update messages locally and globally
    // We only display the user's typed message in the UI, but we send the full document context to the AI
    const uiMessage: ChatMessage = { 
      role: 'user', 
      text: messageToSend.trim() || `(Attached Document: ${attachedDocument?.name})`, 
      ...(attachedImage ? { images: [attachedImage] } : {}) 
    };
    
    const apiMessage: ChatMessage = { 
      role: 'user', 
      text: userMessage || `Please analyze this document: ${attachedDocument?.name}`, 
      ...(attachedImage ? { images: [attachedImage] } : {}) 
    };

    const updatedUIMessages: ChatMessage[] = [...messages, uiMessage];
    const updatedApiMessages: ChatMessage[] = [...messages, apiMessage];
    
    setMessages(updatedUIMessages);
    saveChat(activeId, videoId, videoMetadata.title || 'YouTube Video', updatedUIMessages);

    try {
      let aiResponse = await chatWithVideo(transcript, videoMetadata, updatedApiMessages, aiSettings);
      
      // Agentic Search Loop
      if (aiResponse.includes('[SEARCH:')) {
        const queryMatch = aiResponse.match(/\[SEARCH:\s*"?([^"]+)"?\]/) || aiResponse.match(/\[SEARCH:\s*(.*?)\]/);
        if (queryMatch && queryMatch[1]) {
          const query = queryMatch[1].trim();
          setSearchQuery(query);
          
          const searchResults = await performWebSearch(query);
          
          // Re-prompt the AI with the grounded search results
          const groundedMessages: ChatMessage[] = [
            ...updatedApiMessages,
            { role: 'assistant', text: `[SEARCH: "${query}"]` },
            { role: 'user', text: `Web Search Results for "${query}":\n\n${searchResults}\n\nBased on these results and the video context, please answer my original question.` }
          ];
          
          aiResponse = await chatWithVideo(transcript, videoMetadata, groundedMessages, aiSettings);
        }
      }
      
      // God Mode Extraction
      if (aiResponse.includes('[GOD_MODE_JSON]')) {
        try {
          const match = aiResponse.match(/\[GOD_MODE_JSON\]([\s\S]*?)\[\/GOD_MODE_JSON\]/);
          if (match && match[1]) {
            const playlist = JSON.parse(match[1]);
            if (Array.isArray(playlist) && playlist.length > 0) {
              setGodModePlaylist(playlist);
              setCurrentGodModeIndex(0);
              setActiveTab('shorts'); // Switch to the shorts player
              aiResponse = aiResponse.replace(/\[GOD_MODE_JSON\]([\s\S]*?)\[\/GOD_MODE_JSON\]/, '✨ **AUTO-SHORTS ACTIVATED.** I have successfully analyzed the video and extracted the best highlights into a seamless reel. \n\nI am now controlling the main video player. Sit back and watch.');
            }
          }
        } catch (e) {
          console.error('Failed to parse God Mode JSON', e);
        }
      }

      // Mind Map Extraction
      if (aiResponse.includes('[MIND_MAP_JSON]')) {
        try {
          const match = aiResponse.match(/\[MIND_MAP_JSON\]([\s\S]*?)\[\/MIND_MAP_JSON\]/);
          if (match && match[1]) {
            const data = JSON.parse(match[1]);
            setMindMapData(data);
            setActiveTab('mindmap');
            aiResponse = aiResponse.replace(/\[MIND_MAP_JSON\]([\s\S]*?)\[\/MIND_MAP_JSON\]/, '🕸️ **MIND MAP GENERATED.** I have successfully processed the video context into a visual knowledge graph. Opening the Mind Map tab now!');
          }
        } catch (e) {
          console.error('Failed to parse Mind Map JSON', e);
        }
      }
      
      // Use functional state update to prevent overwriting if the user switched chats while loading
      setMessages(prev => {
        // If the user hasn't switched chats, append to current view
        if (activeId === chatId || !chatId) {
           return [...prev, { role: 'assistant', text: aiResponse }];
        }
        return prev; // If they switched, keep current view intact
      });
      
      // But ALWAYS save the response globally to the correct background chat!
      saveChat(activeId, videoId, videoMetadata.title || 'YouTube Video', [...updatedUIMessages, { role: 'assistant', text: aiResponse }]);

    } catch (err: any) {
      if (activeId === chatId) setError(err.message);
    } finally {
      setLoading(false);
      setSearchQuery(null);
    }
  };

  return (
    <div className="flex flex-col h-full relative bg-neutral-950">
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar pb-48">
        {error && (
          <div className="bg-neutral-900 border-l-4 border-red-500 text-red-400 p-4 rounded-r-lg text-[13px] shrink-0 flex items-start gap-3 shadow-md">
            <div className="pt-0.5">⚠️</div>
            <div className="leading-relaxed text-neutral-400"><span className="text-white font-bold block mb-1">Error</span> {error}</div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center space-y-4 opacity-70 h-full mt-10">
            <div className="bg-neutral-900 p-6 rounded-full border border-neutral-700">
              <MessageCircle size={40} className="text-neutral-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Chat with this Video</h3>
              <p className="text-[13px] text-neutral-400 max-w-[260px] mx-auto leading-relaxed">
                Ask to summarize specific timestamps, clarify concepts, or extract key takeaways.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg: any, i: number) => (
            <div key={i} className={`flex flex-col group/msg relative ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[95%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-neutral-800 text-white rounded-tr-sm' : 'bg-transparent text-neutral-200 rounded-tl-sm markdown-body'}`}>
                {msg.images && msg.images.length > 0 && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-neutral-700 w-fit">
                    <img src={msg.images[0]} alt="Attached frame" className="max-w-[200px] h-auto object-cover rounded" />
                  </div>
                )}
                {msg.role === 'user' ? (
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
                    {(() => {
                      // Hide the system prompt brackets from the user's view, but don't break timestamp tags like [01:23]
                      if (msg.text.startsWith('[')) {
                        const match = msg.text.match(/^\[(.*?)\]/);
                        if (match) {
                          const tag = match[1];
                          // If it's an AI prompt command (usually all caps or containing MODE/MAP), hide the huge text
                          if (tag.includes('MODE') || tag.includes('MAP') || tag.includes('FACT CHECK') || tag.includes('EXTRACT RESOURCES') || tag === 'CUT THE FLUFF' || tag === 'EXTRACT CHECKLIST' || tag === 'EXPLAIN LIKE I AM 5') {
                            return tag;
                          }
                        }
                      }
                      return msg.text;
                    })()}
                  </p>
                ) : (
                  <>
                    {(() => {
                      if (msg.text.includes('[FACT_CHECK_JSON]')) {
                        try {
                          // Try to match with closing tag first, fallback to end of string
                          const match = msg.text.match(/\[FACT_CHECK_JSON\]([\s\S]*?)(?:\[\/FACT_CHECK_JSON\]|$)/);
                          if (match && match[1]) {
                            // Clean up any trailing characters like commas or backticks that the AI might have accidentally added
                            const jsonString = match[1].trim().replace(/,$/, '').replace(/^```json/, '').replace(/```$/, '');
                            const data = JSON.parse(jsonString);
                            return (
                              <div className="bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden mt-2 mb-4 shadow-sm w-full min-w-[280px]">
                                <div className={`p-3 border-b ${data.verdict === 'TRUE' ? 'bg-green-500/10 border-green-500/20 text-green-400' : data.verdict === 'FALSE' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'} flex items-center justify-between`}>
                                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px]">
                                    <ShieldCheck size={14} /> {data.verdict} VERDICT
                                  </div>
                                </div>
                                <div className="p-4 space-y-4">
                                  <div>
                                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block mb-1">Verifiable Claim</span>
                                    <p className="text-white text-[13px] font-semibold italic border-l-2 border-neutral-700 pl-3 py-1">"{data.claim}"</p>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block mb-1">Grounded Truth</span>
                                    <p className="text-neutral-300 text-[13px] leading-relaxed">{data.truth}</p>
                                  </div>
                                  {data.sources && data.sources.length > 0 && (
                                    <div className="pt-3 border-t border-neutral-800/50">
                                      <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block mb-2">Verified Sources</span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {data.sources.map((s: string, i: number) => {
                                          try {
                                            const domain = new URL(s).hostname.replace('www.', '');
                                            return <a key={i} href={s} target="_blank" rel="noreferrer" className="text-[10px] text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-2 py-0.5 rounded-full truncate max-w-[150px] inline-flex transition-all">{domain}</a>;
                                          } catch(e) { return null; }
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                        } catch (e) {
                          console.error("Failed to parse fact check JSON", e);
                        }
                      }
                      
                      if (msg.text.includes('[RESOURCES_JSON]')) {
                        try {
                          const match = msg.text.match(/\[RESOURCES_JSON\]([\s\S]*?)(?:\[\/RESOURCES_JSON\]|$)/);
                          if (match && match[1]) {
                            const jsonString = match[1].trim().replace(/,$/, '').replace(/^```json/, '').replace(/```$/, '');
                            const data = JSON.parse(jsonString);
                            return (
                              <div className="bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden mt-2 mb-4 shadow-sm w-full min-w-[280px]">
                                <div className="p-3 border-b bg-blue-500/10 border-blue-500/20 text-blue-400 flex items-center justify-between">
                                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px]">
                                    <Link size={14} /> EXTRACTED RESOURCES
                                  </div>
                                </div>
                                <div className="p-4 space-y-4">
                                  {data.categories?.map((cat: any, idx: number) => (
                                    <div key={idx}>
                                      <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block mb-2">{cat.name}</span>
                                      <div className="space-y-2">
                                        {cat.items?.map((item: any, i2: number) => (
                                          <div key={i2} className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800/50">
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-white text-[13px] font-semibold">{item.name}</span>
                                              {item.url && (
                                                <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">
                                                  <Link size={12} />
                                                </a>
                                              )}
                                            </div>
                                            <p className="text-neutral-400 text-[11px] leading-relaxed">{item.context}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                        } catch (e) {
                          console.error("Failed to parse resources JSON", e);
                        }
                      }

                      return null;
                    })()}
                    <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({node, ...props}) => <p className="text-[14px] leading-relaxed mb-3 last:mb-0 text-neutral-300" {...props}/>,
                      ul: ({node, ...props}) => <ul className="list-disc pl-5 text-[14px] space-y-1.5 my-3 text-neutral-300" {...props}/>,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-5 text-[14px] space-y-1.5 my-3 text-neutral-300" {...props}/>,
                      strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props}/>,
                      h1: ({node, ...props}) => <h1 className="font-bold text-white mt-6 mb-3 text-xl border-b border-neutral-700 pb-2" {...props}/>,
                      h2: ({node, ...props}) => <h2 className="font-bold text-white mt-5 mb-3 text-lg border-b border-neutral-700 pb-1" {...props}/>,
                      h3: ({node, ...props}) => <h3 className="font-bold text-white mt-4 mb-2 text-base" {...props}/>,
                      a: ({node, href, children, ...props}: any) => {
                        if (href?.startsWith('#timestamp_')) {
                          const timeStr = href.replace('#timestamp_', '');
                          return (
                            <button 
                              onClick={(e) => {
                                stopPropagation(e);
                                const parts = timeStr.split(':').map(Number);
                                let seconds = 0;
                                if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                                else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
                                const video = document.querySelector('video');
                                if (video) {
                                  video.currentTime = seconds;
                                  video.play();
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 bg-red-500/10 hover:bg-red-600/90 text-red-500 hover:text-white rounded-md text-xs font-bold transition-all border border-red-500/20 hover:border-red-600 cursor-pointer shadow-sm group"
                              title={`Jump to ${timeStr} in video`}
                            >
                              <PlayCircle size={12} className="group-hover:scale-110 transition-transform" /> {timeStr}
                            </button>
                          );
                        }
                        return <a href={href} className="text-red-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                      },
                      code: ({node, inline, className, children, ...props}: any) => 
                        inline 
                          ? <code className="bg-neutral-800 px-1.5 py-0.5 rounded-md text-neutral-200 font-mono text-[12px] border border-neutral-700" {...props}>{children}</code>
                          : <CodeBlock className={className} {...props}>{children}</CodeBlock>,
                      pre: ({node, children, ...props}: any) => <div className="my-4">{children}</div>,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-neutral-600 pl-4 italic text-neutral-400 my-4 py-1" {...props}/>,
                      table: ({node, ...props}) => <div className="overflow-x-auto my-5 rounded-xl border border-neutral-700"><table className="w-full text-left border-collapse text-[13px]" {...props}/></div>,
                      th: ({node, ...props}) => <th className="border-b border-neutral-700 p-3 font-semibold text-white bg-neutral-900" {...props}/>,
                      td: ({node, ...props}) => <td className="border-b border-neutral-800 p-3 text-neutral-300 bg-neutral-950" {...props}/>,
                    }}
                  >
                    {msg.text.replace(/\[FACT_CHECK_JSON\][\s\S]*?\[\/FACT_CHECK_JSON\]/g, '').replace(/\[RESOURCES_JSON\][\s\S]*?\[\/RESOURCES_JSON\]/g, '').replace(/\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?/g, '[$1](#timestamp_$1)')}
                  </ReactMarkdown>
                  </>
                )}
                
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1 mt-3 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-300">
                    <MessageCopyButton text={msg.text} />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex items-start mb-2">
            <div className="bg-transparent px-4 py-2 flex items-center gap-3">
              {searchQuery ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full text-xs font-semibold shadow-sm animate-pulse">
                  <span>🔎 Searching Web: {searchQuery}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-2 py-2">
                  <div className="relative flex items-center justify-center w-6 h-6 text-red-500 animate-spin">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span className="text-[13px] font-medium text-neutral-400 animate-pulse tracking-wide">
                    Thinking deeply...
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-neutral-950 border-t border-neutral-800 flex flex-col gap-3 z-20">
        
        {/* Quick Prompts Slider */}
        {messages.length >= 0 && (
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 -mx-2 px-2 mask-edges">
            {[
              { icon: '✂️', text: 'Cut the Fluff', prompt: '[CUT THE FLUFF] Ignore all sponsored segments, intros, and filler. Provide a highly condensed summary of ONLY the actionable information and core arguments made in this video.' },
              { icon: '✅', text: 'Checklist', prompt: '[EXTRACT CHECKLIST] Convert the information in this video into a strict, step-by-step markdown checklist. Use checkboxes (- [ ]). Include precise timestamps [MM:SS] for each step.' },
              { icon: '👶', text: 'ELI5', prompt: '[EXPLAIN LIKE I AM 5] Explain the core concept of this video so simply that a 5-year-old would understand it. Use analogies.' }
            ].map((qp, idx) => (
              <button
                key={idx}
                onClick={(e) => { stopPropagation(e); handleSend(qp.prompt); }}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800 rounded-full text-xs font-semibold text-neutral-300 whitespace-nowrap transition-all shadow-sm shrink-0 disabled:opacity-50"
              >
                <span>{qp.icon}</span>
                <span>{qp.text}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col bg-neutral-900 border border-neutral-700 rounded-xl focus-within:border-neutral-500 transition-all shadow-sm">
          
          {/* Captured Image Thumbnail */}
          {(capturedImage || attachedDocument) && (
            <div className="px-4 pt-3 pb-1 flex items-start gap-3">
              {capturedImage && (
                <div className="relative group/img rounded-lg overflow-hidden border border-neutral-700">
                  <img src={capturedImage} alt="Captured frame" className="h-16 w-auto object-cover opacity-90" />
                  <button 
                    onClick={(e) => { stopPropagation(e); setCapturedImage(null); }}
                    className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-600 rounded-full text-white opacity-0 group-hover/img:opacity-100 transition-all backdrop-blur-sm"
                    title="Remove image"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              {attachedDocument && (
                <div className="relative group/doc flex items-center gap-2 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2">
                  <FileText size={20} className="text-blue-400" />
                  <span className="text-xs text-white max-w-[120px] truncate font-semibold">{attachedDocument.name}</span>
                  <button 
                    onClick={(e) => { stopPropagation(e); setAttachedDocument(null); }}
                    className="ml-2 p-1 bg-neutral-700 hover:bg-red-600 rounded-full text-white transition-all"
                    title="Remove document"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )}

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { stopPropagation(e); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            onClick={stopPropagation}
            onKeyUp={stopPropagation}
            onKeyPress={stopPropagation}
            placeholder={isExtracting ? "Extracting context..." : "Message GOBLIN..."}
            disabled={loading}
            rows={Math.min(4, input.split('\n').length || 1)}
            className="w-full bg-transparent px-4 pt-3 pb-1 min-h-[44px] max-h-[150px] text-[14px] text-white focus:outline-none resize-none custom-scrollbar disabled:opacity-50 placeholder:text-neutral-500"
          />
          
          <div className="flex justify-between items-center px-2 pb-2 pt-1 relative">
            <div className="flex items-center gap-1.5 pl-1 relative">
              <button 
                type="button"
                onClick={(e) => { stopPropagation(e); setShowActions(!showActions); }}
                className={`p-1.5 rounded-lg transition-all duration-300 flex items-center justify-center z-50 ${showActions ? 'bg-neutral-800 text-white' : 'bg-transparent text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}
                title="Tools & Actions"
              >
                <Plus size={20} className={`transition-transform duration-300 ${showActions ? 'rotate-45' : ''}`} />
              </button>

              {/* Pop-up Actions Menu */}
              <div className={`absolute bottom-full left-0 mb-3 bg-neutral-900 border border-neutral-700 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] p-2 flex flex-col gap-1 w-[240px] transition-all origin-bottom-left z-50 ${showActions ? 'opacity-100 scale-100 visible pointer-events-auto translate-y-0' : 'opacity-0 scale-95 invisible pointer-events-none translate-y-2'}`}>
                
                <div className="px-3 py-1.5 mb-1">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Media</span>
                </div>

                <button 
                  type="button"
                  onClick={(e) => {
                    stopPropagation(e);
                    const video = document.querySelector('video');
                    if (video) {
                      const canvas = document.createElement('canvas');
                      canvas.width = video.videoWidth || 1280;
                      canvas.height = video.videoHeight || 720;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const base64Img = canvas.toDataURL('image/jpeg', 0.8);
                        setCapturedImage(base64Img);
                        const timeStr = formatTime(video.currentTime);
                        const prefix = input.length > 0 && !input.endsWith(' ') ? ' ' : '';
                        setInput(prev => prev + prefix + `[${timeStr}] `);
                      }
                    }
                    setShowActions(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded-xl transition-all text-left group"
                >
                  <div className="p-1.5 bg-neutral-800 rounded-md group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors"><Camera size={14} /></div>
                  Capture Screen
                </button>

                <label className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded-xl transition-all text-left cursor-pointer group">
                  <div className="p-1.5 bg-neutral-800 rounded-md group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors"><Paperclip size={14} /></div>
                  Attach Document
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".pdf,.txt,.md,.js,.ts,.html,.css,.json,.csv" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          setLoading(true);
                          const text = await parseDocument(file);
                          setAttachedDocument({ name: file.name, content: text });
                        } catch (err) {
                          setError("Failed to parse document. Please try a text file or PDF.");
                        } finally {
                          setLoading(false);
                          setShowActions(false);
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                </label>

                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent my-1"></div>
                <div className="px-3 py-1.5 mt-1">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Agent Workflows</span>
                </div>

                <button 
                  type="button"
                  onClick={(e) => {
                    stopPropagation(e);
                    handleSend('[DIRECTOR MODE] Analyze the transcript and generate a chronological interactive playlist of the most important moments. Format exactly as a Markdown Table with columns: Time (must use [MM:SS] format), Topic, Detail, and Relevance (🔥). No filler text.');
                    setShowActions(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded-xl transition-all text-left group"
                >
                  <div className="p-1.5 bg-neutral-800 rounded-md group-hover:bg-yellow-500/20 group-hover:text-yellow-400 transition-colors"><Clapperboard size={14} /></div>
                  Director Mode
                </button>

                <button 
                  type="button"
                  onClick={(e) => {
                    stopPropagation(e);
                    handleSend('[AUTO-SHORTS MODE] Generate an autonomous highlight reel playlist for the most important parts of this video. You must output a JSON array of objects inside a [GOD_MODE_JSON] block. Example: [GOD_MODE_JSON][{"start": 12, "end": 45, "topic": "Intro"}, {"start": 120, "end": 200, "topic": "Core Concept"}][/GOD_MODE_JSON]. Only include highly relevant segments. Keep the array under 10 items.');
                    setShowActions(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded-xl transition-all text-left group"
                >
                  <div className="p-1.5 bg-neutral-800 rounded-md group-hover:bg-orange-500/20 group-hover:text-orange-400 transition-colors"><Scissors size={14} /></div>
                  Auto-Shorts
                </button>

                <button 
                  type="button"
                  onClick={(e) => {
                    stopPropagation(e);
                    const video = document.querySelector('video');
                    let timeContext = '';
                    if (video) {
                      timeContext = `The user is currently at timestamp [${formatTime(video.currentTime)}].`;
                    }
                    handleSend(`[FACT CHECK] ${timeContext} Identify the most prominent factual claim being made right now. You MUST output a web search query in the format [SEARCH: "the claim"] to verify it. When you receive the search results, you MUST format your response EXACTLY like this:\n\n[FACT_CHECK_JSON]\n{"claim": "the exact claim", "verdict": "TRUE" | "FALSE" | "NEEDS CONTEXT", "truth": "actual truth", "sources": ["url1"]}\n[/FACT_CHECK_JSON]\n\nDo NOT output anything else.`);
                    setShowActions(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded-xl transition-all text-left group"
                >
                  <div className="p-1.5 bg-neutral-800 rounded-md group-hover:bg-green-500/20 group-hover:text-green-400 transition-colors"><ShieldCheck size={14} /></div>
                  Fact Check Truth
                </button>

                <button 
                  type="button"
                  onClick={(e) => {
                    stopPropagation(e);
                    handleSend('[MIND MAP] Generate a visual knowledge graph of the concepts in this video. You must output a JSON object inside a [MIND_MAP_JSON] block. Example: [MIND_MAP_JSON]{"nodes": [{"id": "n1", "label": "Topic 1"}, {"id": "n2", "label": "Topic 2"}], "links": [{"source": "n1", "target": "n2"}]}[/MIND_MAP_JSON]. Ensure links reference valid node IDs. Create a comprehensive map of 10-20 nodes.');
                    setShowActions(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded-xl transition-all text-left group"
                >
                  <div className="p-1.5 bg-neutral-800 rounded-md group-hover:bg-blue-500/20 group-hover:text-blue-500 transition-colors"><Network size={14} /></div>
                  Generate Mind Map
                </button>
                
                <button 
                  type="button"
                  onClick={(e) => {
                    stopPropagation(e);
                    handleSend('[EXTRACT RESOURCES] Scan the entire video transcript. Find every single book, tool, software, website, or product mentioned by the creator. Format your response EXACTLY like this:\n\n[RESOURCES_JSON]\n{"categories": [{"name": "Books", "items": [{"name": "Book Title", "context": "Why it was mentioned", "url": "https://example.com"}]}]}\n[/RESOURCES_JSON]\n\nDo NOT output markdown outside of the JSON block.');
                    setShowActions(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/80 rounded-xl transition-all text-left group"
                >
                  <div className="p-1.5 bg-neutral-800 rounded-md group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors"><Link size={14} /></div>
                  Extract Resources
                </button>
              </div>
            </div>
            
            <button 
              type="button"
              onClick={(e) => { stopPropagation(e); handleSend(); }} 
              disabled={(!input.trim() && !capturedImage && !attachedDocument) || loading} 
              className="p-1.5 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white rounded-lg transition-all flex items-center justify-center shadow-md shadow-red-600/20 disabled:shadow-none z-50 relative"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const QuizPanel = () => (
  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-70 mt-10">
    <div className="bg-white/5 p-4 rounded-full">
      <Brain size={48} className="text-purple-400" />
    </div>
    <div>
      <h3 className="text-xl font-bold text-white mb-2">Active Recall</h3>
      <p className="text-sm text-slate-400 max-w-[280px] mx-auto leading-relaxed">
        Finish watching the video to generate a custom quiz and test your knowledge.
      </p>
    </div>
  </div>
);

const CodeBlock = ({ className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const [copied, setCopied] = useState(false);
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code flex flex-col rounded-xl overflow-hidden border border-neutral-700 shadow-lg my-4">
      <div className="flex justify-between items-center px-4 py-2 bg-neutral-900 border-b border-neutral-800">
        <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">{lang || 'Code'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors" title="Copy code">
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          {copied && <span className="text-green-500 text-[10px] font-bold tracking-wider uppercase">Copied!</span>}
        </button>
      </div>
      <pre className="bg-[#0a0a0a] p-4 overflow-x-auto text-[13px] text-neutral-300 font-mono m-0">
        <code className={className} {...props}>{children}</code>
      </pre>
    </div>
  );
};

const MessageCopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all duration-200 ${
        copied 
          ? 'text-green-400 bg-green-500/10' 
          : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
      }`}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check size={14} className="animate-[pulse_0.3s_ease-out]" />
          <span className="text-[11px] font-semibold tracking-wide">Copied</span>
        </>
      ) : (
        <>
          <Copy size={14} />
          <span className="text-[11px] font-medium">Copy</span>
        </>
      )}
    </button>
  );
};
