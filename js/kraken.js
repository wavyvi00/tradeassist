// ============================================================
// Kraken API Integration — REST + WebSocket
// ============================================================

const KRAKEN_REST = 'https://api.kraken.com';
const KRAKEN_WS = 'wss://ws.kraken.com';

// Map our interval labels to Kraken API interval values (minutes)
const INTERVAL_MAP = {
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '4h': 240,
};

// Supported pairs configuration
export const PAIRS = {
    'BTC/USD': { rest: 'XBTUSD', ws: 'XBT/USD' },
    'BNB/USD': { rest: 'BNBUSD', ws: 'BNB/USD' },
};

/**
 * Fetch historical OHLCV candles from Kraken REST API
 * @param {string} pair - 'BTC/USD' or 'BNB/USD'
 * @param {string} interval - '5m', '15m', '1h', '4h'
 * @param {number} [since] - Unix timestamp to fetch from
 * @returns {Promise<Array<{time:number, open:number, high:number, low:number, close:number, volume:number}>>}
 */
export async function fetchCandles(pair = 'BTC/USD', interval = '5m', since = null) {
    const krakenInterval = INTERVAL_MAP[interval] || 5;
    const pairConfig = PAIRS[pair] || PAIRS['BTC/USD'];

    let url = `${KRAKEN_REST}/0/public/OHLC?pair=${pairConfig.rest}&interval=${krakenInterval}`;
    if (since) {
        url += `&since=${since}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.error && data.error.length > 0) {
        throw new Error(`Kraken API error: ${data.error.join(', ')}`);
    }

    // Kraken returns data under the pair key
    const pairKey = Object.keys(data.result).find(k => k !== 'last');
    const rawCandles = data.result[pairKey];

    return rawCandles.map(c => ({
        time: Number(c[0]),
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        vwap: parseFloat(c[5]),
        volume: parseFloat(c[6]),
        count: Number(c[7]),
    }));
}

/**
 * Fetch current ticker info (24h stats + last trade price)
 * @param {string} pair - 'BTC/USD' or 'BNB/USD'
 * @returns {Promise<{price:number, bid:number, ask:number, volume24h:number, high24h:number, low24h:number, open24h:number, change24h:number, changePct24h:number}>}
 */
export async function fetchTicker(pair = 'BTC/USD') {
    const pairConfig = PAIRS[pair] || PAIRS['BTC/USD'];
    const url = `${KRAKEN_REST}/0/public/Ticker?pair=${pairConfig.rest}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error && data.error.length > 0) {
        throw new Error(`Kraken API error: ${data.error.join(', ')}`);
    }

    const pairKey = Object.keys(data.result)[0];
    const t = data.result[pairKey];

    const price = parseFloat(t.c[0]); // Last trade price
    const open24h = parseFloat(t.o);
    const change24h = price - open24h;
    const changePct24h = (change24h / open24h) * 100;

    return {
        price,
        bid: parseFloat(t.b[0]),
        ask: parseFloat(t.a[0]),
        volume24h: parseFloat(t.v[1]),
        high24h: parseFloat(t.h[1]),
        low24h: parseFloat(t.l[1]),
        open24h,
        change24h,
        changePct24h,
    };
}

/**
 * Create a WebSocket connection for real-time price updates
 * @param {string} pair - 'BTC/USD' or 'BNB/USD'
 * @param {function} onPrice - Callback with { price, bid, ask, volume }
 * @param {function} onError - Error callback
 * @returns {{ close: function }}
 */
export function createPriceStream(pair, onPrice, onError) {
    let ws = null;
    let reconnectTimer = null;
    let isClosing = false;
    const pairConfig = PAIRS[pair] || PAIRS['BTC/USD'];

    function connect() {
        ws = new WebSocket(KRAKEN_WS);

        ws.onopen = () => {
            console.log(`[Kraken WS] Connected (${pair})`);
            // Subscribe to ticker for the pair
            ws.send(JSON.stringify({
                event: 'subscribe',
                pair: [pairConfig.ws],
                subscription: { name: 'ticker' },
            }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);

                // Skip system messages
                if (msg.event) return;

                // Ticker update: [channelID, tickerData, channelName, pair]
                if (Array.isArray(msg) && msg.length >= 4) {
                    const ticker = msg[1];
                    if (ticker && ticker.c) {
                        onPrice({
                            price: parseFloat(ticker.c[0]),
                            bid: parseFloat(ticker.b[0]),
                            ask: parseFloat(ticker.a[0]),
                            volume: parseFloat(ticker.v[1]),
                            high: parseFloat(ticker.h[1]),
                            low: parseFloat(ticker.l[1]),
                        });
                    }
                }
            } catch (e) {
                // Skip non-JSON or malformed messages
            }
        };

        ws.onerror = (error) => {
            console.error('[Kraken WS] Error:', error);
            if (onError) onError(error);
        };

        ws.onclose = () => {
            console.log('[Kraken WS] Disconnected');
            if (!isClosing) {
                // Auto-reconnect after 3 seconds
                reconnectTimer = setTimeout(connect, 3000);
            }
        };
    }

    connect();

    return {
        close() {
            isClosing = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (ws) ws.close();
        },
    };
}
