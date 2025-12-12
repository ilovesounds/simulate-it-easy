import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Palette, Circle } from "lucide-react";

interface SimulationControlsProps {
  pointSize: number;
  colorField: string;
  colorMap: string;
  availableFields: string[];
  onPointSizeChange: (value: number) => void;
  onColorFieldChange: (value: string) => void;
  onColorMapChange: (value: string) => void;
}

const colorMaps = [
  { value: "rainbow", label: "Rainbow" },
  { value: "coolwarm", label: "Cool-Warm" },
  { value: "viridis", label: "Viridis" },
  { value: "plasma", label: "Plasma" },
];

export const SimulationControls = ({
  pointSize,
  colorField,
  colorMap,
  availableFields,
  onPointSizeChange,
  onColorFieldChange,
  onColorMapChange,
}: SimulationControlsProps) => {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Settings2 className="w-5 h-5" />
          Visualization Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Point Size Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Circle className="w-4 h-4" />
              Ball Size
            </Label>
            <span className="text-sm text-muted-foreground">{pointSize}px</span>
          </div>
          <Slider
            value={[pointSize]}
            min={1}
            max={20}
            step={1}
            onValueChange={([val]) => onPointSizeChange(val)}
            className="w-full"
          />
        </div>

        {/* Color Field Selection */}
        {availableFields.length > 0 && (
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Palette className="w-4 h-4" />
              Color By Field
            </Label>
            <Select value={colorField} onValueChange={onColorFieldChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Solid Color)</SelectItem>
                {availableFields.map((field) => (
                  <SelectItem key={field} value={field}>
                    {field}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Color Map Selection */}
        {colorField !== "none" && availableFields.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Color Map</Label>
            <Select value={colorMap} onValueChange={onColorMapChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorMaps.map((cm) => (
                  <SelectItem key={cm.value} value={cm.value}>
                    {cm.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Color Map Preview */}
        {colorField !== "none" && availableFields.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Color Scale</Label>
            <div 
              className="h-4 rounded-md w-full"
              style={{
                background: colorMap === 'rainbow' 
                  ? 'linear-gradient(to right, blue, cyan, lime, yellow, red)'
                  : colorMap === 'coolwarm'
                  ? 'linear-gradient(to right, rgb(59,77,191), rgb(222,222,222), rgb(181,5,38))'
                  : colorMap === 'viridis'
                  ? 'linear-gradient(to right, rgb(69,0,84), rgb(72,120,135), rgb(33,169,133), rgb(253,232,36))'
                  : 'linear-gradient(to right, rgb(13,8,135), rgb(140,23,166), rgb(237,92,77), rgb(240,250,33))'
              }}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Min</span>
              <span>Max</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
