import { LogOut, Menu, Recycle, Search, Settings } from "lucide-react";
import { useState } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { user, status, logout } = useAuth();
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
      <NavLink to="/recycle-bin" className={navClass}>
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
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <span className="text-sm font-medium">{user.displayName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="max-w-[220px] truncate text-xs text-muted-foreground">
              {user.email}
            </span>
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

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
    isActive && "bg-accent text-accent-foreground",
  );
}
