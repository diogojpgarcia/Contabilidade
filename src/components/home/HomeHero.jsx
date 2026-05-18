import React from 'react';

const HomeHero = ({ patrimonio, variacao, despesasMes, diaAtual, totalDias }) => {
  const progresso = Math.round((diaAtual / totalDias) * 100);

  // Dados dos últimos 6 meses (hardcoded por agora)
  const dados = [2650, 2980, 2810, 3050, 2920, 3247];
  const meses = ['Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'];

  const W = 340; // viewBox width
  const H = 80;  // viewBox height da chart
  const min = Math.min(...dados) * 0.98;
  const max = Math.max(...dados) * 1.01;

  const cx = (i) => (i / (dados.length - 1)) * W;
  const cy = (v) => H - ((v - min) / (max - min)) * H;

  const linePoints = dados.map((v, i) => `${cx(i)},${cy(v)}`).join(' ');
  const areaPath =
    `M0,${cy(dados[0])} ` +
    dados.map((v, i) => `L${cx(i)},${cy(v)}`).join(' ') +
    ` L${W},${H} L0,${H} Z`;

  return (
    <div style={{
      margin: '0 16px',
      borderRadius: '20px',
      background: 'linear-gradient(160deg, #141E2E 0%, #0D1520 100%)',
      border: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    }}>

      {/* TOPO: label + número + trend */}
      <div style={{ padding: '20px 20px 12px 20px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{
              fontSize: '11px',
              fontWeight: 400,
              color: '#94A3B8',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              margin: '0 0 6px 0',
            }}>
              Património Total
            </p>
            <p style={{
              fontSize: '36px',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              margin: '0 0 8px 0',
            }}>
              {patrimonio ?? '3 247,00€'}
            </p>
            <p style={{
              fontSize: '13px',
              color: '#22C55E',
              margin: 0,
            }}>
              ↑ +2,4% vs mês passado
            </p>
          </div>

          {/* Pílula de variação mensal */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(231,76,60,0.12)',
            border: '1px solid rgba(231,76,60,0.25)',
            borderRadius: '20px',
            padding: '5px 10px',
            marginTop: '2px',
          }}>
            <span style={{ color: '#E74C3C', fontSize: '12px' }}>↓</span>
            <span style={{ color: '#E74C3C', fontSize: '12px', fontWeight: 500 }}>
              {despesasMes ?? '-308,00€'}
            </span>
          </div>
        </div>

      </div>

      {/* GRÁFICO — largura total */}
      <div style={{ position: 'relative' }}>
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00DDFF" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#00DDFF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#areaGrad)" />
          <polyline
            points={linePoints}
            fill="none"
            stroke="#00DDFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Ponto atual */}
          <circle
            cx={cx(dados.length - 1)}
            cy={cy(dados[dados.length - 1])}
            r="3"
            fill="#00DDFF"
          />
        </svg>

        {/* Labels de mês abaixo do gráfico */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '6px 12px 14px 12px',
        }}>
          {meses.map((m, i) => (
            <span key={i} style={{
              fontSize: '10px',
              color: i === meses.length - 1 ? '#00DDFF' : '#94A3B8',
              fontWeight: i === meses.length - 1 ? 600 : 400,
            }}>
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* BARRA DE PROGRESSO DO MÊS */}
      <div style={{ padding: '0 20px 16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
            Dia {diaAtual ?? 19} de {totalDias ?? 31}
          </span>
          <span style={{ fontSize: '11px', color: '#00DDFF' }}>{progresso}%</span>
        </div>
        <div style={{
          height: '3px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progresso}%`,
            background: 'linear-gradient(90deg, #0099BB, #00DDFF)',
            borderRadius: '2px',
          }} />
        </div>
      </div>

    </div>
  );
};

export default HomeHero;
