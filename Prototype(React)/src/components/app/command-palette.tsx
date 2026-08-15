import {
  BarChart3,
  Building2,
  Clock,
  FileText,
  Home,
  Search,
  Settings,
  Trash2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { SiteIcon } from "@/components/app/icon-map";
import { db } from "@/lib/store";
import { SEARCH_INDEX } from "@/lib/mock-data";

const NAV_ITEMS = [
  { icon: Home, label: "Home", to: "/home" },
  { icon: Search, label: "Advanced search", to: "/search" },
  { icon: Trash2, label: "Recycle Bin", to: "/recycle-bin" },
  { icon: User, label: "My Profile & Preferences", to: "/profile" },
  { icon: Users, label: "Admin: Users", to: "/admin/users" },
  { icon: UserPlus, label: "Admin: Groups", to: "/admin/groups" },
  { icon: Building2, label: "Admin: Sites", to: "/admin/sites" },
  { icon: Settings, label: "Admin: Settings", to: "/admin/settings" },
  { icon: BarChart3, label: "Admin: Storage Report", to: "/admin/storage" },
  { icon: Clock, label: "Admin: Audit Log", to: "/admin/audit-log" },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command>
        <CommandInput placeholder="Search sites, documents, or jump to a page…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {open && <CommandPaletteContent go={go} />}
        </CommandList>
        <div className="flex gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground">
          <span>
            <kbd className="rounded border bg-muted px-1">↑</kbd>{" "}
            <kbd className="rounded border bg-muted px-1">↓</kbd> to navigate
          </span>
          <span>
            <kbd className="rounded border bg-muted px-1">Enter</kbd> to select
          </span>
          <span className="ml-auto">eDMS prototype</span>
        </div>
      </Command>
    </CommandDialog>
  );
}

function CommandPaletteContent({ go }: { go: (to: string) => void }) {
  const sites = db.sites.map((s) => ({
    icon: () => <SiteIcon icon={s.icon} className="size-4" />,
    label: s.name,
    to: `/sites/${s.slug}`,
  }));
  const docs = SEARCH_INDEX.slice(0, 40).map((d) => ({
    icon: FileText,
    label: d.name,
    sub: d.siteName,
    to: `/sites/${d.site}/${d.lib}/${d.folder}`,
  }));

  return (
    <>
      <CommandGroup heading="Navigate">
        {NAV_ITEMS.map((item) => (
          <CommandItem key={item.label} value={item.label} onSelect={() => go(item.to)}>
            <item.icon />
            {item.label}
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandGroup heading="Sites">
        {sites.map((s) => (
          <CommandItem key={s.label} value={`site ${s.label}`} onSelect={() => go(s.to)}>
            <s.icon />
            {s.label}
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandGroup heading="Documents">
        {docs.map((d) => (
          <CommandItem key={`${d.to}/${d.label}`} value={`doc ${d.label}`} onSelect={() => go(d.to)}>
            <d.icon />
            <span className="truncate">{d.label}</span>
            <span className="ml-auto text-[10.5px] text-muted-foreground">{d.sub}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}
