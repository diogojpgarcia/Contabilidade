/**
 * PatrimonyFormModal.jsx
 * Modal de adição/edição de activos do patrimônio.
 * Extraído de PatrimonyView para isolar toda a lógica de formulário.
 *
 * Props:
 *   open            bool
 *   initialType     string | null  — pre-selects asset type (null = show type selector)
 *   editingAsset    { typeKey, item } | null
 *   patrimony       object
 *   onPatrimonyChange fn
 *   onAccountRename   fn
 *   euribor3M       number | null
 *   onClose         fn
 *   PATRIMONY_TYPES array
 */
import React, { useState, useEffect, useRef } from 'react';
import { useForm } from '../../hooks/useForm';
import Overlay from '../Overlay';
import { searchAssets } from '../../utils/searchAssets';
import { fetchStockSearch } from '../../utils/assetPrice';
import { BOND_SERIES_INFO, calcSerieERate, calcBondValue } from '../../utils/certificadoAforro';

const EMPTY_FORM = {};

const PatrimonyFormModal = ({
  open,
  initialType,
  editingAsset,
  patrimony,
  onPatrimonyChange,
  onAccountRename,
  euribor3M,
  onClose,
  PATRIMONY_TYPES,
}) => {
  const { draft: f, setField: set, reset } = useForm(EMPTY_FORM);

  // ── Form type + edit state ────────────────────────────────────────────────
  const [formType,      setFormType]      = useState(null);
  const [editingId,     setEditingId]     = useState(null);

  // ── Stock search ──────────────────────────────────────────────────────────
  const [stockQuery,    setStockQuery]    = useState('');
  const [stockResults,  setStockResults]  = useState([]);
  const [stockLoading,  setStockLoading]  = useState(false);
  const [stockConfirmed, setStockConfirmed] = useState(false);
  const stockTimer = useRef(null);

  // ── ETF search ────────────────────────────────────────────────────────────
  const [etfQuery,      setEtfQuery]      = useState('');
  const [etfResults,    setEtfResults]    = useState([]);
  const [etfLoading,    setEtfLoading]    = useState(false);
  const [etfConfirmed,  setEtfConfirmed]  = useState(false);
  const etfTimer = useRef(null);

  // ── Crypto search ─────────────────────────────────────────────────────────
  const [cryptoQuery,     setCryptoQuery]     = useState('');
  const [cryptoConfirmed, setCryptoConfirmed] = useState(false);

  // ── Sync state when caller opens / pre-fills the modal ────────────────────
  useEffect(() => {
    if (!open) return;
    if (editingAsset) {
      reset(editingAsset.item);
      setFormType(editingAsset.typeKey);
      setEditingId(editingAsset.item.id);
      if (editingAsset.typeKey === 'stocks' && editingAsset.item.ticker) setStockConfirmed(true);
      if (editingAsset.typeKey === 'etfs'   && editingAsset.item.ticker) setEtfConfirmed(true);
      if (editingAsset.typeKey === 'crypto' && editingAsset.item.coin)   setCryptoConfirmed(true);
    } else {
      reset(EMPTY_FORM);
      setFormType(initialType ?? null);
      setEditingId(null);
      clearSearchForms();
    }
  }, [open, editingAsset, initialType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced stock search ────────────────────────────────────────────────
  useEffect(() => {
    if (stockTimer.current) clearTimeout(stockTimer.current);
    const q = stockQuery.trim();
    if (q.length < 2) { setStockResults([]); setStockLoading(false); return; }
    setStockLoading(true);
    stockTimer.current = setTimeout(async () => {
      const r = await fetchStockSearch(q, ['Common Stock']);
      setStockResults(r);
      setStockLoading(false);
    }, 350);
    return () => { if (stockTimer.current) clearTimeout(stockTimer.current); };
  }, [stockQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced ETF search ──────────────────────────────────────────────────
  useEffect(() => {
    if (etfTimer.current) clearTimeout(etfTimer.current);
    const q = etfQuery.trim();
    if (q.length < 2) { setEtfResults([]); setEtfLoading(false); return; }
    setEtfLoading(true);
    etfTimer.current = setTimeout(async () => {
      const r = await fetchStockSearch(q, ['ETF']);
      setEtfResults(r);
      setEtfLoading(false);
    }, 350);
    return () => { if (etfTimer.current) clearTimeout(etfTimer.current); };
  }, [etfQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ───────────────────────────────────────────────────────────────
  const clearSearchForms = () => {
    setStockQuery(''); setStockConfirmed(false); setStockResults([]); setStockLoading(false);
    setEtfQuery('');   setEtfConfirmed(false);   setEtfResults([]);   setEtfLoading(false);
    setCryptoQuery(''); setCryptoConfirmed(false);
  };

  const closeModal = () => {
    reset(EMPTY_FORM);
    setFormType(null);
    setEditingId(null);
    clearSearchForms();
    onClose();
  };

  const handleStockSelect = (r) => {
    set('ticker', r.fullSymbol ?? r.symbol);
    set('name',   r.name);
    setStockQuery('');
    setStockConfirmed(true);
  };

  const handleEtfSelect = (r) => {
    set('ticker', r.fullSymbol ?? r.symbol);
    set('name',   r.name);
    setEtfQuery('');
    setEtfConfirmed(true);
  };

  const handleCryptoSelect = (r) => {
    set('coin', r.symbol);
    set('name', r.name);
    setCryptoQuery('');
    setCryptoConfirmed(true);
  };

  const handleSubmit = () => {
    if (!formType) return;
    const clean = { ...f };
    if (editingId) {
      // propagate account renames to linked transactions
      if (formType === 'accounts' && onAccountRename) {
        const old = (patrimony?.accounts || []).find(a => a.id === editingId);
        if (old?.name && clean.name && old.name !== clean.name) {
          onAccountRename(editingId, clean.name);
        }
      }
      const updated = {
        ...patrimony,
        [formType]: (patrimony[formType] || []).map(x =>
          x.id === editingId ? { ...clean, id: editingId } : x
        ),
      };
      onPatrimonyChange?.(updated);
    } else {
      const id   = Date.now().toString();
      const item = { id, insertedAt: new Date().toISOString(), ...clean };
      const updated = { ...patrimony, [formType]: [...(patrimony[formType] || []), item] };
      onPatrimonyChange?.(updated);
    }
    closeModal();
  };

  // ── Can-submit guard ──────────────────────────────────────────────────────
  const canSubmit = (() => {
    switch (formType) {
      case 'stocks':     return stockConfirmed  && !!f.qty;
      case 'etfs':       return etfConfirmed    && !!f.qty;
      case 'crypto':     return cryptoConfirmed && !!f.qty;
      case 'accounts':   return !!f.name;
      case 'bonds':      return !!f.series && !!(f.faceValue || f.value);
      case 'realestate': return !!f.description && !!f.value;
      case 'vehicles':   return !!f.description && !!f.value;
      default:           return true;
    }
  })();

  const typeLabel   = PATRIMONY_TYPES.find(t => t.key === formType)?.label ?? '';
  const modalTitle  = editingId
    ? `Editar ${typeLabel}`
    : (formType ? `Adicionar ${typeLabel}` : 'Adicionar Activo');
  const submitLabel = editingId ? 'Guardar' : 'Adicionar';

  const cls = 'patrimony-input';

  // ── Form body per asset type ──────────────────────────────────────────────
  const renderForm = () => {
    switch (formType) {

      case 'accounts':
        return (<>
          <input className={cls} placeholder="Nome da conta"    value={f.name    || ''} onChange={e => set('name',    e.target.value)} />
          <input className={cls} placeholder="Banco (opcional)" value={f.bank    || ''} onChange={e => set('bank',    e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Saldo inicial (€)" value={f.balance || ''} onChange={e => set('balance', e.target.value)} />
        </>);

      case 'stocks': {
        const localMatches = stockQuery.trim().length >= 1 ? searchAssets(stockQuery.trim(), ['stock']) : [];
        const apiOnly      = stockResults.filter(r => !localMatches.some(l => l.symbol === r.symbol));
        const suggestions  = [...localMatches, ...apiOnly].slice(0, 8);
        const showDrop     = stockQuery.trim().length >= 1 && (suggestions.length > 0 || stockLoading);
        return (
          <div className="pat-asset-form">
            {!stockConfirmed ? (
              <div className="pat-search-wrap">
                <span className="pat-search-icon">⊕</span>
                <input
                  className={cls}
                  style={{ paddingLeft: '2.4rem' }}
                  placeholder="Procurar empresa ou ticker…"
                  value={stockQuery}
                  onChange={e => setStockQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (suggestions.length > 0) handleStockSelect(suggestions[0]);
                      else if (stockQuery.trim()) {
                        set('ticker', stockQuery.trim().toUpperCase());
                        set('name', '');
                        setStockQuery('');
                        setStockConfirmed(true);
                      }
                    }
                    if (e.key === 'Escape') setStockQuery('');
                  }}
                  onBlur={() => setTimeout(() => setStockQuery(''), 200)}
                  autoComplete="off"
                  autoFocus
                />
                {showDrop && (
                  <div className="pat-search-dropdown">
                    {suggestions.map(r => (
                      <div key={r.symbol} className="pat-search-result"
                        onMouseDown={e => { e.preventDefault(); handleStockSelect(r); }}>
                        <span className="pat-search-sym">{r.symbol}</span>
                        <span className="pat-search-name">{r.name}</span>
                        {r.type === 'etf'
                          ? <span className="pat-search-exch">ETF</span>
                          : r.exchange
                            ? <span className="pat-search-exch">{r.exchange}</span>
                            : null}
                      </div>
                    ))}
                    {stockLoading && <div className="pat-search-loading">A procurar…</div>}
                  </div>
                )}
              </div>
            ) : (<>
              <div className="pat-stock-chip">
                <div className="pat-stock-chip-body">
                  <span className="pat-stock-chip-ticker">{f.ticker}</span>
                  {f.name && <span className="pat-stock-chip-name">{f.name}</span>}
                </div>
                <button type="button" className="pat-stock-chip-clear"
                  onClick={() => { set('ticker',''); set('name',''); set('qty',''); set('broker',''); set('purchasePrice',''); setStockConfirmed(false); }}>×</button>
              </div>
              <input className={cls} type="number" inputMode="decimal"
                placeholder="Quantidade de ações" value={f.qty || ''}
                onChange={e => set('qty', e.target.value)} autoFocus />
              <input className={cls} type="number" inputMode="decimal"
                placeholder="Preço de compra por ação (€)" value={f.purchasePrice || ''}
                onChange={e => set('purchasePrice', e.target.value)} />
              <input className={cls}
                placeholder="Broker — ex: XTB, Degiro (opcional)" value={f.broker || ''}
                onChange={e => set('broker', e.target.value)} autoComplete="off" />
            </>)}
          </div>
        );
      }

      case 'etfs': {
        const localEtf    = etfQuery.trim().length >= 1 ? searchAssets(etfQuery.trim(), ['etf']) : [];
        const apiEtfOnly  = etfResults.filter(r => !localEtf.some(l => l.symbol === r.symbol));
        const etfSuggs    = [...localEtf, ...apiEtfOnly].slice(0, 8);
        const showEtfDrop = etfQuery.trim().length >= 1 && (etfSuggs.length > 0 || etfLoading);
        return (
          <div className="pat-asset-form">
            {!etfConfirmed ? (
              <div className="pat-search-wrap">
                <span className="pat-search-icon">⊕</span>
                <input
                  className={cls}
                  style={{ paddingLeft: '2.4rem' }}
                  placeholder="Procurar ETF ou ticker…"
                  value={etfQuery}
                  onChange={e => setEtfQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (etfSuggs.length > 0) handleEtfSelect(etfSuggs[0]);
                      else if (etfQuery.trim()) {
                        set('ticker', etfQuery.trim().toUpperCase());
                        set('name', '');
                        setEtfQuery('');
                        setEtfConfirmed(true);
                      }
                    }
                    if (e.key === 'Escape') setEtfQuery('');
                  }}
                  onBlur={() => setTimeout(() => setEtfQuery(''), 200)}
                  autoComplete="off"
                  autoFocus
                />
                {showEtfDrop && (
                  <div className="pat-search-dropdown">
                    {etfSuggs.map(r => (
                      <div key={r.symbol} className="pat-search-result"
                        onMouseDown={e => { e.preventDefault(); handleEtfSelect(r); }}>
                        <span className="pat-search-sym">{r.symbol}</span>
                        <span className="pat-search-name">{r.name}</span>
                        {r.exchange && <span className="pat-search-exch">{r.exchange}</span>}
                      </div>
                    ))}
                    {etfLoading && <div className="pat-search-loading">A procurar…</div>}
                  </div>
                )}
              </div>
            ) : (<>
              <div className="pat-stock-chip">
                <div className="pat-stock-chip-body">
                  <span className="pat-stock-chip-ticker">{f.ticker}</span>
                  {f.name && <span className="pat-stock-chip-name">{f.name}</span>}
                </div>
                <button type="button" className="pat-stock-chip-clear"
                  onClick={() => { set('ticker',''); set('name',''); set('qty',''); set('broker',''); set('purchasePrice',''); setEtfConfirmed(false); }}>×</button>
              </div>
              <input className={cls} type="number" inputMode="decimal"
                placeholder="Quantidade de unidades" value={f.qty || ''}
                onChange={e => set('qty', e.target.value)} autoFocus />
              <input className={cls} type="number" inputMode="decimal"
                placeholder="Preço de compra por unidade (€)" value={f.purchasePrice || ''}
                onChange={e => set('purchasePrice', e.target.value)} />
              <input className={cls}
                placeholder="Broker/Plataforma (opcional)" value={f.broker || ''}
                onChange={e => set('broker', e.target.value)} autoComplete="off" />
            </>)}
          </div>
        );
      }

      case 'bonds': {
        const serieInfo  = BOND_SERIES_INFO[f.series?.toUpperCase()] ?? null;
        const isSerieE   = f.series?.toUpperCase() === 'E';
        const serieERate = euribor3M !== null ? calcSerieERate(euribor3M) : null;
        return (<>
          <select className={cls} value={f.series || ''} onChange={e => set('series', e.target.value)}>
            <option value="">Seleciona a série…</option>
            {Object.entries(BOND_SERIES_INFO).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <input className={cls} type="number" inputMode="decimal"
            placeholder="Valor subscrito (€) — capital inicial"
            value={f.faceValue || ''}
            onChange={e => set('faceValue', e.target.value)} />
          <input className={cls} type="date"
            placeholder="Data de subscrição"
            value={f.purchaseDate || f.date || ''}
            onChange={e => { set('purchaseDate', e.target.value); set('date', e.target.value); }} />
          {isSerieE ? (
            <div className="pat-bond-rate-info">
              <span className="pat-bond-rate-label">Taxa Série E</span>
              <span className="pat-bond-rate-value">
                {serieERate !== null
                  ? `${serieERate.toFixed(1)}% (Euribor 3M ${euribor3M?.toFixed(2)}% + 1%)`
                  : 'A carregar taxa…'}
              </span>
            </div>
          ) : serieInfo && !serieInfo.variable ? (
            <input className={cls} type="number" inputMode="decimal"
              placeholder="Taxa anual (%) — ver caderneta"
              value={f.annualRate || ''}
              onChange={e => set('annualRate', e.target.value)} />
          ) : null}
          {f.faceValue && f.purchaseDate && (
            <div className="pat-bond-calc-preview">
              {(() => {
                const rate = isSerieE ? serieERate : parseFloat(f.annualRate) || null;
                if (!rate) return <span>Introduz a taxa anual para ver o valor estimado.</span>;
                const val     = calcBondValue(parseFloat(f.faceValue), f.purchaseDate, rate);
                const accrued = val - parseFloat(f.faceValue);
                return <span>Valor estimado atual: <strong>{val.toFixed(2)} €</strong> (juros: +{accrued.toFixed(2)} €)</span>;
              })()}
            </div>
          )}
        </>);
      }

      case 'realestate':
        return (<>
          <input className={cls} placeholder="Descrição (ex: Apartamento Lisboa)" value={f.description || ''} onChange={e => set('description', e.target.value)} />
          <input className={cls} type="number" inputMode="decimal" placeholder="Valor estimado (€)" value={f.value || ''} onChange={e => set('value', e.target.value)} />
        </>);

      case 'vehicles':
        return (<>
          <input className={cls} placeholder="Descrição (ex: BMW X3 2020)" value={f.description || ''} onChange={e => {
            set('description', e.target.value);
            const m = e.target.value.match(/\b(19|20)\d{2}\b/);
            if (m && !f.year) set('year', m[0]);
          }} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input className={cls} type="number" inputMode="numeric" placeholder="Ano (ex: 2020)" value={f.year || ''} onChange={e => set('year', e.target.value)} style={{ flex: 1 }} />
            <input className={cls} type="number" inputMode="numeric" placeholder="Km (ex: 45000)" value={f.km || ''} onChange={e => set('km', e.target.value)} style={{ flex: 1 }} />
          </div>
          <input className={cls} type="number" inputMode="decimal" placeholder="Valor de compra / estimado (€)" value={f.value || ''} onChange={e => set('value', e.target.value)} />
        </>);

      case 'crypto': {
        const cryptoSuggs = cryptoQuery.trim().length >= 1
          ? searchAssets(cryptoQuery.trim(), ['crypto'])
          : [];
        return (
          <div className="pat-asset-form">
            {!cryptoConfirmed ? (
              <div className="pat-search-wrap">
                <span className="pat-search-icon">⊕</span>
                <input
                  className={cls}
                  style={{ paddingLeft: '2.4rem' }}
                  placeholder="Procurar moeda ou símbolo…"
                  value={cryptoQuery}
                  onChange={e => setCryptoQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (cryptoSuggs.length > 0) handleCryptoSelect(cryptoSuggs[0]);
                      else if (cryptoQuery.trim()) {
                        set('coin', cryptoQuery.trim().toUpperCase());
                        set('name', '');
                        setCryptoQuery('');
                        setCryptoConfirmed(true);
                      }
                    }
                    if (e.key === 'Escape') setCryptoQuery('');
                  }}
                  onBlur={() => setTimeout(() => setCryptoQuery(''), 200)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoFocus
                />
                {cryptoSuggs.length > 0 && (
                  <div className="pat-search-dropdown">
                    {cryptoSuggs.map(r => (
                      <div key={r.symbol} className="pat-search-result"
                        onMouseDown={e => { e.preventDefault(); handleCryptoSelect(r); }}>
                        <span className="pat-search-sym">{r.symbol}</span>
                        <span className="pat-search-name">{r.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (<>
              <div className="pat-stock-chip">
                <div className="pat-stock-chip-body">
                  <span className="pat-stock-chip-ticker">{f.coin}</span>
                  {f.name && <span className="pat-stock-chip-name">{f.name}</span>}
                </div>
                <button type="button" className="pat-stock-chip-clear"
                  onClick={() => { set('coin',''); set('name',''); set('qty',''); set('exchange',''); set('purchasePrice',''); setCryptoConfirmed(false); }}>×</button>
              </div>
              <input className={cls} type="number" inputMode="decimal"
                placeholder="Quantidade" value={f.qty || ''}
                onChange={e => set('qty', e.target.value)} autoFocus />
              <input className={cls} type="number" inputMode="decimal"
                placeholder="Preço de compra por moeda (€)" value={f.purchasePrice || ''}
                onChange={e => set('purchasePrice', e.target.value)} />
              <input className={cls}
                placeholder="Exchange — ex: Binance, Coinbase (opcional)" value={f.exchange || ''}
                onChange={e => set('exchange', e.target.value)} autoComplete="off" />
            </>)}
          </div>
        );
      }

      default: return null;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!open) return null;

  return (
    <Overlay onClose={closeModal}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h4>{modalTitle}</h4>
          <button className="modal-close" onClick={closeModal}>×</button>
        </div>

        {!formType ? (
          /* Type selector */
          <div className="patrimony-type-selector">
            {PATRIMONY_TYPES.map(({ key, label, Icon: PatIcon, color }) => (
              <button key={key} className="patrimony-type-btn"
                onClick={() => { setFormType(key); reset(EMPTY_FORM); }}>
                <div className="patrimony-type-btn-icon" style={{ background: `${color}22` }}>
                  <PatIcon size={20} color={color} strokeWidth={2} />
                </div>
                <span>{label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="patrimony-form">
            {renderForm()}
            <div className="patrimony-form-actions">
              {!editingId && (
                <button className="btn-patrimony-back"
                  onClick={() => { setFormType(null); reset(EMPTY_FORM); }}>← Voltar</button>
              )}
              <button
                className="btn-add-patrimony"
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={!canSubmit ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
              >{submitLabel}</button>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
};

export default PatrimonyFormModal;
