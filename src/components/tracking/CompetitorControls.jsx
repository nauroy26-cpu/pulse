import React from 'react';
import { Play, Square, Trash2, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CompetitorControls({
  isTracking,
  canStart,
  onStart,
  onStop,
  onClear,
  onExport,
  isExporting,
  isClearing,
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
      {!isTracking ? (
        <Button
          onClick={onStart}
          disabled={!canStart}
          className="h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-display text-base tracking-wide glow-primary col-span-2 md:col-span-1"
        >
          <Play className="w-5 h-5 mr-2" fill="currentColor" /> START
        </Button>
      ) : (
        <Button
          onClick={onStop}
          className="h-14 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-display text-base tracking-wide col-span-2 md:col-span-1"
        >
          <Square className="w-5 h-5 mr-2" fill="currentColor" /> STOP
        </Button>
      )}

      <Button
        variant="outline"
        onClick={onClear}
        disabled={isTracking || isClearing}
        className="h-14 bg-secondary/50 border-border hover:bg-secondary font-display text-base tracking-wide"
      >
        {isClearing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Trash2 className="w-5 h-5 mr-2" />}
        CLEAR
      </Button>

      <Button
        variant="outline"
        onClick={onExport}
        disabled={isExporting}
        className="h-14 bg-secondary/50 border-border hover:bg-secondary font-display text-base tracking-wide col-span-2 md:col-span-2"
      >
        {isExporting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <FileDown className="w-5 h-5 mr-2" />}
        EXPORT PDF
      </Button>
    </div>
  );
}