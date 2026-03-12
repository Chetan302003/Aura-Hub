import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GlassCard } from '@/components/layout/GlassCard';

export default function DebugTelemetry() {
  const [rawJson, setRawJson] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const poll = async () => {
      try {
        // We fetch the pure string directly from Rust
        const response = await invoke<string>('get_telemetry_data');
        setRawJson(response);
      } catch (err: any) {
        setError(String(err));
      }
    };

    const interval = setInterval(poll, 500); // Check twice a second
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold text-primary neon-glow">Aura Terminal: Raw Data Debugger</h1>
      
      {error && (
        <div className="p-4 bg-destructive/20 border border-destructive text-destructive rounded-lg">
          Rust Error: {error}
        </div>
      )}

      <GlassCard className="p-4 bg-black/90 font-mono text-xs overflow-auto h-[70vh]">
        <div className="flex justify-between items-center border-b border-primary/20 pb-2 mb-4">
          <span className="text-primary uppercase tracking-widest">Incoming Data Stream</span>
          <span className="text-muted-foreground">Status: {rawJson ? '🟢 RECEIVING' : '🔴 WAITING'}</span>
        </div>
        
        {/* We use a <pre> tag because it handles JSON strings safely without crashing */}
        <pre className="text-green-400 whitespace-pre-wrap">
          {rawJson ? JSON.stringify(JSON.parse(rawJson), null, 2) : "Listening for game data..."}
        </pre>
      </GlassCard>

      <div className="text-xs text-muted-foreground italic">
        * Note: If this screen stays blank while driving, the Rust side isn't reading memory correctly.
      </div>
    </div>
  );
}