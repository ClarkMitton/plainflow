import { describe, expect, it } from "vitest";
import { nameWarning } from "./names";

describe("name-like input", () => {
  it("flags names, titles and contacts", () => {
    expect(nameWarning("Sarah Jones")).toBeTruthy();
    expect(nameWarning("Mrs Patel's class")).toBeTruthy();
    expect(nameWarning("ask jo.bloggs@college.ac.uk")).toBeTruthy();
  });
  it("leaves roles, groups and products alone", () => {
    expect(nameWarning("Student work")).toBeNull();
    expect(nameWarning("Microsoft 365 Copilot")).toBeNull();
    expect(nameWarning("Level 3 group")).toBeNull();
    expect(nameWarning("OpenAI via Azure")).toBeNull();
  });
});
