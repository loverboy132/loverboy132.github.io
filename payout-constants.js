// payout-constants.js - Shared constants and helpers for points & payout calculations
// Points are derived from money: 1 point = 150 naira
// Platform takes 10% fee on job payouts

export const POINT_CONVERSION_RATE = 150;
export const PLATFORM_FEE_RATE = 0.10;

/**
 * Calculate points from naira amount (1 point = 150 naira)
 * @param {number} amount - Amount in naira
 * @returns {number} Points (floor of amount / 150)
 */
export function calculatePoints(amount) {
    return Math.floor((amount ?? 0) / POINT_CONVERSION_RATE);
}

/**
 * Calculate payout with platform fee deduction (10%)
 * @param {number} amount - Original job amount in naira
 * @returns {{ originalAmount: number, fee: number, apprenticeAmount: number }}
 */
export function calculatePayout(amount) {
    const originalAmount = amount ?? 0;
    const fee = originalAmount * PLATFORM_FEE_RATE;
    const apprenticeAmount = originalAmount - fee;

    return {
        originalAmount,
        fee,
        apprenticeAmount
    };
}
