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
    vtk: any;
  }
}

// Parse legacy VTK ASCII file to extract points
function parseLegacyVTK(text: string): { points: number[]; cells?: number[][] } | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let i = 0;
  // Skip header lines
  while (i < lines.length && !lines[i].startsWith('POINTS')) {
    i++;
  }
  
  if (i >= lines.length) return null;
  
  // Parse POINTS line: "POINTS n float"
  const pointsMatch = lines[i].match(/POINTS\s+(\d+)/);
  if (!pointsMatch) return null;
  
  const numPoints = parseInt(pointsMatch[1], 10);
  i++;
  
  const points: number[] = [];
  while (points.length < numPoints * 3 && i < lines.length) {
    const line = lines[i];
    if (line.startsWith('CELLS') || line.startsWith('POLYGONS') || line.startsWith('POINT_DATA')) break;
    
    const values = line.split(/\s+/).map(parseFloat).filter(v => !isNaN(v));
    points.push(...values);
    i++;
  }
  
  return { points };
}

export const VTKViewer = ({ fileData, opacity, wireframe, color }: VTKViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<{
    fullScreenRenderer: any;
    actor: any;
  }>({ fullScreenRenderer: null, actor: null });

  // Load VTK.js from CDN
  useEffect(() => {
    const loadVTK = async () => {
      if (window.vtk) {
        setIsLoading(false);
        return;
      }

      try {
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
      setError(null);

      try {
        // Convert to text to check format
        const textDecoder = new TextDecoder();
        const text = textDecoder.decode(fileData);
        const isLegacyFormat = text.trim().startsWith('# vtk');
        const isXMLFormat = text.trim().startsWith('<?xml') || text.trim().startsWith('<VTK');

        let polyData = null;

        if (isXMLFormat) {
          // Use XML reader for .vtp files
          const reader = window.vtk.IO.XML.vtkXMLPolyDataReader.newInstance();
          reader.parseAsArrayBuffer(fileData);
          polyData = reader.getOutputData(0);
        } else if (isLegacyFormat) {
          // Parse legacy VTK format manually and create point cloud
          const parsed = parseLegacyVTK(text);
          
          if (!parsed || parsed.points.length === 0) {
            setError("Failed to parse legacy VTK file. No points found.");
            return;
          }

          // Create a polydata with just points (point cloud visualization)
          polyData = window.vtk.Common.DataModel.vtkPolyData.newInstance();
          
          const points = window.vtk.Common.Core.vtkPoints.newInstance();
          const pointsArray = new Float32Array(parsed.points);
          points.setData(pointsArray, 3);
          polyData.setPoints(points);

          // Create vertex cells for point cloud visualization
          const numPoints = parsed.points.length / 3;
          const verts = new Uint32Array(numPoints * 2);
          for (let j = 0; j < numPoints; j++) {
            verts[j * 2] = 1;
            verts[j * 2 + 1] = j;
          }
          
          const cellArray = window.vtk.Common.Core.vtkCellArray.newInstance();
          cellArray.setData(verts);
          polyData.setVerts(cellArray);
        } else {
          setError("Unsupported file format. Please use .vtk (legacy) or .vtp (XML) files.");
          return;
        }

        if (!polyData) {
          setError("Failed to parse VTK file.");
          return;
        }

        const mapper = window.vtk.Rendering.Core.vtkMapper.newInstance();
        mapper.setInputData(polyData);

        const actor = window.vtk.Rendering.Core.vtkActor.newInstance();
        actor.setMapper(mapper);
        actor.getProperty().setOpacity(opacity);
        actor.getProperty().setColor(...color);
        actor.getProperty().setRepresentation(wireframe ? 1 : 2);
        actor.getProperty().setPointSize(3);

        contextRef.current.actor = actor;

        renderer.addActor(actor);
        renderer.resetCamera();
        renderWindow.render();
      } catch (err) {
        console.error("Error loading VTK file:", err);
        setError("Error loading VTK file. Check console for details.");
      }
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
        <p className="text-destructive text-center px-4">{error}</p>
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
