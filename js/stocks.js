// ============================================================
// Stock Market Data Manager — Finnhub API Integration
// ============================================================

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const DEFAULT_API_KEY = 'd6ane0hr01qqjvbr3lugd6ane0hr01qqjvbr3lv0'; // User provided key

// State
let apiKey = localStorage.getItem('finnhub_api_key') || DEFAULT_API_KEY;

/**
 * Set and save API key
 */
export function setFinnhubKey(key) {
    apiKey = key;
    localStorage.setItem('finnhub_api_key', key);
}

/**
 * Get current API key
 */
export function getFinnhubKey() {
    return apiKey;
}

/**
 * Fetch Stock Candles (OHLCV)
 * @param {string} symbol - e.g. 'AAPL'
 * @param {string} timeframe - '5m', '15m', '1h', 'D', 'W'
 */
export async function fetchStockCandles(symbol, timeframe = '15m') {
    if (!apiKey) throw new Error('API Key missing');

    // Map timeframe to Finnhub resolution
    // Finnhub supports: 1, 5, 15, 30, 60, D, W, M
    const resolutionMap = {
        '5m': '5',
        '15m': '15',
        '1h': '60',
        '4h': '60', // Finnhub free doesn't have 4h, use 1h and maybe aggregate or just show 1h
        'D': 'D',
        'W': 'W'
    };

    // Default to 'D' if not found, or closest match
    const resolution = resolutionMap[timeframe] || 'D';

    // Calculate 'from' and 'to' timestamps
    const now = Math.floor(Date.now() / 1000);
    let from;

    // Adjust lookback based on timeframe
    switch (resolution) {
        case '5': from = now - (24 * 60 * 60); break; // 1 day
        case '15': from = now - (3 * 24 * 60 * 60); break; // 3 days
        case '60': from = now - (10 * 24 * 60 * 60); break; // 10 days
        case 'D': from = now - (365 * 24 * 60 * 60); break; // 1 year
        case 'W': from = now - (5 * 365 * 24 * 60 * 60); break; // 5 years
        default: from = now - (30 * 24 * 60 * 60);
    }

    try {
        const url = `${FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}&token=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`[Finnhub] API Error ${response.status}: ${response.statusText}. Using Mock Data.`);
            return getMockCandles(symbol, resolution, from, now);
        }

        const data = await response.json();

        if (data.s === 'no_data') return [];

        if (!data.t) return [];

        return data.t.map((timestamp, index) => ({
            time: timestamp, // Seconds
            open: data.o[index],
            high: data.h[index],
            low: data.l[index],
            close: data.c[index],
            volume: data.v[index]
        }));
    } catch (e) {
        console.error('[Finnhub] Candle Fetch Error:', e);
        return getMockCandles(symbol, resolution, from, now);
    }
}

/**
 * Fetch Quote (Real-time price)
 */
export async function fetchStockQuote(symbol) {
    if (!apiKey) throw new Error('API Key missing');

    try {
        const url = `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            return getMockQuote(symbol);
        }

        const data = await response.json();

        return {
            price: data.c,
            change24h: data.d,
            changePct24h: data.dp,
            high24h: data.h,
            low24h: data.l,
            open24h: data.o,
            prevClose: data.pc
        };
    } catch (e) {
        console.error('[Finnhub] Quote Error:', e);
        return getMockQuote(symbol);
    }
}

/**
 * Fetch Company Profile & Basic Financials
 */
export async function fetchStockFinancials(symbol) {
    if (!apiKey) throw new Error('API Key missing');

    try {
        const [profileRes, metricsRes] = await Promise.all([
            fetch(`${FINNHUB_BASE}/stock/profile2?symbol=${symbol}&token=${apiKey}`),
            fetch(`${FINNHUB_BASE}/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`)
        ]);

        if (!profileRes.ok || !metricsRes.ok) throw new Error('Financials API Error');

        const profile = await profileRes.json();
        const metrics = await metricsRes.json();

        return {
            profile,
            metrics: metrics.metric || {}
        };
    } catch (e) {
        console.error('[Finnhub] Financials Error:', e);
        return getMockFinancials(symbol);
    }
}

// ============================================================
// MOCK DATA GENERATORS (Fallback)
// ============================================================

function getMockQuote(symbol) {
    const base = symbol === 'AAPL' ? 150 : (symbol === 'TSLA' ? 200 : 100);
    const price = base + (Math.random() * 10 - 5);
    return {
        price: price,
        change24h: 1.5,
        changePct24h: 1.25,
        high24h: price + 2,
        low24h: price - 2,
        open24h: base,
        prevClose: base
    };
}

function getMockCandles(symbol, resolution, from, now) {
    const candles = [];
    let price = symbol === 'AAPL' ? 150 : 100;
    const step = 60 * (resolution === 'D' ? 1440 : (parseInt(resolution) || 15));

    for (let t = from; t <= now; t += step) {
        const change = (Math.random() - 0.5) * 2;
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random();
        const low = Math.min(open, close) - Math.random();

        candles.push({
            time: t,
            open, high, low, close,
            volume: Math.floor(Math.random() * 100000)
        });
        price = close;
    }
    return candles;
}

function getMockFinancials(symbol) {
    return {
        profile: {
            name: symbol,
            ticker: symbol,
            logo: '',
            finnhubIndustry: 'Technology',
            exchange: 'NASDAQ',
            ipo: '1980-12-12'
        },
        metrics: {
            marketCapitalization: 2000000,
            peAnnual: 25.5,
            dividendYieldIndicatedAnnual: 0.5,
            beta: 1.2,
            '52WeekHigh': 200,
            '52WeekLow': 100,
            peTTM: 24.0,
            epsTTM: 5.5,
            pbAnnual: 10.0,
            yearToDatePriceReturnDaily: 15.0
        }
    };
}

/**
 * Generate Analysis and Prediction
 */
export function generateStockPrediction(symbol, timeframe, indicators, financials) {
    // Basic logic combining technicals and financials

    let score = 0;
    const reasons = [];
    const breakdown = [];

    // --- Technical Analysis ---

    // RSI
    if (indicators.rsi.value < 30) {
        score += 25;
        breakdown.push({ name: 'RSI', signal: 1, weight: 1 });
        reasons.push('RSI is Oversold (Bullish)');
    } else if (indicators.rsi.value > 70) {
        score -= 25;
        breakdown.push({ name: 'RSI', signal: -1, weight: 1 });
        reasons.push('RSI is Overbought (Bearish)');
    }

    // MACD
    if (indicators.macd.isBullishCross) {
        score += 20;
        breakdown.push({ name: 'MACD', signal: 1, weight: 1 });
        reasons.push('MACD Bullish Cross');
    } else if (indicators.macd.isBearishCross) {
        score -= 20;
        breakdown.push({ name: 'MACD', signal: -1, weight: 1 });
        reasons.push('MACD Bearish Cross');
    }

    // EMA Trend
    if (indicators.ema.ema9AboveEma21) {
        score += 15;
        breakdown.push({ name: 'Trend', signal: 1, weight: 1 });
    } else {
        score -= 15;
        breakdown.push({ name: 'Trend', signal: -1, weight: 1 });
    }

    // --- Fundamental Analysis (Bonus for Long Term) ---
    // Only apply if we have financial data
    if (financials && financials.metrics) {
        const m = financials.metrics;

        // PE Ratio check (Simplified)
        if (m['peAnnual']) {
            if (m['peAnnual'] < 15 && m['peAnnual'] > 0) {
                score += 10;
                reasons.push(`Attractive P/E Ratio (${m['peAnnual'].toFixed(2)})`);
            } else if (m['peAnnual'] > 50) {
                score -= 10;
                reasons.push(`High P/E Ratio (${m['peAnnual'].toFixed(2)})`);
            }
        }

        // 52 Week High/Low Position
        if (m['52WeekHigh'] && m['52WeekLow']) {
            const range = m['52WeekHigh'] - m['52WeekLow'];
            const current = (indicators.price.current - m['52WeekLow']) / range;

            if (current < 0.1) {
                score += 10;
                reasons.push('Price near 52-Week Low');
            } else if (current > 0.9) {
                score -= 10;
                reasons.push('Price near 52-Week High');
            }
        }
    }

    // Determine Action
    let action = 'NEUTRAL';
    let color = '#888888';
    let emoji = '⚪';

    if (score >= 30) {
        action = 'STRONG BUY';
        color = '#00ff88'; // var(--green)
        emoji = '🚀';
    } else if (score >= 10) {
        action = 'BUY';
        color = '#00cc66';
        emoji = '🟢';
    } else if (score <= -30) {
        action = 'STRONG SELL';
        color = '#ff3344'; // var(--red)
        emoji = '🩸';
    } else if (score <= -10) {
        action = 'SELL';
        color = '#cc2233';
        emoji = '🔴';
    }

    // Mock targets for now based on ATR
    const currentPrice = indicators.price.current;
    const atr = indicators.atr.value || (currentPrice * 0.02);

    const targets = {
        entry: currentPrice,
        stopLoss: action.includes('BUY') ? currentPrice - (atr * 1.5) : currentPrice + (atr * 1.5),
        takeProfits: [
            { price: action.includes('BUY') ? currentPrice + (atr * 2) : currentPrice - (atr * 2), label: 'TP1 (Swing)' },
            { price: action.includes('BUY') ? currentPrice + (atr * 4) : currentPrice - (atr * 4), label: 'TP2 (Long)' }
        ],
        riskReward: '1:2' // Simplified
    };

    return {
        action,
        score,
        color,
        emoji,
        reasons,
        breakdown,
        targets,
        tradePlan: {
            action: action.includes('BUY') ? 'BUY' : (action.includes('SELL') ? 'SELL' : 'WAIT'),
            summary: `Technical analysis suggests a ${action.toLowerCase()} due to ${reasons[0] || 'market conditions'}.`,
            timeframeLabel: timeframe,
            entry: targets.entry,
            stopLoss: targets.stopLoss,
            exit: targets.takeProfits[0].price,
            profitPercent: ((Math.abs(targets.takeProfits[0].price - currentPrice) / currentPrice) * 100).toFixed(2),
            lossPercent: ((Math.abs(targets.stopLoss - currentPrice) / currentPrice) * 100).toFixed(2),
            holdLabel: timeframe === '5m' ? 'Intraday' : (timeframe === '15m' ? '1-3 Days' : '1-2 Weeks'),
            support: currentPrice - atr,
            resistance: currentPrice + atr,
            reasons: reasons
        }
    };
}
