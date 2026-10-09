"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RecordLifecycle } from "./RecordLifecycle";
export function AdminDrawerShell({
  title,
  busy = false,
  onClose,
  children,
  recordStatus,
}: {
  title: string;
  busy?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  recordStatus?: string;
}) {
  const root = useRef<HTMLElement>(null),
    close = useRef(onClose),
    blocked = useRef(busy);
  close.current = onClose;
  blocked.current = busy;
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (!root.current?.contains(document.activeElement)) return;
      if (e.key === "Escape" && !blocked.current) {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const all = root.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
        );
        if (!all.length) return;
        const first = all[0],
          last = all[all.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === root.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      prior?.focus();
    };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/70">
      <aside
        ref={root}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="admin-slide-panel ml-auto h-full w-full max-w-5xl overflow-y-auto border-l border-[#30363D] bg-[#161B22] p-6 text-white"
      >
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button
            disabled={busy}
            onClick={onClose}
            className="rounded border border-neutral-500 px-3 py-2 disabled:opacity-40"
          >
            Close
          </button>
        </header>
        {recordStatus && <RecordLifecycle status={recordStatus} />}
        {children}
      </aside>
    </div>,
    document.body,
  );
}
