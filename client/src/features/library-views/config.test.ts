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

  it("falls back to defaults for malformed or partial config", () => {
    expect(deserializeFilterConfig("not-json")).toEqual({ text: "" });
    expect(deserializeFilterConfig('{"text": 42}')).toEqual({ text: "" });
    expect(deserializeSortConfig("not-json")).toEqual({ key: "name", descending: false });
    expect(deserializeSortConfig('{"key": "bogus", "descending": true}')).toEqual({
      key: "name",
      descending: false,
    });
  });
});
