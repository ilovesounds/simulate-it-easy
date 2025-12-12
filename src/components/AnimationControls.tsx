import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface AnimationControlsProps {
  currentFrame: number;
  totalFrames: number;
  isPlaying: boolean;
  fps: number;
  onFrameChange: (frame: number) => void;
  onPlayPause: () => void;
  onFpsChange: (fps: number) => void;
}

export const AnimationControls = ({
  currentFrame,
  totalFrames,
  isPlaying,
  fps,
  onFrameChange,
  onPlayPause,
  onFpsChange,
}: AnimationControlsProps) => {
  if (totalFrames <= 1) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Animation</span>
        <span className="text-xs text-muted-foreground">
          Frame {currentFrame + 1} / {totalFrames}
        </span>
      </div>

      {/* Timeline Slider */}
      <Slider
        value={[currentFrame]}
        min={0}
        max={totalFrames - 1}
        step={1}
        onValueChange={([val]) => onFrameChange(val)}
        className="w-full"
      />

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onFrameChange(0)}
          disabled={currentFrame === 0}
        >
          <SkipBack className="w-4 h-4" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => onFrameChange(Math.max(0, currentFrame - 1))}
          disabled={currentFrame === 0}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <Button
          variant="default"
          size="icon"
          onClick={onPlayPause}
          className="w-12 h-12"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => onFrameChange(Math.min(totalFrames - 1, currentFrame + 1))}
          disabled={currentFrame === totalFrames - 1}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => onFrameChange(totalFrames - 1)}
          disabled={currentFrame === totalFrames - 1}
        >
          <SkipForward className="w-4 h-4" />
        </Button>
      </div>

      {/* FPS Control */}
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground w-12">Speed</span>
        <Slider
          value={[fps]}
          min={1}
          max={30}
          step={1}
          onValueChange={([val]) => onFpsChange(val)}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-16">{fps} FPS</span>
      </div>
    </div>
  );
};
