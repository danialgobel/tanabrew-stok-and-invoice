import { describe, it, expect } from "vitest";
import {
  isMasterDeveloper,
  isDeveloperRole,
  isOwnerRole,
  isAdminRole,
  canPrintDocument,
  canModifyInvoice,
  getCleanRoleLabel,
} from "@/lib/roleUtils";

describe("roleUtils - Tanabrew Supreme Access", () => {
  it("identifies master developer by email regardless of casing", () => {
    expect(isMasterDeveloper("danialgobel26@gmail.com")).toBe(true);
    expect(isMasterDeveloper("DanialGobel26@gmail.com ")).toBe(true);
    expect(isMasterDeveloper("tanabrewofficial@gmail.com")).toBe(true);
    expect(isMasterDeveloper("other@gmail.com")).toBe(false);
    expect(isMasterDeveloper(null)).toBe(false);
  });

  it("grants full developer role by role alias or email", () => {
    expect(isDeveloperRole("webdev")).toBe(true);
    expect(isDeveloperRole("developer")).toBe(true);
    expect(isDeveloperRole("dev")).toBe(true);
    expect(isDeveloperRole("godmode")).toBe(true);
    expect(isDeveloperRole("WEBDEV")).toBe(true);
    expect(isDeveloperRole("Developer")).toBe(true);
    // Even if role is staff, master developer email gets developer privilege
    expect(isDeveloperRole("staff", "danialgobel26@gmail.com")).toBe(true);
    expect(isDeveloperRole("staff", "other@gmail.com")).toBe(false);
  });

  it("developer satisfies owner role unconditionally", () => {
    expect(isOwnerRole("developer")).toBe(true);
    expect(isOwnerRole("webdev")).toBe(true);
    expect(isOwnerRole("owner")).toBe(true);
    expect(isOwnerRole("admin")).toBe(false);
    expect(isOwnerRole("staff")).toBe(false);
    expect(isOwnerRole("staff", "danialgobel26@gmail.com")).toBe(true);
  });

  it("developer satisfies admin role unconditionally", () => {
    expect(isAdminRole("developer")).toBe(true);
    expect(isAdminRole("webdev")).toBe(true);
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("staff")).toBe(false);
  });

  it("allows document printing for developer, owner, and admin", () => {
    expect(canPrintDocument("developer")).toBe(true);
    expect(canPrintDocument("webdev")).toBe(true);
    expect(canPrintDocument("owner")).toBe(true);
    expect(canPrintDocument("admin")).toBe(true);
    expect(canPrintDocument("staff", "danialgobel26@gmail.com")).toBe(true);
    expect(canPrintDocument("staff")).toBe(false);
  });

  it("allows invoice modification and deletion for developer and owner", () => {
    expect(canModifyInvoice("developer")).toBe(true);
    expect(canModifyInvoice("webdev")).toBe(true);
    expect(canModifyInvoice("owner")).toBe(true);
    expect(canModifyInvoice("admin")).toBe(false);
    expect(canModifyInvoice("staff")).toBe(false);
  });

  it("provides clean role labels", () => {
    expect(getCleanRoleLabel("webdev")).toBe("Developer");
    expect(getCleanRoleLabel("developer")).toBe("Developer");
    expect(getCleanRoleLabel("owner")).toBe("Owner");
    expect(getCleanRoleLabel("admin")).toBe("Admin");
    expect(getCleanRoleLabel("staff")).toBe("Staff");
    expect(getCleanRoleLabel("staff", "danialgobel26@gmail.com")).toBe("Developer");
  });
});
