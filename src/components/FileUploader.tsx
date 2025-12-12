import { useCallback } from "react";
import { Upload, FileType } from "lucide-react";

interface FileUploaderProps {
  onFileLoad: (data: ArrayBuffer, fileName: string) => void;
}

export const FileUploader = ({ onFileLoad }: FileUploaderProps) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      const validExtensions = [".vtp", ".vtk", ".vtu"];
      if (file && validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
        const reader = new FileReader();
        reader.onload = () => {
          onFileLoad(reader.result as ArrayBuffer, file.name);
        };
        reader.readAsArrayBuffer(file);
      }
    },
    [onFileLoad]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          onFileLoad(reader.result as ArrayBuffer, file.name);
        };
        reader.readAsArrayBuffer(file);
      }
    },
    [onFileLoad]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-border rounded-xl p-8 text-center transition-all hover:border-primary hover:bg-accent/50 cursor-pointer group"
    >
      <input
        type="file"
        accept=".vtp,.vtk,.vtu"
        onChange={handleFileSelect}
        className="hidden"
        id="vtk-file-input"
      />
      <label htmlFor="vtk-file-input" className="cursor-pointer flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">Drop VTK file here</p>
          <p className="text-sm text-muted-foreground mt-1">or click to browse (.vtk, .vtp)</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileType className="w-4 h-4" />
          <span className="text-xs">Supports legacy VTK and XML formats</span>
        </div>
      </label>
    </div>
  );
};
