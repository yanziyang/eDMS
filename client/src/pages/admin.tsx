import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Admin() {
  const links = [
    { to: "/admin/users", label: "Users" },
    { to: "/admin/groups", label: "Groups" },
    { to: "/admin/sites", label: "Sites" },
    { to: "/admin/storage", label: "Storage" },
    { to: "/admin/audit-log", label: "Audit Log" },
    { to: "/admin/settings", label: "Settings" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Admin Center</h1>
      <div className="mt-4 flex gap-1 overflow-x-auto border-b">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                "border-b-2 px-3 py-2 text-sm font-medium text-muted-foreground",
                isActive && "border-primary text-foreground",
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  );
}
