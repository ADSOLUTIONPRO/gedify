"use client";

import { useCallback, useState } from "react";

export type BulkSelectHook = {
  selectedIds: Set<string | number>;
  selectedCount: number;
  isAllSelected: boolean;
  isNoneSelected: boolean;
  isSelected: (id: string | number) => boolean;
  toggle: (id: string | number) => void;
  toggleAll: () => void;
  clearAll: () => void;
  selectAll: () => void;
};

export function useBulkSelect<T>(
  items: T[],
  getId: (item: T) => string | number,
): BulkSelectHook {
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  const isSelected = useCallback(
    (id: string | number) => selectedIds.has(id),
    [selectedIds],
  );

  const toggle = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setSelectedIds(new Set()), []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(getId)));
  }, [items, getId]);

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;
  const isNoneSelected = selectedIds.size === 0;

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      clearAll();
    } else {
      selectAll();
    }
  }, [isAllSelected, clearAll, selectAll]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isAllSelected,
    isNoneSelected,
    isSelected,
    toggle,
    toggleAll,
    clearAll,
    selectAll,
  };
}
