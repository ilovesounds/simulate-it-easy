import { useState, useEffect, useCallback, useRef } from "react";
import { VTKViewer } from "@/components/VTKViewer";
import { FolderUploader } from "@/components/FolderUploader";
import { AnimationControls } from "@/components/AnimationControls";
import { SimulationControls } from "@/components/SimulationControls";
import { Boxes, FolderOpen } from "lucide-react";

interface LoadedFile {
  name: string;
  data: ArrayBuffer;
}

function parseFieldsFromVTK(data: ArrayBuffer): string[] {
  const text = new TextDecoder().decode(data);
  const fields: string[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('SCALARS') || line.startsWith('VECTORS')) {
      const parts = line.split(/\s+/);
      if (parts[1]) {
        fields.push(parts[1]);
      }
    }
  }
  
  return fields;
}

const Index = () => {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(10);
  const [pointSize, setPointSize] = useState(5);
  const [colorField, setColorField] = useState("none");
  const [colorMap, setColorMap] = useState("rainbow");
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const animationRef = useRef<number | null>(null);
  const lastFrameTime = useRef<number>(0);

  const handleFilesLoad = useCallback((loadedFiles: LoadedFile[]) => {
    setFiles(loadedFiles);
    setCurrentFrame(0);
    setIsPlaying(false);
    
    // Parse fields from first file
    if (loadedFiles.length > 0) {
      const fields = parseFieldsFromVTK(loadedFiles[0].data);
      setAvailableFields(fields);
      if (fields.length > 0) {
        setColorField(fields[0]);
      }
    }
  }, []);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  useEffect(() => {
    if (!isPlaying || files.length <= 1) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (timestamp: number) => {
      const elapsed = timestamp - lastFrameTime.current;
      const frameInterval = 1000 / fps;

      if (elapsed >= frameInterval) {
        setCurrentFrame(prev => {
          const next = prev + 1;
          if (next >= files.length) {
            return 0; // Loop
          }
          return next;
        });
        lastFrameTime.current = timestamp;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, fps, files.length]);

  const frames = files.map(f => f.data);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Boxes className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">VTK Simulation Viewer</h1>
              <p className="text-xs text-muted-foreground">Interactive 3D visualization with animation</p>
            </div>
          </div>
          {files.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-accent rounded-full">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{files.length} files loaded</span>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* Viewer Area */}
          <div className="space-y-4">
            {files.length === 0 ? (
              <div className="min-h-[500px] flex items-center justify-center">
                <div className="w-full max-w-md">
                  <FolderUploader onFilesLoad={handleFilesLoad} />
                </div>
              </div>
            ) : (
              <>
                <div className="relative bg-card rounded-xl border border-border overflow-hidden shadow-lg">
                  <VTKViewer
                    frames={frames}
                    currentFrame={currentFrame}
                    pointSize={pointSize}
                    colorField={colorField}
                    colorMap={colorMap}
                  />
                  
                  {/* Current file indicator */}
                  <div className="absolute top-4 left-4 px-3 py-1.5 bg-background/80 backdrop-blur-sm rounded-lg border border-border">
                    <span className="text-xs font-medium text-foreground">
                      {files[currentFrame]?.name}
                    </span>
                  </div>
                  
                  <div className="absolute bottom-4 left-4">
                    <button
                      onClick={() => {
                        setFiles([]);
                        setAvailableFields([]);
                        setColorField("none");
                      }}
                      className="px-4 py-2 bg-background/80 backdrop-blur-sm text-foreground text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors"
                    >
                      Load New Folder
                    </button>
                  </div>
                </div>

                {/* Animation Controls */}
                <AnimationControls
                  currentFrame={currentFrame}
                  totalFrames={files.length}
                  isPlaying={isPlaying}
                  fps={fps}
                  onFrameChange={setCurrentFrame}
                  onPlayPause={handlePlayPause}
                  onFpsChange={setFps}
                />
              </>
            )}
          </div>

          {/* Controls Sidebar */}
          <aside className="space-y-4">
            <SimulationControls
              pointSize={pointSize}
              colorField={colorField}
              colorMap={colorMap}
              availableFields={availableFields}
              onPointSizeChange={setPointSize}
              onColorFieldChange={setColorField}
              onColorMapChange={setColorMap}
            />

            {/* Instructions Card */}
            <div className="p-4 rounded-xl bg-accent/50 border border-border">
              <h3 className="font-semibold text-foreground mb-2">Controls</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Left click + drag to rotate</li>
                <li>• Scroll to zoom in/out</li>
                <li>• Right click + drag to pan</li>
                <li>• Space to play/pause animation</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Index;
