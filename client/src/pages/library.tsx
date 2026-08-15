import { useEffect, useRef, useState } from "react";
import { ChevronRight, Download, FileText, Folder, Trash2, Upload } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  createFolder,
  deleteDocument,
  deleteFolder,
  downloadDocument,
  listFolderItems,
  listItems,
  uploadToFolder,
  uploadToLibrary,
} from "@/features/documents/api";
import type { ItemDto } from "@/types/api";

export function LibraryBrowser() {
  const { siteSlug, libraryId } = useParams();
  const [items, setItems] = useState<ItemDto[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const result = folderId ? await listFolderItems(folderId) : await listItems(libraryId!);
    setItems(result);
  };

  useEffect(() => {
    setFolderId(null);
  }, [libraryId]);

  useEffect(() => {
    reload();
  }, [folderId, libraryId]);

  const submitFolder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newFolder.trim()) return;
    await createFolder(folderId ? null : libraryId!, folderId, newFolder.trim());
    setNewFolder("");
    await reload();
  };

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const result = folderId
          ? await uploadToFolder(folderId, file)
          : await uploadToLibrary(libraryId!, file);
        toast.success(`Uploaded ${result.name} (v${result.versionLabel})`);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    await reload();
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-1 text-sm">
        <Link to="/" className="text-muted-foreground hover:text-foreground">Sites</Link>
        <ChevronRight className="size-4 text-muted-foreground" />
        <Link to={`/sites/${siteSlug}`} className="text-muted-foreground hover:text-foreground">
          {siteSlug}
        </Link>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
            <Upload className="size-4" />
            Upload
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => onUpload(event.target.files)}
          />
        </div>
      </div>

      <form onSubmit={submitFolder} className="mb-4 flex items-center gap-2">
        <Input
          value={newFolder}
          onChange={(event) => setNewFolder(event.target.value)}
          placeholder="New folder name"
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" size="sm">New folder</Button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Size</th>
              <th className="px-4 py-2 font-medium">Modified</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  {item.kind === "folder" ? (
                    <button
                      onClick={() => setFolderId(item.folderId!)}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <Folder className="size-4 text-amber-500" />
                      {item.name}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-blue-500" />
                      {item.name}
                      {item.checkedOutBy && (
                        <Badge variant="outline" className="text-xs">Checked out</Badge>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {item.kind === "document" ? formatBytes(item.sizeBytes) : ""}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(item.modifiedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    {item.kind === "document" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Download"
                        onClick={() => downloadDocument(item.documentId!, item.name)}
                      >
                        <Download className="size-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete"
                      onClick={async () => {
                        if (item.kind === "document") await deleteDocument(item.documentId!);
                        else await deleteFolder(item.folderId!);
                        await reload();
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">This folder is empty.</p>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
