// admin-dashboard-simplified.js - Simplified Admin Dashboard
import { supabase } from "./supabase-auth.js";
import { getAllDisputes, updateDisputeStatus, getDisputeEvidenceSignedUrl } from "./supabase-auth.js";
import {
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadNotificationCount,
    subscribeToNotifications,
    unsubscribeFromNotifications,
    injectNotificationStyles,
    displayNotification,
} from "./payment-notifications.js";

// Global state
let currentUser = null;
let dashboardData = {
    users: 0,
    jobs: 0,
    pendingPayments: 0,
    totalEscrow: 0,
    recentActivity: []
};
let allDisputes = [];
let filteredDisputes = [];
let currentDisputeFilters = {
    status: '',
    type: '',
    search: ''
};
let currentDispute = null;

// Notification state
const notificationState = {
    initialized: false,
    userId: null,
    items: [],
    unreadCount: 0,
    channel: null,
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    await initializeAuth();
    await loadDashboardData();
    setupEventListeners();
    updateStats();
});

// Initialize authentication
async function initializeAuth() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            console.error('Auth error:', error);
            window.location.href = 'login-supabase.html';
            return;
        }

        // Check if user has admin role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError || !profile || profile.role !== 'admin') {
            showNotification('Access denied. Admin privileges required.', 'error');
            setTimeout(() => {
                window.location.href = 'dashboard-supabase.html';
            }, 2000);
            return;
        }

        currentUser = user;
        updateAdminProfile(profile);
        console.log('Admin authenticated:', user.email);
        
        // Initialize notifications after auth is complete
        await initializeNotificationCenter(user);
        
    } catch (error) {
        console.error('Error initializing auth:', error);
        window.location.href = 'login-supabase.html';
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Load data in parallel
        const [usersData, jobsData, paymentsData, escrowData] = await Promise.all([
            loadUsersData(),
            loadJobsData(),
            loadPaymentsData(),
            loadEscrowData()
        ]);

        dashboardData = {
            users: usersData.count || 0,
            jobs: jobsData.count || 0,
            pendingPayments: paymentsData.pending || 0,
            totalEscrow: escrowData.total || 0,
            recentActivity: [
                ...usersData.recent || [],
                ...jobsData.recent || [],
                ...paymentsData.recent || []
            ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10)
        };

        updateStats();
        updateRecentActivity();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

// Load users data
async function loadUsersData() {
    try {
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        // Get recent user registrations
        const { data: recentUsers, error: recentError } = await supabase
            .from('profiles')
            .select('id, full_name, email, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (recentError) throw recentError;

        return {
            count,
            recent: recentUsers.map(user => ({
                type: 'user',
                title: `New user registration: ${user.full_name || user.email}`,
                created_at: user.created_at,
                icon: 'user-plus'
            }))
        };
        
    } catch (error) {
        console.error('Error loading users data:', error);
        return { count: 0, recent: [] };
    }
}

// Load jobs data
async function loadJobsData() {
    try {
        const { count, error } = await supabase
            .from('job_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'in-progress');

        if (error) throw error;

        // Get recent job activities
        const { data: recentJobs, error: recentError } = await supabase
            .from('job_requests')
            .select('id, title, status, created_at, updated_at')
            .order('updated_at', { ascending: false })
            .limit(5);

        if (recentError) throw recentError;

        return {
            count,
            recent: recentJobs.map(job => ({
                type: 'job',
                title: `Job ${job.status}: ${job.title}`,
                created_at: job.updated_at || job.created_at,
                icon: 'briefcase'
            }))
        };
        
    } catch (error) {
        console.error('Error loading jobs data:', error);
        return { count: 0, recent: [] };
    }
}

// Load payments data
async function loadPaymentsData() {
    try {
        // Count pending funding requests
        const { count: fundingCount, error: fundingError } = await supabase
            .from('funding_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (fundingError) throw fundingError;

        // Count pending withdrawal requests
        const { count: withdrawalCount, error: withdrawalError } = await supabase
            .from('wallet_withdrawal_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (withdrawalError) throw withdrawalError;

        // Count pending subscription payments
        const { count: subscriptionCount, error: subscriptionError } = await supabase
            .from('subscription_payment_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        if (subscriptionError) throw subscriptionError;

        const totalPending = (fundingCount || 0) + (withdrawalCount || 0) + (subscriptionCount || 0);

        // Get recent payment activities
        const recentActivities = [];

        // Recent funding requests
        const { data: recentFunding, error: recentFundingError } = await supabase
            .from('funding_requests')
            .select('id, amount_ngn, created_at, profiles(full_name, email)')
            .order('created_at', { ascending: false })
            .limit(3);

        if (!recentFundingError && recentFunding) {
            recentActivities.push(...recentFunding.map(funding => ({
                type: 'payment',
                title: `New funding request: ₦${funding.amount_ngn?.toLocaleString()}`,
                created_at: funding.created_at,
                icon: 'credit-card'
            })));
        }

        return {
            pending: totalPending,
            recent: recentActivities
        };
        
    } catch (error) {
        console.error('Error loading payments data:', error);
        return { pending: 0, recent: [] };
    }
}

// Load escrow data
async function loadEscrowData() {
    try {
        const { data: escrows, error } = await supabase
            .from('job_escrow')
            .select('amount_ngn')
            .eq('status', 'held');

        if (error) throw error;

        const total = escrows.reduce((sum, escrow) => sum + (escrow.amount_ngn || 0), 0);

        return { total };
        
    } catch (error) {
        console.error('Error loading escrow data:', error);
        return { total: 0 };
    }
}

// Update admin profile display
function updateAdminProfile(profile) {
    const adminAvatar = document.querySelector('.admin-avatar');
    const adminName = document.querySelector('.admin-profile > div > div:first-child');
    const adminRole = document.querySelector('.admin-profile > div > div:last-child');
    
    if (adminAvatar && profile) {
        const initials = (profile.full_name || profile.name || profile.email || 'A')
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
        adminAvatar.textContent = initials;
    }
    
    if (adminName && profile) {
        adminName.textContent = profile.full_name || profile.name || profile.email || 'Admin User';
    }
    
    if (adminRole) {
        adminRole.textContent = 'System Administrator';
    }
}

// Update stats display
function updateStats() {
    document.getElementById('total-users').textContent = dashboardData.users.toLocaleString();
    document.getElementById('total-jobs').textContent = dashboardData.jobs.toLocaleString();
    document.getElementById('pending-payments').textContent = dashboardData.pendingPayments.toLocaleString();
    document.getElementById('total-escrow').textContent = `₦${dashboardData.totalEscrow.toLocaleString()}`;
}

// Update recent activity
function updateRecentActivity() {
    const container = document.getElementById('recent-activity-list');
    
    if (dashboardData.recentActivity.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748b;">
                <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 16px; color: #cbd5e1;"></i>
                <p>No recent activity</p>
            </div>
        `;
        return;
    }

    container.innerHTML = dashboardData.recentActivity.map(activity => `
        <div class="activity-item">
            <div class="activity-icon ${activity.type}">
                <i class="fas fa-${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-time">${formatTimeAgo(activity.created_at)}</div>
            </div>
        </div>
    `).join('');
}

// Format time ago
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }
}

// Navigate to section
function navigateToSection(sectionId) {
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItem = document.querySelector(`[data-section="${sectionId}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }

    // Show section
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Load disputes when navigating to disputes section
        if (sectionId === 'disputes') {
            loadDisputes();
        }
    }

    // Close mobile sidebar if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

// Refresh all data
async function refreshAllData() {
    showNotification('Refreshing data...', 'info');
    await loadDashboardData();
    showNotification('Data refreshed successfully!', 'success');
}

// Logout
async function logout() {
    try {
        await supabase.auth.signOut();
        window.location.href = 'login-supabase.html';
    } catch (error) {
        console.error('Error logging out:', error);
        showNotification('Failed to logout', 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification-toast');
    const content = document.getElementById('notification-content');
    
    content.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.dataset.section;
            navigateToSection(sectionId);
        });
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const mobileToggle = document.querySelector('.mobile-menu-toggle');
        
        if (window.innerWidth <= 768 && 
            sidebar.classList.contains('open') && 
            !sidebar.contains(e.target) && 
            !mobileToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth > 768) {
            sidebar.classList.remove('open');
        }
    });

    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        const disputeModal = document.getElementById('dispute-detail-modal');
        const resolveModal = document.getElementById('resolve-dispute-modal');
        
        if (disputeModal && e.target === disputeModal) {
            closeDisputeModal();
        }
        
        if (resolveModal && e.target === resolveModal) {
            closeResolveModal();
        }
    });

    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDisputeModal();
            closeResolveModal();
        }
    });
}

// ==================== DISPUTE MANAGEMENT FUNCTIONS ====================

// Load all disputes
async function loadDisputes() {
    try {
        const container = document.getElementById('disputes-container');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748b;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 16px;"></i>
                <p>Loading disputes...</p>
            </div>
        `;

        const disputes = await getAllDisputes();
        allDisputes = disputes || [];
        filteredDisputes = [...allDisputes];
        
        updateDisputeStats();
        displayDisputes();
    } catch (error) {
        console.error('Error loading disputes:', error);
        const container = document.getElementById('disputes-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 16px;"></i>
                    <p>Failed to load disputes: ${error.message}</p>
                    <button onclick="loadDisputes()" class="btn btn-primary" style="margin-top: 16px; padding: 10px 16px; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 500; cursor: pointer; background: #3b82f6; color: white;">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
        }
        showNotification('Failed to load disputes', 'error');
    }
}

// Update dispute statistics
function updateDisputeStats() {
    const open = allDisputes.filter(d => d.status === 'open').length;
    const pending = allDisputes.filter(d => d.status === 'pending').length;
    const resolved = allDisputes.filter(d => d.status === 'resolved').length;
    const closed = allDisputes.filter(d => d.status === 'closed').length;

    const openEl = document.getElementById('disputes-open-count');
    const pendingEl = document.getElementById('disputes-pending-count');
    const resolvedEl = document.getElementById('disputes-resolved-count');
    const closedEl = document.getElementById('disputes-closed-count');

    if (openEl) openEl.textContent = open;
    if (pendingEl) pendingEl.textContent = pending;
    if (resolvedEl) resolvedEl.textContent = resolved;
    if (closedEl) closedEl.textContent = closed;
}

// Display disputes
function displayDisputes() {
    const container = document.getElementById('disputes-container');
    if (!container) return;

    if (filteredDisputes.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #64748b;">
                <i class="fas fa-inbox" style="font-size: 4rem; margin-bottom: 16px; color: #cbd5e1;"></i>
                <h3 style="font-size: 1.5rem; margin-bottom: 8px; color: #374151;">No Disputes Found</h3>
                <p>No disputes match your current filters.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredDisputes.map(dispute => {
        const job = dispute.job_requests || {};
        const member = dispute.member || {};
        const apprentice = dispute.apprentice || {};
        const raisedBy = dispute.raised_by_profile || {};
        
        const statusColors = {
            'open': { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
            'pending': { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
            'resolved': { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
            'closed': { bg: '#e5e7eb', text: '#374151', border: '#6b7280' }
        };

        const typeColors = {
            'payment': { bg: '#fee2e2', text: '#991b1b' },
            'delivery': { bg: '#fef3c7', text: '#92400e' },
            'fraud': { bg: '#fee2e2', text: '#991b1b' },
            'other': { bg: '#e0e7ff', text: '#3730a3' }
        };

        const statusColor = statusColors[dispute.status] || statusColors['open'];
        const typeColor = typeColors[dispute.type] || typeColors['other'];
        const hasEvidence = dispute.evidence && dispute.evidence !== 'null' && dispute.evidence !== '[]';

        return `
            <div class="dispute-card" style="border: 1px solid #e5e7eb; border-left: 4px solid ${statusColor.border}; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: white; transition: all 0.2s; cursor: pointer;" 
                 onclick="viewDisputeDetails('${dispute.id}')"
                 onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
                 onmouseout="this.style.boxShadow='none'">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                    <div style="flex: 1;">
                        <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                            <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; background: ${statusColor.bg}; color: ${statusColor.text};">
                                ${dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}
                            </span>
                            <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; background: ${typeColor.bg}; color: ${typeColor.text};">
                                ${dispute.type.charAt(0).toUpperCase() + dispute.type.slice(1)}
                            </span>
                            ${hasEvidence ? `
                                <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; background: #dbeafe; color: #1e40af;">
                                    <i class="fas fa-paperclip"></i> Evidence
                                </span>
                            ` : ''}
                        </div>
                        <h3 style="font-size: 1.1rem; font-weight: 600; color: #1e293b; margin-bottom: 8px;">
                            ${job.title || 'Job Dispute'}
                        </h3>
                        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 12px; line-height: 1.5;">
                            ${dispute.description || 'No description provided'}
                        </p>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 8px;">
                            <div>
                                <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Member</div>
                                <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${member.full_name || member.name || member.email || 'N/A'}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Apprentice</div>
                                <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${apprentice.full_name || apprentice.name || apprentice.email || 'N/A'}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Raised By</div>
                                <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${raisedBy.full_name || raisedBy.name || raisedBy.email || 'N/A'}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Amount</div>
                                <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">₦${(dispute.amount || 0).toLocaleString()}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Created</div>
                                <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${new Date(dispute.created_at).toLocaleDateString()}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <button onclick="event.stopPropagation(); viewDisputeDetails('${dispute.id}')" 
                            class="btn btn-secondary" 
                            style="padding: 8px 16px; border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 500; cursor: pointer; background: #6b7280; color: white;">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    ${dispute.status === 'open' || dispute.status === 'pending' ? `
                        <button onclick="event.stopPropagation(); openResolveModal('${dispute.id}')" 
                                class="btn btn-success" 
                                style="padding: 8px 16px; border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 500; cursor: pointer; background: #10b981; color: white;">
                            <i class="fas fa-check"></i> Resolve
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Apply dispute filters
function applyDisputeFilters() {
    const status = document.getElementById('dispute-status-filter')?.value || '';
    const type = document.getElementById('dispute-type-filter')?.value || '';
    const search = document.getElementById('dispute-search-input')?.value.toLowerCase() || '';

    currentDisputeFilters = { status, type, search };

    filteredDisputes = allDisputes.filter(dispute => {
        if (status && dispute.status !== status) return false;
        if (type && dispute.type !== type) return false;
        if (search) {
            const job = dispute.job_requests || {};
            const member = dispute.member || {};
            const apprentice = dispute.apprentice || {};
            const searchText = `${job.title || ''} ${member.full_name || member.name || member.email || ''} ${apprentice.full_name || apprentice.name || apprentice.email || ''} ${dispute.description || ''}`.toLowerCase();
            if (!searchText.includes(search)) return false;
        }
        return true;
    });

    displayDisputes();
}

// Clear dispute filters
function clearDisputeFilters() {
    if (document.getElementById('dispute-status-filter')) document.getElementById('dispute-status-filter').value = '';
    if (document.getElementById('dispute-type-filter')) document.getElementById('dispute-type-filter').value = '';
    if (document.getElementById('dispute-search-input')) document.getElementById('dispute-search-input').value = '';
    
    currentDisputeFilters = { status: '', type: '', search: '' };
    filteredDisputes = [...allDisputes];
    displayDisputes();
}

// Refresh disputes
function refreshDisputes() {
    loadDisputes();
    showNotification('Disputes refreshed', 'success');
}

// View dispute details
async function viewDisputeDetails(disputeId) {
    const dispute = allDisputes.find(d => d.id === disputeId);
    if (!dispute) {
        showNotification('Dispute not found', 'error');
        return;
    }

    currentDispute = dispute;
    const job = dispute.job_requests || {};
    const member = dispute.member || {};
    const apprentice = dispute.apprentice || {};
    const raisedBy = dispute.raised_by_profile || {};

    let evidenceHtml = '';
    if (dispute.evidence && dispute.evidence !== 'null' && dispute.evidence !== '[]') {
        try {
            const evidenceRefs = JSON.parse(dispute.evidence);
            if (Array.isArray(evidenceRefs) && evidenceRefs.length > 0) {
                // Generate signed URLs for all evidence files
                const evidencePromises = evidenceRefs.map(ref => getDisputeEvidenceSignedUrl(ref));
                const evidenceUrls = await Promise.all(evidencePromises);
                
                evidenceHtml = `
                    <div style="margin-top: 16px;">
                        <h4 style="margin-bottom: 12px; color: #1e293b; font-size: 1rem;">Evidence Files</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px;">
                            ${evidenceUrls.map((url, idx) => {
                                const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.includes('image');
                                const isPdf = url.match(/\.(pdf)$/i) || url.includes('pdf');
                                return `
                                    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; background: #f8fafc;">
                                        ${isImage ? `
                                            <img src="${url}" alt="Evidence ${idx + 1}" 
                                                 style="max-width: 100%; max-height: 150px; border-radius: 4px; margin-bottom: 8px; cursor: pointer;"
                                                 onclick="window.open('${url}', '_blank')"
                                                 onerror="this.parentElement.innerHTML='<i class=\\'fas fa-exclamation-triangle\\' style=\\'color: #ef4444;\\'></i><p style=\\'font-size: 0.8rem; color: #64748b; margin-top: 8px;\\'>Failed to load</p>'">
                                        ` : isPdf ? `
                                            <i class="fas fa-file-pdf" style="font-size: 3rem; color: #ef4444; margin-bottom: 8px;"></i>
                                        ` : `
                                            <i class="fas fa-file" style="font-size: 3rem; color: #64748b; margin-bottom: 8px;"></i>
                                        `}
                                        <a href="${url}" target="_blank" 
                                           style="display: block; font-size: 0.85rem; color: #3b82f6; text-decoration: none; margin-top: 8px;">
                                            ${isPdf ? 'View PDF' : isImage ? 'View Image' : 'View File'}
                                        </a>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            console.error('Error parsing evidence:', e);
            evidenceHtml = `
                <div style="margin-top: 16px; padding: 12px; background: #fee2e2; border-radius: 8px; color: #991b1b;">
                    <i class="fas fa-exclamation-triangle"></i> Error loading evidence files
                </div>
            `;
        }
    }

    const modal = document.getElementById('dispute-detail-modal');
    const content = document.getElementById('dispute-detail-content');
    
    content.innerHTML = `
        <div style="display: grid; gap: 20px;">
            <div>
                <h4 style="margin-bottom: 12px; color: #1e293b; font-size: 1rem;">Job Information</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 12px; background: #f8fafc; border-radius: 8px;">
                    <div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Job Title</div>
                        <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${job.title || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Job Status</div>
                        <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${job.status || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Job ID</div>
                        <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${dispute.job_id || 'N/A'}</div>
                    </div>
                </div>
            </div>

            <div>
                <h4 style="margin-bottom: 12px; color: #1e293b; font-size: 1rem;">Dispute Information</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 12px; background: #f8fafc; border-radius: 8px;">
                    <div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Status</div>
                        <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Type</div>
                        <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${dispute.type.charAt(0).toUpperCase() + dispute.type.slice(1)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Amount</div>
                        <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">₦${(dispute.amount || 0).toLocaleString()}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Created</div>
                        <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${new Date(dispute.created_at).toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <div>
                <h4 style="margin-bottom: 12px; color: #1e293b; font-size: 1rem;">Parties Involved</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 12px; background: #f8fafc; border-radius: 8px;">
                    <div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Member</div>
                        <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${member.full_name || member.name || member.email || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Apprentice</div>
                        <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${apprentice.full_name || apprentice.name || apprentice.email || 'N/A'}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Raised By</div>
                        <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${raisedBy.full_name || raisedBy.name || raisedBy.email || 'N/A'}</div>
                    </div>
                </div>
            </div>

            <div>
                <h4 style="margin-bottom: 12px; color: #1e293b; font-size: 1rem;">Description</h4>
                <div style="padding: 12px; background: #f8fafc; border-radius: 8px; color: #1e293b; line-height: 1.6;">
                    ${dispute.description || 'No description provided'}
                </div>
            </div>

            ${evidenceHtml}

            ${dispute.admin_notes ? `
                <div>
                    <h4 style="margin-bottom: 12px; color: #1e293b; font-size: 1rem;">Admin Notes</h4>
                    <div style="padding: 12px; background: #fef3c7; border-radius: 8px; color: #92400e; line-height: 1.6;">
                        ${dispute.admin_notes}
                    </div>
                </div>
            ` : ''}

            ${dispute.resolution ? `
                <div>
                    <h4 style="margin-bottom: 12px; color: #1e293b; font-size: 1rem;">Resolution</h4>
                    <div style="padding: 12px; background: #d1fae5; border-radius: 8px; color: #065f46; line-height: 1.6;">
                        ${dispute.resolution.charAt(0).toUpperCase() + dispute.resolution.slice(1).replace('_', ' ')}
                    </div>
                </div>
            ` : ''}

            ${(dispute.status === 'open' || dispute.status === 'pending') ? `
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <button onclick="closeDisputeModal(); openResolveModal('${dispute.id}')" 
                            class="btn btn-success" 
                            style="padding: 12px 24px; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 500; cursor: pointer; background: #10b981; color: white;">
                        <i class="fas fa-check"></i> Resolve Dispute
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    if (modal) {
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
    }
}

// Close dispute modal
function closeDisputeModal() {
    const modal = document.getElementById('dispute-detail-modal');
    if (modal) modal.style.display = 'none';
}

// Open resolve modal
function openResolveModal(disputeId) {
    const dispute = allDisputes.find(d => d.id === disputeId);
    if (!dispute) {
        showNotification('Dispute not found', 'error');
        return;
    }

    currentDispute = dispute;
    const modal = document.getElementById('resolve-dispute-modal');
    if (modal) {
        document.getElementById('dispute-resolution').value = '';
        document.getElementById('dispute-admin-notes').value = '';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
    }
}

// Close resolve modal
function closeResolveModal() {
    const modal = document.getElementById('resolve-dispute-modal');
    if (modal) modal.style.display = 'none';
}

// Confirm resolve dispute
async function confirmResolveDispute() {
    if (!currentDispute) {
        showNotification('No dispute selected', 'error');
        return;
    }

    const resolution = document.getElementById('dispute-resolution').value;
    const adminNotes = document.getElementById('dispute-admin-notes').value;

    if (!resolution || !adminNotes.trim()) {
        showNotification('Please provide both resolution and admin notes', 'error');
        return;
    }

    try {
        showNotification('Resolving dispute...', 'info');
        await updateDisputeStatus(currentDispute.id, 'resolved', adminNotes, resolution);
        
        closeResolveModal();
        await loadDisputes();
        showNotification('Dispute resolved successfully', 'success');
    } catch (error) {
        console.error('Error resolving dispute:', error);
        showNotification(`Failed to resolve dispute: ${error.message}`, 'error');
    }
}

// --- Notification Center ---
async function initializeNotificationCenter(userData) {
    const notificationBell = document.getElementById("notification-bell");
    const notificationPanel = document.getElementById("notification-panel");
    const notificationList = document.getElementById("notification-list");
    const notificationBadge = document.getElementById("notification-badge");
    const notificationWrapper = document.getElementById("notification-wrapper");
    const markAllNotificationsBtn = document.getElementById("mark-all-notifications");

    if (
        !notificationBell ||
        !notificationPanel ||
        !notificationList ||
        notificationState.initialized
    ) {
        return;
    }

    notificationState.initialized = true;
    notificationState.userId = userData.id;

    // Inject notification styles
    if (typeof injectNotificationStyles === "function") {
        injectNotificationStyles();
    }

    await refreshNotifications();

    // Toggle notification panel
    notificationBell.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleNotificationPanel();
    });

    // Prevent panel from closing when clicking inside
    if (notificationPanel) {
        notificationPanel.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    }

    // Mark all as read
    if (markAllNotificationsBtn) {
        markAllNotificationsBtn.addEventListener("click", async () => {
            if (!notificationState.userId) return;
            try {
                await markAllNotificationsAsRead(notificationState.userId);
                notificationState.items = notificationState.items.map(
                    (item) => ({ ...item, is_read: true })
                );
                notificationState.unreadCount = 0;
                renderNotificationList();
                updateNotificationBadge();
            } catch (error) {
                console.error("Failed to mark all notifications:", error);
                showNotification(
                    "Unable to mark notifications as read right now.",
                    "error"
                );
            }
        });
    }

    // Mark individual notification as read
    notificationList.addEventListener("click", async (event) => {
        const button = event.target.closest(".mark-read-btn");
        if (!button) return;

        const notificationId = button.dataset.notificationId;
        if (!notificationId) return;

        try {
            await markNotificationAsRead(notificationId);
            notificationState.items = notificationState.items.map((item) =>
                item.id === notificationId
                    ? { ...item, is_read: true }
                    : item
            );
            notificationState.unreadCount = Math.max(
                notificationState.unreadCount - 1,
                0
            );
            renderNotificationList();
            updateNotificationBadge();
        } catch (error) {
            console.error("Failed to update notification:", error);
            showNotification("Could not update notification", "error");
        }
    });

    // Subscribe to real-time notifications
    notificationState.channel = subscribeToNotifications(
        notificationState.userId,
        {
            onInsert: handleIncomingNotification,
            onError: (err) => {
                console.error("Notification channel error:", err);
            },
        }
    );
}

async function refreshNotifications() {
    if (!notificationState.userId) return;
    try {
        const [items, unread] = await Promise.all([
            getUserNotifications(notificationState.userId, 20, 0),
            getUnreadNotificationCount(notificationState.userId),
        ]);
        notificationState.items = items;
        notificationState.unreadCount = unread;
        renderNotificationList();
        updateNotificationBadge();
    } catch (error) {
        console.error("Failed to load notifications:", error);
    }
}

function handleIncomingNotification(notification) {
    notificationState.items = [notification, ...notificationState.items].slice(
        0,
        20
    );
    notificationState.unreadCount += 1;
    renderNotificationList();
    updateNotificationBadge();

    try {
        displayNotification(notification);
    } catch (error) {
        console.warn("Unable to show toast notification:", error);
    }
}

function renderNotificationList() {
    const notificationList = document.getElementById("notification-list");
    if (!notificationList) return;

    if (!notificationState.items.length) {
        notificationList.innerHTML =
            '<p class="text-sm text-gray-500 p-4 text-center">No notifications yet.</p>';
        return;
    }

    notificationList.innerHTML = notificationState.items
        .map((notification) => {
            const isUnread = !notification.is_read;
            const timeAgo = formatTimeAgo(notification.created_at);
            return `
                <div class="p-4 hover:bg-gray-50 transition ${isUnread ? 'bg-blue-50' : ''}">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <div class="font-semibold text-sm text-gray-900 mb-1">
                                ${notification.title || "Notification"}
                            </div>
                            <div class="text-xs text-gray-600 mb-2">
                                ${notification.message || ""}
                            </div>
                            <div class="text-xs text-gray-400">
                                ${timeAgo}
                            </div>
                        </div>
                        ${
                            isUnread
                                ? `<button class="text-xs text-blue-600 hover:underline mark-read-btn ml-2" data-notification-id="${notification.id}">Mark read</button>`
                                : ""
                        }
                    </div>
                </div>
            `;
        })
        .join("");
}

function updateNotificationBadge() {
    const notificationBadge = document.getElementById("notification-badge");
    if (!notificationBadge) return;

    if (notificationState.unreadCount > 0) {
        notificationBadge.textContent =
            notificationState.unreadCount > 9
                ? "9+"
                : notificationState.unreadCount.toString();
        notificationBadge.classList.remove("hidden");
    } else {
        notificationBadge.classList.add("hidden");
    }
}

function toggleNotificationPanel(forceState) {
    const notificationPanel = document.getElementById("notification-panel");
    if (!notificationPanel) return;

    const shouldShow =
        forceState !== undefined
            ? forceState
            : notificationPanel.classList.contains("hidden");

    if (shouldShow) {
        notificationPanel.classList.remove("hidden");
        // Close on outside click
        setTimeout(() => {
            document.addEventListener(
                "click",
                handleNotificationOutsideClick,
                true
            );
        }, 0);
    } else {
        notificationPanel.classList.add("hidden");
        document.removeEventListener(
            "click",
            handleNotificationOutsideClick,
            true
        );
    }
}

function handleNotificationOutsideClick(event) {
    const notificationWrapper = document.getElementById("notification-wrapper");
    if (
        notificationWrapper &&
        notificationWrapper.contains(event.target)
    ) {
        return;
    }
    toggleNotificationPanel(false);
}

// Cleanup notification subscription on page unload
window.addEventListener("beforeunload", () => {
    if (notificationState.channel) {
        unsubscribeFromNotifications(notificationState.channel);
        notificationState.channel = null;
    }
});

// Make functions globally available
window.navigateToSection = navigateToSection;
window.toggleSidebar = toggleSidebar;
window.refreshAllData = refreshAllData;
window.logout = logout;
window.loadDisputes = loadDisputes;
window.applyDisputeFilters = applyDisputeFilters;
window.clearDisputeFilters = clearDisputeFilters;
window.refreshDisputes = refreshDisputes;
window.viewDisputeDetails = viewDisputeDetails;
window.closeDisputeModal = closeDisputeModal;
window.openResolveModal = openResolveModal;
window.closeResolveModal = closeResolveModal;
window.confirmResolveDispute = confirmResolveDispute;

