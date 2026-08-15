import {
  BarChart3,
  Building2,
  Clock,
  Folder,
  Home,
  Settings,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { db, useDb } from "@/lib/store";

function SidebarLink({
  to,
  active,
  icon,
  label,
  sub,
}: {
  to: string;
  active: boolean;
  icon?: React.ReactNode;
  label: React.ReactNode;
  sub?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "mb-px flex items-center gap-2.5 rounded-[calc(var(--radius)-2px)] px-2.5 py-2 text-[13.5px] font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        sub && "py-1.5 text-[13px]",
        active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  useDb();
  const location = useLocation();
  const path = location.pathname;

  const sectionLabel = (
    <div className="px-2.5 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sidebar-foreground/50">
      Sites
    </div>
  );
  const sites = db.sites.map((s) => {
    const isActive = path.startsWith(`/sites/${s.slug}`);
    return (
      <div key={s.slug}>
        <SidebarLink
          to={`/sites/${s.slug}`}
          active={isActive}
          icon={<span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />}
          label={s.name}
        />
        {isActive && (
          <div className="pl-7">
            {s.libraries.map((l) => {
              const libActive = path.includes(`/sites/${s.slug}/${l.id}`);
              return (
                <SidebarLink
                  key={l.id}
                  to={`/sites/${s.slug}/${l.id}/root`}
                  active={libActive}
                  sub
                  icon={<Folder className="size-[15px]" data-icon />}
                  label={l.name}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  });

  const iconCls = "size-4 text-sidebar-foreground/55";

  return (
    <aside className="sticky top-0 z-40 flex h-screen w-[264px] shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
        <div className="mark size-8 rounded-[9px] text-[13px]">DM</div>
        <div>
          <div className="text-[15px] font-bold leading-tight">eDMS</div>
          <div className="text-[11px] text-sidebar-foreground/60">Prototype</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2.5 py-3" onClick={onNavigate}>
        <SidebarLink
          to="/home"
          active={path === "/home"}
          icon={<Home className={iconCls} />}
          label="Home"
        />
        {sectionLabel}
        {sites}
        <div className="px-2.5 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sidebar-foreground/50">
          Library
        </div>
        <SidebarLink
          to="/recycle-bin"
          active={path === "/recycle-bin"}
          icon={<Trash2 className={iconCls} />}
          label="Recycle Bin"
        />
        <div className="px-2.5 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sidebar-foreground/50">
          Admin Center
        </div>
        <SidebarLink
          to="/admin/users"
          active={path === "/admin/users"}
          icon={<Users className={iconCls} />}
          label="Users"
        />
        <SidebarLink
          to="/admin/groups"
          active={path === "/admin/groups"}
          icon={<UserPlus className={iconCls} />}
          label="Groups"
        />
        <SidebarLink
          to="/admin/sites"
          active={path === "/admin/sites"}
          icon={<Building2 className={iconCls} />}
          label="Sites"
        />
        <SidebarLink
          to="/admin/storage"
          active={path === "/admin/storage"}
          icon={<BarChart3 className={iconCls} />}
          label="Storage Report"
        />
        <SidebarLink
          to="/admin/audit-log"
          active={path === "/admin/audit-log"}
          icon={<Clock className={iconCls} />}
          label="Audit Log"
        />
        <SidebarLink
          to="/admin/settings"
          active={path === "/admin/settings"}
          icon={<Settings className={iconCls} />}
          label="Settings"
        />
      </div>
      <div className="shrink-0 border-t border-sidebar-border px-4 py-3 text-[11.5px] text-sidebar-foreground/50">
        eDMS Prototype · v1.0
        <br />
        Not connected to a real backend.
      </div>
    </aside>
  );
}

export function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 z-39 bg-black/40 md:hidden" onClick={onClose} />}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[264px] -translate-x-full bg-sidebar shadow-[20px_0_40px_rgba(0,0,0,0.15)] transition-transform duration-200 md:hidden",
          open && "translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto">
            <Sidebar onNavigate={onClose} />
          </div>
        </div>
      </div>
    </>
  );
}
