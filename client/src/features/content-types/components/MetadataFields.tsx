import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseChoiceOptions } from "@/features/content-types/api";
import type { MetadataDataType, MetadataValueInput } from "@/types/api";

export interface MetadataFieldColumn {
  id: string;
  name: string;
  dataType: MetadataDataType;
  isRequired: boolean;
  choiceOptions: string | null;
}

export function MetadataFields({
  columns,
  draft,
  onChange,
}: {
  columns: MetadataFieldColumn[];
  draft: Record<string, string>;
  onChange: (columnId: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {columns.map((column) => (
        <MetadataField
          key={column.id}
          column={column}
          value={draft[column.id] ?? ""}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function MetadataField({
  column,
  value,
  onChange,
}: {
  column: MetadataFieldColumn;
  value: string;
  onChange: (columnId: string, value: string) => void;
}) {
  const label = column.name + (column.isRequired ? " *" : "");

  if (column.dataType === "Boolean") {
    return (
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={`meta-${column.id}`}>{label}</Label>
        <Checkbox
          id={`meta-${column.id}`}
          checked={value === "true"}
          onCheckedChange={(checked) => onChange(column.id, checked === true ? "true" : "false")}
        />
      </div>
    );
  }

  if (column.dataType === "Choice") {
    const options = parseChoiceOptions(column.choiceOptions);
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`meta-${column.id}`}>{label}</Label>
        <Select value={value} onValueChange={(next) => onChange(column.id, next)}>
          <SelectTrigger id={`meta-${column.id}`} className="w-full">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`meta-${column.id}`}>{label}</Label>
      <Input
        id={`meta-${column.id}`}
        type={column.dataType === "Number" ? "number" : column.dataType === "Date" ? "date" : "text"}
        value={value}
        onChange={(event) => onChange(column.id, event.target.value)}
      />
    </div>
  );
}

export function buildMetadataValues(
  columns: MetadataFieldColumn[],
  draft: Record<string, string>,
): MetadataValueInput[] {
  const values: MetadataValueInput[] = [];
  for (const column of columns) {
    const raw = (draft[column.id] ?? "").trim();
    if (column.dataType === "Boolean") {
      if (raw === "true") {
        values.push({ columnDefinitionId: column.id, value: "true" });
      }
    } else if (raw !== "") {
      values.push({ columnDefinitionId: column.id, value: raw });
    }
  }
  return values;
}

export function missingRequiredColumns(
  columns: MetadataFieldColumn[],
  draft: Record<string, string>,
): string[] {
  return columns
    .filter((column) => {
      const raw = (draft[column.id] ?? "").trim();
      return column.isRequired && (column.dataType === "Boolean" ? raw !== "true" : raw === "");
    })
    .map((column) => column.name);
}
