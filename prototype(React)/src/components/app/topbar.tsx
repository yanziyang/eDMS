import {
  Bell,
  Building2,
  ChevronDown,
  FolderPlus,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UploadCloud,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CURRENT_USER, NOTIFICATIONS } from "@/lib/mock-data";
import { db, quickToggleTheme, useDb } from "@/lib/store";
import { NotifIcon } from "@/components/app/icon-map";
import { cn } from "@/lib/utils";

export function Topbar({
  onOpenSearch,
  onOpenMenu,
}: {
  onOpenSearch: () => void;
  onOpenMenu: () => void;
}) {
  useDb();
  const navigate = useNavigate();
  const theme = db.theme;
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-3 border-b bg-background/85 px-5 backdrop-blur-[8px]">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenMenu}
        aria-label="Open menu"
      >
        <Menu />
      </Button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex w-full max-w-[420px] items-center gap-2 rounded-[var(--radius)] border bg-muted/50 px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted"
      >
        <Search className="size-4" />
        <span className="hidden truncate md:inline">Search sites, documents…</span>
        <kbd className="ml-auto rounded border bg-background px-1 py-0.5 text-[10.5px] text-muted-foreground">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="hidden sm:inline-flex">
              <Plus data-icon="inline-start" />
              New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[210px]">
            <DropdownMenuLabel>Create</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => navigate("/sites/finance/documents/root?action=upload")}>
              <UploadCloud data-icon="inline-start" />
              Upload file
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/sites/finance/documents/root?action=newfolder")}>
              <FolderPlus data-icon="inline-start" />
              New folder
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/admin/sites?action=newsite")}>
              <Building2 data-icon="inline-start" />
              New site
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell />
              {unread > 0 && (
                <span className="absolute right-[7px] top-[7px] size-2 rounded-full border-2 border-background bg-destructive" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[320px]">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            {NOTIFICATIONS.map((n, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 rounded-[calc(var(--radius)-4px)] px-2.5 py-2.5 hover:bg-muted"
              >
                {n.unread ? (
                  <span className="mt-1.5 size-[7px] shrink-0 rounded-full bg-primary" />
                ) : (
                  <span className="w-[7px] shrink-0" />
                )}
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <NotifIcon icon={n.icon} className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium leading-snug">{n.title}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">{n.desc}</div>
                  <div className="mt-1 text-[10.5px] text-muted-foreground">{n.time}</div>
                </div>
              </div>
            ))}
            <DropdownMenuSeparator />
            <div className="px-2.5 py-2 text-center text-[13px] font-semibold text-primary">
              View all notifications
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          onClick={quickToggleTheme}
          aria-label="Toggle dark mode"
        >
          {theme === "midnight" ? <Moon /> : <Sun />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-transparent py-0.5 pl-1 pr-1.5 hover:border-border"
            >
              <span className="flex size-[34px] items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {CURRENT_USER.initials}
              </span>
              <ChevronDown className="hidden size-4 md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[250px]">
            <div className="px-3 py-2.5">
              <div className="text-[13px] font-semibold">{CURRENT_USER.name}</div>
              <div className="text-[11.5px] text-muted-foreground">{CURRENT_USER.email}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/profile")}>
              <User data-icon="inline-start" />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => navigate("/profile", { state: { scrollTo: "preferences" } })}
            >
              <SlidersHorizontal data-icon="inline-start" />
              Preferences & Theme
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/admin/users")}>
              <ShieldCheck data-icon="inline-start" />
              Admin Center
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => navigate("/login")}
              className={cn("text-destructive")}
            >
              <LogOut data-icon="inline-start" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
