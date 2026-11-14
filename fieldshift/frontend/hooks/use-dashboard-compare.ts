"use client";

import { useMemo } from "react";
import { useCampo } from "@/components/campo/campo-provider";
import { useAsync } from "@/hooks/use-async";
import { useDebounced } from "@/hooks/use-debounced";
import { api } from "@/lib/api";
import { rerank } from "@/lib/ranking";
import type { ApiResult, CompareResult, ScenarioInput } from "@/types/api";

/**
 * Ranking del dashboard para un escenario. Sin escenario (clima del período y sin riego extra) reutiliza el del campo,
 * sin pedir nada de nuevo; con escenario lo pide al servidor. En los dos casos el total sigue las prioridades al instante.
 */
export function useDashboardCompare(scenario: ScenarioInput | null) {
  const { fieldId, backendPriorities, weights, compare } = useCampo();
  const settled = useDebounced(backendPriorities, 500);
  const key = `${JSON.stringify(settled)}|${JSON.stringify(scenario)}`;
  const own = useAsync<ApiResult<CompareResult>>(
    (signal) => api.compare({ field_id: fieldId, priorities: settled, scenario }, { signal }),
    [fieldId, key],
    scenario !== null,
  );
  const useOwn = scenario !== null;
  const result = useOwn ? (own.data?.data ?? null) : compare.result;
  const evaluations = useMemo(() => (result ? rerank(result.evaluations, weights) : []), [result, weights]);
  return {
    result,
    evaluations,
    demo: useOwn ? (own.data?.demo ?? false) : compare.demo,
    loading: useOwn ? own.loading : compare.loading,
    error: useOwn ? own.error : compare.error,
    reload: useOwn ? own.reload : compare.reload,
    warnings: useOwn ? (own.data?.meta.warnings ?? []) : compare.warnings,
    originLabel: useOwn ? (own.data?.meta.origin_label ?? null) : compare.originLabel,
  };
}
