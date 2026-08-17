import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { PillTabs } from "@/components/app/bits";

const TABS = [
  { to: "/admin/users", label: "Users" },
  { to: "/admin/groups", label: "Groups" },
  { to: "/admin/sites", label: "Sites" },
  { to: "/admin/storage", label: "Storage report" },
  { to: "/admin/audit-log", label: "Audit log" },
  { to: "/admin/settings", label: "Settings" },
];

export function AdminPage({ title, children }: { title: string; children: ReactNode }) {
  const location = useLocation();
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
        <Link to="/admin/users" className="hover:text-foreground">
          Admin Center
        </Link>
        <span className="text-muted-foreground/50">›</span>
        <span className="font-medium text-foreground">{title}</span>
      </div>
      <div className="mb-4">
        <PillTabs items={TABS.map((t) => ({ ...t, active: location.pathname === t.to }))} />
      </div>
      {children}
    </div>
  );
}
