import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CURRENT_USER, THEME_META } from "@/lib/mock-data";
import { applyTheme, db, useDb } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Profile() {
  useDb();
  const location = useLocation();
  const prefsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((location.state as { scrollTo?: string } | null)?.scrollTo === "preferences") {
      prefsRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.state]);

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader
        title="My Profile & Preferences"
        subtitle="Manage your personal information, notifications, and how eDMS looks for you."
      />

      <Card className="mb-6">
        <CardHeader>
          <div>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Visible to other people in your organization</CardDescription>
          </div>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            toast.success("Profile updated");
          }}
        >
          <CardContent>
            <div className="mb-5 flex items-center gap-4">
              <span className="flex size-[84px] items-center justify-center rounded-full bg-primary/15 text-[26px] font-semibold text-primary">
                {CURRENT_USER.initials}
              </span>
              <div>
                <Button type="button" variant="outline" size="sm">
                  Change photo
                </Button>
                <div className="mt-2 text-xs text-muted-foreground">
                  Role:{" "}
                  <Badge className="ml-1 border-transparent bg-primary/12 text-primary">
                    {CURRENT_USER.role}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label className="text-[13px]">Full name</Label>
                <Input className="mt-1.5" defaultValue={CURRENT_USER.name} />
              </div>
              <div>
                <Label className="text-[13px]">Job title</Label>
                <Input className="mt-1.5" defaultValue={CURRENT_USER.title} />
              </div>
            </div>
            <div className="mt-4">
              <Label className="text-[13px]">Email address</Label>
              <Input className="mt-1.5" type="email" defaultValue={CURRENT_USER.email} disabled />
            </div>
            <div className="mt-4">
              <Label className="text-[13px]">Department</Label>
              <Select defaultValue="IT Operations">
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {["IT Operations", "Finance", "Human Resources", "Project Phoenix", "Marketing"].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <div className="flex justify-end border-t px-5 py-4">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </Card>

      <div ref={prefsRef}>
        <Card className="mb-6">
          <CardHeader>
            <div>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Choose how eDMS looks on this device. Your choice is saved to your profile.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {THEME_META.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={cn(
                    "rounded-[calc(var(--radius)+2px)] border-2 p-2.5 text-left",
                    db.theme === t.id
                      ? "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]"
                      : "border-border"
                  )}
                  onClick={() => {
                    applyTheme(t.id);
                    toast.success(`Theme changed to ${t.name}`);
                  }}
                >
                  <div className="flex h-[72px] overflow-hidden rounded-[calc(var(--radius)-2px)] border border-black/5">
                    <div className="w-[28%]" style={{ background: t.sidebar }} />
                    <div className="flex flex-1 flex-col gap-[5px] p-2" style={{ background: t.bg }}>
                      <div className="h-1.5 w-[60%] rounded" style={{ background: t.primary }} />
                      <div className="h-1.5 w-[90%] rounded" style={{ background: t.card }} />
                      <div className="h-1.5 w-[75%] rounded" style={{ background: t.card }} />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[12.5px] font-semibold">
                    {t.name}
                    {db.theme === t.id && <Check className="size-3.5" />}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{t.desc}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Choose what you want to be notified about</CardDescription>
          </div>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            toast.success("Notification preferences saved");
          }}
        >
          <CardContent className="flex flex-col gap-4">
            <SwitchRow title="Shared with me" desc="Email when someone shares a file or folder with you" defaultChecked />
            <SwitchRow title="Followed document activity" desc="New versions, deletes, or permission changes on files you follow" defaultChecked />
            <SwitchRow title="Weekly digest" desc="A summary email every Monday morning" />
            <SwitchRow title="Storage quota warnings" desc="Only shown to Site Owners and Admins" defaultChecked />
          </CardContent>
          <div className="flex justify-end border-t px-5 py-4">
            <Button type="submit">Save preferences</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Security</CardTitle>
            <CardDescription>
              Change your password. SSO users manage their password with their identity provider.
            </CardDescription>
          </div>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            toast.success("Password changed successfully");
            e.currentTarget.reset();
          }}
        >
          <CardContent>
            <div>
              <Label className="text-[13px]">Current password</Label>
              <Input className="mt-1.5" type="password" required />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label className="text-[13px]">New password</Label>
                <Input className="mt-1.5" type="password" required />
              </div>
              <div>
                <Label className="text-[13px]">Confirm new password</Label>
                <Input className="mt-1.5" type="password" required />
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Minimum 12 characters, including a number and a symbol.
            </div>
          </CardContent>
          <div className="flex justify-end border-t px-5 py-4">
            <Button type="submit">Update password</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function SwitchRow({
  title,
  desc,
  defaultChecked = false,
}: {
  title: string;
  desc: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
