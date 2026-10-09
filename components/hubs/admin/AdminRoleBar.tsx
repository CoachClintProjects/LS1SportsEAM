"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getSwitcherConfig,
  type SwitcherOption,
} from "@/components/experience/HubNavigation/navigationDefinitions";

const labels: Record<string, string> = {
  org_admin: "Club President (Org Admin)",
  team_manager: "Team Manager (Squad Logistics)",
  registrar: "Roster Gatekeeper (Registrar)",
  treasurer: "Money Manager (Treasurer)",
  competition_manager: "Game Day Director",
  volunteer_coordinator: "Volunteer Helper",
  communications_media: "Communications",
  fundraising_coordinator: "Fundraising",
  facilities_equipment_manager: "Facilities",
};

export function AdminRoleBar() {
  const router = useRouter();
  const params = useSearchParams();
  const role = params.get("role") || "org_admin";
  const [options, setOptions] = useState<SwitcherOption[]>([]);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    getSwitcherConfig("admin")
      .then((config) => {
        if (cancelled) return;
        setOptions(config.options.filter((option) => labels[option.id]));
        if (!config.options.length)
          setError("Your staff roles could not be loaded.");
      })
      .catch(() => {
        if (!cancelled) setError("Your staff roles could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);
  return (
    <fieldset
      className="shrink-0 border-b border-[#30363D] bg-[#161B22] px-4 py-3 text-white"
      aria-label="UAT testing controller"
    >
      <legend className="sr-only">UAT testing controller</legend>
      <div className="flex items-center gap-5 overflow-x-auto">
        <span className="shrink-0 text-xs font-semibold text-blue-300">
          UAT TESTING CONTROLLER
        </span>
        {options.map((option) => (
          <label
            key={option.id}
            className="flex shrink-0 cursor-pointer items-center gap-2 text-sm"
          >
            <input
              type="radio"
              name="admin-role-context"
              checked={role === option.id}
              value={option.id}
              onChange={() =>
                router.replace(
                  `/admin?${new URLSearchParams({ role: option.id })}`,
                  { scroll: false },
                )
              }
              className="h-4 w-4 accent-orange-500"
            />
            {labels[option.id]}
          </label>
        ))}
        {error && (
          <span role="alert" className="text-sm text-red-300">
            {error}{" "}
            <button
              onClick={() => setRetry((value) => value + 1)}
              className="rounded bg-blue-700 px-3 py-1 text-white"
            >
              Retry
            </button>
          </span>
        )}
        {!options.length && !error && (
          <span role="status" className="text-sm text-blue-300">
            Loading staff roles…
          </span>
        )}
      </div>
    </fieldset>
  );
}
