import { describe, expect, it } from "vitest";
import {
  deserializeFilterConfig,
  deserializeSortConfig,
  serializeFilterConfig,
  serializeSortConfig,
} from "./config";

describe("library view config serialization", () => {
  it("round-trips filter and sort settings without loss", () => {
    const filter = { text: "Quarterly policy / active" };
    const sort = { key: "modifiedAt" as const, descending: true };

    expect(deserializeFilterConfig(serializeFilterConfig(filter))).toEqual(filter);
    expect(deserializeSortConfig(serializeSortConfig(sort))).toEqual(sort);
  });
});
