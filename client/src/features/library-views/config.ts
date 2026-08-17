export type LibraryViewSortKey = "name" | "size" | "modifiedAt";
export type LibraryViewGroupBy = "none" | "kind";

export interface LibraryViewFilterConfig {
  text: string;
}

export interface LibraryViewSortConfig {
  key: LibraryViewSortKey;
  descending: boolean;
}

const defaultFilterConfig: LibraryViewFilterConfig = { text: "" };
const defaultSortConfig: LibraryViewSortConfig = { key: "name", descending: false };

export function serializeFilterConfig(config: LibraryViewFilterConfig): string {
  return JSON.stringify(config);
}

export function deserializeFilterConfig(serialized: string): LibraryViewFilterConfig {
  try {
    const parsed = JSON.parse(serialized) as Partial<LibraryViewFilterConfig>;
    return { text: typeof parsed.text === "string" ? parsed.text : defaultFilterConfig.text };
  } catch {
    return { ...defaultFilterConfig };
  }
}

export function serializeSortConfig(config: LibraryViewSortConfig): string {
  return JSON.stringify(config);
}

export function deserializeSortConfig(serialized: string): LibraryViewSortConfig {
  try {
    const parsed = JSON.parse(serialized) as Partial<LibraryViewSortConfig>;
    const key = parsed.key;
    return {
      key: key === "name" || key === "size" || key === "modifiedAt" ? key : defaultSortConfig.key,
      descending: parsed.descending === true,
    };
  } catch {
    return { ...defaultSortConfig };
  }
}
