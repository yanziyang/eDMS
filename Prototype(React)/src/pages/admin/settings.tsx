import { Globe, Key, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/app/admin-page";
import { PageHeader } from "@/components/app/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Settings saved");
        }}
      >
        {children}
        <div className="flex justify-end border-t px-5 py-4">
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Card>
  );
}

export function AdminSettings() {
  return (
    <AdminPage title="Settings">
      <PageHeader
        title="System settings"
        subtitle="Organization-wide configuration for eDMS."
      />

      <SettingsCard title="General" description="Branding shown across the application">
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label className="text-[13px]">Application name</Label>
              <Input className="mt-1.5" defaultValue="eDMS" />
            </div>
            <div>
              <Label className="text-[13px]">Support email</Label>
              <Input className="mt-1.5" defaultValue="it-support@edms-demo.local" />
            </div>
          </div>
        </CardContent>
      </SettingsCard>

      <SettingsCard title="Uploads & storage" description="Controls enforced server-side on every upload">
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label className="text-[13px]">Max file size (MB)</Label>
              <Input className="mt-1.5" type="number" defaultValue={250} />
            </div>
            <div>
              <Label className="text-[13px]">Recycle Bin retention (days)</Label>
              <Input className="mt-1.5" type="number" defaultValue={90} />
            </div>
          </div>
          <div className="mt-4">
            <Label className="text-[13px]">Blocked file extensions</Label>
            <Input className="mt-1.5" defaultValue=".exe, .bat, .cmd, .msi, .scr" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Require check-out before editing</div>
              <div className="text-xs text-muted-foreground">Default for newly created libraries</div>
            </div>
            <Switch />
          </div>
        </CardContent>
      </SettingsCard>

      <SettingsCard title="Session & security" description="Applies to local database authentication">
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label className="text-[13px]">Access token lifetime (minutes)</Label>
              <Input className="mt-1.5" type="number" defaultValue={15} />
            </div>
            <div>
              <Label className="text-[13px]">Refresh token lifetime (days)</Label>
              <Input className="mt-1.5" type="number" defaultValue={7} />
            </div>
            <div>
              <Label className="text-[13px]">Failed login lockout threshold</Label>
              <Input className="mt-1.5" type="number" defaultValue={5} />
            </div>
            <div>
              <Label className="text-[13px]">Lockout duration (minutes)</Label>
              <Input className="mt-1.5" type="number" defaultValue={15} />
            </div>
          </div>
        </CardContent>
      </SettingsCard>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Authentication providers</CardTitle>
            <CardDescription>
              Database authentication is enabled by default. SSO federation is on the roadmap.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <AuthProviderRow
            icon={<Key className="size-4" />}
            name="Database authentication"
            desc="Email + password, managed in eDMS"
            badge={<Badge className="border-transparent bg-success-soft text-success">Enabled</Badge>}
          />
          <AuthProviderRow
            dimmed
            icon={<ShieldCheck className="size-4" />}
            name="SAML 2.0"
            desc="Federate with your identity provider"
            badge={<Badge variant="outline">Planned</Badge>}
          />
          <AuthProviderRow
            dimmed
            icon={<Globe className="size-4" />}
            name="OpenID Connect (OIDC)"
            desc="Sign in with Azure AD, Okta, or Google Workspace"
            badge={<Badge variant="outline">Planned</Badge>}
          />
        </CardContent>
      </Card>
    </AdminPage>
  );
}

function AuthProviderRow({
  icon,
  name,
  desc,
  badge,
  dimmed,
}: {
  icon: React.ReactNode;
  name: string;
  desc: string;
  badge: React.ReactNode;
  dimmed?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-[var(--radius)] border p-3"
      style={dimmed ? { opacity: 0.6 } : undefined}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      {badge}
    </div>
  );
}
