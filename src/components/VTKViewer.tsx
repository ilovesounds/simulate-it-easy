import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Loader2 } from "lucide-react";

interface VTKViewerProps {
  frames: ArrayBuffer[];
  currentFrame: number;
  pointSize: number;
  colorField: string;
  colorMap: string;
  spacingScale: number;
}

declare global {
  interface Window {
    vtk: any;
  }
}

export interface VTKViewerHandle {
  exportImage: () => void;
}

// Color map definitions
const colorMaps: Record<string, [number, number, number][]> = {
  rainbow: [
    [0, 0, 1],
    [0, 1, 1],
    [0, 1, 0],
    [1, 1, 0],
    [1, 0, 0],
  ],
  coolwarm: [
    [0.23, 0.3, 0.75],
    [0.87, 0.87, 0.87],
    [0.71, 0.02, 0.15],
  ],
  viridis: [
    [0.27, 0.0, 0.33],
    [0.28, 0.47, 0.53],
    [0.13, 0.66, 0.52],
    [0.99, 0.91, 0.14],
  ],
  plasma: [
    [0.05, 0.03, 0.53],
    [0.55, 0.09, 0.65],
    [0.93, 0.36, 0.3],
    [0.94, 0.98, 0.13],
  ],
};

function interpolateColor(
  t: number,
  colors: [number, number, number][]
): [number, number, number] {
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
  const lines = text.split("\n").map((l) => l.trim());

  let i = 0;
  while (i < lines.length && !lines[i].startsWith("POINTS")) {
    i++;
  }
  if (i >= lines.length) return null;

  const pointsMatch = lines[i].match(/POINTS\s+(\d+)/);
  if (!pointsMatch) return null;

  const numPoints = parseInt(pointsMatch[1], 10);
  i++;

  const points: number[] = [];
  while (points.length < numPoints * 3 && i < lines.length) {
    const line = lines[i];
    if (
      line.startsWith("CELLS") ||
      line.startsWith("POINT_DATA") ||
      line.startsWith("CELL_DATA")
    )
      break;
    const values = line
      .split(/\s+/)
      .map(parseFloat)
      .filter((v) => !isNaN(v));
    points.push(...values);
    i++;
  }

  const scalars: Record<string, number[]> = {};
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("POINT_DATA")) {
      i++;
      continue;
    }

    if (line.startsWith("SCALARS")) {
      const parts = line.split(/\s+/);
      const fieldName = parts[1] || "field";

      i++;
      if (i < lines.length && lines[i].startsWith("LOOKUP_TABLE")) {
        i++;
      }

      const data: number[] = [];
      const expectedCount = numPoints;

      while (data.length < expectedCount && i < lines.length) {
        const dataLine = lines[i];
        if (
          dataLine.startsWith("SCALARS") ||
          dataLine.startsWith("VECTORS") ||
          dataLine.startsWith("POINT_DATA") ||
          dataLine.startsWith("CELL_DATA")
        )
          break;
        const values = dataLine
          .split(/\s+/)
          .map(parseFloat)
          .filter((v) => !isNaN(v));
        data.push(...values);
        i++;
      }

      scalars[fieldName] = data;
      continue;
    }

    i++;
  }

  return { points, scalars };
}

export const VTKViewer = forwardRef<VTKViewerHandle, VTKViewerProps>(
  ({ frames, currentFrame, pointSize, colorField, colorMap, spacingScale }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const showVelocityArrows = true;

    const [selectedPoint, setSelectedPoint] = useState<{
      id: number;
      position: [number, number, number];
      scalars: Record<string, number>;
    } | null>(null);

    const contextRef = useRef<{
      fullScreenRenderer: any;
      actor: any;
      glyphActor: any | null;
      glyphMapper: any | null;
      arrowSource: any | null;
      polyData: any | null;
      canvas: HTMLCanvasElement | null;
    }>({
      fullScreenRenderer: null,
      actor: null,
      glyphActor: null,
      glyphMapper: null,
      arrowSource: null,
      polyData: null,
      canvas: null,
    });

    // Picking: uses canvas coords + tolerance, then reads ALL arrays
    const handleCanvasClick = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (
          !window.vtk ||
          !contextRef.current.fullScreenRenderer ||
          !contextRef.current.polyData
        ) {
          return;
        }

        const canvas = containerRef.current
          ?.querySelector("canvas") as HTMLCanvasElement | null;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const picker = window.vtk.Rendering.Core.vtkPointPicker.newInstance();
        picker.setTolerance(0.03); // tune 0.01–0.05 as needed[web:19]

        const renderer =
          contextRef.current.fullScreenRenderer.getRenderer();
        picker.pick([x, y, 0], renderer);

        const pointId = picker.getPointId();
        picker.delete();

        if (pointId < 0) {
          setSelectedPoint(null);
          return;
        }

        const polyData = contextRef.current.polyData;
        const pointData = polyData.getPointData();
        const posTuple = polyData
          .getPoints()
          .getTuple(pointId) as [number, number, number];

        const scalars: Record<string, number> = {};
        const numberOfArrays = pointData.getNumberOfArrays();
        for (let i = 0; i < numberOfArrays; i++) {
          const arr = pointData.getArrayByIndex(i);
          if (!arr) continue;
          const name = arr.getName() || `field_${i}`;
          const tuple = arr.getTuple(pointId);
          const value =
            Array.isArray(tuple) && tuple.length > 0 ? tuple[0] : (tuple as any);
          scalars[name] = value as number;
        }

        setSelectedPoint({
          id: pointId,
          position: posTuple,
          scalars,
        });
      },
      [frames.length]
    );

    useImperativeHandle(ref, () => ({
      exportImage() {
        const canvas = contextRef.current.canvas;
        if (!canvas) return;
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "vtk-frame.png";
        link.click();
      },
    }));

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
        } catch {
          setError("Failed to load VTK.js library");
          setIsLoading(false);
        }
      };

      loadVTK();

      return () => {
        if (contextRef.current.fullScreenRenderer) {
          contextRef.current.fullScreenRenderer.delete();
          contextRef.current.fullScreenRenderer = null;
          contextRef.current.canvas = null;
        }
      };
    }, []);

    const renderFrame = useCallback(
      (fileData: ArrayBuffer) => {
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

          const numPoints = parsed.points.length / 3;

          let cx = 0,
            cy = 0,
            cz = 0;
          for (let j = 0; j < parsed.points.length; j += 3) {
            cx += parsed.points[j];
            cy += parsed.points[j + 1];
            cz += parsed.points[j + 2];
          }
          cx /= numPoints;
          cy /= numPoints;
          cz /= numPoints;

          for (let j = 0; j < parsed.points.length; j += 3) {
            const x = parsed.points[j];
            const y = parsed.points[j + 1];
            const z = parsed.points[j + 2];

            parsed.points[j] = cx + (x - cx) * spacingScale;
            parsed.points[j + 1] = cy + (y - cy) * spacingScale;
            parsed.points[j + 2] = cz + (z - cz) * spacingScale;
          }

          const polyData = window.vtk.Common.DataModel.vtkPolyData.newInstance();

          const points = window.vtk.Common.Core.vtkPoints.newInstance();
          const pointsArray = new Float32Array(parsed.points);
          points.setData(pointsArray, 3);
          polyData.setPoints(points);

          const verts = new Uint32Array(numPoints * 2);
          for (let j = 0; j < numPoints; j++) {
            verts[j * 2] = 1;
            verts[j * 2 + 1] = j;
          }
          const cellArray = window.vtk.Common.Core.vtkCellArray.newInstance();
          cellArray.setData(verts);
          polyData.setVerts(cellArray);

          // Attach ALL scalar fields (Temperature, rho, velocities, etc.)
          Object.entries(parsed.scalars).forEach(([name, data]) => {
            if (!data || data.length !== numPoints) return;
            const arr = window.vtk.Common.Core.vtkDataArray.newInstance({
              name,
              numberOfComponents: 1,
              values: new Float32Array(data),
            });
            polyData.getPointData().addArray(arr);
          });

          // Choose one field for coloring
          const scalarData = parsed.scalars[colorField];
          if (scalarData && scalarData.length > 0) {
            const colors = window.vtk.Common.Core.vtkDataArray.newInstance({
              numberOfComponents: 3,
              values: new Uint8Array(numPoints * 3),
              dataType: "Uint8Array",
            });

            const min = Math.min(...scalarData);
            const max = Math.max(...scalarData);
            const range = max - min || 1;
            const colorMapColors = colorMaps[colorMap] || colorMaps.rainbow;

            for (let j = 0; j < numPoints; j++) {
              const t = (scalarData[j] - min) / range;
              const [r, g, b] = interpolateColor(t, colorMapColors);
              colors.setTuple(j, [
                Math.round(r * 255),
                Math.round(g * 255),
                Math.round(b * 255),
              ]);
            }

            polyData.getPointData().setScalars(colors);
          }

          // synthetic vectors from velocity-x for arrows
          const vyScalars = parsed.scalars["velocity-x"];
          let arrowFieldName: string | null = null;

          if (vyScalars && vyScalars.length === numPoints) {
            arrowFieldName = "velocity_y_arrow";

            const arrowVectors = new Float32Array(numPoints * 3);
            let maxAbs = 0;
            for (let j = 0; j < numPoints; j++) {
              const v = vyScalars[j] || 0;
              const a = Math.abs(v);
              if (a > maxAbs) maxAbs = a;
            }
            if (maxAbs === 0) maxAbs = 1;

            for (let j = 0; j < numPoints; j++) {
              const v = vyScalars[j] || 0;
              arrowVectors[j * 3 + 0] = 0;
              arrowVectors[j * 3 + 1] = v;
              arrowVectors[j * 3 + 2] = 0;
            }

            const arrowArray = window.vtk.Common.Core.vtkDataArray.newInstance({
              name: arrowFieldName,
              numberOfComponents: 3,
              values: arrowVectors,
            });
            polyData.getPointData().addArray(arrowArray);
          }

          contextRef.current.polyData = polyData;

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

          if (showVelocityArrows && arrowFieldName) {
            const vtkArrowSource = window.vtk.Filters.Sources.vtkArrowSource;
            const vtkGlyph3DMapper =
              window.vtk.Rendering.Core.vtkGlyph3DMapper;

            if (!contextRef.current.arrowSource) {
              contextRef.current.arrowSource = vtkArrowSource.newInstance();
            }
            if (!contextRef.current.glyphMapper) {
              contextRef.current.glyphMapper = vtkGlyph3DMapper.newInstance();
            }
            if (!contextRef.current.glyphActor) {
              contextRef.current.glyphActor =
                window.vtk.Rendering.Core.vtkActor.newInstance();
              contextRef.current.glyphActor.setMapper(
                contextRef.current.glyphMapper
              );
              renderer.addActor(contextRef.current.glyphActor);
            }

            const glyphMapper = contextRef.current.glyphMapper;
            glyphMapper.setInputData(polyData);
            glyphMapper.setSourceConnection(
              contextRef.current.arrowSource.getOutputPort()
            );
            glyphMapper.setOrientationArray(arrowFieldName);
            glyphMapper.setOrientationModeToDirection();
            glyphMapper.setScaleArray(arrowFieldName);
            glyphMapper.setScaleModeToScaleByMagnitude();
            glyphMapper.setScaleFactor(5.0);

            const glyphActor = contextRef.current.glyphActor;
            glyphActor.getProperty().setColor(0.2, 0.8, 1.0);
            glyphActor.getProperty().setOpacity(0.8);
          } else {
            if (contextRef.current.glyphActor) {
              renderer.removeActor(contextRef.current.glyphActor);
              contextRef.current.glyphActor = null;
              contextRef.current.glyphMapper = null;
              contextRef.current.arrowSource = null;
            }
          }

          if (currentFrame === 0) {
            renderer.resetCamera();
          }

          if (!contextRef.current.canvas && containerRef.current) {
            const canvas = containerRef.current.querySelector("canvas");
            if (canvas instanceof HTMLCanvasElement) {
              contextRef.current.canvas = canvas;
            }
          }

          renderWindow.render();
        } catch {
          setError("Error loading VTK file");
        }
      },
      [colorField, colorMap, pointSize, currentFrame, spacingScale, showVelocityArrows]
    );

    useEffect(() => {
      if (isLoading || !containerRef.current || !window.vtk) return;

      if (!contextRef.current.fullScreenRenderer) {
        const fullScreenRenderer =
          window.vtk.Rendering.Misc.vtkFullScreenRenderWindow.newInstance({
            container: containerRef.current,
            background: [1, 1, 1],
          });
        contextRef.current.fullScreenRenderer = fullScreenRenderer;

        const canvas = containerRef.current?.querySelector("canvas");
        if (canvas instanceof HTMLCanvasElement) {
          contextRef.current.canvas = canvas;
        }
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
        <div
          ref={containerRef}
          className="w-full h-full"
          onClick={handleCanvasClick}
          style={{ cursor: "crosshair" }}
        />
        {selectedPoint && (
          <div className="absolute bottom-4 right-4 bg-black/80 text-white text-xs px-3 py-2 rounded-lg border border-neutral-700 max-w-xs space-y-1">
            <div className="font-semibold">Point {selectedPoint.id}</div>
            <div>
              Pos: {selectedPoint.position[0].toFixed(3)},{" "}
              {selectedPoint.position[1].toFixed(3)},{" "}
              {selectedPoint.position[2].toFixed(3)}
            </div>
            <div className="max-h-40 overflow-auto pr-1">
              {Object.entries(selectedPoint.scalars).map(
                ([name, value]) => (
                  <div key={name}>
                    {name}: {value.toExponential(3)}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);
