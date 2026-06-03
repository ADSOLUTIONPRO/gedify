type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = "Chargement en cours" }: LoadingStateProps) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="h-10 w-full rounded-xl bg-slate-100" />
        <div className="h-10 w-3/4 rounded-xl bg-slate-100" />
      </div>
      <p className="sr-only">{label}</p>
    </div>
  );
}
