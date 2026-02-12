// ============================================================
// Technical Indicators Engine — Pure Math, No Libraries
// All indicators computed from raw OHLCV candle data
// ============================================================

/**
 * Simple Moving Average
 * @param {number[]} data - Array of values
 * @param {number} period - Lookback period
 * @returns {number[]} SMA values (first period-1 values are null)
 */
export function sma(data, period) {
    const result = new Array(data.length).fill(null);
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
            sum += data[j];
        }
        result[i] = sum / period;
    }
    return result;
}

/**
 * Exponential Moving Average
 * EMA_t = α * price_t + (1 - α) * EMA_{t-1}, where α = 2 / (period + 1)
 * @param {number[]} data
 * @param {number} period
 * @returns {number[]}
 */
export function ema(data, period) {
    const result = new Array(data.length).fill(null);
    const alpha = 2 / (period + 1);

    // Seed with SMA of the first 'period' values
    let sum = 0;
    for (let i = 0; i < period && i < data.length; i++) {
        sum += data[i];
    }
    if (period - 1 < data.length) {
        result[period - 1] = sum / period;
    }

    // Calculate EMA
    for (let i = period; i < data.length; i++) {
        result[i] = alpha * data[i] + (1 - alpha) * result[i - 1];
    }
    return result;
}

/**
 * Relative Strength Index (RSI)
 * RSI = 100 - 100 / (1 + RS), where RS = avg_gain / avg_loss
 * Uses Wilder's smoothing method (exponential)
 * @param {number[]} closes
 * @param {number} period - Default 14
 * @returns {number[]}
 */
export function rsi(closes, period = 14) {
    const result = new Array(closes.length).fill(null);
    if (closes.length < period + 1) return result;

    const gains = [];
    const losses = [];

    // Calculate price changes
    for (let i = 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // First average: simple average of first 'period' values
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
        avgGain += gains[i];
        avgLoss += losses[i];
    }
    avgGain /= period;
    avgLoss /= period;

    // First RSI value
    if (avgLoss === 0) {
        result[period] = 100;
    } else {
        result[period] = 100 - 100 / (1 + avgGain / avgLoss);
    }

    // Subsequent values using Wilder's smoothing
    for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

        if (avgLoss === 0) {
            result[i + 1] = 100;
        } else {
            result[i + 1] = 100 - 100 / (1 + avgGain / avgLoss);
        }
    }

    return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 * MACD Line = EMA(12) - EMA(26)
 * Signal Line = EMA(9) of MACD Line
 * Histogram = MACD Line - Signal Line
 * @param {number[]} closes
 * @param {number} fastPeriod - Default 12
 * @param {number} slowPeriod - Default 26
 * @param {number} signalPeriod - Default 9
 * @returns {{ macdLine: number[], signalLine: number[], histogram: number[] }}
 */
export function macd(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const emaFast = ema(closes, fastPeriod);
    const emaSlow = ema(closes, slowPeriod);

    // MACD Line
    const macdLine = new Array(closes.length).fill(null);
    for (let i = 0; i < closes.length; i++) {
        if (emaFast[i] !== null && emaSlow[i] !== null) {
            macdLine[i] = emaFast[i] - emaSlow[i];
        }
    }

    // Signal Line: EMA of MACD Line (only on non-null values)
    const macdValues = macdLine.filter(v => v !== null);
    const signalEma = ema(macdValues, signalPeriod);

    // Map signal back to original indices
    const signalLine = new Array(closes.length).fill(null);
    let idx = 0;
    for (let i = 0; i < closes.length; i++) {
        if (macdLine[i] !== null) {
            signalLine[i] = signalEma[idx];
            idx++;
        }
    }

    // Histogram
    const histogram = new Array(closes.length).fill(null);
    for (let i = 0; i < closes.length; i++) {
        if (macdLine[i] !== null && signalLine[i] !== null) {
            histogram[i] = macdLine[i] - signalLine[i];
        }
    }

    return { macdLine, signalLine, histogram };
}

/**
 * Bollinger Bands
 * Middle = SMA(period)
 * Upper = Middle + multiplier * σ
 * Lower = Middle - multiplier * σ
 * %B = (Price - Lower) / (Upper - Lower)
 * @param {number[]} closes
 * @param {number} period - Default 20
 * @param {number} multiplier - Default 2
 * @returns {{ upper: number[], middle: number[], lower: number[], percentB: number[], bandwidth: number[] }}
 */
export function bollingerBands(closes, period = 20, multiplier = 2) {
    const middle = sma(closes, period);
    const upper = new Array(closes.length).fill(null);
    const lower = new Array(closes.length).fill(null);
    const percentB = new Array(closes.length).fill(null);
    const bandwidth = new Array(closes.length).fill(null);

    for (let i = period - 1; i < closes.length; i++) {
        // Calculate standard deviation
        let sumSq = 0;
        for (let j = i - period + 1; j <= i; j++) {
            sumSq += Math.pow(closes[j] - middle[i], 2);
        }
        const stdDev = Math.sqrt(sumSq / period);

        upper[i] = middle[i] + multiplier * stdDev;
        lower[i] = middle[i] - multiplier * stdDev;

        const bandWidth = upper[i] - lower[i];
        if (bandWidth > 0) {
            percentB[i] = (closes[i] - lower[i]) / bandWidth;
            bandwidth[i] = bandWidth / middle[i]; // Normalized bandwidth
        }
    }

    return { upper, middle, lower, percentB, bandwidth };
}

/**
 * Stochastic Oscillator
 * %K = (Close - Lowest Low) / (Highest High - Lowest Low) × 100
 * %D = SMA(3) of %K
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number} kPeriod - Default 14
 * @param {number} dPeriod - Default 3
 * @returns {{ k: number[], d: number[] }}
 */
export function stochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    const k = new Array(closes.length).fill(null);

    for (let i = kPeriod - 1; i < closes.length; i++) {
        let lowestLow = Infinity;
        let highestHigh = -Infinity;
        for (let j = i - kPeriod + 1; j <= i; j++) {
            if (lows[j] < lowestLow) lowestLow = lows[j];
            if (highs[j] > highestHigh) highestHigh = highs[j];
        }
        const range = highestHigh - lowestLow;
        k[i] = range > 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
    }

    // %D is SMA of %K
    const kValues = k.filter(v => v !== null);
    const dSma = sma(kValues, dPeriod);
    const d = new Array(closes.length).fill(null);
    let idx = 0;
    for (let i = 0; i < closes.length; i++) {
        if (k[i] !== null) {
            d[i] = dSma[idx];
            idx++;
        }
    }

    return { k, d };
}

/**
 * Average Directional Index (ADX)
 * Measures trend strength regardless of direction
 * ADX > 25 = strong trend, < 20 = weak/no trend
 * Also returns +DI and -DI for direction
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number} period - Default 14
 * @returns {{ adx: number[], plusDI: number[], minusDI: number[] }}
 */
export function adx(highs, lows, closes, period = 14) {
    const len = closes.length;
    const adxResult = new Array(len).fill(null);
    const plusDI = new Array(len).fill(null);
    const minusDI = new Array(len).fill(null);

    if (len < period * 2 + 1) return { adx: adxResult, plusDI, minusDI };

    // True Range, +DM, -DM
    const tr = [];
    const plusDM = [];
    const minusDM = [];

    for (let i = 1; i < len; i++) {
        // True Range = max(H-L, |H-prevC|, |L-prevC|)
        const hl = highs[i] - lows[i];
        const hpc = Math.abs(highs[i] - closes[i - 1]);
        const lpc = Math.abs(lows[i] - closes[i - 1]);
        tr.push(Math.max(hl, hpc, lpc));

        // Directional Movement
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];

        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    // Wilder's smoothing for TR, +DM, -DM
    let smoothTR = 0;
    let smoothPlusDM = 0;
    let smoothMinusDM = 0;

    // First smoothed values: sum of first 'period' values
    for (let i = 0; i < period; i++) {
        smoothTR += tr[i];
        smoothPlusDM += plusDM[i];
        smoothMinusDM += minusDM[i];
    }

    const dx = [];

    for (let i = period; i < tr.length; i++) {
        if (i === period) {
            // Use initial sums
        } else {
            smoothTR = smoothTR - smoothTR / period + tr[i];
            smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
            smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];
        }

        const pdi = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
        const mdi = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;

        plusDI[i + 1] = pdi;
        minusDI[i + 1] = mdi;

        const diSum = pdi + mdi;
        const dxVal = diSum > 0 ? (Math.abs(pdi - mdi) / diSum) * 100 : 0;
        dx.push(dxVal);
    }

    // ADX = Wilder's smoothed average of DX
    if (dx.length >= period) {
        let adxSum = 0;
        for (let i = 0; i < period; i++) {
            adxSum += dx[i];
        }
        let adxVal = adxSum / period;
        const startIdx = period * 2;

        if (startIdx < len) {
            adxResult[startIdx] = adxVal;
        }

        for (let i = period; i < dx.length; i++) {
            adxVal = (adxVal * (period - 1) + dx[i]) / period;
            const idx = i + period + 1;
            if (idx < len) {
                adxResult[idx] = adxVal;
            }
        }
    }

    return { adx: adxResult, plusDI, minusDI };
}

/**
 * Average True Range (ATR)
 * Used for stop-loss calculation and volatility measurement
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number} period - Default 14
 * @returns {number[]}
 */
export function atr(highs, lows, closes, period = 14) {
    const result = new Array(closes.length).fill(null);
    if (closes.length < period + 1) return result;

    // True Range
    const tr = [highs[0] - lows[0]]; // First TR is just H-L
    for (let i = 1; i < closes.length; i++) {
        const hl = highs[i] - lows[i];
        const hpc = Math.abs(highs[i] - closes[i - 1]);
        const lpc = Math.abs(lows[i] - closes[i - 1]);
        tr.push(Math.max(hl, hpc, lpc));
    }

    // First ATR: simple average of first 'period' TRs
    let atrVal = 0;
    for (let i = 0; i < period; i++) {
        atrVal += tr[i];
    }
    atrVal /= period;
    result[period - 1] = atrVal;

    // Subsequent: Wilder's smoothing
    for (let i = period; i < closes.length; i++) {
        atrVal = (atrVal * (period - 1) + tr[i]) / period;
        result[i] = atrVal;
    }

    return result;
}

/**
 * Volume Weighted Average Price (VWAP)
 * VWAP = Σ(Typical Price × Volume) / Σ(Volume)
 * Typical Price = (High + Low + Close) / 3
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number[]} volumes
 * @returns {number[]}
 */
export function vwap(highs, lows, closes, volumes) {
    const result = new Array(closes.length).fill(null);
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    for (let i = 0; i < closes.length; i++) {
        const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
        cumulativeTPV += typicalPrice * volumes[i];
        cumulativeVolume += volumes[i];

        result[i] = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice;
    }

    return result;
}

/**
 * On-Balance Volume (OBV)
 * Running total: add volume on up days, subtract on down days
 * @param {number[]} closes
 * @param {number[]} volumes
 * @returns {number[]}
 */
export function obv(closes, volumes) {
    const result = new Array(closes.length).fill(null);
    result[0] = volumes[0];

    for (let i = 1; i < closes.length; i++) {
        if (closes[i] > closes[i - 1]) {
            result[i] = result[i - 1] + volumes[i];
        } else if (closes[i] < closes[i - 1]) {
            result[i] = result[i - 1] - volumes[i];
        } else {
            result[i] = result[i - 1];
        }
    }

    return result;
}

/**
 * Fibonacci Retracement Levels
 * Calculated from the swing high and swing low of the data
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number} lookback - Number of candles to find swing points
 * @returns {{ swingHigh: number, swingLow: number, levels: {level:number, price:number, label:string}[] }}
 */
export function fibonacciRetracement(highs, lows, lookback = 50) {
    const start = Math.max(0, highs.length - lookback);
    let swingHigh = -Infinity;
    let swingLow = Infinity;

    for (let i = start; i < highs.length; i++) {
        if (highs[i] > swingHigh) swingHigh = highs[i];
        if (lows[i] < swingLow) swingLow = lows[i];
    }

    const range = swingHigh - swingLow;
    const fibs = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const labels = ['0%', '23.6%', '38.2%', '50%', '61.8%', '78.6%', '100%'];

    // Determine trend direction from recent candles
    const recentClose = highs.length > 0 ? (highs[highs.length - 1] + lows[lows.length - 1]) / 2 : 0;
    const midpoint = (swingHigh + swingLow) / 2;
    const isUptrend = recentClose > midpoint;

    const levels = fibs.map((fib, i) => ({
        level: fib,
        // In uptrend: retracement from high; in downtrend: extension from low
        price: isUptrend ? swingHigh - range * fib : swingLow + range * fib,
        label: labels[i],
    }));

    return { swingHigh, swingLow, levels, isUptrend };
}

/**
 * Detect RSI Divergence
 * Bullish divergence: price makes lower low but RSI makes higher low
 * Bearish divergence: price makes higher high but RSI makes lower high
 * @param {number[]} closes
 * @param {number[]} rsiValues
 * @param {number} lookback - How many candles to look back for pivots
 * @returns {{ type: 'bullish'|'bearish'|'none', strength: number }}
 */
export function detectRSIDivergence(closes, rsiValues, lookback = 30) {
    const len = closes.length;
    if (len < lookback) return { type: 'none', strength: 0 };

    const start = len - lookback;

    // Find local minima and maxima
    const priceLows = [];
    const priceHighs = [];
    const rsiLows = [];
    const rsiHighs = [];

    for (let i = start + 1; i < len - 1; i++) {
        if (rsiValues[i] === null) continue;

        // Local minimum
        if (closes[i] < closes[i - 1] && closes[i] <= closes[i + 1]) {
            priceLows.push({ idx: i, price: closes[i], rsi: rsiValues[i] });
        }
        // Local maximum
        if (closes[i] > closes[i - 1] && closes[i] >= closes[i + 1]) {
            priceHighs.push({ idx: i, price: closes[i], rsi: rsiValues[i] });
        }
    }

    // Check for bullish divergence (need at least 2 lows)
    if (priceLows.length >= 2) {
        const prev = priceLows[priceLows.length - 2];
        const curr = priceLows[priceLows.length - 1];
        if (prev.rsi !== null && curr.rsi !== null) {
            if (curr.price < prev.price && curr.rsi > prev.rsi) {
                const strength = Math.min(100, Math.abs(curr.rsi - prev.rsi) * 3);
                return { type: 'bullish', strength };
            }
        }
    }

    // Check for bearish divergence (need at least 2 highs)
    if (priceHighs.length >= 2) {
        const prev = priceHighs[priceHighs.length - 2];
        const curr = priceHighs[priceHighs.length - 1];
        if (prev.rsi !== null && curr.rsi !== null) {
            if (curr.price > prev.price && curr.rsi < prev.rsi) {
                const strength = Math.min(100, Math.abs(prev.rsi - curr.rsi) * 3);
                return { type: 'bearish', strength };
            }
        }
    }

    return { type: 'none', strength: 0 };
}

/**
 * Detect MACD Divergence
 * Similar to RSI divergence but uses MACD histogram
 * @param {number[]} closes
 * @param {number[]} histogram - MACD histogram values
 * @param {number} lookback
 * @returns {{ type: 'bullish'|'bearish'|'none', strength: number }}
 */
export function detectMACDDivergence(closes, histogram, lookback = 30) {
    const len = closes.length;
    if (len < lookback) return { type: 'none', strength: 0 };

    const start = len - lookback;

    const priceLows = [];
    const priceHighs = [];

    for (let i = start + 1; i < len - 1; i++) {
        if (histogram[i] === null) continue;

        if (closes[i] < closes[i - 1] && closes[i] <= closes[i + 1]) {
            priceLows.push({ idx: i, price: closes[i], hist: histogram[i] });
        }
        if (closes[i] > closes[i - 1] && closes[i] >= closes[i + 1]) {
            priceHighs.push({ idx: i, price: closes[i], hist: histogram[i] });
        }
    }

    // Bullish: price lower low, histogram higher low
    if (priceLows.length >= 2) {
        const prev = priceLows[priceLows.length - 2];
        const curr = priceLows[priceLows.length - 1];
        if (prev.hist !== null && curr.hist !== null) {
            if (curr.price < prev.price && curr.hist > prev.hist) {
                return { type: 'bullish', strength: Math.min(100, Math.abs(curr.hist - prev.hist) * 50) };
            }
        }
    }

    // Bearish: price higher high, histogram lower high
    if (priceHighs.length >= 2) {
        const prev = priceHighs[priceHighs.length - 2];
        const curr = priceHighs[priceHighs.length - 1];
        if (prev.hist !== null && curr.hist !== null) {
            if (curr.price > prev.price && curr.hist < prev.hist) {
                return { type: 'bearish', strength: Math.min(100, Math.abs(prev.hist - curr.hist) * 50) };
            }
        }
    }

    return { type: 'none', strength: 0 };
}

/**
 * Compute all indicators from candle data
 * @param {Array<{time:number, open:number, high:number, low:number, close:number, volume:number}>} candles
 * @returns {object} All computed indicator values
 */
export function computeAll(candles) {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    const len = candles.length;
    const last = len - 1;

    // Moving Averages
    const ema9 = ema(closes, 9);
    const ema21 = ema(closes, 21);
    const sma50 = sma(closes, 50);
    const sma200 = sma(closes, 200);

    // RSI
    const rsiValues = rsi(closes, 14);

    // MACD
    const macdResult = macd(closes);

    // Bollinger Bands
    const bbResult = bollingerBands(closes, 20, 2);

    // Stochastic
    const stochResult = stochastic(highs, lows, closes, 14, 3);

    // ADX
    const adxResult = adx(highs, lows, closes, 14);

    // ATR
    const atrValues = atr(highs, lows, closes, 14);

    // VWAP
    const vwapValues = vwap(highs, lows, closes, volumes);

    // OBV
    const obvValues = obv(closes, volumes);

    // Fibonacci
    const fibResult = fibonacciRetracement(highs, lows, Math.min(100, len));

    // Divergences
    const rsiDiv = detectRSIDivergence(closes, rsiValues, 30);
    const macdDiv = detectMACDDivergence(closes, macdResult.histogram, 30);

    // Package current (latest) values
    return {
        price: {
            current: closes[last],
            open: candles[last].open,
            high: highs[last],
            low: lows[last],
            volume: volumes[last],
        },
        ema: {
            ema9: ema9[last],
            ema21: ema21[last],
            sma50: sma50[last],
            sma200: sma200[last],
            // EMA crossover state
            ema9AboveEma21: ema9[last] !== null && ema21[last] !== null && ema9[last] > ema21[last],
            prevEma9AboveEma21: last > 0 && ema9[last - 1] !== null && ema21[last - 1] !== null && ema9[last - 1] > ema21[last - 1],
            priceAboveSma50: sma50[last] !== null && closes[last] > sma50[last],
            priceAboveSma200: sma200[last] !== null && closes[last] > sma200[last],
        },
        rsi: {
            value: rsiValues[last],
            prev: last > 0 ? rsiValues[last - 1] : null,
            isOverbought: rsiValues[last] !== null && rsiValues[last] > 70,
            isOversold: rsiValues[last] !== null && rsiValues[last] < 30,
            divergence: rsiDiv,
        },
        macd: {
            macdLine: macdResult.macdLine[last],
            signalLine: macdResult.signalLine[last],
            histogram: macdResult.histogram[last],
            prevHistogram: last > 0 ? macdResult.histogram[last - 1] : null,
            isBullishCross: macdResult.macdLine[last] > macdResult.signalLine[last] &&
                (last > 0 && macdResult.macdLine[last - 1] !== null && macdResult.signalLine[last - 1] !== null &&
                    macdResult.macdLine[last - 1] <= macdResult.signalLine[last - 1]),
            isBearishCross: macdResult.macdLine[last] < macdResult.signalLine[last] &&
                (last > 0 && macdResult.macdLine[last - 1] !== null && macdResult.signalLine[last - 1] !== null &&
                    macdResult.macdLine[last - 1] >= macdResult.signalLine[last - 1]),
            isAboveZero: macdResult.macdLine[last] > 0,
            divergence: macdDiv,
        },
        bollinger: {
            upper: bbResult.upper[last],
            middle: bbResult.middle[last],
            lower: bbResult.lower[last],
            percentB: bbResult.percentB[last],
            bandwidth: bbResult.bandwidth[last],
            isNearUpper: bbResult.percentB[last] !== null && bbResult.percentB[last] > 0.8,
            isNearLower: bbResult.percentB[last] !== null && bbResult.percentB[last] < 0.2,
            isSqueeze: bbResult.bandwidth[last] !== null && bbResult.bandwidth[last] < 0.02,
        },
        stochastic: {
            k: stochResult.k[last],
            d: stochResult.d[last],
            isOverbought: stochResult.k[last] !== null && stochResult.k[last] > 80,
            isOversold: stochResult.k[last] !== null && stochResult.k[last] < 20,
            isBullishCross: stochResult.k[last] > stochResult.d[last] &&
                (last > 0 && stochResult.k[last - 1] !== null && stochResult.d[last - 1] !== null &&
                    stochResult.k[last - 1] <= stochResult.d[last - 1]),
            isBearishCross: stochResult.k[last] < stochResult.d[last] &&
                (last > 0 && stochResult.k[last - 1] !== null && stochResult.d[last - 1] !== null &&
                    stochResult.k[last - 1] >= stochResult.d[last - 1]),
        },
        adx: {
            value: adxResult.adx[last],
            plusDI: adxResult.plusDI[last],
            minusDI: adxResult.minusDI[last],
            isStrong: adxResult.adx[last] !== null && adxResult.adx[last] > 25,
            isBullish: adxResult.plusDI[last] !== null && adxResult.minusDI[last] !== null &&
                adxResult.plusDI[last] > adxResult.minusDI[last],
        },
        atr: {
            value: atrValues[last],
            percent: atrValues[last] !== null ? (atrValues[last] / closes[last]) * 100 : null,
        },
        vwap: {
            value: vwapValues[last],
            priceAboveVwap: closes[last] > vwapValues[last],
        },
        obv: {
            value: obvValues[last],
            trend: len > 5 ? (obvValues[last] > obvValues[last - 5] ? 'rising' : 'falling') : 'neutral',
        },
        fibonacci: fibResult,

        // Raw arrays for advanced analysis
        _raw: {
            closes,
            highs,
            lows,
            volumes,
            rsi: rsiValues,
            macd: macdResult,
            bb: bbResult,
            stoch: stochResult,
            atr: atrValues,
        },
    };
}
