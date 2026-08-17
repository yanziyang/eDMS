import { Info, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertBanner, EmptyState, PageHeader } from "@/components/app/bits";
import { FileIcon } from "@/components/app/file-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db, emit, useDb } from "@/lib/store";

export function RecycleBin() {
  useDb();
  const items = db.recycle;

  const emptyAll = () => {
    if (!items.length) return;
    items.splice(0, items.length);
    emit();
    toast.success("Recycle Bin emptied");
  };

  return (
    <div>
      <PageHeader
        title="Recycle Bin"
        subtitle={
          <>
            <span className="font-medium text-foreground">{items.length}</span> items · deleted items are
            kept for 90 days before being permanently purged
          </>
        }
        actions={
          <Button variant="outline" onClick={emptyAll}>
            <Trash2 data-icon="inline-start" />
            Empty recycle bin
          </Button>
        }
      />

      <div className="mb-4">
        <AlertBanner icon={<Info className="size-4" />} variant="info">
          As a Site Owner / System Administrator, you can see items deleted by everyone across every
          site. Regular members only see their own deleted items here.
        </AlertBanner>
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Trash2 className="size-6" />}
            title="Recycle Bin is empty"
            description="Items you delete from any library will appear here for 90 days."
          />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius)] border bg-card">
          <Table className="text-[13.3px]">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-9" />
                <TableHead>Name</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Original location</TableHead>
                <TableHead>Deleted by</TableHead>
                <TableHead>Deleted</TableHead>
                <TableHead className="w-24 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={item.name + i}>
                  <TableCell className="w-9" />
                  <TableCell>
                    <div className="flex items-center gap-2.5 font-medium">
                      <FileIcon item={{ type: item.type, ext: item.ext }} />
                      <span className="truncate">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.site}</TableCell>
                  <TableCell className="text-muted-foreground">{item.originalPath}</TableCell>
                  <TableCell className="text-muted-foreground">{item.deletedBy}</TableCell>
                  <TableCell className="text-muted-foreground">{item.deletedAt}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Restore"
                        onClick={() => {
                          items.splice(i, 1);
                          emit();
                          toast.success(`"${item.name}" restored`, {
                            description: `Back in ${item.site} / ${item.originalPath}`,
                          });
                        }}
                      >
                        <RotateCcw />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete permanently"
                        onClick={() => {
                          items.splice(i, 1);
                          emit();
                          toast.error(`"${item.name}" permanently deleted`);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
