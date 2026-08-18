import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Breadcrumbs, PageHeader } from "@/components/app/page-frame";
import { cn } from "@/lib/utils";

export function Admin() {
  const location = useLocation();
  const links = [
    { to: "/admin/users", label: "Users" },
    { to: "/admin/groups", label: "Groups" },
    { to: "/admin/sites", label: "Sites" },
    { to: "/admin/storage", label: "Storage" },
    { to: "/admin/content-types", label: "Content Types" },
    { to: "/admin/audit-log", label: "Audit Log" },
    { to: "/admin/settings", label: "Settings" },
  ];
  const current = links.find((link) => location.pathname === link.to) ?? links[0];
  const descriptions: Record<string, string> = {
    Users: "Manage accounts, roles, and access across the organization.",
    Groups: "Site-managed groups and organization-wide custom groups.",
    Sites: "Every workspace provisioned in this organization.",
    Storage: "Usage across every site, updated as documents are added or removed.",
    "Content Types": "Define reusable metadata fields for consistent document classification.",
    "Audit Log": "Every upload, download, permission change, and sign-in is recorded and immutable.",
    Settings: "Organization-wide configuration for eDMS.",
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Admin Center</h1>
      <Breadcrumbs items={[{ label: "Admin Center", to: "/admin/users" }, { label: current.label }]} />
      <PageHeader
        title={current.label}
        description={descriptions[current.label]}
      />
      <nav aria-label="Administration sections" className="flex gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                "shrink-0 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                isActive && "border-primary bg-card text-foreground shadow-sm",
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div>
        <Outlet />
      </div>
    </div>
  );
}
