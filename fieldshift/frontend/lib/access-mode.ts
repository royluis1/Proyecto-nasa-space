/** Unified access screen modes. Switching happens in client state: the URL never changes. */
export const ACCESS_MODES = ["signin", "signup"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

export const otherAccessMode = (mode: AccessMode): AccessMode => (mode === "signin" ? "signup" : "signin");

export const accessModeTitle = (mode: AccessMode): string => (mode === "signin" ? "Sign in" : "Sign up");

export const isAccessMode = (v: unknown): v is AccessMode => v === "signin" || v === "signup";
