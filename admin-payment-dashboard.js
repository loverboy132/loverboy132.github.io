// admin-payment-dashboard.js - Simplified Payment Management Dashboard
import { supabase } from "./supabase-auth.js";
import { 
    getPendingFundingRequests, 
    approveFundingRequest, 
    rejectFundingRequest,
    getPendingWithdrawalRequests, 
    approveWithdrawalRequest, 
    rejectWithdrawalRequest,
    getAllEscrowTransactions,
    releaseEscrowFunds,
    refundEscrowFunds,
    getPendingSubscriptionPayments,
    getAllSubscriptionPaymentRequests,
    approveSubscriptionPayment,
    rejectSubscriptionPayment,
    formatCurrency,
    formatPoints,
    getPaymentProofSignedUrl
} from "./manual-payment-system.js";

// Global state
let allPayments = [];
let filteredPayments = [];
let selectedPayments = new Set();
let currentFilters = {
    type: '',
    status: '',
    amountMin: '',
    amountMax: '',
    search: ''
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check authentication first - must pass before continuing
        const authPassed = await checkAuth();
        
        if (!authPassed) {
            // Auth failed, show error message
            showError('Authentication failed. Please login again.');
            return;
        }
        
        console.log('Initializing payment dashboard...');
        showLoading();
        await loadAllPayments();
        await updateStats();
        setupEventListeners();
        console.log('Payment dashboard initialized successfully');
    } catch (error) {
        console.error('Failed to initialize payment dashboard:', error);
        showError('Failed to initialize payment dashboard. Please refresh the page.');
    }
});

// Check authentication and admin role
// Returns true if authenticated and is admin, false otherwise
async function checkAuth() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            console.warn('No authenticated user found');
            // If accessed directly (not in iframe), redirect to login
            if (window.self === window.top) {
                window.location.href = 'login-supabase.html';
            }
            return false;
        }

        // Check if user has admin role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile || profile.role !== 'admin') {
            console.warn('User does not have admin role');
            // If accessed directly (not in iframe), redirect
            if (window.self === window.top) {
                window.location.href = 'dashboard-supabase.html';
            }
            return false;
        }

        // Auth passed
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        // If accessed directly (not in iframe), redirect to login
        if (window.self === window.top) {
            window.location.href = 'login-supabase.html';
        }
        return false;
    }
}

// Load all payment data
async function loadAllPayments() {
    try {
        showLoading();
        console.log('Starting to load all payments...');
        
        // Load all payment types in parallel
        const [fundingRequests, withdrawalRequests, escrowTransactions, subscriptionPayments] = await Promise.all([
            loadFundingRequests(),
            loadWithdrawalRequests(),
            loadEscrowTransactions(),
            loadSubscriptionPayments()
        ]);

        console.log('All payment data loaded:', {
            fundingRequests: fundingRequests.length,
            withdrawalRequests: withdrawalRequests.length,
            escrowTransactions: escrowTransactions.length,
            subscriptionPayments: subscriptionPayments.length
        });

        // Combine all payments into a unified format
        allPayments = [
            ...fundingRequests,
            ...withdrawalRequests,
            ...escrowTransactions,
            ...subscriptionPayments
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        console.log('Total payments combined:', allPayments.length);
        filteredPayments = [...allPayments];
        displayPayments();
        
    } catch (error) {
        console.error('Error loading payments:', error);
        showError(`Failed to load payments: ${error.message}`);
    }
}

// Load funding requests (both pending and approved)
async function loadFundingRequests() {
    try {
        console.log('Loading funding requests...');
        
        // Get both pending and approved requests
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
            .in('status', ['pending', 'approved', 'rejected'])
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (error) {
            console.error('Error loading funding requests:', error);
            // Fallback to pending only
            const pendingRequests = await getPendingFundingRequests(100, 0);
            return pendingRequests.map(request => ({
                id: request.id,
                type: 'funding',
                title: 'Wallet Funding Request',
                user: request.profiles,
                amount: request.amount_ngn,
                amountDisplay: formatCurrency(request.amount_ngn),
                status: request.status,
                created_at: request.created_at,
                bank_reference: request.bank_reference,
                account_details: request.account_details,
                proof_of_payment_url: request.proof_of_payment_url,
                admin_notes: request.admin_notes,
                processed_at: request.processed_at
            }));
        }
        
        console.log('Funding requests loaded:', requests);
        
        if (!requests || requests.length === 0) {
            console.log('No funding requests found');
            return [];
        }
        
        return requests.map(request => ({
            id: request.id,
            type: 'funding',
            title: 'Wallet Funding Request',
            user: request.profiles,
            amount: request.amount_ngn,
            amountDisplay: formatCurrency(request.amount_ngn),
            status: request.status,
            created_at: request.created_at,
            bank_reference: request.bank_reference,
            account_details: request.account_details,
            proof_of_payment_url: request.proof_of_payment_url,
            admin_notes: request.admin_notes,
            processed_at: request.processed_at
        }));
    } catch (error) {
        console.error('Error loading funding requests:', error);
        showError(`Failed to load funding requests: ${error.message}`);
        return [];
    }
}

// Load withdrawal requests (both pending and approved)
async function loadWithdrawalRequests() {
    try {
        console.log('Loading withdrawal requests...');
        
        // Get both pending and approved requests
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
            .in('status', ['pending', 'approved', 'rejected'])
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (error) {
            console.error('Error loading withdrawal requests:', error);
            const errorMsg = error.message || error.details || JSON.stringify(error);
            console.error('Error details:', errorMsg);
            
            // Fallback to pending only
            try {
                const pendingRequests = await getPendingWithdrawalRequests(100, 0);
                return pendingRequests.map(request => ({
                    id: request.id,
                    type: 'withdrawal',
                    title: 'Withdrawal Request',
                    user: request.profiles,
                    amount: request.amount_ngn,
                    amountDisplay: formatCurrency(request.amount_ngn),
                    status: request.status,
                    created_at: request.created_at,
                    bank_details: request.bank_details,
                    points_requested: request.points_requested,
                    withdrawal_fee_points: request.withdrawal_fee_points,
                    proof_of_payment_url: request.proof_of_payment_url,
                    admin_notes: request.admin_notes,
                    processed_at: request.processed_at
                }));
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
                const fallbackMsg = fallbackError.message || fallbackError.details || JSON.stringify(fallbackError);
                throw new Error(`Failed to load withdrawal requests: ${errorMsg}. Fallback also failed: ${fallbackMsg}`);
            }
        }
        
        console.log('Withdrawal requests loaded:', requests);
        
        if (!requests || requests.length === 0) {
            console.log('No withdrawal requests found');
            return [];
        }
        
        return requests.map(request => ({
            id: request.id,
            type: 'withdrawal',
            title: 'Withdrawal Request',
            user: request.profiles,
            amount: request.amount_ngn,
            amountDisplay: formatCurrency(request.amount_ngn),
            status: request.status,
            created_at: request.created_at,
            bank_details: request.bank_details,
            points_requested: request.points_requested,
            withdrawal_fee_points: request.withdrawal_fee_points,
            proof_of_payment_url: request.proof_of_payment_url,
            admin_notes: request.admin_notes,
            processed_at: request.processed_at
        }));
    } catch (error) {
        console.error('Error loading withdrawal requests:', error);
        const errorMsg = error.message || error.details || JSON.stringify(error) || 'Unknown error';
        console.error('Full error object:', error);
        showError(`Failed to load withdrawal requests: ${errorMsg}`);
        return [];
    }
}

// Load escrow transactions
async function loadEscrowTransactions() {
    try {
        console.log('Loading escrow transactions...');
        const escrows = await getAllEscrowTransactions(100, 0);
        console.log('Escrow transactions loaded:', escrows);
        
        if (!escrows || escrows.length === 0) {
            console.log('No escrow transactions found');
            return [];
        }
        
        return escrows.map(escrow => ({
            id: escrow.id,
            type: 'escrow',
            title: 'Escrow Transaction',
            user: escrow.member || escrow.apprentice,
            amount: escrow.amount_ngn,
            amountDisplay: formatCurrency(escrow.amount_ngn),
            status: escrow.status,
            created_at: escrow.created_at,
            job_id: escrow.job_id,
            job_title: escrow.job_requests?.title,
            member: escrow.member,
            apprentice: escrow.apprentice,
            auto_release_date: escrow.auto_release_date,
            released_at: escrow.released_at,
            refunded_at: escrow.refunded_at
        }));
    } catch (error) {
        console.error('Error loading escrow transactions:', error);
        showError(`Failed to load escrow transactions: ${error.message}`);
        return [];
    }
}

// Load subscription payments (pending, approved, and rejected)
async function loadSubscriptionPayments() {
    try {
        console.log('Loading subscription payments...');
        
        // Load all subscription payment requests (pending, approved, rejected, completed) for full visibility
        const { data, error } = await supabase
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
            .limit(100);
        
        if (error) {
            console.error('Direct query failed:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            console.warn('Trying database function fallback...');
            // Fallback to RPC function that bypasses RLS
            try {
                const allPayments = await getAllSubscriptionPaymentRequests(100, 0);
                console.log('Fallback function returned:', allPayments.length, 'payments');
                
                return allPayments.map(payment => ({
                    id: payment.id,
                    type: 'subscription',
                    title: 'Subscription Payment',
                    user: { 
                        name: payment.user_name, 
                        email: payment.user_email 
                    },
                    amount: payment.amount_ngn,
                    amountDisplay: formatCurrency(payment.amount_ngn),
                    status: payment.status,
                    created_at: payment.created_at,
                    plan_key: payment.plan_key,
                    payment_method: payment.payment_method,
                    account_details: payment.account_details,
                    proof_of_payment_url: payment.proof_of_payment_url,
                    admin_notes: payment.admin_notes,
                    processed_at: payment.processed_at
                }));
            } catch (fallbackError) {
                console.error('Fallback function also failed:', fallbackError);
                throw error; // Throw original error
            }
        }
        
        if (!data || data.length === 0) {
            console.log('No subscription payments found in query result');
            return [];
        }
        
        console.log('Raw subscription payments data:', data.length, 'records');
        
        const payments = data.map(payment => ({
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
        
        console.log('Subscription payments loaded:', payments.length, 'payments');
        console.log('Sample payment:', payments[0]);
        
        return payments.map(payment => ({
            id: payment.id,
            type: 'subscription',
            title: 'Subscription Payment',
            user: { 
                name: payment.user_name, 
                email: payment.user_email 
            },
            amount: payment.amount_ngn,
            amountDisplay: formatCurrency(payment.amount_ngn),
            status: payment.status,
            created_at: payment.created_at,
            plan_key: payment.plan_key,
            payment_method: payment.payment_method,
            account_details: payment.account_details,
            proof_of_payment_url: payment.proof_of_payment_url,
            admin_notes: payment.admin_notes,
            processed_at: payment.processed_at
        }));
    } catch (error) {
        console.error('Error loading subscription payments:', error);
        showError(`Failed to load subscription payments: ${error.message}`);
        return [];
    }
}

// Display payments
function displayPayments() {
    const container = document.getElementById('payments-container');
    
    console.log('Displaying payments:', filteredPayments.length);
    
    if (filteredPayments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No Payments Found</h3>
                <p>No payments match your current filters.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredPayments.map(payment => `
        <div class="payment-card ${payment.status}" data-payment-id="${payment.id}" 
             ${payment.proof_of_payment_url ? `onclick="if(event.target.tagName !== 'BUTTON' && event.target.tagName !== 'INPUT') viewProofOfPayment('${payment.id}')" style="cursor: pointer;"` : ''}>
            <div class="payment-header">
                <div class="payment-info">
                    <div class="payment-type ${payment.type}">${payment.type}</div>
                    <div class="payment-title">${payment.title}</div>
                    <div class="payment-user">
                        <i class="fas fa-user"></i> ${payment.user.name || payment.user.email}
                    </div>
                    <div class="payment-amount">${payment.amountDisplay}</div>
                    ${payment.proof_of_payment_url ? `
                        <div style="margin-top: 8px;">
                            <span style="color: #10b981; font-size: 0.85rem;">
                                <i class="fas fa-image"></i> Proof of Payment Available - Click to View
                            </span>
                        </div>
                    ` : `
                        <div style="margin-top: 8px;">
                            <span style="color: #64748b; font-size: 0.85rem;">
                                <i class="fas fa-exclamation-circle"></i> No Proof of Payment Uploaded
                            </span>
                        </div>
                    `}
                </div>
                <div class="payment-status">
                    <span class="status-badge ${payment.status}">${payment.status === 'approved' ? 'Approved' : payment.status === 'rejected' ? 'Rejected' : payment.status}</span>
                </div>
            </div>
            
            <div class="payment-details">
                ${getPaymentDetails(payment)}
            </div>
            
            <div class="payment-actions">
                ${getPaymentActions(payment)}
            </div>
        </div>
    `).join('');

    // Add event listeners for selection
    document.querySelectorAll('.payment-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking on buttons, inputs, or links
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || 
                e.target.tagName === 'A' || e.target.closest('button') || 
                e.target.closest('input') || e.target.closest('a')) {
                return;
            }
            // Only toggle selection if card doesn't have proof of payment (which opens proof viewer)
            const paymentId = card.dataset.paymentId;
            const payment = allPayments.find(p => p.id === paymentId);
            if (!payment || !payment.proof_of_payment_url) {
                togglePaymentSelection(paymentId);
            }
        });
    });
}

// Get payment-specific details
function getPaymentDetails(payment) {
    const details = [];
    
    details.push(`
        <div class="detail-item">
            <div class="detail-label">Created</div>
            <div class="detail-value">${new Date(payment.created_at).toLocaleDateString()}</div>
        </div>
    `);

    // Always show proof of payment section - either the proof or a message that it's missing
    details.push(`
        <div class="detail-item" style="grid-column: 1 / -1;">
            <div class="detail-label">Proof of Payment</div>
            <div class="detail-value">
                ${payment.proof_of_payment_url ? `
                    <button class="btn btn-primary btn-sm" onclick="viewProofOfPayment('${payment.id}')" style="margin-top: 8px;">
                        <i class="fas fa-image"></i> View Proof of Payment
                    </button>
                ` : `
                    <span style="color: #ef4444; font-size: 0.9rem; margin-top: 8px; display: inline-block;">
                        <i class="fas fa-exclamation-triangle"></i> No proof of payment uploaded
                    </span>
                `}
            </div>
        </div>
    `);

    switch (payment.type) {
        case 'funding':
            if (payment.bank_reference) {
                details.push(`
                    <div class="detail-item">
                        <div class="detail-label">Bank Reference</div>
                        <div class="detail-value">${payment.bank_reference}</div>
                    </div>
                `);
            }
            if (payment.account_details) {
                details.push(`
                    <div class="detail-item">
                        <div class="detail-label">Account Details</div>
                        <div class="detail-value">${payment.account_details}</div>
                    </div>
                `);
            }
            break;
            
        case 'withdrawal':
            if (payment.bank_details) {
                details.push(`
                    <div class="detail-item">
                        <div class="detail-label">Bank</div>
                        <div class="detail-value">${payment.bank_details.bank_name}</div>
                    </div>
                `);
                details.push(`
                    <div class="detail-item">
                        <div class="detail-label">Account</div>
                        <div class="detail-value">${payment.bank_details.account_number}</div>
                    </div>
                `);
            }
            if (payment.points_requested) {
                details.push(`
                    <div class="detail-item">
                        <div class="detail-label">Points</div>
                        <div class="detail-value">${formatPoints(payment.points_requested)}</div>
                    </div>
                `);
            }
            break;
            
        case 'escrow':
            if (payment.job_title) {
                details.push(`
                    <div class="detail-item">
                        <div class="detail-label">Job</div>
                        <div class="detail-value">${payment.job_title}</div>
                    </div>
                `);
            }
            if (payment.auto_release_date) {
                details.push(`
                    <div class="detail-item">
                        <div class="detail-label">Auto Release</div>
                        <div class="detail-value">${new Date(payment.auto_release_date).toLocaleDateString()}</div>
                    </div>
                `);
            }
            break;
            
        case 'subscription':
            if (payment.plan_key) {
                details.push(`
                    <div class="detail-item">
                        <div class="detail-label">Plan</div>
                        <div class="detail-value">${payment.plan_key.charAt(0).toUpperCase() + payment.plan_key.slice(1)}</div>
                    </div>
                `);
            }
            if (payment.payment_method) {
                details.push(`
                    <div class="detail-item">
                        <div class="detail-label">Method</div>
                        <div class="detail-value">${payment.payment_method}</div>
                    </div>
                `);
            }
            if (payment.account_details) {
                details.push(`
                    <div class="detail-item">
                        <div class="detail-label">Account Details</div>
                        <div class="detail-value">${payment.account_details}</div>
                    </div>
                `);
            }
            break;
    }

    return details.join('');
}

// Get payment-specific actions
function getPaymentActions(payment) {
    const actions = [];
    
    // Add checkbox for bulk selection
    actions.push(`
        <input type="checkbox" class="payment-checkbox" 
               onchange="togglePaymentSelection('${payment.id}')" 
               ${selectedPayments.has(payment.id) ? 'checked' : ''}>
    `);

    // Add type-specific actions - only show approve/reject for pending requests
    // For approved requests, show "Approved" status and disable approve button
    switch (payment.type) {
        case 'funding':
            if (payment.status === 'pending') {
                actions.push(`
                    <button class="btn btn-success btn-sm" onclick="approvePayment('${payment.id}', 'funding')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                `);
                actions.push(`
                    <button class="btn btn-danger btn-sm" onclick="rejectPayment('${payment.id}', 'funding')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                `);
            } else if (payment.status === 'approved' || payment.status === 'completed') {
                actions.push(`
                    <span class="btn btn-success btn-sm" style="opacity: 0.8; cursor: not-allowed; pointer-events: none;">
                        <i class="fas fa-check-circle"></i> Approved
                    </span>
                `);
            } else if (payment.status === 'rejected') {
                actions.push(`
                    <span class="btn btn-danger btn-sm" style="opacity: 0.8; cursor: not-allowed; pointer-events: none;">
                        <i class="fas fa-times-circle"></i> Rejected
                    </span>
                `);
            }
            break;
            
        case 'withdrawal':
            if (payment.status === 'pending') {
                actions.push(`
                    <button class="btn btn-success btn-sm" onclick="approvePayment('${payment.id}', 'withdrawal')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                `);
                actions.push(`
                    <button class="btn btn-danger btn-sm" onclick="rejectPayment('${payment.id}', 'withdrawal')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                `);
            } else if (payment.status === 'approved' || payment.status === 'completed') {
                actions.push(`
                    <span class="btn btn-success btn-sm" style="opacity: 0.8; cursor: not-allowed; pointer-events: none;">
                        <i class="fas fa-check-circle"></i> Approved
                    </span>
                `);
            } else if (payment.status === 'rejected') {
                actions.push(`
                    <span class="btn btn-danger btn-sm" style="opacity: 0.8; cursor: not-allowed; pointer-events: none;">
                        <i class="fas fa-times-circle"></i> Rejected
                    </span>
                `);
            }
            break;
            
        case 'escrow':
            if (payment.status === 'held') {
                actions.push(`
                    <button class="btn btn-success btn-sm" onclick="releaseEscrow('${payment.id}')">
                        <i class="fas fa-unlock"></i> Release
                    </button>
                `);
                actions.push(`
                    <button class="btn btn-warning btn-sm" onclick="refundEscrow('${payment.id}')">
                        <i class="fas fa-undo"></i> Refund
                    </button>
                `);
            } else if (payment.status === 'released' || payment.status === 'completed') {
                actions.push(`
                    <span class="btn btn-success btn-sm" style="opacity: 0.8; cursor: not-allowed; pointer-events: none;">
                        <i class="fas fa-check-circle"></i> Released
                    </span>
                `);
            } else if (payment.status === 'refunded') {
                actions.push(`
                    <span class="btn btn-warning btn-sm" style="opacity: 0.8; cursor: not-allowed; pointer-events: none;">
                        <i class="fas fa-undo"></i> Refunded
                    </span>
                `);
            }
            break;
            
        case 'subscription':
            if (payment.status === 'pending') {
                actions.push(`
                    <button class="btn btn-success btn-sm" onclick="approvePayment('${payment.id}', 'subscription')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                `);
                actions.push(`
                    <button class="btn btn-danger btn-sm" onclick="rejectPayment('${payment.id}', 'subscription')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                `);
            } else if (payment.status === 'approved' || payment.status === 'completed') {
                actions.push(`
                    <span class="btn btn-success btn-sm" style="opacity: 0.8; cursor: not-allowed; pointer-events: none;">
                        <i class="fas fa-check-circle"></i> Approved
                    </span>
                `);
            } else if (payment.status === 'rejected') {
                actions.push(`
                    <span class="btn btn-danger btn-sm" style="opacity: 0.8; cursor: not-allowed; pointer-events: none;">
                        <i class="fas fa-times-circle"></i> Rejected
                    </span>
                `);
            }
            break;
    }

    // Add view details action
    actions.push(`
        <button class="btn btn-secondary btn-sm" onclick="viewPaymentDetails('${payment.id}')">
            <i class="fas fa-eye"></i> View
        </button>
    `);

    return actions.join('');
}

// Toggle payment selection
function togglePaymentSelection(paymentId) {
    if (selectedPayments.has(paymentId)) {
        selectedPayments.delete(paymentId);
    } else {
        selectedPayments.add(paymentId);
    }
    
    updateSelectionUI();
}

// Update selection UI
function updateSelectionUI() {
    const count = selectedPayments.size;
    const bulkActions = document.getElementById('bulk-actions');
    const selectedCount = document.getElementById('selected-count');
    
    if (count > 0) {
        bulkActions.classList.add('active');
        selectedCount.textContent = count;
    } else {
        bulkActions.classList.remove('active');
    }
    
    // Update card selection state
    document.querySelectorAll('.payment-card').forEach(card => {
        const paymentId = card.dataset.paymentId;
        if (selectedPayments.has(paymentId)) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}

// Clear selection
function clearSelection() {
    selectedPayments.clear();
    updateSelectionUI();
}

// Apply filters
function applyFilters() {
    const type = document.getElementById('type-filter').value;
    const status = document.getElementById('status-filter').value;
    const amountMin = document.getElementById('amount-min').value;
    const amountMax = document.getElementById('amount-max').value;
    const search = document.getElementById('search-input').value.toLowerCase();

    console.log('Applying filters:', { type, status, amountMin, amountMax, search });
    console.log('Total payments before filter:', allPayments.length);

    currentFilters = { type, status, amountMin, amountMax, search };

    filteredPayments = allPayments.filter(payment => {
        // Type filter
        if (type && payment.type !== type) return false;
        
        // Status filter
        if (status && payment.status !== status) return false;
        
        // Amount filters
        if (amountMin && payment.amount < parseFloat(amountMin)) return false;
        if (amountMax && payment.amount > parseFloat(amountMax)) return false;
        
        // Search filter
        if (search) {
            const searchText = `${payment.user.name || ''} ${payment.user.email || ''} ${payment.id}`.toLowerCase();
            if (!searchText.includes(search)) return false;
        }
        
        return true;
    });

    console.log('Filtered payments count:', filteredPayments.length);
    displayPayments();
}

// Clear filters
function clearFilters() {
    document.getElementById('type-filter').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('amount-min').value = '';
    document.getElementById('amount-max').value = '';
    document.getElementById('search-input').value = '';
    
    currentFilters = { type: '', status: '', amountMin: '', amountMax: '', search: '' };
    filteredPayments = [...allPayments];
    displayPayments();
}

// Approve payment
async function approvePayment(paymentId, type) {
    // Refresh payment data first to get latest status
    await loadAllPayments();
    
    const payment = allPayments.find(p => p.id === paymentId);
    if (!payment) {
        showError('Payment request not found');
        return;
    }

    // Check if already approved
    if (payment.status === 'approved' || payment.status === 'completed') {
        showError('This payment request has already been accepted and cannot be approved again.');
        await loadAllPayments(); // Refresh to show updated status
        return;
    }

    // Check if not pending
    if (payment.status !== 'pending') {
        showError(`This payment request is ${payment.status} and cannot be approved.`);
        return;
    }

    // Store current payment for modal
    window.currentPayment = { id: paymentId, type, payment };
    
    // Show approval modal
    document.getElementById('approval-modal').classList.add('active');
}

// Confirm approval
async function confirmApproval() {
    const { id, type, payment: storedPayment } = window.currentPayment;
    const reference = document.getElementById('approval-reference').value;
    const notes = document.getElementById('approval-notes').value;

    // Try to refresh payment data, but don't fail if it errors
    try {
        await loadAllPayments();
    } catch (loadError) {
        console.warn('Error refreshing payments before approval (continuing anyway):', loadError);
    }
    
    const currentPayment = allPayments.find(p => p.id === id);
    if (!currentPayment) {
        // If not found in cache, use stored payment
        if (storedPayment && storedPayment.status === 'pending') {
            console.log('Using stored payment data for approval');
        } else {
            showError('Payment request not found. Please refresh the page.');
            closeModal('approval-modal');
            return;
        }
    } else {
        // Double-check status before approving
        if (currentPayment.status !== 'pending') {
            showError(`This payment request is already ${currentPayment.status === 'approved' ? 'accepted' : currentPayment.status} and cannot be approved again.`);
            closeModal('approval-modal');
            try {
                await loadAllPayments();
            } catch (loadError) {
                console.warn('Error refreshing payments:', loadError);
            }
            return;
        }
    }

    try {
        showLoading();
        console.log(`Approving ${type} request ${id}...`);
        
        let result;
        switch (type) {
            case 'funding':
                result = await approveFundingRequest(id, reference);
                console.log('Funding approval result:', result);
                if (result && result.success !== false) {
                    if (result.points_credited) {
                        showSuccess(`Payment approved successfully! ${result.points_credited} points credited to user's wallet.`);
                    } else {
                        showSuccess('Payment approved successfully! Points credited to user\'s wallet.');
                    }
                } else {
                    throw new Error(result?.message || 'Approval failed - no result returned');
                }
                break;
            case 'withdrawal':
                result = await approveWithdrawalRequest(id, reference);
                console.log('Withdrawal approval result:', result);
                if (result && result.success !== false) {
                    showSuccess('Withdrawal approved successfully!');
                } else {
                    throw new Error(result?.message || 'Withdrawal approval failed');
                }
                break;
            case 'subscription':
                result = await approveSubscriptionPayment(id, notes);
                console.log('Subscription approval result:', result);
                if (result && result.success !== false) {
                    showSuccess('Subscription payment approved successfully!');
                } else {
                    throw new Error(result?.message || 'Subscription approval failed');
                }
                break;
            default:
                throw new Error(`Unknown payment type: ${type}`);
        }

        closeModal('approval-modal');
        // Clear modal inputs
        document.getElementById('approval-reference').value = '';
        document.getElementById('approval-notes').value = '';
        
        // Reload all payments to show updated status
        try {
            await loadAllPayments();
            await updateStats();
        } catch (loadError) {
            console.warn('Error refreshing payments after approval:', loadError);
            // Still show success since approval worked
        }
        
    } catch (error) {
        console.error('Error approving payment:', error);
        const errorMessage = error.message || error.details || JSON.stringify(error) || 'Please try again.';
        console.error('Full error details:', error);
        
        // Check if error is due to already approved status
        if (errorMessage.includes('already') || errorMessage.includes('approved') || errorMessage.includes('accepted')) {
            showError('This payment request has already been processed and cannot be approved again.');
        } else {
            showError('Failed to approve payment: ' + errorMessage);
        }
        
        // Try to refresh to show current status
        try {
            await loadAllPayments();
        } catch (loadError) {
            console.warn('Error refreshing payments after error:', loadError);
        }
        closeModal('approval-modal');
    }
}

// Reject payment
async function rejectPayment(paymentId, type) {
    // Refresh payment data first to ensure we have the latest status
    try {
        await loadAllPayments();
    } catch (loadError) {
        console.warn('Error refreshing payments before rejection (continuing anyway):', loadError);
    }
    
    const payment = allPayments.find(p => p.id === paymentId);
    if (!payment) {
        showError('Payment request not found. Please refresh the page.');
        return;
    }

    // Check if already processed
    if (payment.status !== 'pending') {
        showError(`This payment request is already ${payment.status === 'approved' ? 'accepted' : payment.status} and cannot be rejected.`);
        await loadAllPayments(); // Refresh to show updated status
        return;
    }

    // Store current payment for modal
    window.currentPayment = { id: paymentId, type, payment };
    
    // Show rejection modal
    document.getElementById('rejection-modal').classList.add('active');
}

// Confirm rejection
async function confirmRejection() {
    const { id, type, payment: storedPayment } = window.currentPayment;
    const reason = document.getElementById('rejection-reason').value;
    const notes = document.getElementById('rejection-notes').value;

    if (!reason.trim()) {
        showError('Please provide a rejection reason.');
        return;
    }

    // Refresh payment data to ensure we have the latest status
    try {
        await loadAllPayments();
    } catch (loadError) {
        console.warn('Error refreshing payments before rejection (continuing anyway):', loadError);
    }
    
    const currentPayment = allPayments.find(p => p.id === id);
    if (!currentPayment) {
        // If not found in cache, use stored payment
        if (storedPayment && storedPayment.status === 'pending') {
            console.log('Using stored payment data for rejection');
        } else {
            showError('Payment request not found. Please refresh the page.');
            closeModal('rejection-modal');
            return;
        }
    } else {
        // Double-check status before rejecting
        if (currentPayment.status !== 'pending') {
            showError(`This payment request is already ${currentPayment.status === 'approved' ? 'accepted' : currentPayment.status} and cannot be rejected.`);
            closeModal('rejection-modal');
            try {
                await loadAllPayments();
            } catch (loadError) {
                console.warn('Error refreshing payments:', loadError);
            }
            return;
        }
    }

    try {
        showLoading();
        console.log(`Rejecting ${type} request ${id}...`);
        
        let result;
        switch (type) {
            case 'funding':
                result = await rejectFundingRequest(id, reason);
                console.log('Funding rejection result:', result);
                break;
            case 'withdrawal':
                result = await rejectWithdrawalRequest(id, reason);
                console.log('Withdrawal rejection result:', result);
                break;
            case 'subscription':
                result = await rejectSubscriptionPayment(id, reason);
                console.log('Subscription rejection result:', result);
                break;
            default:
                throw new Error(`Unknown payment type: ${type}`);
        }

        if (result && result.success === false) {
            throw new Error(result.message || 'Rejection failed');
        }

        closeModal('rejection-modal');
        // Clear modal inputs
        document.getElementById('rejection-reason').value = '';
        document.getElementById('rejection-notes').value = '';
        
        // Reload all payments to show updated status
        try {
            await loadAllPayments();
            await updateStats();
            showSuccess('Payment rejected successfully!');
        } catch (loadError) {
            console.warn('Error refreshing payments after rejection:', loadError);
            // Still show success since rejection worked
            showSuccess('Payment rejected successfully! (Refresh the page to see updated status)');
        }
        
    } catch (error) {
        console.error('Error rejecting payment:', error);
        const errorMessage = error.message || error.details || JSON.stringify(error) || 'Please try again.';
        
        // Check if error is due to request not found
        if (errorMessage.includes('not found') || errorMessage.includes('deleted')) {
            showError('Payment request not found. It may have been deleted. Please refresh the page.');
        } else if (errorMessage.includes('already')) {
            showError('This payment request has already been processed and cannot be rejected again.');
        } else {
            showError('Failed to reject payment: ' + errorMessage);
        }
        
        // Try to refresh to show current status
        try {
            await loadAllPayments();
        } catch (loadError) {
            console.warn('Error refreshing payments after error:', loadError);
        }
        closeModal('rejection-modal');
    }
}

// Release escrow
async function releaseEscrow(escrowId) {
    if (!confirm('Are you sure you want to release these escrow funds to the apprentice?')) {
        return;
    }

    try {
        showLoading();
        await releaseEscrowFunds(escrowId);
        await loadAllPayments();
        await updateStats();
        showSuccess('Escrow funds released successfully!');
    } catch (error) {
        console.error('Error releasing escrow:', error);
        showError('Failed to release escrow funds. Please try again.');
    }
}

// Refund escrow
async function refundEscrow(escrowId) {
    const reason = prompt('Enter refund reason:');
    if (!reason) return;

    if (!confirm('Are you sure you want to refund these escrow funds to the member?')) {
        return;
    }

    try {
        showLoading();
        await refundEscrowFunds(escrowId, reason);
        await loadAllPayments();
        await updateStats();
        showSuccess('Escrow funds refunded successfully!');
    } catch (error) {
        console.error('Error refunding escrow:', error);
        showError('Failed to refund escrow funds. Please try again.');
    }
}

// Bulk approve
async function bulkApprove() {
    if (selectedPayments.size === 0) return;
    
    if (!confirm(`Are you sure you want to approve ${selectedPayments.size} payment(s)?`)) {
        return;
    }

    try {
        showLoading();
        
        const selectedIds = Array.from(selectedPayments);
        let successCount = 0;
        let failCount = 0;
        const errors = [];
        
        for (const paymentId of selectedIds) {
            try {
                const payment = allPayments.find(p => p.id === paymentId);
                
                // Skip if payment not found or not pending
                if (!payment) {
                    failCount++;
                    errors.push(`Payment ${paymentId}: Not found`);
                    continue;
                }
                
                if (payment.status !== 'pending') {
                    failCount++;
                    errors.push(`Payment ${paymentId}: Already ${payment.status}`);
                    continue;
                }
                
                // Attempt approval
                switch (payment.type) {
                    case 'funding':
                        await approveFundingRequest(paymentId);
                        successCount++;
                        break;
                    case 'withdrawal':
                        await approveWithdrawalRequest(paymentId);
                        successCount++;
                        break;
                    case 'subscription':
                        await approveSubscriptionPayment(paymentId);
                        successCount++;
                        break;
                    default:
                        failCount++;
                        errors.push(`Payment ${paymentId}: Unknown type ${payment.type}`);
                }
            } catch (error) {
                failCount++;
                errors.push(`Payment ${paymentId}: ${error.message || 'Approval failed'}`);
                console.error(`Error approving payment ${paymentId}:`, error);
            }
        }

        clearSelection();
        await loadAllPayments();
        await updateStats();
        
        // Show appropriate message
        if (successCount > 0 && failCount === 0) {
            showSuccess(`${successCount} payment(s) approved successfully!`);
        } else if (successCount > 0 && failCount > 0) {
            showError(`${successCount} payment(s) approved, ${failCount} failed. Check console for details.`);
            console.warn('Bulk approval errors:', errors);
        } else {
            showError(`Failed to approve payments. Check console for details.`);
            console.error('Bulk approval errors:', errors);
        }
        
    } catch (error) {
        console.error('Error bulk approving payments:', error);
        showError('Failed to approve payments. Please try again.');
        await loadAllPayments();
    }
}

// Bulk reject
async function bulkReject() {
    if (selectedPayments.size === 0) return;
    
    const reason = prompt('Enter rejection reason for all selected payments:');
    if (!reason) return;
    
    if (!confirm(`Are you sure you want to reject ${selectedPayments.size} payments?`)) {
        return;
    }

    try {
        showLoading();
        
        for (const paymentId of selectedPayments) {
            const payment = allPayments.find(p => p.id === paymentId);
            if (payment && payment.status === 'pending') {
                switch (payment.type) {
                    case 'withdrawal':
                        await rejectWithdrawalRequest(paymentId, reason);
                        break;
                    case 'subscription':
                        await rejectSubscriptionPayment(paymentId, reason);
                        break;
                }
            }
        }

        clearSelection();
        await loadAllPayments();
        await updateStats();
        showSuccess(`${selectedPayments.size} payments rejected successfully!`);
        
    } catch (error) {
        console.error('Error bulk rejecting payments:', error);
        showError('Failed to reject some payments. Please try again.');
    }
}

// View payment details
function viewPaymentDetails(paymentId) {
    const payment = allPayments.find(p => p.id === paymentId);
    if (!payment) {
        showError('Payment request not found');
        return;
    }

    // Create a detailed view modal
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px;">
            <div class="modal-header">
                <h3 class="modal-title">Payment Details</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                ${getDetailedPaymentView(payment)}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// View proof of payment
async function viewProofOfPayment(paymentId) {
    const payment = allPayments.find(p => p.id === paymentId);
    if (!payment) {
        showError('Payment request not found');
        return;
    }
    
    if (!payment.proof_of_payment_url) {
        showError('Proof of payment not available for this request');
        return;
    }

    // Get signed URL for the payment proof (handles both old URLs and new storage paths)
    let signedUrl;
    try {
        signedUrl = await getPaymentProofSignedUrl(payment.proof_of_payment_url);
    } catch (error) {
        console.error('Error getting signed URL:', error);
        showError('Failed to load payment proof. Please try again.');
        return;
    }

    // Create proof viewer modal
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'proof-viewer-modal';
    
    // Check if proof URL is an image or PDF (check the original reference for file extension)
    const isImage = payment.proof_of_payment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isPdf = payment.proof_of_payment_url.match(/\.(pdf)$/i);
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px;">
            <div class="modal-header">
                <h3 class="modal-title">Proof of Payment</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 12px; color: #1e293b;">Payment Request Information</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
                        <div>
                            <strong>Type:</strong> ${payment.type.charAt(0).toUpperCase() + payment.type.slice(1)}
                        </div>
                        <div>
                            <strong>Amount:</strong> ${payment.amountDisplay}
                        </div>
                        <div>
                            <strong>User:</strong> ${payment.user.name || payment.user.email}
                        </div>
                        <div>
                            <strong>Status:</strong> <span class="status-badge ${payment.status}">${payment.status === 'approved' ? 'Approved' : payment.status === 'rejected' ? 'Rejected' : payment.status}</span>
                        </div>
                        <div>
                            <strong>Created:</strong> ${new Date(payment.created_at).toLocaleString()}
                        </div>
                    </div>
                </div>
                <div style="margin-bottom: 20px;">
                    <h4 style="margin-bottom: 12px; color: #1e293b;">Proof of Payment</h4>
                    <div style="text-align: center; background: #f8fafc; padding: 20px; border-radius: 8px; min-height: 200px;">
                        ${isImage ? 
                            `<img src="${signedUrl}" alt="Proof of Payment" 
                                  style="max-width: 100%; max-height: 600px; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
                                  onerror="this.parentElement.innerHTML='<p style=\\'color: red;\\'>Failed to load image. <a href=\\'${signedUrl}\\' target=\\'_blank\\'>Open directly</a></p>'">` :
                            isPdf ?
                            `<iframe src="${signedUrl}" 
                                     style="width: 100%; height: 600px; border: none; border-radius: 8px;"
                                     onerror="this.parentElement.innerHTML='<p style=\\'color: red;\\'>Failed to load PDF. <a href=\\'${signedUrl}\\' target=\\'_blank\\'>Open directly</a></p>'"></iframe>` :
                            `<div style="padding: 40px;">
                                <i class="fas fa-file" style="font-size: 3rem; color: #64748b; margin-bottom: 16px;"></i>
                                <p style="color: #64748b; margin-bottom: 16px;">Proof of payment file</p>
                                <a href="${signedUrl}" target="_blank" class="btn btn-primary">
                                    <i class="fas fa-external-link-alt"></i> Open File
                                </a>
                            </div>`
                        }
                    </div>
                    <div style="margin-top: 16px; text-align: center;">
                        <a href="${signedUrl}" target="_blank" class="btn btn-primary">
                            <i class="fas fa-external-link-alt"></i> Open in New Tab
                        </a>
                    </div>
                </div>
                ${payment.status === 'pending' ? `
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <h4 style="margin-bottom: 12px; color: #1e293b;">Actions</h4>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="btn btn-success" onclick="
                            const modal = document.getElementById('proof-viewer-modal');
                            if (modal) modal.remove();
                            approvePayment('${payment.id}', '${payment.type}');
                        ">
                            <i class="fas fa-check"></i> Approve Payment
                        </button>
                        <button class="btn btn-danger" onclick="
                            const modal = document.getElementById('proof-viewer-modal');
                            if (modal) modal.remove();
                            rejectPayment('${payment.id}', '${payment.type}');
                        ">
                            <i class="fas fa-times"></i> Reject Payment
                        </button>
                    </div>
                </div>
                ` : payment.status === 'approved' ? `
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <div style="background: #d1fae5; padding: 12px; border-radius: 8px; text-align: center;">
                        <i class="fas fa-check-circle" style="color: #065f46; margin-right: 8px;"></i>
                        <strong style="color: #065f46;">This payment has already been approved</strong>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Get detailed payment view
function getDetailedPaymentView(payment) {
    return `
        <div style="display: grid; gap: 20px;">
            <div>
                <h4>Basic Information</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 12px;">
                    <div>
                        <strong>Type:</strong> ${payment.type}
                    </div>
                    <div>
                        <strong>Status:</strong> ${payment.status}
                    </div>
                    <div>
                        <strong>Amount:</strong> ${payment.amountDisplay}
                    </div>
                    <div>
                        <strong>Created:</strong> ${new Date(payment.created_at).toLocaleString()}
                    </div>
                </div>
            </div>
            
            <div>
                <h4>User Information</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 12px;">
                    <div>
                        <strong>Name:</strong> ${payment.user.name || 'N/A'}
                    </div>
                    <div>
                        <strong>Email:</strong> ${payment.user.email || 'N/A'}
                    </div>
                </div>
            </div>
            
            ${getTypeSpecificDetails(payment)}
        </div>
    `;
}

// Get type-specific details
function getTypeSpecificDetails(payment) {
    switch (payment.type) {
        case 'funding':
            return `
                <div>
                    <h4>Funding Details</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 12px;">
                        ${payment.bank_reference ? `<div><strong>Bank Reference:</strong> ${payment.bank_reference}</div>` : ''}
                        ${payment.account_details ? `<div><strong>Account Details:</strong> ${payment.account_details}</div>` : ''}
                        ${payment.proof_of_payment_url ? `
                            <div style="grid-column: 1 / -1;">
                                <strong>Proof of Payment:</strong>
                                <div style="margin-top: 8px;">
                                    <button class="btn btn-primary btn-sm" onclick="viewProofOfPayment('${payment.id}'); this.closest('.modal').remove();">
                                        <i class="fas fa-image"></i> View Proof of Payment
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
        case 'withdrawal':
            return `
                <div>
                    <h4>Withdrawal Details</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 12px;">
                        ${payment.bank_details ? `
                            <div><strong>Bank:</strong> ${payment.bank_details.bank_name}</div>
                            <div><strong>Account Number:</strong> ${payment.bank_details.account_number}</div>
                            <div><strong>Account Name:</strong> ${payment.bank_details.account_name}</div>
                        ` : ''}
                        ${payment.points_requested ? `<div><strong>Points Requested:</strong> ${formatPoints(payment.points_requested)}</div>` : ''}
                        ${payment.proof_of_payment_url ? `
                            <div style="grid-column: 1 / -1;">
                                <strong>Proof of Payment:</strong>
                                <div style="margin-top: 8px;">
                                    <button class="btn btn-primary btn-sm" onclick="viewProofOfPayment('${payment.id}'); this.closest('.modal').remove();">
                                        <i class="fas fa-image"></i> View Proof of Payment
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
        case 'escrow':
            return `
                <div>
                    <h4>Escrow Details</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 12px;">
                        ${payment.job_title ? `<div><strong>Job:</strong> ${payment.job_title}</div>` : ''}
                        ${payment.job_id ? `<div><strong>Job ID:</strong> ${payment.job_id}</div>` : ''}
                        ${payment.auto_release_date ? `<div><strong>Auto Release:</strong> ${new Date(payment.auto_release_date).toLocaleString()}</div>` : ''}
                    </div>
                </div>
            `;
            
        case 'subscription':
            return `
                <div>
                    <h4>Subscription Details</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 12px;">
                        ${payment.plan_key ? `<div><strong>Plan:</strong> ${payment.plan_key}</div>` : ''}
                        ${payment.payment_method ? `<div><strong>Method:</strong> ${payment.payment_method}</div>` : ''}
                        ${payment.account_details ? `<div><strong>Account Details:</strong> ${payment.account_details}</div>` : ''}
                        ${payment.proof_of_payment_url ? `
                            <div style="grid-column: 1 / -1;">
                                <strong>Proof of Payment:</strong>
                                <div style="margin-top: 8px;">
                                    <button class="btn btn-primary btn-sm" onclick="viewProofOfPayment('${payment.id}'); this.closest('.modal').remove();">
                                        <i class="fas fa-image"></i> View Proof of Payment
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            
        default:
            return '';
    }
}

// Update stats
async function updateStats() {
    const pending = allPayments.filter(p => p.status === 'pending').length;
    const approved = allPayments.filter(p => p.status === 'approved' || p.status === 'completed').length;
    const rejected = allPayments.filter(p => p.status === 'rejected').length;
    const escrowTotal = allPayments
        .filter(p => p.type === 'escrow' && p.status === 'held')
        .reduce((sum, p) => sum + p.amount, 0);

    document.getElementById('pending-count').textContent = pending;
    document.getElementById('approved-count').textContent = approved;
    document.getElementById('rejected-count').textContent = rejected;
    document.getElementById('escrow-amount').textContent = formatCurrency(escrowTotal);
}

// Refresh payments
async function refreshPayments() {
    await loadAllPayments();
    showSuccess('Payments refreshed successfully!');
}

// Export payments
function exportPayments() {
    const csvContent = [
        ['Type', 'Status', 'User', 'Email', 'Amount', 'Created', 'Details'],
        ...filteredPayments.map(payment => [
            payment.type,
            payment.status,
            payment.user.name || '',
            payment.user.email || '',
            payment.amount,
            new Date(payment.created_at).toISOString(),
            JSON.stringify(payment)
        ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showSuccess('Payments exported successfully!');
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Show loading
function showLoading() {
    const container = document.getElementById('payments-container');
    container.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner"></i>
            <p>Processing...</p>
        </div>
    `;
}

// Show error
function showError(message) {
    // Simple error notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 5000);
}

// Show success
function showSuccess(message) {
    // Simple success notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 5000);
}

// Setup event listeners
function setupEventListeners() {
    // Filter inputs
    document.getElementById('type-filter').addEventListener('change', applyFilters);
    document.getElementById('status-filter').addEventListener('change', applyFilters);
    document.getElementById('amount-min').addEventListener('input', applyFilters);
    document.getElementById('amount-max').addEventListener('input', applyFilters);
    document.getElementById('search-input').addEventListener('input', applyFilters);

    // Modal close on outside click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
}

// Make functions globally available
window.togglePaymentSelection = togglePaymentSelection;
window.clearSelection = clearSelection;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.approvePayment = approvePayment;
window.confirmApproval = confirmApproval;
window.rejectPayment = rejectPayment;
window.confirmRejection = confirmRejection;
window.releaseEscrow = releaseEscrow;
window.refundEscrow = refundEscrow;
window.bulkApprove = bulkApprove;
window.bulkReject = bulkReject;
window.viewPaymentDetails = viewPaymentDetails;
window.viewProofOfPayment = viewProofOfPayment;
window.closeModal = closeModal;
window.refreshPayments = refreshPayments;
window.exportPayments = exportPayments;

