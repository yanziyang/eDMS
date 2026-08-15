import { useEffect, useState } from "react";
import { listGroups } from "@/features/groups/api";
import type { GroupDto } from "@/types/api";

export function AdminGroups() {
  const [groups, setGroups] = useState<GroupDto[]>([]);

  useEffect(() => {
    listGroups().then(setGroups);
  }, []);

  const orgGroups = groups.filter((group) => group.siteId === null);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Scope</th>
              <th className="px-4 py-2 font-medium">Members</th>
            </tr>
          </thead>
          <tbody>
            {orgGroups.map((group) => (
              <tr key={group.id} className="border-b last:border-0">
                <td className="px-4 py-2">{group.name}</td>
                <td className="px-4 py-2 text-muted-foreground">Organization</td>
                <td className="px-4 py-2 text-muted-foreground">{group.memberIds.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {orgGroups.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No organization-wide groups yet.</p>
      )}
    </div>
  );
}
