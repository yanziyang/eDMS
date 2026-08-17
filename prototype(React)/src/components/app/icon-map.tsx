import type { LucideIcon } from "lucide-react";
import {
  Bell,
  History,
  Landmark,
  Megaphone,
  Rocket,
  Server,
  Share2,
  Trash2,
  TriangleAlert,
  UserPlus,
  Users,
  type LucideProps,
} from "lucide-react";

export const SITE_ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  users: Users,
  rocket: Rocket,
  server: Server,
  megaphone: Megaphone,
};

export function SiteIcon({
  icon,
  className,
  style,
}: {
  icon: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = SITE_ICONS[icon] ?? Landmark;
  return <Icon className={className} style={style} />;
}

export const NOTIF_ICONS: Record<string, LucideIcon> = {
  share: Share2,
  history: History,
  userPlus: UserPlus,
  alertTriangle: TriangleAlert,
  trash: Trash2,
};

export function NotifIcon({
  icon,
  ...props
}: { icon: string } & LucideProps) {
  const Icon = NOTIF_ICONS[icon] ?? Bell;
  return <Icon {...props} />;
}
