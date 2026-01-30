// wallet-interface.js - User Wallet Interface
import { supabase } from "./supabase-auth.js";
import { getTransactionIcon, getTransactionIconClass, getAmountClass } from "./manual-payment-system.js";
// Load ENV_CONFIG with fallback for production
let ENV_CONFIG;
try {
    const envModule = await import("./env.js");
    ENV_CONFIG = envModule.ENV_CONFIG;
} catch {
    try {
        const prodModule = await import("./env.production.js");
        ENV_CONFIG = prodModule.ENV_CONFIG;
    } catch {
        // Fallback
        ENV_CONFIG = {
            SUPABASE_URL: "https://xmffdlciwrvuycnsgezb.supabase.co",
            FLUTTERWAVE_FUNCTION_URL: "https://xmffdlciwrvuycnsgezb.functions.supabase.co/flutterwave-init-payment",
            SITE_URL: "https://loverboy132.github.io",
        };
    }
}
import { 
    getUserWallet, 
    getWalletTransactions, 
    getCraftnetBankAccounts, 
    createFundingRequest, 
    createWithdrawalRequest,
    getUserFundingRequests,
    getUserWithdrawalRequests,
    uploadProofOfPayment,
    formatCurrency,
    formatPoints,
    getTransactionTypeDisplay,
    getStatusDisplay,
    getStatusColor,
    validateBankDetails
} from "./manual-payment-system.js";

// ==============================================
// WALLET UI FUNCTIONS
// ==============================================

// Initialize wallet interface
export async function initializeWalletInterface() {
    try {
        await loadWalletBalance();
        await loadWalletTransactions();
        setupWalletEventListeners();
    } catch (error) {
        console.error('Error initializing wallet interface:', error);
        const errorMessage = error?.message || error?.details || 'Failed to load wallet data';
        showNotification(`Failed to load wallet data: ${errorMessage}`, 'error');
    }
}

// Load and display wallet balance
async function loadWalletBalance() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const wallet = await getUserWallet(user.id);
        
        // Ensure wallet has required properties with defaults
        if (!wallet) {
            throw new Error('Wallet data is missing');
        }
        
        // Update wallet display
        const balanceElement = document.getElementById('wallet-balance');
        const pointsElement = document.getElementById('wallet-points');

        if (balanceElement) {
            const balance = wallet.balance_ngn ?? 0;
            balanceElement.textContent = formatCurrency(balance);
        }

        if (pointsElement) {
            const points = wallet.balance_points ?? 0;
            pointsElement.textContent = formatPoints(points);
        }

        console.log('Wallet balance loaded:', {
            balance_ngn: wallet.balance_ngn ?? 0,
            balance_points: wallet.balance_points ?? 0,
            user_id: user.id,
            timestamp: new Date().toISOString()
        });
        
        // Update wallet summary
        updateWalletSummary(wallet);
        
    } catch (error) {
        console.error('Error loading wallet balance:', error);
        const errorMessage = error?.message || error?.details || 'Failed to load wallet balance. Please try again.';
        showNotification(`Error loading wallet: ${errorMessage}`, 'error');
    }
}

// Update wallet summary display
function updateWalletSummary(wallet) {
    if (!wallet) return;
    
    const summaryElements = {
        'total-deposited': formatCurrency(wallet.total_deposited ?? 0),
        'total-withdrawn': formatCurrency(wallet.total_withdrawn ?? 0),
        'available-balance': formatCurrency(wallet.balance_ngn ?? 0),
        'available-points': formatPoints(wallet.balance_points ?? 0)
    };
    
    Object.entries(summaryElements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

// Load and display wallet transactions
async function loadWalletTransactions() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const transactions = await getWalletTransactions(user.id, 20);
        displayWalletTransactions(transactions);
        
    } catch (error) {
        console.error('Error loading wallet transactions:', error);
        const container = document.getElementById('wallet-transactions-container');
        if (container) {
            const errorMessage = error?.message || error?.details || 'Failed to load transactions';
            container.innerHTML = `<p class="text-red-500 text-center py-4">Error loading transactions: ${errorMessage}</p>`;
        }
    }
}

// Display wallet transactions
function displayWalletTransactions(transactions) {
    const container = document.getElementById('wallet-transactions-container');
    if (!container) return;

    if (transactions.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">No transactions yet</p>';
        return;
    }

    container.innerHTML = transactions.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-icon ${getTransactionIcon(transaction.transaction_type)}">
                <i class="fas ${getTransactionIconClass(transaction.transaction_type)}"></i>
            </div>
            <div class="transaction-details">
                <div class="transaction-type">${getTransactionTypeDisplay(transaction.transaction_type)}</div>
                <div class="transaction-description">${transaction.description || 'Transaction'}</div>
                <div class="transaction-date">${new Date(transaction.created_at).toLocaleString()}</div>
            </div>
            <div class="transaction-amount ${getAmountClass(transaction.transaction_type)}">
                ${getAmountPrefix(transaction.transaction_type)}${formatCurrency(transaction.amount_ngn)}
            </div>
        </div>
    `).join('');
}




// Get amount prefix
function getAmountPrefix(type) {
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

// Setup wallet event listeners
function setupWalletEventListeners() {
    // Add funds button
    const addFundsBtn = document.getElementById('add-funds-btn');
    if (addFundsBtn) {
        addFundsBtn.addEventListener('click', showAddFundsModal);
    }

    // Add funds via Flutterwave button
    const addFundsFlutterwaveBtn = document.getElementById('add-funds-flutterwave-btn');
    if (addFundsFlutterwaveBtn) {
        addFundsFlutterwaveBtn.addEventListener('click', startFlutterwaveWalletFunding);
    }

    // Withdraw funds button
    const withdrawBtn = document.getElementById('withdraw-funds-btn');
    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', showWithdrawModal);
    }

    // View transactions button
    const viewTransactionsBtn = document.getElementById('view-transactions-btn');
    if (viewTransactionsBtn) {
        viewTransactionsBtn.addEventListener('click', showTransactionsModal);
    }
}

// Start Flutterwave wallet funding (online payment)
async function startFlutterwaveWalletFunding() {
    try {
        const {
            data: { session },
            error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
            showNotification('Please log in to continue', 'error');
            return;
        }

        const amountInput = window.prompt('Enter amount to fund (NGN):\nMinimum: ₦1,000');
        if (!amountInput) return;

        const amount = parseFloat(amountInput);
        if (!Number.isFinite(amount) || amount <= 0) {
            showNotification('Please enter a valid amount', 'error');
            return;
        }

        if (amount < 1000) {
            showNotification('Minimum funding amount is ₦1,000', 'error');
            return;
        }

        const flutterwaveUrl = ENV_CONFIG.FLUTTERWAVE_FUNCTION_URL || 
            `${ENV_CONFIG.SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co')}/flutterwave-init-payment`;
        
        const response = await fetch(flutterwaveUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    amount,
                    type: 'wallet_funding',
                }),
            });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to start Flutterwave payment');
        }

        // Redirect to Flutterwave checkout
        window.location.href = data.payment_url;
    } catch (error) {
        console.error('Error initializing Flutterwave wallet funding:', error);
        showNotification(
            error?.message || 'Failed to start Flutterwave payment. Please try again.',
            'error'
        );
    }
}

// ==============================================
// FUNDING MODAL FUNCTIONS
// ==============================================

// Show add funds modal
async function showAddFundsModal() {
    try {
        const bankAccounts = await getCraftnetBankAccounts();
        const modal = createAddFundsModal(bankAccounts);
        document.body.appendChild(modal);
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error showing add funds modal:', error);
        showNotification('Failed to load bank accounts', 'error');
    }
}

// Create add funds modal
function createAddFundsModal(bankAccounts) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'add-funds-modal';
    
    modal.innerHTML = `
        <div class="modal-content enhanced-modal">
            <div class="modal-header">
                <div class="modal-title-section">
                    <div class="modal-icon">
                        <i class="fas fa-wallet"></i>
                    </div>
                    <div>
                        <h3 class="modal-title">Add Funds to Wallet</h3>
                        <p class="modal-subtitle">Fund your wallet to start using Craftnet services</p>
                    </div>
                </div>
                <button class="modal-close" onclick="closeModal('add-funds-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="add-funds-form" class="enhanced-form">
                    <div class="form-section">
                        <h4 class="section-title">
                            <i class="fas fa-money-bill-wave"></i>
                            Payment Details
                        </h4>
                        
                        <div class="form-group">
                            <label for="funding-amount" class="form-label">
                                <i class="fas fa-naira-sign"></i>
                                Amount (NGN)
                            </label>
                            <div class="input-group">
                                <span class="input-prefix">₦</span>
                                <input type="number" id="funding-amount" name="amount" min="1000" step="100" required 
                                       class="form-input" placeholder="Enter amount">
                            </div>
                            <small class="form-help">
                                <i class="fas fa-info-circle"></i>
                                Minimum amount: ₦1,000
                            </small>
                        </div>
                        
                        <div class="form-group">
                            <label for="account-details" class="form-label">
                                <i class="fas fa-user"></i>
                                Account Details Used to Pay
                            </label>
                            <input type="text" id="account-details" name="accountDetails" required 
                                   class="form-input" placeholder="Enter your account name and number">
                            <small class="form-help">
                                <i class="fas fa-info-circle"></i>
                                Example: John Doe - 1234567890
                            </small>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4 class="section-title">
                            <i class="fas fa-file-upload"></i>
                            Proof of Payment
                        </h4>
                        
                        <div class="form-group">
                            <label for="proof-of-payment" class="form-label">
                                <i class="fas fa-camera"></i>
                                Upload Proof of Payment
                            </label>
                            <div class="file-upload-area" id="file-upload-area">
                                <div class="file-upload-content">
                                    <i class="fas fa-cloud-upload-alt upload-icon"></i>
                                    <p class="upload-text">Click to upload or drag and drop</p>
                                    <p class="upload-subtext">JPG, PNG, GIF, or PDF (Max 5MB)</p>
                                </div>
                                <input type="file" id="proof-of-payment" name="proofOfPayment" 
                                       accept="image/*,.pdf" class="file-input">
                            </div>
                            <div class="file-preview" id="file-preview" style="display: none;">
                                <div class="file-preview-content">
                                    <i class="fas fa-file-image preview-icon"></i>
                                    <div class="file-info">
                                        <span class="file-name"></span>
                                        <span class="file-size"></span>
                                    </div>
                                    <button type="button" class="remove-file" onclick="removeUploadedFile()">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                            <small class="form-help">
                                <i class="fas fa-shield-alt"></i>
                                Upload a screenshot or receipt of your bank transfer for faster verification
                            </small>
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <h4 class="section-title">
                            <i class="fas fa-university"></i>
                            Transfer to Craftnet Account
                        </h4>
                        
                        <!-- Flutterwave Virtual Account -->
                        <div class="bank-account-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-bottom: 1rem;">
                            <div class="bank-logo">
                                <i class="fas fa-credit-card"></i>
                            </div>
                            <div class="bank-info">
                                <h5 class="bank-name" style="color: white;">Flutterwave Virtual Account (Recommended)</h5>
                                <div class="account-details">
                                    <div class="account-field">
                                        <span class="field-label" style="color: rgba(255,255,255,0.9);">Bank:</span>
                                        <span class="field-value" style="color: white;">Sterling Bank</span>
                                    </div>
                                    <div class="account-field">
                                        <span class="field-label" style="color: rgba(255,255,255,0.9);">Account Number:</span>
                                        <span class="field-value account-number" onclick="copyToClipboard('8817564174')" style="color: white; cursor: pointer;">
                                            8817564174
                                            <i class="fas fa-copy copy-icon"></i>
                                        </span>
                                    </div>
                                </div>
                                <p style="font-size: 0.85rem; margin-top: 0.5rem; color: rgba(255,255,255,0.8);">
                                    <i class="fas fa-info-circle"></i> Instant verification via webhook
                                </p>
                            </div>
                        </div>
                        
                        <div class="bank-accounts-grid">
                            ${bankAccounts.map(account => `
                                <div class="bank-account-card">
                                    <div class="bank-logo">
                                        <i class="fas fa-university"></i>
                                    </div>
                                    <div class="bank-info">
                                        <h5 class="bank-name">${account.bank_name}</h5>
                                        <div class="account-details">
                                            <div class="account-field">
                                                <span class="field-label">Account Name:</span>
                                                <span class="field-value">${account.account_name}</span>
                                            </div>
                                            <div class="account-field">
                                                <span class="field-label">Account Number:</span>
                                                <span class="field-value account-number" onclick="copyToClipboard('${account.account_number}')">
                                                    ${account.account_number}
                                                    <i class="fas fa-copy copy-icon"></i>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div class="transfer-instructions">
                            <h5><i class="fas fa-list-ol"></i> Instructions:</h5>
                            <ol>
                                <li>Transfer the exact amount to any of the accounts above</li>
                                <li>Use your bank's mobile app or visit a branch</li>
                                <li>Copy the account number for easy transfer</li>
                                <li>Upload proof of payment for faster verification</li>
                                <li><strong>Note:</strong> Flutterwave virtual account transfers are verified automatically</li>
                            </ol>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('add-funds-modal')">
                            <i class="fas fa-times"></i>
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary" id="submit-funding-btn">
                            <i class="fas fa-paper-plane"></i>
                            Submit Request
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Add form submit handler
    modal.querySelector('#add-funds-form').addEventListener('submit', handleAddFundsSubmit);
    
    // Add file upload handlers
    setupFileUploadHandlers(modal);
    
    return modal;
}

// Handle add funds form submission
async function handleAddFundsSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const amount = parseFloat(formData.get('amount'));
    const accountDetails = formData.get('accountDetails');
    const proofOfPaymentFile = formData.get('proofOfPayment');
    
    const submitBtn = document.getElementById('submit-funding-btn');
    const originalText = submitBtn.innerHTML;
    
    try {
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        let proofOfPaymentUrl = null;
        
        // Upload proof of payment if provided
        if (proofOfPaymentFile && proofOfPaymentFile.size > 0) {
            submitBtn.innerHTML = '<i class="fas fa-cloud-upload-alt fa-spin"></i> Uploading proof...';
            proofOfPaymentUrl = await uploadProofOfPayment(proofOfPaymentFile);
        }
        
        // Create funding request
        submitBtn.innerHTML = '<i class="fas fa-paper-plane fa-spin"></i> Submitting...';
        await createFundingRequest(amount, accountDetails, proofOfPaymentUrl);
        
        showNotification('Funding request submitted successfully! We will verify your payment and credit your wallet within 24 hours.', 'success');
        closeModal('add-funds-modal');
        await loadWalletBalance();
        
    } catch (error) {
        console.error('Error creating funding request:', error);
        showNotification(error.message || 'Failed to submit funding request', 'error');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// ==============================================
// WITHDRAWAL MODAL FUNCTIONS
// ==============================================

// Show withdraw modal
function showWithdrawModal() {
    const modal = createWithdrawModal();
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

// Create withdraw modal
function createWithdrawModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'withdraw-modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Withdraw Funds</h3>
                <button class="modal-close" onclick="closeModal('withdraw-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <form id="withdraw-form">
                    <div class="form-group">
                        <label for="withdraw-amount">Amount (Points)</label>
                        <input type="number" id="withdraw-amount" name="amount" min="20" step="1" required>
                        <small class="form-help">Minimum withdrawal: 20 points (₦3,000)</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="bank-name">Bank Name</label>
                        <input type="text" id="bank-name" name="bankName" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="account-number">Account Number</label>
                        <input type="text" id="account-number" name="accountNumber" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="account-name">Account Name</label>
                        <input type="text" id="account-name" name="accountName" required>
                    </div>
                    
                    <div class="withdrawal-info">
                        <p><strong>Withdrawal Fee:</strong> 2 points</p>
                        <p><strong>Processing Time:</strong> 1-3 business days</p>
                        <p class="text-yellow-600"><strong>Note:</strong> Requests are reviewed against your available points balance.</p>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('withdraw-modal')">Cancel</button>
                        <button type="submit" class="btn btn-primary">Submit Withdrawal</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Add form submit handler
    modal.querySelector('#withdraw-form').addEventListener('submit', handleWithdrawSubmit);
    
    return modal;
}

// Handle withdraw form submission
async function handleWithdrawSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const amount = parseFloat(formData.get('amount'));
    const bankDetails = {
        bank_name: formData.get('bankName'),
        account_number: formData.get('accountNumber'),
        account_name: formData.get('accountName')
    };
    
    // Validate bank details
    const validation = validateBankDetails(bankDetails);
    if (!validation.valid) {
        showNotification(validation.error, 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showNotification('Please sign in to request a withdrawal.', 'error');
            return;
        }

        const wallet = await getUserWallet(user.id);
        const availablePoints = wallet?.balance_points ?? 0;

        if (availablePoints < amount) {
            showNotification(
                `Insufficient balance. You currently have ${formatPoints(availablePoints)} available.`,
                'error'
            );
            return;
        }
        
        // Create withdrawal request
        submitBtn.innerHTML = '<i class="fas fa-paper-plane fa-spin"></i> Submitting...';
        await createWithdrawalRequest(amount, bankDetails);
        
        showNotification('Withdrawal request submitted successfully! Admin will review and process it within 1-3 business days.', 'success');
        closeModal('withdraw-modal');
        await loadWalletBalance();
    } catch (error) {
        console.error('Error creating withdrawal request:', error);
        showNotification(error.message || 'Failed to submit withdrawal request', 'error');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// ==============================================
// TRANSACTIONS MODAL FUNCTIONS
// ==============================================

// Show transactions modal
async function showTransactionsModal() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const transactions = await getWalletTransactions(user.id, 50);
        const modal = createTransactionsModal(transactions);
        document.body.appendChild(modal);
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error showing transactions modal:', error);
        showNotification('Failed to load transactions', 'error');
    }
}

// Create transactions modal
function createTransactionsModal(transactions) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'transactions-modal';
    
    modal.innerHTML = `
        <div class="modal-content large">
            <div class="modal-header">
                <h3 class="modal-title">Transaction History</h3>
                <button class="modal-close" onclick="closeModal('transactions-modal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="transactions-list">
                    ${transactions.length === 0 ? 
                        '<p class="text-gray-500 text-center py-4">No transactions yet</p>' :
                        transactions.map(transaction => `
                            <div class="transaction-item">
                                <div class="transaction-icon ${getTransactionIcon(transaction.transaction_type)}">
                                    <i class="fas ${getTransactionIconClass(transaction.transaction_type)}"></i>
                                </div>
                                <div class="transaction-details">
                                    <div class="transaction-type">${getTransactionTypeDisplay(transaction.transaction_type)}</div>
                                    <div class="transaction-description">${transaction.description || 'Transaction'}</div>
                                    <div class="transaction-date">${new Date(transaction.created_at).toLocaleString()}</div>
                                    ${transaction.transaction_reference ? `<div class="transaction-ref">Ref: ${transaction.transaction_reference}</div>` : ''}
                                </div>
                                <div class="transaction-amount ${getAmountClass(transaction.transaction_type)}">
                                    ${getAmountPrefix(transaction.transaction_type)}${formatCurrency(transaction.amount_ngn)}
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        </div>
    `;
    
    return modal;
}

// ==============================================
// FILE UPLOAD HANDLERS
// ==============================================

// Setup file upload handlers
function setupFileUploadHandlers(modal) {
    const fileInput = modal.querySelector('#proof-of-payment');
    const fileUploadArea = modal.querySelector('#file-upload-area');
    const filePreview = modal.querySelector('#file-preview');
    
    // Click to upload
    fileUploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Drag and drop
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.classList.add('drag-over');
    });
    
    fileUploadArea.addEventListener('dragleave', () => {
        fileUploadArea.classList.remove('drag-over');
    });
    
    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
}

// Handle file selection
function handleFileSelect(file) {
    const filePreview = document.getElementById('file-preview');
    const fileUploadArea = document.getElementById('file-upload-area');
    const fileName = filePreview.querySelector('.file-name');
    const fileSize = filePreview.querySelector('.file-size');
    
    // Validate file
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!allowedTypes.includes(file.type)) {
        showNotification('Invalid file type. Please upload JPG, PNG, GIF, or PDF files only.', 'error');
        return;
    }
    
    if (file.size > maxSize) {
        showNotification('File size too large. Please upload files smaller than 5MB.', 'error');
        return;
    }
    
    // Update preview
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    
    // Show preview and hide upload area
    fileUploadArea.style.display = 'none';
    filePreview.style.display = 'block';
    
    showNotification('File selected successfully', 'success');
}

// Remove uploaded file
function removeUploadedFile() {
    const filePreview = document.getElementById('file-preview');
    const fileUploadArea = document.getElementById('file-upload-area');
    const fileInput = document.getElementById('proof-of-payment');
    
    // Reset file input
    fileInput.value = '';
    
    // Show upload area and hide preview
    fileUploadArea.style.display = 'block';
    filePreview.style.display = 'none';
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Account number copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Account number copied to clipboard!', 'success');
    });
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // This would integrate with your existing notification system
    // Ensure message is a string, not an object
    const messageText = typeof message === 'string' ? message : (message?.message || message?.details || String(message));
    console.log(`${type.toUpperCase()}: ${messageText}`);
    
    // Create a simple notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Set content with Contact Us link
    notification.innerHTML = `
        <div style="margin-bottom: 8px;">${messageText}</div>
        <a href="contact-form.html" style="font-size: 12px; text-decoration: underline; opacity: 0.9;">
            For any issues, contact us
        </a>
    `;
    
    // Add styling for better visibility
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        max-width: 400px;
        ${type === 'error' ? 'background: #ef4444; color: white;' : ''}
        ${type === 'success' ? 'background: #10b981; color: white;' : ''}
        ${type === 'warning' ? 'background: #f59e0b; color: white;' : ''}
        ${type === 'info' ? 'background: #3b82f6; color: white;' : ''}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}


// Refresh wallet balance after any transaction
export async function refreshWalletBalance() {
    console.log('Refreshing wallet balance...');
    await loadWalletBalance();
}

// Make functions globally available
window.initializeWalletInterface = initializeWalletInterface;
window.showAddFundsModal = showAddFundsModal;
window.showWithdrawModal = showWithdrawModal;
window.showTransactionsModal = showTransactionsModal;
window.closeModal = closeModal;
window.removeUploadedFile = removeUploadedFile;
window.copyToClipboard = copyToClipboard;
window.refreshWalletBalance = refreshWalletBalance;