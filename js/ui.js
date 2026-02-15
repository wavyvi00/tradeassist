// ============================================================
// UI Rendering Module — HUD Display
// ============================================================

import { getSignalHistory } from './signals.js';

/**
 * Update the live price display
 */
export function updatePrice(price, change24h, changePct24h) {
  const priceEl = document.getElementById('live-price');
  const changeEl = document.getElementById('price-change');

  if (priceEl) {
    priceEl.textContent = formatPrice(price);
    priceEl.className = 'price-value';
  }

  if (changeEl && change24h !== undefined) {
    const isPositive = change24h >= 0;
    const sign = isPositive ? '+' : '';
    changeEl.textContent = `${sign}${formatPrice(change24h)} (${sign}${changePct24h.toFixed(2)}%)`;
    changeEl.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
  }
}

/**
 * Update the main signal card
 */
export function updateSignalCard(signal) {
  const card = document.getElementById('signal-card');
  if (!card) return;

  // Signal action
  const actionEl = card.querySelector('.signal-action');
  if (actionEl) {
    actionEl.textContent = `${signal.emoji} ${signal.action}`;
    actionEl.style.color = signal.color;
  }

  // Confidence score
  const scoreEl = card.querySelector('.signal-score');
  if (scoreEl) {
    // Show Probability if available, otherwise just use score
    const scoreVal = signal.probability ? `${signal.probability}%` : `${Math.abs(signal.score)}%`;
    const scoreLabel = signal.probability ? 'Probability' : 'Confidence';
    scoreEl.textContent = scoreVal;
    scoreEl.style.color = signal.color;

    // Update label if needed
    const labelEl = card.querySelector('.signal-score-label');
    if (labelEl) labelEl.textContent = scoreLabel;
  }

  // Determine visual style
  const type = signal.type;

  if (type === 'UP' || type === 'DOWN') {
    // PancakeSwap Prediction Mode
    actionEl.textContent = type;
    actionEl.style.color = type === 'UP' ? 'var(--green)' : 'var(--red)';
    card.style.borderColor = type === 'UP' ? 'var(--green)' : 'var(--red)';
    card.style.boxShadow = `0 0 20px ${type === 'UP' ? 'var(--green)' : 'var(--red)'}20`;

    // Force display
    const targetsEl = card.querySelector('.signal-targets');
    if (targetsEl) targetsEl.style.display = 'block';
    const neutralMsg = card.querySelector('.neutral-msg');
    if (neutralMsg) neutralMsg.style.display = 'none';

  } else if (type === 'NEUTRAL') {
    actionEl.textContent = 'WAIT FOR SETUP';
    actionEl.style.color = 'var(--text-muted)';
    card.style.borderColor = 'var(--border)';
    card.style.boxShadow = 'none';

    // Hide targets
    const targetsEl = card.querySelector('.signal-targets');
    if (targetsEl) targetsEl.style.display = 'none';

    // Show message
    let neutralMsg = card.querySelector('.neutral-msg');
    if (!neutralMsg) {
      neutralMsg = document.createElement('div');
      neutralMsg.className = 'neutral-msg';
      neutralMsg.textContent = 'Market is ranging. Waiting for clear signal...';
      const body = card.querySelector('.signal-body');
      if (body) body.appendChild(neutralMsg);
    }
    neutralMsg.style.display = 'block';
  } else {
    // Normal Buy/Sell
    actionEl.textContent = type;
    actionEl.style.color = signal.color;
    card.style.borderColor = signal.color;
    card.style.boxShadow = `0 0 20px ${signal.color}20`;

    const targetsEl = card.querySelector('.signal-targets');
    if (targetsEl) targetsEl.style.display = 'block';

    const neutralMsg = card.querySelector('.neutral-msg');
    if (neutralMsg) neutralMsg.style.display = 'none';
  }

  // Score bar
  const barFill = card.querySelector('.score-bar-fill');
  if (barFill) {
    const normalizedScore = (signal.score + 100) / 2; // 0-100 range
    barFill.style.width = `${normalizedScore}%`;
    barFill.style.background = `linear-gradient(90deg, #ff3344, #888888 50%, #00ff88)`;
  }

  // Score marker
  const marker = card.querySelector('.score-marker');
  if (marker) {
    const normalizedScore = (signal.score + 100) / 2;
    marker.style.left = `${normalizedScore}%`;
  }

  // Targets
  const targetsEl = card.querySelector('.signal-targets');
  if (targetsEl && signal.targets.entry !== null) {
    const isBuy = signal.action.includes('BUY');

    // Add MPO display
    const mpoHtml = signal.tradePlan.mpo ? `
      <div class="target-row mpo-row">
        <span class="target-label">Most Possible Range</span>
        <span class="target-value">${formatPrice(signal.tradePlan.mpo.low)} - ${formatPrice(signal.tradePlan.mpo.high)}</span>
      </div>
    ` : '';

    targetsEl.innerHTML = `
      <div class="target-row">
        <span class="target-label">Entry</span>
        <span class="target-value">${formatPrice(signal.targets.entry)}</span>
      </div>
      ${mpoHtml}
      <div class="target-row ${isBuy ? 'stop-loss' : 'stop-loss'}">
        <span class="target-label">Stop Loss</span>
        <span class="target-value">${formatPrice(signal.targets.stopLoss)}</span>
      </div>
      ${signal.targets.takeProfits.map(tp => `
        <div class="target-row take-profit">
          <span class="target-label">${tp.label}</span>
          <span class="target-value">${formatPrice(tp.price)}</span>
        </div>
      `).join('')}
      <div class="target-row risk-reward">
        <span class="target-label">Risk/Reward</span>
        <span class="target-value">1:${signal.targets.riskReward}</span>
      </div>
    `;
  } else if (targetsEl) {
    targetsEl.innerHTML = '<div class="target-row neutral-msg">No active trade signal</div>';
  }

  // Card glow effect
  card.style.borderColor = signal.color + '40';
  card.style.boxShadow = `0 0 30px ${signal.color}15, inset 0 0 30px ${signal.color}05`;
}

/**
 * Update the trade plan — the explicit "BUY here → SELL there" prediction
 */
export function updateTradePlan(plan, signal) {
  const container = document.getElementById('trade-plan');
  if (!container) return;

  if (plan.action === 'WAIT') {
    container.innerHTML = `
          <div class="trade-plan-card neutral">
            <div class="plan-header">
              <span class="plan-icon">⏳</span>
              <span class="plan-title">WAITING FOR SETUP</span>
            </div>
            <div class="plan-summary-text">${plan.summary}</div>
            <div class="plan-zones">
              <div class="zone-row">
                <span class="zone-label">Support Zone</span>
                <span class="zone-value">${plan.support ? formatPrice(plan.support) : '—'}</span>
              </div>
              <div class="zone-row">
                <span class="zone-label">Resistance Zone</span>
                <span class="zone-value">${plan.resistance ? formatPrice(plan.resistance) : '—'}</span>
              </div>
            </div>
            <div class="plan-hint">A signal will appear when indicators align. Watch for price near support/resistance.</div>
          </div>
        `;
    container.style.borderColor = '#555570';
    return;
  }

  const isBuy = plan.action === 'BUY';
  const accentColor = isBuy ? '#00ff88' : '#ff3344';
  const actionWord = isBuy ? 'BUY' : 'SELL';
  const exitWord = isBuy ? 'SELL' : 'BUY BACK';

  container.innerHTML = `
      <div class="trade-plan-card ${isBuy ? 'buy' : 'sell'}">
        <div class="plan-header">
          <span class="plan-icon">${isBuy ? '🟢' : '🔴'}</span>
          <span class="plan-title">${signal.action}</span>
          <span class="plan-timeframe">${plan.timeframeLabel} timeframe</span>
        </div>
        
        <div class="plan-prediction">
          <div class="plan-summary-text" style="color: ${accentColor}">${plan.summary}</div>
        </div>

        <div class="plan-details">
          <div class="plan-detail-row entry">
            <div class="detail-icon">→</div>
            <div>
              <div class="detail-label">${actionWord} Entry</div>
              <div class="detail-value">${formatPrice(plan.entry)}</div>
            </div>
          </div>
          <div class="plan-detail-row exit">
            <div class="detail-icon ${isBuy ? 'green' : 'red'}">⬆</div>
            <div>
              <div class="detail-label">${exitWord} Target</div>
              <div class="detail-value ${isBuy ? 'green' : 'red'}">${plan.exit ? formatPrice(plan.exit) : '—'}</div>
            </div>
            <div class="detail-percent ${isBuy ? 'green' : 'red'}">+${plan.profitPercent || '0'}%</div>
          </div>
          <div class="plan-detail-row stoploss">
            <div class="detail-icon red">✕</div>
            <div>
              <div class="detail-label">Stop Loss</div>
              <div class="detail-value red">${formatPrice(plan.stopLoss)}</div>
            </div>
            <div class="detail-percent red">-${plan.lossPercent || '0'}%</div>
          </div>
        </div>

        <div class="plan-meta">
          <div class="meta-item">
            <span class="meta-label">Hold Time</span>
            <span class="meta-value">${plan.holdLabel}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Expected Move</span>
            <span class="meta-value">${plan.expectedMove ? formatPrice(plan.expectedMove) : '—'} (${plan.expectedMovePercent?.toFixed(2) || '0'}%)</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">R:R Ratio</span>
            <span class="meta-value">1:${signal.targets.riskReward || '—'}</span>
          </div>
        </div>

        ${plan.reasons.length > 0 ? `
          <div class="plan-reasons">
            <div class="reasons-title">WHY</div>
            ${plan.reasons.map(r => `<span class="reason-tag">${r}</span>`).join('')}
          </div>
        ` : ''}

        <div class="plan-zones">
          <div class="zone-row">
            <span class="zone-label">Support</span>
            <span class="zone-value">${formatPrice(plan.support)}</span>
          </div>
          <div class="zone-row">
            <span class="zone-label">Resistance</span>
            <span class="zone-value">${formatPrice(plan.resistance)}</span>
          </div>
          ${plan.vwapZone ? `
            <div class="zone-row">
              <span class="zone-label">VWAP</span>
              <span class="zone-value">${formatPrice(plan.vwapZone)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  container.style.borderColor = accentColor + '40';
}

/**
 * Update indicator breakdown grid
 */
export function updateIndicatorGrid(signal, indicators) {
  const grid = document.getElementById('indicator-grid');
  if (!grid) return;

  const cards = [
    {
      label: 'RSI (14)',
      value: indicators.rsi.value !== null ? indicators.rsi.value.toFixed(1) : '—',
      status: indicators.rsi.isOverbought ? 'overbought' : indicators.rsi.isOversold ? 'oversold' : 'neutral',
      sublabel: indicators.rsi.isOverbought ? 'OVERBOUGHT' : indicators.rsi.isOversold ? 'OVERSOLD' : 'Normal',
    },
    {
      label: 'MACD',
      value: indicators.macd.histogram !== null ? indicators.macd.histogram.toFixed(1) : '—',
      status: indicators.macd.isBullishCross ? 'bullish' : indicators.macd.isBearishCross ? 'bearish' :
        indicators.macd.isAboveZero ? 'bullish-mild' : 'bearish-mild',
      sublabel: indicators.macd.isBullishCross ? '↗ BULL CROSS' : indicators.macd.isBearishCross ? '↘ BEAR CROSS' :
        indicators.macd.isAboveZero ? 'Above zero' : 'Below zero',
    },
    {
      label: 'Bollinger %B',
      value: indicators.bollinger.percentB !== null ? (indicators.bollinger.percentB * 100).toFixed(1) + '%' : '—',
      status: indicators.bollinger.isNearLower ? 'oversold' : indicators.bollinger.isNearUpper ? 'overbought' : 'neutral',
      sublabel: indicators.bollinger.isNearLower ? 'Near Lower' : indicators.bollinger.isNearUpper ? 'Near Upper' :
        indicators.bollinger.isSqueeze ? 'SQUEEZE' : 'Mid Band',
    },
    {
      label: 'Stochastic',
      value: indicators.stochastic.k !== null ? indicators.stochastic.k.toFixed(1) : '—',
      status: indicators.stochastic.isOversold ? 'oversold' : indicators.stochastic.isOverbought ? 'overbought' : 'neutral',
      sublabel: indicators.stochastic.isBullishCross ? '↗ BULL CROSS' : indicators.stochastic.isBearishCross ? '↘ BEAR CROSS' :
        indicators.stochastic.isOverbought ? 'OVERBOUGHT' : indicators.stochastic.isOversold ? 'OVERSOLD' : 'Normal',
    },
    {
      label: 'EMA 9/21',
      value: indicators.ema.ema9 !== null ? formatPrice(indicators.ema.ema9) : '—',
      status: indicators.ema.ema9AboveEma21 ? 'bullish' : 'bearish',
      sublabel: indicators.ema.ema9AboveEma21 ? '↗ Bullish Trend' : '↘ Bearish Trend',
    },
    {
      label: 'ADX',
      value: indicators.adx.value !== null ? indicators.adx.value.toFixed(1) : '—',
      status: indicators.adx.isStrong ? (indicators.adx.isBullish ? 'bullish' : 'bearish') : 'neutral',
      sublabel: indicators.adx.isStrong ?
        (indicators.adx.isBullish ? 'Strong ↗ Trend' : 'Strong ↘ Trend') : 'Weak/Ranging',
    },
    {
      label: 'VWAP',
      value: indicators.vwap.value !== null ? formatPrice(indicators.vwap.value) : '—',
      status: indicators.vwap.priceAboveVwap ? 'bullish' : 'bearish',
      sublabel: indicators.vwap.priceAboveVwap ? 'Price Above' : 'Price Below',
    },
    {
      label: 'ATR (14)',
      value: indicators.atr.value !== null ? formatPrice(indicators.atr.value) : '—',
      status: 'neutral',
      sublabel: indicators.atr.percent !== null ? `${indicators.atr.percent.toFixed(2)}% volatility` : '',
    },
  ];

  grid.innerHTML = cards.map(card => `
    <div class="indicator-card ${card.status}">
      <div class="indicator-label">${card.label}</div>
      <div class="indicator-value">${card.value}</div>
      <div class="indicator-sublabel">${card.sublabel}</div>
    </div>
  `).join('');
}

/**
 * Update signal breakdown bars
 */
export function updateBreakdown(breakdown) {
  const container = document.getElementById('signal-breakdown');
  if (!container) return;

  container.innerHTML = breakdown.map(item => {
    const percent = Math.abs(item.signal) * 100;
    const isPositive = item.signal > 0;
    return `
      <div class="breakdown-row">
        <div class="breakdown-label">${item.name}</div>
        <div class="breakdown-bar-container">
          <div class="breakdown-bar ${item.direction}" style="width: ${percent}%; ${isPositive ? '' : 'transform: scaleX(-1);'}"></div>
        </div>
        <div class="breakdown-weight">${item.weight}w</div>
      </div>
    `;
  }).join('');
}

/**
 * Update signal history
 */
export function updateHistory() {
  const container = document.getElementById('signal-history');
  if (!container) return;

  const history = getSignalHistory();
  if (history.length === 0) {
    container.innerHTML = '<div class="history-empty">No signals recorded yet</div>';
    return;
  }

  container.innerHTML = history.slice().reverse().map(h => `
    <div class="history-row">
      <span class="history-time">${formatTime(h.timestamp)}</span>
      <span class="history-action" style="color: ${h.color}">${h.action}</span>
      <span class="history-price">${h.price !== null ? formatPrice(h.price) : '—'}</span>
      <span class="history-score" style="color: ${h.color}">${h.score > 0 ? '+' : ''}${h.score}</span>
    </div>
  `).join('');
}

/**
 * Update connection status indicator
 */
export function updateConnectionStatus(connected) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (dot) dot.className = `status-dot ${connected ? 'connected' : 'disconnected'}`;
  if (text) text.textContent = connected ? 'LIVE' : 'Reconnecting...';
}

/**
 * Set the active timeframe button
 */
export function setActiveTimeframe(tf) {
  document.querySelectorAll('.tf-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tf === tf);
  });
}

/**
 * Update last updated timestamp
 */
export function updateLastRefresh() {
  const el = document.getElementById('last-refresh');
  if (el) el.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
}

/**
 * Show loading state
 */
export function showLoading(show) {
  const loader = document.getElementById('loader');
  const content = document.getElementById('main-content');
  if (loader) loader.style.display = show ? 'flex' : 'none';
  if (content) content.style.opacity = show ? '0.3' : '1';
}

/**
 * Open mini HUD in a popup window
 */
export function openMiniHUD(signal) {
  const width = 320;
  const height = 420;
  const left = screen.width - width - 20;
  const top = 60;

  const popup = window.open('', 'tradingHUD', `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=no,resizable=yes`);

  if (!popup) {
    alert('Please allow popups for the mini HUD overlay');
    return;
  }

  updateMiniHUD(popup, signal);
}

export function updateMiniHUD(popup, signal, price, change) {
  if (!popup || popup.closed) return;

  popup.document.title = `BTC ${signal.emoji} ${signal.action}`;

  popup.document.body.innerHTML = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: #0a0a0f;
        color: #e0e0e0;
        font-family: 'JetBrains Mono', 'SF Mono', monospace;
        padding: 16px;
        user-select: none;
      }
      .mini-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #1a1a2e;
      }
      .mini-pair { font-size: 14px; color: #888; }
      .mini-price { font-size: 24px; font-weight: 700; color: #fff; }
      .mini-change { font-size: 12px; }
      .mini-change.positive { color: #00ff88; }
      .mini-change.negative { color: #ff3344; }
      .mini-signal {
        text-align: center;
        padding: 20px 0;
        margin: 12px 0;
        border-radius: 12px;
        background: ${signal.color}10;
        border: 1px solid ${signal.color}30;
      }
      .mini-action {
        font-size: 22px;
        font-weight: 900;
        color: ${signal.color};
        letter-spacing: 2px;
      }
      .mini-score {
        font-size: 36px;
        font-weight: 900;
        color: ${signal.color};
        margin-top: 4px;
      }
      .mini-targets {
        margin-top: 12px;
        font-size: 12px;
      }
      .mini-target-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px solid #111;
      }
      .mini-target-label { color: #666; }
      .mini-target-value { color: #ccc; font-weight: 600; }
      .mini-target-row.stop-loss .mini-target-value { color: #ff3344; }
      .mini-target-row.take-profit .mini-target-value { color: #00ff88; }
      .mini-footer {
        margin-top: 12px;
        text-align: center;
        font-size: 10px;
        color: #444;
      }
    </style>
    <div class="mini-header">
      <div>
        <div class="mini-pair">BTC / USD</div>
        <div class="mini-price">${price ? formatPrice(price) : '—'}</div>
      </div>
      <div class="mini-change ${change >= 0 ? 'positive' : 'negative'}">
        ${change !== undefined ? (change >= 0 ? '+' : '') + change.toFixed(2) + '%' : ''}
      </div>
    </div>
    <div class="mini-signal">
      <div class="mini-action">${signal.emoji} ${signal.action}</div>
      <div class="mini-score">${Math.abs(signal.score)}%</div>
    </div>
    <div class="mini-targets">
      ${signal.targets.entry !== null ? `
        <div class="mini-target-row">
          <span class="mini-target-label">Entry</span>
          <span class="mini-target-value">${formatPrice(signal.targets.entry)}</span>
        </div>
        <div class="mini-target-row stop-loss">
          <span class="mini-target-label">Stop Loss</span>
          <span class="mini-target-value">${formatPrice(signal.targets.stopLoss)}</span>
        </div>
        ${signal.targets.takeProfits.map(tp => `
          <div class="mini-target-row take-profit">
            <span class="mini-target-label">${tp.label}</span>
            <span class="mini-target-value">${formatPrice(tp.price)}</span>
          </div>
        `).join('')}
        <div class="mini-target-row">
          <span class="mini-target-label">R:R</span>
          <span class="mini-target-value">1:${signal.targets.riskReward}</span>
        </div>
      ` : '<div class="mini-target-row"><span class="mini-target-label">No active signal</span></div>'}
    </div>
    <div class="mini-footer">Trading HUD • Auto-refreshing</div>
  `;
}

// Helpers
function formatPrice(price) {
  if (price === null || price === undefined) return '—';
  return price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: price > 1000 ? 0 : 2,
    maximumFractionDigits: price > 1000 ? 0 : 2,
  });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
