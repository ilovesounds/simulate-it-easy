import { useState } from "react";
import { VTKViewer } from "@/components/VTKViewer";
import { FileUploader } from "@/components/FileUploader";
import { SimulationControls } from "@/components/SimulationControls";
import { Boxes, FileCode2 } from "lucide-react";

const Index = () => {
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [opacity, setOpacity] = useState(1);
  const [wireframe, setWireframe] = useState(false);
  const [color, setColor] = useState<[number, number, number]>([0.2, 0.4, 0.8]);

  const handleFileLoad = (data: ArrayBuffer, name: string) => {
    setFileData(data);
    setFileName(name);
  };

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
              <p className="text-xs text-muted-foreground">Interactive 3D visualization</p>
            </div>
          </div>
          {fileName && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-accent rounded-full">
              <FileCode2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{fileName}</span>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* Viewer Area */}
          <div className="space-y-4">
            {!fileData ? (
              <div className="min-h-[500px] flex items-center justify-center">
                <div className="w-full max-w-md">
                  <FileUploader onFileLoad={handleFileLoad} />
                </div>
              </div>
            ) : (
              <div className="relative bg-card rounded-xl border border-border overflow-hidden shadow-lg">
                <VTKViewer
                  fileData={fileData}
                  opacity={opacity}
                  wireframe={wireframe}
                  color={color}
                />
                <div className="absolute bottom-4 left-4">
                  <button
                    onClick={() => {
                      setFileData(null);
                      setFileName("");
                    }}
                    className="px-4 py-2 bg-background/80 backdrop-blur-sm text-foreground text-sm font-medium rounded-lg border border-border hover:bg-accent transition-colors"
                  >
                    Load New File
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls Sidebar */}
          <aside className="space-y-4">
            <SimulationControls
              opacity={opacity}
              wireframe={wireframe}
              color={color}
              onOpacityChange={setOpacity}
              onWireframeChange={setWireframe}
              onColorChange={setColor}
            />

            {/* Instructions Card */}
            <div className="p-4 rounded-xl bg-accent/50 border border-border">
              <h3 className="font-semibold text-foreground mb-2">Controls</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Left click + drag to rotate</li>
                <li>• Scroll to zoom in/out</li>
                <li>• Right click + drag to pan</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Index;
