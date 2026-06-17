/**
 * AIInsightsPanel — análise financeira aprofundada, gerada localmente no
 * dispositivo (ver useAIInsights → generateLocalAnalysis). Mostra resumo,
 * pontos fortes, preocupações, insights por categoria, recomendações e projeção.
 */
import React, { useState } from 'react';
import { Sparkles, TrendingUp, CheckCircle2, AlertTriangle, Target } from 'lucide-react';
import { useAIInsights } from '../../hooks/useAIInsights';
import './AIInsightsPanel.css';

const AIInsightsPanel = ({ summary }) => {
  const { data } = useAIInsights(summary);
  const [showDetail, setShowDetail] = useState(false);

  if (!summary || !data) return null;

  return (
    <div className="aip-wrap">
      <div className="aip-header">
        <div className="aip-title">
          <Sparkles size={16} className="aip-spark" />
          <span>Análise Inteligente</span>
        </div>
      </div>

      <div className="aip-body">
        {data.summary && <p className="aip-summary">{data.summary}</p>}
        {data.narrative && <p className="aip-narrative">{data.narrative}</p>}

        {data.detailedAnalysis && data.detailedAnalysis !== data.narrative && (
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

        <div className="aip-disclaimer">Análise automática dos teus dados · não é aconselhamento financeiro</div>
      </div>
    </div>
  );
};

export default AIInsightsPanel;
