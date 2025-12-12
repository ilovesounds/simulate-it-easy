import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2, Palette, Eye } from "lucide-react";

interface SimulationControlsProps {
  opacity: number;
  wireframe: boolean;
  color: [number, number, number];
  onOpacityChange: (value: number) => void;
  onWireframeChange: (value: boolean) => void;
  onColorChange: (value: [number, number, number]) => void;
}

const colorPresets: { name: string; value: [number, number, number] }[] = [
  { name: "Blue", value: [0.2, 0.4, 0.8] },
  { name: "Red", value: [0.8, 0.2, 0.2] },
  { name: "Green", value: [0.2, 0.7, 0.3] },
  { name: "Gold", value: [0.9, 0.7, 0.2] },
  { name: "Cyan", value: [0.2, 0.8, 0.8] },
  { name: "Purple", value: [0.6, 0.2, 0.8] },
];

export const SimulationControls = ({
  opacity,
  wireframe,
  color,
  onOpacityChange,
  onWireframeChange,
  onColorChange,
}: SimulationControlsProps) => {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Settings2 className="w-5 h-5" />
          Simulation Parameters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Opacity Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Eye className="w-4 h-4" />
              Opacity
            </Label>
            <span className="text-sm text-muted-foreground">{Math.round(opacity * 100)}%</span>
          </div>
          <Slider
            value={[opacity]}
            min={0.1}
            max={1}
            step={0.05}
            onValueChange={([val]) => onOpacityChange(val)}
            className="w-full"
          />
        </div>

        {/* Wireframe Toggle */}
        <div className="flex items-center justify-between py-2">
          <Label htmlFor="wireframe" className="text-sm font-medium cursor-pointer">
            Wireframe Mode
          </Label>
          <Switch
            id="wireframe"
            checked={wireframe}
            onCheckedChange={onWireframeChange}
          />
        </div>

        {/* Color Presets */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Palette className="w-4 h-4" />
            Color Preset
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {colorPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => onColorChange(preset.value)}
                className={`px-3 py-2 rounded-md text-xs font-medium transition-all ${
                  color.toString() === preset.value.toString()
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "hover:bg-accent"
                }`}
                style={{
                  backgroundColor: `rgb(${preset.value[0] * 255}, ${preset.value[1] * 255}, ${preset.value[2] * 255})`,
                  color: preset.value[0] + preset.value[1] + preset.value[2] > 1.5 ? "#000" : "#fff",
                }}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
