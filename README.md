# 📊 TradeAssist — BTC/USD Real-Time Signal HUD

A real-time BTC/USD swing trade signal advisor that pulls live data from Kraken, runs **13 technical indicators** using pure JavaScript math, and displays **BUY/SELL signals with confidence scores** on a premium dark HUD.

> ⚠️ **Not financial advice.** Signals are for educational/informational purposes only. Always do your own research.

---

## 🚀 Features

| Feature | Details |
|---|---|
| **Live Price** | Real-time via Kraken WebSocket, pulses green on update |
| **13 Indicators** | RSI, MACD, Bollinger Bands, Stochastic, EMA 9/21, SMA 200, ADX, ATR, VWAP, OBV, Fibonacci, RSI divergence, MACD divergence |
| **Confluence Score** | Weighted -100 to +100 system combining all indicator signals |
| **Trade Plan** | Explicit "BUY @ $X → SELL @ $Y" predictions with hold time, expected move, and reasons |
| **Timeframes** | Switchable: 5m, 15m, 1h, 4h — each with timeframe-aware predictions |
| **Targets** | Entry, stop-loss (ATR-based), take-profit (Fibonacci levels), risk/reward ratio |
| **Pop-out HUD** | Compact 320×420 overlay window via the ⬗ button |
| **Sound Alerts** | Audio notification on signal changes (toggle with 🔔) |

---

## 🎯 How It Works

### Technical Indicators Engine

All indicators are implemented **from scratch using pure math** — no external libraries.

| Indicator | Math | Purpose |
|---|---|---|
| **SMA** | Σ(close) / n | Smoothed price trend |
| **EMA** | EMA_prev + α(close - EMA_prev), α = 2/(n+1) | Responsive trend with exponential decay |
| **RSI** (14) | 100 - 100/(1 + avg_gain/avg_loss) | Overbought (>70) / Oversold (<30) |
| **MACD** | EMA(12) - EMA(26), Signal = EMA(9 of MACD) | Momentum crossover signals |
| **Bollinger Bands** | SMA(20) ± 2σ | Volatility squeeze/expansion |
| **Stochastic** | %K = (C-L14)/(H14-L14)×100, %D = SMA(3 of %K) | Overbought/oversold momentum |
| **ADX** (14) | Smoothed DX from +DI/-DI | Trend strength (>25 = strong) |
| **VWAP** | Σ(typical_price × volume) / Σ(volume) | Institutional fair value |
| **Fibonacci** | High - (High-Low) × {0.236, 0.382, 0.5, 0.618, 0.786} | Key reversal levels |
| **ATR** (14) | SMA of True Range | Volatility / stop-loss sizing |
| **OBV** | Running total of signed volume | Volume trend confirmation |
| **RSI Divergence** | Price highs vs RSI highs comparison | Early reversal detection |
| **MACD Divergence** | Price trend vs MACD histogram trend | Momentum divergence = reversal |

### Confluence Scoring System

Each indicator generates a sub-signal: **bullish (+1)**, **bearish (-1)**, or **neutral (0)**. These are weighted and combined into a **confluence score**:

| Score | Signal |
|-------|--------|
| +60 to +100 | 🟢 **STRONG BUY** |
| +30 to +59 | 🟡 **BUY** |
| -29 to +29 | ⚪ **NEUTRAL** (wait) |
| -59 to -30 | 🟡 **SELL** |
| -100 to -60 | 🔴 **STRONG SELL** |

### Trade Plan Predictions

When a signal is active, the HUD displays:
- **Explicit prediction**: "BUY @ $67,500 → SELL @ $67,850"
- **Hold time**: Timeframe-aware (e.g. ~15 min on 5m, ~12 hrs on 4h)
- **Expected move**: Based on ATR × √(swing candles)
- **Stop loss & take profit**: With exact % risk/reward
- **Why**: Top reasons driving the signal (e.g. "RSI oversold", "MACD bullish cross")
- **Support/Resistance/VWAP zones**

---

## 🏗️ Project Structure

```
trading-hud/
├── index.html          # Main page
├── vite.config.js      # Vite dev server config
├── package.json
├── css/
│   └── styles.css      # Dark premium HUD theme
├── js/
│   ├── app.js          # Main controller (data flow, events, auto-refresh)
│   ├── kraken.js       # Kraken REST + WebSocket API integration
│   ├── indicators.js   # 13 technical indicators (pure math)
│   ├── signals.js      # Confluence scoring + trade plan generation
│   └── ui.js           # DOM rendering + mini HUD popup
└── docs/
    ├── implementation_plan.md   # Technical design document
    └── walkthrough.md           # Project walkthrough & verification
```

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v16+

### Install & Run

```bash
git clone https://github.com/wavyvi00/tradeassist.git
cd tradeassist
npm install
npm run dev
```

Opens at **http://localhost:3000**

---

## 📡 Data Sources

- **Kraken REST API** (`/0/public/OHLC`) — Historical OHLCV candle data
- **Kraken WebSocket** (`wss://ws.kraken.com`) — Real-time BTC/USD price stream
- No API keys required — uses public endpoints only

---

## 🔮 Future Ideas

- **Custom weights** — Let users tune indicator weights
- **More pairs** — ETH/USD, SOL/USD, etc.
- **Backtesting** — Test signal performance on historical data
- **TradingView charts** — Visual chart overlays
- **Electron app** — Standalone desktop app

---

## 📄 License

MIT
