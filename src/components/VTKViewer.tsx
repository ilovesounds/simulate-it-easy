import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface VTKViewerProps {
  frames: ArrayBuffer[];
  currentFrame: number;
  pointSize: number;
  colorField: string;
  colorMap: string;
}

declare global {
  interface Window {
    vtk: any;
  }
}

// Color map definitions
const colorMaps: Record<string, [number, number, number][]> = {
  rainbow: [
    [0, 0, 1], [0, 1, 1], [0, 1, 0], [1, 1, 0], [1, 0, 0]
  ],
  coolwarm: [
    [0.23, 0.3, 0.75], [0.87, 0.87, 0.87], [0.71, 0.02, 0.15]
  ],
  viridis: [
    [0.27, 0.0, 0.33], [0.28, 0.47, 0.53], [0.13, 0.66, 0.52], [0.99, 0.91, 0.14]
  ],
  plasma: [
    [0.05, 0.03, 0.53], [0.55, 0.09, 0.65], [0.93, 0.36, 0.30], [0.94, 0.98, 0.13]
  ],
};

function interpolateColor(t: number, colors: [number, number, number][]): [number, number, number] {
  const n = colors.length - 1;
  const idx = Math.min(Math.floor(t * n), n - 1);
  const frac = t * n - idx;
  const c1 = colors[idx];
  const c2 = colors[idx + 1];
  return [
    c1[0] + frac * (c2[0] - c1[0]),
    c1[1] + frac * (c2[1] - c1[1]),
    c1[2] + frac * (c2[2] - c1[2]),
  ];
}

interface ParsedVTK {
  points: number[];
  scalars: Record<string, number[]>;
}

function parseLegacyVTK(text: string): ParsedVTK | null {
  const lines = text.split('\n').map(l => l.trim());
  
  let i = 0;
  // Skip header lines
  while (i < lines.length && !lines[i].startsWith('POINTS')) {
    i++;
  }
  
  if (i >= lines.length) return null;
  
  // Parse POINTS
  const pointsMatch = lines[i].match(/POINTS\s+(\d+)/);
  if (!pointsMatch) return null;
  
  const numPoints = parseInt(pointsMatch[1], 10);
  i++;
  
  const points: number[] = [];
  while (points.length < numPoints * 3 && i < lines.length) {
    const line = lines[i];
    if (line.startsWith('CELLS') || line.startsWith('POINT_DATA') || line.startsWith('CELL_DATA')) break;
    const values = line.split(/\s+/).map(parseFloat).filter(v => !isNaN(v));
    points.push(...values);
    i++;
  }

  // Parse scalar data
  const scalars: Record<string, number[]> = {};
  
  while (i < lines.length) {
    const line = lines[i];
    
    if (line.startsWith('POINT_DATA')) {
      i++;
      continue;
    }
    
    if (line.startsWith('SCALARS') || line.startsWith('VECTORS')) {
      const parts = line.split(/\s+/);
      const fieldName = parts[1] || 'field';
      const isVector = line.startsWith('VECTORS');
      
      // Skip LOOKUP_TABLE line if present
      i++;
      if (i < lines.length && lines[i].startsWith('LOOKUP_TABLE')) {
        i++;
      }
      
      const data: number[] = [];
      const expectedCount = isVector ? numPoints * 3 : numPoints;
      
      while (data.length < expectedCount && i < lines.length) {
        const dataLine = lines[i];
        if (dataLine.startsWith('SCALARS') || dataLine.startsWith('VECTORS') || 
            dataLine.startsWith('POINT_DATA') || dataLine.startsWith('CELL_DATA')) break;
        const values = dataLine.split(/\s+/).map(parseFloat).filter(v => !isNaN(v));
        data.push(...values);
        i++;
      }
      
      if (isVector) {
        // Compute magnitude for vector fields
        const magnitudes: number[] = [];
        for (let j = 0; j < numPoints; j++) {
          const vx = data[j * 3] || 0;
          const vy = data[j * 3 + 1] || 0;
          const vz = data[j * 3 + 2] || 0;
          magnitudes.push(Math.sqrt(vx * vx + vy * vy + vz * vz));
        }
        scalars[fieldName] = magnitudes;
      } else {
        scalars[fieldName] = data;
      }
      continue;
    }
    
    i++;
  }
  
  return { points, scalars };
}

export const VTKViewer = ({ frames, currentFrame, pointSize, colorField, colorMap }: VTKViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<{
    fullScreenRenderer: any;
    actor: any;
  }>({ fullScreenRenderer: null, actor: null });

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

  const renderFrame = useCallback((fileData: ArrayBuffer) => {
    if (!window.vtk || !contextRef.current.fullScreenRenderer) return;

    const fullScreenRenderer = contextRef.current.fullScreenRenderer;
    const renderer = fullScreenRenderer.getRenderer();
    const renderWindow = fullScreenRenderer.getRenderWindow();

    renderer.removeAllActors();
    setError(null);

    try {
      const textDecoder = new TextDecoder();
      const text = textDecoder.decode(fileData);
      const parsed = parseLegacyVTK(text);

      if (!parsed || parsed.points.length === 0) {
        setError("Failed to parse VTK file");
        return;
      }

      const polyData = window.vtk.Common.DataModel.vtkPolyData.newInstance();
      
      const points = window.vtk.Common.Core.vtkPoints.newInstance();
      const pointsArray = new Float32Array(parsed.points);
      points.setData(pointsArray, 3);
      polyData.setPoints(points);

      const numPoints = parsed.points.length / 3;
      const verts = new Uint32Array(numPoints * 2);
      for (let j = 0; j < numPoints; j++) {
        verts[j * 2] = 1;
        verts[j * 2 + 1] = j;
      }
      
      const cellArray = window.vtk.Common.Core.vtkCellArray.newInstance();
      cellArray.setData(verts);
      polyData.setVerts(cellArray);

      // Apply scalar coloring if available
      const scalarData = parsed.scalars[colorField];
      if (scalarData && scalarData.length > 0) {
        const colors = window.vtk.Common.Core.vtkDataArray.newInstance({
          numberOfComponents: 3,
          values: new Uint8Array(numPoints * 3),
          dataType: 'Uint8Array',
        });

        const min = Math.min(...scalarData);
        const max = Math.max(...scalarData);
        const range = max - min || 1;

        const colorMapColors = colorMaps[colorMap] || colorMaps.rainbow;

        for (let j = 0; j < numPoints; j++) {
          const t = (scalarData[j] - min) / range;
          const [r, g, b] = interpolateColor(t, colorMapColors);
          colors.setTuple(j, [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]);
        }

        polyData.getPointData().setScalars(colors);
      }

      const mapper = window.vtk.Rendering.Core.vtkMapper.newInstance();
      mapper.setInputData(polyData);
      if (scalarData) {
        mapper.setScalarVisibility(true);
      }

      const actor = window.vtk.Rendering.Core.vtkActor.newInstance();
      actor.setMapper(mapper);
      actor.getProperty().setPointSize(pointSize);
      
      if (!scalarData) {
        actor.getProperty().setColor(0.2, 0.4, 0.8);
      }

      contextRef.current.actor = actor;

      renderer.addActor(actor);
      
      if (currentFrame === 0) {
        renderer.resetCamera();
      }
      
      renderWindow.render();
    } catch (err) {
      console.error("Error loading VTK file:", err);
      setError("Error loading VTK file");
    }
  }, [colorField, colorMap, pointSize, currentFrame]);

  useEffect(() => {
    if (isLoading || !containerRef.current || !window.vtk) return;

    if (!contextRef.current.fullScreenRenderer) {
      const fullScreenRenderer = window.vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
        container: containerRef.current,
        background: [0.1, 0.1, 0.15],
      });
      contextRef.current.fullScreenRenderer = fullScreenRenderer;
    }

    if (frames.length > 0 && frames[currentFrame]) {
      renderFrame(frames[currentFrame]);
    }
  }, [isLoading, frames, currentFrame, renderFrame]);

  useEffect(() => {
    if (contextRef.current.actor) {
      contextRef.current.actor.getProperty().setPointSize(pointSize);
      if (contextRef.current.fullScreenRenderer) {
        contextRef.current.fullScreenRenderer.getRenderWindow().render();
      }
    }
  }, [pointSize]);

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
