import { useCallback } from "react";
import { FolderOpen, FileType } from "lucide-react";

interface FolderUploaderProps {
  onFilesLoad: (files: { name: string; data: ArrayBuffer }[]) => void;
}

export const FolderUploader = ({ onFilesLoad }: FolderUploaderProps) => {
  const processFiles = useCallback(async (fileList: FileList) => {
    const vtkFiles: File[] = [];
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.name.toLowerCase().endsWith('.vtk') || 
          file.name.toLowerCase().endsWith('.vtp') ||
          file.name.toLowerCase().endsWith('.vtu')) {
        vtkFiles.push(file);
      }
    }
    
    // Sort files by name for proper animation order
    vtkFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    
    const loadedFiles: { name: string; data: ArrayBuffer }[] = [];
    
    for (const file of vtkFiles) {
      const data = await file.arrayBuffer();
      loadedFiles.push({ name: file.name, data });
    }
    
    if (loadedFiles.length > 0) {
      onFilesLoad(loadedFiles);
    }
  }, [onFilesLoad]);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      
      const items = e.dataTransfer.items;
      const files: File[] = [];
      
      const readDirectory = async (entry: FileSystemDirectoryEntry): Promise<void> => {
        const reader = entry.createReader();
        const entries = await new Promise<FileSystemEntry[]>((resolve) => {
          reader.readEntries((entries) => resolve(entries));
        });
        
        for (const entry of entries) {
          if (entry.isFile) {
            const file = await new Promise<File>((resolve) => {
              (entry as FileSystemFileEntry).file((f) => resolve(f));
            });
            files.push(file);
          } else if (entry.isDirectory) {
            await readDirectory(entry as FileSystemDirectoryEntry);
          }
        }
      };
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = item.webkitGetAsEntry();
        
        if (entry?.isDirectory) {
          await readDirectory(entry as FileSystemDirectoryEntry);
        } else if (entry?.isFile) {
          const file = await new Promise<File>((resolve) => {
            (entry as FileSystemFileEntry).file((f) => resolve(f));
          });
          files.push(file);
        }
      }
      
      if (files.length > 0) {
        const dataTransfer = new DataTransfer();
        files.forEach(f => dataTransfer.items.add(f));
        await processFiles(dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleFolderSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        await processFiles(files);
      }
    },
    [processFiles]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-border rounded-xl p-8 text-center transition-all hover:border-primary hover:bg-accent/50 cursor-pointer group"
    >
      <input
        type="file"
        // @ts-ignore - webkitdirectory is not in React types
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFolderSelect}
        className="hidden"
        id="vtk-folder-input"
      />
      <label htmlFor="vtk-folder-input" className="cursor-pointer flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <FolderOpen className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">Drop simulation folder here</p>
          <p className="text-sm text-muted-foreground mt-1">or click to browse folder with VTK files</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileType className="w-4 h-4" />
          <span className="text-xs">VTK files will be sorted and played as animation</span>
        </div>
      </label>
    </div>
  );
};
