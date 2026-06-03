"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";

type ProjectArchiveButtonProps = {
  projectId: string;
};

export function ProjectArchiveButton({ projectId }: ProjectArchiveButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function archiveProject() {
    setLoading(true);

    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Archivé" }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={archiveProject}
      disabled={loading}
      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
      ) : (
        <Archive className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      )}
      Archiver
    </button>
  );
}
