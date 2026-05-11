import React, { useState } from 'react';
import CategoryPicker from './CategoryPicker';
import AccountPicker from './AccountPicker';
import { getCategoryMeta } from '../utils/categoryIcons';
import './FintechTransactionCard.css';

/* ── Merchant map ─────────────────────────────────────────────────────────────
   keys[]  — lowercase substrings to match in the transaction description
   domain  — used for logo.clearbit.com; null = icon only
   category — Portuguese category name used for icon/colour lookup            */
const MERCHANT_MAP = [
  /* Transport */
  { keys: ['uber'],                        domain: 'uber.com',         category: 'Transporte' },
  { keys: ['bolt'],                        domain: 'bolt.eu',          category: 'Transporte' },
  { keys: ['cabify'],                      domain: 'cabify.com',       category: 'Transporte' },
  { keys: ['galp'],                        domain: 'galp.com',         category: 'Transporte' },
  { keys: [' bp '],                        domain: 'bp.com',           category: 'Transporte' },
  { keys: ['repsol'],                      domain: 'repsol.pt',        category: 'Transporte' },
  { keys: ['cp ','comboios de portugal'],  domain: 'cp.pt',            category: 'Transporte' },
  { keys: ['gira'],                        domain: null,               category: 'Transporte' },
  /* Food & Groceries */
  { keys: ['continente'],                  domain: 'continente.pt',    category: 'Alimentação' },
  { keys: ['pingo doce','pingodoce'],      domain: 'pingodoce.pt',     category: 'Alimentação' },
  { keys: ['lidl'],                        domain: 'lidl.pt',          category: 'Alimentação' },
  { keys: ['aldi'],                        domain: 'aldi.pt',          category: 'Alimentação' },
  { keys: ['mercadona'],                   domain: 'mercadona.es',     category: 'Alimentação' },
  { keys: ['intermarche','intermarché'],   domain: 'intermarche.pt',   category: 'Alimentação' },
  { keys: ['minipreco','minipreço'],       domain: null,               category: 'Alimentação' },
  { keys: ['mcdonalds',"mcdonald's",'mcdonald'], domain: 'mcdonalds.com', category: 'Alimentação' },
  { keys: ['burger king'],                 domain: 'burgerking.com',   category: 'Alimentação' },
  { keys: ['kfc'],                         domain: 'kfc.com',          category: 'Alimentação' },
  { keys: ['starbucks'],                   domain: 'starbucks.com',    category: 'Alimentação' },
  { keys: ['nespresso'],                   domain: 'nespresso.com',    category: 'Alimentação' },
  /* Shopping */
  { keys: ['amazon prime'],                domain: 'amazon.com',       category: 'Subscrições' },
  { keys: ['amazon'],                      domain: 'amazon.com',       category: 'Outros' },
  { keys: ['zara'],                        domain: 'zara.com',         category: 'Roupa & Calçado' },
  { keys: ['h&m',' hm '],                  domain: 'hm.com',           category: 'Roupa & Calçado' },
  { keys: ['primark'],                     domain: 'primark.com',      category: 'Roupa & Calçado' },
  { keys: ['mango'],                       domain: 'mango.com',        category: 'Roupa & Calçado' },
  { keys: ['el corte ingles','el corte inglés','elcorteingles'], domain: 'elcorteingles.pt', category: 'Outros' },
  { keys: ['ikea'],                        domain: 'ikea.com',         category: 'Casa & Jardim' },
  { keys: ['leroy merlin','leroymerlin'],  domain: 'leroymerlin.pt',   category: 'Casa & Jardim' },
  { keys: ['decathlon'],                   domain: 'decathlon.pt',     category: 'Lazer & Entretenimento' },
  /* Tech & Electronics */
  { keys: ['worten'],                      domain: 'worten.pt',        category: 'Tecnologia' },
  { keys: ['fnac'],                        domain: 'fnac.pt',          category: 'Tecnologia' },
  { keys: ['apple'],                       domain: 'apple.com',        category: 'Tecnologia' },
  { keys: ['google'],                      domain: 'google.com',       category: 'Tecnologia' },
  { keys: ['microsoft'],                   domain: 'microsoft.com',    category: 'Tecnologia' },
  /* Subscriptions & Entertainment */
  { keys: ['netflix'],                     domain: 'netflix.com',      category: 'Subscrições' },
  { keys: ['spotify'],                     domain: 'spotify.com',      category: 'Subscrições' },
  { keys: ['disney+','disneyplus'],        domain: 'disneyplus.com',   category: 'Subscrições' },
  { keys: ['hbo max','hbomax','hbo'],      domain: 'max.com',          category: 'Subscrições' },
  { keys: ['youtube premium'],             domain: 'youtube.com',      category: 'Subscrições' },
  { keys: ['steam'],                       domain: 'store.steampowered.com', category: 'Lazer & Entretenimento' },
  { keys: ['playstation','ps store','psn'],domain: 'playstation.com',  category: 'Lazer & Entretenimento' },
  { keys: ['xbox'],                        domain: 'xbox.com',         category: 'Lazer & Entretenimento' },
  /* Communications */
  { keys: ['vodafone'],                    domain: 'vodafone.pt',      category: 'Comunicações' },
  { keys: ['meo'],                         domain: 'meo.pt',           category: 'Comunicações' },
  { keys: ['nos ','nos.pt'],               domain: 'nos.pt',           category: 'Comunicações' },
  { keys: ['nowo','cabovisao'],            domain: null,               category: 'Comunicações' },
  /* Utilities */
  { keys: ['edp'],                         domain: 'edp.pt',           category: 'Utilities' },
  { keys: ['endesa'],                      domain: 'endesa.pt',        category: 'Utilities' },
  { keys: ['epal','aguas de'],             domain: null,               category: 'Utilities' },
  /* Travel */
  { keys: ['airbnb'],                      domain: 'airbnb.com',       category: 'Viagens & Férias' },
  { keys: ['booking'],                     domain: 'booking.com',      category: 'Viagens & Férias' },
  { keys: ['ryanair'],                     domain: 'ryanair.com',      category: 'Viagens & Férias' },
  { keys: ['tap air','tap portugal','flytap'], domain: 'flytap.com',   category: 'Viagens & Férias' },
  { keys: ['easyjet'],                     domain: 'easyjet.com',      category: 'Viagens & Férias' },
  /* Health */
  { keys: ['farmacia','farmácia'],         domain: null,               category: 'Saúde' },
  { keys: ['wells'],                       domain: null,               category: 'Saúde' },
];

/* ── getMerchantVisual ───────────────────────────────────────────────────── */
function getMerchantVisual(description) {
  if (!description) return null;
  const lower = description.toLowerCase();
  for (const m of MERCHANT_MAP) {
    if (m.keys.some(k => lower.includes(k))) {
      return {
        logoUrl:          m.domain ? `https://logo.clearbit.com/${m.domain}` : null,
        detectedCategory: m.category,
      };
    }
  }
  return null;
}


/* ── Transfer flow helper ─────────────────────────────────────────────────── */
function getTransferFlow(tx) {
  const desc = (tx.description || '').trim();
  const toMatch   = desc.match(/^Transferência para (.+)$/i);
  const fromMatch = desc.match(/^Transferência de (.+)$/i);
  if (toMatch)   return `${tx.category} → ${toMatch[1]}`;
  if (fromMatch) return `${fromMatch[1]} → ${tx.category}`;
  return desc || tx.category || 'Transferência';
}

/* ── Date helpers ─────────────────────────────────────────────────────────── */
function formatShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

function formatLong(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr);
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Component ────────────────────────────────────────────────────────────── */
const FintechTransactionCard = ({ tx, onCategoryChange, onAccountChange, onDelete, isDuplicate = false, categories, accounts = [] }) => {
  const [open,          setOpen]          = useState(false);
  const [pickerTx,      setPickerTx]      = useState(null);
  const [acctPickerOpen, setAcctPickerOpen] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [logoErr,       setLogoErr]       = useState(false);

  /* ── Guard: never render with missing/invalid data ── */
  if (!tx || typeof tx !== 'object') return null;

  const txType       = tx.type       || 'expense';
  const txCategory   = tx.category   || 'Outros';
  const txDesc       = tx.description || '';
  const txAmount     = parseFloat(tx.amount  || 0);
  const txDate       = tx.date       || '';

  const isTransfer   = txType === 'transfer';
  const isAdjustment = txType === 'adjustment';
  const isIncome     = txType === 'income';

  /* Merchant detection — only for regular transactions */
  let merchant = null;
  try {
    if (!isTransfer && !isAdjustment) {
      merchant = getMerchantVisual(txDesc || txCategory);
    }
  } catch { /* ignore merchant detection errors */ }

  const effectiveCat = merchant?.detectedCategory || txCategory;
  const { Icon, color } = getCategoryMeta(effectiveCat, txType);

  const showLogo = !!merchant?.logoUrl && !logoErr;
  const bubbleBg = showLogo
    ? 'rgba(255,255,255,0.08)'
    : `${color}26`; /* 15% opacity */

  const title = isTransfer
    ? getTransferFlow(tx)
    : (txDesc || txCategory || '—');

  const amountStr = isTransfer
    ? `${txAmount.toFixed(2)}€`
    : `${isIncome ? '+' : '−'}${txAmount.toFixed(2)}€`;

  const handlePickerSelect = (newCategory) => {
    if (pickerTx && onCategoryChange) {
      onCategoryChange(pickerTx.id, newCategory, pickerTx.description || '');
    }
    setPickerTx(null);
    setOpen(false);
  };

  const handleAccountSelect = (newId, newName) => {
    if (onAccountChange) onAccountChange(tx.id, newId, newName);
    setAcctPickerOpen(false);
    setOpen(false);
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Apagar esta transação?')) return;
    setDeleting(true);
    try {
      if (onDelete) await onDelete(tx.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className={`ftc-card${isDuplicate ? ' ftc-card--dupe' : ''}`} onClick={() => setOpen(o => !o)}>
        {isDuplicate && <div className="ftc-dupe-bar">duplicado</div>}

        {/* ── Main row ── */}
        <div className="ftc-row">
          {/* Icon / logo bubble */}
          <div className="ftc-icon-wrap" style={{ background: bubbleBg }}>
            {showLogo ? (
              <img
                src={merchant.logoUrl}
                alt=""
                className="ftc-logo-img"
                onError={() => setLogoErr(true)}
              />
            ) : (
              <Icon size={18} color={color} strokeWidth={2} />
            )}
          </div>

          {/* Body */}
          <div className="ftc-body">
            <span className="ftc-title">{title}</span>
            <span className="ftc-sub">
              {isTransfer ? (
                <span className="ftc-badge ftc-badge--transfer">Transferência</span>
              ) : isAdjustment ? (
                <span className="ftc-badge ftc-badge--adjust">Ajuste</span>
              ) : (
                <span className="ftc-cat">{effectiveCat}</span>
              )}
              {tx.account_name && !isTransfer && !isAdjustment && (
                <span className="ftc-acct-badge">◈ {tx.account_name}</span>
              )}
            </span>
          </div>

          {/* Right: amount + date */}
          <div className="ftc-right">
            <span className={`ftc-amt ${isTransfer ? 'ftc-amt--neutral' : isIncome ? 'ftc-amt--income' : 'ftc-amt--expense'}`}>
              {amountStr}
            </span>
            <span className="ftc-date">{formatShort(txDate)}</span>
          </div>
        </div>

        {/* ── Expanded actions ── */}
        {open && (
          <div className="ftc-actions" onClick={e => e.stopPropagation()}>
            <span className="ftc-action-date">{formatLong(txDate)}</span>
            <div className="ftc-action-btns">
              {onCategoryChange && !isTransfer && !isAdjustment && (
                <button className="ftc-action-btn" onClick={() => setPickerTx(tx)}>
                  ✎ Categoria
                </button>
              )}
              {onAccountChange && !isTransfer && !isAdjustment && (
                <button className="ftc-action-btn" onClick={() => setAcctPickerOpen(true)}>
                  ◈ {tx.account_name || 'Conta'}
                </button>
              )}
              {onDelete && (
                <button
                  className="ftc-action-btn ftc-action-btn--danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? '⏳' : '🗑 Apagar'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {pickerTx && (
        <CategoryPicker
          transaction={pickerTx}
          onSelect={handlePickerSelect}
          onClose={() => setPickerTx(null)}
          categories={categories}
        />
      )}

      {acctPickerOpen && (
        <AccountPicker
          accounts={accounts}
          currentAccountId={tx.account_id || null}
          onSelect={handleAccountSelect}
          onClose={() => setAcctPickerOpen(false)}
        />
      )}
    </>
  );
};

export default FintechTransactionCard;
