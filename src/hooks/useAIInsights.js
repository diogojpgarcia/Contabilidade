/**
 * useAIInsights — análise financeira gerada LOCALMENTE no dispositivo.
 *
 * Não faz chamadas de rede nem usa chaves de API: compõe a análise a partir do
 * resumo (buildInsightsSummary) com generateLocalAnalysis. Grátis, instantânea,
 * offline e privada (os dados nunca saem do dispositivo).
 *
 * Mantém a assinatura { data, loading, error, refresh } para os consumidores
 * (AIInsightsPanel, ExportModal) não precisarem de mudar.
 */
import { useMemo } from 'react';
import { generateLocalAnalysis } from '../utils/localInsights';

export function useAIInsights(summary) {
  const data = useMemo(
    () => (summary ? generateLocalAnalysis(summary) : null),
    [summary],
  );
  return { data, loading: false, error: null, refresh: () => {} };
}
