# Trading Signal HUD — Implementation Plan

A web app that pulls live BTC/USD data from Kraken, runs advanced technical analysis with 13 indicators, and displays high-confidence BUY/SELL signals on a sleek HUD-style interface. It does **not** execute trades — it only advises.

## Architecture

### Project Setup

Vanilla JS + Vite for hot-reload. No frameworks — pure math, fast and clean.

```
trading-hud/
├── index.html          # Main page
├── vite.config.js      # Vite config
├── package.json
├── css/
│   └── styles.css      # HUD dark theme, glassmorphism
├── js/
│   ├── app.js          # Main app controller
│   ├── kraken.js       # Kraken REST + WebSocket API
│   ├── indicators.js   # All technical indicator math
│   ├── signals.js      # Confluence scoring + signal generation
│   └── ui.js           # DOM rendering + HUD updates
```

---

### Data Layer — Kraken API

**`js/kraken.js`**

- **REST API**: Fetch historical OHLCV candles (`/0/public/OHLC?pair=XBTUSD&interval=5`)
- **WebSocket**: Real-time price feed via `wss://ws.kraken.com` subscribing to `ticker` channel
- Returns clean arrays of `{ time, open, high, low, close, volume }` for indicator calculations
- Supports switching intervals: 5, 15, 60, 240 minutes
- Fetches 720 candles per request (enough history for all indicators)

---

### Technical Indicators Engine

**`js/indicators.js`**

All indicators implemented from scratch using the raw math — no external libraries. Each function takes an array of candles and returns computed values.

| Indicator | Math | Purpose |
|---|---|---|
| **SMA** | Σ(close) / n | Smoothed price trend |
| **EMA** | EMA_prev + α(close - EMA_prev), α = 2/(n+1) | Responsive trend with exponential decay |
| **RSI** (14) | 100 - 100/(1 + avg_gain/avg_loss) | Overbought (>70) / Oversold (<30) |
| **MACD** | EMA(12) - EMA(26), Signal = EMA(9 of MACD) | Momentum crossover signals |
| **Bollinger Bands** | SMA(20) ± 2σ | Volatility squeeze/expansion |
| **Stochastic Oscillator** | %K = (C-L14)/(H14-L14)×100, %D = SMA(3 of %K) | Overbought/oversold momentum |
| **ADX** (14) | Smoothed DX from +DI/-DI | Trend strength (>25 = strong) |
| **VWAP** | Σ(typical_price × volume) / Σ(volume) | Institutional fair value |
| **Fibonacci Retracement** | High - (High-Low) × {0.236, 0.382, 0.5, 0.618, 0.786} | Key reversal levels |
| **ATR** (14) | SMA of True Range | Volatility / stop-loss sizing |
| **OBV** (On Balance Volume) | Running total of signed volume | Volume trend confirmation |
| **RSI Divergence** | Compare price higher-highs vs RSI lower-highs (and inverse) | Early reversal detection |
| **MACD Divergence** | Compare price trend vs MACD histogram trend | Momentum divergence = reversal |

---

### Signal Generation & Confluence Scoring

**`js/signals.js`**

Each indicator generates a sub-signal: **bullish (+1)**, **bearish (-1)**, or **neutral (0)**. These are weighted and combined into a **confluence score** from -100 to +100.

**Weighting system:**

| Signal | Weight | Trigger |
|---|---|---|
| RSI | 15 | <30 = buy, >70 = sell |
| MACD Crossover | 20 | Signal line cross |
| MACD Divergence | 15 | Price/MACD divergence |
| Bollinger Bands | 10 | Price at lower/upper band |
| Stochastic | 10 | %K/%D cross in extreme zones |
| EMA Cross (9/21) | 15 | Golden/death cross |
| ADX + DI | 10 | Trend strength + direction |
| Volume (OBV) | 5 | Volume confirms price move |

**Signal output:**
- Score ≥ **60**: 🟢 **STRONG BUY**
- Score **30–59**: 🟡 **BUY** (moderate confidence)
- Score **-29 to 29**: ⚪ **NEUTRAL** (no action)
- Score **-59 to -30**: 🟡 **SELL** (moderate confidence)
- Score ≤ **-60**: 🔴 **STRONG SELL**

Includes suggested entry price, stop-loss (based on ATR), and take-profit targets (Fibonacci levels).

### Trade Plan Predictions

When a signal is active, the system generates an explicit trade plan:
- **Summary**: "BUY @ $67,500 → SELL @ $67,850"
- **Hold time**: Timeframe-aware (e.g. ~15 min on 5m, ~12 hrs on 4h)
- **Expected move**: Based on ATR × √(swing candles)
- **Stop loss / Take profit**: With exact % risk/reward
- **Reasons**: Top 5 indicators driving the signal
- **Support/Resistance/VWAP zones**

---

### HUD Interface

**`index.html` + `css/styles.css` + `js/ui.js`**

Dark premium HUD design:

- **Header bar**: BTC/USD live price + 24h change + timeframe selector (5m / 15m / 1h / 4h)
- **Trade Plan card**: Explicit "BUY here → SELL there" prediction with entry/exit, hold time, and reasons
- **Signal card**: Confluence confidence %, entry/exit targets, stop-loss
- **Indicator grid**: Mini cards showing each indicator's current state (RSI value, MACD histogram, BB position, etc.)
- **Signal history**: Recent signals with timestamps
- **Pop-out mode**: Button to open a minimal 320×420px window that acts as a compact HUD overlay

**Design**: Dark backgrounds (#06060c), glowing neon accents (green for buy, red for sell), glassmorphism cards, smooth animations, monospaced data font (JetBrains Mono).

---

## Verification Plan

### Browser Testing
1. Start dev server: `npm run dev`
2. Open http://localhost:3000 and verify:
   - Live BTC/USD price appears and updates
   - Timeframe switches work (5m → 15m → 1h → 4h)
   - Indicators calculate and display values
   - Trade Plan shows prediction (or "waiting" when neutral)
   - Signal card shows current recommendation with confidence score
   - Pop-out mini window opens successfully
3. Console check: No errors, WebSocket stays connected

### Manual Verification
- Cross-reference displayed RSI/MACD values with TradingView or Kraken's own charts for the same timeframe to validate math accuracy
- Verify signal changes when switching timeframes
