"use client";
import { useState } from "react";
import { authenticatedFetch } from "@/lib/client/authenticatedFetch";
const permissions = [
  ["parent.read", "View this athlete in Parent"],
  ["parent.respond", "Respond to competition invitations"],
  ["parent.documents", "View and upload registration documents"],
  ["parent.sign", "Sign assigned waivers"],
  ["parent.finance", "View billing as a financial guarantor"],
  ["parent.contact", "Update their own telephone details"],
];
export default function ParentAccessEditor({
  record,
  guardian,
  onSaved,
}: {
  record: any;
  guardian: any;
  onSaved: () => Promise<void>;
}) {
  const initial = record.authorities
    .filter(
      (g: any) =>
        g.person_id === guardian.person_id && g.source_type === "parent_portal" && g.status === "active",
    )
    .flatMap((g: any) => g.authority_scopes || []);
  const [scopes, setScopes] = useState<string[]>(initial),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  return (
    <section className="mt-5 border-t border-neutral-700 pt-4">
      <h4 className="font-semibold">Parent portal access</h4>
      <p className="my-2 text-sm text-neutral-400">
        Applies to this athlete only. The parent signs in with the saved
        guardian email. This does not create a login account or change custody
        rights.
      </p>
      <fieldset disabled={busy} className="space-y-2">
        {permissions.map(([id, label]) => (
          <label key={id} className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={scopes.includes(id)}
              onChange={(e) =>
                setScopes(
                  e.target.checked
                    ? [...new Set([...scopes, "parent.read", id])]
                    : id === "parent.read"
                      ? []
                      : scopes.filter((s) => s !== id),
                )
              }
            />
            {label}
          </label>
        ))}
        <button
          className="mt-3 rounded bg-blue-700 px-3 py-2"
          onClick={async () => {
            setBusy(true);
            setNotice("");
            try {
              const r = await authenticatedFetch("/api/admin-parent-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  role: "org_admin",
                  personId: record.person.id,
                  guardianId: guardian.person_id,
                  scopes,
                }),
              });
              const j = await r.json();
              if (!r.ok) throw Error(j.error);
              await onSaved();
              setNotice("Parent access saved.");
            } catch (e) {
              setNotice(
                e instanceof Error ? e.message : "Unable to save access.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save parent access"}
        </button>
      </fieldset>
      {notice && (
        <p role="status" className="mt-2 text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
