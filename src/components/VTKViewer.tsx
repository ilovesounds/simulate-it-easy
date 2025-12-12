import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface VTKViewerProps {
  fileData: ArrayBuffer | null;
  opacity: number;
  wireframe: boolean;
  color: [number, number, number];
}

// Declare vtk on window for TypeScript
declare global {
  interface Window {
    vtk: {
      Rendering: {
        Misc: {
          vtkFullScreenRenderWindow: {
            newInstance: (options: { container: HTMLElement; background: number[] }) => {
              getRenderer: () => {
                addActor: (actor: unknown) => void;
                removeAllActors: () => void;
                resetCamera: () => void;
              };
              getRenderWindow: () => {
                render: () => void;
              };
              delete: () => void;
            };
          };
        };
        Core: {
          vtkActor: {
            newInstance: () => {
              setMapper: (mapper: unknown) => void;
              getProperty: () => {
                setOpacity: (opacity: number) => void;
                setColor: (r: number, g: number, b: number) => void;
                setRepresentation: (rep: number) => void;
              };
            };
          };
          vtkMapper: {
            newInstance: () => {
              setInputData: (data: unknown) => void;
            };
          };
        };
      };
      IO: {
        XML: {
          vtkXMLPolyDataReader: {
            newInstance: () => {
              parseAsArrayBuffer: (buffer: ArrayBuffer) => void;
              getOutputData: (index: number) => unknown;
            };
          };
        };
      };
    };
  }
}

export const VTKViewer = ({ fileData, opacity, wireframe, color }: VTKViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<{
    fullScreenRenderer: ReturnType<typeof window.vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance> | null;
    actor: ReturnType<typeof window.vtk.Rendering.Core.vtkActor.newInstance> | null;
  }>({ fullScreenRenderer: null, actor: null });

  // Load VTK.js from CDN
  useEffect(() => {
    const loadVTK = async () => {
      if (window.vtk) {
        setIsLoading(false);
        return;
      }

      try {
        // Load vtk.js from CDN
        const script = document.createElement("script");
        script.src = "https://unpkg.com/vtk.js@30.4.1/vtk.js";
        script.async = true;
        
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load VTK.js"));
          document.head.appendChild(script);
        });

        setIsLoading(false);
      } catch (err) {
        setError("Failed to load VTK.js library");
        setIsLoading(false);
      }
    };

    loadVTK();

    return () => {
      if (contextRef.current.fullScreenRenderer) {
        contextRef.current.fullScreenRenderer.delete();
        contextRef.current.fullScreenRenderer = null;
      }
    };
  }, []);

  // Setup renderer and load file
  useEffect(() => {
    if (isLoading || !containerRef.current || !window.vtk) return;

    // Clean up previous instance
    if (contextRef.current.fullScreenRenderer) {
      contextRef.current.fullScreenRenderer.delete();
    }

    const fullScreenRenderer = window.vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
      container: containerRef.current,
      background: [0.1, 0.1, 0.15],
    });

    contextRef.current.fullScreenRenderer = fullScreenRenderer;

    if (fileData) {
      const renderer = fullScreenRenderer.getRenderer();
      const renderWindow = fullScreenRenderer.getRenderWindow();

      renderer.removeAllActors();

      const reader = window.vtk.IO.XML.vtkXMLPolyDataReader.newInstance();
      reader.parseAsArrayBuffer(fileData);

      const polyData = reader.getOutputData(0);

      if (!polyData) {
        setError("Failed to parse VTK file. Make sure it's a valid .vtp file.");
        return;
      }

      const mapper = window.vtk.Rendering.Core.vtkMapper.newInstance();
      mapper.setInputData(polyData);

      const actor = window.vtk.Rendering.Core.vtkActor.newInstance();
      actor.setMapper(mapper);
      actor.getProperty().setOpacity(opacity);
      actor.getProperty().setColor(...color);
      actor.getProperty().setRepresentation(wireframe ? 1 : 2);

      contextRef.current.actor = actor;

      renderer.addActor(actor);
      renderer.resetCamera();
      renderWindow.render();
    }
  }, [isLoading, fileData]);

  // Update visualization parameters
  useEffect(() => {
    if (!contextRef.current.actor) return;

    contextRef.current.actor.getProperty().setOpacity(opacity);
    contextRef.current.actor.getProperty().setColor(...color);
    contextRef.current.actor.getProperty().setRepresentation(wireframe ? 1 : 2);

    if (contextRef.current.fullScreenRenderer) {
      contextRef.current.fullScreenRenderer.getRenderWindow().render();
    }
  }, [opacity, wireframe, color]);

  if (error) {
    return (
      <div className="w-full h-full min-h-[500px] rounded-lg overflow-hidden bg-destructive/10 flex items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] rounded-lg overflow-hidden relative">
      {isLoading && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
