import { useState } from "react";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/app/admin-page";
import { AuditBadge, PageHeader, UserAvatar } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportCsv } from "@/lib/helpers";
import { AUDIT_ACTIONS, AUDIT_LOG } from "@/lib/mock-data";

export function AdminAuditLog() {
  const [actionFilter, setActionFilter] = useState("all");
  const [query, setQuery] = useState("");

  const q = query.toLowerCase();
  const filtered = AUDIT_LOG.filter(
    (a) =>
      (actionFilter === "all" || a.action === actionFilter) &&
      (!q || a.user.toLowerCase().includes(q) || a.object.toLowerCase().includes(q) || a.site.toLowerCase().includes(q))
  );

  return (
    <AdminPage title="Audit Log">
      <PageHeader
        title="Audit log"
        subtitle="Every upload, download, permission change, and sign-in is recorded and immutable."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              exportCsv(
                "edms-audit-log.csv",
                [
                  ["Time", "User", "Action", "Object", "Site", "IP"],
                  ...AUDIT_LOG.map((a) => [a.time, a.user, a.action, a.object, a.site, a.ip]),
                ]
              );
              toast.success("Audit log exported", { description: "edms-audit-log.csv" });
            }}
          >
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex-wrap gap-3">
          <div className="flex flex-wrap gap-2">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-8 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All actions</SelectItem>
                  {AUDIT_ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <InputGroup className="h-8 w-[240px]">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search user, object, site…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </InputGroup>
          </div>
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {AUDIT_LOG.length} events
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t">
            <Table className="text-[13.3px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Object</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>IP address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a, i) => (
                  <TableRow key={a.time + a.user + i}>
                    <TableCell className="text-muted-foreground">{a.time}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5 font-medium">
                        <UserAvatar name={a.user} />
                        <span>{a.user}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AuditBadge action={a.action} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.object}</TableCell>
                    <TableCell className="text-muted-foreground">{a.site}</TableCell>
                    <TableCell className="text-muted-foreground">{a.ip}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AdminPage>
  );
}
