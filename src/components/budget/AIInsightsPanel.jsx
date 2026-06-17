/**
 * AIInsightsPanel — análise financeira profunda gerada por IA (Claude),
 * apresentada na zona "Visão Geral" do StatsTab.
 *
 * Recebe o resumo anonimizado (buildInsightsSummary) e os insights regra-a-regra
 * e chama o endpoint /api/insights através do hook useAIInsights. Mostra estados
 * de loading / erro / vazio de forma graciosa.
 */
import React, { useState } from 'react';
import { Sparkles, RefreshCw, TrendingUp, CheckCircle2, AlertTriangle, Target } from 'lucide-react';
import { useAIInsights } from '../../hooks/useAIInsights';
import './AIInsightsPanel.css';

const AIInsightsPanel = ({ summary, behavioralInsights = [] }) => {
  const { data, loading, error, refresh } = useAIInsights(summary, behavioralInsights);
  const [showDetail, setShowDetail] = useState(false);

  // Sem dados suficientes no mês → não mostrar nada.
  if (!summary) return null;

  return (
    <div className="aip-wrap">
      <div className="aip-header">
        <div className="aip-title">
          <Sparkles size={16} className="aip-spark" />
          <span>Análise Inteligente</span>
          {data?._streaming && <span className="aip-streaming">a escrever…</span>}
        </div>
        <button
          className={`aip-refresh ${loading ? 'aip-refresh--spin' : ''}`}
          onClick={refresh}
          disabled={loading || data?._streaming}
          aria-label="Atualizar análise"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {loading && (
        <div className="aip-skeleton">
          <div className="aip-sk-line aip-sk-line--lg" />
          <div className="aip-sk-line" />
          <div className="aip-sk-line aip-sk-line--sm" />
          <div className="aip-sk-hint">A analisar as tuas finanças…</div>
        </div>
      )}

      {!loading && error && (
        <div className="aip-empty">
          <div>
            Análise indisponível de momento.
            {error && <span className="aip-err-detail"> ({error})</span>}
          </div>
          <button className="aip-retry" onClick={refresh}>Tentar de novo</button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="aip-body">
          {data.summary && <p className="aip-summary">{data.summary}</p>}
          {data.narrative && <p className="aip-narrative">{data.narrative}</p>}

          {data.detailedAnalysis && (
            <>
              {showDetail && <p className="aip-detail">{data.detailedAnalysis}</p>}
              <button className="aip-toggle" onClick={() => setShowDetail(v => !v)}>
                {showDetail ? '↑ Menos detalhe' : 'Ler análise completa →'}
              </button>
            </>
          )}

          {data.strengths?.length > 0 && (
            <div className="aip-section">
              <div className="aip-sec-label aip-sec-label--good"><CheckCircle2 size={14} /> Pontos fortes</div>
              <ul className="aip-list">
                {data.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {data.concerns?.length > 0 && (
            <div className="aip-section">
              <div className="aip-sec-label aip-sec-label--warn"><AlertTriangle size={14} /> A melhorar</div>
              <ul className="aip-list">
                {data.concerns.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          {data.categoryInsights?.length > 0 && (
            <div className="aip-section">
              <div className="aip-sec-label">Por categoria</div>
              <ul className="aip-cat-list">
                {data.categoryInsights.map((ci, i) => (
                  <li key={i}>
                    <span className="aip-cat-name">{ci.category}</span>
                    <span className="aip-cat-insight">{ci.insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.recommendations?.length > 0 && (
            <div className="aip-section">
              <div className="aip-sec-label aip-sec-label--rec"><Target size={14} /> Recomendações</div>
              <ol className="aip-rec-list">
                {data.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ol>
            </div>
          )}

          {(data.projections || data.outlook) && (
            <div className="aip-footer">
              {data.projections && (
                <div className="aip-foot-card">
                  <div className="aip-foot-label"><TrendingUp size={13} /> Projeção</div>
                  <div className="aip-foot-text">{data.projections}</div>
                </div>
              )}
              {data.outlook && (
                <div className="aip-foot-card">
                  <div className="aip-foot-label">Perspetiva</div>
                  <div className="aip-foot-text">{data.outlook}</div>
                </div>
              )}
            </div>
          )}

          <div className="aip-disclaimer">Gerado por IA a partir dos teus dados · não é aconselhamento financeiro</div>
        </div>
      )}
    </div>
  );
};

export default AIInsightsPanel;
