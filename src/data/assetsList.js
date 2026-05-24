/**
 * assetsList.js
 * Central asset registry used for autocomplete in the patrimony forms.
 *
 * type values:
 *   "stock" — individual equities
 *   "etf"   — exchange-traded funds (US or UCITS)
 *   "crypto" — cryptocurrencies; symbol is the base ticker (e.g. "BTC"),
 *              NOT the pair (fetchCryptoTwelveData appends "/USD" internally)
 *
 * Extend freely. The search function (searchAssets.js) filters and ranks
 * these entries; the API (Twelve Data + CoinGecko) is used for live prices.
 */

export const ASSETS = [

  // ── US Mega-Cap Stocks ────────────────────────────────────────────────────
  { type: 'stock', symbol: 'AAPL',  name: 'Apple Inc.' },
  { type: 'stock', symbol: 'MSFT',  name: 'Microsoft Corporation' },
  { type: 'stock', symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { type: 'stock', symbol: 'AMZN',  name: 'Amazon.com Inc.' },
  { type: 'stock', symbol: 'NVDA',  name: 'NVIDIA Corporation' },
  { type: 'stock', symbol: 'META',  name: 'Meta Platforms Inc.' },
  { type: 'stock', symbol: 'TSLA',  name: 'Tesla Inc.' },
  { type: 'stock', symbol: 'BRK/B', name: 'Berkshire Hathaway B' },
  { type: 'stock', symbol: 'JPM',   name: 'JPMorgan Chase & Co.' },
  { type: 'stock', symbol: 'V',     name: 'Visa Inc.' },
  { type: 'stock', symbol: 'MA',    name: 'Mastercard Inc.' },
  { type: 'stock', symbol: 'UNH',   name: 'UnitedHealth Group' },
  { type: 'stock', symbol: 'JNJ',   name: 'Johnson & Johnson' },
  { type: 'stock', symbol: 'XOM',   name: 'Exxon Mobil Corp.' },
  { type: 'stock', symbol: 'PG',    name: 'Procter & Gamble Co.' },
  { type: 'stock', symbol: 'HD',    name: 'Home Depot Inc.' },
  { type: 'stock', symbol: 'COST',  name: 'Costco Wholesale Corp.' },
  { type: 'stock', symbol: 'ADBE',  name: 'Adobe Inc.' },
  { type: 'stock', symbol: 'CRM',   name: 'Salesforce Inc.' },
  { type: 'stock', symbol: 'NFLX',  name: 'Netflix Inc.' },
  { type: 'stock', symbol: 'AMD',   name: 'Advanced Micro Devices' },
  { type: 'stock', symbol: 'INTC',  name: 'Intel Corporation' },
  { type: 'stock', symbol: 'DIS',   name: 'Walt Disney Co.' },
  { type: 'stock', symbol: 'PYPL',  name: 'PayPal Holdings Inc.' },
  { type: 'stock', symbol: 'COIN',  name: 'Coinbase Global Inc.' },
  { type: 'stock', symbol: 'PFE',   name: 'Pfizer Inc.' },
  { type: 'stock', symbol: 'KO',    name: 'Coca-Cola Co.' },
  { type: 'stock', symbol: 'MCD',   name: 'McDonald\'s Corp.' },
  { type: 'stock', symbol: 'NKE',   name: 'Nike Inc.' },
  { type: 'stock', symbol: 'SBUX',  name: 'Starbucks Corp.' },

  // ── European Stocks ───────────────────────────────────────────────────────
  { type: 'stock', symbol: 'ASML',  name: 'ASML Holding N.V.' },
  { type: 'stock', symbol: 'SAP',   name: 'SAP SE' },
  { type: 'stock', symbol: 'NVO',   name: 'Novo Nordisk A/S' },
  { type: 'stock', symbol: 'EDP',   name: 'EDP — Energias de Portugal' },
  { type: 'stock', symbol: 'GALP',  name: 'Galp Energia SGPS' },
  { type: 'stock', symbol: 'BCP',   name: 'Millennium BCP' },
  { type: 'stock', symbol: 'JMT',   name: 'Jerónimo Martins SGPS' },
  { type: 'stock', symbol: 'SON',   name: 'Sonae SGPS' },
  { type: 'stock', symbol: 'NOS',   name: 'NOS SGPS' },
  { type: 'stock', symbol: 'EGL',   name: 'Greenvolt — Energias Renováveis' },

  // ── US ETFs ───────────────────────────────────────────────────────────────
  { type: 'etf', symbol: 'SPY',  name: 'S&P 500 ETF (SPDR)' },
  { type: 'etf', symbol: 'QQQ',  name: 'Nasdaq-100 ETF (Invesco)' },
  { type: 'etf', symbol: 'VOO',  name: 'Vanguard S&P 500 ETF' },
  { type: 'etf', symbol: 'VTI',  name: 'Vanguard Total Market ETF' },
  { type: 'etf', symbol: 'GLD',  name: 'SPDR Gold Shares ETF' },
  { type: 'etf', symbol: 'TLT',  name: 'iShares 20+ Year Treasury ETF' },
  { type: 'etf', symbol: 'VGT',  name: 'Vanguard Info Technology ETF' },
  { type: 'etf', symbol: 'ARKK', name: 'ARK Innovation ETF' },

  // ── UCITS ETFs (popular in PT/EU) ─────────────────────────────────────────
  { type: 'etf', symbol: 'VWCE', name: 'Vanguard FTSE All-World UCITS ETF' },
  { type: 'etf', symbol: 'IWDA', name: 'iShares Core MSCI World UCITS ETF' },
  { type: 'etf', symbol: 'CSPX', name: 'iShares Core S&P 500 UCITS ETF' },
  { type: 'etf', symbol: 'VUSA', name: 'Vanguard S&P 500 UCITS ETF' },
  { type: 'etf', symbol: 'XDWD', name: 'Xtrackers MSCI World Swap UCITS ETF' },
  { type: 'etf', symbol: 'SXR8', name: 'iShares Core S&P 500 (Acc) EUR' },
  { type: 'etf', symbol: 'EUNL', name: 'iShares Core MSCI World UCITS (EUR)' },
  { type: 'etf', symbol: 'EXSA', name: 'iShares Core EURO STOXX 50 UCITS ETF' },
  { type: 'etf', symbol: 'MEUD', name: 'Amundi MSCI Europe UCITS ETF' },
  { type: 'etf', symbol: 'AGGH', name: 'iShares Core Global Aggregate Bond UCITS ETF' },

  // ── Crypto — Layer 1 ──────────────────────────────────────────────────────
  // symbol = base ticker only; fetchCryptoTwelveData appends "/USD" internally
  { type: 'crypto', symbol: 'BTC',   name: 'Bitcoin' },
  { type: 'crypto', symbol: 'ETH',   name: 'Ethereum' },
  { type: 'crypto', symbol: 'BNB',   name: 'BNB (Binance)' },
  { type: 'crypto', symbol: 'SOL',   name: 'Solana' },
  { type: 'crypto', symbol: 'ADA',   name: 'Cardano' },
  { type: 'crypto', symbol: 'AVAX',  name: 'Avalanche' },
  { type: 'crypto', symbol: 'DOT',   name: 'Polkadot' },
  { type: 'crypto', symbol: 'NEAR',  name: 'NEAR Protocol' },
  { type: 'crypto', symbol: 'ICP',   name: 'Internet Computer' },
  { type: 'crypto', symbol: 'APT',   name: 'Aptos' },
  { type: 'crypto', symbol: 'SUI',   name: 'Sui' },
  { type: 'crypto', symbol: 'ALGO',  name: 'Algorand' },
  { type: 'crypto', symbol: 'VET',   name: 'VeChain' },
  { type: 'crypto', symbol: 'TRX',   name: 'TRON' },
  { type: 'crypto', symbol: 'TON',   name: 'Toncoin' },
  { type: 'crypto', symbol: 'XLM',   name: 'Stellar' },
  { type: 'crypto', symbol: 'XRP',   name: 'XRP (Ripple)' },
  { type: 'crypto', symbol: 'LTC',   name: 'Litecoin' },
  { type: 'crypto', symbol: 'BCH',   name: 'Bitcoin Cash' },
  { type: 'crypto', symbol: 'ETC',   name: 'Ethereum Classic' },
  { type: 'crypto', symbol: 'XMR',   name: 'Monero' },

  // ── Crypto — Layer 2 & DeFi ───────────────────────────────────────────────
  { type: 'crypto', symbol: 'MATIC', name: 'Polygon' },
  { type: 'crypto', symbol: 'OP',    name: 'Optimism' },
  { type: 'crypto', symbol: 'ARB',   name: 'Arbitrum' },
  { type: 'crypto', symbol: 'LINK',  name: 'Chainlink' },
  { type: 'crypto', symbol: 'UNI',   name: 'Uniswap' },
  { type: 'crypto', symbol: 'AAVE',  name: 'Aave' },
  { type: 'crypto', symbol: 'MKR',   name: 'Maker' },
  { type: 'crypto', symbol: 'CRV',   name: 'Curve DAO' },
  { type: 'crypto', symbol: 'SNX',   name: 'Synthetix' },
  { type: 'crypto', symbol: 'LDO',   name: 'Lido DAO' },
  { type: 'crypto', symbol: 'RUNE',  name: 'THORChain' },
  { type: 'crypto', symbol: 'GRT',   name: 'The Graph' },
  { type: 'crypto', symbol: 'JUP',   name: 'Jupiter' },
  { type: 'crypto', symbol: 'ATOM',  name: 'Cosmos' },

  // ── Crypto — AI / Infra ───────────────────────────────────────────────────
  { type: 'crypto', symbol: 'RNDR',  name: 'Render Network' },
  { type: 'crypto', symbol: 'FET',   name: 'Fetch.ai' },
  { type: 'crypto', symbol: 'INJ',   name: 'Injective' },
  { type: 'crypto', symbol: 'FIL',   name: 'Filecoin' },

  // ── Crypto — Meme & Culture ───────────────────────────────────────────────
  { type: 'crypto', symbol: 'DOGE',  name: 'Dogecoin' },
  { type: 'crypto', symbol: 'SHIB',  name: 'Shiba Inu' },
  { type: 'crypto', symbol: 'PEPE',  name: 'Pepe' },
  { type: 'crypto', symbol: 'WIF',   name: 'Dogwifhat' },
  { type: 'crypto', symbol: 'BONK',  name: 'Bonk' },

  // ── Crypto — Gaming / Metaverse ───────────────────────────────────────────
  { type: 'crypto', symbol: 'SAND',  name: 'The Sandbox' },
  { type: 'crypto', symbol: 'MANA',  name: 'Decentraland' },
  { type: 'crypto', symbol: 'APE',   name: 'ApeCoin' },
];
