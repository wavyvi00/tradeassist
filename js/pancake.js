
// ============================================================
// PancakeSwap Prediction V2 Service
// Handles interaction with BSC smart contract
// ============================================================

const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const PREDICTION_CONTRACT_ADDRESS = '0x18B2A687610328590Bc8F2e5fEdDe3b582A49cdA';

// Minimal ABI for what we need
const ABI = [
    "function currentEpoch() view returns (uint256)",
    "function rounds(uint256 epoch) view returns (uint256 epoch, uint256 startTimestamp, uint256 lockTimestamp, uint256 closeTimestamp, int256 lockPrice, int256 closePrice, uint256 lockOracleId, uint256 closeOracleId, uint256 totalAmount, uint256 bullAmount, uint256 bearAmount, uint256 rewardBaseCalAmount, uint256 rewardAmount, bool oracleCalled)",
    "function paused() view returns (bool)",
    "event BetBull(address indexed sender, uint256 currentEpoch, uint256 amount)",
    "event BetBear(address indexed sender, uint256 currentEpoch, uint256 amount)"
];

let provider = null;
let contract = null;

export async function initPancakeService() {
    if (!window.ethers) {
        console.error("Ethers.js not loaded");
        return;
    }

    try {
        provider = new ethers.providers.JsonRpcProvider(BSC_RPC);
        contract = new ethers.Contract(PREDICTION_CONTRACT_ADDRESS, ABI, provider);
        console.log("[Pancake] Service initialized");
        return true;
    } catch (e) {
        console.error("[Pancake] Failed to initialize:", e);
        return false;
    }
}

/**
 * Fetch current round information
 */
export async function getPancakeRound() {
    if (!contract) await initPancakeService();
    if (!contract) return null;

    try {
        const isPaused = await contract.paused();
        if (isPaused) return { status: 'PAUSED' };

        const currentEpoch = await contract.currentEpoch();
        const roundData = await contract.rounds(currentEpoch);

        // Calculate time remaining
        const now = Math.floor(Date.now() / 1000);
        const lockTimestamp = roundData.lockTimestamp.toNumber();
        const secondsRemaining = lockTimestamp - now;

        const bullAmount = parseFloat(ethers.utils.formatEther(roundData.bullAmount));
        const bearAmount = parseFloat(ethers.utils.formatEther(roundData.bearAmount));
        const totalAmount = parseFloat(ethers.utils.formatEther(roundData.totalAmount));

        // Calculate ratios
        let bullRatio = 50;
        let bearRatio = 50;
        if (totalAmount > 0) {
            bullRatio = Math.round((bullAmount / totalAmount) * 100);
            bearRatio = 100 - bullRatio;
        }

        return {
            epoch: currentEpoch.toString(),
            lockTimestamp,
            secondsRemaining,
            status: secondsRemaining > 0 ? 'OPEN' : 'LOCKED',
            bullAmount,
            bearAmount,
            totalAmount,
            bullRatio,
            bearRatio,
            bullPayout: bullAmount > 0 ? (totalAmount / bullAmount) : 0,
            bearPayout: bearAmount > 0 ? (totalAmount / bearAmount) : 0,
            lockPrice: roundData.lockPrice ? parseFloat(ethers.utils.formatUnits(roundData.lockPrice, 8)) : 0,
            closePrice: roundData.closePrice ? parseFloat(ethers.utils.formatUnits(roundData.closePrice, 8)) : 0
        };
    } catch (e) {
        console.error("[Pancake] Error fetching round:", e);
        return null;
    }
}

/**
 * Fetch last N rounds history
 */
export async function getRoundHistory(count = 5) {
    if (!contract) await initPancakeService();
    if (!contract) return [];

    try {
        const currentEpoch = await contract.currentEpoch();
        const history = [];

        // Start from previous round (currentEpoch - 1)
        let epoch = currentEpoch.sub(1);

        for (let i = 0; i < count; i++) {
            if (epoch.lte(0)) break;

            const roundData = await contract.rounds(epoch);
            const lockPrice = parseFloat(ethers.utils.formatUnits(roundData.lockPrice, 8));
            const closePrice = parseFloat(ethers.utils.formatUnits(roundData.closePrice, 8));

            // Determine winner
            let winner = 'SAME';
            if (closePrice > lockPrice) winner = 'UP';
            else if (closePrice < lockPrice) winner = 'DOWN';

            history.push({
                epoch: epoch.toString(),
                lockPrice,
                closePrice,
                winner
            });

            epoch = epoch.sub(1);
        }

        return history;
    } catch (e) {
        console.error("[Pancake] Error fetching history:", e);
        return [];
    }
}

// ============================================================
// Real-time Bet Monitoring
// ============================================================

let currentStats = {
    whales: [],
    bullVolume: 0,
    bearVolume: 0,
    velocity: 0,
    lastUpdate: Date.now()
};

let velocityInterval = null;

export function startBetMonitor(callback) {
    if (!contract) return;

    console.log("[Pancake] Starting bet monitor...");

    // Reset stats
    currentStats = {
        whales: [],
        bullVolume: 0,
        bearVolume: 0,
        velocity: 0,
        lastUpdate: Date.now()
    };

    // Clear existing listeners to prevent duplicates
    contract.removeAllListeners("BetBull");
    contract.removeAllListeners("BetBear");

    // Listen for events
    contract.on("BetBull", (sender, epoch, amount) => {
        handleBet(sender, epoch, amount, 'BULL', callback);
    });

    contract.on("BetBear", (sender, epoch, amount) => {
        handleBet(sender, epoch, amount, 'BEAR', callback);
    });

    // Velocity decay (reset every minute for simplicity in this version, or sliding window)
    // For a smoother velocity, we can just decay count
    if (velocityInterval) clearInterval(velocityInterval);
    velocityInterval = setInterval(() => {
        if (currentStats.velocity > 0) currentStats.velocity--;
    }, 5000); // Decay 1 bet every 5 seconds roughly approx
}

function handleBet(sender, epoch, amount, side, callback) {
    const amountBNB = parseFloat(ethers.utils.formatEther(amount));

    // Update stats
    currentStats.velocity++;
    if (side === 'BULL') currentStats.bullVolume += amountBNB;
    else currentStats.bearVolume += amountBNB;

    const isWhale = amountBNB >= 1.0; // Whale threshold >= 1 BNB

    if (isWhale) {
        const whaleBet = {
            sender,
            side,
            amount: amountBNB,
            timestamp: Date.now()
        };
        currentStats.whales.unshift(whaleBet);
        if (currentStats.whales.length > 5) currentStats.whales.pop(); // Keep last 5
    }

    if (callback) {
        callback({
            type: 'BET',
            side,
            amount: amountBNB,
            isWhale,
            sender,
            stats: currentStats
        });
    }
}

export function stopBetMonitor() {
    if (contract) {
        contract.removeAllListeners("BetBull");
        contract.removeAllListeners("BetBear");
        console.log("[Pancake] Bet monitor stopped");
    }
    if (velocityInterval) clearInterval(velocityInterval);
}
