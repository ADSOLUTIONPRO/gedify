import { Search } from "lucide-react";

type SearchInputProps = {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
};

export function SearchInput({
  name = "query",
  defaultValue,
  placeholder = "Rechercher...",
  label = "Recherche",
}: SearchInputProps) {
  return (
    <label className="block w-full">
      <span
        className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <div className="relative flex h-10 w-full items-center">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 h-4 w-4"
          style={{ color: "var(--text-muted)" }}
          strokeWidth={1.75}
        />
        <input
          type="search"
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="h-full w-full rounded-xl border bg-white pl-9 pr-3 text-sm font-medium outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        />
      </div>
    </label>
  );
}
