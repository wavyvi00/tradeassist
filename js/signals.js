// ============================================================
// Signal Generation & Confluence Scoring System
// Combines all indicator signals into a weighted score
// ============================================================

/**
 * Signal weights for each indicator group
 */
const WEIGHTS = {
    rsi: 15,
    macdCross: 20,
    macdDivergence: 15,
    bollingerBands: 10,
    stochastic: 10,
    emaCross: 15,
    adxTrend: 10,
    volumeOBV: 5,
};

const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

/**
 * Generate individual indicator signals
 * Returns values between -1 (strong sell) and +1 (strong buy)
 */
function getIndicatorSignals(indicators, timeframe) {
    const signals = {};
    const is5m = timeframe === '5m';

    // --- RSI Signal ---
    if (indicators.rsi.value !== null) {
        const rsiVal = indicators.rsi.value;
        if (is5m) {
            // Aggressive 5m thresholds
            if (rsiVal < 25) signals.rsi = 1.0;           // Extremely oversold
            else if (rsiVal < 35) signals.rsi = 0.7;       // Oversold
            else if (rsiVal < 45) signals.rsi = 0.3;       // Approaching oversold
            else if (rsiVal > 75) signals.rsi = -1.0;      // Extremely overbought
            else if (rsiVal > 65) signals.rsi = -0.7;      // Overbought
            else if (rsiVal > 55) signals.rsi = -0.3;      // Approaching overbought
            else signals.rsi = 0;
        } else {
            // Standard thresholds
            if (rsiVal < 20) signals.rsi = 1.0;
            else if (rsiVal < 30) signals.rsi = 0.7;
            else if (rsiVal < 40) signals.rsi = 0.3;
            else if (rsiVal > 80) signals.rsi = -1.0;
            else if (rsiVal > 70) signals.rsi = -0.7;
            else if (rsiVal > 60) signals.rsi = -0.3;
            else signals.rsi = 0;
        }
    } else {
        signals.rsi = 0;
    }

    // --- MACD Crossover Signal ---
    if (indicators.macd.macdLine !== null) {
        if (indicators.macd.isBullishCross) {
            signals.macdCross = 1.0; // Fresh bullish crossover
        } else if (indicators.macd.isBearishCross) {
            signals.macdCross = -1.0; // Fresh bearish crossover
        } else if (indicators.macd.histogram !== null) {
            // Histogram direction + magnitude
            const hist = indicators.macd.histogram;
            const prevHist = indicators.macd.prevHistogram;

            // More sensitive momentum check for 5m
            const momentumWeight = is5m ? 0.8 : 0.5;

            if (hist > 0 && prevHist !== null && hist > prevHist) {
                signals.macdCross = momentumWeight; // Bullish momentum increasing
            } else if (hist > 0) {
                signals.macdCross = 0.2; // Bullish but slowing
            } else if (hist < 0 && prevHist !== null && hist < prevHist) {
                signals.macdCross = -momentumWeight; // Bearish momentum increasing
            } else if (hist < 0) {
                signals.macdCross = -0.2; // Bearish but slowing
            } else {
                signals.macdCross = 0;
            }
        } else {
            signals.macdCross = 0;
        }
    } else {
        signals.macdCross = 0;
    }

    // --- MACD Divergence Signal ---
    if (indicators.macd.divergence.type === 'bullish') {
        signals.macdDivergence = 0.5 + (indicators.macd.divergence.strength / 200);
    } else if (indicators.macd.divergence.type === 'bearish') {
        signals.macdDivergence = -(0.5 + (indicators.macd.divergence.strength / 200));
    } else if (indicators.rsi.divergence.type === 'bullish') {
        // Fall back to RSI divergence if no MACD divergence
        signals.macdDivergence = 0.4 + (indicators.rsi.divergence.strength / 250);
    } else if (indicators.rsi.divergence.type === 'bearish') {
        signals.macdDivergence = -(0.4 + (indicators.rsi.divergence.strength / 250));
    } else {
        signals.macdDivergence = 0;
    }

    // --- Bollinger Bands Signal ---
    if (indicators.bollinger.percentB !== null) {
        const pctB = indicators.bollinger.percentB;
        if (pctB < 0) signals.bollingerBands = 1.0;          // Below lower band
        else if (pctB < 0.05) signals.bollingerBands = 0.8;   // Near lower band
        else if (pctB < 0.2) signals.bollingerBands = 0.4;    // Lower region
        else if (pctB > 1.0) signals.bollingerBands = -1.0;   // Above upper band
        else if (pctB > 0.95) signals.bollingerBands = -0.8;  // Near upper band
        else if (pctB > 0.8) signals.bollingerBands = -0.4;   // Upper region
        else signals.bollingerBands = 0;
    } else {
        signals.bollingerBands = 0;
    }

    // --- Stochastic Signal ---
    if (indicators.stochastic.k !== null) {
        if (indicators.stochastic.isOversold && indicators.stochastic.isBullishCross) {
            signals.stochastic = 1.0; // Oversold + bullish cross
        } else if (indicators.stochastic.isOversold) {
            signals.stochastic = 0.5;
        } else if (indicators.stochastic.isOverbought && indicators.stochastic.isBearishCross) {
            signals.stochastic = -1.0; // Overbought + bearish cross
        } else if (indicators.stochastic.isOverbought) {
            signals.stochastic = -0.5;
        } else if (indicators.stochastic.isBullishCross) {
            signals.stochastic = 0.3;
        } else if (indicators.stochastic.isBearishCross) {
            signals.stochastic = -0.3;
        } else {
            signals.stochastic = 0;
        }
    } else {
        signals.stochastic = 0;
    }

    // --- EMA Crossover Signal ---
    if (indicators.ema.ema9 !== null && indicators.ema.ema21 !== null) {
        // Check for fresh crossover
        const justCrossedBullish = indicators.ema.ema9AboveEma21 && !indicators.ema.prevEma9AboveEma21;
        const justCrossedBearish = !indicators.ema.ema9AboveEma21 && indicators.ema.prevEma9AboveEma21;

        if (justCrossedBullish) {
            signals.emaCross = 1.0;
        } else if (justCrossedBearish) {
            signals.emaCross = -1.0;
        } else if (indicators.ema.ema9AboveEma21) {
            // Trend continuation — weaker signal
            signals.emaCross = 0.3;
        } else {
            signals.emaCross = -0.3;
        }

        // Boost if price is above/below SMA200 (major trend)
        if (indicators.ema.sma200 !== null) {
            if (indicators.ema.priceAboveSma200 && signals.emaCross > 0) {
                signals.emaCross = Math.min(1, signals.emaCross + 0.2);
            } else if (!indicators.ema.priceAboveSma200 && signals.emaCross < 0) {
                signals.emaCross = Math.max(-1, signals.emaCross - 0.2);
            }
        }
    } else {
        signals.emaCross = 0;
    }

    // --- ADX + DI Signal ---
    if (indicators.adx.value !== null) {
        if (indicators.adx.isStrong) {
            // Strong trend — direction from DI
            if (indicators.adx.isBullish) {
                signals.adxTrend = 0.7;
            } else {
                signals.adxTrend = -0.7;
            }
        } else {
            // Weak trend — neutral / range-bound
            signals.adxTrend = 0;
        }
    } else {
        signals.adxTrend = 0;
    }

    // --- Volume (OBV) Signal ---
    if (indicators.obv.trend === 'rising') {
        signals.volumeOBV = 0.5;
    } else if (indicators.obv.trend === 'falling') {
        signals.volumeOBV = -0.5;
    } else {
        signals.volumeOBV = 0;
    }

    // VWAP confirmation
    if (indicators.vwap.priceAboveVwap && signals.volumeOBV > 0) {
        signals.volumeOBV = Math.min(1, signals.volumeOBV + 0.3);
    } else if (!indicators.vwap.priceAboveVwap && signals.volumeOBV < 0) {
        signals.volumeOBV = Math.max(-1, signals.volumeOBV - 0.3);
    }

    return signals;
}

/**
 * Calculate the confluence score from individual signals
 * @returns {number} Score from -100 to +100
 */
function calculateConfluenceScore(signals) {
    let weightedSum = 0;
    for (const [key, signal] of Object.entries(signals)) {
        weightedSum += signal * (WEIGHTS[key] || 0);
    }
    return Math.round((weightedSum / TOTAL_WEIGHT) * 100);
}

/**
 * Calculate Probability Score (0-100%)
 */
function calculateProbability(score, indicators, isPredictionMode = false) {
    // Base probability from score (0-100 scale)
    let probability = (Math.abs(score) + 100) / 2; // Normalize -100..100 to 0..100

    // Adjust based on ADX (stronger trend = higher probability)
    if (indicators.adx.value > 25) {
        probability += 5;
    }
    if (indicators.adx.value > 40) {
        probability += 5;
    }

    // Adjust based on Squeeze (squeeze break = higher probability)
    if (indicators.bollinger.isSqueeze) {
        // Lower probability during squeeze (consolidation) unless pushing
        probability -= 10;
    }

    // In prediction mode, we want to show a decisive number, but keep it realistic
    // If it's pure 50/50, push it slightly one way based on momentum
    if (isPredictionMode && probability < 51) probability = 52;

    return Math.min(99, Math.max(1, Math.round(probability)));
}

/**
 * Get Forced Prediction Bias for PancakeSwap Mode
 * Returns 1 (UP) or -1 (DOWN)
 */
function getForcedPrediction(indicators, rawSignals) {
    let biasScore = 0;

    // RSI Slope/Position
    biasScore += (indicators.rsi.value - 50);

    // MACD Histogram - Weighted heavily for momentum
    if (indicators.macd.histogram !== null) {
        biasScore += indicators.macd.histogram * 150;
    }

    // EMA Slope check (Fast EMA vs Slow EMA)
    const emaDiff = indicators.ema.fast - indicators.ema.slow;
    biasScore += emaDiff * 15;

    // Recent Price Action (Current Price vs EMA Fast)
    // Highly reactive to immediate price moves
    if (indicators.price.current > indicators.ema.fast) {
        biasScore += 15;
    } else {
        biasScore -= 15;
    }

    // Stochastic Oscillator - Overbought/Oversold Reversals
    if (indicators.stochastic.k !== null) {
        if (indicators.stochastic.k < 20) biasScore += 10; // Oversold bounce likely
        if (indicators.stochastic.k > 80) biasScore -= 10; // Overbought pull likely
    }

    // If signal is weak, follow the 1-minute trend if available (simulated by checking close vs open of last candle if we had it, but here we use price trend)
    // If exactly 0, use RSI trend
    if (Math.abs(biasScore) < 5) {
        return indicators.rsi.value > indicators.rsi.prevValue ? 1 : -1;
    }

    return biasScore > 0 ? 1 : -1;
}

/**
 * Determine signal type from score
 */
function getSignalType(score) {
    if (score >= 60) return { action: 'STRONG BUY', emoji: '🟢', color: '#00ff88', level: 'strong' };
    if (score >= 30) return { action: 'BUY', emoji: '🟡', color: '#ffdd00', level: 'moderate' };
    if (score > -30) return { action: 'NEUTRAL', emoji: '⚪', color: '#888888', level: 'neutral' };
    if (score > -60) return { action: 'SELL', emoji: '🟡', color: '#ff8800', level: 'moderate' };
    return { action: 'STRONG SELL', emoji: '🔴', color: '#ff3344', level: 'strong' };
}

/**
 * Calculate entry, stop-loss, and take-profit targets
 */
function calculateTargets(indicators, signalType) {
    const price = indicators.price.current;
    const atrVal = indicators.atr.value || price * 0.01; // Fallback to 1%

    const isBuy = signalType.action.includes('BUY');

    if (signalType.level === 'neutral') {
        return {
            entry: null,
            stopLoss: null,
            takeProfits: [],
            riskReward: null,
        };
    }

    let entry, stopLoss;
    const takeProfits = [];

    if (isBuy) {
        entry = price;
        stopLoss = price - atrVal * 1.5;

        // Take profit at Fibonacci levels above current price
        if (indicators.fibonacci && indicators.fibonacci.levels) {
            const fibLevels = indicators.fibonacci.levels
                .filter(l => l.price > price)
                .sort((a, b) => a.price - b.price);

            if (fibLevels.length >= 1) takeProfits.push({ price: fibLevels[0].price, label: `TP1 (${fibLevels[0].label})` });
            if (fibLevels.length >= 2) takeProfits.push({ price: fibLevels[1].price, label: `TP2 (${fibLevels[1].label})` });
        }

        // Fallback take profits based on ATR
        if (takeProfits.length === 0) {
            takeProfits.push({ price: price + atrVal * 2, label: 'TP1 (2× ATR)' });
            takeProfits.push({ price: price + atrVal * 3, label: 'TP2 (3× ATR)' });
        }
    } else {
        entry = price;
        stopLoss = price + atrVal * 1.5;

        // Take profit at Fibonacci levels below current price
        if (indicators.fibonacci && indicators.fibonacci.levels) {
            const fibLevels = indicators.fibonacci.levels
                .filter(l => l.price < price)
                .sort((a, b) => b.price - a.price);

            if (fibLevels.length >= 1) takeProfits.push({ price: fibLevels[0].price, label: `TP1 (${fibLevels[0].label})` });
            if (fibLevels.length >= 2) takeProfits.push({ price: fibLevels[1].price, label: `TP2 (${fibLevels[1].label})` });
        }

        if (takeProfits.length === 0) {
            takeProfits.push({ price: price - atrVal * 2, label: 'TP1 (2× ATR)' });
            takeProfits.push({ price: price - atrVal * 3, label: 'TP2 (3× ATR)' });
        }
    }

    const risk = Math.abs(entry - stopLoss);
    const reward = takeProfits.length > 0 ? Math.abs(takeProfits[0].price - entry) : risk;
    const riskReward = risk > 0 ? (reward / risk).toFixed(2) : 'N/A';

    return { entry, stopLoss, takeProfits, riskReward };
}

// Timeframe human-readable labels and expected candle durations
const TIMEFRAME_INFO = {
    '5m': { label: '5 min', candlesLabel: '1 candle', candleMinutes: 5, swingCandles: 1 },
    '15m': { label: '15 min', candlesLabel: '2–4 candles', candleMinutes: 15, swingCandles: 4 },
    '1h': { label: '1 hour', candlesLabel: '2–6 candles', candleMinutes: 60, swingCandles: 4 },
    '4h': { label: '4 hour', candlesLabel: '2–4 candles', candleMinutes: 240, swingCandles: 3 },
};

/**
 * Build an explicit trade plan: "BUY here → SELL there" or "SELL here → BUY BACK there"
 * Includes timeframe-aware hold duration, expected move range, and support/resistance zones.
 */
function buildTradePlan(indicators, signalType, targets, timeframe, mpo) {
    const price = indicators.price.current;
    const atrVal = indicators.atr.value || price * 0.01;
    const tfInfo = TIMEFRAME_INFO[timeframe] || TIMEFRAME_INFO['15m'];
    const isBuy = signalType.action.includes('BUY');

    if (signalType.level === 'neutral') {
        return {
            action: 'WAIT',
            summary: 'No clear setup — wait for a stronger signal',
            entry: null,
            exit: null,
            stopLoss: null,
            holdTime: null,
            expectedMove: null,
            support: indicators.bollinger.lower,
            resistance: indicators.bollinger.upper,
            riskAmount: null,
            rewardAmount: null,
        };
    }


    // Expected move = ATR * number of swing candles (statistical expected range)
    const expectedMove = atrVal * Math.sqrt(tfInfo.swingCandles); // √n scaling for random walk
    const holdMinutes = tfInfo.candleMinutes * tfInfo.swingCandles;

    // Format hold time
    let holdTime;
    if (timeframe === '5m') holdTime = 'Exactly 5 min';
    else if (holdMinutes < 60) holdTime = `~${holdMinutes} min`;
    else if (holdMinutes < 1440) holdTime = `~${(holdMinutes / 60).toFixed(1)} hrs`;
    else holdTime = `~${(holdMinutes / 1440).toFixed(1)} days`;

    const entry = targets.entry;
    const exit = targets.takeProfits.length > 0 ? targets.takeProfits[0].price : null;
    const stopLoss = targets.stopLoss;
    const riskAmount = entry && stopLoss ? Math.abs(entry - stopLoss) : null;
    const rewardAmount = entry && exit ? Math.abs(exit - entry) : null;

    // Find nearest support and resistance
    const support = indicators.bollinger.lower || (price - atrVal * 2);
    const resistance = indicators.bollinger.upper || (price + atrVal * 2);

    // VWAP zone
    const vwapZone = indicators.vwap.value;

    // Build human-readable summary
    let summary;
    if (isBuy) {
        const exitStr = exit ? `$${Math.round(exit).toLocaleString()}` : `$${Math.round(price + expectedMove).toLocaleString()}`;
        summary = `BUY @ $${Math.round(entry).toLocaleString()} → SELL @ ${exitStr}`;
    } else {
        const exitStr = exit ? `$${Math.round(exit).toLocaleString()}` : `$${Math.round(price - expectedMove).toLocaleString()}`;
        summary = `SELL @ $${Math.round(entry).toLocaleString()} → BUY BACK @ ${exitStr}`;
    }

    // Build reasons array
    const reasons = [];
    if (indicators.rsi.isOversold) reasons.push('RSI oversold');
    if (indicators.rsi.isOverbought) reasons.push('RSI overbought');
    if (indicators.macd.isBullishCross) reasons.push('MACD bullish cross');
    if (indicators.macd.isBearishCross) reasons.push('MACD bearish cross');
    if (indicators.stochastic.isOversold) reasons.push('Stochastic oversold');
    if (indicators.stochastic.isOverbought) reasons.push('Stochastic overbought');
    if (indicators.ema.ema9AboveEma21) reasons.push('EMA 9 > 21 (bullish)');
    if (!indicators.ema.ema9AboveEma21 && indicators.ema.ema9 !== null) reasons.push('EMA 9 < 21 (bearish)');
    if (indicators.bollinger.isNearLower) reasons.push('Near Bollinger lower band');
    if (indicators.bollinger.isNearUpper) reasons.push('Near Bollinger upper band');
    if (indicators.adx.isStrong) reasons.push(`Strong trend (ADX ${indicators.adx.value?.toFixed(0)})`);
    if (indicators.vwap.priceAboveVwap && isBuy) reasons.push('Price above VWAP');
    if (!indicators.vwap.priceAboveVwap && !isBuy) reasons.push('Price below VWAP');
    if (indicators.rsi.divergence.type !== 'none') reasons.push(`${indicators.rsi.divergence.type} RSI divergence`);
    if (indicators.macd.divergence.type !== 'none') reasons.push(`${indicators.macd.divergence.type} MACD divergence`);

    return {
        action: isBuy ? 'BUY' : 'SELL',
        summary,
        entry,
        exit,
        stopLoss,
        holdTime,
        holdLabel: `Hold ${tfInfo.candlesLabel} (${holdTime})`,
        expectedMove,
        expectedMovePercent: (expectedMove / price) * 100,
        support,
        resistance,
        vwapZone,
        riskAmount,
        rewardAmount,
        profitPercent: rewardAmount ? ((rewardAmount / entry) * 100).toFixed(3) : null,
        lossPercent: riskAmount ? ((riskAmount / entry) * 100).toFixed(3) : null,
        reasons: reasons.slice(0, 5), // Top 5 reasons
        timeframe,
        timeframeLabel: tfInfo.label,
        mpo, // Most Possible Outcome range
    };
}

/**
 * Generate a complete trading signal from indicator data
 * @param {object} indicators - Output from computeAll()
 * @param {string} timeframe - Current timeframe ('5m', '15m', '1h', '4h')
 * @returns {object} Complete signal with score, type, targets, trade plan, and breakdown
 */
export function generateSignal(indicators, timeframe = '15m', isPredictionMode = false) {
    const signals = getIndicatorSignals(indicators, timeframe);
    const score = calculateConfluenceScore(signals);
    let signalType = getSignalType(score);
    let probability = calculateProbability(score, indicators, isPredictionMode);

    // Check for forced prediction mode
    if (isPredictionMode && timeframe === '5m') {
        const bias = getForcedPrediction(indicators, signals);
        const action = bias === 1 ? 'UP' : 'DOWN';

        // Boost probability for display purposes in prediction mode if signal is weak
        if (probability < 55) probability = 55 + Math.floor(Math.random() * 10);

        signalType = {
            action,
            emoji: action === 'UP' ? '🟢' : '🔴',
            color: action === 'UP' ? '#00ff88' : '#ff3344',
            level: 'prediction'
        };
    }

    const targets = calculateTargets(indicators, signalType);

    // Calculate Most Possible Outcome (MPO)
    // 1 Standard Deviation from Moving Average (Bollinger Bands logic)
    // If we don't have Bollinger, estimate with ATR
    let mpoHigh, mpoLow;
    if (indicators.bollinger.upper && indicators.bollinger.lower) {
        // Use bands as the statistical "likely" range
        mpoHigh = indicators.bollinger.upper;
        mpoLow = indicators.bollinger.lower;
    } else {
        const price = indicators.price.current;
        const atr = indicators.atr.value || price * 0.01;
        mpoHigh = price + (atr * 2);
        mpoLow = price - (atr * 2);
    }

    const tradePlan = buildTradePlan(indicators, signalType, targets, timeframe, { high: mpoHigh, low: mpoLow });

    // Build indicator breakdown for UI
    const breakdown = Object.entries(signals).map(([key, value]) => ({
        name: formatIndicatorName(key),
        signal: value,
        weight: WEIGHTS[key],
        contribution: Math.round(value * WEIGHTS[key]),
        direction: value > 0.1 ? 'bullish' : value < -0.1 ? 'bearish' : 'neutral',
    }));

    return {
        score,
        probability,
        ...signalType,
        targets,
        tradePlan,
        breakdown,
        timestamp: Date.now(),
        indicators: {
            rsi: indicators.rsi.value,
            macdHistogram: indicators.macd.histogram,
            bollingerPctB: indicators.bollinger.percentB,
            stochasticK: indicators.stochastic.k,
            adxValue: indicators.adx.value,
            atrValue: indicators.atr.value,
            atrPercent: indicators.atr.percent,
        },
    };
}

function formatIndicatorName(key) {
    const map = {
        rsi: 'RSI (14)',
        macdCross: 'MACD Cross',
        macdDivergence: 'Divergence',
        bollingerBands: 'Bollinger Bands',
        stochastic: 'Stochastic',
        emaCross: 'EMA Cross (9/21)',
        adxTrend: 'ADX Trend',
        volumeOBV: 'Volume/OBV',
    };
    return map[key] || key;
}

// Keep signal history
const signalHistory = [];
const MAX_HISTORY = 20;

/**
 * Record a signal to history and check for changes
 */
export function recordSignal(signal) {
    const lastSignal = signalHistory.length > 0 ? signalHistory[signalHistory.length - 1] : null;

    // Only record if action changed or score changed significantly
    if (!lastSignal || lastSignal.action !== signal.action || Math.abs(lastSignal.score - signal.score) >= 10) {
        signalHistory.push({
            action: signal.action,
            score: signal.score,
            price: signal.targets.entry,
            timestamp: signal.timestamp,
            color: signal.color,
        });

        if (signalHistory.length > MAX_HISTORY) {
            signalHistory.shift();
        }

        return true; // Signal changed
    }

    return false; // No significant change
}

export function getSignalHistory() {
    return [...signalHistory];
}
