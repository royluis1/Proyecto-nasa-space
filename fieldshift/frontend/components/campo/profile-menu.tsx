"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PROFILE_MENU_EVENT,
  readProfileMenuState,
  resolveActiveProfileMenuId,
  saveProfileMenuState,
  submenuForActiveProfileMenuId,
  type ProfileMenuState,
} from "@/lib/profile-menu";

type LeafItem = {
  id: string;
  label: string;
  href?: string; // relative to /campo/[id] or absolute hash on perfil
  placeholder?: boolean;
};

type SubmenuItem = {
  id: "profile" | "tools";
  label: string;
  children: LeafItem[];
};

type TopItem = { id: "information"; label: string; href?: string; placeholder?: boolean };

type MenuEntry = SubmenuItem | TopItem;

function buildMenu(fieldId: string): MenuEntry[] {
  const base = `/campo/${fieldId}`;
  return [
    {
      id: "profile",
      label: "Profile",
      children: [
        { id: "priority-editor", label: "Priority editor", href: `${base}/perfil#prioridades` },
        { id: "view-rotation-plan", label: "View my rotation plan", href: `${base}/comparador` },
      ],
    },
    {
      id: "tools",
      label: "Tools",
      children: [
        { id: "compare", label: "Compare current vs. another", href: `${base}/comparador` },
        { id: "alerts", label: "Alerts", href: `${base}/alertas` },
        { id: "calendar", label: "Calendar", href: `${base}/calendario` },
        { id: "history", label: "History", href: `${base}/historial` },
        { id: "scenarios", label: "Scenarios", href: `${base}/escenarios` },
        { id: "comparative-dashboard", label: "Comparative dashboard", href: `${base}/dashboard` },
        { id: "campaigns", label: "Campaigns", placeholder: true },
      ],
    },
    { id: "information", label: "Information", href: `/metodologia` },
  ];
}

function isSubmenu(item: MenuEntry): item is SubmenuItem {
  return item.id === "profile" || item.id === "tools";
}

// resolution helpers imported from lib/profile-menu for testability

function MenuTree({
  fieldId,
  onNavigate,
}: {
  fieldId: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const menu = useMemo(() => buildMenu(fieldId), [fieldId]);
  const [hash, setHash] = useState<string>("");
  const [state, setState] = useState<ProfileMenuState>(() => readProfileMenuState());

  useEffect(() => {
    const sync = () => setState(readProfileMenuState());
    window.addEventListener(PROFILE_MENU_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROFILE_MENU_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const updateHash = () => setHash(typeof window !== "undefined" ? window.location.hash || "" : "");
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  const activeId = resolveActiveProfileMenuId(pathname, fieldId, hash);

  // Persist active section and ensure its submenu is open on route changes.
  useEffect(() => {
    const containing = submenuForActiveProfileMenuId(activeId);
    setState((prev) => {
      const next: ProfileMenuState = {
        openSubmenu: containing ?? prev.openSubmenu,
        activeSection: activeId,
      };
      if (prev.openSubmenu === next.openSubmenu && prev.activeSection === next.activeSection) return prev;
      saveProfileMenuState(next);
      return next;
    });
  }, [activeId, menu]);

  const toggleSubmenu = (id: "profile" | "tools") => {
    setState((prev) => {
      const next: ProfileMenuState = {
        ...prev,
        openSubmenu: prev.openSubmenu === id ? null : id,
      };
      saveProfileMenuState(next);
      return next;
    });
  };

  return (
    <nav aria-label="Profile menu" className="space-y-1">
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">≡ Menu</p>
      {menu.map((item) => {
        if (isSubmenu(item)) {
          const open = state.openSubmenu === item.id;
          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => toggleSubmenu(item.id)}
                aria-expanded={open}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm font-medium hover:bg-accent"
              >
                <span>{item.label}</span>
                <ChevronDown
                  aria-hidden
                  className={cn("size-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
                />
              </button>
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <ul className="ml-2 space-y-0.5 border-l border-border/60 py-1 pl-2">
                    {item.children.map((child) => {
                      const active = activeId === child.id;
                      const content = (
                        <span className="flex items-center justify-between gap-2">
                          <span>{child.label}</span>
                          {child.placeholder && (
                            <Badge variant="secondary" className="text-[10px] font-normal">Coming soon</Badge>
                          )}
                        </span>
                      );
                      if (child.placeholder || !child.href) {
                        return (
                          <li key={child.id}>
                            <span
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "flex min-h-9 items-center rounded-md px-2 text-sm text-muted-foreground",
                                active && "bg-secondary text-foreground",
                              )}
                            >
                              {content}
                            </span>
                          </li>
                        );
                      }
                      return (
                        <li key={child.id}>
                          <Link
                            href={child.href}
                            onClick={onNavigate}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex min-h-9 items-center rounded-md px-2 text-sm hover:bg-accent",
                              active && "bg-primary text-primary-foreground hover:bg-primary/90",
                            )}
                          >
                            {content}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          );
        }
        const active = activeId === item.id;
        return (
          <div key={item.id}>
            {item.placeholder || !("href" in item) || !item.href ? (
              <span className={cn("flex min-h-9 items-center rounded-md px-2 text-sm text-muted-foreground", active && "bg-secondary text-foreground")}>
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center rounded-md px-2 text-sm font-medium hover:bg-accent",
                  active && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function ProfileMenuSidebar({ fieldId }: { fieldId: string }) {
  return (
    <aside className="hidden w-64 shrink-0 lg:block print:hidden">
      <div className="sticky top-20 rounded-xl border border-border/60 bg-card p-3 shadow-soft">
        <MenuTree fieldId={fieldId} />
      </div>
    </aside>
  );
}

export function ProfileMenuMobile({ fieldId }: { fieldId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden print:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-2">
            <Menu aria-hidden className="size-4" /> Menu
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="mt-6">
            <MenuTree fieldId={fieldId} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Backward-compatible combined render (desktop sidebar + mobile trigger)
export function ProfileMenu({ fieldId }: { fieldId: string }) {
  return (
    <>
      <ProfileMenuSidebar fieldId={fieldId} />
      <ProfileMenuMobile fieldId={fieldId} />
    </>
  );
}
