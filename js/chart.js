// ============================================================
// Chart Module — TradingView Lightweight Charts
// ============================================================

import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';

let chart = null;
let candleSeries = null;
let volumeSeries = null;
let ema9Series = null;
let ema21Series = null;
let currentCandles = [];

/**
 * Dark & light theme presets for the chart
 */
const CHART_THEMES = {
    dark: {
        layout: {
            background: { type: ColorType.Solid, color: '#0f0f1e' },
            textColor: '#8888aa',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        },
        grid: {
            vertLines: { color: '#1a1a3520' },
            horzLines: { color: '#1a1a3520' },
        },
        crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: { color: '#555570', width: 1, style: 3, labelBackgroundColor: '#1a1a35' },
            horzLine: { color: '#555570', width: 1, style: 3, labelBackgroundColor: '#1a1a35' },
        },
        upColor: '#00ff88',
        downColor: '#ff3344',
        wickUpColor: '#00cc6a',
        wickDownColor: '#cc2233',
        borderUpColor: '#00ff88',
        borderDownColor: '#ff3344',
        volumeUpColor: 'rgba(0, 255, 136, 0.15)',
        volumeDownColor: 'rgba(255, 51, 68, 0.15)',
    },
    light: {
        layout: {
            background: { type: ColorType.Solid, color: '#ffffff' },
            textColor: '#555555',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        },
        grid: {
            vertLines: { color: '#e0e0e8' },
            horzLines: { color: '#e0e0e8' },
        },
        crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: { color: '#999999', width: 1, style: 3, labelBackgroundColor: '#f0f0f5' },
            horzLine: { color: '#999999', width: 1, style: 3, labelBackgroundColor: '#f0f0f5' },
        },
        upColor: '#00a86b',
        downColor: '#d62839',
        wickUpColor: '#009060',
        wickDownColor: '#b81d2a',
        borderUpColor: '#00a86b',
        borderDownColor: '#d62839',
        volumeUpColor: 'rgba(0, 168, 107, 0.15)',
        volumeDownColor: 'rgba(214, 40, 57, 0.15)',
    },
};

/**
 * Initialize the chart in a container element
 */
export function initChart(containerId, isDark = true) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const theme = isDark ? CHART_THEMES.dark : CHART_THEMES.light;

    chart = createChart(container, {
        width: container.clientWidth,
        height: 400,
        layout: theme.layout,
        grid: theme.grid,
        crosshair: theme.crosshair,
        rightPriceScale: {
            borderColor: isDark ? '#1a1a35' : '#d0d0d8',
            scaleMargins: { top: 0.1, bottom: 0.25 },
        },
        timeScale: {
            borderColor: isDark ? '#1a1a35' : '#d0d0d8',
            timeVisible: true,
            secondsVisible: false,
        },
        handleScroll: { vertTouchDrag: false },
    });

    // Candlestick series
    candleSeries = chart.addCandlestickSeries({
        upColor: theme.upColor,
        downColor: theme.downColor,
        borderUpColor: theme.borderUpColor,
        borderDownColor: theme.borderDownColor,
        wickUpColor: theme.wickUpColor,
        wickDownColor: theme.wickDownColor,
    });

    // Volume histogram
    volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
    });

    // EMA 9 line
    ema9Series = chart.addLineSeries({
        color: '#4488ff',
        lineWidth: 1,
        lineStyle: 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
    });

    // EMA 21 line
    ema21Series = chart.addLineSeries({
        color: '#aa66ff',
        lineWidth: 1,
        lineStyle: 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
    });

    // Resize handler
    const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            const { width } = entry.contentRect;
            chart.applyOptions({ width });
        }
    });
    resizeObserver.observe(container);

    return chart;
}

/**
 * Set candle data from Kraken OHLCV
 */
export function setCandleData(candles) {
    if (!candleSeries || !candles || candles.length === 0) return;

    currentCandles = candles;

    const candleData = candles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
    }));

    const volumeData = candles.map(c => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open
            ? (document.documentElement.dataset.theme === 'light' ? 'rgba(0, 168, 107, 0.15)' : 'rgba(0, 255, 136, 0.15)')
            : (document.documentElement.dataset.theme === 'light' ? 'rgba(214, 40, 57, 0.15)' : 'rgba(255, 51, 68, 0.15)'),
    }));

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);

    // Compute and set EMA overlays
    setEMAData(candles);

    // Fit content
    chart.timeScale().fitContent();
}

/**
 * Compute EMA and set on line series
 */
function setEMAData(candles) {
    const closes = candles.map(c => c.close);

    const ema9Values = computeEMA(closes, 9);
    const ema21Values = computeEMA(closes, 21);

    const ema9Data = [];
    const ema21Data = [];

    for (let i = 0; i < candles.length; i++) {
        if (ema9Values[i] !== null) {
            ema9Data.push({ time: candles[i].time, value: ema9Values[i] });
        }
        if (ema21Values[i] !== null) {
            ema21Data.push({ time: candles[i].time, value: ema21Values[i] });
        }
    }

    ema9Series.setData(ema9Data);
    ema21Series.setData(ema21Data);
}

/**
 * Simple EMA computation
 */
function computeEMA(data, period) {
    const result = new Array(data.length).fill(null);
    if (data.length < period) return result;

    const k = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[i];
    result[period - 1] = sum / period;

    for (let i = period; i < data.length; i++) {
        result[i] = data[i] * k + result[i - 1] * (1 - k);
    }
    return result;
}

/**
 * Update the last candle's close price in real-time
 */
export function updateLastCandle(price) {
    if (!candleSeries || currentCandles.length === 0) return;

    const last = currentCandles[currentCandles.length - 1];
    const updatedCandle = {
        time: last.time,
        open: last.open,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
        close: price,
    };

    candleSeries.update(updatedCandle);

    // Update stored candle
    last.high = updatedCandle.high;
    last.low = updatedCandle.low;
    last.close = price;
}

/**
 * Update chart theme (dark/light)
 */
export function updateChartTheme(isDark) {
    if (!chart) return;

    const theme = isDark ? CHART_THEMES.dark : CHART_THEMES.light;

    chart.applyOptions({
        layout: theme.layout,
        grid: theme.grid,
        crosshair: theme.crosshair,
        rightPriceScale: { borderColor: isDark ? '#1a1a35' : '#d0d0d8' },
        timeScale: { borderColor: isDark ? '#1a1a35' : '#d0d0d8' },
    });

    candleSeries.applyOptions({
        upColor: theme.upColor,
        downColor: theme.downColor,
        borderUpColor: theme.borderUpColor,
        borderDownColor: theme.borderDownColor,
        wickUpColor: theme.wickUpColor,
        wickDownColor: theme.wickDownColor,
    });

    // Re-color volume bars
    if (currentCandles.length > 0) {
        const volumeData = currentCandles.map(c => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? theme.volumeUpColor : theme.volumeDownColor,
        }));
        volumeSeries.setData(volumeData);
    }
}
