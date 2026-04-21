// admin-dashboard-simplified.js - Simplified Admin Dashboard
import { supabase } from "./supabase-auth.js";
import { 
    getAllDisputes, 
    updateDisputeStatus, 
    getDisputeEvidenceSignedUrl,
    getAllUsersWithStats,
    getUserDetails,
    getUserActivities
} from "./supabase-auth.js";
import {
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadNotificationCount,
    subscribeToNotifications,
    unsubscribeFromNotifications,
    injectNotificationStyles,
    displayNotification,
    normalizeNotificationReadStatus,
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

// User management state
let allUsers = [];
let filteredUsers = [];
let currentUserFilters = {
    role: '',
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc'
};
let currentPage = 1;
let usersPerPage = 20;
let usersRealtimeChannel = null;

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
    try {
        await initializeAuth();
        await loadDashboardData();

        // Preload key admin sections so their tabs feel responsive
        // (errors are already handled inside these functions)
        await Promise.allSettled([
            loadDisputes(),
            loadUsers(),
        ]);

        setupEventListeners();
        updateStats();
    } catch (error) {
        console.error('Error initializing admin dashboard:', error);
        showNotification('Failed to initialize admin dashboard. Please refresh the page.', 'error');
    }
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
            .select('id, name, email, created_at')
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
            .select('id, amount_ngn, created_at, profiles(name, email)')
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
    console.log('navigateToSection called with:', sectionId);
    
    if (!sectionId) {
        console.error('navigateToSection: sectionId is missing');
        return;
    }

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItem = document.querySelector(`[data-section="${sectionId}"]`);
    if (navItem) {
        navItem.classList.add('active');
        console.log('Nav item activated:', sectionId);
    } else {
        console.error('Nav item not found for section:', sectionId);
    }

    // Show section
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        console.log('Section activated:', sectionId);
        
        // Load section-specific data
        if (sectionId === 'disputes') {
            loadDisputes();
        } else if (sectionId === 'users') {
            loadUsers();
        } else if (sectionId === 'contact-requests') {
            loadContactRequests();
        }
    } else {
        console.error('Target section not found:', sectionId);
    }

    // Close mobile sidebar if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
}

// Make navigateToSection available globally immediately
window.navigateToSection = navigateToSection;

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
    
    content.innerHTML = `
        <div>${message}</div>
        <a href="contact-form.html" style="display: block; margin-top: 8px; font-size: 12px; text-decoration: underline;">
            For any issues, contact us
        </a>
    `;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    console.log('Found nav items:', navItems.length);
    
    navItems.forEach((item, index) => {
        const sectionId = item.dataset.section;
        console.log(`Setting up listener for nav item ${index}:`, sectionId);
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Nav item clicked:', sectionId);
            const clickedSectionId = item.dataset.section;
            if (clickedSectionId) {
                navigateToSection(clickedSectionId);
            } else {
                console.error('No data-section attribute found on clicked item');
            }
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

    // Handle Enter key in search inputs
    const userSearchInput = document.getElementById('user-search-input');
    if (userSearchInput) {
        userSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyUserFilters();
            }
        });
    }

    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        const disputeModal = document.getElementById('dispute-detail-modal');
        const resolveModal = document.getElementById('resolve-dispute-modal');
        const userDetailModal = document.getElementById('user-detail-modal');
        
        if (disputeModal && e.target === disputeModal) {
            closeDisputeModal();
        }
        
        if (resolveModal && e.target === resolveModal) {
            closeResolveModal();
        }
        
        if (userDetailModal && e.target === userDetailModal) {
            closeUserDetailModal();
        }
    });

    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDisputeModal();
            closeResolveModal();
            closeUserDetailModal();
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
                // Optimistically update UI first for better UX
                notificationState.items = notificationState.items.map(
                    (item) => ({ ...item, is_read: true })
                );
                notificationState.unreadCount = 0;
                renderNotificationList();
                updateNotificationBadge(); // This will hide the red dot immediately

                // Then update in database
                await markAllNotificationsAsRead(notificationState.userId);
                
                // Refresh from server to ensure sync
                await refreshNotifications();
            } catch (error) {
                console.error("Failed to mark all notifications:", error);
                
                // Revert optimistic update on error
                await refreshNotifications();
                
                // Show user-friendly error message
                const errorMsg = error?.message?.includes("schema cache") || error?.message?.includes("is_read")
                    ? "Database schema issue detected. Please check console for details."
                    : "Unable to mark notifications as read right now.";
                showNotification(errorMsg, "error");
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
            // Optimistically update UI first for better UX
            const notificationItem = notificationState.items.find(item => item.id === notificationId);
            if (notificationItem && !notificationItem.is_read) {
                // Update local state immediately
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
                updateNotificationBadge(); // This will hide the red dot if unreadCount becomes 0
            }

            // Then update in database
            await markNotificationAsRead(notificationId);
            
            // Refresh from server to ensure sync (handles any edge cases)
            await refreshNotifications();
        } catch (error) {
            console.error("Failed to update notification:", error);
            
            // Revert optimistic update on error
            await refreshNotifications();
            
            // Show user-friendly error message
            const errorMsg = error?.message?.includes("schema cache") || error?.message?.includes("is_read")
                ? "Database schema issue detected. Please check console for details."
                : "Could not update notification";
            showNotification(errorMsg, "error");
        }
    });

    // Subscribe to real-time notifications
    notificationState.channel = subscribeToNotifications(
        notificationState.userId,
        {
            onInsert: handleIncomingNotification,
            onUpdate: async (newNotification, oldNotification) => {
                // Refresh notifications when updated (e.g., marked as read)
                // This ensures the red dot updates in real-time across tabs/devices
                await refreshNotifications();
            },
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
    // Normalize notification to ensure consistent 'is_read' property
    const normalizedNotification = normalizeNotificationReadStatus(notification);
    
    notificationState.items = [normalizedNotification, ...notificationState.items].slice(
        0,
        20
    );
    notificationState.unreadCount += 1;
    renderNotificationList();
    updateNotificationBadge();

    try {
        displayNotification(normalizedNotification);
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
    const notificationDot = document.getElementById("notification-dot");

    if (notificationState.unreadCount > 0) {
        notificationBadge.textContent =
            notificationState.unreadCount > 9
                ? "9+"
                : notificationState.unreadCount.toString();
        notificationBadge.classList.remove("hidden");
        // Show red dot when there are unread notifications
        if (notificationDot) {
            notificationDot.classList.remove("hidden");
        }
    } else {
        notificationBadge.classList.add("hidden");
        // Hide red dot when all notifications are read
        if (notificationDot) {
            notificationDot.classList.add("hidden");
        }
    }
}

function toggleNotificationPanel(forceState) {
    const notificationPanel = document.getElementById("notification-panel");
    const notificationBell = document.getElementById("notification-bell");
    const notificationWrapper = document.getElementById("notification-wrapper");
    if (!notificationPanel) return;

    const shouldShow =
        forceState !== undefined
            ? forceState
            : notificationPanel.classList.contains("hidden");

    if (shouldShow) {
        notificationPanel.classList.remove("hidden");
        
        // Mobile positioning fix: ensure dropdown is positioned correctly on small screens
        if (window.innerWidth <= 640 && notificationBell && notificationWrapper) {
            const bellRect = notificationBell.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const panelWidth = Math.min(380, viewportWidth * 0.92);
            
            // Position dropdown so its right edge aligns with bell's right edge
            notificationPanel.style.position = 'fixed';
            notificationPanel.style.right = `${viewportWidth - bellRect.right}px`;
            notificationPanel.style.left = 'auto';
            notificationPanel.style.top = `${bellRect.bottom + 8}px`;
            notificationPanel.style.width = `${panelWidth}px`;
            notificationPanel.style.maxWidth = '380px';
            notificationPanel.style.transform = 'none';
        }
        
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
        // Reset inline styles when closing
        if (window.innerWidth <= 640) {
            notificationPanel.style.position = '';
            notificationPanel.style.right = '';
            notificationPanel.style.left = '';
            notificationPanel.style.top = '';
            notificationPanel.style.width = '';
            notificationPanel.style.maxWidth = '';
            notificationPanel.style.transform = '';
        }
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

// ==================== USER MANAGEMENT FUNCTIONS ====================

// Load users data
async function loadUsers() {
    try {
        const container = document.getElementById('users-container');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748b;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 16px;"></i>
                <p>Loading users...</p>
            </div>
        `;

        const offset = (currentPage - 1) * usersPerPage;
        const result = await getAllUsersWithStats(
            currentUserFilters.role || null,
            usersPerPage,
            offset,
            currentUserFilters.search
        );

        allUsers = result.users || [];
        filteredUsers = [...allUsers];

        updateUsersStats();
        displayUsers();
        setupUsersRealtime();

    } catch (error) {
        console.error('Error loading users:', error);
        const container = document.getElementById('users-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 16px;"></i>
                    <p>Failed to load users: ${error.message}</p>
                    <button onclick="loadUsers()" class="btn btn-primary" style="margin-top: 16px; padding: 10px 16px; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 500; cursor: pointer; background: #3b82f6; color: white;">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
        }
        showNotification('Failed to load users', 'error');
    }
}

// Update user statistics
function updateUsersStats() {
    const totalUsers = allUsers.length;
    const totalMembers = allUsers.filter(u => u.role === 'member').length;
    const totalApprentices = allUsers.filter(u => u.role === 'apprentice').length;
    const activeUsers = allUsers.filter(u => {
        const lastActivity = u.stats?.lastActivity;
        if (!lastActivity) return false;
        const daysSinceActivity = (new Date() - new Date(lastActivity)) / (1000 * 60 * 60 * 24);
        return daysSinceActivity <= 30;
    }).length;

    const totalEl = document.getElementById('users-total-count');
    const membersEl = document.getElementById('users-members-count');
    const apprenticesEl = document.getElementById('users-apprentices-count');
    const activeEl = document.getElementById('users-active-count');

    if (totalEl) totalEl.textContent = totalUsers;
    if (membersEl) membersEl.textContent = totalMembers;
    if (apprenticesEl) apprenticesEl.textContent = totalApprentices;
    if (activeEl) activeEl.textContent = activeUsers;
}

// Display users
function displayUsers() {
    const container = document.getElementById('users-container');
    if (!container) return;

    if (filteredUsers.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #64748b;">
                <i class="fas fa-inbox" style="font-size: 4rem; margin-bottom: 16px; color: #cbd5e1;"></i>
                <h3 style="font-size: 1.5rem; margin-bottom: 8px; color: #374151;">No Users Found</h3>
                <p>No users match your current filters.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredUsers.map(user => {
        const stats = user.stats || {};
        const roleColor = user.role === 'apprentice' 
            ? { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' }
            : { bg: '#d1fae5', text: '#065f46', border: '#10b981' };
        
        const avatarInitials = (user.name || user.email || 'U')
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);

        const wallet = user.wallet && user.wallet[0] ? user.wallet[0] : null;

        return `
            <div class="user-card" style="border: 1px solid #e5e7eb; border-left: 4px solid ${roleColor.border}; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: white; transition: all 0.2s; cursor: pointer;" 
                 onclick="viewUserDetails('${user.id}')"
                 onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
                 onmouseout="this.style.boxShadow='none'">
                <div style="display: flex; gap: 16px; align-items: flex-start;">
                    <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1.25rem; flex-shrink: 0;">
                        ${avatarInitials}
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                            <div>
                                <h3 style="font-size: 1.1rem; font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                                    ${user.full_name || user.name || user.email || 'No Name'}
                                </h3>
                                <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 4px;">
                                    ${user.email || 'No email'}
                                </p>
                                ${user.username ? `<p style="color: #94a3b8; font-size: 0.85rem;">@${user.username}</p>` : ''}
                            </div>
                            <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; background: ${roleColor.bg}; color: ${roleColor.text};">
                                ${user.role === 'apprentice' ? 'Apprentice' : 'Member'}
                            </span>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 12px; padding: 12px; background: #f8fafc; border-radius: 8px;">
                            ${user.role === 'apprentice' ? `
                                <div>
                                    <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Jobs</div>
                                    <div style="font-size: 0.9rem; color: #1e293b; font-weight: 600;">${stats.totalJobs || 0}</div>
                                </div>
                                <div>
                                    <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Applications</div>
                                    <div style="font-size: 0.9rem; color: #1e293b; font-weight: 600;">${stats.totalApplications || 0}</div>
                                </div>
                                <div>
                                    <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Earnings</div>
                                    <div style="font-size: 0.9rem; color: #1e293b; font-weight: 600;">₦${(stats.totalEarnings || 0).toLocaleString()}</div>
                                </div>
                            ` : `
                                <div>
                                    <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Jobs Created</div>
                                    <div style="font-size: 0.9rem; color: #1e293b; font-weight: 600;">${stats.totalJobs || 0}</div>
                                </div>
                                <div>
                                    <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Total Spent</div>
                                    <div style="font-size: 0.9rem; color: #1e293b; font-weight: 600;">₦${(stats.totalSpent || 0).toLocaleString()}</div>
                                </div>
                                <div>
                                    <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Active Jobs</div>
                                    <div style="font-size: 0.9rem; color: #1e293b; font-weight: 600;">${stats.activeJobs || 0}</div>
                                </div>
                            `}
                            <div>
                                <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Wallet Balance</div>
                                <div style="font-size: 0.9rem; color: #1e293b; font-weight: 600;">₦${(wallet?.balance_ngn || stats.walletBalance || 0).toLocaleString()}</div>
                            </div>
                            ${stats.lastActivity ? `
                                <div>
                                    <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">Last Activity</div>
                                    <div style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${formatTimeAgo(stats.lastActivity)}</div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                    <button onclick="event.stopPropagation(); viewUserDetails('${user.id}')" 
                            class="btn btn-primary" 
                            style="padding: 8px 16px; border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 500; cursor: pointer; background: #3b82f6; color: white;">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Add pagination if needed
    updateUsersPagination();
}

// Setup real-time subscription for users
function setupUsersRealtime() {
    // Cleanup existing subscription
    if (usersRealtimeChannel) {
        supabase.removeChannel(usersRealtimeChannel);
        usersRealtimeChannel = null;
    }

    // Subscribe to profile changes
    usersRealtimeChannel = supabase
        .channel('admin-users-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'profiles'
            },
            (payload) => {
                console.log('User change detected:', payload);
                // Reload users when there's a change
                loadUsers();
            }
        )
        .subscribe();
}

// Apply user filters
function applyUserFilters() {
    const role = document.getElementById('user-role-filter')?.value || '';
    const search = document.getElementById('user-search-input')?.value || '';
    
    currentUserFilters.role = role;
    currentUserFilters.search = search;
    currentPage = 1;
    
    loadUsers();
}

// Clear user filters
function clearUserFilters() {
    if (document.getElementById('user-role-filter')) document.getElementById('user-role-filter').value = '';
    if (document.getElementById('user-search-input')) document.getElementById('user-search-input').value = '';
    
    currentUserFilters = {
        role: '',
        search: '',
        sortBy: 'created_at',
        sortOrder: 'desc'
    };
    currentPage = 1;
    
    loadUsers();
}

// Update pagination
function updateUsersPagination() {
    // This would need total count from the API - simplified for now
    const paginationEl = document.getElementById('users-pagination');
    if (paginationEl) {
        paginationEl.innerHTML = `
            <div style="display: flex; justify-content: center; gap: 8px; margin-top: 20px;">
                <button onclick="changeUsersPage(${currentPage - 1})" 
                        ${currentPage <= 1 ? 'disabled' : ''}
                        class="btn btn-secondary" 
                        style="padding: 8px 16px; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 500; cursor: pointer; background: #6b7280; color: white; ${currentPage <= 1 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                <span style="padding: 8px 16px; display: flex; align-items: center; color: #64748b;">
                    Page ${currentPage}
                </span>
                <button onclick="changeUsersPage(${currentPage + 1})" 
                        ${filteredUsers.length < usersPerPage ? 'disabled' : ''}
                        class="btn btn-secondary" 
                        style="padding: 8px 16px; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 500; cursor: pointer; background: #6b7280; color: white; ${filteredUsers.length < usersPerPage ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
    }
}

// Change users page
function changeUsersPage(page) {
    if (page < 1) return;
    currentPage = page;
    loadUsers();
}

// View user details
async function viewUserDetails(userId) {
    try {
        showNotification('Loading user details...', 'info');
        const userDetails = await getUserDetails(userId);
        
        const modal = document.getElementById('user-detail-modal');
        const content = document.getElementById('user-detail-content');
        
        if (!modal || !content) {
            showNotification('Modal elements not found', 'error');
            return;
        }

        const { profile, stats, activities, wallet, recentTransactions } = userDetails;
        const roleColor = profile.role === 'apprentice' 
            ? { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' }
            : { bg: '#d1fae5', text: '#065f46', border: '#10b981' };

        content.innerHTML = `
            <div style="display: grid; gap: 24px;">
                <!-- Profile Header -->
                <div style="display: flex; gap: 20px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid ${roleColor.border};">
                    <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 2rem; flex-shrink: 0;">
                        ${(profile.full_name || profile.name || profile.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <h3 style="font-size: 1.5rem; font-weight: 600; color: #1e293b; margin-bottom: 8px;">
                            ${profile.full_name || profile.name || profile.email || 'No Name'}
                        </h3>
                        <p style="color: #64748b; margin-bottom: 4px;">${profile.email || 'No email'}</p>
                        ${profile.username ? `<p style="color: #94a3b8;">@${profile.username}</p>` : ''}
                        <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 500; background: ${roleColor.bg}; color: ${roleColor.text}; margin-top: 8px;">
                            ${profile.role === 'apprentice' ? 'Apprentice' : 'Member'}
                        </span>
                    </div>
                </div>

                <!-- Statistics -->
                <div>
                    <h4 style="margin-bottom: 16px; color: #1e293b; font-size: 1.1rem; font-weight: 600;">Statistics</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                        ${profile.role === 'apprentice' ? `
                            <div style="padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 8px;">Total Jobs</div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: #1e293b;">${stats.totalJobs || 0}</div>
                            </div>
                            <div style="padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 8px;">Applications</div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: #1e293b;">${stats.totalApplications || 0}</div>
                            </div>
                            <div style="padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 8px;">Total Earnings</div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: #10b981;">₦${(stats.totalEarnings || 0).toLocaleString()}</div>
                            </div>
                        ` : `
                            <div style="padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 8px;">Jobs Created</div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: #1e293b;">${stats.totalJobs || 0}</div>
                            </div>
                            <div style="padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 8px;">Total Spent</div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: #ef4444;">₦${(stats.totalSpent || 0).toLocaleString()}</div>
                            </div>
                            <div style="padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 8px;">Active Jobs</div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: #1e293b;">${stats.activeJobs || 0}</div>
                            </div>
                        `}
                        <div style="padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 8px;">Wallet Balance</div>
                            <div style="font-size: 1.5rem; font-weight: 600; color: #1e293b;">₦${(wallet?.balance_ngn || stats.walletBalance || 0).toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                <!-- Activities Timeline -->
                <div>
                    <h4 style="margin-bottom: 16px; color: #1e293b; font-size: 1.1rem; font-weight: 600;">Recent Activities</h4>
                    <div style="max-height: 400px; overflow-y: auto; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                        ${activities.length > 0 ? activities.map(activity => `
                            <div style="display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid #f1f5f9; align-items: flex-start;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${getActivityColor(activity.type)}; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
                                    <i class="fas fa-${getActivityIcon(activity.type)}"></i>
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 500; color: #1e293b; margin-bottom: 4px;">${activity.title}</div>
                                    <div style="font-size: 0.85rem; color: #64748b;">${formatTimeAgo(activity.timestamp)}</div>
                                </div>
                                <span style="padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; background: #f1f5f9; color: #64748b;">
                                    ${activity.status}
                                </span>
                            </div>
                        `).join('') : '<p style="text-align: center; color: #64748b; padding: 20px;">No activities found</p>'}
                    </div>
                </div>

                <!-- Profile Details -->
                <div>
                    <h4 style="margin-bottom: 16px; color: #1e293b; font-size: 1.1rem; font-weight: 600;">Profile Information</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                        <div>
                            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;">Phone</div>
                            <div style="color: #1e293b; font-weight: 500;">${profile.phone || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;">Location</div>
                            <div style="color: #1e293b; font-weight: 500;">${profile.location || profile.business_location || 'N/A'}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;">Joined</div>
                            <div style="color: #1e293b; font-weight: 500;">${new Date(profile.created_at).toLocaleDateString()}</div>
                        </div>
                        ${profile.role === 'apprentice' ? `
                            <div>
                                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;">Skill Category</div>
                                <div style="color: #1e293b; font-weight: 500;">${profile.skill_category || profile.skill || 'N/A'}</div>
                            </div>
                        ` : `
                            <div>
                                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 4px;">Business Name</div>
                                <div style="color: #1e293b; font-weight: 500;">${profile.business_name || 'N/A'}</div>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        
    } catch (error) {
        console.error('Error loading user details:', error);
        showNotification(`Failed to load user details: ${error.message}`, 'error');
    }
}

// Helper functions for activities
function getActivityIcon(type) {
    const icons = {
        'job': 'briefcase',
        'application': 'file-alt',
        'transaction': 'money-bill-wave'
    };
    return icons[type] || 'circle';
}

function getActivityColor(type) {
    const colors = {
        'job': '#3b82f6',
        'application': '#10b981',
        'transaction': '#f59e0b'
    };
    return colors[type] || '#6b7280';
}

// Close user detail modal
function closeUserDetailModal() {
    const modal = document.getElementById('user-detail-modal');
    if (modal) modal.style.display = 'none';
}

// Refresh users
function refreshUsers() {
    loadUsers();
    showNotification('Users refreshed', 'success');
}

// Cleanup realtime on page unload
window.addEventListener('beforeunload', () => {
    if (usersRealtimeChannel) {
        supabase.removeChannel(usersRealtimeChannel);
        usersRealtimeChannel = null;
    }
});

// Make remaining functions globally available (navigateToSection already assigned above)
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
window.loadUsers = loadUsers;
window.applyUserFilters = applyUserFilters;
window.clearUserFilters = clearUserFilters;
window.changeUsersPage = changeUsersPage;
window.viewUserDetails = viewUserDetails;
window.closeUserDetailModal = closeUserDetailModal;
window.refreshUsers = refreshUsers;

// ==================== CONTACT REQUESTS FUNCTIONS ====================

let allContactRequests = [];
let filteredContactRequests = [];
let currentContactRequestFilters = {
    status: '',
    category: '',
    search: ''
};

// Load contact requests
async function loadContactRequests() {
    try {
        const container = document.getElementById('contact-requests-container');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748b;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 16px;"></i>
                <p>Loading contact requests...</p>
            </div>
        `;

        const { data, error } = await supabase
            .from('contact_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allContactRequests = data || [];
        filteredContactRequests = [...allContactRequests];

        updateContactRequestStats();
        displayContactRequests();

    } catch (error) {
        console.error('Error loading contact requests:', error);
        const container = document.getElementById('contact-requests-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 16px;"></i>
                    <p>Failed to load contact requests: ${error.message}</p>
                    <button onclick="loadContactRequests()" class="btn btn-primary" style="margin-top: 16px; padding: 10px 16px; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 500; cursor: pointer; background: #3b82f6; color: white;">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
        }
        showNotification('Failed to load contact requests', 'error');
    }
}

// Update contact request statistics
function updateContactRequestStats() {
    const pending = allContactRequests.filter(r => r.status === 'pending').length;
    const inProgress = allContactRequests.filter(r => r.status === 'in_progress').length;
    const resolved = allContactRequests.filter(r => r.status === 'resolved').length;
    const closed = allContactRequests.filter(r => r.status === 'closed').length;

    const pendingEl = document.getElementById('contact-requests-pending-count');
    const inProgressEl = document.getElementById('contact-requests-in-progress-count');
    const resolvedEl = document.getElementById('contact-requests-resolved-count');
    const closedEl = document.getElementById('contact-requests-closed-count');

    if (pendingEl) pendingEl.textContent = pending;
    if (inProgressEl) inProgressEl.textContent = inProgress;
    if (resolvedEl) resolvedEl.textContent = resolved;
    if (closedEl) closedEl.textContent = closed;
}

// Display contact requests
function displayContactRequests() {
    const container = document.getElementById('contact-requests-container');
    if (!container) return;

    if (filteredContactRequests.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #64748b;">
                <i class="fas fa-inbox" style="font-size: 4rem; margin-bottom: 16px; color: #cbd5e1;"></i>
                <h3 style="font-size: 1.5rem; margin-bottom: 8px; color: #374151;">No Contact Requests Found</h3>
                <p>No contact requests match your current filters.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredContactRequests.map(request => {
        const statusColors = {
            pending: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
            in_progress: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
            resolved: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
            closed: { bg: '#f3f4f6', text: '#374151', border: '#6b7280' }
        };

        const categoryColors = {
            'Payment Issue': '#ef4444',
            'Job Issue': '#3b82f6',
            'Dispute': '#f59e0b',
            'Account Issue': '#8b5cf6',
            'Refund Request': '#10b981',
            'Other': '#6b7280'
        };

        const statusColor = statusColors[request.status] || statusColors.pending;
        const categoryColor = categoryColors[request.issue_category] || '#6b7280';
        const createdDate = new Date(request.created_at).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="contact-request-card" style="border: 1px solid #e5e7eb; border-left: 4px solid ${statusColor.border}; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: white; transition: all 0.2s; cursor: pointer;" 
                 onclick="viewContactRequestDetails('${request.id}')"
                 onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
                 onmouseout="this.style.boxShadow='none'">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                            <h3 style="font-size: 1.1rem; font-weight: 600; color: #111827; margin: 0;">${request.subject}</h3>
                            <span style="padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; background: ${statusColor.bg}; color: ${statusColor.text};">
                                ${request.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <span style="padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; background: ${categoryColor}20; color: ${categoryColor};">
                                ${request.issue_category}
                            </span>
                        </div>
                        <p style="color: #6b7280; font-size: 0.9rem; margin: 0 0 8px 0; line-height: 1.5;">
                            ${request.message.length > 150 ? request.message.substring(0, 150) + '...' : request.message}
                        </p>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                    <div style="display: flex; gap: 16px; color: #6b7280; font-size: 0.875rem;">
                        <span><i class="fas fa-user"></i> ${request.full_name}</span>
                        <span><i class="fas fa-envelope"></i> ${request.email}</span>
                        ${request.phone ? `<span><i class="fas fa-phone"></i> ${request.phone}</span>` : ''}
                    </div>
                    <div style="color: #9ca3af; font-size: 0.875rem;">
                        <i class="fas fa-clock"></i> ${createdDate}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Apply filters
function applyContactRequestFilters() {
    const statusFilter = document.getElementById('contact-request-status-filter')?.value || '';
    const categoryFilter = document.getElementById('contact-request-category-filter')?.value || '';
    const searchFilter = document.getElementById('contact-request-search-input')?.value.toLowerCase() || '';

    currentContactRequestFilters = {
        status: statusFilter,
        category: categoryFilter,
        search: searchFilter
    };

    filteredContactRequests = allContactRequests.filter(request => {
        const matchesStatus = !statusFilter || request.status === statusFilter;
        const matchesCategory = !categoryFilter || request.issue_category === categoryFilter;
        const matchesSearch = !searchFilter || 
            request.full_name.toLowerCase().includes(searchFilter) ||
            request.email.toLowerCase().includes(searchFilter) ||
            request.subject.toLowerCase().includes(searchFilter) ||
            request.message.toLowerCase().includes(searchFilter);

        return matchesStatus && matchesCategory && matchesSearch;
    });

    displayContactRequests();
}

// Clear filters
function clearContactRequestFilters() {
    document.getElementById('contact-request-status-filter').value = '';
    document.getElementById('contact-request-category-filter').value = '';
    document.getElementById('contact-request-search-input').value = '';
    
    currentContactRequestFilters = {
        status: '',
        category: '',
        search: ''
    };

    filteredContactRequests = [...allContactRequests];
    displayContactRequests();
}

// View contact request details
async function viewContactRequestDetails(requestId) {
    try {
        const request = allContactRequests.find(r => r.id === requestId);
        if (!request) {
            showNotification('Contact request not found', 'error');
            return;
        }

        const statusColors = {
            pending: { bg: '#fef3c7', text: '#92400e' },
            in_progress: { bg: '#dbeafe', text: '#1e40af' },
            resolved: { bg: '#d1fae5', text: '#065f46' },
            closed: { bg: '#f3f4f6', text: '#374151' }
        };

        const statusColor = statusColors[request.status] || statusColors.pending;
        const createdDate = new Date(request.created_at).toLocaleString('en-US');
        const updatedDate = request.updated_at ? new Date(request.updated_at).toLocaleString('en-US') : 'N/A';
        const resolvedDate = request.resolved_at ? new Date(request.resolved_at).toLocaleString('en-US') : 'N/A';

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'contact-request-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;';
        modal.onclick = (e) => {
            if (e.target === modal) closeContactRequestModal();
        };

        modal.innerHTML = `
            <div class="modal-content" style="background: white; border-radius: 12px; padding: 30px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative;">
                <button onclick="closeContactRequestModal()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; font-size: 1.5rem; color: #6b7280; cursor: pointer; padding: 8px;">
                    <i class="fas fa-times"></i>
                </button>
                
                <div style="margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                        <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin: 0;">${request.subject}</h2>
                        <span style="padding: 6px 16px; border-radius: 12px; font-size: 0.875rem; font-weight: 500; background: ${statusColor.bg}; color: ${statusColor.text};">
                            ${request.status.replace('_', ' ').toUpperCase()}
                        </span>
                    </div>
                    <div style="display: flex; gap: 16px; color: #6b7280; font-size: 0.875rem; flex-wrap: wrap;">
                        <span><i class="fas fa-tag"></i> ${request.issue_category}</span>
                        <span><i class="fas fa-calendar"></i> Created: ${createdDate}</span>
                        <span><i class="fas fa-edit"></i> Updated: ${updatedDate}</span>
                        ${request.resolved_at ? `<span><i class="fas fa-check-circle"></i> Resolved: ${resolvedDate}</span>` : ''}
                    </div>
                </div>

                <div style="margin-bottom: 24px; padding: 20px; background: #f9fafb; border-radius: 8px;">
                    <h3 style="font-size: 1rem; font-weight: 600; color: #374151; margin-bottom: 12px;">Contact Information</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                        <div>
                            <div style="font-size: 0.75rem; color: #6b7280; margin-bottom: 4px;">Full Name</div>
                            <div style="font-weight: 500; color: #111827;">${request.full_name}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: #6b7280; margin-bottom: 4px;">Email</div>
                            <div style="font-weight: 500; color: #111827;">${request.email}</div>
                        </div>
                        ${request.phone ? `
                        <div>
                            <div style="font-size: 0.75rem; color: #6b7280; margin-bottom: 4px;">Phone</div>
                            <div style="font-weight: 500; color: #111827;">${request.phone}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 1rem; font-weight: 600; color: #374151; margin-bottom: 12px;">Message</h3>
                    <div style="padding: 16px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; white-space: pre-wrap; line-height: 1.6; color: #374151;">
                        ${request.message}
                    </div>
                </div>

                ${request.attachment_url ? `
                <div style="margin-bottom: 24px;">
                    <h3 style="font-size: 1rem; font-weight: 600; color: #374151; margin-bottom: 12px;">Attachment</h3>
                    <a href="${request.attachment_url}" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 16px; background: #3b82f6; color: white; border-radius: 8px; text-decoration: none; font-weight: 500;">
                        <i class="fas fa-paperclip"></i> View Attachment
                    </a>
                </div>
                ` : ''}

                ${request.admin_notes ? `
                <div style="margin-bottom: 24px; padding: 16px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px;">
                    <h3 style="font-size: 1rem; font-weight: 600; color: #92400e; margin-bottom: 8px;">Admin Notes</h3>
                    <div style="color: #78350f; white-space: pre-wrap;">${request.admin_notes}</div>
                </div>
                ` : ''}

                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <button onclick="updateContactRequestStatus('${request.id}', 'in_progress')" 
                            ${request.status !== 'pending' ? 'disabled' : ''}
                            style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; ${request.status !== 'pending' ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                        <i class="fas fa-play"></i> Mark In Progress
                    </button>
                    <button onclick="updateContactRequestStatus('${request.id}', 'resolved')" 
                            ${request.status === 'resolved' || request.status === 'closed' ? 'disabled' : ''}
                            style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; ${request.status === 'resolved' || request.status === 'closed' ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                        <i class="fas fa-check"></i> Mark Resolved
                    </button>
                    <button onclick="updateContactRequestStatus('${request.id}', 'closed')" 
                            ${request.status === 'closed' ? 'disabled' : ''}
                            style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; ${request.status === 'closed' ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                        <i class="fas fa-times"></i> Close
                    </button>
                    <button onclick="openAddAdminNotesModal('${request.id}')" 
                            style="padding: 10px 20px; background: #f59e0b; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">
                        <i class="fas fa-sticky-note"></i> Add Notes
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error viewing contact request details:', error);
        showNotification('Failed to load contact request details', 'error');
    }
}

// Close contact request modal
function closeContactRequestModal() {
    const modal = document.getElementById('contact-request-modal');
    if (modal) {
        modal.remove();
    }
}

// Update contact request status
async function updateContactRequestStatus(requestId, newStatus) {
    try {
        const updateData = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };

        if (newStatus === 'resolved') {
            updateData.resolved_at = new Date().toISOString();
        }

        const { error } = await supabase
            .from('contact_requests')
            .update(updateData)
            .eq('id', requestId);

        if (error) throw error;

        showNotification(`Contact request status updated to ${newStatus.replace('_', ' ')}`, 'success');
        
        // Reload contact requests
        await loadContactRequests();
        
        // Close modal if open
        closeContactRequestModal();
    } catch (error) {
        console.error('Error updating contact request status:', error);
        showNotification('Failed to update contact request status', 'error');
    }
}

// Open add admin notes modal
function openAddAdminNotesModal(requestId) {
    const request = allContactRequests.find(r => r.id === requestId);
    if (!request) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'admin-notes-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; align-items: center; justify-content: center; padding: 20px;';
    modal.onclick = (e) => {
        if (e.target === modal) closeAdminNotesModal();
    };

    modal.innerHTML = `
        <div class="modal-content" style="background: white; border-radius: 12px; padding: 30px; max-width: 600px; width: 100%; position: relative;">
            <button onclick="closeAdminNotesModal()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; font-size: 1.5rem; color: #6b7280; cursor: pointer; padding: 8px;">
                <i class="fas fa-times"></i>
            </button>
            
            <h2 style="font-size: 1.5rem; font-weight: 600; color: #111827; margin-bottom: 20px;">Add Admin Notes</h2>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 8px;">Notes</label>
                <textarea id="admin-notes-textarea" rows="6" style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.9rem; resize: vertical;">${request.admin_notes || ''}</textarea>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button onclick="closeAdminNotesModal()" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">
                    Cancel
                </button>
                <button onclick="saveAdminNotes('${requestId}')" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer;">
                    Save Notes
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Close admin notes modal
function closeAdminNotesModal() {
    const modal = document.getElementById('admin-notes-modal');
    if (modal) {
        modal.remove();
    }
}

// Save admin notes
async function saveAdminNotes(requestId) {
    try {
        const notes = document.getElementById('admin-notes-textarea')?.value || '';

        const { error } = await supabase
            .from('contact_requests')
            .update({
                admin_notes: notes,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (error) throw error;

        showNotification('Admin notes saved successfully', 'success');
        
        // Reload contact requests
        await loadContactRequests();
        
        // Close modals
        closeAdminNotesModal();
        closeContactRequestModal();
    } catch (error) {
        console.error('Error saving admin notes:', error);
        showNotification('Failed to save admin notes', 'error');
    }
}

// Make functions globally available
window.loadContactRequests = loadContactRequests;
window.applyContactRequestFilters = applyContactRequestFilters;
window.clearContactRequestFilters = clearContactRequestFilters;
window.viewContactRequestDetails = viewContactRequestDetails;
window.closeContactRequestModal = closeContactRequestModal;
window.updateContactRequestStatus = updateContactRequestStatus;
window.openAddAdminNotesModal = openAddAdminNotesModal;
window.closeAdminNotesModal = closeAdminNotesModal;
window.saveAdminNotes = saveAdminNotes;

