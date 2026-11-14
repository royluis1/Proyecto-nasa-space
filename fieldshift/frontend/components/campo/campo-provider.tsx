"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAsync } from "@/hooks/use-async";
import { useDebounced } from "@/hooks/use-debounced";
import { api } from "@/lib/api";
import { rerank } from "@/lib/ranking";
import { readJson, writeJson } from "@/lib/storage";
import { DEFAULT_UI_PRIORITIES, sanitizeUiPriorities, toBackendPriorities, weightsFromUi, type UiPriorities } from "@/lib/priorities";
import type { ApiResult, CompareResult, FieldOut, Priorities, RotationEvaluation, ScoreComponentKey } from "@/types/api";

interface CampoContextValue {
  fieldId: string;
  field: FieldOut | null;
  fieldLoading: boolean;
  fieldError: string | null;
  reloadField: () => void;
  ui: UiPriorities;
  setUi: (next: UiPriorities) => void;
  backendPriorities: Priorities;
  weights: Record<ScoreComponentKey, number>;
  compare: {
    result: CompareResult | null;
    /** Ranking con los pesos actuales (se recalcula al instante al mover las prioridades). */
    evaluations: RotationEvaluation[];
    recommendedId: string | null;
    demo: boolean;
    loading: boolean;
    error: string | null;
    reload: () => void;
    warnings: string[];
    originLabel: string | null;
  };
}

const Ctx = createContext<CampoContextValue | null>(null);

export function useCampo(): CampoContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCampo debe usarse dentro de <CampoProvider>");
  return v;
}

const storageKey = (id: string) => `fieldshift:priorities:${id}`;

export function CampoProvider({ fieldId, children }: { fieldId: string; children: React.ReactNode }) {
  const fieldState = useAsync<ApiResult<FieldOut>>((signal) => api.field(fieldId, { signal }), [fieldId]);

  const [ui, setUiState] = useState<UiPriorities>(DEFAULT_UI_PRIORITIES);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setUiState(sanitizeUiPriorities(readJson(storageKey(fieldId), null)));
    setLoaded(true);
  }, [fieldId]);
  const setUi = useCallback(
    (next: UiPriorities) => {
      setUiState(next);
      writeJson(storageKey(fieldId), next);
    },
    [fieldId],
  );

  const backendPriorities = useMemo(() => toBackendPriorities(ui), [ui]);
  const weights = useMemo(() => weightsFromUi(ui), [ui]);
  // Se le pide al servidor con las prioridades "quietas" (0,5 s sin cambios); mientras tanto el ranking se recalcula acá.
  const settled = useDebounced(backendPriorities, 500);
  const settledKey = JSON.stringify(settled);

  const compareState = useAsync<ApiResult<CompareResult>>(
    (signal) => api.compare({ field_id: fieldId, priorities: settled }, { signal }),
    [fieldId, settledKey],
    loaded && fieldState.data !== null,
  );

  const result = compareState.data?.data ?? null;
  const evaluations = useMemo(() => (result ? rerank(result.evaluations, weights) : []), [result, weights]);

  const value: CampoContextValue = {
    fieldId,
    field: fieldState.data?.data ?? null,
    fieldLoading: fieldState.loading && !fieldState.data,
    fieldError: fieldState.error,
    reloadField: fieldState.reload,
    ui,
    setUi,
    backendPriorities,
    weights,
    compare: {
      result,
      evaluations,
      recommendedId: evaluations[0]?.rotation.id ?? null,
      demo: compareState.data?.demo ?? false,
      loading: compareState.loading || !loaded,
      error: compareState.error,
      reload: compareState.reload,
      warnings: compareState.data?.meta.warnings ?? [],
      originLabel: compareState.data?.meta.origin_label ?? null,
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
