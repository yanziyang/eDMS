import {
  Bell,
  Building2,
  LogOut,
  Menu,
  Moon,
  Palette,
  Recycle,
  Search,
  Settings,
  Star,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { listSites } from "@/features/sites/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api";
import { queryKeys } from "@/lib/queryKeys";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const visualThemes = [
  { id: "default", label: "Default", description: "Light · Indigo accent" },
  { id: "midnight", label: "Midnight", description: "Dark · Indigo accent" },
  { id: "ocean", label: "Ocean", description: "Light · Blue accent" },
  { id: "forest", label: "Forest", description: "Light · Green accent" },
] as const;

type VisualTheme = (typeof visualThemes)[number]["id"];

export function AppShell() {
  const { user, status, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [visualTheme, setVisualTheme] = useState<VisualTheme>(() => {
    if (typeof window === "undefined") return "default";
    const saved = window.localStorage.getItem("edms-theme");
    return visualThemes.some((theme) => theme.id === saved) ? (saved as VisualTheme) : "default";
  });

  const sites = useQuery({
    queryKey: queryKeys.sites.list(),
    queryFn: listSites,
    enabled: (user?.siteMemberships.length ?? 0) > 0,
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", visualTheme);
    setTheme(visualTheme === "midnight" ? "dark" : "light");
    window.localStorage.setItem("edms-theme", visualTheme);
  }, [setTheme, visualTheme]);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (status !== "authenticated" || !user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const currentSiteSlug = location.pathname.match(/^\/sites\/([^/]+)/)?.[1];
  const recycleBinPath = currentSiteSlug ? `/recycle-bin/${currentSiteSlug}` : "/recycle-bin";
  const membershipSlugs = new Set(user.siteMemberships.map((membership) => membership.siteSlug));
  const shortcutSites = (sites.data ?? []).filter((site) => membershipSlugs.has(site.urlSlug)).slice(0, 5);

  const nav = (
    <div className="flex flex-col gap-1">
      <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
        Workspace
      </div>
      <NavLink to="/" end className={navClass} onClick={() => setMobileOpen(false)}>
        <Building2 data-icon="inline-start" />
        My Sites
      </NavLink>
      <NavLink to="/search" className={navClass} onClick={() => setMobileOpen(false)}>
        <Search data-icon="inline-start" />
        Search
      </NavLink>
      <NavLink to="/favorites" className={navClass} onClick={() => setMobileOpen(false)}>
        <Star data-icon="inline-start" />
        Favorites
      </NavLink>
      <NavLink to={recycleBinPath} className={navClass} onClick={() => setMobileOpen(false)}>
        <Recycle data-icon="inline-start" />
        Recycle Bin
      </NavLink>

      {shortcutSites.length > 0 && (
        <>
          <div className="mt-4 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
            Sites
          </div>
          {shortcutSites.map((site) => (
            <NavLink
              key={site.id}
              to={`/sites/${site.urlSlug}`}
              className={navClass}
              onClick={() => setMobileOpen(false)}
            >
              <span className="size-2 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
              <span className="truncate">{site.name}</span>
            </NavLink>
          ))}
        </>
      )}

      {user.isSystemAdmin && (
        <>
          <Separator className="my-3" />
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
            Administration
          </div>
          <NavLink to="/admin" className={navClass} onClick={() => setMobileOpen(false)}>
            <Settings data-icon="inline-start" />
            Admin Center
          </NavLink>
        </>
      )}
    </div>
  );

  const applyVisualTheme = (theme: VisualTheme) => {
    setVisualTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
  };

  return (
    <div className="flex min-h-dvh bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 border-b px-5 py-4">
          <div className="flex size-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-primary to-primary/65 text-sm font-bold text-primary-foreground shadow-sm">
            DM
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-tight">eDMS</div>
            <div className="truncate text-[11px] text-muted-foreground">Enterprise documents</div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">{nav}</div>
        <div className="border-t px-5 py-3 text-[11px] text-muted-foreground">
          Internal workspace · v0.2
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r bg-sidebar shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-sm font-bold text-primary-foreground">
                  DM
                </div>
                <span className="font-semibold">eDMS</span>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)}>
                ×
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">{nav}</div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-7">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </Button>
            <Button asChild variant="outline" className="hidden min-w-0 max-w-[430px] flex-1 justify-start bg-muted/40 text-muted-foreground sm:flex">
              <NavLink to="/search" aria-label="Search documents">
                <Search data-icon="inline-start" />
                <span className="truncate">Search documents, sites, and libraries…</span>
                <kbd className="ml-auto hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground lg:inline">
                  ⌘ K
                </kbd>
              </NavLink>
            </Button>
            <span className="truncate text-sm font-medium sm:hidden">{pageContext(location.pathname)}</span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-2 pr-1 sm:flex">
              <Avatar size="sm">
                <AvatarFallback>{initials(user.displayName)}</AvatarFallback>
              </Avatar>
              <div className="hidden max-w-44 lg:block">
                <div className="truncate text-sm font-medium">{user.displayName}</div>
                <div className="truncate text-[11px] text-muted-foreground">{user.email}</div>
              </div>
            </div>
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Choose theme">
                  <Palette />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {visualThemes.map((theme) => (
                  <DropdownMenuItem
                    key={theme.id}
                    className="items-start"
                    onSelect={() => applyVisualTheme(theme.id)}
                  >
                    <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", theme.id === "midnight" ? "bg-slate-800" : theme.id === "ocean" ? "bg-sky-500" : theme.id === "forest" ? "bg-emerald-600" : "bg-indigo-600")} />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{theme.label}</span>
                      <span className="text-xs text-muted-foreground">{theme.description}</span>
                    </span>
                    {visualTheme === theme.id && <span className="ml-auto text-xs text-primary">Selected</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              aria-label={visualTheme === "midnight" || resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => applyVisualTheme(visualTheme === "midnight" ? "default" : "midnight")}
            >
              {visualTheme === "midnight" || resolvedTheme === "dark" ? <Sun /> : <Moon />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut data-icon="inline-start" />
              <span className="hidden sm:inline">Sign out</span>
              <span className="sm:hidden" aria-hidden="true">↗</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-7 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NotificationBell() {
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => listNotifications(),
  });
  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const entries = notifications.data ?? [];
  const unreadCount = entries.filter((entry) => !entry.isRead).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell data-icon="inline-start" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="min-w-5 px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between px-1.5">
          <DropdownMenuLabel className="px-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.isLoading && (
          <div className="px-1.5 py-3 text-sm text-muted-foreground">Loading…</div>
        )}
        {notifications.isError && (
          <div className="px-1.5 py-3 text-sm text-destructive">Unable to load notifications.</div>
        )}
        {!notifications.isLoading && !notifications.isError && entries.length === 0 && (
          <div className="px-1.5 py-3 text-sm text-muted-foreground">You’re all caught up.</div>
        )}
        {entries.slice(0, 8).map((entry) => (
          <DropdownMenuItem
            key={entry.id}
            className={cn("items-start whitespace-normal", !entry.isRead && "bg-accent/50")}
            onSelect={() => {
              if (!entry.isRead) {
                markRead.mutate(entry.id);
              }
            }}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-medium">{entry.message}</span>
              <span className="text-xs text-muted-foreground">
                {entry.objectName} · {formatNotificationTime(entry.occurredAt)}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatNotificationTime(value: string): string {
  return new Date(value).toLocaleString();
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function pageContext(pathname: string): string {
  if (pathname.startsWith("/admin")) return "Admin Center";
  if (pathname.startsWith("/sites/")) return pathname.includes("/libraries/") ? "Library" : "Site";
  if (pathname === "/favorites") return "Favorites";
  if (pathname.startsWith("/recycle-bin")) return "Recycle Bin";
  if (pathname === "/search") return "Search";
  return "My Sites";
}

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive && "bg-accent text-accent-foreground shadow-sm",
  );
}
