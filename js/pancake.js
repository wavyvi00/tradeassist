
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
    "function paused() view returns (bool)"
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

        return {
            epoch: currentEpoch.toString(),
            lockTimestamp,
            secondsRemaining,
            status: secondsRemaining > 0 ? 'OPEN' : 'LOCKED',
            bullAmount: ethers.utils.formatEther(roundData.bullAmount),
            bearAmount: ethers.utils.formatEther(roundData.bearAmount),
            totalAmount: ethers.utils.formatEther(roundData.totalAmount),
        };
    } catch (e) {
        console.error("[Pancake] Error fetching round:", e);
        return null;
    }
}
