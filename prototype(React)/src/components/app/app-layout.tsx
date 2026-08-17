import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "@/components/app/command-palette";
import { DocSheet } from "@/components/app/doc-sheet";
import { MobileSidebar, Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";

export function AppLayout() {
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSearch={() => setCmdkOpen(true)} onOpenMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-7 py-6 max-md:px-4">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={cmdkOpen} onOpenChange={setCmdkOpen} />
      <DocSheet />
      <Toaster richColors closeButton />
    </div>
  );
}
