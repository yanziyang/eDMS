import type { ReactNode } from "react";
import { Lock, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CURRENT_USER } from "@/lib/mock-data";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.015em]">{title}</h1>
        {subtitle && <div className="mt-1 text-[13px] text-muted-foreground">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  up,
  icon,
}: {
  label: string;
  value: ReactNode;
  delta: ReactNode;
  up?: boolean;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border bg-card p-[1.1rem_1.25rem]">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        <span className="flex size-[34px] items-center justify-center rounded-[9px] bg-accent text-accent-foreground">
          {icon}
        </span>
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-[-0.01em]">{value}</div>
      <div className={cn("mt-1.5 flex items-center gap-1 text-[11.5px] text-muted-foreground", up && "text-success")}>
        {delta}
      </div>
    </div>
  );
}

export function CheckoutBadge({ checkedOutBy }: { checkedOutBy?: string | null }) {
  if (!checkedOutBy) return null;
  const mine = checkedOutBy === CURRENT_USER.name;
  return (
    <TooltippedBadge
      label={`Checked out by ${checkedOutBy}`}
      className={mine ? "bg-warning-soft text-warning" : "bg-secondary text-secondary-foreground"}
    >
      <Lock data-icon className="size-3" />
      {mine ? "You" : checkedOutBy.split(" ")[0]}
    </TooltippedBadge>
  );
}

function TooltippedBadge({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("h-auto border-transparent py-0.5 text-[11px]", className)}>
          {children}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TagBadges({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex gap-1">
      {tags.map((t) => (
        <Badge key={t} variant="secondary">
          {t}
        </Badge>
      ))}
    </div>
  );
}

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "inline-flex size-[26px] shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10.5px] font-semibold text-primary",
        className
      )}
    >
      {initials}
    </span>
  );
}

export function NameWithAvatar({
  name,
  sub,
  className,
}: {
  name: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5 font-medium", className)}>
      {typeof name === "string" ? <UserAvatar name={name} /> : null}
      <div className="min-w-0">
        <div className="truncate text-[13.3px] font-medium leading-tight">{name}</div>
        {sub && <div className="text-[11.5px] font-normal text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const variant =
    role === "System Administrator"
      ? "bg-primary/12 text-primary border-transparent"
      : role === "Site Owner"
        ? "bg-warning-soft text-warning border-transparent"
        : "bg-secondary text-secondary-foreground border-transparent";
  return (
    <Badge variant="outline" className={cn("border-transparent", variant)}>
      {role}
    </Badge>
  );
}

export function GroupBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", type === "Custom group" ? "bg-primary/12 text-primary" : "bg-secondary text-secondary-foreground")}>
      {type}
    </Badge>
  );
}

export function AuditBadge({ action }: { action: string }) {
  let cls = "bg-secondary text-secondary-foreground border-transparent";
  if (action === "Delete") cls = "bg-destructive/12 text-destructive border-transparent";
  else if (["Upload", "CheckIn", "Restore"].includes(action)) cls = "bg-success-soft text-success border-transparent";
  else if (["PermissionChange", "Share"].includes(action)) cls = "bg-warning-soft text-warning border-transparent";
  return (
    <Badge variant="outline" className={cn("border-transparent", cls)}>
      {action}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "Archived") return <Badge variant="outline">{status}</Badge>;
  return (
    <Badge variant="outline" className="border-transparent bg-success-soft text-success">
      {status}
    </Badge>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h3 className="mb-1.5 text-[14.5px] font-semibold">{title}</h3>
      <p className="mb-4 max-w-[32ch] text-[12.8px] text-muted-foreground">{description}</p>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function AlertBanner({
  icon,
  variant,
  title,
  children,
}: {
  icon: ReactNode;
  variant: "info" | "warning";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-[var(--radius)] border px-4 py-3 text-[13px]",
        variant === "info"
          ? "border-accent bg-accent text-accent-foreground"
          : "border-warning-soft bg-warning-soft text-warning"
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        {title && <div className="mb-0.5 font-semibold">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function PillTabs({ items }: { items: { to: string; label: string; active: boolean }[] }) {
  return (
    <div className="mb-4 inline-flex gap-0.5 rounded-[calc(var(--radius)-2px)] bg-muted p-0.5">
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          className={cn(
            "rounded-[calc(var(--radius)-4px)] px-3 py-1 text-[12.5px] font-medium text-muted-foreground",
            it.active && "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
          )}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

export function RemoveBadgeButton({ onRemove }: { onRemove?: () => void }) {
  return (
    <Button variant="ghost" size="icon-xs" className="text-muted-foreground" onMouseDown={onRemove} aria-label="Remove">
      <X />
    </Button>
  );
}
