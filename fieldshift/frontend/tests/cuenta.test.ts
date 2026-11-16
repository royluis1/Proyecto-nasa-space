import { describe, expect, it } from "vitest";
import { ACCESS_MODES, accessModeTitle, isAccessMode, otherAccessMode, type AccessMode } from "@/lib/access-mode";

describe("unified access screen (/cuenta)", () => {
  it("switches between sign in and sign up in place (same URL)", () => {
    const url = "/cuenta";
    let mode: AccessMode = ACCESS_MODES[0];
    expect(mode).toBe("signin");
    mode = otherAccessMode(mode);
    expect(mode).toBe("signup");
    mode = otherAccessMode(mode);
    expect(mode).toBe("signin");
    // no navigation happens: the URL stays the same
    expect(url).toBe("/cuenta");
  });

  it("uses the same wording style on both modes", () => {
    expect(accessModeTitle("signin")).toBe("Sign in");
    expect(accessModeTitle("signup")).toBe("Sign up");
    expect(isAccessMode("signin")).toBe(true);
    expect(isAccessMode("signup")).toBe(true);
    expect(isAccessMode("other")).toBe(false);
  });
});
