import { useState, useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'; 
import { isTauri } from '@/lib/tauri';
import { Square, Copy, Minus, X } from 'lucide-react';

export const Titlebar = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = isTauri() ? getCurrentWebviewWindow() : null;

  useEffect(() => {
    if (!appWindow) return;

    appWindow.isMaximized().then(setIsMaximized);

    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
      
      // Keep this padding fix to prevent going behind the taskbar on Windows
      if (maximized) {
        document.body.style.padding = "6px"; 
      } else {
        document.body.style.padding = "0px";
      }
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [appWindow]);

  const handleDoubleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (appWindow) await appWindow.toggleMaximize();
  };

  return (
    <>

      <div className="h-10 bg-aura-dark border-b border-aura-border flex items-center justify-between select-none fixed top-0 left-0 right-0 z-[1000]">
        
        <div 
          data-tauri-drag-region 
          onDoubleClick={handleDoubleClick}
          className="flex-1 h-full flex items-center px-4 cursor-default"
        >
          <div className="flex items-center pointer-events-none">
            <div className={`w-2 h-2 rounded-full mr-3 transition-all duration-300 ${
              isMaximized ? 'bg-aura-green shadow-[0_0_8px_#39FF14]' : 'bg-gray-600'
            }`} />
            
            <span className="text-[10px] font-black italic tracking-widest text-white/70 uppercase">
              Aura Terminal <span className={isMaximized ? 'text-aura-green drop-shadow-[0_0_3px_#39FF14]' : ''}>Active</span>
            </span>
          </div>
        </div>

        <div className="flex items-center h-full relative z-[1001]">
          <button 
            onClick={() => appWindow?.minimize()}
            className="h-full px-4 hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
          >
            <Minus size={14} />
          </button>

          <button 
            onClick={() => appWindow?.toggleMaximize()}
            className="h-full px-4 hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
          >
            {isMaximized ? <Copy size={12} className="rotate-90 text-aura-green" /> : <Square size={12} />}
          </button>

          <button 
            onClick={() => appWindow?.close()}
            className="h-full px-4 hover:bg-red-500/80 text-gray-500 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </>
  );
};