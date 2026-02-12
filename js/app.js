// ============================================================
// Main App Controller — Ties everything together
// ============================================================

import { fetchCandles, fetchTicker, createPriceStream } from './kraken.js';
import { computeAll } from './indicators.js';
import { generateSignal, recordSignal } from './signals.js';
import {
    updatePrice,
    updateSignalCard,
    updateIndicatorGrid,
    updateBreakdown,
    updateHistory,
    updateTradePlan,
    updateConnectionStatus,
    setActiveTimeframe,
    updateLastRefresh,
    showLoading,
    openMiniHUD,
    updateMiniHUD,
} from './ui.js';

// ---- State ----
let currentTimeframe = '15m'; // Default
let candles = [];
let currentSignal = null;
let currentIndicators = null;
let priceStream = null;
let miniHUDWindow = null;
let refreshInterval = null;
let livePrice = null;
let liveChange = null;

// Refresh intervals per timeframe (ms)
const REFRESH_INTERVALS = {
    '5m': 30 * 1000,    // 30 seconds
    '15m': 60 * 1000,   // 1 minute
    '1h': 120 * 1000,   // 2 minutes
    '4h': 300 * 1000,   // 5 minutes
};

// ---- Initialization ----
async function init() {
    console.log('[App] Initializing Trading HUD...');
    showLoading(true);

    // Set up timeframe buttons
    document.querySelectorAll('.tf-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tf = btn.dataset.tf;
            if (tf !== currentTimeframe) {
                switchTimeframe(tf);
            }
        });
    });

    // Pop-out button
    const popoutBtn = document.getElementById('popout-btn');
    if (popoutBtn) {
        popoutBtn.addEventListener('click', () => {
            if (currentSignal) {
                miniHUDWindow = window.open('', 'tradingHUD', `width=320,height=420,left=${screen.width - 340},top=60,toolbar=no,menubar=no,scrollbars=no,resizable=yes`);
                if (miniHUDWindow) {
                    updateMiniHUD(miniHUDWindow, currentSignal, livePrice, liveChange);
                } else {
                    alert('Please allow popups for the mini HUD overlay');
                }
            }
        });
    }

    // Sound toggle
    const soundBtn = document.getElementById('sound-btn');
    if (soundBtn) {
        soundBtn.addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            soundBtn.textContent = soundEnabled ? '🔔' : '🔕';
            soundBtn.classList.toggle('active', soundEnabled);
        });
    }

    setActiveTimeframe(currentTimeframe);

    // Start data feed
    await fetchAndAnalyze();
    startPriceStream();
    startAutoRefresh();

    showLoading(false);
    console.log('[App] Trading HUD ready!');
}

let soundEnabled = true;

// ---- Data Flow ----

/**
 * Fetch candles, compute indicators, generate signal
 */
async function fetchAndAnalyze() {
    try {
        // Fetch candles and ticker in parallel
        const [candleData, tickerData] = await Promise.all([
            fetchCandles(currentTimeframe),
            fetchTicker(),
        ]);

        candles = candleData;
        livePrice = tickerData.price;
        liveChange = tickerData.changePct24h;

        // Update price display
        updatePrice(tickerData.price, tickerData.change24h, tickerData.changePct24h);

        // Compute all indicators
        currentIndicators = computeAll(candles);

        // Generate signal with timeframe context
        currentSignal = generateSignal(currentIndicators, currentTimeframe);

        // Check if signal changed (for alerts)
        const changed = recordSignal(currentSignal);

        // Update UI
        updateSignalCard(currentSignal);
        updateTradePlan(currentSignal.tradePlan, currentSignal);
        updateIndicatorGrid(currentSignal, currentIndicators);
        updateBreakdown(currentSignal.breakdown);
        updateHistory();
        updateLastRefresh();
        updateConnectionStatus(true);

        // Update mini HUD if open
        if (miniHUDWindow && !miniHUDWindow.closed) {
            updateMiniHUD(miniHUDWindow, currentSignal, livePrice, liveChange);
        }

        // Play alert sound on signal change
        if (changed && soundEnabled && currentSignal.level !== 'neutral') {
            playAlertSound(currentSignal.action.includes('BUY'));
        }

    } catch (error) {
        console.error('[App] Error fetching data:', error);
        updateConnectionStatus(false);
    }
}

/**
 * Start WebSocket for real-time price updates
 */
function startPriceStream() {
    if (priceStream) priceStream.close();

    priceStream = createPriceStream(
        (data) => {
            livePrice = data.price;
            // Update the price display in real-time
            // (Full indicator recalc happens on the refresh interval)
            const priceEl = document.getElementById('live-price');
            if (priceEl) {
                priceEl.textContent = data.price.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                });
            }

            // Pulse animation on price update
            if (priceEl) {
                priceEl.classList.add('pulse');
                setTimeout(() => priceEl.classList.remove('pulse'), 300);
            }
        },
        (error) => {
            updateConnectionStatus(false);
        }
    );
}

/**
 * Auto-refresh indicators on interval
 */
function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    const interval = REFRESH_INTERVALS[currentTimeframe] || 60000;
    refreshInterval = setInterval(fetchAndAnalyze, interval);
}

/**
 * Switch timeframe
 */
async function switchTimeframe(tf) {
    currentTimeframe = tf;
    setActiveTimeframe(tf);
    showLoading(true);
    await fetchAndAnalyze();
    startAutoRefresh(); // Reset refresh interval
    showLoading(false);
}

/**
 * Play a notification sound
 */
function playAlertSound(isBullish) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(isBullish ? 880 : 440, ctx.currentTime);

        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);

        // Second tone for emphasis
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(isBullish ? 1320 : 330, ctx.currentTime + 0.15);
        gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.6);
    } catch (e) {
        // Audio not available
    }
}

// ---- Start ----
document.addEventListener('DOMContentLoaded', init);
