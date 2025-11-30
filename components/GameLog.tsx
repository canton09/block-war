
import React, { useRef, useEffect } from 'react';
import { LogEntry } from '../types';
import { Terminal } from 'lucide-react';

interface GameLogProps {
  logs: LogEntry[];
}

const GameLog: React.FC<GameLogProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="bg-[#1D2B53] p-2 px-3 flex items-center gap-2 border-b border-[#29ADFF]/30 sticky top-0 z-10">
        <Terminal className="w-3 h-3 text-[#29ADFF]" />
        <span className="text-[10px] text-[#29ADFF] tracking-wider uppercase">LOG OUTPUT</span>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-[10px] space-y-2 scrollbar-thin scrollbar-thumb-[#29ADFF] scrollbar-track-[#0F172A]"
      >
        {logs.length === 0 && <span className="text-gray-500 italic text-[8px]">...等待数据流...</span>}
        {logs.map((log) => (
          <div key={log.id} className="leading-normal break-words animate-fade-in border-l-2 border-[#334155] pl-2">
            <div className="text-[8px] text-[#5f574f] mb-0.5">{log.timestamp}</div>
            <div style={{ color: log.color || '#CBD5E1' }}>{log.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameLog;
