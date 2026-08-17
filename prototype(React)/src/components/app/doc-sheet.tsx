import { useState } from "react";
import {
  Download,
  Eye,
  History,
  Info,
  Lock,
  LockOpen,
  Pencil,
  Share2,
  ShieldCheck,
  Star,
  TriangleAlert,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AlertBanner, TagBadges } from "@/components/app/bits";
import { FileIcon } from "@/components/app/file-icon";
import { bumpVersion, fmtDate, generateActivity, generateVersions, todayStr } from "@/lib/helpers";
import { CURRENT_USER } from "@/lib/mock-data";
import {
  closeDocSheet,
  db,
  emit,
  isFavorite,
  itemFavoriteEntry,
  setDocSheetTab,
  toggleFavorite,
  useDb,
} from "@/lib/store";
import { cn } from "@/lib/utils";

export function DocSheet() {
  useDb();
  const state = db.sheet;
  const [breakInherit, setBreakInherit] = useState(false);
  const [activeTab, setActiveTab] = useState(state?.tab ?? "properties");

  // Re-sync local state whenever a new sheet session starts (openDocSheet
  // creates a fresh state object each time, including for the same item).
  const [lastSession, setLastSession] = useState(state);
  if (state && state !== lastSession) {
    setLastSession(state);
    setActiveTab(state.tab);
    setBreakInherit(false);
  }

  const item = state?.item;
  const open = !!item;

  const tab = (key: typeof activeTab) => {
    setActiveTab(key);
    setDocSheetTab(key);
  };

  if (!item) {
    return (
      <Sheet open={false} onOpenChange={() => closeDocSheet()}>
        <SheetContent side="right" className="w-full max-w-[460px] p-0 sm:max-w-[460px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Document details</SheetTitle>
            <SheetDescription />
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const versions = generateVersions(item);
  const activity = generateActivity(item);
  const mine = item.checkedOutBy === CURRENT_USER.name;
  const favoriteEntry = itemFavoriteEntry(item, state?.context ?? { site: "unknown", lib: "documents", folder: "root" });
  const favorite = isFavorite(favoriteEntry.key);

  const checkout = () => {
    item.checkedOutBy = CURRENT_USER.name;
    emit();
    toast.success("Checked out", { description: "Only you can upload a new version until you check in." });
  };

  const checkin = () => {
    item.checkedOutBy = null;
    item.version = bumpVersion(item.version);
    item.modified = todayStr();
    item.modifiedBy = CURRENT_USER.name;
    emit();
    toast.success("Checked in", { description: `New version ${item.version} created.` });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) closeDocSheet();
      }}
    >
      <SheetContent side="right" className="flex w-full max-w-[460px] flex-col gap-0 p-0 sm:max-w-[460px]">
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-start gap-3">
            <FileIcon item={item} size={40} className="size-10" iconClassName="size-5" />
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-base">{item.name}</SheetTitle>
              <div className="mt-1 text-xs text-muted-foreground">
                {item.size || ""} · v{item.version || "1.0"} · modified {fmtDate(item.modified)}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className={favorite ? "text-amber-500 hover:text-amber-600" : undefined}
              aria-label={favorite ? "Remove document from favorites" : "Add document to favorites"}
              onClick={() => toggleFavorite(favoriteEntry)}
            >
              <Star className={favorite ? "fill-current" : undefined} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => closeDocSheet()} aria-label="Close">
              <X />
            </Button>
          </div>
          {item.checkedOutBy && (
            <AlertBanner icon={<Lock className="size-4" />} variant="warning" title="Checked out">
              This file is checked out by {mine ? "you" : item.checkedOutBy}. Others cannot upload a new
              version until it's checked in.
            </AlertBanner>
          )}
          <div className="flex gap-5 border-b">
            {(
              [
                ["properties", "Properties"],
                ["versions", "Versions"],
                ["permissions", "Permissions"],
                ["activity", "Activity"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => tab(key)}
                className={cn(
                  "-mb-px border-b-2 border-transparent py-2.5 text-[13.5px] font-medium text-muted-foreground hover:text-foreground",
                  activeTab === key && "border-primary text-primary"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {activeTab === "properties" && (
            <div className="flex flex-col gap-4">
              <div>
                <Label className="text-[13px]">Title</Label>
                <Input className="mt-1.5" defaultValue={item.name.replace(/\.[^.]+$/, "")} />
              </div>
              <div>
                <Label className="text-[13px]">Description</Label>
                <Textarea className="mt-1.5" rows={3} placeholder="Add a description…" />
              </div>
              <div>
                <Label className="text-[13px]">Tags</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {item.tags?.length ? (
                    <TagBadges tags={item.tags} />
                  ) : (
                    <span className="text-xs text-muted-foreground">No tags yet</span>
                  )}
                </div>
              </div>
              <div className="my-1 h-px bg-border" />
              <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                <Meta label="File size" value={item.size || "—"} />
                <Meta label="File type" value={item.ext ? item.ext.toUpperCase() : "—"} />
                <Meta label="Modified by" value={item.modifiedBy} />
                <Meta label="Modified" value={fmtDate(item.modified)} />
                <Meta label="Created by" value={item.modifiedBy} />
                <Meta label="Current version" value={item.version || "1.0"} />
              </div>
            </div>
          )}

          {activeTab === "versions" && (
            <div>
              <div className="mb-3 flex gap-2">
                {mine ? (
                  <Button size="sm" variant="secondary" onClick={checkin}>
                    <LockOpen data-icon="inline-start" />
                    Check in
                  </Button>
                ) : item.checkedOutBy ? (
                  <Button size="sm" variant="secondary" disabled>
                    <Lock data-icon="inline-start" />
                    Checked out by {item.checkedOutBy}
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={checkout}>
                    <Lock data-icon="inline-start" />
                    Check out
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto rounded-[var(--radius)] border bg-card">
                <Table className="text-[13.3px]">
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Version</TableHead>
                      <TableHead>Modified by</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v, i) => (
                      <TableRow key={v.version}>
                        <TableCell>
                          <span className="font-medium">{v.version}</span>{" "}
                          {i === 0 && <Badge className="border-transparent bg-primary/12 text-primary">Current</Badge>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{v.by}</TableCell>
                        <TableCell className="text-muted-foreground">{fmtDate(v.date)}</TableCell>
                        <TableCell className="text-muted-foreground">{v.size}</TableCell>
                        <TableCell className="text-right">
                          {i !== 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                toast.success(`Restored version ${v.version}`, {
                                  description: "A new version was created from the restored content.",
                                })
                              }
                            >
                              Restore
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {activeTab === "permissions" &&
            (breakInherit ? (
              <div>
                <AlertBanner icon={<TriangleAlert className="size-4" />} variant="warning">
                  This item now has unique permissions. Changes here no longer follow the library.
                </AlertBanner>
                <div className="mt-3 flex flex-col gap-2">
                  {(
                    [
                      ["Site Owners", "Full Control", null],
                      ["Site Members", "Contribute", null],
                      ["Sarah Chen", "Read", "SC"],
                    ] as const
                  ).map(([name, level, initials]) => (
                    <div key={name} className="flex items-center gap-3 rounded-[var(--radius)] border p-2">
                      <span className="flex size-[26px] items-center justify-center rounded-full bg-primary/15 text-[10.5px] font-semibold text-primary">
                        {initials ?? <Users className="size-3.5" />}
                      </span>
                      <div className="flex-1 text-sm font-medium">{name}</div>
                      <Badge variant="secondary">{level}</Badge>
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${name}`}>
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toast.success("Access granted", {
                        description: "Invited people will receive an email notification.",
                      })
                    }
                  >
                    <UserPlus data-icon="inline-start" />
                    Grant access
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBreakInherit(false);
                      toast.success("Reset to inherited permissions");
                    }}
                  >
                    Reset to inherited
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <AlertBanner icon={<Info className="size-4" />} variant="info">
                  This item inherits permissions from its library. Break inheritance to set unique access.
                </AlertBanner>
                <div className="mt-3 flex flex-col gap-2">
                  {(
                    [
                      ["Site Owners", "Full Control"],
                      ["Site Members", "Contribute"],
                      ["Site Visitors", "Read"],
                    ] as const
                  ).map(([name, level]) => (
                    <div key={name} className="flex items-center gap-3 rounded-[var(--radius)] border p-2">
                      <span className="flex size-[26px] items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Users className="size-3.5" />
                      </span>
                      <div className="flex-1 text-sm font-medium">{name}</div>
                      <Badge variant="secondary">{level}</Badge>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setBreakInherit(true);
                    toast.success("Unique permissions enabled");
                  }}
                >
                  <ShieldCheck data-icon="inline-start" />
                  Stop inheriting permissions
                </Button>
              </div>
            ))}

          {activeTab === "activity" && (
            <div className="flex flex-col">
              {activity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 border-b py-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <ActivityIcon name={a.icon} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{a.by}</span> {a.action.toLowerCase()}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{fmtDate(a.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success(`Shared "${item.name}"`, { description: "An email notification was sent to the people you added." })}
          >
            <Share2 data-icon="inline-start" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info(`Downloading ${item.name}…`)}>
            <Download data-icon="inline-start" />
            Download
          </Button>
          <Button size="sm" onClick={() => closeDocSheet()}>
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function ActivityIcon({ name }: { name: string }) {
  const cls = "size-3.5";
  switch (name) {
    case "pencil":
      return <Pencil className={cls} />;
    case "download":
      return <Download className={cls} />;
    case "eye":
      return <Eye className={cls} />;
    case "share":
      return <Share2 className={cls} />;
    case "upload":
      return <UploadCloud className={cls} />;
    default:
      return <History className={cls} />;
  }
}
