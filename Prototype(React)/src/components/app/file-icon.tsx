import { FileText, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { fileIcoClass } from "@/lib/helpers";

export function FileIcon({
  item,
  size,
  className,
  iconClassName,
}: {
  item: { type: string; ext?: string | null };
  size?: number;
  className?: string;
  iconClassName?: string;
}) {
  const cls = item.type === "folder" ? "folder" : fileIcoClass(item.ext);
  const Icon = item.type === "folder" ? Folder : FileText;
  const style = size ? { width: size, height: size } : undefined;
  return (
    <div className={cn("file-ico size-[34px]", cls, className)} style={style}>
      <Icon
        data-icon
        className={cn("size-[17px]", iconClassName)}
        style={size && size > 34 ? { width: Math.round(size / 2), height: Math.round(size / 2) } : undefined}
      />
    </div>
  );
}
