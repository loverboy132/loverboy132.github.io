// manual-payment-system.js - Manual Payment System Implementation
// Based on manual.txt specifications
import { supabase } from "./supabase-auth.js";
import { 
    notifyFundingRequestCreated,
    notifyFundingRequestApproved,
    notifyFundingRequestRejected,
    notifyWithdrawalRequestCreated,
    notifyWithdrawalRequestApproved,
    notifyWithdrawalRequestRejected,
    notifyEscrowFundsHeld,
    notifyEscrowFundsReleased,
    notifyEscrowFundsRefunded
} from "./payment-notifications.js";

async function safeNotifyFundingApproval(userId, amount, reference) {
    try {
        await notifyFundingRequestApproved(userId, amount, reference);
    } catch (notificationError) {
        console.warn(
            "Failed to send funding approval notification:",
            notificationError
        );
    }
}

async function safeNotifyWithdrawalRejection(userId, amountPoints, reason) {
    try {
        await notifyWithdrawalRequestRejected(userId, amountPoints, reason);
    } catch (notificationError) {
        console.warn(
            "Failed to send withdrawal rejection notification:",
            notificationError
        );
    }
}

function isRpcFunctionMissing(error) {
    if (!error) return false;
    if (error.code === "42883") return true;
    const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
    return (
        message.includes("function") &&
        (message.includes("does not exist") || message.includes("not found"))
    );
}

function generateSubscriptionReference(planKey) {
    const safeKey = (planKey || "plan").toUpperCase();
    const random = Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, "0");
    return `SUB-${safeKey}-${Date.now()}-${random}`;
}

// ==============================================
// WALLET MANAGEMENT FUNCTIONS
// ==============================================

// Atomic wallet balance update function to prevent sync issues
export async function updateWalletBalanceAtomically(userId, balanceChanges) {
    const { balance_ngn = 0, balance_points = 0, total_deposited = null, total_withdrawn = null } = balanceChanges;

    try {
        console.log('Starting atomic wallet update:', {
            userId,
            balanceChanges,
            timestamp: new Date().toISOString()
        });

        // Get current wallet state
        const currentWallet = await getUserWallet(userId);
        if (!currentWallet) {
            throw new Error('Wallet not found for user');
        }

        console.log('Current wallet state:', {
            balance_ngn: currentWallet.balance_ngn || 0,
            balance_points: currentWallet.balance_points || 0,
            total_deposited: currentWallet.total_deposited || 0,
            total_withdrawn: currentWallet.total_withdrawn || 0
        });

        // Calculate new balances
        const newBalanceNgn = (currentWallet.balance_ngn || 0) + balance_ngn;
        const newBalancePoints = (currentWallet.balance_points || 0) + balance_points;
        const newTotalDeposited = total_deposited !== null ? (currentWallet.total_deposited || 0) + total_deposited : null;
        const newTotalWithdrawn = total_withdrawn !== null ? (currentWallet.total_withdrawn || 0) + total_withdrawn : null;

        console.log('Calculated new balances:', {
            new_balance_ngn: newBalanceNgn,
            new_balance_points: newBalancePoints,
            new_total_deposited: newTotalDeposited,
            new_total_withdrawn: newTotalWithdrawn
        });

        // Validate balances (prevent negative balances)
        if (newBalanceNgn < 0) {
            throw new Error(`Insufficient NGN balance. Required: ${Math.abs(balance_ngn)}, Available: ${currentWallet.balance_ngn || 0}`);
        }
        if (newBalancePoints < 0) {
            throw new Error(`Insufficient points balance. Required: ${Math.abs(balance_points)}, Available: ${currentWallet.balance_points || 0}`);
        }

        // Update wallet atomically using RPC function
        let updatedWallet = null;

        try {
            // Try RPC function first (bypasses RLS and ensures atomicity)
            const { data: rpcResult, error: rpcError } = await supabase.rpc('update_user_wallet', {
                p_user_id: userId,
                p_balance_ngn: newBalanceNgn,
                p_balance_points: newBalancePoints,
                p_total_deposited: newTotalDeposited,
                p_total_withdrawn: newTotalWithdrawn
            });

            if (rpcError) {
                if (rpcError.code === '42883') {
                    console.warn('RPC function update_user_wallet does not exist, falling back to direct update');
                } else {
                    throw rpcError;
                }
            } else {
                updatedWallet = rpcResult;
                console.log('Wallet updated via RPC successfully');
            }
        } catch (rpcErr) {
            console.warn('RPC update failed, falling back to direct update:', rpcErr);
        }

        // Fallback to direct update if RPC failed or doesn't exist
        if (!updatedWallet) {
            const updateData = {
                balance_ngn: newBalanceNgn,
                balance_points: newBalancePoints,
                updated_at: new Date().toISOString()
            };

            if (newTotalDeposited !== null) updateData.total_deposited = newTotalDeposited;
            if (newTotalWithdrawn !== null) updateData.total_withdrawn = newTotalWithdrawn;

            const { data: directResult, error: directError } = await supabase
                .from('user_wallets')
                .update(updateData)
                .eq('user_id', userId)
                .select('balance_ngn, balance_points, total_deposited, total_withdrawn')
                .single();

            if (directError) {
                throw new Error('Failed to update wallet balance: ' + directError.message);
            }

            updatedWallet = directResult;
            console.log('Wallet updated via direct update successfully');
        }

        console.log('Wallet update completed successfully:', {
            old_balance_ngn: currentWallet.balance_ngn || 0,
            old_balance_points: currentWallet.balance_points || 0,
            new_balance_ngn: updatedWallet.balance_ngn,
            new_balance_points: updatedWallet.balance_points,
            change_ngn: balance_ngn,
            change_points: balance_points
        });

        return updatedWallet;
    } catch (error) {
        console.error('Atomic wallet update failed:', error);
        throw error;
    }
}

// Get user's wallet balance
export async function getUserWallet(userId) {
    try {
        const { data: wallet, error } = await supabase
            .from('user_wallets')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        // If no wallet exists, create one using RPC function (bypasses RLS)
        if (!wallet) {
            // Try using the database function first (bypasses RLS)
            const { data: rpcWallet, error: rpcError } = await supabase
                .rpc('create_user_wallet', { p_user_id: userId });

            // Log RPC call details for debugging
            console.log('RPC call result:', { rpcWallet, rpcError, userId });

            if (rpcError) {
                console.warn('RPC function error:', rpcError);
                // Log specific error codes for debugging
                if (rpcError.code === '42883') {
                    console.error('RPC function create_user_wallet does not exist. Please run supabase/fix-wallet-function-and-admin-access.sql');
                }
                // If RPC function doesn't exist or has an error, try direct insert
                const { data: newWallet, error: createError } = await supabase
                    .from('user_wallets')
                    .insert({ user_id: userId })
                    .select('*')
                    .single();

                if (createError) {
                    // If direct insert also fails, provide helpful error message
                    if (createError.message && createError.message.includes('row-level security')) {
                        throw new Error('Wallet creation failed due to security policy. Please run the SQL in supabase/fix-wallet-function-and-admin-access.sql to set up the database function and admin permissions. See WALLET_FUNCTION_FIX.md for details.');
                    }
                    throw createError;
                }
                return newWallet;
            }

            // Handle RPC success - function returns an array or single object
            if (rpcWallet) {
                const walletData = Array.isArray(rpcWallet) ? rpcWallet[0] : rpcWallet;
                if (walletData && walletData.user_id) {
                    console.log('Wallet created/retrieved via RPC:', walletData);
                    return walletData;
                } else {
                    console.warn('RPC returned empty or invalid wallet data:', rpcWallet);
                }
            }

            // If RPC succeeded but returned no data, try direct insert as fallback
            console.warn('RPC function returned no data, trying direct insert as fallback');
            const { data: newWallet, error: createError } = await supabase
                .from('user_wallets')
                .insert({ user_id: userId })
                .select('*')
                .single();

            if (createError) {
                // If direct insert also fails, provide helpful error message
                if (createError.message && createError.message.includes('row-level security')) {
                    throw new Error('Wallet creation failed due to security policy. Please run the SQL in supabase/fix-wallet-function-and-admin-access.sql to set up the database function and admin permissions. If you already ran it, check that the function exists and has SECURITY DEFINER enabled. See WALLET_FUNCTION_FIX.md for troubleshooting.');
                }
                throw createError;
            }
            return newWallet;
        }

        return wallet;
    } catch (error) {
        console.error("Error getting user wallet:", error);
        // Create a more descriptive error message
        const errorMessage = error?.message || error?.details || 'Unknown error occurred';
        const enhancedError = new Error(`Failed to get user wallet: ${errorMessage}`);
        enhancedError.originalError = error;
        throw enhancedError;
    }
}

// Get wallet transaction history
export async function getWalletTransactions(userId, limit = 50, offset = 0) {
    try {
        const { data: transactions, error } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return transactions;
    } catch (error) {
        console.error("Error getting wallet transactions:", error);
        throw error;
    }
}

// ==============================================
// FUNDING SYSTEM FUNCTIONS
// ==============================================

// Get Craftnet bank account details
export async function getCraftnetBankAccounts() {
    try {
        const { data: accounts, error } = await supabase
            .from('craftnet_bank_accounts')
            .select('*')
            .eq('is_active', true)
            .order('bank_name');

        if (error) throw error;
        return accounts;
    } catch (error) {
        console.error("Error getting bank accounts:", error);
        throw error;
    }
}

// Create funding request
export async function createFundingRequest(amountNgn, accountDetails, proofOfPaymentUrl = null) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        const { data, error } = await supabase.rpc('create_funding_request', {
            user_uuid: user.id,
            amount_ngn: amountNgn,
            account_details: accountDetails,
            proof_of_payment_url: proofOfPaymentUrl
        });

        if (error) throw error;
        
        // Send notification to user (non-blocking - don't fail request if notification fails)
        try {
            await notifyFundingRequestCreated(user.id, amountNgn, accountDetails);
        } catch (notificationError) {
            console.warn("Failed to send funding request notification:", notificationError);
            // Continue execution - notification failure shouldn't block the request
        }
        
        return data;
    } catch (error) {
        console.error("Error creating funding request:", error);
        throw error;
    }
}

// Get user's funding requests
export async function getUserFundingRequests(userId, limit = 20, offset = 0) {
    try {
        const { data: requests, error } = await supabase
            .from('funding_requests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return requests;
    } catch (error) {
        console.error("Error getting funding requests:", error);
        throw error;
    }
}

// ==============================================
// ESCROW SYSTEM FUNCTIONS
// ==============================================

// Create escrow for job
export async function createJobEscrow(jobId, memberId, apprenticeId, amountNgn) {
    try {
        const { data, error } = await supabase.rpc('create_job_escrow', {
            job_uuid: jobId,
            member_uuid: memberId,
            apprentice_uuid: apprenticeId,
            amount_ngn: amountNgn
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error creating job escrow:", error);
        throw error;
    }
}

// Get escrow details for a job
export async function getJobEscrow(jobId) {
    try {
        const { data: escrow, error } = await supabase
            .from('job_escrow')
            .select('*')
            .eq('job_id', jobId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return escrow;
    } catch (error) {
        console.error("Error getting job escrow:", error);
        throw error;
    }
}

// Get user's escrow transactions
export async function getUserEscrowTransactions(userId, limit = 20, offset = 0) {
    try {
        const { data: escrows, error } = await supabase
            .from('job_escrow')
            .select(`
                *,
                job_requests (
                    id,
                    title,
                    description
                )
            `)
            .or(`member_id.eq.${userId},apprentice_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return escrows;
    } catch (error) {
        console.error("Error getting escrow transactions:", error);
        throw error;
    }
}

// ==============================================
// WITHDRAWAL SYSTEM FUNCTIONS
// ==============================================

// Create withdrawal request
export async function createWithdrawalRequest(amountPoints, bankDetails) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        if (!amountPoints || amountPoints < 20) {
            throw new Error("Minimum withdrawal amount is 20 points.");
        }

        if (!bankDetails || !bankDetails.bank_name || !bankDetails.account_number || !bankDetails.account_name) {
            throw new Error("Bank details are incomplete. Please provide bank name, account number, and account name.");
        }

        const wallet = await getUserWallet(user.id);
        if (!wallet) {
            throw new Error("Unable to retrieve your wallet. Please try again.");
        }

        // Get user's role to determine fee
        const { data: userProfile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.warn('Could not fetch user profile for role check:', profileError);
        }

        // Calculate fee: 10% for apprentices, 0% for members
        const userRole = userProfile?.role || 'member';
        const withdrawalFeePercentage = userRole === 'apprentice' ? 0.10 : 0;
        const withdrawalFeePoints = userRole === 'apprentice' 
            ? Math.round(amountPoints * withdrawalFeePercentage * 100) / 100  // Round to 2 decimal places
            : 0;
        const totalDeductionPoints = amountPoints + withdrawalFeePoints;
        
        const availablePoints = wallet.balance_points ?? 0;
        if (availablePoints < totalDeductionPoints) {
            const feeMessage = withdrawalFeePoints > 0 
                ? `with the ${withdrawalFeePoints.toFixed(2)} point fee (10%)` 
                : `with no fee`;
            throw new Error(
                `Insufficient points balance. You requested ${amountPoints} points, but ${feeMessage}, you need ${totalDeductionPoints.toFixed(2)} points total. You have ${availablePoints.toFixed(2)} pts available.`
            );
        }

        // If RPC function doesn't support proof, we'll insert directly
        try {
            const { data, error } = await supabase.rpc('create_withdrawal_request', {
                user_uuid: user.id,
                amount_points: amountPoints,
                bank_details: bankDetails
            });

            if (error && error.code !== '42883') { // 42883 = function does not exist
                throw error;
            }
            
            if (data && !error) {
                // Send notification
                await notifyWithdrawalRequestCreated(user.id, amountPoints, bankDetails);
                return data;
            }
        } catch (rpcError) {
            // RPC function doesn't exist or doesn't support proof, insert directly
            console.warn('RPC function not available, inserting directly:', rpcError);
        }

        // Insert directly into table
        const amountNgn = pointsToNgn(amountPoints);
        const withdrawalFeeNgn = pointsToNgn(withdrawalFeePoints);
        const totalDeductionNgn = amountNgn + withdrawalFeeNgn;
        const supportsExtendedWithdrawalColumns = await withdrawalExtendedColumnsAvailable();

        const baseWithdrawalPayload = {
            user_id: user.id,
            amount_points: amountPoints,
            amount_ngn: amountNgn,
            bank_details: bankDetails,
            status: 'pending'
        };

        const extendedWithdrawalPayload = {
            ...baseWithdrawalPayload,
            withdrawal_fee_points: withdrawalFeePoints,
            withdrawal_fee_ngn: withdrawalFeeNgn,
            total_deduction_points: totalDeductionPoints,
            total_deduction_ngn: totalDeductionNgn
        };

        let insertionPayload = supportsExtendedWithdrawalColumns
            ? extendedWithdrawalPayload
            : baseWithdrawalPayload;

        let newRequest;
        let insertError;

        ({ data: newRequest, error: insertError } = await supabase
            .from('wallet_withdrawal_requests')
            .insert(insertionPayload)
            .select('*')
            .single());

        if (insertError) {
            if (supportsExtendedWithdrawalColumns && referencesMissingWithdrawalExtendedColumns(insertError)) {
                console.warn('Extended withdrawal columns missing in schema, retrying without them.');
                insertionPayload = baseWithdrawalPayload;
                cachedWithdrawalExtendedColumnsAvailable = false;
                ({ data: newRequest, error: insertError } = await supabase
                    .from('wallet_withdrawal_requests')
                    .insert(insertionPayload)
                    .select('*')
                    .single());
            } else if (
                !supportsExtendedWithdrawalColumns &&
                referencesWithdrawalExtendedColumnsNotNull(insertError)
            ) {
                console.warn('Extended withdrawal columns enforced by schema, retrying with them.');
                insertionPayload = extendedWithdrawalPayload;
                cachedWithdrawalExtendedColumnsAvailable = true;
                ({ data: newRequest, error: insertError } = await supabase
                    .from('wallet_withdrawal_requests')
                    .insert(insertionPayload)
                    .select('*')
                    .single());
            }
        }

        if (insertError) throw insertError;

        // Send notification (non-blocking - don't fail request if notification fails)
        try {
            await notifyWithdrawalRequestCreated(user.id, amountPoints, bankDetails);
        } catch (notificationError) {
            console.warn("Failed to send withdrawal request notification:", notificationError);
            // Continue execution - notification failure shouldn't block the request
        }
        
        return newRequest;
    } catch (error) {
        console.error("Error creating withdrawal request:", error);
        throw error;
    }
}

// Get user's withdrawal requests
export async function getUserWithdrawalRequests(userId, limit = 20, offset = 0) {
    try {
        const { data: requests, error } = await supabase
            .from('wallet_withdrawal_requests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return requests;
    } catch (error) {
        console.error("Error getting withdrawal requests:", error);
        throw error;
    }
}

// ==============================================
// ADMIN FUNCTIONS
// ==============================================

// Get all pending funding requests (admin only)
export async function getPendingFundingRequests(limit = 50, offset = 0) {
    try {
        const { data: requests, error } = await supabase
            .from('funding_requests')
            .select(`
                *,
                profiles!funding_requests_user_id_fkey (
                    id,
                    email,
                    name
                )
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return requests;
    } catch (error) {
        console.error("Error getting pending funding requests:", error);
        throw error;
    }
}

// Approve funding request (admin only)
export async function approveFundingRequest(requestId, accountDetails = null) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        // First, get the funding request details
        const { data: fundingRequest, error: fetchError } = await supabase
            .from('funding_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError || !fundingRequest) {
            throw new Error('Funding request not found');
        }

        if (fundingRequest.status !== 'pending') {
            throw new Error(`Funding request is already ${fundingRequest.status}`);
        }

        // Apply platform fee: only 90% of funded amount is credited to wallet/points
        const amountAfterFee = Math.round(fundingRequest.amount_ngn * 0.9);

        // Calculate points to add (1 point = ₦150) based on net amount after fee
        const pointsToAdd = ngnToPoints(amountAfterFee);
        let creditedAmount = amountAfterFee;

        // Try to call the RPC function first (if it exists)
        let rpcSucceeded = false;
        let rpcUpdatedStatus = false;
        try {
            const { data, error } = await supabase.rpc('approve_funding_request', {
                request_uuid: requestId,
                admin_uuid: user.id,
                account_details: accountDetails
            });
            if (error && error.code !== '42883') { // 42883 = function does not exist
                throw error;
            }
            
            // Check if RPC updated the status (regardless of data/error response)
            // This handles cases where RPC might succeed but not return data
            const { data: statusCheck, error: statusCheckError } = await supabase
                .from('funding_requests')
                .select('status')
                .eq('id', requestId)
                .single();
            
            if (!statusCheckError && statusCheck && statusCheck.status === 'approved') {
                rpcUpdatedStatus = true;
                console.log('RPC function appears to have updated status to approved');
                
                // Verify wallet was credited
                const referenceToCheck = accountDetails || `FR-${requestId}`;
                const { data: existingTransactionByRef } = await supabase
                    .from('wallet_transactions')
                    .select('id')
                    .eq('user_id', fundingRequest.user_id)
                    .eq('transaction_type', 'deposit')
                    .eq('reference', referenceToCheck)
                    .limit(1);
                
                // Also check by funding_request_id in metadata
                const { data: existingTransactionByMetadata } = await supabase
                    .from('wallet_transactions')
                    .select('id')
                    .eq('user_id', fundingRequest.user_id)
                    .eq('transaction_type', 'deposit')
                    .eq('metadata->>funding_request_id', requestId.toString())
                    .limit(1);
                
                // If transaction exists, RPC handled everything successfully
                if ((existingTransactionByRef && existingTransactionByRef.length > 0) ||
                    (existingTransactionByMetadata && existingTransactionByMetadata.length > 0)) {
                    console.log('RPC function successfully credited wallet');
                    rpcSucceeded = true;
                    const approvalResult = {
                        success: true,
                        message: 'Funding request approved and wallet credited successfully',
                        funding_request_id: requestId,
                        amount_credited: fundingRequest.amount_ngn,
                        points_credited: pointsToAdd
                    };
                    await safeNotifyFundingApproval(
                        fundingRequest.user_id,
                        fundingRequest.amount_ngn,
                        accountDetails || `FR-${requestId}`
                    );
                    return approvalResult;
                } else {
                    console.warn('RPC updated status but did not credit wallet. Will credit manually.');
                    rpcSucceeded = false; // Force manual credit
                }
            } else if (data && !error) {
                // RPC returned success but status wasn't updated - might have failed silently
                console.warn('RPC returned success but status was not updated. Will handle manually.');
                rpcSucceeded = false;
            }
        } catch (rpcError) {
            // If RPC function doesn't exist or fails, we'll handle it manually
            console.warn('RPC function not available or failed, handling approval manually:', rpcError);
            rpcSucceeded = false;
        }

        // If RPC didn't handle it, do it manually
        if (!rpcSucceeded) {
            console.log('Processing funding request approval manually:', requestId);
            
            // Double-check the request status before processing
            const { data: currentRequest, error: currentRequestError } = await supabase
                .from('funding_requests')
                .select('status, user_id, amount_ngn')
                .eq('id', requestId)
                .single();
            
            if (currentRequestError) {
                console.error('Error checking current request status:', currentRequestError);
                throw new Error('Failed to verify funding request status: ' + currentRequestError.message);
            }
            
            if (!currentRequest) {
                throw new Error('Funding request not found');
            }
            
            // If already rejected, don't proceed
            if (currentRequest.status === 'rejected') {
                throw new Error(`Funding request is already ${currentRequest.status} and cannot be approved`);
            }
            
            console.log('Current request status:', currentRequest.status);
            
            let updatedRequest;
            
            // Only update status if it's still pending
            if (currentRequest.status === 'pending') {
                // Update funding request status to approved FIRST
                const updateData = {
                    status: 'approved',
                    processed_at: new Date().toISOString()
                };
                
                if (accountDetails) {
                    updateData.admin_notes = `Transaction Reference: ${accountDetails}`;
                }
                
                console.log('Updating funding request status to approved:', {
                    requestId,
                    updateData,
                    currentStatus: currentRequest.status
                });
                
                // Update without .single() first to check if any rows were affected
                const { data: updatedRequests, error: updateError } = await supabase
                    .from('funding_requests')
                    .update(updateData)
                    .eq('id', requestId)
                    .eq('status', 'pending') // Only update if still pending (prevents race conditions)
                    .select('status, user_id, amount_ngn');

                if (updateError) {
                    console.error('Failed to update funding request status - Error details:', {
                        error: updateError,
                        message: updateError.message,
                        code: updateError.code,
                        details: updateError.details,
                        hint: updateError.hint,
                        requestId
                    });
                    throw new Error(`Failed to update funding request status: ${updateError.message || JSON.stringify(updateError)}`);
                }

                // Check if any rows were updated
                if (!updatedRequests || updatedRequests.length === 0) {
                    console.warn('Status update returned no rows - checking current status:', requestId);
                    // No rows were updated, meaning the status was already changed by another process
                    // Re-fetch to get current status
                    const { data: checkRequest, error: checkError } = await supabase
                        .from('funding_requests')
                        .select('status, user_id, amount_ngn')
                        .eq('id', requestId)
                        .single();
                    
                    if (checkError) {
                        console.error('Failed to verify funding request status after update:', checkError);
                        // Check if request doesn't exist
                        if (checkError.code === 'PGRST116') {
                            throw new Error('Funding request not found. It may have been deleted.');
                        }
                        throw new Error(`Failed to verify funding request status: ${checkError.message || JSON.stringify(checkError)}`);
                    }
                    
                    // Check if request exists
                    if (!checkRequest) {
                        throw new Error('Funding request not found. It may have been deleted.');
                    }
                    
                    if (checkRequest.status === 'approved') {
                        console.log('Request was already approved by another process, proceeding to credit wallet');
                        updatedRequest = checkRequest;
                    } else if (checkRequest.status === 'pending') {
                        // Still pending but update failed - might be a database issue or the request was locked
                        // Try to proceed anyway - maybe the update partially worked
                        console.warn('Status is still pending but update returned no rows - this might indicate a database issue');
                        // Re-check if we can try the update again or if wallet needs crediting
                        // For now, check if wallet was already credited
                        const referenceToCheck = accountDetails || `FR-${requestId}`;
                        const { data: existingTransactionByRef } = await supabase
                            .from('wallet_transactions')
                            .select('id')
                            .eq('user_id', currentRequest.user_id)
                            .eq('transaction_type', 'deposit')
                            .eq('reference', referenceToCheck)
                            .limit(1);
                        
                        if (existingTransactionByRef && existingTransactionByRef.length > 0) {
                            // Wallet was already credited, so the request might have been approved
                            // Try to update status one more time
                            const { error: retryUpdateError } = await supabase
                                .from('funding_requests')
                                .update({ status: 'approved', processed_at: new Date().toISOString() })
                                .eq('id', requestId);
                            
                            if (!retryUpdateError) {
                                updatedRequest = { ...checkRequest, status: 'approved' };
                            } else {
                                throw new Error('Funding request could not be updated. Please try again or contact support.');
                            }
                        } else {
                            // No transaction found, proceed with manual update
                            throw new Error('Could not update funding request status. Please refresh the page and try again.');
                        }
                    } else {
                        // Status changed to something else (rejected, etc.)
                        const errorMsg = `Funding request status is "${checkRequest.status}" and cannot be approved.`;
                        console.error('Status update failed:', {
                            requestId,
                            expectedStatus: 'pending',
                            currentStatus: checkRequest.status,
                            checkRequest
                        });
                        throw new Error(errorMsg);
                    }
                } else {
                    // Verify the update actually worked
                    updatedRequest = updatedRequests[0];
                    if (!updatedRequest || updatedRequest.status !== 'approved') {
                        console.error('Status update verification failed:', {
                            requestId,
                            updatedRequest,
                            expectedStatus: 'approved',
                            actualStatus: updatedRequest?.status
                        });
                        throw new Error(`Status update verification failed - request status is ${updatedRequest?.status || 'unknown'} instead of 'approved'`);
                    }
                    console.log('Funding request status updated to approved successfully:', {
                        requestId,
                        userId: updatedRequest.user_id,
                        amount: updatedRequest.amount_ngn
                    });
                }
            } else if (currentRequest.status === 'approved') {
                // Status is already approved (likely by RPC), but wallet wasn't credited
                // Proceed to credit the wallet
                console.log('Request is already approved, but wallet needs to be credited');
                updatedRequest = currentRequest;
            } else {
                throw new Error(`Funding request is ${currentRequest.status} and cannot be approved`);
            }

            // Now credit the wallet
            // First, check if wallet was already credited for this funding request
            const userId = updatedRequest.user_id || fundingRequest.user_id;
            
            // Check for existing transaction by reference or funding_request_id in metadata
            const referenceToCheck = accountDetails || `FR-${requestId}`;
            const { data: existingTransactionsByRef } = await supabase
                .from('wallet_transactions')
                .select('id')
                .eq('user_id', userId)
                .eq('transaction_type', 'deposit')
                .eq('reference', referenceToCheck)
                .limit(1);
            
            // Also check by funding_request_id in metadata
            const { data: existingTransactionsByMetadata } = await supabase
                .from('wallet_transactions')
                .select('id')
                .eq('user_id', userId)
                .eq('transaction_type', 'deposit')
                .eq('metadata->>funding_request_id', requestId.toString())
                .limit(1);
            
            if ((existingTransactionsByRef && existingTransactionsByRef.length > 0) ||
                (existingTransactionsByMetadata && existingTransactionsByMetadata.length > 0)) {
                console.log('Wallet was already credited for this funding request, skipping credit');
                const alreadyCreditedResult = {
                    success: true,
                    message: 'Funding request approved and wallet already credited',
                    funding_request_id: requestId,
                    amount_credited: fundingRequest.amount_ngn,
                    points_credited: pointsToAdd,
                    already_credited: true
                };
                await safeNotifyFundingApproval(
                    fundingRequest.user_id,
                    fundingRequest.amount_ngn,
                    accountDetails || `FR-${requestId}`
                );
                return alreadyCreditedResult;
            }
            
            // Get or create user wallet using RPC function (bypasses RLS)
            // This ensures we can access the wallet even if admin RLS policies aren't set up
            let wallet;
            try {
                // Try using the RPC function first (bypasses RLS)
                const { data: rpcWallet, error: rpcError } = await supabase
                    .rpc('create_user_wallet', { p_user_id: userId });

                if (rpcError) {
                    console.warn('RPC function error, falling back to getUserWallet:', rpcError);
                    // Fall back to getUserWallet if RPC fails
                    wallet = await getUserWallet(userId);
                } else {
                    // Handle RPC success - function returns an array or single object
                    if (rpcWallet) {
                        const walletData = Array.isArray(rpcWallet) ? rpcWallet[0] : rpcWallet;
                        if (walletData && walletData.user_id) {
                            console.log('Wallet retrieved/created via RPC:', walletData);
                            wallet = walletData;
                        } else {
                            console.warn('RPC returned empty or invalid wallet data, falling back to getUserWallet');
                            wallet = await getUserWallet(userId);
                        }
                    } else {
                        console.warn('RPC returned no data, falling back to getUserWallet');
                        wallet = await getUserWallet(userId);
                    }
                }
            } catch (error) {
                console.error('Error getting wallet via RPC, falling back to getUserWallet:', error);
                wallet = await getUserWallet(userId);
            }

            // Validate wallet was retrieved/created
            if (!wallet || !wallet.id) {
                console.error('Failed to get or create wallet for user:', {
                    userId,
                    wallet: wallet
                });
                throw new Error('Failed to get or create wallet for user');
            }

            console.log('Current wallet balance before credit:', {
                balance_ngn: wallet.balance_ngn,
                balance_points: wallet.balance_points,
                user_id: userId,
                wallet_id: wallet.id
            });
            
            // Credit only 90% of the funded amount to the wallet
            const amountToCredit = Math.round(
                (updatedRequest.amount_ngn || fundingRequest.amount_ngn) * 0.9
            );
            creditedAmount = amountToCredit;
            const newBalanceNgn = (wallet.balance_ngn || 0) + amountToCredit;
            const newBalancePoints = (wallet.balance_points || 0) + pointsToAdd;
            const newTotalDeposited = (wallet.total_deposited || 0) + amountToCredit;

            // Update wallet balance with better error handling
            console.log('Attempting to credit wallet:', {
                user_id: userId,
                wallet_id: wallet.id,
                amount_ngn: amountToCredit,
                points: pointsToAdd,
                new_balance_ngn: newBalanceNgn,
                new_balance_points: newBalancePoints
            });
            
            // Update wallet using RPC function (bypasses RLS)
            // Try RPC function first, fall back to direct update if it doesn't exist
            let updatedWallet = null;
            let walletUpdateError = null;
            
            try {
                // Try using the RPC function first (bypasses RLS)
                const { data: rpcUpdatedWallet, error: rpcError } = await supabase
                    .rpc('update_user_wallet', {
                        p_user_id: userId,
                        p_balance_ngn: newBalanceNgn,
                        p_balance_points: newBalancePoints,
                        p_total_deposited: newTotalDeposited,
                        p_total_withdrawn: null // Don't change total_withdrawn for deposits
                    });

                if (rpcError) {
                    if (rpcError.code === '42883') {
                        // Function doesn't exist, fall back to direct update
                        console.warn('RPC function update_user_wallet does not exist, falling back to direct update. Please run supabase/update-user-wallet-function.sql');
                        walletUpdateError = null; // Reset error to try fallback
                    } else {
                        console.error('RPC function error:', rpcError);
                        walletUpdateError = rpcError;
                    }
                } else if (rpcUpdatedWallet) {
                    // RPC succeeded
                    const walletData = Array.isArray(rpcUpdatedWallet) ? rpcUpdatedWallet[0] : rpcUpdatedWallet;
                    if (walletData && walletData.user_id) {
                        console.log('Wallet updated successfully via RPC:', walletData);
                        updatedWallet = walletData;
                    }
                }
            } catch (rpcErr) {
                console.warn('RPC call failed, falling back to direct update:', rpcErr);
                walletUpdateError = null; // Reset to try fallback
            }

            // Fallback to direct update if RPC didn't work
            if (!updatedWallet && !walletUpdateError) {
                console.log('Attempting direct wallet update (may be blocked by RLS)...');
                const { data: updatedWallets, error: directUpdateError } = await supabase
                    .from('user_wallets')
                    .update({
                        balance_ngn: newBalanceNgn,
                        balance_points: newBalancePoints,
                        total_deposited: newTotalDeposited
                    })
                    .eq('user_id', userId)
                    .select('balance_ngn, balance_points, total_deposited');

                if (directUpdateError) {
                    walletUpdateError = directUpdateError;
                } else if (updatedWallets && updatedWallets.length > 0) {
                    updatedWallet = updatedWallets[0];
                }
            }

            // Handle update errors
            if (walletUpdateError) {
                console.error('Failed to credit wallet - Error details:', {
                    error: walletUpdateError,
                    message: walletUpdateError.message,
                    code: walletUpdateError.code,
                    details: walletUpdateError.details,
                    hint: walletUpdateError.hint
                });
                // Try to revert the status update
                try {
                    const { error: revertError } = await supabase
                        .from('funding_requests')
                        .update({ status: 'pending', processed_at: null })
                        .eq('id', requestId)
                        .eq('status', 'approved'); // Only revert if still approved
                    if (revertError) {
                        console.error('Failed to revert status update:', revertError);
                    }
                } catch (revertErr) {
                    console.error('Exception while reverting status:', revertErr);
                }
                throw new Error(`Failed to credit wallet: ${walletUpdateError.message || JSON.stringify(walletUpdateError)}`);
            }

            // Verify the wallet was updated correctly
            // If we still don't have updatedWallet, fetch it via RPC to verify
            if (!updatedWallet) {
                console.warn('Update did not return wallet data, verifying via RPC...');
                try {
                    const { data: verifyWallet, error: verifyError } = await supabase
                        .rpc('create_user_wallet', { p_user_id: userId });
                    
                    if (!verifyError && verifyWallet) {
                        const walletData = Array.isArray(verifyWallet) ? verifyWallet[0] : verifyWallet;
                        if (walletData) {
                            // Check if balances match what we expected
                            const balanceMatches = Math.abs((walletData.balance_ngn || 0) - newBalanceNgn) < 0.01;
                            const pointsMatch = Math.abs((walletData.balance_points || 0) - newBalancePoints) < 0.01;
                            
                            if (balanceMatches && pointsMatch) {
                                console.log('Wallet update verified via RPC - balances match expected values');
                                updatedWallet = walletData;
                            } else {
                                console.error('Wallet update verification failed - balances do not match:', {
                                    expected_ngn: newBalanceNgn,
                                    actual_ngn: walletData.balance_ngn,
                                    expected_points: newBalancePoints,
                                    actual_points: walletData.balance_points
                                });
                                // Try to revert the status update
                                try {
                                    const { error: revertError } = await supabase
                                        .from('funding_requests')
                                        .update({ status: 'pending', processed_at: null })
                                        .eq('id', requestId)
                                        .eq('status', 'approved');
                                    if (revertError) {
                                        console.error('Failed to revert status update:', revertError);
                                    }
                                } catch (revertErr) {
                                    console.error('Exception while reverting status:', revertErr);
                                }
                                throw new Error('Wallet update verification failed - balances do not match. The update may have been blocked by RLS. Please run supabase/update-user-wallet-function.sql to create the RPC function.');
                            }
                        } else {
                            throw new Error('Wallet update verification failed - could not retrieve wallet via RPC');
                        }
                    } else {
                        throw new Error(`Wallet update verification failed - could not verify via RPC: ${verifyError?.message || 'Unknown error'}`);
                    }
                } catch (verifyErr) {
                    console.error('Exception while verifying wallet update:', verifyErr);
                    // Try to revert the status update
                    try {
                        const { error: revertError } = await supabase
                            .from('funding_requests')
                            .update({ status: 'pending', processed_at: null })
                            .eq('id', requestId)
                            .eq('status', 'approved');
                        if (revertError) {
                            console.error('Failed to revert status update:', revertError);
                        }
                    } catch (revertErr) {
                        console.error('Exception while reverting status:', revertErr);
                    }
                    throw new Error(`Wallet update verification failed: ${verifyErr.message || 'Unknown error'}`);
                }
            }

            // Verify the amounts match (with tolerance for floating point)
            const ngnDiff = Math.abs((updatedWallet.balance_ngn || 0) - newBalanceNgn);
            const pointsDiff = Math.abs((updatedWallet.balance_points || 0) - newBalancePoints);
            
            if (ngnDiff > 0.01 || pointsDiff > 0.01) {
                console.error('Wallet balance mismatch:', {
                    expected_ngn: newBalanceNgn,
                    actual_ngn: updatedWallet.balance_ngn,
                    ngn_difference: ngnDiff,
                    expected_points: newBalancePoints,
                    actual_points: updatedWallet.balance_points,
                    points_difference: pointsDiff,
                    userId,
                    requestId
                });
                // Don't throw - the wallet was updated, but log the discrepancy for investigation
                // This might indicate a race condition or concurrent update
            } else {
                console.log('Wallet balance verified successfully');
            }

            console.log('Wallet credited successfully:', {
                previous_balance_ngn: wallet.balance_ngn,
                previous_balance_points: wallet.balance_points,
                amount_added_ngn: amountToCredit,
                points_added: pointsToAdd,
                new_balance_ngn: updatedWallet.balance_ngn,
                new_balance_points: updatedWallet.balance_points
            });

            // Create wallet transaction record
            const { data: transactionData, error: transactionError } = await supabase
                .from('wallet_transactions')
                .insert({
                    user_id: userId,
                    transaction_type: 'deposit',
                    amount_ngn: amountToCredit,
                    amount_points: pointsToAdd,
                    description: `Wallet funding approved - Request ID: ${requestId}`,
                    reference: accountDetails || `FR-${requestId}`,
                    status: 'completed',
                    metadata: {
                        funding_request_id: requestId,
                        approved_by: user.id,
                        transaction_reference: accountDetails
                    }
                })
                .select('id')
                .single();

            if (transactionError) {
                console.warn('Failed to create wallet transaction record:', transactionError);
                // Don't fail the approval if transaction record fails, but log it
                // The wallet was already credited, so this is just a record-keeping issue
            } else {
                console.log('Wallet transaction record created:', transactionData.id);
            }
        }

        const finalApprovalResult = {
            success: true,
            message: 'Funding request approved and wallet credited successfully',
            funding_request_id: requestId,
            amount_credited: creditedAmount,
            points_credited: pointsToAdd
        };

        await safeNotifyFundingApproval(
            fundingRequest.user_id,
            creditedAmount,
            accountDetails || `FR-${requestId}`
        );

        return finalApprovalResult;
    } catch (error) {
        console.error("Error approving funding request:", error);
        throw error;
    }
}

// Get all pending withdrawal requests (admin only)
export async function getPendingWithdrawalRequests(limit = 50, offset = 0) {
    try {
        const { data: requests, error } = await supabase
            .from('wallet_withdrawal_requests')
            .select(`
                *,
                profiles!wallet_withdrawal_requests_user_id_fkey (
                    id,
                    email,
                    name
                )
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return requests || [];
    } catch (error) {
        console.error("Error getting pending withdrawal requests:", error);
        throw error;
    }
}

// Approve withdrawal request (admin only)
export async function approveWithdrawalRequest(requestId, bankTransactionId = null) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        // First, get the withdrawal request details
        const { data: withdrawalRequest, error: fetchError } = await supabase
            .from('wallet_withdrawal_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError || !withdrawalRequest) {
            throw new Error('Withdrawal request not found');
        }

        if (withdrawalRequest.status !== 'pending') {
            throw new Error(`Withdrawal request is already ${withdrawalRequest.status}`);
        }

        // Get user's role to determine fee (in case fee wasn't stored in request)
        const { data: userProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', withdrawalRequest.user_id)
            .single();
        
        const userRole = userProfile?.role || 'member';
        
        // Calculate fee: 10% for apprentices, 0% for members
        // If fee wasn't stored, recalculate it based on user role
        let feePoints = withdrawalRequest.withdrawal_fee_points;
        if (feePoints === null || feePoints === undefined) {
            feePoints = userRole === 'apprentice' 
                ? Math.round(withdrawalRequest.amount_points * 0.10 * 100) / 100 
                : 0;
        }
        
        const feeNgn = withdrawalRequest.withdrawal_fee_ngn ?? pointsToNgn(feePoints);
        const pointsToDeduct = withdrawalRequest.total_deduction_points ?? (withdrawalRequest.amount_points + feePoints);
        const ngnToDeduct = withdrawalRequest.total_deduction_ngn ?? (withdrawalRequest.amount_ngn + feeNgn);

        if (!pointsToDeduct || pointsToDeduct <= 0) {
            throw new Error('Withdrawal request has invalid amount. Please verify the request data.');
        }

        // Get user wallet to check balance BEFORE processing
        const wallet = await getUserWallet(withdrawalRequest.user_id);
        if (!wallet) {
            throw new Error('User wallet not found');
        }

        // Check if user has enough balance (including fees)
        if ((wallet.balance_points || 0) < pointsToDeduct) {
            throw new Error(`User does not have sufficient balance. Required: ${pointsToDeduct} points, Available: ${wallet.balance_points || 0} points`);
        }

        // Try to call the RPC function first (if it exists)
        let rpcSucceeded = false;
        let rpcUpdatedStatus = false;
        try {
            const { data, error } = await supabase.rpc('approve_withdrawal_request', {
                request_uuid: requestId,
                admin_uuid: user.id,
                bank_transaction_id: bankTransactionId
            });
            if (error && error.code !== '42883') { // 42883 = function does not exist
                throw error;
            }
            if (data && !error) {
                rpcSucceeded = true;
                // Check if RPC updated the withdrawal request status
                const { data: updatedRequest } = await supabase
                    .from('wallet_withdrawal_requests')
                    .select('status')
                    .eq('id', requestId)
                    .single();
                
                rpcUpdatedStatus = updatedRequest?.status === 'approved';
                
                // Verify that RPC actually deducted points by checking wallet balance
                const updatedWallet = await getUserWallet(withdrawalRequest.user_id);
                if (updatedWallet && (updatedWallet.balance_points || 0) >= (wallet.balance_points || 0)) {
                    // RPC didn't deduct points, we need to do it manually
                    console.warn('RPC approved but did not deduct points, deducting manually...');
                    rpcSucceeded = false;
                } else if (updatedWallet) {
                    console.log(`RPC successfully deducted points: ${(wallet.balance_points || 0) - (updatedWallet.balance_points || 0)} points deducted`);
                }
            }
        } catch (rpcError) {
            // If RPC function doesn't exist or fails, we'll handle it manually
            console.warn('RPC function not available or failed, handling approval manually:', rpcError);
            rpcSucceeded = false;
        }

        // Update withdrawal request status if RPC didn't already update it
        if (!rpcUpdatedStatus) {
            const updateData = {
                status: 'approved',
                processed_at: new Date().toISOString(),
                total_deduction_points: pointsToDeduct,
                total_deduction_ngn: ngnToDeduct,
                withdrawal_fee_points: feePoints,
                withdrawal_fee_ngn: feeNgn
            };
            
            if (bankTransactionId) {
                updateData.admin_notes = bankTransactionId
                    ? `Bank Transaction ID: ${bankTransactionId}`
                    : withdrawalRequest.admin_notes;
            }
            
            const { error: updateError } = await supabase
                .from('wallet_withdrawal_requests')
                .update(updateData)
                .eq('id', requestId)
                .eq('status', 'pending'); // Only update if still pending

            if (updateError) {
                // If update failed because status changed, check if it's already approved
                const { data: currentRequest } = await supabase
                    .from('wallet_withdrawal_requests')
                    .select('status')
                    .eq('id', requestId)
                    .single();
                
                if (currentRequest?.status !== 'approved') {
                    throw new Error('Failed to update withdrawal request status: ' + updateError.message);
                }
                // If already approved, continue to deduct points
            }
        }

        // Always verify and deduct points (RPC might have updated status but not deducted)
        // Check if transaction already exists to prevent double-deduction
        const { data: existingTransaction, error: checkError } = await supabase
            .from('wallet_transactions')
            .select('id')
            .eq('user_id', withdrawalRequest.user_id)
            .eq('transaction_type', 'withdrawal')
            .eq('reference', bankTransactionId || `WR-${requestId}`)
            .single();

        // Only deduct if no transaction record exists (prevents double-deduction)
        if (!existingTransaction || checkError?.code === 'PGRST116') {
            console.log(`[Withdrawal Approval] Deducting ${pointsToDeduct} points for withdrawal request ${requestId}`);
            
            // Get fresh wallet balance
            const currentWallet = await getUserWallet(withdrawalRequest.user_id);
            if (!currentWallet) {
                throw new Error('User wallet not found');
            }

            console.log(`[Withdrawal Approval] Current balance before deduction: NGN=${currentWallet.balance_ngn || 0}, Points=${currentWallet.balance_points || 0}`);
            console.log(`[Withdrawal Approval] Deducting: NGN=${ngnToDeduct}, Points=${pointsToDeduct}`);

            // Verify user still has sufficient balance
            if ((currentWallet.balance_points || 0) < pointsToDeduct) {
                throw new Error(`User balance insufficient. Required: ${pointsToDeduct} points, Available: ${currentWallet.balance_points || 0} points`);
            }

            // Deduct points from wallet using atomic update function
            const balanceChanges = {
                balance_ngn: -ngnToDeduct,
                balance_points: -pointsToDeduct,
                total_withdrawn: ngnToDeduct
            };

            const updatedWallet = await updateWalletBalanceAtomically(withdrawalRequest.user_id, balanceChanges);

            // Create wallet transaction record (without metadata column if it doesn't exist)
            const transactionData = {
                user_id: withdrawalRequest.user_id,
                transaction_type: 'withdrawal',
                amount_ngn: -ngnToDeduct,
                amount_points: -pointsToDeduct,
                description: `Withdrawal approved - Request ID: ${requestId}`,
                reference: bankTransactionId || `WR-${requestId}`,
                status: 'completed'
            };

            const { error: transactionError } = await supabase
                .from('wallet_transactions')
                .insert(transactionData);

            if (transactionError) {
                console.error('[Withdrawal Approval] Transaction creation error:', transactionError);
                // Don't fail the approval if transaction record fails - wallet was already updated
                console.warn('[Withdrawal Approval] Failed to create wallet transaction record. Wallet was updated but transaction record missing.');
            } else {
                console.log(`[Withdrawal Approval] Transaction record created successfully`);
            }
        } else {
            console.log('Points already deducted (transaction record exists), skipping deduction step');
        }

        // Send notification (non-blocking - don't fail approval if notification fails)
        try {
            await notifyWithdrawalRequestApproved(
                withdrawalRequest.user_id,
                pointsToDeduct,
                bankTransactionId || "N/A"
            );
        } catch (notificationError) {
            console.warn("Failed to send withdrawal approval notification:", notificationError);
            // Continue execution - notification failure shouldn't block the approval
        }

        return {
            success: true,
            message: 'Withdrawal request approved successfully',
            withdrawal_request_id: requestId
        };
    } catch (error) {
        console.error("Error approving withdrawal request:", error);
        throw error;
    }
}

// Reject funding request (admin only)
export async function rejectFundingRequest(requestId, reason) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        // First, get the funding request details
        const { data: fundingRequest, error: fetchError } = await supabase
            .from('funding_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError || !fundingRequest) {
            throw new Error('Funding request not found');
        }

        if (fundingRequest.status !== 'pending') {
            throw new Error(`Funding request is already ${fundingRequest.status}`);
        }

        // Try to call the RPC function first (if it exists)
        let rpcSucceeded = false;
        try {
            const { data, error } = await supabase.rpc('reject_funding_request', {
                request_uuid: requestId,
                admin_uuid: user.id,
                reason: reason
            });
            if (error && error.code !== '42883') { // 42883 = function does not exist
                throw error;
            }
            if (data && !error) {
                rpcSucceeded = true;
            }
        } catch (rpcError) {
            // If RPC function doesn't exist or fails, we'll handle it manually
            console.warn('RPC function not available or failed, handling rejection manually:', rpcError);
            rpcSucceeded = false;
        }

        // If RPC didn't handle it, do it manually
        if (!rpcSucceeded) {
            // Double-check the request is still pending before processing
            const { data: currentRequest, error: currentRequestError } = await supabase
                .from('funding_requests')
                .select('status')
                .eq('id', requestId)
                .single();
            
            if (currentRequestError) {
                console.error('Error checking current request status:', currentRequestError);
                // Check if request doesn't exist
                if (currentRequestError.code === 'PGRST116') {
                    throw new Error('Funding request not found. It may have been deleted.');
                }
                throw new Error('Failed to verify funding request status: ' + currentRequestError.message);
            }
            
            if (!currentRequest) {
                throw new Error('Funding request not found. It may have been deleted.');
            }
            
            if (currentRequest.status !== 'pending') {
                throw new Error(`Funding request is already ${currentRequest.status} and cannot be rejected`);
            }
            
            // Update funding request status to rejected
            const updateData = {
                status: 'rejected',
                admin_notes: reason,
                processed_at: new Date().toISOString()
            };

            // Update without .single() first to check if any rows were affected
            const { data: updatedRequests, error: updateError } = await supabase
                .from('funding_requests')
                .update(updateData)
                .eq('id', requestId)
                .eq('status', 'pending') // Only update if still pending (prevents race conditions)
                .select('status');

            if (updateError) {
                console.error('Failed to update funding request status:', updateError);
                throw new Error('Failed to update funding request status: ' + updateError.message);
            }

            // Check if any rows were updated
            if (!updatedRequests || updatedRequests.length === 0) {
                // No rows were updated, meaning the status was already changed
                // Check current status
                const { data: checkRequest, error: checkError } = await supabase
                    .from('funding_requests')
                    .select('status')
                    .eq('id', requestId)
                    .single();
                
                if (checkError) {
                    // Check if request doesn't exist
                    if (checkError.code === 'PGRST116') {
                        throw new Error('Funding request not found. It may have been deleted.');
                    }
                    throw new Error('Failed to verify funding request status: ' + checkError.message);
                }
                
                if (!checkRequest) {
                    throw new Error('Funding request not found. It may have been deleted.');
                }
                
                if (checkRequest.status !== 'pending') {
                    throw new Error(`Funding request is already ${checkRequest.status} and cannot be rejected`);
                } else {
                    // Still pending but update failed - might be a database issue
                    throw new Error('Funding request could not be updated. Please refresh the page and try again.');
                }
            }

            // Verify the update actually worked
            const updatedRequest = updatedRequests[0];
            if (!updatedRequest || updatedRequest.status !== 'rejected') {
                console.error('Status update verification failed:', updatedRequest);
                throw new Error('Status update verification failed - request may not have been updated to rejected');
            }

            console.log('Funding request status updated to rejected:', requestId);
        }

        // Send notification (non-blocking - don't fail rejection if notification fails)
        try {
            await notifyFundingRequestRejected(fundingRequest.user_id, fundingRequest.amount_ngn, reason);
        } catch (notificationError) {
            console.warn("Failed to send funding rejection notification:", notificationError);
            // Continue execution - notification failure shouldn't block the rejection
        }

        return {
            success: true,
            message: 'Funding request rejected successfully',
            funding_request_id: requestId
        };
    } catch (error) {
        console.error("Error rejecting funding request:", error);
        throw error;
    }
}

// Reject withdrawal request (admin only)
export async function rejectWithdrawalRequest(requestId, reason) {
    try {
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        if (!reason || !reason.trim()) {
            throw new Error("A rejection reason is required");
        }

        const { data: withdrawalRequest, error: fetchError } = await supabase
            .from("wallet_withdrawal_requests")
            .select("id, user_id, amount_points, status")
            .eq("id", requestId)
            .single();

        if (fetchError || !withdrawalRequest) {
            throw new Error("Withdrawal request not found");
        }

        if (withdrawalRequest.status !== "pending") {
            throw new Error(
                `Withdrawal request is already ${withdrawalRequest.status}`
            );
        }

        let rpcHandled = false;
        let rpcResult = null;

        try {
            const { data, error } = await supabase.rpc(
                "reject_withdrawal_request",
                {
                    request_uuid: requestId,
                    admin_uuid: user.id,
                    reason,
                }
            );

            if (error) {
                if (error.code !== "42883") {
                    throw error;
                }
                console.warn(
                    "reject_withdrawal_request RPC not available, falling back to manual update."
                );
            } else {
                rpcHandled = true;
                rpcResult = data;
            }
        } catch (rpcError) {
            if (!rpcError?.code || rpcError.code !== "42883") {
                throw rpcError;
            }
            console.warn(
                "reject_withdrawal_request RPC threw an error, falling back to manual update:",
                rpcError
            );
        }

        if (!rpcHandled) {
            const { data: updatedRequests, error: updateError } = await supabase
                .from("wallet_withdrawal_requests")
                .update({
                    status: "rejected",
                    admin_notes: reason,
                    processed_at: new Date().toISOString(),
                })
                .eq("id", requestId)
                .eq("status", "pending")
                .select("status");

            if (updateError) {
                throw new Error(
                    "Failed to update withdrawal request status: " +
                        updateError.message
                );
            }

            if (!updatedRequests || !updatedRequests.length) {
                throw new Error(
                    "Withdrawal request could not be updated. It may have been processed already."
                );
            }
        }

        await safeNotifyWithdrawalRejection(
            withdrawalRequest.user_id,
            withdrawalRequest.amount_points,
            reason
        );

        if (rpcResult) {
            return rpcResult;
        }

        return {
            success: true,
            message: "Withdrawal request rejected successfully",
            withdrawal_request_id: requestId,
        };
    } catch (error) {
        console.error("Error rejecting withdrawal request:", error);
        throw error;
    }
}

// Release escrow funds (admin only)
export async function releaseEscrowFunds(escrowId) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        const { data, error } = await supabase.rpc('release_escrow_funds', {
            escrow_uuid: escrowId,
            admin_uuid: user.id
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error releasing escrow funds:", error);
        throw error;
    }
}

// Refund escrow funds (admin only)
export async function refundEscrowFunds(escrowId, reason = null) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        const { data, error } = await supabase.rpc('refund_escrow_funds', {
            escrow_uuid: escrowId,
            admin_uuid: user.id,
            reason: reason
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error refunding escrow funds:", error);
        throw error;
    }
}

// Get all escrow transactions (admin only)
export async function getAllEscrowTransactions(limit = 50, offset = 0) {
    try {
        const { data: escrows, error } = await supabase
            .from('job_escrow')
            .select(`
                *,
                job_requests (
                    id,
                    title,
                    description
                ),
                member:profiles!job_escrow_member_id_fkey (
                    id,
                    email,
                    name
                ),
                apprentice:profiles!job_escrow_apprentice_id_fkey (
                    id,
                    email,
                    name
                )
            `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return escrows;
    } catch (error) {
        console.error("Error getting all escrow transactions:", error);
        throw error;
    }
}

// ==============================================
// FILE UPLOAD FUNCTIONS
// ==============================================

// Upload proof of payment file to Supabase storage
export async function uploadProofOfPayment(file) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        if (!file) {
            throw new Error('No file received. Please select a proof of payment file and try again.');
        }

        // Validate file type and size
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        const fileType = file.type || '';
        if (fileType && !allowedTypes.includes(fileType)) {
            throw new Error('Invalid file type. Please upload JPG, PNG, GIF, or PDF files only.');
        }

        if (file.size > maxSize) {
            throw new Error('File size too large. Please upload files smaller than 5MB.');
        }

        // Generate unique filename
        const fileExt = (file.name && file.name.includes('.'))
            ? file.name.split('.').pop()
            : 'bin';
        const fileName = `proof-of-payment-${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        // Upload file to Supabase storage
        const { error } = await supabase.storage
            .from('payment-proofs')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            const message = (error.message || '').toLowerCase();

            if (message.includes('bucket') && message.includes('not found')) {
                throw new Error(
                    "Payment proofs storage bucket is not configured. " +
                    "Please contact an administrator to set up the storage bucket. " +
                    "See PAYMENT_PROOFS_STORAGE_SETUP.md for setup instructions."
                );
            }

            if (message.includes('row-level security')) {
                throw new Error(
                    "Storage bucket policies are not configured correctly. " +
                    "Please contact an administrator. See PAYMENT_PROOFS_STORAGE_SETUP.md for setup instructions."
                );
            }

            if (message.includes('resource already exists')) {
                throw new Error("A file with this name already exists. Please try again.");
            }

            if (error.status === 400 && message.includes('invalid type')) {
                throw new Error('The selected file could not be processed. Please re-upload or choose a different file.');
            }

            throw error;
        }

        // For private buckets, we store the file path instead of a public URL
        // Signed URLs will be generated on-demand when viewing the file
        // Return the file path as a storage reference (format: payment-proofs/{filePath})
        return `payment-proofs/${filePath}`;
    } catch (error) {
        console.error("Error uploading proof of payment:", error);
        // Re-throw with original error message if it's already a user-friendly message
        if (error.message && (
            error.message.includes("not configured") ||
            error.message.includes("contact") ||
            error.message.includes("Invalid file type") ||
            error.message.includes("File size too large") ||
            error.message.includes("No file received") ||
            error.message.includes("name already exists") ||
            error.message.includes("selected file could not be processed")
        )) {
            throw error;
        }
        // Otherwise, provide a generic error message
        throw new Error("Failed to upload payment proof. Please try again or contact support.");
    }
}

// Upload CV file to Supabase storage
export async function uploadCV(file) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        if (!file) {
            throw new Error('No file received. Please select a CV file and try again.');
        }

        // Validate file type and size (allow PDF and common document formats)
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ];
        const maxSize = 10 * 1024 * 1024; // 10MB for CVs

        const fileType = file.type || '';
        if (fileType && !allowedTypes.includes(fileType)) {
            throw new Error('Invalid file type. Please upload PDF, DOC, DOCX, or TXT files only.');
        }

        if (file.size > maxSize) {
            throw new Error('File size too large. Please upload files smaller than 10MB.');
        }

        // Generate unique filename
        const fileExt = (file.name && file.name.includes('.'))
            ? file.name.split('.').pop()
            : 'pdf';
        const fileName = `cv-${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        // Upload file to Supabase storage
        const { error } = await supabase.storage
            .from('cvs')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            const message = (error.message || '').toLowerCase();

            if (message.includes('bucket') && message.includes('not found')) {
                throw new Error(
                    "CV storage bucket is not configured. " +
                    "Please contact an administrator to set up the storage bucket."
                );
            }

            if (message.includes('row-level security')) {
                throw new Error(
                    "Storage bucket policies are not configured correctly. " +
                    "Please contact an administrator."
                );
            }

            if (message.includes('resource already exists')) {
                throw new Error("A file with this name already exists. Please try again.");
            }

            if (error.status === 400 && message.includes('invalid type')) {
                throw new Error('The selected file could not be processed. Please re-upload or choose a different file.');
            }

            throw error;
        }

        // Return the file path as a storage reference (format: cvs/{filePath})
        return `cvs/${filePath}`;
    } catch (error) {
        console.error("Error uploading CV:", error);
        // Re-throw with original error message if it's already a user-friendly message
        if (error.message && (
            error.message.includes("not configured") ||
            error.message.includes("contact") ||
            error.message.includes("Invalid file type") ||
            error.message.includes("File size too large") ||
            error.message.includes("No file received") ||
            error.message.includes("name already exists") ||
            error.message.includes("selected file could not be processed")
        )) {
            throw error;
        }
        // Otherwise, provide a generic error message
        throw new Error("Failed to upload CV. Please try again or contact support.");
    }
}

// ==============================================
// URL HELPER FUNCTIONS
// ==============================================

/**
 * Get a signed URL for a CV file
 * This function handles both old format (full URLs) and new format (storage paths)
 * @param {string} cvReference - Either a full URL or a storage path (format: cvs/{userId}/{filename})
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} Signed URL that can be used to view/download the CV
 */
export async function getCVSignedUrl(cvReference, expiresIn = 3600) {
    try {
        // If it's already a full URL (old format or external URL), return as-is
        if (cvReference && (cvReference.startsWith('http://') || cvReference.startsWith('https://'))) {
            return cvReference;
        }

        // If it's a storage path (new format: cvs/{userId}/{filename})
        if (cvReference && cvReference.startsWith('cvs/')) {
            const filePath = cvReference.replace('cvs/', '');
            const { data, error } = await supabase.storage
                .from('cvs')
                .createSignedUrl(filePath, expiresIn);

            if (error) {
                console.error('Error creating signed URL for CV:', error);
                throw new Error('Failed to generate CV access URL. Please contact support.');
            }

            return data.signedUrl;
        }

        // If it's just a file path without the bucket prefix, try to use it directly
        if (cvReference) {
            const { data, error } = await supabase.storage
                .from('cvs')
                .createSignedUrl(cvReference, expiresIn);

            if (error) {
                console.error('Error creating signed URL for CV:', error);
                throw new Error('Failed to generate CV access URL. Please contact support.');
            }

            return data.signedUrl;
        }

        throw new Error('Invalid CV reference provided');
    } catch (error) {
        console.error('Error getting CV signed URL:', error);
        throw error;
    }
}

/**
 * Get a signed URL for a payment proof file
 * This function handles both old format (full URLs) and new format (storage paths)
 * @param {string} proofReference - Either a full URL or a storage path (format: payment-proofs/{userId}/{filename})
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} Signed URL that can be used to view the file
 */
export async function getPaymentProofSignedUrl(proofReference, expiresIn = 3600) {
    try {
        // If it's already a full URL (old format or external URL), return as-is
        if (proofReference && (proofReference.startsWith('http://') || proofReference.startsWith('https://'))) {
            return proofReference;
        }

        // If it's a storage path (new format: payment-proofs/{userId}/{filename})
        if (proofReference && proofReference.startsWith('payment-proofs/')) {
            const filePath = proofReference.replace('payment-proofs/', '');
            const { data, error } = await supabase.storage
                .from('payment-proofs')
                .createSignedUrl(filePath, expiresIn);

            if (error) {
                console.error('Error creating signed URL:', error);
                throw new Error('Failed to generate file access URL. Please contact support.');
            }

            return data.signedUrl;
        }

        // If it's just a file path without the bucket prefix, try to use it directly
        if (proofReference) {
            const { data, error } = await supabase.storage
                .from('payment-proofs')
                .createSignedUrl(proofReference, expiresIn);

            if (error) {
                console.error('Error creating signed URL:', error);
                throw new Error('Failed to generate file access URL. Please contact support.');
            }

            return data.signedUrl;
        }

        throw new Error('Invalid proof reference provided');
    } catch (error) {
        console.error('Error getting payment proof signed URL:', error);
        throw error;
    }
}

function referencesMissingWithdrawalExtendedColumns(error) {
    const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    return (
        message.includes('withdrawal_fee_ngn') ||
        message.includes('withdrawal_fee_points') ||
        message.includes('total_deduction_points') ||
        message.includes('total_deduction_ngn')
    );
}

let cachedWithdrawalExtendedColumnsAvailable;
async function withdrawalExtendedColumnsAvailable() {
    if (typeof cachedWithdrawalExtendedColumnsAvailable === 'boolean') {
        return cachedWithdrawalExtendedColumnsAvailable;
    }
    try {
        const { error } = await supabase
            .from('wallet_withdrawal_requests')
            .select('withdrawal_fee_ngn,withdrawal_fee_points,total_deduction_points,total_deduction_ngn')
            .limit(1);

        if (error) {
            if (referencesMissingWithdrawalExtendedColumns(error)) {
                cachedWithdrawalExtendedColumnsAvailable = false;
                return false;
            }

            console.warn('Unable to verify withdrawal fee columns due to access error, assuming available.', error);
            cachedWithdrawalExtendedColumnsAvailable = true;
            return true;
        }

        cachedWithdrawalExtendedColumnsAvailable = true;
        return true;
    } catch (error) {
        console.warn('Unable to verify withdrawal fee columns due to unexpected error, assuming available.', error);
        cachedWithdrawalExtendedColumnsAvailable = true;
        return true;
    }
}

function referencesWithdrawalExtendedColumnsNotNull(error) {
    // Check for NOT NULL constraint violation (error code 23502)
    if (error?.code === '23502') {
        const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
        // Check if the error is about any of the extended withdrawal columns
        return (
            message.includes('withdrawal_fee_ngn') ||
            message.includes('withdrawal_fee_points') ||
            message.includes('total_deduction_points') ||
            message.includes('total_deduction_ngn')
        );
    }
    
    // Also check message for null value violations
    const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    return (
        (message.includes('"withdrawal_fee_ngn"') ||
         message.includes('"withdrawal_fee_points"') ||
         message.includes('"total_deduction_points"') ||
         message.includes('"total_deduction_ngn"') ||
         message.includes('withdrawal_fee_ngn') ||
         message.includes('withdrawal_fee_points') ||
         message.includes('total_deduction_points') ||
         message.includes('total_deduction_ngn'))
    ) && message.includes('null value');
}

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

// Convert NGN to points (1 point = ₦150)
export function ngnToPoints(ngnAmount) {
    return ngnAmount / 150;
}

// Convert points to NGN (1 point = ₦150)
export function pointsToNgn(pointsAmount) {
    return pointsAmount * 150;
}

// Format currency for display
export function formatCurrency(amount, currency = 'NGN') {
    const safeAmount = amount ?? 0;
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: currency,
    }).format(safeAmount);
}

// Format points for display
export function formatPoints(points) {
    const safePoints = points ?? 0;
    return `${safePoints.toFixed(2)} pts`;
}

// Validate bank details
export function validateBankDetails(bankDetails) {
    const required = ['bank_name', 'account_number', 'account_name'];
    
    for (const field of required) {
        if (!bankDetails[field] || bankDetails[field].trim() === '') {
            return { valid: false, error: `Missing ${field}` };
        }
    }
    
    // Basic account number validation
    if (bankDetails.account_number.length < 10) {
        return { valid: false, error: 'Account number must be at least 10 digits' };
    }
    
    if (!/^\d+$/.test(bankDetails.account_number)) {
        return { valid: false, error: 'Account number must contain only digits' };
    }
    
    return { valid: true };
}

// Get transaction type display name
export function getTransactionTypeDisplay(type) {
    const types = {
        'deposit': 'Wallet Funding',
        'withdrawal': 'Withdrawal',
        'escrow_hold': 'Escrow Hold',
        'escrow_release': 'Escrow Release',
        'escrow_refund': 'Escrow Refund',
        'job_payment': 'Job Payment',
        'fee_deduction': 'Fee Deduction',
        'subscription_payment': 'Subscription Upgrade'
    };
    
    return types[type] || type;
}

// Get status display name
export function getStatusDisplay(status) {
    const statuses = {
        'pending': 'Pending',
        'approved': 'Approved',
        'verified': 'Verified',
        'credited': 'Credited',
        'rejected': 'Rejected',
        'processing': 'Processing',
        'completed': 'Completed',
        'held': 'Held',
        'released': 'Released',
        'refunded': 'Refunded',
        'disputed': 'Disputed'
    };
    
    return statuses[status] || status;
}

// Get status color class
export function getStatusColor(status) {
    const colors = {
        'pending': 'text-yellow-600',
        'approved': 'text-green-600',
        'verified': 'text-blue-600',
        'credited': 'text-green-600',
        'rejected': 'text-red-600',
        'processing': 'text-blue-600',
        'completed': 'text-green-600',
        'held': 'text-orange-600',
        'released': 'text-green-600',
        'refunded': 'text-red-600',
        'disputed': 'text-red-600'
    };
    
    return colors[status] || 'text-gray-600';
}

// ==============================================
// SUBSCRIPTION PAYMENT FUNCTIONS
// ==============================================

// Create subscription payment request
export async function createSubscriptionPaymentRequest(planKey, amountNgn, paymentMethod) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        // Validate inputs
        if (!planKey) {
            throw new Error("Plan key is required");
        }
        const amount = Number(amountNgn);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error(`Invalid amount: ${amountNgn}`);
        }

        const { data, error } = await supabase.rpc('create_subscription_payment_request', {
            p_user_uuid: user.id,
            p_plan_key: planKey,
            p_amount_ngn: amount,
            p_payment_method: paymentMethod || 'manual'
        });

        if (!error && data) {
            // RPC function exists and succeeded
            // Ensure response has the expected structure
            if (typeof data === 'object' && data !== null) {
                // If data already has success property, return as-is
                if ('success' in data) {
                    return data;
                }
                // Otherwise, wrap it (shouldn't happen with our RPC, but just in case)
                return {
                    success: true,
                    request: data
                };
            }
            // If data is not an object, something went wrong
            console.warn('Unexpected RPC response format:', data);
            throw new Error('Unexpected response format from payment request function');
        }

        if (error && !isRpcFunctionMissing(error)) {
            // RPC function exists but returned an error
            console.error("RPC function error:", {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            throw error;
        }

        // RPC function doesn't exist, use fallback
        console.log("RPC function not found, using fallback method");
        return await createSubscriptionPaymentRequestFallback(user.id, planKey, amount, paymentMethod || 'manual');
    } catch (error) {
        console.error("Error creating subscription payment request:", {
            message: error?.message,
            code: error?.code,
            details: error?.details,
            hint: error?.hint,
            stack: error?.stack
        });
        throw error;
    }
}

// Update subscription payment details
export async function updateSubscriptionPaymentDetails(accountDetails, proofOfPaymentUrl) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        const { data, error } = await supabase.rpc('update_subscription_payment_details', {
            p_user_uuid: user.id,
            p_account_details: accountDetails,
            p_proof_of_payment_url: proofOfPaymentUrl
        });

        if (!error && data) {
            return data;
        }

        if (error && !isRpcFunctionMissing(error)) {
            throw error;
        }

        return await updateSubscriptionPaymentDetailsFallback(user.id, accountDetails, proofOfPaymentUrl);
    } catch (error) {
        console.error("Error updating subscription payment details:", error);
        throw error;
    }
}

// Process subscription payment (wallet)
export async function processSubscriptionPayment(planKey, amountNgn, paymentMethod) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        const { data, error } = await supabase.rpc('process_subscription_payment', {
            p_user_uuid: user.id,
            p_plan_key: planKey,
            p_amount_ngn: amountNgn,
            p_payment_method: paymentMethod
        });

        if (!error && data) {
            return data;
        }

        if (error && !isRpcFunctionMissing(error)) {
            throw error;
        }

        return await processSubscriptionPaymentFallback(user, planKey, amountNgn, paymentMethod);
    } catch (error) {
        console.error("Error processing subscription payment:", error);
        throw error;
    }
}

async function createSubscriptionPaymentRequestFallback(userId, planKey, amountNgn, paymentMethod) {
    try {
        const amount = Number(amountNgn);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error(`Invalid subscription amount specified: ${amountNgn}`);
        }
        
        if (!userId) {
            throw new Error("User ID is required");
        }
        
        if (!planKey) {
            throw new Error("Plan key is required");
        }

        const reference = generateSubscriptionReference(planKey);
        const requestPayload = {
            user_id: userId,
            plan_key: planKey.toLowerCase(),
            amount_ngn: amount,
            payment_method: (paymentMethod || 'manual').toLowerCase(),
            status: 'pending',
            transaction_reference: reference
        };

        console.log('Creating subscription payment request (fallback):', {
            userId,
            planKey: requestPayload.plan_key,
            amount: requestPayload.amount_ngn,
            paymentMethod: requestPayload.payment_method
        });

        const { data, error } = await supabase
            .from('subscription_payment_requests')
            .insert(requestPayload)
            .select('*')
            .single();

        if (error) {
            console.error('Fallback subscription request insert failed:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });
            throw new Error(error.message || 'Failed to create subscription payment request.');
        }

        if (!data) {
            throw new Error('No data returned from subscription payment request insert');
        }

        return {
            success: true,
            request: data
        };
    } catch (error) {
        console.error('Error in createSubscriptionPaymentRequestFallback:', {
            message: error?.message,
            code: error?.code,
            details: error?.details,
            stack: error?.stack
        });
        throw error;
    }
}

async function updateSubscriptionPaymentDetailsFallback(userId, accountDetails, proofOfPaymentUrl) {
    const trimmedDetails = accountDetails?.trim();
    if (!trimmedDetails) {
        throw new Error("Account details are required.");
    }

    if (!proofOfPaymentUrl) {
        throw new Error("Proof of payment is required.");
    }

    const { data: request, error: requestError } = await supabase
        .from('subscription_payment_requests')
        .select('id, status')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (requestError) {
        if (requestError.code === 'PGRST116') {
            throw new Error("No pending subscription payment request found. Please create a new request first.");
        }
        console.error('Fallback subscription request lookup failed:', requestError);
        throw new Error(requestError.message || 'Failed to find subscription payment request.');
    }

    const { data, error } = await supabase
        .from('subscription_payment_requests')
        .update({
            account_details: trimmedDetails,
            proof_of_payment_url: proofOfPaymentUrl
        })
        .eq('id', request.id)
        .select('id')
        .single();

    if (error) {
        console.error('Fallback subscription request update failed:', error);
        throw new Error(error.message || 'Failed to update subscription payment request.');
    }

    return {
        success: true,
        request_id: data.id
    };
}

async function processSubscriptionPaymentFallback(user, planKey, amountNgn, paymentMethod) {
    const amount = Number(amountNgn);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invalid subscription amount specified.");
    }

    const wallet = await getUserWallet(user.id);
    const currentBalance = Number(wallet?.balance_ngn || 0);

    if (currentBalance < amount) {
        throw new Error(
            `Insufficient wallet balance. You need ₦${amount.toLocaleString()} but have ₦${currentBalance.toLocaleString()}.`
        );
    }

    const reference = generateSubscriptionReference(planKey);
    const newBalance = currentBalance - amount;
    const totalWithdrawn = Number(wallet?.total_withdrawn || 0) + amount;

    const { error: walletError } = await updateWalletBalanceForSubscription(user.id, newBalance, totalWithdrawn);
    if (walletError) {
        console.error("Fallback wallet update failed:", walletError);
        throw new Error(walletError.message || "Failed to deduct wallet balance.");
    }

    await logSubscriptionWalletTransaction(user.id, amount, planKey, paymentMethod, reference);

    const { error: profileError } = await supabase
        .from('profiles')
        .update({
            subscription_plan: planKey,
            updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

    if (profileError) {
        console.error("Fallback profile update failed:", profileError);
        throw new Error(profileError.message || "Failed to update subscription plan.");
    }

    await recordApprovedSubscriptionRequest(user.id, planKey, amount, paymentMethod, reference);

    return {
        success: true,
        reference,
        plan_key: planKey,
        payment_method: paymentMethod,
        amount_ngn: amount
    };
}

async function updateWalletBalanceForSubscription(userId, newBalance, totalWithdrawn) {
    return await supabase
        .from('user_wallets')
        .update({
            balance_ngn: newBalance,
            total_withdrawn: totalWithdrawn,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select('id')
        .single();
}

async function logSubscriptionWalletTransaction(userId, amount, planKey, paymentMethod, reference) {
    try {
        await supabase
            .from('wallet_transactions')
            .insert({
                user_id: userId,
                transaction_type: 'subscription_payment',
                amount_ngn: amount,
                amount_points: 0,
                description: `Subscription upgrade to ${planKey}`,
                reference,
                status: 'completed',
                metadata: {
                    plan_key: planKey,
                    payment_method: paymentMethod
                }
            });
    } catch (error) {
        console.warn('Failed to create subscription wallet transaction record:', error);
    }
}

async function recordApprovedSubscriptionRequest(userId, planKey, amount, paymentMethod, reference) {
    try {
        await supabase
            .from('subscription_payment_requests')
            .insert({
                user_id: userId,
                plan_key: planKey,
                amount_ngn: amount,
                payment_method: paymentMethod,
                status: 'approved',
                processed_at: new Date().toISOString(),
                transaction_reference: reference
            });
    } catch (error) {
        console.warn('Failed to record subscription payment request:', error);
    }
}
// Get user's subscription payment history
export async function getUserSubscriptionPayments(userId, limit = 20, offset = 0) {
    try {
        const { data: payments, error } = await supabase.rpc('get_user_subscription_payments', {
            user_uuid: userId
        });

        if (error) throw error;
        return payments;
    } catch (error) {
        console.error("Error getting user subscription payments:", error);
        throw error;
    }
}

// Get pending subscription payment requests (admin only)
export async function getPendingSubscriptionPayments(limit = 50, offset = 0) {
    try {
        // Try RPC function first (for admin access, bypasses RLS)
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_subscription_payment_requests', {
                p_limit: limit,
                p_offset: offset
            });
            
            if (!rpcError && rpcData) {
                // Filter to pending only for this function
                const pendingPayments = rpcData.filter(p => p.status === 'pending');
                return pendingPayments.map(payment => ({
                    id: payment.id,
                    user_id: payment.user_id,
                    user_name: payment.user_name,
                    user_email: payment.user_email,
                    plan_key: payment.plan_key,
                    amount_ngn: payment.amount_ngn,
                    payment_method: payment.payment_method,
                    account_details: payment.account_details,
                    proof_of_payment_url: payment.proof_of_payment_url,
                    transaction_reference: payment.transaction_reference,
                    admin_notes: payment.admin_notes,
                    processed_at: payment.processed_at,
                    status: payment.status,
                    created_at: payment.created_at
                }));
            }
        } catch (rpcErr) {
            // RPC function doesn't exist or failed, fall back to direct query
            console.warn('RPC function not available, using direct query:', rpcErr);
        }
        
        // Fallback to direct query
        const { data: requests, error } = await supabase
            .from('subscription_payment_requests')
            .select(`
                *,
                profiles!subscription_payment_requests_user_id_fkey (
                    id,
                    email,
                    name
                )
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        
        // Map the data to match the expected format (similar to admin dashboard fallback)
        return (requests || []).map(payment => ({
            id: payment.id,
            user_id: payment.user_id,
            user_name: payment.profiles?.name,
            user_email: payment.profiles?.email,
            plan_key: payment.plan_key,
            amount_ngn: payment.amount_ngn,
            payment_method: payment.payment_method,
            account_details: payment.account_details,
            proof_of_payment_url: payment.proof_of_payment_url,
            transaction_reference: payment.transaction_reference,
            admin_notes: payment.admin_notes,
            processed_at: payment.processed_at,
            status: payment.status,
            created_at: payment.created_at
        }));
    } catch (error) {
        console.error("Error getting pending subscription payments:", error);
        throw error;
    }
}

// Get all subscription payment requests (admin only, all statuses)
export async function getAllSubscriptionPaymentRequests(limit = 100, offset = 0) {
    try {
        // Try RPC function first (for admin access, bypasses RLS)
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_subscription_payment_requests', {
                p_limit: limit,
                p_offset: offset
            });
            
            if (!rpcError && rpcData) {
                return rpcData.map(payment => ({
                    id: payment.id,
                    user_id: payment.user_id,
                    user_name: payment.user_name,
                    user_email: payment.user_email,
                    plan_key: payment.plan_key,
                    amount_ngn: payment.amount_ngn,
                    payment_method: payment.payment_method,
                    account_details: payment.account_details,
                    proof_of_payment_url: payment.proof_of_payment_url,
                    transaction_reference: payment.transaction_reference,
                    admin_notes: payment.admin_notes,
                    processed_at: payment.processed_at,
                    status: payment.status,
                    created_at: payment.created_at
                }));
            }
        } catch (rpcErr) {
            // RPC function doesn't exist or failed, fall back to direct query
            console.warn('RPC function not available, using direct query:', rpcErr);
        }
        
        // Fallback to direct query
        const { data: requests, error } = await supabase
            .from('subscription_payment_requests')
            .select(`
                *,
                profiles!subscription_payment_requests_user_id_fkey (
                    id,
                    email,
                    name
                )
            `)
            .in('status', ['pending', 'approved', 'rejected', 'completed'])
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        
        return (requests || []).map(payment => ({
            id: payment.id,
            user_id: payment.user_id,
            user_name: payment.profiles?.name,
            user_email: payment.profiles?.email,
            plan_key: payment.plan_key,
            amount_ngn: payment.amount_ngn,
            payment_method: payment.payment_method,
            account_details: payment.account_details,
            proof_of_payment_url: payment.proof_of_payment_url,
            transaction_reference: payment.transaction_reference,
            admin_notes: payment.admin_notes,
            processed_at: payment.processed_at,
            status: payment.status,
            created_at: payment.created_at
        }));
    } catch (error) {
        console.error("Error getting all subscription payment requests:", error);
        throw error;
    }
}

// Approve subscription payment (admin only)
export async function approveSubscriptionPayment(requestId, adminNotes = null) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        // First, get the subscription payment request details
        const { data: paymentRequest, error: fetchError } = await supabase
            .from('subscription_payment_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError || !paymentRequest) {
            throw new Error('Subscription payment request not found');
        }

        if (paymentRequest.status !== 'pending') {
            throw new Error(`Subscription payment request is already ${paymentRequest.status}`);
        }

        // Try to call the RPC function first (if it exists)
        let rpcSucceeded = false;
        try {
            const { data, error } = await supabase.rpc('approve_subscription_payment', {
                p_request_uuid: requestId,
                p_admin_uuid: user.id,
                p_admin_notes: adminNotes
            });
            if (error) {
                if (error.code === '42883') {
                    // Function does not exist, fall back to manual
                    console.warn('RPC function approve_subscription_payment does not exist, using manual approval');
                    rpcSucceeded = false;
                } else {
                    // Other error from RPC
                    console.error('RPC function error:', error);
                    throw new Error(`Failed to approve subscription payment: ${error.message || JSON.stringify(error)}`);
                }
            } else if (data) {
                rpcSucceeded = true;
                console.log('Subscription payment approved via RPC:', data);
                return {
                    success: true,
                    ...data
                };
            }
        } catch (rpcError) {
            // If RPC function doesn't exist or fails, we'll handle it manually
            if (rpcError.code === '42883' || rpcError.message?.includes('does not exist')) {
                console.warn('RPC function not available, handling approval manually');
                rpcSucceeded = false;
            } else {
                // Re-throw other errors
                throw rpcError;
            }
        }

        // If RPC didn't handle it, do it manually
        if (!rpcSucceeded) {
            // Double-check the request is still pending before processing
            const { data: currentRequest, error: currentRequestError } = await supabase
                .from('subscription_payment_requests')
                .select('status')
                .eq('id', requestId)
                .single();

            if (currentRequestError || !currentRequest) {
                throw new Error('Subscription payment request not found');
            }

            if (currentRequest.status !== 'pending') {
                throw new Error(`Subscription payment request is already ${currentRequest.status}`);
            }

            // Update the subscription payment request status
            console.log('Updating subscription payment request status to approved...', {
                requestId,
                currentStatus: currentRequest.status
            });
            
            const { data: updatedRequest, error: updateError } = await supabase
                .from('subscription_payment_requests')
                .update({
                    status: 'approved',
                    admin_notes: adminNotes,
                    processed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId)
                .eq('status', 'pending') // Only allow updating from pending status
                .select()
                .single();

            if (updateError) {
                console.error('Failed to update subscription payment request:', updateError);
                throw new Error(`Failed to approve subscription payment request: ${updateError.message || JSON.stringify(updateError)}`);
            }

            if (!updatedRequest) {
                console.error('Update returned no rows - request may have been processed already or RLS blocked the update');
                throw new Error('Failed to approve subscription payment request: Update returned no rows. The request may have been processed already or you may not have permission.');
            }

            console.log('Subscription payment request updated successfully:', updatedRequest);

            // Update the user's subscription plan
            console.log('Updating user subscription plan...', {
                userId: paymentRequest.user_id,
                planKey: paymentRequest.plan_key
            });
            
            const { data: updatedProfile, error: profileError } = await supabase
                .from('profiles')
                .update({
                    subscription_plan: paymentRequest.plan_key,
                    updated_at: new Date().toISOString()
                })
                .eq('id', paymentRequest.user_id)
                .select('id, subscription_plan')
                .single();

            if (profileError) {
                console.error('Failed to update user subscription plan:', profileError);
                // Don't throw - the payment request was approved, plan update is secondary
                // But log it as a warning
                console.warn('WARNING: Payment request was approved but user plan was not updated. Manual intervention may be required.');
            } else if (updatedProfile) {
                console.log('User subscription plan updated successfully:', updatedProfile);
            } else {
                console.warn('Profile update returned no rows - user may not exist or RLS blocked the update');
            }

            return {
                success: true,
                request: updatedRequest,
                plan_key: paymentRequest.plan_key,
                profile_updated: !!updatedProfile
            };
        }
    } catch (error) {
        console.error("Error approving subscription payment:", error);
        throw error;
    }
}

// Reject subscription payment (admin only)
export async function rejectSubscriptionPayment(requestId, reason) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        // First, get the subscription payment request details
        const { data: paymentRequest, error: fetchError } = await supabase
            .from('subscription_payment_requests')
            .select('*')
            .eq('id', requestId)
            .single();

        if (fetchError || !paymentRequest) {
            throw new Error('Subscription payment request not found');
        }

        if (paymentRequest.status !== 'pending') {
            throw new Error(`Subscription payment request is already ${paymentRequest.status}`);
        }

        // Try to call the RPC function first (if it exists)
        let rpcSucceeded = false;
        try {
            const { data, error } = await supabase.rpc('reject_subscription_payment', {
                p_request_uuid: requestId,
                p_admin_uuid: user.id,
                p_reason: reason
            });
            if (error && error.code !== '42883') { // 42883 = function does not exist
                throw error;
            }
            if (data && !error) {
                rpcSucceeded = true;
                return data;
            }
        } catch (rpcError) {
            // If RPC function doesn't exist or fails, we'll handle it manually
            console.warn('RPC function not available or failed, handling rejection manually:', rpcError);
            rpcSucceeded = false;
        }

        // If RPC didn't handle it, do it manually
        if (!rpcSucceeded) {
            // Double-check the request is still pending before processing
            const { data: currentRequest, error: currentRequestError } = await supabase
                .from('subscription_payment_requests')
                .select('status')
                .eq('id', requestId)
                .single();

            if (currentRequestError || !currentRequest) {
                throw new Error('Subscription payment request not found');
            }

            if (currentRequest.status !== 'pending') {
                throw new Error(`Subscription payment request is already ${currentRequest.status}`);
            }

            // Update the subscription payment request status
            const { data: updatedRequest, error: updateError } = await supabase
                .from('subscription_payment_requests')
                .update({
                    status: 'rejected',
                    admin_notes: reason,
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId)
                .eq('status', 'pending') // Only allow updating from pending status
                .select()
                .single();

            if (updateError || !updatedRequest) {
                throw new Error(updateError?.message || 'Failed to reject subscription payment request');
            }

            return {
                success: true,
                request: updatedRequest
            };
        }
    } catch (error) {
        console.error("Error rejecting subscription payment:", error);
        throw error;
    }
}

// Transaction display helper functions
export function getTransactionIcon(type) {
    const colors = {
        'deposit': 'text-green-500',
        'withdrawal': 'text-red-500',
        'escrow_hold': 'text-orange-500',
        'escrow_release': 'text-green-500',
        'escrow_refund': 'text-blue-500',
        'job_payment': 'text-purple-500',
        'fee_deduction': 'text-gray-500'
    };
    return colors[type] || 'text-gray-500';
}

export function getTransactionIconClass(type) {
    const icons = {
        'deposit': 'fa-plus-circle',
        'withdrawal': 'fa-minus-circle',
        'escrow_hold': 'fa-lock',
        'escrow_release': 'fa-unlock',
        'escrow_refund': 'fa-undo',
        'job_payment': 'fa-briefcase',
        'fee_deduction': 'fa-coins'
    };
    return icons[type] || 'fa-circle';
}

export function getAmountClass(type) {
    const classes = {
        'deposit': 'text-green-600',
        'withdrawal': 'text-red-600',
        'escrow_hold': 'text-orange-600',
        'escrow_release': 'text-green-600',
        'escrow_refund': 'text-blue-600',
        'job_payment': 'text-purple-600',
        'fee_deduction': 'text-gray-600'
    };
    return classes[type] || 'text-gray-600';
}

export function getAmountPrefix(type) {
    const prefixes = {
        'deposit': '+',
        'withdrawal': '-',
        'escrow_hold': '-',
        'escrow_release': '+',
        'escrow_refund': '+',
        'job_payment': '+',
        'fee_deduction': '-'
    };
    return prefixes[type] || '';
}
