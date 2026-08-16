import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getAdminSettings, updateAdminSettings } from "@/features/admin/api";
import { queryKeys } from "@/lib/queryKeys";

const MB = 1024 * 1024;

export function AdminSettings() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: queryKeys.admin.settings(),
    queryFn: getAdminSettings,
  });

  const [maxUploadMb, setMaxUploadMb] = useState("");
  const [retentionDays, setRetentionDays] = useState("");
  const [restrictCreation, setRestrictCreation] = useState(false);
  const [formLoaded, setFormLoaded] = useState(false);

  useEffect(() => {
    if (settings.data && !formLoaded) {
      setMaxUploadMb(String(Math.round(settings.data.maxUploadSizeBytes / MB)));
      setRetentionDays(String(settings.data.recycleBinRetentionDays));
      setRestrictCreation(settings.data.siteCreationRestricted);
      setFormLoaded(true);
    }
  }, [settings.data, formLoaded]);

  const save = useMutation({
    mutationFn: () =>
      updateAdminSettings({
        maxUploadSizeBytes: Number(maxUploadMb) * MB,
        recycleBinRetentionDays: Number(retentionDays),
        siteCreationRestricted: restrictCreation,
      }),
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.settings() });
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const maxUploadValid = maxUploadMb.trim() !== "" && Number(maxUploadMb) > 0;
  const retentionValid = retentionDays.trim() !== "" && Number(retentionDays) > 0;
  const saveDisabled = !maxUploadValid || !retentionValid || save.isPending;

  if (settings.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading.</div>;
  }

  if (settings.isError) {
    return <div className="text-sm text-destructive">Failed to load settings.</div>;
  }

  if (!settings.data) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        No settings are available.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="rounded-lg border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="text-base font-medium">Uploads &amp; storage</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Controls enforced server-side on every upload.
        </p>

        <div className="mt-4 grid max-w-md gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="max-upload-mb">Max file size (MB)</Label>
            <Input
              id="max-upload-mb"
              type="number"
              min={1}
              value={maxUploadMb}
              onChange={(event) => setMaxUploadMb(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="retention-days">Recycle Bin retention (days)</Label>
            <Input
              id="retention-days"
              type="number"
              min={1}
              value={retentionDays}
              onChange={(event) => setRetentionDays(event.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Restrict site creation</div>
              <div className="text-xs text-muted-foreground">
                Only system administrators can create new sites.
              </div>
            </div>
            <Switch
              id="restrict-site-creation"
              aria-label="Restrict site creation"
              checked={restrictCreation}
              onCheckedChange={setRestrictCreation}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button type="submit" disabled={saveDisabled}>
            {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
            Save
          </Button>
          {save.isPending && (
            <span className="text-sm text-muted-foreground">Saving…</span>
          )}
        </div>
      </form>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-base font-medium">Session &amp; security</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Applies to local database authentication.
        </p>
        <dl className="mt-4 grid max-w-md grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Application name</dt>
            <dd className="mt-0.5 font-medium">{settings.data.appName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Access token lifetime (minutes)</dt>
            <dd className="mt-0.5 font-medium">{settings.data.accessTokenLifetimeMinutes}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Refresh token lifetime (days)</dt>
            <dd className="mt-0.5 font-medium">{settings.data.refreshTokenLifetimeDays}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
