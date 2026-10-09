"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, FolderOpen, Folder, Settings } from "lucide-react";
import {
  getNavigation,
  getSwitcherConfig,
  type NavigationItem,
  type NavigationSection,
} from "@/components/experience/HubNavigation/navigationDefinitions";
import WorkspaceCatalog from "@/components/experience/HubNavigation/WorkspaceCatalog";

const names: Record<string, string> = {
  org_admin: "Club President",
  team_manager: "Team Manager",
  registrar: "Roster Gatekeeper",
  treasurer: "Money Manager",
  competition_manager: "Game Day Director",
  volunteer_coordinator: "Volunteer Helper",
  communications_media: "Communications",
  fundraising_coordinator: "Fundraising",
  facilities_equipment_manager: "Facilities",
};
type RoleFolder = { role: string; sections: NavigationSection[] };
type Preferences = { compact: boolean; descriptions: boolean };

export function AdminFolderNavigation() {
  const params = useSearchParams();
  const role = params.get("role") || "org_admin";
  const view = params.get("view");
  const activeFolder = params.get("folder");
  const [folders, setFolders] = useState<RoleFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFolders([]);
    setError("");
    async function load() {
      const config = await getSwitcherConfig("admin");
      const visibleRoles = config.options.filter(
        (option) =>
          names[option.id] && (role === "org_admin" || option.id === role),
      );
      if (!visibleRoles.length)
        throw new Error("No staff menus are available for this role.");
      const result = await Promise.all(
        visibleRoles.map(async (option) => ({
          role: option.id,
          sections: await getNavigation("admin", option.id),
        })),
      );
      if (!cancelled) setFolders(result);
    }
    load()
      .catch((reason) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role, retry]);
  return (
    <div aria-label="Club folders" className="space-y-3 text-white">
      <Link
        href={`/admin?${new URLSearchParams({ role })}`}
        aria-current={!view ? "page" : undefined}
        className="block rounded border border-[#30363D] bg-[#161B22] px-3 py-3 text-sm font-semibold text-orange-300"
      >
        Home · Today’s Tasks
      </Link>
      {loading && (
        <p role="status" className="p-3 text-sm text-blue-300">
          Loading role folders…
        </p>
      )}
      {error && (
        <div role="alert" className="p-3 text-sm text-red-300">
          {error}
          <button
            className="mt-2 block rounded bg-blue-700 px-3 py-2 text-white"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {folders.map((folder) => (
        <RoleDirectory
          key={`${role}:${folder.role}`}
          folder={folder}
          activeRole={role}
          activeView={view}
          activeFolder={activeFolder}
        />
      ))}
    </div>
  );
}

function RoleDirectory({
  folder,
  activeRole,
  activeView,
  activeFolder,
}: {
  folder: RoleFolder;
  activeRole: string;
  activeView: string | null;
  activeFolder: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [preferences, setPreferences] = useState<Preferences>({
    compact: false,
    descriptions: false,
  });
  const [saved, setSaved] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const storageKey = `ls1-role-navigation:${folder.role}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved)
        setPreferences({
          compact: saved.compact === true,
          descriptions: saved.descriptions === true,
        });
    } catch {
      setSaved("Saved display settings could not be loaded.");
    }
  }, [storageKey]);
  const name = names[folder.role] || folder.role.replaceAll("_", " ");
  const leaves = (items: NavigationItem[]): NavigationItem[] =>
    items.flatMap((item) => [item, ...leaves(item.children || [])]);
  const items = leaves(
    folder.sections.flatMap((section) => section.items),
  ).filter((item) => {
    if (!item.href) return false;
    return Boolean(
      new URL(item.href, "https://ls1.invalid").searchParams.get("view"),
    );
  });
  function hrefFor(href: string) {
    const url = new URL(href, "https://ls1.invalid");
    url.searchParams.set(
      "role",
      activeRole === "org_admin" ? "org_admin" : folder.role,
    );
    url.searchParams.set("folder", folder.role);
    return url.pathname + url.search;
  }
  function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
      setSaved("Display settings saved on this device.");
    } catch {
      setSaved(
        "This browser could not save your display settings. Your current choices remain in use.",
      );
    }
  }
  return (
    <section className="rounded border border-[#30363D] bg-[#161B22]">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 p-3 text-left text-sm font-semibold"
      >
        <ChevronRight
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
        {open ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-orange-300" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-orange-300" />
        )}
        {name} Directory
      </button>
      {open && (
        <div className="ml-4 border-l border-[#30363D] pb-2 pl-2 pr-1">
          {items.map((item) => {
            const href = hrefFor(item.href!);
            const active =
              (activeFolder
                ? activeFolder === folder.role
                : activeRole === folder.role) &&
              new URL(href, "https://ls1.invalid").searchParams.get("view") ===
                activeView;
            return (
              <Link
                key={item.id}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`block rounded px-2 text-sm leading-5 ${preferences.compact ? "py-1" : "py-2"} ${active ? "bg-orange-500/15 text-orange-300" : "text-white hover:bg-[#30363D]"}`}
              >
                {item.label}
                {preferences.descriptions && item.description && (
                  <span className="mt-1 block text-xs text-slate-300">
                    {item.description}
                  </span>
                )}
              </Link>
            );
          })}
          {!items.length && (
            <p className="p-2 text-sm text-amber-300">
              No workspaces enabled for this role.
            </p>
          )}
          <details className="mt-3 border-t border-[#30363D] pt-2" open>
            <summary className="cursor-pointer py-2 text-sm text-slate-300">
              Tools
            </summary>
            <button
              onClick={() => {
                setSaved("");
                dialog.current?.showModal();
              }}
              className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-[#30363D]"
            >
              <Settings className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
              {name} Settings & Customization
            </button>
            <WorkspaceCatalog
              hub="admin"
              role={folder.role}
              labelPrefix={name}
            />
          </details>
        </div>
      )}
      <dialog
        ref={dialog}
        aria-label={`${name} settings`}
        className="admin-slide-panel fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-[min(520px,94vw)] max-w-none border-l border-[#30363D] bg-[#161B22] p-6 text-white backdrop:bg-black/65"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold">{name} Settings</h2>
          <button
            onClick={() => dialog.current?.close()}
            className="rounded border border-[#30363D] px-3 py-2"
          >
            Close
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-300">
          Choose how this role’s folder looks on this device. Club permissions
          are managed in Staff and club settings.
        </p>
        <form onSubmit={save} className="mt-6 space-y-5">
          <label className="flex gap-3 text-sm">
            <input
              type="checkbox"
              checked={preferences.compact}
              onChange={(event) =>
                setPreferences((value) => ({
                  ...value,
                  compact: event.target.checked,
                }))
              }
            />
            Compact folder spacing
          </label>
          <label className="flex gap-3 text-sm">
            <input
              type="checkbox"
              checked={preferences.descriptions}
              onChange={(event) =>
                setPreferences((value) => ({
                  ...value,
                  descriptions: event.target.checked,
                }))
              }
            />
            Show workspace descriptions
          </label>
          <button className="rounded bg-emerald-700 px-4 py-2 font-semibold">
            Save settings
          </button>
          {saved && (
            <p role="status" className="text-sm text-blue-200">
              {saved}
            </p>
          )}
        </form>
      </dialog>
    </section>
  );
}
