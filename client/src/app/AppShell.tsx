import { LogOut, Menu, Moon, Recycle, Search, Settings, Star, Sun } from "lucide-react";
import { Bell } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

export function AppShell() {
  const { user, status, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
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

  const nav = (
    <>
      <NavLink to="/" end className={navClass}>
        <Search className="size-4" />
        My Sites
      </NavLink>
      <NavLink to="/search" className={navClass}>
        <Search className="size-4" />
        Search
      </NavLink>
      <NavLink to="/favorites" className={navClass}>
        <Star className="size-4" />
        Favorites
      </NavLink>
      <NavLink to={recycleBinPath} className={navClass}>
        <Recycle className="size-4" />
        Recycle Bin
      </NavLink>
      {user.isSystemAdmin && (
        <>
          <Separator className="my-2" />
          <div className="px-2 text-xs font-medium text-muted-foreground">Administration</div>
          <NavLink to="/admin" className={navClass}>
            <Settings className="size-4" />
            Admin Center
          </NavLink>
        </>
      )}
    </>
  );

  return (
    <div className="flex min-h-dvh bg-muted/30">
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r bg-sidebar p-3 md:flex">
        <div className="mb-4 flex items-center gap-2 px-2 py-1">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            DM
          </div>
          <span className="font-semibold">eDMS</span>
        </div>
        {nav}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-sidebar p-3">{nav}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <span className="text-sm font-medium">{user.displayName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[220px] truncate text-xs text-muted-foreground sm:inline">
              {user.email}
            </span>
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-7 py-6 max-md:px-4">
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

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
    isActive && "bg-accent text-accent-foreground",
  );
}
