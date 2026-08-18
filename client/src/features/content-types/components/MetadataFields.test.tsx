import { describe, expect, it } from "vitest";
import {
  buildMetadataValues,
  missingRequiredColumns,
  type MetadataFieldColumn,
} from "./MetadataFields";

const textColumn: MetadataFieldColumn = {
  id: "c-title",
  name: "Title",
  dataType: "Text",
  isRequired: true,
  choiceOptions: null,
};

const booleanColumn: MetadataFieldColumn = {
  id: "c-active",
  name: "Active",
  dataType: "Boolean",
  isRequired: false,
  choiceOptions: null,
};

const optionalText: MetadataFieldColumn = {
  id: "c-notes",
  name: "Notes",
  dataType: "Text",
  isRequired: false,
  choiceOptions: null,
};

describe("buildMetadataValues", () => {
  it("builds values for filled non-boolean fields and true booleans", () => {
    expect(
      buildMetadataValues([textColumn, booleanColumn, optionalText], {
        "c-title": "  Draft  ",
        "c-active": "true",
      }),
    ).toEqual([
      { columnDefinitionId: "c-title", value: "Draft" },
      { columnDefinitionId: "c-active", value: "true" },
    ]);
  });

  it("skips blank non-boolean fields and non-true booleans", () => {
    expect(
      buildMetadataValues([textColumn, booleanColumn, optionalText], {
        "c-title": "",
        "c-active": "false",
        "c-notes": "   ",
      }),
    ).toEqual([]);
  });
});

describe("missingRequiredColumns", () => {
  it("reports required columns that are missing or blank", () => {
    expect(missingRequiredColumns([textColumn, booleanColumn], {})).toEqual(["Title"]);
    expect(missingRequiredColumns([textColumn, booleanColumn], { "c-title": "x" })).toEqual([]);
  });

  it("treats a required boolean as missing unless it is true", () => {
    const requiredBoolean: MetadataFieldColumn = { ...booleanColumn, isRequired: true };
    expect(missingRequiredColumns([requiredBoolean], { "c-active": "false" })).toEqual(["Active"]);
    expect(missingRequiredColumns([requiredBoolean], { "c-active": "true" })).toEqual([]);
  });
});