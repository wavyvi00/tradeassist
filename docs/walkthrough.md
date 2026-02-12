# Trading Signal HUD — Walkthrough

## What Was Built

A real-time BTC/USD swing trade signal advisor that pulls live data from Kraken, runs 13 technical indicators using pure JavaScript math, and displays **BUY/SELL signals with confidence scores** on a premium dark HUD.

## Key Features

| Feature | Details |
|---|---|
| **Live Price** | Real-time via Kraken WebSocket, pulses green on update |
| **13 Indicators** | RSI, MACD, Bollinger Bands, Stochastic, EMA 9/21, SMA 200, ADX, ATR, VWAP, OBV, Fibonacci, RSI divergence, MACD divergence |
| **Confluence Score** | Weighted -100 to +100 system combining all signals |
| **Trade Plan** | Explicit "BUY @ $X → SELL @ $Y" with hold time, expected move, reasons |
| **Timeframes** | Switchable: 5m, 15m, 1h, 4h — each with timeframe-aware predictions |
| **Targets** | Entry, stop-loss (ATR-based), take-profit (Fibonacci levels), risk/reward ratio |
| **Pop-out HUD** | Compact 320×420 overlay window via the ⬗ button |
| **Sound Alerts** | Audio notification on signal changes (toggle with 🔔) |

## Project Structure

```
trading-hud/
├── index.html        ← Main page
├── css/styles.css    ← Dark premium theme
├── js/
│   ├── app.js        ← Main controller
│   ├── kraken.js     ← Kraken REST + WebSocket API
│   ├── indicators.js ← 13 indicators (pure math)
│   ├── signals.js    ← Confluence scoring engine + trade plan
│   └── ui.js         ← DOM rendering + mini HUD
└── docs/
    ├── implementation_plan.md  ← Technical design
    └── walkthrough.md          ← This file
```

## How to Run

```bash
npm install
npm run dev
```

Opens at **http://localhost:3000**

## How The Trade Plan Works

When you select a timeframe (e.g. 5m), the system:
1. Fetches actual 5-minute candles from Kraken
2. Computes all 13 indicators on those candles
3. Each indicator votes BUY (+1), SELL (-1), or NEUTRAL (0)
4. Votes are weighted and combined into a confluence score (-100 to +100)
5. If the score crosses ±30, a trade plan appears:
   - **"BUY @ $67,500 → SELL @ $67,850"**
   - Hold time based on timeframe (5m = ~15 min, 4h = ~12 hrs)
   - Stop loss, take profit, risk/reward ratio
   - Top reasons (e.g. "RSI oversold", "MACD bullish cross")
6. When neutral (score between -29 and +29), it shows "WAITING FOR SETUP" with support/resistance zones

## Auto-Refresh Intervals

| Timeframe | Refresh Rate |
|-----------|-------------|
| 5m | Every 30 seconds |
| 15m | Every 1 minute |
| 1h | Every 2 minutes |
| 4h | Every 5 minutes |

## Verification Results

- ✅ Live price streaming via WebSocket (no errors)
- ✅ All 8 indicator cards rendering with real values
- ✅ Trade Plan card rendering (neutral state with support/resistance zones)
- ✅ Signal breakdown bars with weighted contributions
- ✅ Signal history logging
- ✅ Timeframe switching updates all data correctly
- ✅ Zero console errors

## Technologies

- **Vite** — Dev server & build tool
- **Vanilla JavaScript** — No frameworks
- **Kraken API** — Public REST + WebSocket (no API keys needed)
- **Pure math** — All indicators computed from scratch
