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
  // ASML e SAP têm listagem em NASDAQ/NYSE — sem sufixo funciona (preço USD)
  { type: 'stock', symbol: 'ASML',     name: 'ASML Holding N.V.' },
  { type: 'stock', symbol: 'SAP',      name: 'SAP SE' },
  { type: 'stock', symbol: 'NVO',      name: 'Novo Nordisk A/S (NYSE ADR)' },
  // Ações portuguesas — Euronext Lisboa (.LS), preços em EUR
  { type: 'stock', symbol: 'EDP.LS',   name: 'EDP — Energias de Portugal' },
  { type: 'stock', symbol: 'GALP.LS',  name: 'Galp Energia SGPS' },
  { type: 'stock', symbol: 'BCP.LS',   name: 'Millennium BCP' },
  { type: 'stock', symbol: 'JMT.LS',   name: 'Jerónimo Martins SGPS' },
  { type: 'stock', symbol: 'SON.LS',   name: 'Sonae SGPS' },
  { type: 'stock', symbol: 'NOS.LS',   name: 'NOS SGPS' },
  { type: 'stock', symbol: 'EGL.LS',   name: 'Greenvolt — Energias Renováveis' },

  // ── US ETFs ───────────────────────────────────────────────────────────────
  // Nota: estes ETFs cotam em USD. Para versões UCITS (EUR) ver secção abaixo.
  { type: 'etf', symbol: 'SPY',  name: 'S&P 500 ETF (SPDR) · NASDAQ · USD' },
  { type: 'etf', symbol: 'QQQ',  name: 'Nasdaq-100 ETF (Invesco) · NASDAQ · USD' },
  { type: 'etf', symbol: 'VOO',  name: 'Vanguard S&P 500 ETF · NYSE · USD' },
  { type: 'etf', symbol: 'VTI',  name: 'Vanguard Total Market ETF · NYSE · USD' },
  { type: 'etf', symbol: 'GLD',  name: 'SPDR Gold Shares ETF · NYSE · USD' },
  { type: 'etf', symbol: 'TLT',  name: 'iShares 20+ Year Treasury ETF · NASDAQ · USD' },
  { type: 'etf', symbol: 'VGT',  name: 'Vanguard Info Technology ETF · NYSE · USD' },
  { type: 'etf', symbol: 'ARKK', name: 'ARK Innovation ETF · NYSE · USD' },
  { type: 'etf', symbol: 'SMH',  name: 'VanEck Semiconductor ETF · NASDAQ · USD' },

  // ── UCITS ETFs (Europa — EUR) ─────────────────────────────────────────────
  // Sufixo de bolsa garante preço correto em EUR.
  // .DE = XETRA · .AS = Euronext Amsterdam · .PA = Euronext Paris · .L = Londres
  // ── Vanguard ──────────────────────────────────────────────────────────────
  { type: 'etf', symbol: 'VWCE.DE', name: 'Vanguard FTSE All-World Acc UCITS · XETRA · EUR' },
  { type: 'etf', symbol: 'VUSA.DE', name: 'Vanguard S&P 500 UCITS · XETRA · EUR' },
  { type: 'etf', symbol: 'VWRL.AS', name: 'Vanguard FTSE All-World Dist UCITS · Amsterdam · EUR' },
  { type: 'etf', symbol: 'VEUR.AS', name: 'Vanguard FTSE Developed Europe UCITS · Amsterdam · EUR' },
  { type: 'etf', symbol: 'VFEM.AS', name: 'Vanguard FTSE Emerging Markets UCITS · Amsterdam · EUR' },
  // ── iShares (BlackRock) ───────────────────────────────────────────────────
  { type: 'etf', symbol: 'IWDA.AS', name: 'iShares MSCI World Acc UCITS · Amsterdam · EUR' },
  { type: 'etf', symbol: 'EUNL.DE', name: 'iShares MSCI World UCITS · XETRA · EUR' },
  { type: 'etf', symbol: 'SXR8.DE', name: 'iShares Core S&P 500 UCITS (EUR hedged) · XETRA · EUR' },
  { type: 'etf', symbol: 'CSPX.L',  name: 'iShares Core S&P 500 Acc UCITS · Londres · USD' },
  { type: 'etf', symbol: 'IS3N.DE', name: 'iShares Core MSCI EM IMI UCITS · XETRA · EUR' },
  { type: 'etf', symbol: 'IEMA.AS', name: 'iShares Core MSCI EM IMI UCITS · Amsterdam · EUR' },
  { type: 'etf', symbol: 'EXSA.DE', name: 'iShares Core EURO STOXX 50 UCITS · XETRA · EUR' },
  { type: 'etf', symbol: 'AGGH.L',  name: 'iShares Core Global Aggregate Bond UCITS · Londres · USD' },
  { type: 'etf', symbol: 'IAGG.DE', name: 'iShares Core Global Agg Bond EUR Hedged · XETRA · EUR' },
  { type: 'etf', symbol: 'IDTL.L',  name: 'iShares $ Treasury Bond 20+yr UCITS · Londres · USD' },
  // ── Xtrackers (DWS) ───────────────────────────────────────────────────────
  { type: 'etf', symbol: 'XDWD.DE', name: 'Xtrackers MSCI World Swap UCITS · XETRA · EUR' },
  { type: 'etf', symbol: 'XDEM.DE', name: 'Xtrackers MSCI World Momentum UCITS · XETRA · EUR' },
  // ── Amundi / Lyxor ────────────────────────────────────────────────────────
  { type: 'etf', symbol: 'MEUD.PA', name: 'Amundi MSCI Europe UCITS · Paris · EUR' },
  { type: 'etf', symbol: 'LCWD.PA', name: 'Amundi MSCI World UCITS · Paris · EUR' },
  { type: 'etf', symbol: 'PANX.PA', name: 'Amundi Nasdaq-100 UCITS · Paris · EUR' },
  // ── SPDR ──────────────────────────────────────────────────────────────────
  { type: 'etf', symbol: 'SPPW.DE', name: 'SPDR MSCI World UCITS · XETRA · EUR' },
  { type: 'etf', symbol: 'SPXS.DE', name: 'SPDR S&P 500 UCITS · XETRA · EUR' },
  // ── VanEck UCITS ──────────────────────────────────────────────────────────
  { type: 'etf', symbol: 'VVSM.DE', name: 'VanEck Semiconductor UCITS · XETRA · EUR' },
  { type: 'etf', symbol: 'SMH.PA',  name: 'VanEck Semiconductor UCITS · Paris · EUR' },
  { type: 'etf', symbol: 'MOAT.AS', name: 'VanEck Morningstar US Wide Moat UCITS · Amsterdam · EUR' },
  { type: 'etf', symbol: 'DAPP.DE', name: 'VanEck Digital Assets Equity UCITS · XETRA · EUR' },
  // ── Invesco UCITS ─────────────────────────────────────────────────────────
  { type: 'etf', symbol: 'EQQQ.DE', name: 'Invesco Nasdaq-100 UCITS · XETRA · EUR' },
  { type: 'etf', symbol: 'QQQM.AS', name: 'Invesco Nasdaq-100 UCITS (Dist) · Amsterdam · EUR' },
  // ── WisdomTree ────────────────────────────────────────────────────────────
  { type: 'etf', symbol: 'WGLD.DE', name: 'WisdomTree Physical Gold · XETRA · EUR' },
  { type: 'etf', symbol: 'PHAU.L',  name: 'WisdomTree Physical Gold · Londres · USD' },

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
