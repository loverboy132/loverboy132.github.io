// dashboard-supabase.js - Fixed version
console.log('📄 Dashboard script file loaded');

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
            SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZmZkbGNpd3J2dXljbnNnZXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMjUzMzQsImV4cCI6MjA3MDYwMTMzNH0.bBPsRDAljy2WDkw9K6faOFDYrJ7F8EJT5F4cqdI4MQQ",
            FLUTTERWAVE_FUNCTION_URL: "https://xmffdlciwrvuycnsgezb.functions.supabase.co/flutterwave-init-payment",
            SITE_URL: "https://loverboy132.github.io",
        };
    }
}
import {
    supabase,
    handleLogout,
    getUserProfile,
    updateUserProfile,
    incrementUserPoints,
    addPost,
    getUserPosts,
    deletePost,
    togglePostLike,
    checkUserLike,
    getUsersByRole,
    searchUsers,
    getTopUsers,
    getTrendingCreators,
    followUser,
    getFileUrl,
    checkStorageBucket,
    createJobRequest,
    deleteJobRequest,
    getAllJobRequests,
    getClientJobRequests,
    getApprenticeJobApplications,
    applyForJob,
    updateApplicationStatus,
    updateJobProgress,
    completeJob,
    getApprenticeStats,
    getClientStats,
    getUserPostsById,
    generateReferralCode,
    getUserReferralCode,
    getUserReferralStats,
    getJobsPendingReview,
    reviewJob,
    submitProgressUpdate,
    getProgressUpdates,
    submitProgressUpdateFeedback,
    submitFinalWork,
    getFinalSubmissions,
    submitFinalSubmissionFeedback,
    getPendingProgressUpdates,
    getPendingFinalSubmissions,
    autoAcknowledgeProgressUpdates,
    submitRating,
    getApprenticeRatingDetails,
    canRateApprentice,
    getJobRatings,
    updateRating,
    deleteRating,
    getReferralWallet,
    getReferralEarnings,
    getWithdrawalRequests,
    isWithdrawalWindowOpen,
    createWithdrawalRequest,
    convertPointsToCurrency,
    submitDispute,
    getUserDisputes,
    isProfileCompleted,
    uploadAvatar,
    uploadLogo,
    uploadCertification,
    saveApprenticeProfile,
    saveMemberProfile,
    fetchProfileCardStats,
} from "./supabase-auth.js";
import { uploadCV, getCVSignedUrl } from "./manual-payment-system.js";
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

// --- DOM Elements ---
const loadingScreen = document.getElementById("loading-screen");
const dashboardLayout = document.getElementById("dashboard-layout");
const mainContent = document.getElementById("main-content");
const userNameEl = document.getElementById("user-name");
const userRoleInfoEl = document.getElementById("user-role-info");
const userAvatarEl = document.getElementById("user-avatar");
const logoutButton = document.getElementById("logout-button");
const mainNav = document.getElementById("main-nav");
const notificationBell = document.getElementById("notification-bell");
const notificationPanel = document.getElementById("notification-panel");
const notificationList = document.getElementById("notification-list");

// Helper function to generate fallback avatar (data URI) when placehold.co times out
function generateFallbackAvatar(text, size = 100) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Background color
    ctx.fillStyle = '#EBF4FF';
    ctx.fillRect(0, 0, size, size);
    
    // Text
    ctx.fillStyle = '#3B82F6';
    ctx.font = `bold ${size * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((text || 'U').charAt(0).toUpperCase(), size / 2, size / 2);
    
    return canvas.toDataURL();
}

// Helper function to set avatar with fallback
function setAvatarWithFallback(imgElement, text, size = 100) {
    if (!imgElement) return;
    
    const fallbackSrc = generateFallbackAvatar(text, size);
    const placeholderUrl = `https://placehold.co/${size}x${size}/EBF4FF/3B82F6?text=${(text || 'U').charAt(0).toUpperCase()}`;
    
    // Set placeholder first
    imgElement.src = placeholderUrl;
    
    // Add error handler to use fallback if placeholder times out
    imgElement.onerror = function() {
        console.warn(`Placeholder image timed out, using fallback for: ${text}`);
        this.onerror = null; // Prevent infinite loop
        this.src = fallbackSrc;
    };
    
    // Also set a timeout to switch to fallback if image doesn't load in 3 seconds
    const timeout = setTimeout(() => {
        if (imgElement.complete === false || imgElement.naturalWidth === 0) {
            console.warn(`Placeholder image taking too long, using fallback for: ${text}`);
            imgElement.src = fallbackSrc;
        }
    }, 3000);
    
    // Clear timeout if image loads successfully
    imgElement.onload = () => clearTimeout(timeout);
}
const notificationBadge = document.getElementById("notification-badge");
const notificationWrapper = document.getElementById("notification-wrapper");
const markAllNotificationsBtn = document.getElementById(
    "mark-all-notifications"
);

// Modal Elements
const uploadModal = document.getElementById("upload-modal");
const paymentModal = document.getElementById("payment-modal");
const editProfileModal = document.getElementById("edit-profile-modal");
const editProfileForm = document.getElementById("edit-profile-form");
const uploadWorkForm = document.getElementById("upload-work-form");
const deletePostModal = document.getElementById("delete-post-modal");
const jobReviewModal = document.getElementById("job-review-modal");
const jobReviewForm = document.getElementById("job-review-form");
const progressUpdateModal = document.getElementById("progress-update-modal");
const progressUpdateForm = document.getElementById("progress-update-form");
const finalWorkModal = document.getElementById("final-work-modal");
const finalWorkForm = document.getElementById("final-work-form");
const progressFeedbackModal = document.getElementById("progress-feedback-modal");
const finalSubmissionReviewModal = document.getElementById("final-submission-review-modal");
const progressFeedbackForm = document.getElementById("progress-feedback-form");
const finalSubmissionReviewForm = document.getElementById("final-submission-review-form");

// --- Configurations ---
const subscriptionPlans = {
    free: {
        name: "Free",
        price: 0,
        unlocks: [
            "home",
            "gallery",
            "refer",
            "followers",
            "profile",
            "explore",
        ],
    },
    creative: {
        name: "Creative",
        price: 1500,
        unlocks: [
            "home",
            "gallery",
            "refer",
            "followers",
            "subscription",
            "earnings",
            "profile",
            "explore",
        ],
    },
};

// --- TABS CONFIGURATION ---
const memberTabs = [
    { id: "home", name: "Home", icon: "home", access: "free" },
    { id: "explore", name: "Explore", icon: "compass", access: "free" },
    { id: "gallery", name: "Gallery", icon: "image", access: "free" },
    { id: "jobs", name: "Jobs", icon: "briefcase", access: "free" },
    { id: "wallet", name: "Wallet", icon: "credit-card", access: "free" },
    {
        id: "subscription",
        name: "Subscription",
        icon: "shield",
        access: "free",
    },
    { id: "earnings", name: "Earn Points", icon: "award", access: "free" },
    {
        id: "leaderboard",
        name: "Leaderboard",
        icon: "bar-chart-2",
        access: "locked",
    },
    { id: "profile", name: "Profile", icon: "user", access: "free" },
];

const apprenticeTabs = [
    { id: "home", name: "Home", icon: "home" },
    { id: "gallery", name: "Gallery", icon: "image" },
    { id: "jobs", name: "Jobs & Requests", icon: "briefcase" },
    { id: "wallet", name: "Wallet", icon: "credit-card" },
    { id: "earnings", name: "Earnings & Progress", icon: "dollar-sign" },
    { id: "extras", name: "Extras", icon: "gift" },
    { id: "settings", name: "Settings & Info", icon: "settings" },
];

let currentActiveTab = "home";
const notificationState = {
    initialized: false,
    items: [],
    unreadCount: 0,
    userId: null,
    channel: null,
};

// --- DYNAMIC CONTENT TEMPLATES ---

// --- Apprentice Templates ---
const apprenticeContentTemplates = {
    home: async (userData) => {
        // Get real apprentice stats
        let stats = {
            pendingJobs: 0,
            activeJobs: 0,
            completedJobs: 0,
            totalEarned: 0,
        };

        try {
            stats = await getApprenticeStats(userData.id);
        } catch (error) {
            console.error("Error fetching apprentice stats:", error);
        }

        return `
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Welcome, ${
                userData.name || "Apprentice"
            }!</h1>
            <p class="text-gray-600">Here's your overview.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
             <!-- Profile Info -->
            <div class="md:col-span-1 bg-white p-6 rounded-lg shadow">
                <div class="flex flex-col items-center text-center">
                    <img id="user-avatar-main" class="w-24 h-24 rounded-full object-cover mb-4" src="https://placehold.co/100x100/EBF4FF/3B82F6?text=${(
                        userData.name || "A"
                    ).charAt(0)}" alt="User profile photo">
                    <h2 class="text-xl font-bold">${
                        userData.name || "Apprentice Name"
                    }</h2>
                    <p class="text-gray-600">${
                        userData.skill || "Skill Not Set"
                    }</p>
                    <p class="text-sm text-gray-500 mt-1"><i data-feather="map-pin" class="inline-block w-4 h-4 mr-1"></i>${
                        userData.location || "Location Not Set"
                    }</p>
                </div>
            </div>
            <!-- Job Stats & Quick Actions -->
            <div class="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                    <h3 class="text-sm font-medium text-gray-500">Pending Jobs</h3>
                    <p class="text-3xl font-bold mt-2">${stats.pendingJobs}</p>
                </div>
                <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                     <h3 class="text-sm font-medium text-gray-500">Active Jobs</h3>
                    <p class="text-3xl font-bold mt-2">${stats.activeJobs}</p>
                </div>
                <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                     <h3 class="text-sm font-medium text-gray-500">Completed Jobs</h3>
                    <p class="text-3xl font-bold mt-2">${
                        stats.completedJobs
                    }</p>
                </div>
                <div class="sm:col-span-3 bg-white p-6 rounded-lg shadow">
                    <h3 class="text-lg font-bold mb-4">Quick Actions</h3>
                    <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                         <button class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center"><i data-feather="edit" class="w-4 h-4 mr-2"></i>Update Portfolio</button>
                         <button class="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 flex items-center justify-center"><i data-feather="briefcase" class="w-4 h-4 mr-2"></i>Track Jobs</button>
                         <button class="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center justify-center"><i data-feather="dollar-sign" class="w-4 h-4 mr-2"></i>Withdraw Earnings</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    },
    jobs: async (userData) => {
        // Get available job requests for apprentices to apply to
        let availableJobs = [];
        let myApplications = [];
        let apprenticeStats = {
            pendingApplications: 0,
            activeJobs: 0,
            completedJobs: 0,
            totalEarned: 0,
        };

        try {
            availableJobs = await getAllJobRequests();
            myApplications = await getApprenticeJobApplications(userData.id);
            apprenticeStats = await getApprenticeStats(userData.id);
        } catch (error) {
            console.error("Error fetching job data:", error);
        }

        return `
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Available Jobs</h1>
            <p class="text-gray-600">Browse and apply for jobs that match your skills.</p>
        </div>
        
        <!-- Job Stats Overview -->
        <div class="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-blue-100 text-blue-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="briefcase" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">Available Jobs</h3>
                <p class="text-3xl font-bold mt-2 text-blue-600">${
                    availableJobs.length
                }</p>
            </div>
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-yellow-100 text-yellow-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="clock" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">Pending Applications</h3>
                <p class="text-3xl font-bold mt-2 text-yellow-600">${
                    apprenticeStats.pendingApplications
                }</p>
            </div>
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-green-100 text-green-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="play" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">Active Jobs</h3>
                <p class="text-3xl font-bold mt-2 text-green-600">${
                    apprenticeStats.activeJobs
                }</p>
            </div>
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-orange-100 text-orange-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="check-circle" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">Pending Review</h3>
                <p class="text-3xl font-bold mt-2 text-orange-600">${
                    apprenticeStats.pendingReviewJobs
                }</p>
            </div>
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-purple-100 text-purple-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="dollar-sign" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">Total Earned</h3>
                <p class="text-3xl font-bold mt-2 text-purple-600">₦${(
                    apprenticeStats.totalEarned * 1500
                ).toLocaleString()}</p>
            </div>
        </div>

        <!-- Available Jobs -->
        <div class="bg-white rounded-lg shadow mb-8">
            <div class="p-6 border-b border-gray-200">
                <h3 class="text-xl font-bold text-gray-900">Available Jobs</h3>
                <p class="text-gray-600">Browse and apply for jobs that match your skills</p>
            </div>
            <div class="p-6">
                ${
                    availableJobs.length > 0
                        ? `
                    <div class="space-y-6">
                        ${availableJobs
                            .map(
                                (job) => `
                            <div class="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                                <div class="flex justify-between items-start mb-4">
                                    <div class="flex-1">
                                        <h4 class="text-xl font-semibold text-gray-900">${
                                            job.title
                                        }</h4>
                                        <p class="text-gray-600 mt-1">${
                                            job.description
                                        }</p>
                                        <div class="flex items-center mt-2">
                                            <img src="https://placehold.co/32x32/EBF4FF/3B82F6?text=${
                                                job.client?.name?.charAt(0) ||
                                                "C"
                                            }" 
                                                 alt="${job.client?.name}" 
                                                 class="w-8 h-8 rounded-full mr-2">
                                            <span class="text-sm text-gray-600">${
                                                job.client?.name ||
                                                "Anonymous Client"
                                            }</span>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                                        <div class="text-2xl font-bold text-green-600">₦${(
                                                            job.budget_min
                                                        ).toLocaleString()}-₦${(
                                    job.budget_max
                                ).toLocaleString()}</div>
                                        <div class="text-sm text-gray-500">Budget</div>
                                    </div>
                                </div>
                                
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                                    <div>
                                        <span class="text-gray-500">Location:</span>
                                        <span class="font-medium">${
                                            job.location || "Remote"
                                        }</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-500">Deadline:</span>
                                        <span class="font-medium">${new Date(
                                            job.deadline
                                        ).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-500">Skills:</span>
                                        <span class="font-medium">${
                                            job.skills_required?.join(", ") ||
                                            "Any"
                                        }</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-500">Posted:</span>
                                        <span class="font-medium">${new Date(
                                            job.created_at
                                        ).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                
                                <div class="flex justify-end">
                                    <button class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium apply-job-btn" 
                                            data-job-id="${job.id}" 
                                            data-job-title="${job.title}">
                                        <i data-feather="send" class="w-4 h-4 mr-2"></i>
                                        Apply Now
                                    </button>
                                </div>
                            </div>
                        `
                            )
                            .join("")}
                    </div>
                `
                        : `
                    <div class="text-center py-12">
                        <i data-feather="briefcase" class="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
                        <h4 class="text-xl font-semibold text-gray-700 mb-2">No Available Jobs</h4>
                        <p class="text-gray-500">Check back later for new job opportunities!</p>
                    </div>
                `
                }
            </div>
        </div>

        <!-- My Applications -->
        <div class="bg-white rounded-lg shadow">
            <div class="p-6 border-b border-gray-200">
                <h3 class="text-xl font-bold text-gray-900">My Applications</h3>
                <p class="text-gray-600">Track your job applications and active work</p>
            </div>
            <div class="p-6">
                ${
                    myApplications.length > 0
                        ? `
                    <div class="space-y-6">
                        ${myApplications
                            .map(
                                (app) => `
                            <div class="border border-gray-200 rounded-lg p-6">
                                <div class="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 class="text-xl font-semibold text-gray-900">${
                                            app.job_request.title
                                        }</h4>
                                        <p class="text-gray-600 mt-1">${
                                            app.job_request.description
                                        }</p>
                                        <div class="flex items-center mt-2">
                                            <img src="https://placehold.co/32x32/EBF4FF/3B82F6?text=${
                                                app.job_request.client?.name?.charAt(
                                                    0
                                                ) || "C"
                                            }" 
                                                 alt="${
                                                     app.job_request.client
                                                         ?.name
                                                 }" 
                                                 class="w-8 h-8 rounded-full mr-2">
                                            <span class="text-sm text-gray-600">${
                                                app.job_request.client?.name ||
                                                "Anonymous Client"
                                            }</span>
                                        </div>
                                    </div>
                                    <span class="bg-${
                                        app.status === "pending"
                                            ? "yellow"
                                            : app.status === "accepted"
                                            ? "green"
                                            : "red"
                                    }-100 text-${
                                    app.status === "pending"
                                        ? "yellow"
                                        : app.status === "accepted"
                                        ? "green"
                                        : "red"
                                }-800 text-xs px-3 py-1 rounded-full capitalize">${
                                    app.status
                                }</span>
                                </div>
                                
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                                    <div>
                                        <span class="text-gray-500">Budget:</span>
                                                                <span class="font-medium">₦${(
                                                                    app
                                                                        .job_request
                                                                        .budget_min
                                                                ).toLocaleString()}-₦${(
                                    app.job_request.budget_max
                                ).toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-500">Deadline:</span>
                                        <span class="font-medium">${new Date(
                                            app.job_request.deadline
                                        ).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-500">Applied:</span>
                                        <span class="font-medium">${new Date(
                                            app.created_at
                                        ).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-500">Job Status:</span>
                                        <span class="font-medium capitalize">${app.job_request.status.replace(
                                            "_",
                                            " "
                                        )}</span>
                                    </div>
                                </div>
                                
                                <div class="bg-gray-50 p-4 rounded-lg mb-4">
                                    <h5 class="font-semibold text-gray-900 mb-2">Your Proposal</h5>
                                    <p class="text-gray-600">${app.proposal}</p>
                                </div>
                                
                                ${
                                    app.status === "accepted" &&
                                    app.job_request.status === "in_progress"
                                        ? `
                                    <div class="border-t border-gray-200 pt-4">
                                        <h5 class="font-semibold text-gray-900 mb-3">Job Progress</h5>
                                        <div class="flex items-center space-x-4 mb-4">
                                            <button class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm submit-progress-update-btn" 
                                                    data-job-id="${app.job_request.id}">
                                                <i data-feather="upload" class="w-4 h-4 mr-2"></i>
                                                Submit Progress Update
                                            </button>
                                            <button class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm submit-final-work-btn" 
                                                    data-job-id="${app.job_request.id}">
                                                <i data-feather="check-circle" class="w-4 h-4 mr-2"></i>
                                                Submit Final Work
                                            </button>
                                            <button class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm load-apprentice-progress-updates-btn" 
                                                    data-job-id="${app.job_request.id}">
                                                <i data-feather="eye" class="w-4 h-4 mr-2"></i>
                                                View Progress & Feedback
                                            </button>
                                        </div>
                                        <div id="progress-updates-${app.job_request.id}" class="progress-updates-container">
                                            <!-- Progress updates will be loaded here -->
                                        </div>
                                        <div class="mt-2">
                                            <button class="text-sm text-gray-500 hover:text-gray-700 load-apprentice-progress-updates-btn" 
                                                    data-job-id="${app.job_request.id}">
                                                <i data-feather="refresh-cw" class="w-4 h-4 inline mr-1"></i>
                                                Refresh Progress Updates
                                            </button>
                                        </div>
                                    </div>
                                `
                                        : ""
                                }
                            </div>
                        `
                            )
                            .join("")}
                    </div>
                `
                        : `
                    <div class="text-center py-12">
                        <i data-feather="send" class="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
                        <h4 class="text-xl font-semibold text-gray-700 mb-2">No Applications Yet</h4>
                        <p class="text-gray-500">Apply for jobs above to start earning!</p>
                    </div>
                `
                }
            </div>
        </div>
    `;
    },
    earnings: async (userData) => {
        // Get real earnings data
        let stats = {
            totalEarned: 0,
            availableBalance: 0,
            thisMonth: 0,
            goalProgress: 0,
        };

        try {
            const apprenticeStats = await getApprenticeStats(userData.id);
            stats.totalEarned = apprenticeStats.totalEarned;
            stats.availableBalance = Math.round(stats.totalEarned * 0.8); // 80% available for withdrawal
            stats.thisMonth = Math.round(stats.totalEarned * 0.3); // 30% earned this month
            stats.goalProgress = Math.min(
                100,
                Math.round((stats.totalEarned / 7500000) * 100)
            ); // Goal of ₦7,500,000
        } catch (error) {
            console.error("Error fetching earnings data:", error);
        }

        return `
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Earnings & Progress</h1>
            <p class="text-gray-600">Manage your finances and track your growth.</p>
        </div>
        
        <!-- Earnings Overview -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-green-100 text-green-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="dollar-sign" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">Total Earned</h3>
                <p class="text-3xl font-bold mt-2 text-green-600">₦${(
                    stats.totalEarned * 1500
                ).toLocaleString()}</p>
            </div>
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-blue-100 text-blue-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="credit-card" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">Available Balance</h3>
                <p class="text-3xl font-bold mt-2 text-blue-600">₦${(
                    stats.availableBalance * 1500
                ).toLocaleString()}</p>
            </div>
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-yellow-100 text-yellow-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="trending-up" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">This Month</h3>
                <p class="text-3xl font-bold mt-2 text-yellow-600">₦${(
                    stats.thisMonth * 1500
                ).toLocaleString()}</p>
            </div>
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-purple-100 text-purple-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="target" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">Goal Progress</h3>
                <p class="text-3xl font-bold mt-2 text-purple-600">${
                    stats.goalProgress
                }%</p>
            </div>
        </div>

        <!-- Financial Management -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- Withdrawal & Payment -->
            <div class="bg-white rounded-lg shadow">
                <div class="p-6 border-b border-gray-200">
                    <h3 class="text-xl font-bold text-gray-900">Withdrawals & Payments</h3>
                    <p class="text-gray-600">Manage your earnings</p>
                </div>
                <div class="p-6 space-y-4">
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 class="font-semibold text-gray-900 mb-2">Quick Withdrawal</h4>
                        <p class="text-gray-600 text-sm mb-4">Withdraw your available balance to your bank account or mobile money.</p>
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-sm text-gray-600">Available for withdrawal:</span>
                            <span class="font-bold text-green-600">₦${(
                                stats.availableBalance * 1500
                            ).toLocaleString()}</span>
                        </div>
                        <div class="flex space-x-2">
                            <button class="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 text-sm font-medium" ${
                                stats.availableBalance === 0 ? "disabled" : ""
                            }>Withdraw All</button>
                            <button class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 text-sm font-medium" ${
                                stats.availableBalance === 0 ? "disabled" : ""
                            }>Custom Amount</button>
                        </div>
                    </div>
                    
                    <div class="border border-gray-200 rounded-lg p-4">
                        <h4 class="font-semibold text-gray-900 mb-2">Payment Methods</h4>
                        <div class="space-y-3">
                            <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                <div class="flex items-center">
                                    <i data-feather="credit-card" class="w-5 h-5 text-blue-600 mr-3"></i>
                                    <span class="text-sm font-medium">Bank Transfer</span>
                                </div>
                                <span class="text-xs text-green-600">Connected</span>
                            </div>
                            <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                <div class="flex items-center">
                                    <i data-feather="smartphone" class="w-5 h-5 text-green-600 mr-3"></i>
                                    <span class="text-sm font-medium">Mobile Money</span>
                                </div>
                                <button class="text-xs text-blue-600 hover:text-blue-700">Add Account</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Earnings Chart -->
            <div class="bg-white rounded-lg shadow">
                <div class="p-6 border-b border-gray-200">
                    <h3 class="text-xl font-bold text-gray-900">Earnings Trend</h3>
                    <p class="text-gray-600">Your monthly earnings</p>
                </div>
                <div class="p-6">
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">December 2024</span>
                            <span class="font-semibold text-green-600">₦${(
                                stats.thisMonth * 1500
                            ).toLocaleString()}</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-green-600 h-2 rounded-full" style="width: ${Math.min(
                                100,
                                (stats.thisMonth / 1000) * 100
                            )}%"></div>
                        </div>
                        
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">November 2024</span>
                            <span class="font-semibold text-green-600">₦${(
                                Math.round(stats.totalEarned * 0.2) * 1500
                            ).toLocaleString()}</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-green-600 h-2 rounded-full" style="width: ${Math.min(
                                100,
                                ((stats.totalEarned * 0.2) / 1000) * 100
                            )}%"></div>
                        </div>
                        
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">October 2024</span>
                            <span class="font-semibold text-green-600">₦${(
                                Math.round(stats.totalEarned * 0.3) * 1500
                            ).toLocaleString()}</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-green-600 h-2 rounded-full" style="width: ${Math.min(
                                100,
                                ((stats.totalEarned * 0.3) / 1000) * 100
                            )}%"></div>
                        </div>
                        
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">September 2024</span>
                            <span class="font-semibold text-green-600">₦${(
                                Math.round(stats.totalEarned * 0.2) * 1500
                            ).toLocaleString()}</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-green-600 h-2 rounded-full" style="width: ${Math.min(
                                100,
                                ((stats.totalEarned * 0.2) / 1000) * 100
                            )}%"></div>
                        </div>
                    </div>
                    
                    <div class="mt-6 text-center">
                        <button class="text-blue-600 hover:text-blue-700 font-medium">View Detailed Analytics →</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Recent Transactions -->
        <div class="bg-white rounded-lg shadow">
            <div class="p-6 border-b border-gray-200">
                <h3 class="text-xl font-bold text-gray-900">Recent Transactions</h3>
                <p class="text-gray-600">Your payment history</p>
            </div>
            <div class="p-6">
                ${
                    stats.totalEarned > 0
                        ? `
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                            <div class="flex items-center">
                                <div class="p-2 rounded-full bg-green-100 text-green-600 mr-4">
                                    <i data-feather="plus" class="w-4 h-4"></i>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-gray-900">Completed Job</h4>
                                    <p class="text-sm text-gray-600">Payment received for completed work</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="font-bold text-green-600">+₦${(
                                    Math.round(stats.totalEarned * 0.4) * 1500
                                ).toLocaleString()}</span>
                                <p class="text-xs text-gray-500">Completed</p>
                            </div>
                        </div>
                    </div>
                `
                        : `
                    <div class="text-center py-8">
                        <i data-feather="dollar-sign" class="w-12 h-12 text-gray-300 mx-auto mb-4"></i>
                        <h4 class="text-lg font-semibold text-gray-700 mb-2">No Transactions Yet</h4>
                        <p class="text-gray-500">Complete your first job to see earnings here!</p>
                    </div>
                `
                }
                
                <div class="mt-6 text-center">
                    <button class="text-blue-600 hover:text-blue-700 font-medium">View All Transactions →</button>
                </div>
            </div>
        </div>
    `;
    },
    extras: (userData) => `
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Extras & Community</h1>
            <p class="text-gray-600">Coming soon! We're working on exciting new features.</p>
        </div>
        
        <div class="bg-white rounded-lg shadow p-12 text-center">
            <div class="max-w-md mx-auto">
                <i data-feather="gift" class="w-16 h-16 text-gray-300 mx-auto mb-6"></i>
                <h3 class="text-2xl font-bold text-gray-700 mb-4">Coming Soon</h3>
                <p class="text-gray-600 mb-6">We're building amazing community features, learning resources, and exclusive extras for apprentices. Stay tuned for updates!</p>
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p class="text-blue-800 text-sm">Features in development:</p>
                    <ul class="text-blue-700 text-sm mt-2 space-y-1">
                        <li>• Community events and workshops</li>
                        <li>• Learning hub with courses</li>
                        <li>• Digital store for selling work</li>
                        <li>• Networking opportunities</li>
                    </ul>
                </div>
            </div>
        </div>
    `,
    gallery: (userData, posts = []) => `
        <div class="mb-8 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold text-gray-900">Portfolio Gallery</h1>
                <p class="text-gray-600">Showcase your skills and work samples</p>
            </div>
            <div class="flex space-x-3">
                <button id="open-upload-modal" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    <i data-feather="plus" class="w-4 h-4 inline mr-2"></i>Upload Work
                </button>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${
                posts.length > 0
                    ? posts
                          .map(
                              (post) => `
                <div class="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow duration-300">
                    <div class="relative group">
                        <img src="${post.image_url}" 
                             alt="${post.title}" 
                             class="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105 gallery-image"
                             data-src="${post.image_url}"
                             onerror="this.onerror=null; this.src='https://placehold.co/400x300/EBF4FF/3B82F6?text=Image+Not+Found'; this.classList.add('opacity-50'); console.error('Image failed to load:', '${
                                 post.image_url
                             }');"
                             onload="this.classList.remove('image-loading'); this.classList.add('image-loaded'); console.log('Image loaded successfully:', '${
                                 post.image_url
                             }');">
                        <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
                            <button class="opacity-0 group-hover:opacity-100 bg-white bg-opacity-90 text-gray-800 px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 hover:bg-opacity-100 view-image-btn" 
                                    data-image-url="${post.image_url}" 
                                    data-title="${post.title}">
                                <i data-feather="eye" class="w-4 h-4 inline mr-1"></i>View
                            </button>
                        </div>
                    </div>
                    <div class="p-4">
                        <h3 class="font-semibold text-gray-800 text-lg mb-2">${
                            post.title
                        }</h3>
                        <p class="text-gray-600 text-sm mb-3 line-clamp-2">${
                            post.description
                        }</p>
                        <div class="flex items-center justify-between text-xs text-gray-400">
                            <span>Posted ${new Date(
                                post.created_at
                            ).toLocaleDateString()}</span>
                            <div class="flex items-center space-x-3">
                                <button class="like-post-btn flex items-center space-x-1 transition-colors ${
                                    post.user_liked
                                        ? "text-red-500"
                                        : "text-gray-400 hover:text-red-500"
                                }" 
                                        data-post-id="${post.id}" 
                                        data-post-liked="${
                                            post.user_liked || false
                                        }">
                                    <i data-feather="heart" class="w-3 h-3 ${
                                        post.user_liked ? "fill-current" : ""
                                    }"></i>
                                    <span class="like-count">${
                                        post.likes || 0
                                    }</span>
                                </button>
                                <button class="delete-post-btn text-red-500 hover:text-red-700 transition-colors" 
                                        data-post-id="${post.id}" 
                                        data-post-title="${post.title}">
                                    <i data-feather="trash-2" class="w-3 h-3"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `
                          )
                          .join("")
                    : `
                <div class="col-span-full text-center py-12">
                    <i data-feather="image" class="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
                    <h3 class="text-xl font-semibold text-gray-700 mb-2">No work uploaded yet</h3>
                    <p class="text-gray-500 mb-6">Start showcasing your skills to get discovered by potential clients</p>
                    <button id="gallery-upload-btn" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                        Upload Your First Work
                    </button>
                </div>
            `
            }
        </div>
        
        <!-- Image Viewer Modal -->
        <div id="image-viewer-modal" class="modal fixed inset-0 bg-black bg-opacity-90 items-center justify-center z-50 p-4">
            <div class="relative max-w-4xl max-h-full">
                <button id="close-image-viewer" class="absolute top-4 right-4 text-white hover:text-gray-300 z-10">
                    <i data-feather="x" class="w-8 h-8"></i>
                </button>
                <img id="viewer-image" src="" alt="" class="max-w-full max-h-full object-contain">
                <div class="absolute bottom-4 left-4 right-4 text-center">
                    <h3 id="viewer-title" class="text-white text-xl font-bold mb-2"></h3>
                    <p id="viewer-description" class="text-white text-sm opacity-90 hidden"></p>
                </div>
            </div>
        </div>
    `,
    wallet: (userData) => `
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 flex items-center">
                <i class="fas fa-wallet mr-3 text-blue-600"></i> My Wallet
            </h1>
            <p class="text-gray-600 mt-2">Manage your funds and transactions</p>
        </div>
        
        <div class="wallet-summary bg-white rounded-lg shadow-lg p-6 mb-6">
            <div class="wallet-balance text-center mb-6">
                <div class="balance-amount text-4xl font-bold text-green-600 mb-2" id="wallet-balance">₦0.00</div>
                <div class="balance-points text-lg text-gray-600" id="wallet-points">0.00 pts</div>
            </div>
            
            <div class="wallet-actions flex gap-4 justify-center flex-wrap">
                <button id="add-funds-btn" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
                    <i class="fas fa-plus mr-2"></i> Add Funds (Bank Transfer)
                </button>
                <button id="add-funds-flutterwave-btn" class="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center">
                    <i class="fas fa-credit-card mr-2"></i> Add Funds (Flutterwave)
                </button>
                <button id="withdraw-funds-btn" class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center">
                    <i class="fas fa-money-bill-wave mr-2"></i> Withdraw
                </button>
                <button id="view-transactions-btn" class="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors flex items-center">
                    <i class="fas fa-history mr-2"></i> History
                </button>
            </div>
        </div>
        
        <div class="wallet-transactions bg-white rounded-lg shadow-lg p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
            <div id="wallet-transactions-container">
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                    <p>Loading transactions...</p>
                </div>
            </div>
        </div>
    `,
    settings: (userData) => `
         <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Settings & Info</h1>
            <p class="text-gray-600">Manage your profile and account settings.</p>
        </div>
        <div class="bg-white p-8 rounded-lg shadow max-w-3xl mx-auto">
             <div class="space-y-8 divide-y divide-gray-200">
                <!-- Edit Profile -->
                <div>
                    <h3 class="text-lg leading-6 font-medium text-gray-900">Edit Profile & Skills</h3>
                    <button id="open-edit-profile-modal" class="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Edit Profile</button>
                </div>
                <!-- Links -->
                <div class="pt-8">
                     <h3 class="text-lg leading-6 font-medium text-gray-900">Information</h3>
                     <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <a href="#" class="text-blue-600 hover:underline">Terms & Conditions</a>
                        <a href="#" class="text-blue-600 hover:underline">Referral Rules</a>
                        <a href="#" class="text-blue-600 hover:underline">FAQ</a>
                    </div>
                </div>
                <!-- Settings -->
                <div class="pt-8">
                     <h3 class="text-lg leading-6 font-medium text-gray-900">Password & Notifications</h3>
                     <div class="mt-4 space-y-4">
                        <button class="text-left text-blue-600 hover:underline">Change Password</button>
                        <div class="relative flex items-start">
                            <div class="flex items-center h-5">
                                <input id="notifications-email" name="notifications-email" type="checkbox" class="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded" checked>
                            </div>
                            <div class="ml-3 text-sm">
                                <label for="notifications-email" class="font-medium text-gray-700">Email Notifications</label>
                                <p class="text-gray-500">Get notified by email about new jobs and messages.</p>
                            </div>
                        </div>
                     </div>
                </div>
                
                <!-- Storage Test (for debugging) -->
                <div class="pt-8">
                     <h3 class="text-lg leading-6 font-medium text-gray-900">Storage & System</h3>
                     <div class="mt-4 space-y-4">
                        <button id="test-storage-btn" class="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 text-sm">
                            <i data-feather="database" class="w-4 h-4 inline mr-2"></i>Test Storage Configuration
                        </button>
                        <p class="text-xs text-gray-500">Use this to diagnose upload issues. Check browser console for results.</p>
                     </div>
                </div>
             </div>
        </div>
    `,
};

// --- Member Templates ---
const memberContentTemplates = {
    home: (userData) => `
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Welcome back, ${
                userData.name || "User"
            }!</h1>
            <p class="text-gray-600">Here's your activity overview</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="stat-card bg-white p-6 rounded-lg shadow">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-green-100 text-green-600"><i data-feather="user-plus"></i></div>
                    <div class="ml-4">
                        <p class="text-sm text-gray-500">Referral Points</p>
                        <p class="text-2xl font-bold">${(
                            userData.referral_points || 0
                        ).toLocaleString()}</p>
                    </div>
                </div>
            </div>
            <div class="stat-card bg-white p-6 rounded-lg shadow">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-blue-100 text-blue-600"><i data-feather="award"></i></div>
                    <div class="ml-4">
                        <p class="text-sm text-gray-500">Eligibility Points</p>
                        <p class="text-2xl font-bold">${(
                            userData.eligibility_points || 0
                        ).toLocaleString()}</p>
                    </div>
                </div>
            </div>
            <div class="stat-card bg-white p-6 rounded-lg shadow">
                <div class="flex items-center">
                    <div class="p-3 rounded-full bg-indigo-100 text-indigo-600"><i data-feather="users"></i></div>
                    <div class="ml-4">
                        <p class="text-sm text-gray-500">Followers</p>
                        <p class="text-2xl font-bold">${
                            userData.followers || 0
                        }</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="mt-8 bg-white p-6 rounded-lg shadow">
            <h3 class="text-xl font-bold mb-4">Recent Activity</h3>
            <p class="text-gray-600">Your recent points history and notifications will appear here.</p>
        </div>
    `,
    explore: (userData, recommendations = [], searchResults = []) => {
        const currentUserRole = userData.role || "member";
        const targetRoleText =
            currentUserRole === "member" ? "Apprentices" : "Members";
        const targetRoleDescription =
            currentUserRole === "member"
                ? "skilled apprentices looking for opportunities"
                : "creative members to collaborate with";

        return `
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Explore ${targetRoleText}</h1>
            <p class="text-gray-600">Discover and connect with ${targetRoleDescription}</p>
        </div>
        
        <!-- Search Bar -->
        <div class="mb-8 bg-white p-6 rounded-lg shadow">
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1">
                    <input 
                        type="text" 
                        id="search-input" 
                        placeholder="Search by name, ${
                            currentUserRole === "member"
                                ? "skill"
                                : "creative type"
                        }, or location..." 
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                </div>
                <div>
                    <select id="filter-creative-type" class="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">${
                            currentUserRole === "member"
                                ? "All Skills"
                                : "All Creative Types"
                        }</option>
                        ${
                            currentUserRole === "member"
                                ? `
                            <option value="photography">Photography</option>
                            <option value="design">Design</option>
                            <option value="programming">Programming</option>
                            <option value="art">Art & Craft</option>
                            <option value="writing">Writing</option>
                        `
                                : `
                            <option value="Photographer">Photographer</option>
                            <option value="Designer">Designer</option>
                            <option value="Artisan">Artisan</option>
                            <option value="Student">Student</option>
                            <option value="Programmer">Programmer</option>
                            <option value="Other">Other</option>
                        `
                        }
                    </select>
                </div>
                <button id="search-btn" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
                    <i data-feather="search" class="w-4 h-4 mr-2"></i>
                    Search
                </button>
            </div>
        </div>

        <!-- Search Results -->
        <div id="search-results" class="mb-8 ${
            searchResults.length > 0 ? "" : "hidden"
        }">
            <h3 class="text-xl font-bold text-gray-900 mb-4">Search Results</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${searchResults
                    .map(
                        (user) => `
                    <div class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                        <div class="flex items-center mb-4">
                            <img src="https://placehold.co/60x60/EBF4FF/3B82F6?text=${
                                user.name
                                    ? user.name.charAt(0).toUpperCase()
                                    : "U"
                            }" 
                                 alt="${user.name}" 
                                 class="w-12 h-12 rounded-full mr-4">
                            <div>
                                <h4 class="font-semibold text-gray-900">${
                                    user.name || "Unknown User"
                                }</h4>
                                <p class="text-sm text-gray-600">${
                                    user.role === "apprentice"
                                        ? user.skill || "Apprentice"
                                        : user.creative_type || "Creative"
                                }</p>
                                ${
                                    user.location
                                        ? `<p class="text-xs text-gray-500">${user.location}</p>`
                                        : ""
                                }
                            </div>
                        </div>
                        <div class="flex justify-between items-center text-sm text-gray-500 mb-4">
                            <span>${user.followers || 0} followers</span>
                            ${
                                user.role === "member"
                                    ? `
                                <span>${(
                                    (user.referral_points || 0) +
                                    (user.eligibility_points || 0)
                                ).toLocaleString()} pts</span>
                            `
                                    : user.role === "apprentice" && user.rating > 0
                                    ? `
                                <div class="flex items-center">
                                    <div class="flex items-center mr-2">
                                        ${Array.from({ length: 5 }, (_, i) => 
                                            `<i data-feather="star" class="w-3 h-3 ${i < Math.floor(user.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}"></i>`
                                        ).join('')}
                                    </div>
                                    <span class="text-xs">${user.rating.toFixed(1)} (${user.totalRatings})</span>
                                </div>
                            `
                                    : user.role === "apprentice"
                                    ? `<span class="text-xs text-gray-400">No ratings yet</span>`
                                    : ""
                            }
                        </div>
                        <div class="flex space-x-2">
                            <button class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 follow-btn" 
                                    data-user-id="${user.id}">
                                ${
                                    currentUserRole === "member" &&
                                    user.role === "apprentice"
                                        ? "Connect"
                                        : "Follow"
                                }
                            </button>
                        </div>
                    </div>
                `
                    )
                    .join("")}
            </div>
        </div>

        <!-- Recommended for You -->
        <div class="mb-8">
            <h3 class="text-xl font-bold text-gray-900 mb-4">Recommended for You</h3>
            <p class="text-gray-600 mb-6">Based on your ${
                currentUserRole === "member" ? "creative type" : "skills"
            }: ${
            currentUserRole === "member"
                ? userData.creative_type || "Creative"
                : userData.skill || "Your expertise"
        }</p>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${
                    recommendations.length > 0
                        ? recommendations
                              .map(
                                  (user) => `
                    <div class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                        <div class="flex items-center mb-4">
                            <img src="https://placehold.co/60x60/EBF4FF/3B82F6?text=${
                                user.name
                                    ? user.name.charAt(0).toUpperCase()
                                    : "U"
                            }" 
                                 alt="${user.name}" 
                                 class="w-12 h-12 rounded-full mr-4">
                            <div>
                                <h4 class="font-semibold text-gray-900">${
                                    user.name || "Unknown User"
                                }</h4>
                                <p class="text-sm text-gray-600">${
                                    user.role === "apprentice"
                                        ? user.skill || "Apprentice"
                                        : user.creative_type || "Creative"
                                }</p>
                                ${
                                    user.location
                                        ? `<p class="text-xs text-gray-500">${user.location}</p>`
                                        : ""
                                }
                            </div>
                        </div>
                        <div class="flex justify-between items-center text-sm text-gray-500 mb-4">
                            <span>${user.followers || 0} followers</span>
                            ${
                                user.role === "member"
                                    ? `
                                <span>${(
                                    (user.referral_points || 0) +
                                    (user.eligibility_points || 0)
                                ).toLocaleString()} pts</span>
                            `
                                    : user.role === "apprentice" && user.rating > 0
                                    ? `
                                <div class="flex items-center">
                                    <div class="flex items-center mr-2">
                                        ${Array.from({ length: 5 }, (_, i) => 
                                            `<i data-feather="star" class="w-3 h-3 ${i < Math.floor(user.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}"></i>`
                                        ).join('')}
                                    </div>
                                    <span class="text-xs">${user.rating.toFixed(1)} (${user.totalRatings})</span>
                                </div>
                            `
                                    : user.role === "apprentice"
                                    ? `<span class="text-xs text-gray-400">No ratings yet</span>`
                                    : ""
                            }
                        </div>
                        <div class="flex space-x-2">
                            <button class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 follow-btn" 
                                    data-user-id="${user.id}">
                                ${
                                    currentUserRole === "member" &&
                                    user.role === "apprentice"
                                        ? "Connect"
                                        : "Follow"
                                }
                            </button>
                        </div>
                    </div>
                `
                              )
                              .join("")
                        : `
                    <div class="col-span-full text-center py-12">
                        <i data-feather="users" class="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
                        <h3 class="text-xl font-semibold text-gray-700 mb-2">No recommendations yet</h3>
                        <p class="text-gray-500">Complete your profile to get personalized recommendations</p>
                    </div>
                `
                }
            </div>
        </div>
    `;
    },
    profile: (userData) => `
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Profile</h1>
            <p class="text-gray-600">Manage your account information</p>
        </div>
        <div class="bg-white p-8 rounded-lg shadow max-w-2xl mx-auto">
            <div class="flex flex-col sm:flex-row items-center sm:space-x-8">
                <img src="${
                    userAvatarEl.src
                }" alt="Profile" class="w-32 h-32 rounded-full object-cover border-4 border-gray-200">
                <div class="text-center sm:text-left mt-4 sm:mt-0">
                    <h2 class="text-3xl font-bold">${
                        userData.name || "User"
                    }</h2>
                    <p class="text-gray-600 mt-1">${
                        userData.creative_type || "Creative"
                    }</p>
                    <p class="text-sm text-gray-500 mt-2">${
                        userData.email || ""
                    }</p>
                    <button id="open-edit-profile-modal" class="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Edit Profile</button>
                </div>
            </div>
            <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-gray-800">Account Type</h4>
                    <p class="text-gray-600 capitalize">${
                        userData.role || "Member"
                    }</p>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-gray-800">Subscription Plan</h4>
                    <p class="text-gray-600">${
                        subscriptionPlans[userData.subscription_plan || "free"]
                            .name
                    }</p>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-gray-800">Member Since</h4>
                    <p class="text-gray-600">${
                        userData.created_at
                            ? new Date(userData.created_at).toLocaleDateString()
                            : "Recently"
                    }</p>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-semibold text-gray-800">Total Points</h4>
                    <p class="text-gray-600">${(
                        (userData.referral_points || 0) +
                        (userData.eligibility_points || 0)
                    ).toLocaleString()}</p>
                </div>
            </div>
        </div>
    `,
    gallery: (userData, posts = []) => `
        <div class="mb-8 flex justify-between items-center">
            <div>
                <h1 class="text-3xl font-bold text-gray-900">Gallery</h1>
                <p class="text-gray-600">Showcase your creative work</p>
            </div>
            <div class="flex space-x-3">
                <button id="open-upload-modal" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    <i data-feather="plus" class="w-4 h-4 inline mr-2"></i>Upload Work
                </button>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${
                posts.length > 0
                    ? posts
                          .map(
                              (post) => `
                <div class="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow duration-300">
                    <div class="relative group">
                        <img src="${post.image_url}" 
                             alt="${post.title}" 
                             class="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105 gallery-image"
                             data-src="${post.image_url}"
                             onerror="this.onerror=null; this.src='https://placehold.co/400x300/EBF4FF/3B82F6?text=Image+Not+Found'; this.classList.add('opacity-50'); console.error('Image failed to load:', '${
                                 post.image_url
                             }');"
                             onload="this.classList.remove('image-loading'); this.classList.add('image-loaded'); console.log('Image loaded successfully:', '${
                                 post.image_url
                             }');">
                        <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
                            <button class="opacity-0 group-hover:opacity-100 bg-white bg-opacity-90 text-gray-800 px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 hover:bg-opacity-100 view-image-btn" 
                                    data-image-url="${post.image_url}" 
                                    data-title="${post.title}">
                                <i data-feather="eye" class="w-4 h-4 inline mr-1"></i>View
                            </button>
                        </div>
                    </div>
                    <div class="p-4">
                        <h3 class="font-semibold text-gray-800 text-lg mb-2">${
                            post.title
                        }</h3>
                        <p class="text-gray-600 text-sm mb-3 line-clamp-2">${
                            post.description
                        }</p>
                        <div class="flex items-center justify-between text-xs text-gray-400">
                            <span>Posted ${new Date(
                                post.created_at
                            ).toLocaleDateString()}</span>
                            <div class="flex items-center space-x-3">
                                <button class="like-post-btn flex items-center space-x-1 transition-colors ${
                                    post.user_liked
                                        ? "text-red-500"
                                        : "text-gray-400 hover:text-red-500"
                                }" 
                                        data-post-id="${post.id}" 
                                        data-post-liked="${
                                            post.user_liked || false
                                        }">
                                    <i data-feather="heart" class="w-3 h-3 ${
                                        post.user_liked ? "fill-current" : ""
                                    }"></i>
                                    <span class="like-count">${
                                        post.likes || 0
                                    }</span>
                                </button>
                                <button class="delete-post-btn text-red-500 hover:text-red-700 transition-colors" 
                                        data-post-id="${post.id}" 
                                        data-post-title="${post.title}">
                                    <i data-feather="trash-2" class="w-3 h-3"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `
                          )
                          .join("")
                    : `
                <div class="col-span-full text-center py-12">
                    <i data-feather="image" class="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
                    <h3 class="text-xl font-semibold text-gray-700 mb-2">No work uploaded yet</h3>
                    <p class="text-gray-500 mb-6">Start showcasing your creative work to get discovered</p>
                    <div class="space-y-4">
                        <button id="gallery-upload-btn" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 mx-2">
                            Upload Your First Work
                        </button>
                    </div>
                </div>
            `
            }
        </div>
        
        <!-- Image Viewer Modal -->
        <div id="image-viewer-modal" class="modal fixed inset-0 bg-black bg-opacity-90 items-center justify-center z-50 p-4">
            <div class="relative max-w-4xl max-h-full">
                <button id="close-image-viewer" class="absolute top-4 right-4 text-white hover:text-gray-300 z-10">
                    <i data-feather="x" class="w-8 h-8"></i>
                </button>
                <img id="viewer-image" src="" alt="" class="max-w-full max-h-full object-contain">
                <div class="absolute bottom-4 left-4 right-4 text-center">
                    <h3 id="viewer-title" class="text-white text-xl font-bold mb-2"></h3>
                    <p id="viewer-description" class="text-white text-sm opacity-90 hidden"></p>
                </div>
            </div>
        </div>
    `,
    subscription: (userData) => `
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Subscription</h1>
            <p class="text-gray-600">Upgrade your plan to unlock more features</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            ${Object.entries(subscriptionPlans)
                .map(
                    ([key, plan]) => `
                <div class="bg-white p-6 rounded-lg shadow ${
                    userData.subscription_plan === key
                        ? "ring-2 ring-blue-500"
                        : ""
                }">
                    <h3 class="text-xl font-bold mb-2">${plan.name}</h3>
                    <p class="text-3xl font-bold text-blue-600 mb-4">₦${
                        plan.price
                    }<span class="text-sm text-gray-500">/month</span></p>
                    <ul class="space-y-2 mb-6">
                        ${
                            plan.unlocks.includes("*")
                                ? [
                                      "All Features",
                                      "Priority Support",
                                      "Advanced Analytics",
                                  ]
                                      .map(
                                          (feature) =>
                                              `<li class="flex items-center"><i data-feather="check" class="w-4 h-4 text-green-500 mr-2"></i>${feature}</li>`
                                      )
                                      .join("")
                                : plan.unlocks
                                      .map(
                                          (feature) =>
                                              `<li class="flex items-center"><i data-feather="check" class="w-4 h-4 text-green-500 mr-2"></i>${feature.replace(
                                                  "_",
                                                  " "
                                              )}</li>`
                                      )
                                      .join("")
                        }
                    </ul>
                    ${
                        userData.subscription_plan === key
                            ? '<button class="w-full bg-gray-300 text-gray-600 px-4 py-2 rounded-lg cursor-not-allowed">Current Plan</button>'
                            : plan.price === 0
                            ? '<button class="w-full bg-gray-300 text-gray-600 px-4 py-2 rounded-lg cursor-not-allowed">Free Plan</button>'
                            : `<button class="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 upgrade-btn" data-plan="${key}">Upgrade Now</button>`
                    }
                </div>
            `
                )
                .join("")}
        </div>
    `,
    earnings: async (userData) => {
        // Get referral data
        let referralCode = null;
        let referralStats = [];
        let referralWallet = null;
        let referralEarnings = [];
        let withdrawalRequests = [];
        let isWithdrawalWindowOpen = false;

        try {
            console.log("Fetching referral data for user:", userData.id);
            referralCode = await getUserReferralCode(userData.id);
            console.log("Referral code result:", referralCode);
            referralStats = await getUserReferralStats(userData.id);
            console.log("Referral stats result:", referralStats);
            
            // Get new referral wallet data
            referralWallet = await getReferralWallet(userData.id);
            referralEarnings = await getReferralEarnings(userData.id, 10);
            withdrawalRequests = await getWithdrawalRequests(userData.id);
            isWithdrawalWindowOpen = await isWithdrawalWindowOpen();
        } catch (error) {
            console.error("Error fetching referral data:", error);
            console.error("Error details:", {
                message: error?.message,
                code: error?.code,
                details: error?.details,
                hint: error?.hint
            });
            // Functions now return default values, so we can continue with null/empty defaults
            if (!referralCode) referralCode = null;
            if (!referralStats) referralStats = [];
            if (!referralWallet) {
                referralWallet = {
                    user_id: userData.id,
                    available_points: 0,
                    locked_points: 0,
                    total_points: 0
                };
            }
            if (!referralEarnings) referralEarnings = [];
            if (!withdrawalRequests) withdrawalRequests = [];
        }

        const inviteLink =
            referralCode && referralCode.code
                ? `${window.location.origin}/index.html?ref=${referralCode.code}`
                : null;

        return `
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Referral Wallet</h1>
            <p class="text-gray-600">Earn points from referrals and manage your wallet</p>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <!-- Wallet Balance Card -->
            <div class="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-blue-100 text-sm">Available Points</p>
                        <p class="text-3xl font-bold">${(referralWallet?.available_points || 0).toFixed(2)}</p>
                        <p class="text-blue-100 text-sm">₦${((referralWallet?.available_points || 0) * 150).toFixed(0)} NGN</p>
                    </div>
                    <div class="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        <i data-feather="wallet" class="w-6 h-6"></i>
                    </div>
                </div>
            </div>

            <!-- Locked Points Card -->
            <div class="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-yellow-100 text-sm">Locked Points</p>
                        <p class="text-3xl font-bold">${(referralWallet?.locked_points || 0).toFixed(2)}</p>
                        <p class="text-yellow-100 text-sm">Upgrade to unlock</p>
                    </div>
                    <div class="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        <i data-feather="lock" class="w-6 h-6"></i>
                    </div>
                </div>
            </div>

            <!-- Total Earned Card -->
            <div class="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-green-100 text-sm">Total Earned</p>
                        <p class="text-3xl font-bold">${(referralWallet?.total_points || 0).toFixed(2)}</p>
                        <p class="text-green-100 text-sm">All time</p>
                    </div>
                    <div class="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        <i data-feather="trending-up" class="w-6 h-6"></i>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Referral Section -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-xl font-bold mb-4">Your Referral Link</h3>
                <div class="space-y-4">
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 class="font-semibold text-gray-900 mb-2">Share Your Invite Link</h4>
                        <p class="text-gray-600 text-sm mb-4">Share this link with friends and earn commission from their activities!</p>
                        
                        ${
                            inviteLink
                                ? `
                            <div class="flex items-center space-x-2 mb-4">
                                <input type="text" value="${inviteLink}" readonly 
                                       class="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono">
                                <button onclick="copyToClipboard('${inviteLink}')" 
                                        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                    Copy
                                </button>
                            </div>
                            <div class="flex items-center justify-between text-sm text-gray-600">
                                <span>Referral Code: <span class="font-mono font-semibold">${referralCode.code}</span></span>
                                <span>Total Referrals: <span class="font-semibold">${referralCode.total_referrals}</span></span>
                            </div>
                        `
                                : `
                            <div class="text-center py-4">
                                <p class="text-red-500">Failed to load referral link. Please refresh the page or try again later.</p>
                                <button onclick="location.reload()" class="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                    Refresh Page
                                </button>
                            </div>
                        `
                        }
                    </div>
                    
                    ${
                        referralEarnings.length > 0
                            ? `
                        <div class="border-t border-gray-200 pt-4">
                            <h5 class="font-semibold text-gray-900 mb-3">Recent Earnings</h5>
                            <div class="space-y-2">
                                ${referralEarnings
                                    .slice(0, 5)
                                    .map(
                                        (earning) => `
                                    <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <div class="flex items-center">
                                            <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                                                <span class="text-green-600 font-semibold text-sm">${
                                                    earning.source_type === 'apprentice_commission' ? 'J' : 'S'
                                                }</span>
                                            </div>
                                            <div>
                                                <p class="font-medium text-sm">${
                                                    earning.source_type === 'apprentice_commission' 
                                                        ? 'Apprentice Commission' 
                                                        : 'Subscription Bonus'
                                                }</p>
                                                <p class="text-xs text-gray-500">${new Date(
                                                    earning.created_at
                                                ).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <span class="text-green-600 font-semibold">+${earning.points_earned} pts</span>
                                    </div>
                                `
                                    )
                                    .join("")}
                            </div>
                        </div>
                    `
                            : ""
                    }
                </div>
            </div>
        
            <!-- Withdrawal Section -->
            <div class="bg-white rounded-lg shadow-md p-6">
                <h3 class="text-xl font-bold mb-4">Withdraw Points</h3>
                <div class="space-y-4">
                    ${
                        isWithdrawalWindowOpen
                            ? `
                        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div class="flex items-center">
                                <i data-feather="check-circle" class="w-5 h-5 text-green-600 mr-2"></i>
                                <p class="text-green-800 font-medium">Withdrawal window is open!</p>
                            </div>
                            <p class="text-green-700 text-sm mt-1">You can request withdrawals from 25th to 30th of each month.</p>
                        </div>
                        
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Points to Withdraw</label>
                                <input 
                                    type="number" 
                                    id="withdrawal-points" 
                                    min="20" 
                                    max="${referralWallet?.available_points || 0}"
                                    placeholder="Minimum 20 points"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                <p class="text-xs text-gray-500 mt-1">Available: ${(referralWallet?.available_points || 0).toFixed(2)} points</p>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Payout Method</label>
                                <select id="payout-method" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select payout method</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="mobile_money">Mobile Money</option>
                                </select>
                            </div>
                            
                            <div id="bank-details" class="hidden space-y-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                                    <input type="text" id="bank-name" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                                    <input type="text" id="account-number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                                    <input type="text" id="account-name" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                </div>
                            </div>
                            
                            <div id="mobile-money-details" class="hidden space-y-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                                    <select id="mobile-provider" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">Select provider</option>
                                        <option value="mtn">MTN</option>
                                        <option value="airtel">Airtel</option>
                                        <option value="glo">Glo</option>
                                        <option value="9mobile">9mobile</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                    <input type="text" id="mobile-number" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                </div>
                            </div>
                            
                            <button 
                                id="request-withdrawal" 
                                class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium"
                            >
                                Request Withdrawal
                            </button>
                        </div>
                    `
                            : `
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div class="flex items-center">
                                <i data-feather="clock" class="w-5 h-5 text-yellow-600 mr-2"></i>
                                <p class="text-yellow-800 font-medium">Withdrawal window is closed</p>
                            </div>
                            <p class="text-yellow-700 text-sm mt-1">Withdrawals are only available from 25th to 30th of each month.</p>
                        </div>
                    `
                    }
                    
                    ${
                        withdrawalRequests.length > 0
                            ? `
                        <div class="border-t border-gray-200 pt-4">
                            <h5 class="font-semibold text-gray-900 mb-3">Recent Withdrawals</h5>
                            <div class="space-y-2">
                                ${withdrawalRequests
                                    .slice(0, 3)
                                    .map(
                                        (request) => `
                                    <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                                        <div>
                                            <p class="font-medium text-sm">${request.points_requested} pts</p>
                                            <p class="text-xs text-gray-500">${new Date(request.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <span class="px-2 py-1 text-xs rounded-full ${
                                            request.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            request.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                            request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }">
                                            ${request.status}
                                        </span>
                                    </div>
                                `
                                    )
                                    .join("")}
                            </div>
                        </div>
                    `
                            : ""
                    }
                </div>
            </div>
        </div>
        
        <div class="mt-8 bg-white rounded-lg shadow-md p-6">
            <h3 class="text-xl font-bold mb-4">How Referral System Works</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 class="font-semibold text-gray-900 mb-3">Commission Rates</h4>
                    <div class="space-y-2">
                        <div class="flex justify-between items-center p-2 bg-blue-50 rounded">
                            <span class="text-sm">Creative (₦1,500/mo)</span>
                            <span class="font-semibold text-blue-600">10%</span>
                        </div>
                    </div>
                </div>
                <div>
                    <h4 class="font-semibold text-gray-900 mb-3">Earning Sources</h4>
                    <div class="space-y-2">
                        <div class="flex items-center p-2 bg-gray-50 rounded">
                            <i data-feather="briefcase" class="w-4 h-4 text-blue-500 mr-2"></i>
                            <span class="text-sm">Apprentice job commissions</span>
                        </div>
                        <div class="flex items-center p-2 bg-gray-50 rounded">
                            <i data-feather="credit-card" class="w-4 h-4 text-green-500 mr-2"></i>
                            <span class="text-sm">Member subscription bonuses</span>
                        </div>
                        <div class="flex items-center p-2 bg-gray-50 rounded">
                            <i data-feather="dollar-sign" class="w-4 h-4 text-yellow-500 mr-2"></i>
                            <span class="text-sm">10 pts = ₦1,500</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    },
    jobs: async (userData) => {
        // Get client job requests
        let myJobRequests = [];
        let clientStats = {
            totalJobs: 0,
            openJobs: 0,
            inProgressJobs: 0,
            completedJobs: 0,
            totalSpent: 0,
        };
        
        // Count monthly jobs for free plan users
        let monthlyJobCount = 0;
        const subscriptionPlan = userData?.subscription_plan || "free";
        
        if (subscriptionPlan === "free") {
            try {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                
                const { data: monthlyJobs } = await supabase
                    .from("job_requests")
                    .select("id")
                    .eq("client_id", userData.id)
                    .gte("created_at", startOfMonth.toISOString())
                    .lte("created_at", endOfMonth.toISOString());
                
                monthlyJobCount = monthlyJobs?.length || 0;
            } catch (error) {
                console.error("Error counting monthly jobs:", error);
            }
        }

        try {
            myJobRequests = await getClientJobRequests(userData.id);
            clientStats = await getClientStats(userData.id);
        } catch (error) {
            console.error("Error fetching job requests:", error);
        }

        return `
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Job Requests</h1>
            <p class="text-gray-600">Create and manage job requests for skilled apprentices.</p>
        </div>
        
        <!-- Job Stats Overview -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-blue-100 text-blue-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="briefcase" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">Total Jobs</h3>
                <p class="text-3xl font-bold mt-2 text-blue-600">${
                    clientStats.totalJobs
                }</p>
            </div>
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-green-100 text-green-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="clock" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">Open Jobs</h3>
                <p class="text-3xl font-bold mt-2 text-green-600">${
                    clientStats.openJobs
                }</p>
            </div>
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-yellow-100 text-yellow-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="play" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">In Progress</h3>
                <p class="text-3xl font-bold mt-2 text-yellow-600">${
                    clientStats.inProgressJobs
                }</p>
            </div>
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-orange-100 text-orange-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="check-circle" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">Pending Review</h3>
                <p class="text-3xl font-bold mt-2 text-orange-600">${
                    clientStats.pendingReviewJobs
                }</p>
            </div>
            <div class="stat-card bg-white p-6 rounded-lg shadow text-center">
                <div class="p-3 rounded-full bg-purple-100 text-purple-600 mx-auto w-12 h-12 flex items-center justify-center mb-3">
                    <i data-feather="dollar-sign" class="w-6 h-6"></i>
                </div>
                <h3 class="text-sm font-medium text-gray-500">Total Spent</h3>
                <p class="text-3xl font-bold mt-2 text-purple-600">₦${(
                    clientStats.totalSpent * 1500
                ).toLocaleString()}</p>
            </div>
        </div>

        <!-- Create New Job Request -->
        <div class="bg-white rounded-lg shadow mb-8">
            <div class="p-6 border-b border-gray-200">
                <h3 class="text-xl font-bold text-gray-900">Create New Job Request</h3>
                <p class="text-gray-600">Post a new job for skilled apprentices to apply</p>
                ${
                    subscriptionPlan === "free"
                        ? `
                        <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p class="text-sm text-yellow-800">
                                <i data-feather="info" class="w-4 h-4 inline mr-1"></i>
                                <strong>Free Plan Limit:</strong> You have posted <strong>${monthlyJobCount} of 3</strong> jobs this month.
                                ${monthlyJobCount >= 3 
                                    ? '<span class="text-red-600 font-semibold"> You have reached your monthly limit. Upgrade to Creative plan for unlimited job postings.</span>'
                                    : ` You can post ${3 - monthlyJobCount} more job${3 - monthlyJobCount === 1 ? '' : 's'} this month.`
                                }
                            </p>
                        </div>
                        `
                        : ""
                }
            </div>
            <div class="p-6">
                <form id="create-job-form" class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label for="job-title" class="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                            <input type="text" id="job-title" name="title" required
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., Website Design for Restaurant">
                        </div>
                        <div>
                            <label for="job-location" class="block text-sm font-medium text-gray-700 mb-2">Location</label>
                            <input type="text" id="job-location" name="location"
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., Lagos, Nigeria or Remote">
                        </div>
                    </div>
                    
                    <div>
                        <label for="job-description" class="block text-sm font-medium text-gray-700 mb-2">Job Description</label>
                        <textarea id="job-description" name="description" rows="4" required
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Describe the job requirements, deliverables, and any specific details..."></textarea>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label for="job-budget-min" class="block text-sm font-medium text-gray-700 mb-2">Minimum Budget (₦)</label>
                            <input type="number" id="job-budget-min" name="budgetMin" required min="1500"
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="150000">
                            <p class="text-xs text-gray-500 mt-1">Minimum: ₦1,500</p>
                        </div>
                        <div>
                            <label for="job-budget-max" class="block text-sm font-medium text-gray-700 mb-2">Maximum Budget (₦)</label>
                            <input type="number" id="job-budget-max" name="budgetMax" required min="1500"
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="750000">
                            <p class="text-xs text-gray-500 mt-1">Maximum: No limit</p>
                        </div>
                        <div>
                            <label for="job-deadline" class="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
                            <input type="date" id="job-deadline" name="deadline" required
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                    </div>
                    
                    <div>
                        <label for="job-skills" class="block text-sm font-medium text-gray-700 mb-2">Required Skills</label>
                        <select id="job-skills" name="skillsRequired" multiple
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="photography">Photography</option>
                            <option value="design">Design</option>
                            <option value="programming">Programming</option>
                            <option value="writing">Writing</option>
                            <option value="art">Art & Craft</option>
                            <option value="video">Video Editing</option>
                            <option value="marketing">Digital Marketing</option>
                        </select>
                        <p class="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple skills</p>
                    </div>
                    
                    <div class="flex justify-end">
                        <button type="submit" id="create-job-btn"
                            class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium flex items-center ${
                                subscriptionPlan === "free" && monthlyJobCount >= 3 
                                    ? "opacity-50 cursor-not-allowed" 
                                    : ""
                            }"
                            ${subscriptionPlan === "free" && monthlyJobCount >= 3 ? "disabled" : ""}>
                            <i data-feather="plus" class="w-4 h-4 mr-2"></i>
                            ${subscriptionPlan === "free" && monthlyJobCount >= 3 
                                ? "Monthly Limit Reached" 
                                : "Create Job Request"
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- My Job Requests -->
        <div class="bg-white rounded-lg shadow">
            <div class="p-6 border-b border-gray-200">
                <h3 class="text-xl font-bold text-gray-900">My Job Requests</h3>
                <p class="text-gray-600">Manage your posted jobs and applications</p>
            </div>
            <div class="p-6">
                ${
                    myJobRequests.length > 0
                        ? `
                    <div class="space-y-6">
                        ${myJobRequests
                            .map(
                                (job) => `
                            <div class="border border-gray-200 rounded-lg p-6">
                                <div class="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 class="text-xl font-semibold text-gray-900">${
                                            job.title
                                        }</h4>
                                        <p class="text-gray-600 mt-1">${
                                            job.description
                                        }</p>
                                    </div>
                                    <span class="bg-${
                                        job.status === "open"
                                            ? "green"
                                            : job.status === "in_progress"
                                            ? "blue"
                                            : job.status === "pending_review"
                                            ? "yellow"
                                            : "purple"
                                    }-100 text-${
                                    job.status === "open"
                                        ? "green"
                                        : job.status === "in_progress"
                                        ? "blue"
                                        : job.status === "pending_review"
                                        ? "yellow"
                                        : "purple"
                                }-800 text-xs px-3 py-1 rounded-full capitalize">${job.status.replace(
                                    "_",
                                    " "
                                )}</span>
                                </div>
                                
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                                    <div>
                                        <span class="text-gray-500">Budget:</span>
                                                                <span class="font-medium">₦${(
                                                                    job.budget_min
                                                                ).toLocaleString()}-₦${(
                                    job.budget_max
                                ).toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-500">Location:</span>
                                        <span class="font-medium">${
                                            job.location || "Remote"
                                        }</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-500">Deadline:</span>
                                        <span class="font-medium">${new Date(
                                            job.deadline
                                        ).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span class="text-gray-500">Applications:</span>
                                        <span class="font-medium">${
                                            job.applications?.length || 0
                                        }</span>
                                    </div>
                                </div>
                                
                                ${
                                    job.applications &&
                                    job.applications.length > 0
                                        ? `
                                    <div class="border-t border-gray-200 pt-4">
                                        <h5 class="font-semibold text-gray-900 mb-3">Applications (${
                                            job.applications.length
                                        })</h5>
                                        <div class="space-y-3">
                                            ${job.applications
                                                .map(
                                                    (app) => `
                                                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg" data-apprentice-id="${app.apprentice?.id || ''}">
                                                    <div class="flex items-center">
                                                        <img src="${app.apprentice?.avatar_url || `https://placehold.co/40x40/EBF4FF/3B82F6?text=${
                                                            app.apprentice?.name?.charAt(
                                                                0
                                                            ) || "A"
                                                        }`}" 
                                                             alt="${
                                                                 app.apprentice
                                                                     ?.name
                                                             }" 
                                                             class="w-10 h-10 rounded-full mr-3 object-cover">
                                                        <div class="flex-1">
                                                            <h6 class="font-medium text-gray-900">${
                                                                app.apprentice
                                                                    ?.name ||
                                                                "Anonymous"
                                                            }</h6>
                                                            <p class="text-sm text-gray-600">${
                                                                app.apprentice
                                                                    ?.skill_category || app.apprentice?.skill ||
                                                                "Apprentice"
                                                            }${app.apprentice?.years_of_experience ? ` • ${app.apprentice.years_of_experience} yrs exp` : ''} • ${
                                                        app.apprentice
                                                            ?.location ||
                                                        "Unknown"
                                                    }</p>
                                                            <div id="apprentice-rating-app-${app.id}" class="mt-1">
                                                                <div class="flex items-center space-x-2">
                                                                    <span class="text-xs text-gray-500">Loading rating...</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class="flex items-center space-x-2">
                                                        ${
                                                            app.cv_url
                                                                ? `
                                                            <button class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 view-cv-btn" data-cv-url="${app.cv_url}" data-app-id="${app.id}">
                                                                <i data-feather="file-text" class="w-3 h-3 inline mr-1"></i> View CV
                                                            </button>
                                                        `
                                                                : ''
                                                        }
                                                        ${
                                                            app.status ===
                                                            "pending"
                                                                ? `
                                                            <button class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 accept-app-btn" data-app-id="${app.id}">Accept</button>
                                                            <button class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 reject-app-btn" data-app-id="${app.id}">Reject</button>
                                                        `
                                                                : `
                                                            <span class="bg-${
                                                                app.status ===
                                                                "accepted"
                                                                    ? "green"
                                                                    : "red"
                                                            }-100 text-${
                                                                      app.status ===
                                                                      "accepted"
                                                                          ? "green"
                                                                          : "red"
                                                                  }-800 text-xs px-2 py-1 rounded-full capitalize">${
                                                                      app.status
                                                                  }</span>
                                                        `
                                                        }
                                                    </div>
                                                </div>
                                            `
                                                )
                                                .join("")}
                                        </div>
                                    </div>
                                `
                                        : ""
                                }
                                
                                ${
                                    job.status === "in_progress" && job.assigned_apprentice_id
                                        ? `
                                    <div class="border-t border-gray-200 pt-4">
                                        <h5 class="font-semibold text-gray-900 mb-3">Progress Updates</h5>
                                        <div id="progress-updates-${job.id}" class="progress-updates-container">
                                            <!-- Progress updates will be loaded here -->
                                        </div>
                                        <div class="mt-4">
                                            <button class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm load-progress-updates-btn" 
                                                    data-job-id="${job.id}">
                                                <i data-feather="refresh-cw" class="w-4 h-4 mr-2"></i>
                                                Load Progress Updates
                                            </button>
                                            <button class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm load-final-submissions-btn" 
                                                    data-job-id="${job.id}">
                                                <i data-feather="check-circle" class="w-4 h-4 mr-2"></i>
                                                Load Final Submissions
                                            </button>
                                        </div>
                                        <div id="final-submissions-${job.id}" class="final-submissions-container mt-4">
                                            <!-- Final submissions will be loaded here -->
                                        </div>
                                    </div>
                                `
                                        : ""
                                }
                                
                                <div class="flex justify-end space-x-2 mt-4">
                                    ${
                                        job.status === "pending_review"
                                            ? `
                                        <div class="flex items-center space-x-2">
                                            <span class="text-sm text-gray-600">Review required</span>
                                            <button class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm review-job-btn" data-job-id="${job.id}">Review Job</button>
                                        </div>
                                    `
                                            : `
                                        <button class="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 text-sm">Edit Job</button>
                                        <button class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm delete-job-btn" data-job-id="${job.id}" data-job-title="${job.title}">Delete Job</button>
                                    `
                                    }
                                </div>
                            </div>
                        `
                            )
                            .join("")}
                    </div>
                `
                        : `
                    <div class="text-center py-12">
                        <i data-feather="briefcase" class="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
                        <h4 class="text-xl font-semibold text-gray-700 mb-2">No Job Requests Yet</h4>
                        <p class="text-gray-500">Create your first job request to find skilled apprentices!</p>
                    </div>
                `
                }
            </div>
        </div>
    `;
    },
    leaderboard: (userData, topUsers = []) => `
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900">Leaderboard</h1>
            <p class="text-gray-600">See how you rank among other creators</p>
        </div>
        <div class="bg-white rounded-lg shadow">
            <div class="p-6 border-b">
                <h3 class="text-xl font-bold">Top Creators</h3>
            </div>
            <div class="divide-y">
                ${
                    topUsers.length > 0
                        ? topUsers
                              .map(
                                  (user, index) => `
                    <div class="p-6 flex items-center justify-between ${
                        user.id === userData.id ? "bg-blue-50" : ""
                    }">
                        <div class="flex items-center">
                            <span class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center font-bold text-sm mr-4">${
                                index + 1
                            }</span>
                            <div>
                                <p class="font-semibold">${user.name}</p>
                                <p class="text-sm text-gray-600">${
                                    user.creative_type || "Creator"
                                }</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="font-bold">${(
                                (user.referral_points || 0) +
                                (user.eligibility_points || 0)
                            ).toLocaleString()} pts</p>
                            <p class="text-sm text-gray-500">${
                                user.followers || 0
                            } followers</p>
                        </div>
                    </div>
                `
                              )
                              .join("")
                        : `
                    <div class="p-12 text-center">
                        <i data-feather="users" class="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
                        <p class="text-gray-500">No leaderboard data available yet</p>
                    </div>
                `
                }
            </div>
        </div>
    `,
    wallet: (userData) => `
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 flex items-center">
                <i class="fas fa-wallet mr-3 text-blue-600"></i> My Wallet
            </h1>
            <p class="text-gray-600 mt-2">Manage your funds and transactions</p>
        </div>
        
        <div class="wallet-summary bg-white rounded-lg shadow-lg p-6 mb-6">
            <div class="wallet-balance text-center mb-6">
                <div class="balance-amount text-4xl font-bold text-green-600 mb-2" id="wallet-balance">₦0.00</div>
                <div class="balance-points text-lg text-gray-600" id="wallet-points">0.00 pts</div>
            </div>
            
            <div class="wallet-actions flex gap-4 justify-center flex-wrap">
                <button id="add-funds-btn" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
                    <i class="fas fa-plus mr-2"></i> Add Funds
                </button>
                <button id="withdraw-funds-btn" class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center">
                    <i class="fas fa-money-bill-wave mr-2"></i> Withdraw
                </button>
                <button id="view-transactions-btn" class="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors flex items-center">
                    <i class="fas fa-history mr-2"></i> History
                </button>
            </div>
        </div>
        
        <div class="wallet-transactions bg-white rounded-lg shadow-lg p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
            <div id="wallet-transactions-container">
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                    <p>Loading transactions...</p>
                </div>
            </div>
        </div>
    `,
};

// --- Explore Tab Functions ---
async function fetchRecommendations(userData) {
    try {
        console.log(
            "Fetching recommendations for:",
            userData.creative_type,
            "role:",
            userData.role
        );

        const currentUserRole = userData.role || "member";
        const targetRole =
            currentUserRole === "member" ? "apprentice" : "member";
        let recommendations = [];

        if (currentUserRole === "member") {
            // Members see apprentices with similar skills to their creative type
            const creativeTypeKeywords = {
                Photographer: ["photography", "photo", "camera", "visual"],
                Designer: ["design", "graphic", "ui", "ux", "web"],
                Artisan: ["craft", "art", "handmade", "creative"],
                Student: ["student", "learning", "education"],
                Programmer: [
                    "programming",
                    "coding",
                    "development",
                    "software",
                    "web",
                ],
            };

            const keywords = creativeTypeKeywords[userData.creative_type] || [];
            const allApprentices = await getUsersByRole("apprentice", 20);

            if (keywords.length > 0) {
                recommendations = allApprentices.filter((apprentice) => {
                    const skill = (apprentice.skill || "").toLowerCase();
                    return keywords.some((keyword) =>
                        skill.includes(keyword.toLowerCase())
                    );
                });
            }

            if (recommendations.length < 6) {
                const remainingApprentices = allApprentices.filter(
                    (apprentice) =>
                        !recommendations.find((r) => r.id === apprentice.id)
                );
                recommendations = [
                    ...recommendations,
                    ...remainingApprentices,
                ].slice(0, 6);
            }

            // Fetch ratings for all recommended apprentices
            recommendations = await Promise.all(
                recommendations.map(async (apprentice) => {
                    try {
                        const ratingDetails = await getApprenticeRatingDetails(apprentice.id);
                        return {
                            ...apprentice,
                            rating: ratingDetails.average_rating || 0,
                            totalRatings: ratingDetails.total_ratings || 0
                        };
                    } catch (error) {
                        console.error(`Error fetching rating for apprentice ${apprentice.id}:`, error);
                        return {
                            ...apprentice,
                            rating: 0,
                            totalRatings: 0
                        };
                    }
                })
            );
        } else {
            // Apprentices see members with similar creative types
            const apprenticeSkill = userData.skill || "";
            let targetCreativeType = "";

            if (
                apprenticeSkill.toLowerCase().includes("photo") ||
                apprenticeSkill.toLowerCase().includes("camera")
            ) {
                targetCreativeType = "Photographer";
            } else if (
                apprenticeSkill.toLowerCase().includes("design") ||
                apprenticeSkill.toLowerCase().includes("ui") ||
                apprenticeSkill.toLowerCase().includes("graphic")
            ) {
                targetCreativeType = "Designer";
            } else if (
                apprenticeSkill.toLowerCase().includes("program") ||
                apprenticeSkill.toLowerCase().includes("code") ||
                apprenticeSkill.toLowerCase().includes("web")
            ) {
                targetCreativeType = "Programmer";
            } else if (
                apprenticeSkill.toLowerCase().includes("art") ||
                apprenticeSkill.toLowerCase().includes("craft")
            ) {
                targetCreativeType = "Artisan";
            }

            try {
                if (targetCreativeType) {
                    recommendations = await searchUsers(
                        "",
                        targetCreativeType,
                        "member",
                        6
                    );
                } else {
                    recommendations = await getUsersByRole("member", 6);
                }
            } catch (error) {
                console.log("Error with targeted query, using basic query");
                recommendations = await getUsersByRole("member", 6);
            }
        }

        recommendations = recommendations.filter(
            (user) => user.id !== userData.id
        );
        console.log("Found recommendations:", recommendations.length);
        return recommendations;
    } catch (error) {
        console.error("Error fetching recommendations:", error);
        return [];
    }
}

function attachDynamicEventListeners(tabId, userData) {
    // Gallery modal event handlers (available on all tabs)
    const galleryModal = document.getElementById("gallery-view-modal");
    if (galleryModal) {
        // Close modal when clicking outside
        galleryModal.addEventListener("click", (e) => {
            if (e.target === galleryModal) {
                galleryModal.classList.remove("active");
            }
        });

        // Close modal with close button
        const closeGalleryModal = document.getElementById(
            "close-gallery-modal"
        );
        if (closeGalleryModal) {
            closeGalleryModal.addEventListener("click", () => {
                galleryModal.classList.remove("active");
            });
        }

        // Handle like buttons in gallery modal
        galleryModal.addEventListener("click", async (e) => {
            if (e.target.closest(".like-post-btn")) {
                e.preventDefault();
                e.stopPropagation();

                const likeBtn = e.target.closest(".like-post-btn");
                const postId = likeBtn.dataset.postId;
                const isCurrentlyLiked = likeBtn.dataset.postLiked === "true";

                try {
                    const {
                        data: { user },
                    } = await supabase.auth.getUser();
                    if (!user) {
                        showNotification(
                            "Please log in to like posts",
                            "error"
                        );
                        return;
                    }

                    const result = await togglePostLike(postId, user.id);

                    // Update button state
                    if (result.liked) {
                        likeBtn.classList.remove("text-gray-500");
                        likeBtn.classList.add("text-red-500");
                        likeBtn
                            .querySelector("i")
                            .classList.add("fill-current");
                        likeBtn.dataset.postLiked = "true";
                    } else {
                        likeBtn.classList.remove("text-red-500");
                        likeBtn.classList.add("text-gray-500");
                        likeBtn
                            .querySelector("i")
                            .classList.remove("fill-current");
                        likeBtn.dataset.postLiked = "false";
                    }

                    // Update like count
                    const likeCountEl = likeBtn
                        .closest(".gallery-image-container")
                        .querySelector(".text-xs span:last-child");
                    if (likeCountEl) {
                        const currentCount =
                            parseInt(likeCountEl.textContent) || 0;
                        likeCountEl.textContent = result.liked
                            ? currentCount + 1
                            : Math.max(0, currentCount - 1);
                    }
                } catch (error) {
                    console.error("Error toggling like:", error);
                    showNotification("Failed to update like", "error");
                }
            }
        });
    }

    // Shared functionality
    if (tabId === "settings" || tabId === "profile") {
        const editProfileBtn = document.getElementById(
            "open-edit-profile-modal"
        );
        if (editProfileBtn) {
            editProfileBtn.addEventListener("click", () => {
                document.getElementById("edit-name").value =
                    userData.name || "";
                // Only show creative type for members
                const creativeTypeField =
                    document.getElementById("edit-creative-type");
                if (userData.role === "member") {
                    creativeTypeField.value = userData.creative_type || "";
                    creativeTypeField.parentElement.style.display = "block";
                } else {
                    creativeTypeField.parentElement.style.display = "none";
                }
                editProfileModal.classList.add("active");
            });
        }
    }

    // Member-specific listeners
    if (userData.role === "member") {
        if (tabId === "gallery") {
            const openUploadModalBtn =
                document.getElementById("open-upload-modal");
            if (openUploadModalBtn) {
                openUploadModalBtn.addEventListener("click", () =>
                    uploadModal.classList.add("active")
                );
            }
            const galleryUploadBtn =
                document.getElementById("gallery-upload-btn");
            if (galleryUploadBtn) {
                galleryUploadBtn.addEventListener("click", () =>
                    uploadModal.classList.add("active")
                );
            }
        }

        if (tabId === "explore") {
            setTimeout(() => {
                const searchBtn = document.getElementById("search-btn");
                const searchInput = document.getElementById("search-input");

                if (searchBtn && searchInput) {
                    const newSearchBtn = searchBtn.cloneNode(true);
                    searchBtn.parentNode.replaceChild(newSearchBtn, searchBtn);

                    const newSearchInput = searchInput.cloneNode(true);
                    searchInput.parentNode.replaceChild(
                        newSearchInput,
                        searchInput
                    );

                    newSearchBtn.addEventListener("click", handleSearch);
                    newSearchInput.addEventListener("keypress", (e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleSearch();
                        }
                    });
                }
            }, 100);

            async function handleSearch() {
                const searchInput = document.getElementById("search-input");
                const filterSelect = document.getElementById(
                    "filter-creative-type"
                );
                const searchBtn = document.getElementById("search-btn");

                const searchTerm = searchInput.value.trim();
                const creativeTypeFilter = filterSelect.value;

                if (!searchTerm && !creativeTypeFilter) {
                    alert("Please enter a search term or select a filter.");
                    return;
                }

                searchBtn.disabled = true;
                searchBtn.innerHTML = `<div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>Searching...`;

                const targetRole =
                    userData.role === "member" ? "apprentice" : "member";
                const results = await searchUsers(
                    searchTerm,
                    creativeTypeFilter,
                    targetRole
                );
                await displaySearchResults(results);

                searchBtn.disabled = false;
                searchBtn.innerHTML = `<i data-feather="search" class="w-4 h-4 mr-2"></i>Search`;
                feather.replace();
            }
        }
    }

    // Settings-specific listeners
    if (tabId === "settings") {
        const testStorageBtn = document.getElementById("test-storage-btn");
        if (testStorageBtn) {
            testStorageBtn.addEventListener("click", async () => {
                testStorageBtn.disabled = true;
                testStorageBtn.textContent = "Testing...";

                const success = await testStorageConfiguration();

                if (success) {
                    showNotification(
                        "Storage test completed successfully! Check console for details.",
                        "success"
                    );
                } else {
                    showNotification(
                        "Storage test failed. Check console for details.",
                        "error"
                    );
                }

                testStorageBtn.disabled = false;
                testStorageBtn.innerHTML =
                    '<i data-feather="database" class="w-4 h-4 inline mr-2"></i>Test Storage Configuration';
                feather.replace();
            });
        }
    }
}

function updateFollowerCountInUI(targetUserId) {
    try {
        console.log("Updating UI for user:", targetUserId);

        // Find all follower count elements for this user
        const followerElements = document.querySelectorAll(
            `[data-user-id="${targetUserId}"]`
        );

        followerElements.forEach((element) => {
            // Find the follower count span within this user's card
            const userCard = element.closest(".bg-white");
            if (userCard) {
                // Look for follower count text
                const followerSpans = userCard.querySelectorAll("span");
                followerSpans.forEach((span) => {
                    const text = span.textContent;
                    // Match patterns like "5 followers", "0 followers", etc.
                    if (text.includes(" follower")) {
                        const currentCount = parseInt(
                            text.match(/\d+/)?.[0] || "0"
                        );
                        const newCount = currentCount + 1;
                        span.textContent = `${newCount} follower${
                            newCount !== 1 ? "s" : ""
                        }`;
                        console.log(
                            `Updated follower count from ${currentCount} to ${newCount}`
                        );
                    }
                });
            }
        });
    } catch (error) {
        console.error("Error updating UI:", error);
    }
}

// Global button handlers
document.addEventListener("click", async (e) => {
    // Follow button handler
    if (e.target.classList.contains("follow-btn")) {
        e.preventDefault();
        e.stopPropagation();

        const targetUserId = e.target.dataset.userId;
        const targetUserName = e.target.dataset.userName || "User";

        // Show user profile modal instead of directly following
        await showUserProfileModal(targetUserId, targetUserName);
    }

    // Like button handler
    if (e.target.closest(".like-post-btn")) {
        e.preventDefault();
        e.stopPropagation();

        const likeBtn = e.target.closest(".like-post-btn");
        const postId = likeBtn.dataset.postId;
        const isCurrentlyLiked = likeBtn.dataset.postLiked === "true";

        // Get current user from Supabase
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            alert("Please log in to like posts");
            return;
        }

        try {
            const success = await togglePostLike(user.id, postId);
            if (success) {
                // Update UI
                const heartIcon = likeBtn.querySelector(
                    "i[data-feather='heart']"
                );
                const likeCount = likeBtn.querySelector(".like-count");

                if (isCurrentlyLiked) {
                    // Unlike
                    likeBtn.dataset.postLiked = "false";
                    heartIcon.classList.remove("fill-current");
                    likeBtn.classList.remove("text-red-500");
                    likeBtn.classList.add(
                        "text-gray-400",
                        "hover:text-red-500"
                    );
                    likeCount.textContent = parseInt(likeCount.textContent) - 1;
                } else {
                    // Like
                    likeBtn.dataset.postLiked = "true";
                    heartIcon.classList.add("fill-current");
                    likeBtn.classList.remove(
                        "text-gray-400",
                        "hover:text-red-500"
                    );
                    likeBtn.classList.add("text-red-500");
                    likeCount.textContent = parseInt(likeCount.textContent) + 1;
                }
            }
        } catch (error) {
            console.error("Error toggling like:", error);
            alert("Error liking post. Please try again.");
        }
    }

    // Job application handler
    if (e.target.textContent === "Apply Now") {
        e.preventDefault();
        const jobCard = e.target.closest(".border");
        const jobTitle = jobCard.querySelector("h4").textContent;
        const jobAmount = jobCard.querySelector(".bg-green-100").textContent;

        if (confirm(`Apply for "${jobTitle}" (${jobAmount})?`)) {
            e.target.textContent = "Applied";
            e.target.classList.remove("bg-blue-600", "hover:bg-blue-700");
            e.target.classList.add("bg-green-600", "cursor-not-allowed");
            e.target.disabled = true;

            // Show success notification
            showNotification(
                `Successfully applied for ${jobTitle}!`,
                "success"
            );
        }
    }

    // Withdrawal handler
    if (e.target.textContent === "Withdraw All") {
        e.preventDefault();
        if (
            confirm("Withdraw your entire available balance (₦1,920,000.00)?")
        ) {
            e.target.textContent = "Processing...";
            e.target.disabled = true;

            // Simulate processing
            setTimeout(() => {
                e.target.textContent = "Withdrawal Successful";
                e.target.classList.remove("bg-green-600", "hover:bg-green-700");
                e.target.classList.add("bg-gray-400");
                showNotification(
                    "Withdrawal processed successfully! Funds will be available in 2-3 business days.",
                    "success"
                );
            }, 2000);
        }
    }

    // Event registration handler
    if (
        e.target.textContent === "Register Now" ||
        e.target.textContent === "Join (₦37,500)" ||
        e.target.textContent === "RSVP"
    ) {
        e.preventDefault();
        const eventCard = e.target.closest(".border");
        const eventTitle = eventCard.querySelector("h4").textContent;
        const eventType = eventCard.querySelector(
            ".bg-blue-100, .bg-green-100, .bg-purple-100"
        ).textContent;

        if (
            eventType === "Premium" &&
            e.target.textContent === "Join (₦37,500)"
        ) {
            if (confirm(`Register for "${eventTitle}" for ₦37,500?`)) {
                e.target.textContent = "Registered";
                e.target.classList.remove("bg-green-600", "hover:bg-green-700");
                e.target.classList.add("bg-blue-600", "cursor-not-allowed");
                e.target.disabled = true;
                showNotification(
                    `Successfully registered for ${eventTitle}!`,
                    "success"
                );
            }
        } else {
            e.target.textContent = "Registered";
            e.target.classList.remove(
                "bg-blue-600",
                "hover:bg-blue-700",
                "bg-purple-600",
                "hover:bg-purple-700"
            );
            e.target.classList.add("bg-green-600", "cursor-not-allowed");
            e.target.disabled = true;
            showNotification(
                `Successfully registered for ${eventTitle}!`,
                "success"
            );
        }
    }

    // Course enrollment handler
    if (
        e.target.textContent === "Start Learning" ||
        e.target.textContent === "Enroll Now"
    ) {
        e.preventDefault();
        const courseCard = e.target.closest(".border");
        const courseTitle = courseCard.querySelector("h4").textContent;
        const coursePrice =
            courseCard.querySelector(".text-green-600").textContent;

        if (
            coursePrice === "₦73,500" &&
            e.target.textContent === "Enroll Now"
        ) {
            if (confirm(`Enroll in "${courseTitle}" for ₦73,500?`)) {
                e.target.textContent = "Enrolled";
                e.target.classList.remove("bg-green-600", "hover:bg-green-700");
                e.target.classList.add("bg-blue-600", "cursor-not-allowed");
                e.target.disabled = true;
                showNotification(
                    `Successfully enrolled in ${courseTitle}!`,
                    "success"
                );
            }
        } else {
            e.target.textContent = "Enrolled";
            e.target.classList.remove("bg-blue-600", "hover:bg-blue-700");
            e.target.classList.add("bg-green-600", "cursor-not-allowed");
            e.target.disabled = true;
            showNotification(
                `Successfully enrolled in ${courseTitle}!`,
                "success"
            );
        }
    }

    // Job request handler
    if (e.target.textContent === "Accept Request") {
        e.preventDefault();
        const requestCard = e.target.closest(".border");
        const clientName = requestCard
            .querySelector("h4")
            .textContent.replace("Request from ", "");
        const budget = requestCard.querySelector(".text-green-600").textContent;

        if (confirm(`Accept job request from ${clientName} (${budget})?`)) {
            e.target.textContent = "Accepted";
            e.target.classList.remove("bg-green-600", "hover:bg-green-700");
            e.target.classList.add("bg-blue-600", "cursor-not-allowed");
            e.target.disabled = true;

            // Update status badge
            const statusBadge = requestCard.querySelector(".bg-orange-100");
            statusBadge.textContent = "Accepted";
            statusBadge.classList.remove("bg-orange-100", "text-orange-800");
            statusBadge.classList.add("bg-green-100", "text-green-800");

            showNotification(
                `Job request accepted! You can now communicate with ${clientName}.`,
                "success"
            );
        }
    }

    // Store selling handler
    if (e.target.textContent === "Start Selling") {
        e.preventDefault();
        const storeCard = e.target.closest(".border");
        const productType = storeCard.querySelector("h4").textContent;

        showNotification(
            `Coming soon! You'll be able to sell ${productType} in our digital store.`,
            "info"
        );
    }

    // Job application handler (for apprentices)
    if (e.target.classList.contains("apply-job-btn")) {
        e.preventDefault();
        const jobId = e.target.dataset.jobId;
        const jobCard = e.target.closest(".border");
        const jobTitle = jobCard.querySelector("h4").textContent;

        // Show application modal with CV upload
        showJobApplicationModal(jobId, jobTitle);
    }

    // Job creation handler (for members)
    if (e.target.id === "create-job-btn") {
        e.preventDefault();
        handleJobCreation();
    }

    // Application acceptance/rejection handlers (for members)
    if (e.target.classList.contains("accept-app-btn")) {
        e.preventDefault();
        const appId = e.target.dataset.appId;
        handleApplicationAction(appId, "accepted");
    }

    if (e.target.classList.contains("reject-app-btn")) {
        e.preventDefault();
        const appId = e.target.dataset.appId;
        handleApplicationAction(appId, "rejected");
    }

    // View CV button handler
    if (e.target.classList.contains("view-cv-btn") || e.target.closest(".view-cv-btn")) {
        e.preventDefault();
        const btn = e.target.classList.contains("view-cv-btn") ? e.target : e.target.closest(".view-cv-btn");
        const cvUrl = btn.dataset.cvUrl;
        if (cvUrl) {
            handleViewCV(cvUrl);
        }
    }

    // Rating star click handler
    if (e.target.classList.contains("rating-star")) {
        e.preventDefault();
        const rating = parseInt(e.target.dataset.rating);
        updateRatingDisplay(rating);
    }

    // Close rating modal handlers
    if (e.target.id === "close-rating-modal" || e.target.id === "cancel-rating") {
        e.preventDefault();
        document.getElementById("rating-modal").classList.remove("active");
    }

    // Job progress update handler (for apprentices)
    if (e.target.classList.contains("update-progress-btn")) {
        e.preventDefault();
        const jobId = e.target.dataset.jobId;
        const progress = prompt("Enter progress percentage (0-100):");
        if (progress && !isNaN(progress) && progress >= 0 && progress <= 100) {
            handleJobProgressUpdate(jobId, parseInt(progress));
        }
    }

    // Job completion handler (for apprentices)
    if (e.target.classList.contains("complete-job-btn")) {
        e.preventDefault();
        const jobId = e.target.dataset.jobId;
        if (confirm("Are you sure you want to mark this job as completed?")) {
            handleJobCompletion(jobId);
        }
    }

    // Job review handler (for members)
    if (e.target.classList.contains("review-job-btn")) {
        e.preventDefault();
        const jobId = e.target.dataset.jobId;
        handleJobReview(jobId);
    }

    // Delete job handler (for members)
    if (e.target.classList.contains("delete-job-btn")) {
        e.preventDefault();
        const jobId = e.target.dataset.jobId;
        const jobTitle = e.target.dataset.jobTitle;
        handleJobDelete(jobId, jobTitle);
    }

    // Star rating handler
    if (e.target.classList.contains("star-btn")) {
        const rating = parseInt(e.target.dataset.rating);
        const stars = document.querySelectorAll(".star-btn");
        const ratingText = document.getElementById("rating-text");
        
        // Update star colors
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.remove("text-gray-300");
                star.classList.add("text-yellow-400");
            } else {
                star.classList.remove("text-yellow-400");
                star.classList.add("text-gray-300");
            }
        });
        
        // Update rating text
        const ratingTexts = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
        ratingText.textContent = `${rating} star${rating > 1 ? 's' : ''} - ${ratingTexts[rating]}`;
        
        // Store the rating value
        document.getElementById("rating-slider").value = rating;
    }

    // Review decision change handler (show/hide rating section)
    if (e.target.name === "review-decision") {
        const ratingSection = document.getElementById("rating-section");
        if (ratingSection) {
            if (e.target.value === "approve") {
                ratingSection.style.display = "block";
            } else {
                ratingSection.style.display = "none";
                // Reset rating when hiding
                document.getElementById("rating-slider").value = "0";
                const stars = document.querySelectorAll(".star-btn");
                const ratingText = document.getElementById("rating-text");
                stars.forEach(star => {
                    star.classList.remove("text-yellow-400");
                    star.classList.add("text-gray-300");
                });
                ratingText.textContent = "Select a rating";
            }
        }
    }

    // Progress update submission handler (for apprentices)
    if (e.target.classList.contains("submit-progress-update-btn")) {
        e.preventDefault();
        const jobId = e.target.dataset.jobId;
        openProgressUpdateModal(jobId);
    }

    // Final work submission handler (for apprentices)
    if (e.target.classList.contains("submit-final-work-btn")) {
        e.preventDefault();
        const jobId = e.target.dataset.jobId;
        openFinalWorkModal(jobId);
    }

    // Load progress updates handler (for members)
    if (e.target.classList.contains("load-progress-updates-btn")) {
        e.preventDefault();
        const jobId = e.target.dataset.jobId;
        await loadProgressUpdates(jobId);
    }

    // Load progress updates handler (for apprentices)
    if (e.target.classList.contains("load-apprentice-progress-updates-btn")) {
        e.preventDefault();
        const jobId = e.target.dataset.jobId;
        await loadApprenticeProgressUpdates(jobId);
    }

    // Load final submissions handler (for members)
    if (e.target.classList.contains("load-final-submissions-btn")) {
        e.preventDefault();
        const jobId = e.target.dataset.jobId;
        await loadFinalSubmissions(jobId);
    }

    // Progress update feedback handler (for members)
    if (e.target.classList.contains("feedback-progress-update-btn")) {
        e.preventDefault();
        const updateId = e.target.dataset.updateId;
        handleProgressUpdateFeedback(updateId);
    }

    // Final submission review handler (for members)
    if (e.target.classList.contains("review-final-submission-btn")) {
        e.preventDefault();
        const submissionId = e.target.dataset.submissionId;
        handleFinalSubmissionReview(submissionId);
    }

    // Gallery view handler (for viewing apprentice galleries)
    if (e.target.classList.contains("view-gallery-btn")) {
        e.preventDefault();
        const userId = e.target.dataset.userId;
        const userName = e.target.dataset.userName;
        handleGalleryView(userId, userName);
    }

    // Subscription upgrade handler
    if (e.target.classList.contains("upgrade-btn")) {
        e.preventDefault();
        const planKey = e.target.dataset.plan;
        const plan = subscriptionPlans[planKey];
        if (plan) {
            showSubscriptionPaymentModal(planKey, plan);
        }
    }

    // Quick action handlers for apprentice home page
    if (e.target.textContent === "Update Portfolio") {
        e.preventDefault();
        // Switch to gallery tab
        const galleryTab = document.querySelector('[data-tab="gallery"]');
        if (galleryTab) {
            galleryTab.click();
            showNotification(
                "Switched to Gallery tab. You can now upload new work!",
                "info"
            );
        }
    }

    if (e.target.textContent === "Track Jobs") {
        e.preventDefault();
        // Switch to jobs tab
        const jobsTab = document.querySelector('[data-tab="jobs"]');
        if (jobsTab) {
            jobsTab.click();
            showNotification(
                "Switched to Jobs & Requests tab. Track your job pipeline!",
                "info"
            );
        }
    }

    if (e.target.textContent === "Withdraw Earnings") {
        e.preventDefault();
        // Switch to earnings tab
        const earningsTab = document.querySelector('[data-tab="earnings"]');
        if (earningsTab) {
            earningsTab.click();
            showNotification(
                "Switched to Earnings tab. Manage your finances!",
                "info"
            );
        }
    }

    // Profile update handler
    if (e.target.textContent === "Edit Profile") {
        e.preventDefault();
        const editProfileModal = document.getElementById("edit-profile-modal");
        if (editProfileModal) {
            editProfileModal.classList.add("active");

            // Pre-fill form with current user data
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user) {
                const userData = await getUserProfile(user.id);
                const nameInput = document.getElementById("edit-name");
                const creativeTypeInput =
                    document.getElementById("edit-creative-type");
                const descriptionInput =
                    document.getElementById("edit-description");
                const typeLabel = document.getElementById("edit-type-label");

                // Update label based on user role
                if (typeLabel) {
                    typeLabel.textContent =
                        userData.role === "apprentice"
                            ? "Skill"
                            : "Creative Type";
                }

                if (nameInput) nameInput.value = userData.name || "";
                if (creativeTypeInput)
                    creativeTypeInput.value =
                        userData.skill || userData.creative_type || "";
                if (descriptionInput)
                    descriptionInput.value = userData.description || "";
            }
        }
    }
});

async function displaySearchResults(results) {
    const searchResultsDiv = document.getElementById("search-results");
    if (!searchResultsDiv) return;

    if (results.length === 0) {
        searchResultsDiv.innerHTML = `
            <h3 class="text-xl font-bold text-gray-900 mb-4">Search Results</h3>
            <div class="text-center py-8">
                <i data-feather="search" class="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
                <p class="text-gray-500">No users found matching your search criteria</p>
            </div>
        `;
    } else {
        // Fetch ratings for apprentices in search results
        const resultsWithRatings = await Promise.all(
            results.map(async (user) => {
                if (user.role === "apprentice") {
                    try {
                        const ratingDetails = await getApprenticeRatingDetails(user.id);
                        return {
                            ...user,
                            rating: ratingDetails.average_rating || 0,
                            totalRatings: ratingDetails.total_ratings || 0
                        };
                    } catch (error) {
                        console.error(`Error fetching rating for apprentice ${user.id}:`, error);
                        return {
                            ...user,
                            rating: 0,
                            totalRatings: 0
                        };
                    }
                }
                return user;
            })
        );

        searchResultsDiv.innerHTML = `
            <h3 class="text-xl font-bold text-gray-900 mb-4">Search Results (${
                resultsWithRatings.length
            })</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${resultsWithRatings
                    .map(
                        (user) => `
                    <div class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                        <div class="flex items-center mb-4">
                            <img src="https://placehold.co/60x60/EBF4FF/3B82F6?text=${
                                user.name
                                    ? user.name.charAt(0).toUpperCase()
                                    : "U"
                            }" 
                                 alt="${user.name}" 
                                 class="w-12 h-12 rounded-full mr-4">
                            <div>
                                <h4 class="font-semibold text-gray-900">${
                                    user.name || "Unknown User"
                                }</h4>
                                <p class="text-sm text-gray-600">${
                                    user.role === "apprentice"
                                        ? user.skill || "Apprentice"
                                        : user.creative_type || "Creative"
                                }</p>
                                ${
                                    user.location
                                        ? `<p class="text-xs text-gray-500">${user.location}</p>`
                                        : ""
                                }
                            </div>
                        </div>
                        <div class="flex justify-between items-center text-sm text-gray-500 mb-4">
                            <span>${user.followers || 0} followers</span>
                            ${
                                user.role === "member"
                                    ? `
                                <span>${(
                                    (user.referral_points || 0) +
                                    (user.eligibility_points || 0)
                                ).toLocaleString()} pts</span>
                            `
                                    : user.role === "apprentice" && user.rating > 0
                                    ? `
                                <div class="flex items-center">
                                    <div class="flex items-center mr-2">
                                        ${Array.from({ length: 5 }, (_, i) => 
                                            `<i data-feather="star" class="w-3 h-3 ${i < Math.floor(user.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}"></i>`
                                        ).join('')}
                                    </div>
                                    <span class="text-xs">${user.rating.toFixed(1)} (${user.totalRatings})</span>
                                </div>
                            `
                                    : user.role === "apprentice"
                                    ? `<span class="text-xs text-gray-400">No ratings yet</span>`
                                    : ""
                            }
                        </div>
                        <button class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 follow-btn" 
                                data-user-id="${user.id}">
                            ${user.role === "apprentice" ? "Connect" : "Follow"}
                        </button>
                    </div>
                `
                    )
                    .join("")}
            </div>
        `;
    }

    searchResultsDiv.classList.remove("hidden");
    if (typeof feather !== "undefined") {
        feather.replace();
    }
}

async function loadTrendingCreators(userData) {
    try {
        console.log("Loading trending creators...");
        const trending = await getTrendingCreators(userData.role || "member");
        const trendingList = document.getElementById("trending-creators-list");

        if (!trendingList) return;

        if (trending.length === 0) {
            trendingList.innerHTML = `
                <div class="p-6 text-center text-gray-500">
                    <i data-feather="users" class="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
                    <p>No trending creators found</p>
                </div>
            `;
        } else {
            trendingList.innerHTML = trending
                .map(
                    (user, index) => `
                <div class="p-4 flex items-center justify-between border-b last:border-b-0 hover:bg-gray-50">
                    <div class="flex items-center">
                        <span class="w-8 h-8 bg-gradient-to-r from-pink-500 to-violet-500 text-white rounded-full flex items-center justify-center font-bold text-sm mr-4">
                            ${index + 1}
                        </span>
                        <img src="https://placehold.co/40x40/EBF4FF/3B82F6?text=${
                            user.name ? user.name.charAt(0).toUpperCase() : "U"
                        }" 
                             alt="${user.name}" 
                             class="w-10 h-10 rounded-full mr-3">
                        <div>
                            <p class="font-semibold text-gray-900">${
                                user.name || "Unknown User"
                            }</p>
                            <p class="text-sm text-gray-600">${
                                user.role === "apprentice"
                                    ? user.skill || "Apprentice"
                                    : user.creative_type || "Creative"
                            }</p>
                            ${
                                user.location
                                    ? `<p class="text-xs text-gray-500">${user.location}</p>`
                                    : ""
                            }
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <div class="text-right text-sm">
                            <p class="font-semibold">${
                                user.followers || 0
                            } followers</p>
                            ${
                                user.role === "member"
                                    ? `
                                <p class="text-gray-500">${(
                                    (user.referral_points || 0) +
                                    (user.eligibility_points || 0)
                                ).toLocaleString()} pts</p>
                            `
                                    : ""
                            }
                        </div>
                        <button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 follow-btn text-sm" 
                                data-user-id="${user.id}">
                            ${
                                userData.role === "member" &&
                                user.role === "apprentice"
                                    ? "Connect"
                                    : "Follow"
                            }
                        </button>
                    </div>
                </div>
            `
                )
                .join("");
        }

        if (typeof feather !== "undefined") {
            feather.replace();
        }
    } catch (error) {
        console.error("Error loading trending creators:", error);
        const trendingList = document.getElementById("trending-creators-list");
        if (trendingList) {
            trendingList.innerHTML = `
                <div class="p-6 text-center text-red-500">
                    <p>Error loading trending creators</p>
                </div>
            `;
        }
    }
}

// --- Edit Profile ---
async function handleProfileUpdate(e, userData) {
    e.preventDefault();
    const newName = document.getElementById("edit-name").value;
    const newCreativeType = document.getElementById("edit-creative-type").value;
    const newDescription = document.getElementById("edit-description").value;

    const spinner = document.getElementById("edit-spinner");
    const submitBtn = document.getElementById("submit-edit-profile");

    if (spinner) spinner.classList.remove("hidden");
    if (submitBtn) submitBtn.disabled = true;

    try {
        const dataToUpdate = { name: newName, description: newDescription };
        if (userData.role === "member") {
            dataToUpdate.creative_type = newCreativeType;
        } else if (userData.role === "apprentice") {
            dataToUpdate.skill = newCreativeType; // For apprentices, creative-type field is used for skill
        }

        await updateUserProfile(userData.id, dataToUpdate);

        // Update userData object
        userData.name = newName;
        userData.description = newDescription;
        if (userData.role === "member") {
            userData.creative_type = newCreativeType;
        } else if (userData.role === "apprentice") {
            userData.skill = newCreativeType;
        }

        // Update UI elements immediately
        userNameEl.textContent = userData.name;
        const activeTab = userData.role === "member" ? "profile" : "settings";
        await switchContent(activeTab, userData);

        editProfileModal.classList.remove("active");
        alert("Profile updated successfully!");
    } catch (error) {
        console.error("Error updating profile:", error);
        alert("Failed to update profile. Please try again.");
    } finally {
        if (spinner) spinner.classList.add("hidden");
        if (submitBtn) submitBtn.disabled = false;
    }
}

// --- Delete Post ---
async function handlePostDelete(postId, userData) {
    try {
        const spinner = document.getElementById("delete-spinner");
        const confirmBtn = document.getElementById("confirm-delete-post");

        if (spinner) spinner.classList.remove("hidden");
        if (confirmBtn) confirmBtn.disabled = true;

        await deletePost(postId, userData.id);

        // Close modal
        deletePostModal.classList.remove("active");

        // Show success message
        showNotification("Post deleted successfully!", "success");

        // Refresh gallery
        await refreshGallery(userData);
    } catch (error) {
        console.error("Error deleting post:", error);

        let errorMessage = "Failed to delete post. Please try again.";
        if (error.message.includes("own posts")) {
            errorMessage = "You can only delete your own posts.";
        }

        showNotification(errorMessage, "error");
    } finally {
        const spinner = document.getElementById("delete-spinner");
        const confirmBtn = document.getElementById("confirm-delete-post");

        if (spinner) spinner.classList.add("hidden");
        if (confirmBtn) confirmBtn.disabled = false;
    }
}

// --- Upload Work ---
async function handleWorkUpload(e, userData) {
    e.preventDefault();
    const title = document.getElementById("upload-title").value;
    const description = document.getElementById("upload-description").value;
    const file = document.getElementById("upload-file").files[0];

    if (!file) {
        alert("Please select an image to upload.");
        return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
        alert("Please select an image file (JPEG, PNG, GIF, etc.).");
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB.");
        return;
    }

    const spinner = document.getElementById("upload-spinner");
    const submitBtn = document.getElementById("submit-upload");

    spinner.classList.remove("hidden");
    submitBtn.disabled = true;

    try {
        console.log("Starting upload process...");
        console.log("File details:", {
            name: file.name,
            size: file.size,
            type: file.type,
        });

        // Check storage bucket accessibility first
        console.log("🔍 Checking storage bucket accessibility...");
        const bucketAccessible = await checkStorageBucket("posts");
        console.log("📊 Bucket accessibility result:", bucketAccessible);

        if (!bucketAccessible) {
            throw new Error(
                "Storage bucket 'posts' is not accessible. Please check your Supabase storage configuration and policies."
            );
        }
        console.log("✅ Storage bucket is accessible");

        // 1. Upload image to Supabase Storage
        const filePath = `posts/${userData.id}/${Date.now()}_${file.name}`;
        console.log("Uploading file to path:", filePath);

        // Use the improved upload function that doesn't try to create buckets
        const { data, error } = await supabase.storage
            .from("posts")
            .upload(filePath, file, {
                cacheControl: "3600",
                upsert: false,
            });

        if (error) {
            console.error("Upload error:", error);
            throw new Error(`Failed to upload file: ${error.message}`);
        }

        console.log("File uploaded successfully:", data);

        // 2. Get the public URL for the uploaded file
        const imageUrl = getFileUrl("posts", filePath);
        console.log("Generated image URL:", imageUrl);
        console.log("Image URL type:", typeof imageUrl);
        console.log("Image URL value:", imageUrl);

        // Validate the URL format
        if (!imageUrl || !imageUrl.startsWith("http")) {
            throw new Error("Invalid image URL generated");
        }

        // Test if the image URL is accessible
        try {
            const imgTest = new Image();
            imgTest.onload = () => console.log("Image URL is accessible");
            imgTest.onerror = () =>
                console.warn("Image URL might not be accessible yet");
            imgTest.src = imageUrl;
        } catch (imgError) {
            console.warn("Could not test image URL:", imgError);
        }

        // 3. Add post data to Supabase
        await addPost(userData.id, title, description, imageUrl);

        // 4. Award points for uploading
        await incrementUserPoints(userData.id, "eligibility_points", 50);
        userData.eligibility_points = (userData.eligibility_points || 0) + 50; // Update local user data

        // 5. Reset form and close modal
        uploadWorkForm.reset();
        uploadModal.classList.remove("active");

        // Show success message
        showNotification(
            "Your work has been uploaded successfully!",
            "success"
        );

        // 6. Refresh gallery view
        await refreshGallery(userData);
    } catch (error) {
        console.error("Error uploading work:", error);
        console.error("Error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });

        let errorMessage =
            "An error occurred while uploading. Please try again.";

        if (error.message.includes("bucket")) {
            errorMessage =
                "Storage issue detected. Please try again in a moment.";
        } else if (error.message.includes("permission")) {
            errorMessage =
                "Permission denied. Please check your account status.";
        } else if (error.message.includes("network")) {
            errorMessage = "Network error. Please check your connection.";
        } else if (error.message.includes("Invalid image URL")) {
            errorMessage = "Failed to generate image URL. Please try again.";
        } else if (error.message.includes("Failed to upload file")) {
            errorMessage =
                "File upload failed. Please check your file and try again.";
        }

        // Show detailed error in console and notification
        console.error("User-friendly error message:", errorMessage);
        showNotification(errorMessage, "error");
    } finally {
        spinner.classList.add("hidden");
        submitBtn.disabled = false;
    }
}

// --- Image Viewer Functions ---
function setupImageViewer() {
    // Handle view image button clicks
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("view-image-btn")) {
            const imageUrl = e.target.dataset.imageUrl;
            const title = e.target.dataset.title;
            openImageViewer(imageUrl, title);
        }

        if (e.target.closest("#close-image-viewer")) {
            closeImageViewer();
        }
    });

    // Close image viewer with Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeImageViewer();
        }
    });
}

function openImageViewer(imageUrl, title, description = "") {
    const modal = document.getElementById("image-viewer-modal");
    const image = document.getElementById("viewer-image");
    const titleEl = document.getElementById("viewer-title");

    if (modal && image && titleEl) {
        image.src = imageUrl;
        titleEl.textContent = title;

        // Add description if provided
        if (description) {
            const descriptionEl = document.getElementById("viewer-description");
            if (descriptionEl) {
                descriptionEl.textContent = description;
                descriptionEl.style.display = "block";
            }
        }

        modal.classList.add("active");
        document.body.style.overflow = "hidden"; // Prevent background scrolling
    }
}

function closeImageViewer() {
    const modal = document.getElementById("image-viewer-modal");
    if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = ""; // Restore scrolling
    }
}

// --- Notification Center (In-app feed) ---
async function initializeNotificationCenter(userData) {
    if (
        !notificationBell ||
        !notificationList ||
        notificationState.initialized
    ) {
        return;
    }

    notificationState.initialized = true;
    notificationState.userId = userData.id;

    if (typeof injectNotificationStyles === "function") {
        injectNotificationStyles();
    }

    await refreshNotifications();

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

    if (markAllNotificationsBtn) {
        markAllNotificationsBtn.addEventListener("click", async () => {
            if (!notificationState.userId) return;
            try {
                await markAllNotificationsAsRead(notificationState.userId);
                notificationState.items = notificationState.items.map(
                    (item) => ({
                        ...item,
                        is_read: true,
                        read_at: item.read_at || new Date().toISOString(),
                    })
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

    notificationList.addEventListener("click", async (event) => {
        const button = event.target.closest(".mark-read-btn");
        if (!button) return;
        const notificationId = button.dataset.notificationId;
        if (!notificationId) return;

        try {
            await markNotificationAsRead(notificationId);
            notificationState.items = notificationState.items.map((item) =>
                item.id === notificationId
                    ? {
                          ...item,
                          is_read: true,
                          read_at: item.read_at || new Date().toISOString(),
                      }
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

    notificationState.channel = subscribeToNotifications(
        notificationState.userId,
        {
            onInsert: handleIncomingNotification,
            onError: (err) =>
                console.error("Notification channel error:", err),
        }
    );
}

async function refreshNotifications() {
    if (!notificationState.userId) return;
    try {
        const [itemsResult, unreadResult] = await Promise.allSettled([
            getUserNotifications(notificationState.userId, 20, 0),
            getUnreadNotificationCount(notificationState.userId),
        ]);

        if (itemsResult.status === "fulfilled") {
            notificationState.items = itemsResult.value || [];
        } else {
            console.error("Failed to load notifications list:", itemsResult.reason);
        }

        if (unreadResult.status === "fulfilled") {
            notificationState.unreadCount = unreadResult.value || 0;
        } else {
            console.error(
                "Failed to load unread notification count:",
                unreadResult.reason
            );
            // Keep existing count or fall back to 0
            notificationState.unreadCount = notificationState.unreadCount || 0;
        }

        renderNotificationList();
        updateNotificationBadge();
    } catch (error) {
        console.error("Failed to load notifications:", error);
    }
}

function handleIncomingNotification(notification) {
    notificationState.items = [notification, ...notificationState.items].slice(
        0,
        50
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
    if (!notificationList) return;
    if (!notificationState.items.length) {
        notificationList.innerHTML =
            '<p class="text-sm text-gray-500 p-4">You’re all caught up.</p>';
        return;
    }

    notificationList.innerHTML = notificationState.items
        .map((notification) => {
            const isUnread = !notification.is_read;
            return `
                <div class="px-4 py-3 ${
                    isUnread ? "bg-blue-50" : "bg-white"
                }">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-sm font-semibold text-gray-900">${
                                notification.title
                            }</p>
                            <p class="text-xs text-gray-600 mt-1">${
                                notification.message
                            }</p>
                            <p class="text-[11px] text-gray-400 mt-2">${formatRelativeTime(
                                notification.created_at
                            )}</p>
                        </div>
                        ${
                            isUnread
                                ? `<button class="text-xs text-blue-600 hover:underline mark-read-btn" data-notification-id="${notification.id}">Mark read</button>`
                                : ""
                        }
                    </div>
                </div>
            `;
        })
        .join("");
}

function updateNotificationBadge() {
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
    if (!notificationPanel) return;
    const shouldOpen =
        typeof forceState === "boolean"
            ? forceState
            : notificationPanel.classList.contains("hidden");

    if (shouldOpen) {
        notificationPanel.classList.remove("hidden");
        setTimeout(() => {
            document.addEventListener(
                "click",
                handleNotificationOutsideClick
            );
        }, 0);
    } else {
        notificationPanel.classList.add("hidden");
        document.removeEventListener(
            "click",
            handleNotificationOutsideClick
        );
    }
}

function handleNotificationOutsideClick(event) {
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

function formatRelativeTime(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    const diffMs = Date.now() - date.getTime();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) return "Just now";
    if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
    if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
    if (diffMs < day * 7) return `${Math.floor(diffMs / day)}d ago`;
    return date.toLocaleDateString();
}

// --- Notification System ---
function showNotification(message, type = "info") {
    // Create notification container if it doesn't exist
    let notificationContainer = document.getElementById(
        "notification-container"
    );
    if (!notificationContainer) {
        notificationContainer = document.createElement("div");
        notificationContainer.id = "notification-container";
        notificationContainer.className = "fixed top-4 right-4 z-50 space-y-2";
        document.body.appendChild(notificationContainer);
    }

    // Create notification element
    const notification = document.createElement("div");
    notification.className = `notification bg-white border-l-4 p-4 shadow-lg rounded-r-lg max-w-sm transform transition-all duration-300 translate-x-full`;

    // Set border color based on type
    const borderColors = {
        success: "border-green-500",
        error: "border-red-500",
        warning: "border-yellow-500",
        info: "border-blue-500",
    };
    notification.classList.add(borderColors[type] || borderColors.info);

    // Set icon and text color based on type
    const iconColors = {
        success: "text-green-500",
        error: "text-red-500",
        warning: "text-yellow-500",
        info: "text-blue-500",
    };
    const textColors = {
        success: "text-green-700",
        error: "text-red-700",
        warning: "text-yellow-700",
        info: "text-blue-700",
    };

    const icons = {
        success: "check-circle",
        error: "alert-circle",
        warning: "alert-triangle",
        info: "info",
    };

    notification.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <i data-feather="${icons[type] || icons.info}" class="w-5 h-5 ${
        iconColors[type] || iconColors.info
    }"></i>
            </div>
            <div class="ml-3">
                <p class="text-sm font-medium ${
                    textColors[type] || textColors.info
                }">${message}</p>
            </div>
            <div class="ml-auto pl-3">
                <button class="text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.parentElement.remove()">
                    <i data-feather="x" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;

    // Add to container
    notificationContainer.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.classList.remove("translate-x-full");
    }, 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add("translate-x-full");
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);

    // Replace feather icons
    if (typeof feather !== "undefined") {
        feather.replace();
    }
}

// --- Event Listeners Setup ---
function setupEventListeners(userData) {
    console.log("Setting up event listeners");

    // Logout
    if (logoutButton) {
        logoutButton.addEventListener("click", handleLogout);
    }

    // Navigation
    if (mainNav) {
        mainNav.addEventListener("click", async (e) => {
            const tabButton = e.target.closest("[data-tab]");
            if (tabButton && !tabButton.disabled) {
                const tabId = tabButton.dataset.tab;
                await switchContent(tabId, userData);
            }
        });
    }

    // Modals
    if (editProfileModal) {
        const cancelBtn = editProfileModal.querySelector(
            "#cancel-edit-profile"
        );
        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                editProfileModal.classList.remove("active");
            });
        }
    }

    if (uploadModal) {
        const cancelBtn = uploadModal.querySelector("#cancel-upload");
        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                uploadModal.classList.remove("active");
            });
        }
    }

    if (deletePostModal) {
        const cancelBtn = deletePostModal.querySelector("#cancel-delete-post");
        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                deletePostModal.classList.remove("active");
            });
        }
    }

    // Job Review Modal
    if (jobReviewModal) {
        const closeBtn = jobReviewModal.querySelector("#close-review-modal");
        const cancelBtn = jobReviewModal.querySelector("#cancel-review");

        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                jobReviewModal.classList.remove("active");
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                jobReviewModal.classList.remove("active");
            });
        }

        // Close modal when clicking outside
        jobReviewModal.addEventListener("click", (e) => {
            if (e.target === jobReviewModal) {
                jobReviewModal.classList.remove("active");
            }
        });
    }

    // Forms
    if (editProfileForm) {
        editProfileForm.addEventListener("submit", (e) =>
            handleProfileUpdate(e, userData)
        );
    }

    if (
        uploadWorkForm &&
        (userData.role === "member" || userData.role === "apprentice")
    ) {
        uploadWorkForm.addEventListener("submit", (e) =>
            handleWorkUpload(e, userData)
        );
    }

    // Job Review Form
    if (jobReviewForm) {
        jobReviewForm.addEventListener("submit", handleJobReviewSubmission);
    }

    // Progress Update Modal
    if (progressUpdateModal) {
        const closeBtn = progressUpdateModal.querySelector("#close-progress-update-modal");
        const cancelBtn = progressUpdateModal.querySelector("#cancel-progress-update");

        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                progressUpdateModal.classList.remove("active");
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                progressUpdateModal.classList.remove("active");
            });
        }

        // Close modal when clicking outside
        progressUpdateModal.addEventListener("click", (e) => {
            if (e.target === progressUpdateModal) {
                progressUpdateModal.classList.remove("active");
            }
        });
    }

    // Final Work Modal
    if (finalWorkModal) {
        const closeBtn = finalWorkModal.querySelector("#close-final-work-modal");
        const cancelBtn = finalWorkModal.querySelector("#cancel-final-work");

        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                finalWorkModal.classList.remove("active");
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                finalWorkModal.classList.remove("active");
            });
        }

        // Close modal when clicking outside
        finalWorkModal.addEventListener("click", (e) => {
            if (e.target === finalWorkModal) {
                finalWorkModal.classList.remove("active");
            }
        });
    }

    // Progress Feedback Modal
    if (progressFeedbackModal) {
        const closeBtn = progressFeedbackModal.querySelector("#close-progress-feedback-modal");
        const cancelBtn = progressFeedbackModal.querySelector("#cancel-progress-feedback");

        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                progressFeedbackModal.classList.remove("active");
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                progressFeedbackModal.classList.remove("active");
            });
        }

        // Close modal when clicking outside
        progressFeedbackModal.addEventListener("click", (e) => {
            if (e.target === progressFeedbackModal) {
                progressFeedbackModal.classList.remove("active");
            }
        });
    }

    // Progress Update Form
    if (progressUpdateForm) {
        progressUpdateForm.addEventListener("submit", handleProgressUpdateSubmission);
    }

    // Final Work Form
    if (finalWorkForm) {
        finalWorkForm.addEventListener("submit", handleFinalWorkSubmission);
    }

    // Progress Feedback Form
    if (progressFeedbackForm) {
        progressFeedbackForm.addEventListener("submit", handleProgressFeedbackSubmission);
    }

    // Final Submission Review Form
    if (finalSubmissionReviewForm) {
        finalSubmissionReviewForm.addEventListener("submit", handleFinalSubmissionReviewSubmission);
    }

    // Rating Form
    const ratingForm = document.getElementById("rating-form");
    if (ratingForm) {
        ratingForm.addEventListener("submit", handleRatingSubmission);
    }

    // Dispute Modal
    const disputeModal = document.getElementById("dispute-modal");
    if (disputeModal) {
        const closeBtn = disputeModal.querySelector("#close-dispute-modal");
        const cancelBtn = disputeModal.querySelector("#cancel-dispute");
        const disputeForm = document.getElementById("dispute-form");

        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                disputeModal.classList.remove("active");
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                disputeModal.classList.remove("active");
            });
        }

        if (disputeForm) {
            disputeForm.addEventListener("submit", handleDisputeSubmission);
        }

        // Close modal when clicking outside
        disputeModal.addEventListener("click", (e) => {
            if (e.target === disputeModal) {
                disputeModal.classList.remove("active");
            }
        });

        // Preview evidence files
        const evidenceInput = document.getElementById("dispute-evidence");
        if (evidenceInput) {
            evidenceInput.addEventListener("change", (e) => {
                const preview = document.getElementById("dispute-evidence-preview");
                if (preview && e.target.files.length > 0) {
                    preview.innerHTML = Array.from(e.target.files).map(file => 
                        `<p class="text-sm text-gray-600"><i data-feather="file" class="w-4 h-4 inline mr-1"></i>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</p>`
                    ).join('');
                    if (typeof feather !== "undefined") {
                        feather.replace();
                    }
                }
            });
        }
    }

    // Final Submission Review Modal
    if (finalSubmissionReviewModal) {
        const closeBtn = finalSubmissionReviewModal.querySelector("#close-final-submission-review-modal");
        const cancelBtn = finalSubmissionReviewModal.querySelector("#cancel-final-submission-review");

        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                finalSubmissionReviewModal.classList.remove("active");
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
                finalSubmissionReviewModal.classList.remove("active");
            });
        }

        // Close modal when clicking outside
        finalSubmissionReviewModal.addEventListener("click", (e) => {
            if (e.target === finalSubmissionReviewModal) {
                finalSubmissionReviewModal.classList.remove("active");
            }
        });
    }
}

// --- Main Render Function ---
async function renderDashboard(user, userData) {
    try {
        console.log("Rendering dashboard for user:", userData);
        console.log("User role:", userData?.role);

        // FORCE hide loading screen immediately - use multiple methods to ensure it's hidden
        if (loadingScreen) {
            loadingScreen.classList.add("hidden");
            loadingScreen.style.display = "none";
            loadingScreen.style.visibility = "hidden";
            loadingScreen.style.opacity = "0";
            loadingScreen.style.zIndex = "-1";
            console.log("✅ Loading screen forcefully hidden");
        } else {
            console.warn("Loading screen element not found");
        }

        // Show dashboard layout IMMEDIATELY - before any content loads
        if (dashboardLayout) {
            dashboardLayout.classList.remove("hidden");
            dashboardLayout.style.display = "";
            dashboardLayout.style.visibility = "";
            dashboardLayout.style.opacity = "";
            console.log("✅ Dashboard layout shown immediately");
        } else {
            console.error("Dashboard layout element not found!");
        }

        // Universal header setup
        if (userNameEl) {
            userNameEl.textContent = userData.name || "No Name";
        } else {
            console.warn("User name element not found");
        }
        
        if (userAvatarEl) {
            setAvatarWithFallback(userAvatarEl, userData.name || "U", 100);
        } else {
            console.warn("User avatar element not found");
        }

        // Role-based rendering
        if (userData.role === "apprentice") {
            console.log("Rendering apprentice dashboard");
            if (userRoleInfoEl) {
                userRoleInfoEl.textContent = "Apprentice";
            }
            if (typeof renderNavigation === "function") {
                renderNavigation(apprenticeTabs);
            }
            await switchContent("home", userData);
        } else {
            // Default to member
            console.log("Rendering member dashboard");
            if (userRoleInfoEl) {
                const planName = subscriptionPlans[userData.subscription_plan || "free"]?.name || "Free";
                userRoleInfoEl.textContent = `${planName} Plan`;
            }
            if (typeof renderNavigation === "function") {
                renderNavigation(memberTabs, userData.subscription_plan || "free");
            }
            await switchContent("home", userData);
        }

        // Dashboard layout should already be shown above, but ensure it's visible
        if (dashboardLayout) {
            dashboardLayout.classList.remove("hidden");
            dashboardLayout.style.display = "";
            console.log("✅ Dashboard layout confirmed visible");
        }
        
        // Setup event listeners
        if (typeof setupEventListeners === "function") {
            try {
                setupEventListeners(userData);
            } catch (error) {
                console.error("Error setting up event listeners:", error);
            }
        }
        
        // Initialize image viewer
        if (typeof setupImageViewer === "function") {
            try {
                setupImageViewer();
            } catch (error) {
                console.error("Error setting up image viewer:", error);
            }
        }

        // Initialize notifications
        if (typeof initializeNotificationCenter === "function") {
            try {
                await initializeNotificationCenter(userData);
            } catch (error) {
                console.error("Error initializing notification center:", error);
            }
        }

        // Initialize wallet interface if available
        if (window.initializeWalletInterface) {
            try {
                await window.initializeWalletInterface();
                console.log("Wallet interface initialized successfully");
            } catch (error) {
                console.error("Error initializing wallet interface:", error);
            }
        }

        console.log("✅ Dashboard rendered successfully");
    } catch (error) {
        console.error("❌ Error rendering dashboard:", error);
        console.error("Error stack:", error.stack);
        
        // Always hide loading screen and show dashboard
        if (loadingScreen) {
            loadingScreen.classList.add("hidden");
            console.log("✅ Loading screen hidden (error case)");
        }
        
        if (dashboardLayout) {
            dashboardLayout.classList.remove("hidden");
            console.log("✅ Dashboard layout shown (error case)");
        }
        
        // Show error message
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-red-500 mb-4">Error loading dashboard: ${error.message || "Unknown error"}</p>
                    <p class="text-gray-500 text-sm mb-4">Check browser console for details</p>
                    <button onclick="location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        Refresh Page
                    </button>
                </div>
            `;
        } else {
            // Last resort: show error in body
            document.body.innerHTML = `
                <div class="min-h-screen bg-gray-100 p-8">
                    <div class="text-center py-12">
                        <p class="text-red-500 mb-4">Error loading dashboard: ${error.message || "Unknown error"}</p>
                        <button onclick="location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                            Refresh Page
                        </button>
                    </div>
                </div>
            `;
        }
        throw error; // Re-throw to be caught by caller
    }
}

// --- Navigation & Content Switching ---
function renderNavigation(tabs, planKey = "free") {
    const userPlan = subscriptionPlans[planKey];
    const navItems = tabs
        .map((tab) => {
            // For members, check subscription access. For apprentices, all tabs are unlocked.
            const isUnlocked =
                tabs === apprenticeTabs ||
                userPlan.unlocks.includes("*") ||
                userPlan.unlocks.includes(tab.id) ||
                tab.access === "free";
            return `
            <button class="nav-link flex items-center px-4 py-2 text-sm font-medium text-gray-600 border-b-2 border-transparent hover:text-gray-800 ${
                !isUnlocked ? "opacity-50 cursor-not-allowed" : ""
            }" 
                    data-tab="${tab.id}" ${!isUnlocked ? "disabled" : ""}>
                <i data-feather="${tab.icon}" class="w-4 h-4 mr-2"></i>
                ${tab.name}
                ${
                    !isUnlocked
                        ? '<i data-feather="lock" class="w-3 h-3 ml-1"></i>'
                        : ""
                }
            </button>
        `;
        })
        .join("");
    mainNav.innerHTML = navItems;

    // Set initial active tab
    const firstTab = mainNav.querySelector('[data-tab="home"]');
    if (firstTab) {
        firstTab.classList.add("active");
        currentActiveTab = "home";
    }

    // Replace feather icons in navigation
    if (typeof feather !== "undefined") {
        feather.replace();
    }
}

async function switchContent(tabId, userData) {
    try {
        console.log("Switching to tab:", tabId);

        // Update active nav
        mainNav.querySelectorAll(".nav-link").forEach((link) => {
            link.classList.remove("active");
            if (link.dataset.tab === tabId) {
                link.classList.add("active");
                currentActiveTab = tabId;
            }
        });

        let content = "";
        const templates =
            userData.role === "apprentice"
                ? apprenticeContentTemplates
                : memberContentTemplates;

        // Special cases for data fetching
        if (userData.role === "member" && tabId === "explore") {
            try {
                const recommendations = await fetchRecommendations(userData);
                content = templates.explore(userData, recommendations, []);
            } catch (error) {
                console.error("Error loading explore content:", error);
                content = templates.explore(userData, [], []);
            }
        } else if (
            (userData.role === "member" || userData.role === "apprentice") &&
            tabId === "gallery"
        ) {
            try {
                const posts = await getUserPosts(userData.id);
                content = templates.gallery(userData, posts);
            } catch (error) {
                console.error("Error loading gallery:", error);
                content = templates.gallery(userData, []);
            }
        } else if (userData.role === "member" && tabId === "leaderboard") {
            try {
                const topUsers = await getTopUsers();
                content = templates.leaderboard(userData, topUsers);
            } catch (error) {
                console.error("Error loading leaderboard:", error);
                content = templates.leaderboard(userData, []);
            }
        } else if (
            userData.role === "apprentice" &&
            (tabId === "home" || tabId === "jobs" || tabId === "earnings")
        ) {
            // Handle async apprentice templates
            try {
                content = await templates[tabId](userData);
            } catch (error) {
                console.error(`Error loading ${tabId} content:`, error);
                content = `<div class="text-center py-12"><p class="text-red-500">Error loading content. Please try again.</p></div>`;
            }
        } else if (userData.role === "member" && tabId === "jobs") {
            // Handle async member jobs template
            try {
                content = await templates[tabId](userData);
            } catch (error) {
                console.error("Error loading jobs content:", error);
                content = `<div class="text-center py-12"><p class="text-red-500">Error loading jobs. Please try again.</p></div>`;
            }
        } else if (userData.role === "member" && tabId === "earnings") {
            // Handle async member earnings template
            try {
                content = await templates[tabId](userData);
            } catch (error) {
                console.error("Error loading earnings content:", error);
                content = `<div class="text-center py-12"><p class="text-red-500">Error loading earnings. Please try again.</p></div>`;
            }
        } else {
            // Default content rendering
            const template = templates[tabId];
            if (template) {
                try {
                    if (typeof template === "function") {
                        content = template(userData);
                    } else {
                        content = template;
                    }
                } catch (error) {
                    console.error(`Error rendering template for ${tabId}:`, error);
                    content = `<div class="text-center py-12"><p class="text-red-500">Error loading ${tabId} content. Please try again.</p></div>`;
                }
            } else {
                console.warn(`Template not found for tab: ${tabId}`);
                content = `<div class="text-center py-12"><p class="text-gray-500">Content not available for ${tabId}.</p></div>`;
            }
        }

        // Update main content - ensure we always set something
        if (mainContent) {
            mainContent.innerHTML = content || `<div class="text-center py-12"><p class="text-gray-500">No content available.</p></div>`;
        } else {
            console.error("mainContent element not found!");
        }

        // Initialize wallet interface if wallet tab is selected
        if (tabId === "wallet" && window.initializeWalletInterface) {
            try {
                await window.initializeWalletInterface();
                console.log("Wallet interface initialized successfully");
            } catch (error) {
                console.error("Error initializing wallet interface:", error);
            }
        }

        // Load apprentice ratings for job applications if on jobs tab
        if (userData.role === "member" && tabId === "jobs") {
            await loadAllApprenticeRatings();
        }

        // Load trending creators for explore tab
        if (userData.role === "member" && tabId === "explore") {
            await loadTrendingCreators(userData);
        }

        // Attach dynamic event listeners
        attachDynamicEventListeners(tabId, userData);

        // Gallery-specific enhancements
        if (tabId === "gallery") {
            setupGalleryImageHandling();
            enhanceGalleryDisplay();
            setupGalleryDeleteButtons(userData);

            // Add upload modal listener for apprentices
            if (userData.role === "apprentice") {
                console.log("Setting up upload modal for apprentice...");
                const openUploadModalBtn =
                    document.getElementById("open-upload-modal");
                const galleryUploadBtn =
                    document.getElementById("gallery-upload-btn");

                console.log("Upload modal elements:", {
                    openUploadModalBtn: !!openUploadModalBtn,
                    galleryUploadBtn: !!galleryUploadBtn,
                    uploadModal: !!uploadModal,
                });

                if (openUploadModalBtn) {
                    openUploadModalBtn.addEventListener("click", () => {
                        console.log("Opening upload modal for apprentice");
                        uploadModal.classList.add("active");
                    });
                }
                if (galleryUploadBtn) {
                    galleryUploadBtn.addEventListener("click", () => {
                        console.log("Opening upload modal from gallery button");
                        uploadModal.classList.add("active");
                    });
                }
            }
        }

        // Replace feather icons
        if (typeof feather !== "undefined") {
            feather.replace();
        }

        console.log("Content switched to:", tabId);
    } catch (error) {
        console.error("Error switching content:", error);
        mainContent.innerHTML =
            '<div class="text-center py-12"><p class="text-red-500">Error loading content. Please try again.</p></div>';
    }
}

// --- Subscription Payment Functions ---
function showSubscriptionPaymentModal(planKey, plan) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('subscription-payment-modal');
    if (!modal) {
        modal = createSubscriptionPaymentModal();
        document.body.appendChild(modal);
    }

    // Update modal content
    const planName = document.getElementById('subscription-plan-name');
    const planPrice = document.getElementById('subscription-plan-price');
    const planFeatures = document.getElementById('subscription-plan-features');
    
    if (planName) planName.textContent = plan.name;
    if (planPrice) planPrice.textContent = `₦${plan.price.toLocaleString()}`;
    
    if (planFeatures) {
        const features = plan.unlocks.includes("*") 
            ? ["All Features", "Priority Support", "Advanced Analytics"]
            : plan.unlocks.map(feature => feature.replace("_", " "));
        
        planFeatures.innerHTML = features.map(feature => 
            `<li class="flex items-center"><i data-feather="check" class="w-4 h-4 text-green-500 mr-2"></i>${feature}</li>`
        ).join("");
    }

    // Store current plan data
    modal.dataset.planKey = planKey;
    modal.dataset.planPrice = plan.price;

    // Show modal
    modal.classList.remove('hidden');
    
    // Replace feather icons
    if (typeof feather !== "undefined") {
        feather.replace();
    }
}

function createSubscriptionPaymentModal() {
    const modal = document.createElement('div');
    modal.id = 'subscription-payment-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-gray-900">Upgrade Subscription</h2>
                <button id="close-subscription-modal" class="text-gray-400 hover:text-gray-600">
                    <i data-feather="x" class="w-6 h-6"></i>
                </button>
            </div>
            
            <div class="mb-6">
                <h3 id="subscription-plan-name" class="text-xl font-semibold text-gray-800"></h3>
                <p id="subscription-plan-price" class="text-3xl font-bold text-blue-600 mb-4"></p>
                <ul id="subscription-plan-features" class="space-y-2 text-gray-600">
                    <!-- Features will be populated dynamically -->
                </ul>
            </div>
            
            <div class="mb-6">
                <h4 class="text-lg font-semibold text-gray-800 mb-3">Choose Payment Method</h4>
                <div class="space-y-3">
                    <button id="pay-with-wallet-btn" class="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center">
                        <i data-feather="credit-card" class="w-5 h-5 mr-2"></i>
                        Pay with Wallet Balance
                    </button>
                    <button id="pay-flutterwave-btn" class="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 flex items-center justify-center">
                        <i data-feather="external-link" class="w-5 h-5 mr-2"></i>
                        Pay with Flutterwave
                    </button>
                    <button id="pay-manually-btn" class="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center">
                        <i data-feather="bank" class="w-5 h-5 mr-2"></i>
                        Manual Bank Transfer
                    </button>
                </div>
            </div>
            
            <div class="text-sm text-gray-500">
                <p>• Wallet payments are instant</p>
                <p>• Manual transfers require admin approval</p>
                <p>• You'll receive confirmation once processed</p>
            </div>
        </div>
    `;
    
    // Add event listeners
    const closeBtn = modal.querySelector('#close-subscription-modal');
    const walletBtn = modal.querySelector('#pay-with-wallet-btn');
    const flutterwaveBtn = modal.querySelector('#pay-flutterwave-btn');
    const manualBtn = modal.querySelector('#pay-manually-btn');
    
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    walletBtn.addEventListener('click', () => {
        const planKey = modal.dataset.planKey;
        const planPrice = parseFloat(modal.dataset.planPrice);
        processWalletPayment(planKey, planPrice);
    });
    
    flutterwaveBtn.addEventListener('click', () => {
        const planKey = modal.dataset.planKey;
        const planPrice = parseFloat(modal.dataset.planPrice);
        processFlutterwaveSubscriptionPayment(planKey, planPrice);
    });
    
    manualBtn.addEventListener('click', () => {
        const planKey = modal.dataset.planKey;
        const planPrice = parseFloat(modal.dataset.planPrice);
        processManualPayment(planKey, planPrice);
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
    
    return modal;
}

async function processWalletPayment(planKey, planPrice) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            showNotification("Please log in to continue", "error");
            return;
        }

        // Check if user has enough wallet balance
        const { data: wallet, error: walletError } = await supabase
            .from('user_wallets')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (walletError && walletError.code !== 'PGRST116') {
            throw walletError;
        }

        if (!wallet || wallet.balance_ngn < planPrice) {
            showNotification(`Insufficient wallet balance. You need ₦${planPrice.toLocaleString()} but have ₦${wallet ? wallet.balance_ngn.toLocaleString() : '0'}.`, "error");
            return;
        }

        // Process subscription payment using manual payment system
        const { processSubscriptionPayment } = await import('./manual-payment-system.js');
        const data = await processSubscriptionPayment(planKey, planPrice, 'wallet');

        if (!data.success) {
            throw new Error(data.error || 'Payment processing failed');
        }

        showNotification(`Successfully upgraded to ${subscriptionPlans[planKey].name} plan!`, "success");
        
        // Close modal
        document.getElementById('subscription-payment-modal').classList.add('hidden');
        
        // Refresh dashboard
        setTimeout(() => {
            window.location.reload();
        }, 2000);

    } catch (error) {
        console.error("Error processing wallet payment:", error);
        showNotification("Failed to process payment. Please try again.", "error");
    }
}

async function processFlutterwaveSubscriptionPayment(planKey, planPrice) {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            showNotification("Please log in to continue", "error");
            return;
        }

        if (!planPrice || planPrice <= 0) {
            showNotification("Invalid subscription amount. Please try again.", "error");
            return;
        }

        const flutterwaveUrl = ENV_CONFIG.FLUTTERWAVE_FUNCTION_URL || 
            `${ENV_CONFIG.SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co')}/flutterwave-init-payment`;
        
        const response = await fetch(flutterwaveUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    amount: planPrice,
                    type: "subscription",
                }),
            });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Payment initialization failed (${response.status})`);
        }

        const data = await response.json();

        if (!data.success || !data.payment_url) {
            throw new Error(data.error || "Failed to get payment URL from Flutterwave");
        }

        // Redirect user to Flutterwave checkout
        window.location.href = data.payment_url;
    } catch (error) {
        console.error("Error initializing Flutterwave subscription payment:", error);
        const errorMessage = error?.message || "Failed to start Flutterwave payment. Please try again.";
        showNotification(errorMessage, "error");
        
        // Log error for debugging
        if (ENV_CONFIG.DEBUG_MODE) {
            console.error("Flutterwave subscription payment error details:", error);
        }
    }
}

async function processManualPayment(planKey, planPrice) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            showNotification("Please log in to continue", "error");
            return;
        }

        // Create subscription payment request using manual payment system
        const { createSubscriptionPaymentRequest } = await import('./manual-payment-system.js');
        const data = await createSubscriptionPaymentRequest(planKey, planPrice, 'manual');

        if (!data.success) {
            throw new Error(data.error || 'Payment request creation failed');
        }

        showNotification(`Subscription payment request created for ${subscriptionPlans[planKey].name} plan. Please complete bank transfer and wait for admin approval.`, "success");
        
        // Close modal
        document.getElementById('subscription-payment-modal').classList.add('hidden');
        
        // Show bank details modal
        showBankDetailsModal(planPrice);

    } catch (error) {
        console.error("Error creating manual payment request:", error);
        showNotification("Failed to create payment request. Please try again.", "error");
    }
}

async function showBankDetailsModal(amount) {
    // Create bank details modal if it doesn't exist
    let modal = document.getElementById('bank-details-modal');
    if (!modal) {
        modal = await createBankDetailsModal();
        document.body.appendChild(modal);
    }

    // Update amount
    const amountElement = modal.querySelector('#payment-amount');
    if (amountElement) {
        amountElement.textContent = `₦${amount.toLocaleString()}`;
    }

    // Show modal
    modal.classList.remove('hidden');
}

async function createBankDetailsModal() {
    const modal = document.createElement('div');
    modal.id = 'bank-details-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
    
    // Fetch bank details from database
    let bankDetails = null;
    try {
        const { getCraftnetBankAccounts } = await import('./manual-payment-system.js');
        const accounts = await getCraftnetBankAccounts();
        bankDetails = accounts && accounts.length > 0 ? accounts[0] : null;
    } catch (error) {
        console.error('Error fetching bank details:', error);
    }
    
    // Fallback bank details if database fetch fails
    if (!bankDetails) {
        bankDetails = {
            bank_name: 'Guaranty Trust Bank (GTB)',
            account_name: 'Craftnet Technologies Ltd',
            account_number: '0123456789'
        };
    }
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-gray-900">Bank Transfer Details</h2>
                <button id="close-bank-modal" class="text-gray-400 hover:text-gray-600">
                    <i data-feather="x" class="w-6 h-6"></i>
                </button>
            </div>
            
            <div class="mb-6">
                <p class="text-gray-600 mb-4">Please transfer <span id="payment-amount" class="font-bold text-blue-600"></span> to the following account:</p>
                
                <div class="bg-gray-50 p-4 rounded-lg space-y-3">
                    <div>
                        <label class="text-sm font-medium text-gray-700">Bank Name:</label>
                        <p class="text-lg font-semibold text-gray-900">${bankDetails.bank_name}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-700">Account Name:</label>
                        <p class="text-lg font-semibold text-gray-900">${bankDetails.account_name}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-700">Account Number:</label>
                        <p class="text-lg font-semibold text-gray-900">${bankDetails.account_number}</p>
                        <button id="copy-account-number" class="text-blue-600 text-sm hover:underline">Copy</button>
                    </div>
                </div>
            </div>
            
            <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Account Details Used to Pay</label>
                <input type="text" id="account-details" placeholder="Enter your account name and number used for payment" 
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <p class="text-xs text-gray-500 mt-1">Example: John Doe - 1234567890</p>
            </div>
            
            <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Upload Proof of Payment</label>
                <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                    <input type="file" id="proof-of-payment" accept="image/*,.pdf" class="hidden">
                    <div id="file-upload-area" class="cursor-pointer">
                        <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <p class="mt-2 text-sm text-gray-600">Click to upload or drag and drop</p>
                        <p class="text-xs text-gray-500">PNG, JPG, PDF up to 5MB</p>
                    </div>
                    <div id="file-preview" class="hidden mt-2">
                        <div class="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div class="flex items-center">
                                <svg class="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                </svg>
                                <span id="file-name" class="text-sm text-gray-700"></span>
                            </div>
                            <button type="button" id="remove-file" class="text-red-500 hover:text-red-700">
                                <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="flex space-x-3">
                <button id="submit-payment-proof" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    Submit Payment Proof
                </button>
                <button id="cancel-bank-payment" class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400">
                    Cancel
                </button>
            </div>
            
            <div class="mt-4 text-sm text-gray-500">
                <p>• Upload a screenshot or receipt of your bank transfer</p>
                <p>• Include your account details used for the payment</p>
                <p>• Your subscription will be activated after admin verification</p>
                <p>• You'll receive email confirmation once processed</p>
            </div>
        </div>
    `;
    
    // Add event listeners
    const closeBtn = modal.querySelector('#close-bank-modal');
    const copyBtn = modal.querySelector('#copy-account-number');
    const submitBtn = modal.querySelector('#submit-payment-proof');
    const cancelBtn = modal.querySelector('#cancel-bank-payment');
    const fileInput = modal.querySelector('#proof-of-payment');
    const fileUploadArea = modal.querySelector('#file-upload-area');
    const filePreview = modal.querySelector('#file-preview');
    const fileName = modal.querySelector('#file-name');
    const removeFileBtn = modal.querySelector('#remove-file');
    
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(bankDetails.account_number).then(() => {
            showNotification("Account number copied to clipboard!", "success");
        });
    });
    
    // File upload handling
    fileUploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type and size
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
            const maxSize = 5 * 1024 * 1024; // 5MB
            
            if (!allowedTypes.includes(file.type)) {
                showNotification("Invalid file type. Please upload JPG, PNG, GIF, or PDF files only.", "error");
                return;
            }
            
            if (file.size > maxSize) {
                showNotification("File size too large. Please upload files smaller than 5MB.", "error");
                return;
            }
            
            fileName.textContent = file.name;
            filePreview.classList.remove('hidden');
        }
    });
    
    removeFileBtn.addEventListener('click', () => {
        fileInput.value = '';
        filePreview.classList.add('hidden');
    });
    
    submitBtn.addEventListener('click', async () => {
        const accountDetails = modal.querySelector('#account-details').value.trim();
        const file = fileInput.files[0];
        
        if (!accountDetails) {
            showNotification("Please enter your account details used for payment", "error");
            return;
        }
        
        if (!file) {
            showNotification("Please upload proof of payment", "error");
            return;
        }
        
        await submitPaymentProof(accountDetails, file);
    });
    
    cancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
    
    return modal;
}

async function submitPaymentProof(accountDetails, proofOfPaymentFile) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            showNotification("Please log in to continue", "error");
            return;
        }

        // Upload proof of payment file first
        const { uploadProofOfPayment } = await import('./manual-payment-system.js');
        const proofOfPaymentUrl = await uploadProofOfPayment(proofOfPaymentFile);

        // Update the payment request with account details and proof of payment using manual payment system
        const { updateSubscriptionPaymentDetails } = await import('./manual-payment-system.js');
        const data = await updateSubscriptionPaymentDetails(accountDetails, proofOfPaymentUrl);

        if (!data.success) {
            throw new Error(data.error || 'Payment details update failed');
        }

        showNotification("Payment proof submitted successfully! Your subscription will be activated after admin verification.", "success");
        
        // Close modal
        document.getElementById('bank-details-modal').classList.add('hidden');

    } catch (error) {
        console.error("Error submitting payment proof:", error);
        showNotification("Failed to submit payment proof. Please try again.", "error");
    }
}

// --- Utility Functions ---
function copyToClipboard(text) {
    navigator.clipboard
        .writeText(text)
        .then(() => {
            showNotification("Referral link copied to clipboard!", "success");
        })
        .catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            showNotification("Referral link copied to clipboard!", "success");
        });
}

// --- Main Initialization ---
async function initializeDashboard() {
    console.log('🚀 initializeDashboard() called');
    console.log('📊 Current URL:', window.location.href);
    console.log('📊 Document ready state:', document.readyState);
    
    // Safety timeout: Always hide loading screen after 10 seconds
    const safetyTimeout = setTimeout(() => {
            console.warn("⚠️ Dashboard initialization taking too long, forcing loading screen to hide");
            if (loadingScreen) {
                loadingScreen.classList.add("hidden");
                loadingScreen.style.display = "none";
                loadingScreen.style.visibility = "hidden";
                loadingScreen.style.opacity = "0";
                loadingScreen.style.zIndex = "-1";
            }
            if (dashboardLayout) {
                dashboardLayout.classList.remove("hidden");
                dashboardLayout.style.display = "";
                dashboardLayout.style.visibility = "";
                dashboardLayout.style.opacity = "";
            }
    }, 10000);

    try {
        console.log("🚀 Initializing dashboard...");
        console.log("DOM elements check:", {
            loadingScreen: !!loadingScreen,
            dashboardLayout: !!dashboardLayout,
            mainContent: !!mainContent
        });

        // Ensure we have required DOM elements
        if (!loadingScreen || !dashboardLayout || !mainContent) {
            clearTimeout(safetyTimeout);
            console.error("Required DOM elements not found!");
            document.body.innerHTML = `
                <div class="min-h-screen bg-gray-100 p-8">
                    <div class="text-center py-12">
                        <p class="text-red-500 mb-4">Required page elements not found. Please refresh the page.</p>
                        <button onclick="location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                            Refresh Page
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        // Use relative URLs - works both locally and on GitHub Pages
        const loginUrl = 'login-supabase.html';

        // Set up auth state listener
        supabase.auth.onAuthStateChange((event, session) => {
            console.log("Auth state changed:", event, session ? "session exists" : "no session");
            if (event === 'SIGNED_OUT' || !session) {
                window.location.replace(loginUrl);
            }
        });

        // Wait a moment for any pending auth state changes
        await new Promise(resolve => setTimeout(resolve, 300));

        // Check authentication with session
        console.log('🔍 Checking session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
            console.error("❌ Session error:", sessionError);
            window.location.replace(loginUrl);
            return;
        }

        if (!session || !session.user) {
            console.log("❌ No authenticated session, redirecting to login");
            window.location.replace(loginUrl);
            return;
        }

        console.log('✅ Session found, user:', session.user.email);

        const user = session.user;
        console.log("User authenticated:", user.id);

        // Get user profile
        let userData;
        try {
            userData = await getUserProfile(user.id);
            console.log("User profile loaded:", userData);
        } catch (error) {
            console.error("Error loading user profile:", error);
            // Show error but still try to render - FORCE hide loading screen
            if (loadingScreen) {
                loadingScreen.classList.add("hidden");
                loadingScreen.style.display = "none";
                loadingScreen.style.visibility = "hidden";
                loadingScreen.style.opacity = "0";
                loadingScreen.style.zIndex = "-1";
            }
            if (dashboardLayout) {
                dashboardLayout.classList.remove("hidden");
                dashboardLayout.style.display = "";
            }
            mainContent.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-red-500 mb-4">Error loading profile: ${error.message}</p>
                    <button onclick="location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        Retry
                    </button>
                </div>
            `;
            return;
        }

        // Check if profile is completed
        let profileCompleted = false;
        try {
            profileCompleted = await isProfileCompleted(user.id);
            console.log("Profile completed status:", profileCompleted, "for user:", user.id);
        } catch (error) {
            console.error("Error checking profile completion:", error);
            // If check fails, assume profile is completed to avoid blocking dashboard
            profileCompleted = true;
            console.log("Profile completion check failed, assuming completed to show dashboard");
        }

        if (!profileCompleted) {
            console.log("Profile not completed, showing setup modal");
            // Show profile setup modal instead of dashboard
            try {
                showProfileSetupModal(userData);
                console.log("Profile setup modal shown");
            } catch (error) {
                console.error("Error showing profile setup modal:", error);
                // Fallback: show dashboard anyway with a warning - FORCE hide loading screen
                console.log("Falling back to dashboard display");
                if (loadingScreen) {
                    loadingScreen.classList.add("hidden");
                    loadingScreen.style.display = "none";
                    loadingScreen.style.visibility = "hidden";
                    loadingScreen.style.opacity = "0";
                    loadingScreen.style.zIndex = "-1";
                }
                if (dashboardLayout) {
                    dashboardLayout.classList.remove("hidden");
                    dashboardLayout.style.display = "";
                }
                await renderDashboard(user, userData);
                if (mainContent) {
                    mainContent.innerHTML = `
                        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                            <p class="text-yellow-700">Please complete your profile to access all features.</p>
                        </div>
                        ${mainContent.innerHTML}
                    `;
                }
            }
            return;
        }

        console.log("Profile is completed, rendering dashboard");

        // FORCE hide loading screen immediately before rendering
        if (loadingScreen) {
            loadingScreen.classList.add("hidden");
            loadingScreen.style.display = "none";
            loadingScreen.style.visibility = "hidden";
            loadingScreen.style.opacity = "0";
            loadingScreen.style.zIndex = "-1";
            console.log("✅ Loading screen forcefully hidden before rendering");
        }

        // Show dashboard layout immediately
        if (dashboardLayout) {
            dashboardLayout.classList.remove("hidden");
            dashboardLayout.style.display = "";
            dashboardLayout.style.visibility = "";
            dashboardLayout.style.opacity = "";
            console.log("✅ Dashboard layout shown before rendering");
        }

        // Render dashboard
        try {
            console.log("About to render dashboard for user:", userData?.role);
            await renderDashboard(user, userData);
            console.log("✅ Dashboard rendered successfully");
            clearTimeout(safetyTimeout); // Clear safety timeout on success

            // Start real-time updates for apprentices
            if (userData.role === "apprentice") {
                if (typeof startRealTimeUpdates === "function") {
                    startRealTimeUpdates(userData);
                }
                if (typeof updateApprenticeStats === "function") {
                    await updateApprenticeStats(userData); // Initial stats update
                }
            }
        } catch (error) {
            console.error("Error rendering dashboard:", error);
            console.error("Error stack:", error.stack);
            // Ensure loading screen is FORCE hidden and show error
            if (loadingScreen) {
                loadingScreen.classList.add("hidden");
                loadingScreen.style.display = "none";
                loadingScreen.style.visibility = "hidden";
                loadingScreen.style.opacity = "0";
                loadingScreen.style.zIndex = "-1";
            }
            if (dashboardLayout) {
                dashboardLayout.classList.remove("hidden");
                dashboardLayout.style.display = "";
            }
            if (mainContent) {
                mainContent.innerHTML = `
                    <div class="text-center py-12">
                        <p class="text-red-500 mb-4">Error rendering dashboard: ${error.message || "Unknown error"}</p>
                        <p class="text-gray-500 text-sm mb-4">Check browser console for details</p>
                        <button onclick="location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                            Retry
                        </button>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error("❌ Dashboard initialization error:", error);
        console.error("Error stack:", error.stack);
        clearTimeout(safetyTimeout); // Clear safety timeout on error

        // Always FORCE hide loading screen on error
        if (loadingScreen) {
            loadingScreen.classList.add("hidden");
            loadingScreen.style.display = "none";
            loadingScreen.style.visibility = "hidden";
            loadingScreen.style.opacity = "0";
            loadingScreen.style.zIndex = "-1";
            console.log("✅ Loading screen forcefully hidden (init error)");
        }

        // Always show dashboard layout on error
        if (dashboardLayout) {
            dashboardLayout.classList.remove("hidden");
            dashboardLayout.style.display = "";
            console.log("✅ Dashboard layout shown (init error)");
        }

        // Check if it's an auth error
        if (error.message && (error.message.includes("JWT") || error.message.includes("auth"))) {
            console.log("Authentication error, redirecting to login");
            window.location.replace('login-supabase.html');
            return;
        }

        // Show error in UI - ensure something is always visible
        if (dashboardLayout) {
            dashboardLayout.classList.remove("hidden");
        }
        
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-red-500 mb-4">Error loading dashboard: ${error.message || "Unknown error"}</p>
                    <p class="text-gray-500 text-sm mb-4">Please check the browser console for more details</p>
                    <button onclick="location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        Retry
                    </button>
                </div>
            `;
        } else {
            // Last resort fallback
            document.body.innerHTML = `
                <div class="min-h-screen bg-gray-100 p-8">
                    <div class="text-center py-12">
                        <h1 class="text-2xl font-bold mb-4">Dashboard Error</h1>
                        <p class="text-red-500 mb-4">Error loading dashboard: ${error.message || "Unknown error"}</p>
                        <button onclick="location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                            Refresh Page
                        </button>
                    </div>
                </div>
            `;
        }
    }
}

// --- User Profile Modal Functions ---
async function showUserProfileModal(userId, userName) {
    try {
        // Get user profile data
        const { data: userProfile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

        if (error) {
            console.error("Error fetching user profile:", error);
            showNotification("Error loading user profile", "error");
            return;
        }

        // Update modal content
        const modal = document.getElementById("user-profile-modal");
        const avatar = document.getElementById("modal-user-avatar");
        const name = document.getElementById("modal-user-name");
        const role = document.getElementById("modal-user-role");
        const location = document.getElementById("modal-user-location");
        const descriptionContent = document.getElementById(
            "modal-description-content"
        );
        const connectBtn = document.getElementById("modal-connect-btn");
        const galleryBtn = document.getElementById("modal-view-gallery-btn");

        // Set user info
        const initials = (userProfile.name || "U").charAt(0).toUpperCase();
        setAvatarWithFallback(avatar, userProfile.name || "U", 100);
        avatar.alt = userProfile.name;
        name.textContent = userProfile.name || "Unknown User";
        role.textContent =
            userProfile.role === "apprentice" ? "Apprentice" : "Member";
        location.textContent = userProfile.location || "Location not set";

        // Set description
        if (userProfile.description && userProfile.description.trim()) {
            descriptionContent.innerHTML = `<p class="text-gray-700 text-sm">${userProfile.description}</p>`;
        } else {
            descriptionContent.innerHTML = `<p class="text-gray-500 text-sm italic">No description available.</p>`;
        }

        // Set button data attributes
        connectBtn.dataset.userId = userId;
        connectBtn.dataset.userName = userProfile.name;
        galleryBtn.dataset.userId = userId;
        galleryBtn.dataset.userName = userProfile.name;

        // Show modal
        modal.classList.add("active");

        // Replace feather icons
        if (typeof feather !== "undefined") {
            feather.replace();
        }
    } catch (error) {
        console.error("Error showing user profile modal:", error);
        showNotification("Error loading user profile", "error");
    }
}

// --- Event Listeners for Modals ---
console.log('📋 Dashboard script: Setting up DOMContentLoaded handlers...');
console.log('📊 Document ready state:', document.readyState);

// Function to initialize dashboard
async function initializeDashboardOnReady() {
  console.log('🚀 DOMContentLoaded fired (or document already ready)');
  
  // Set up event listeners first (non-blocking)
  // Close modals when clicking outside
  window.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal")) {
          e.target.classList.remove("active");
      }
  });

  // User Profile Modal Event Handlers
  const userProfileModal = document.getElementById("user-profile-modal");
  if (userProfileModal) {
      const closeBtn = userProfileModal.querySelector(
          "#close-user-profile-modal"
      );
      if (closeBtn) {
          closeBtn.addEventListener("click", () => {
              userProfileModal.classList.remove("active");
          });
      }

      // Connect button handler
      const connectBtn = userProfileModal.querySelector("#modal-connect-btn");
      if (connectBtn) {
          connectBtn.addEventListener("click", async () => {
              const userId = connectBtn.dataset.userId;
              const userName = connectBtn.dataset.userName;

              // Get current user
              const {
                  data: { user },
              } = await supabase.auth.getUser();
              if (!user) {
                  showNotification(
                      "Please log in to connect with users",
                      "error"
                  );
                  return;
              }

              if (user.id === userId) {
                  showNotification(
                      "You cannot connect with yourself",
                      "error"
                  );
                  return;
              }

              try {
                  connectBtn.disabled = true;
                  connectBtn.textContent = "Connecting...";

                  const success = await followUser(user.id, userId);

                  if (success) {
                      connectBtn.textContent = "Connected!";
                      connectBtn.classList.remove(
                          "bg-blue-600",
                          "hover:bg-blue-700"
                      );
                      connectBtn.classList.add(
                          "bg-green-600",
                          "cursor-not-allowed"
                      );
                      connectBtn.disabled = true;

                      // Update the original follow button if it exists
                      const originalBtn = document.querySelector(
                          `[data-user-id="${userId}"].follow-btn`
                      );
                      if (originalBtn) {
                          originalBtn.textContent = "Following";
                          originalBtn.classList.remove(
                              "bg-blue-600",
                              "hover:bg-blue-700"
                          );
                          originalBtn.classList.add(
                              "bg-gray-400",
                              "cursor-not-allowed"
                          );
                          originalBtn.disabled = true;
                      }

                      // Update follower count in UI
                      updateFollowerCountInUI(userId);

                      showNotification(
                          `Successfully connected with ${userName}!`,
                          "success"
                      );

                      // Close modal after 2 seconds
                      setTimeout(() => {
                          userProfileModal.classList.remove("active");
                      }, 2000);
                  } else {
                      throw new Error("Failed to connect");
                  }
              } catch (error) {
                  console.error("Error connecting with user:", error);
                  connectBtn.disabled = false;
                  connectBtn.textContent = "Connect";
                  showNotification(
                      "Error connecting with user. Please try again.",
                      "error"
                  );
              }
          });
      }

      // View Gallery button handler
      const galleryBtn = userProfileModal.querySelector(
          "#modal-view-gallery-btn"
      );
      if (galleryBtn) {
          galleryBtn.addEventListener("click", () => {
              const userId = galleryBtn.dataset.userId;
              const userName = galleryBtn.dataset.userName;

              // Close user profile modal
              userProfileModal.classList.remove("active");

              // Show gallery modal
              handleGalleryView(userId, userName);
          });
      }
  }

  // Close modals with Escape key
  document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
          document.querySelectorAll(".modal.active").forEach((modal) => {
              modal.classList.remove("active");
          });
      }
  });

  // Add global error handler for images to prevent timeouts from blocking the page
  document.addEventListener('error', (e) => {
      if (e.target.tagName === 'IMG' && e.target.src && e.target.src.includes('placehold.co')) {
          console.warn('Placeholder image timed out:', e.target.src);
          // Extract text from URL if possible, or use 'U' as default
          const match = e.target.src.match(/text=([^&]+)/);
          const text = match ? decodeURIComponent(match[1]) : 'U';
          const sizeMatch = e.target.src.match(/(\d+)x\d+/);
          const size = sizeMatch ? parseInt(sizeMatch[1]) : 100;
          
          // Only set fallback if not already set (prevent infinite loop)
          if (!e.target.src.startsWith('data:')) {
              e.target.src = generateFallbackAvatar(text, size);
          }
      }
  }, true); // Use capture phase to catch errors early

  // Set up auto-acknowledgment (non-blocking)
  console.log('✅ Dashboard: Setting up auto-acknowledgment...');
  setupAutoAcknowledgment();
  
  // Safety timeout: force-hide spinner after 10 seconds
  const timeoutId = setTimeout(() => {
    console.warn('⚠️ TIMEOUT: Dashboard took too long to load');
    const spinner = document.querySelector('#loading-screen, .spinner, .loading, [class*="spinner"], [class*="loading"]');
    if (spinner) {
      spinner.style.display = 'none';
      spinner.classList.add('hidden');
      console.log('🛑 Force-hiding spinner due to timeout');
    }
    
    if (dashboardLayout) {
      dashboardLayout.classList.remove('hidden');
      dashboardLayout.style.display = '';
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'padding: 20px; background: #fee; color: #c00; text-align: center; margin: 20px;';
    errorDiv.textContent = 'Dashboard loading timed out. Please refresh the page or contact support.';
    if (mainContent) {
      mainContent.prepend(errorDiv);
    } else {
      document.body.prepend(errorDiv);
    }
  }, 10000);
  
  try {
    // Step 1: Check authentication
    console.log('🔐 Step 1: Checking authentication...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('📦 Session data:', session ? { userId: session.user?.id, email: session.user?.email } : null);
    console.log('❌ Session error:', sessionError);
    
    if (sessionError) {
      console.error('❌ Session error occurred:', sessionError);
      clearTimeout(timeoutId);
      throw new Error('Session error: ' + sessionError.message);
    }
    
    if (!session || !session.user) {
      console.log('❌ No session found, redirecting to login');
      clearTimeout(timeoutId);
      window.location.href = './login-supabase.html';
      return;
    }
    
    console.log('✅ Session found for user:', session.user.email);
    console.log('👤 User ID:', session.user.id);
    
    // Step 2: Get user profile/data
    console.log('👤 Step 2: Fetching user profile...');
    let userProfile;
    let profileError;
    try {
      userProfile = await getUserProfile(session.user.id);
      console.log('📦 User profile:', userProfile);
    } catch (error) {
      profileError = error;
      console.log('❌ Profile error:', profileError);
      console.warn('⚠️ Could not fetch user profile:', profileError.message);
      // Continue anyway - profile might be optional or we'll create it
    }
    
    // Also try querying users table directly for comparison
    console.log('🔄 Step 2b: Also checking users table...');
    try {
      const { data: userFromUsersTable, error: usersTableError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      console.log('📦 Users table data:', userFromUsersTable);
      if (usersTableError) {
        console.log('❌ Users table error:', usersTableError.message);
      }
    } catch (err) {
      console.warn('⚠️ Could not query users table:', err.message);
    }
    
    // Step 3: Check user role/type
    console.log('🎭 Step 3: Checking user role...');
    const userRole = userProfile?.role || userProfile?.user_type || session.user.user_metadata?.role || 'user';
    console.log('👤 User role:', userRole);
    
    // Step 4: Check if profile is completed
    console.log('✅ Step 4: Checking profile completion...');
    let profileCompleted = false;
    try {
      profileCompleted = await isProfileCompleted(session.user.id);
      console.log('📋 Profile completed:', profileCompleted);
    } catch (error) {
      console.warn('⚠️ Error checking profile completion:', error.message);
      profileCompleted = true; // Assume completed to avoid blocking
    }
    
    // Step 5: Hide loading spinner
    console.log('⏳ Step 5: Hiding loading spinner...');
    const possibleSpinnerSelectors = [
      '#loading-screen',
      '.spinner',
      '.loading',
      '[class*="spinner"]',
      '[class*="loading"]',
      '.loader'
    ];
    
    let spinnerFound = false;
    for (const selector of possibleSpinnerSelectors) {
      const spinner = document.querySelector(selector);
      if (spinner && window.getComputedStyle(spinner).display !== 'none') {
        console.log(`✅ Found spinner with selector: ${selector}`);
        spinner.style.display = 'none';
        spinner.classList.add('hidden');
        spinner.style.visibility = 'hidden';
        spinner.style.opacity = '0';
        spinner.style.zIndex = '-1';
        spinnerFound = true;
        break;
      }
    }
    
    if (!spinnerFound) {
      console.warn('⚠️ No visible spinner element found with common selectors');
      // Try the known loadingScreen element
      if (loadingScreen) {
        console.log('✅ Using loadingScreen element directly');
        loadingScreen.style.display = 'none';
        loadingScreen.classList.add('hidden');
        loadingScreen.style.visibility = 'hidden';
        loadingScreen.style.opacity = '0';
        loadingScreen.style.zIndex = '-1';
        spinnerFound = true;
      }
    }
    
    if (!spinnerFound) {
      console.warn('⚠️ No spinner element found at all');
      console.log('Available elements:', document.body.innerHTML.substring(0, 500));
    }
    
    // Step 6: Show dashboard content
    console.log('📄 Step 6: Showing dashboard content...');
    if (dashboardLayout) {
      console.log('✅ Found dashboardLayout element');
      dashboardLayout.classList.remove('hidden');
      dashboardLayout.style.display = '';
      dashboardLayout.style.visibility = '';
      dashboardLayout.style.opacity = '';
    } else {
      console.warn('⚠️ dashboardLayout element not found');
    }
    
    // Step 7: Render dashboard
    console.log('🎨 Step 7: Rendering dashboard...');
    
    if (!userProfile) {
      console.warn('⚠️ No user profile available, cannot render dashboard');
      if (mainContent) {
        mainContent.innerHTML = `
          <div class="text-center py-12">
            <p class="text-red-500 mb-4">Error: User profile not found</p>
            <button onclick="location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Retry
            </button>
          </div>
        `;
      }
      clearTimeout(timeoutId);
      return;
    }
    
    // Check if profile needs completion
    if (!profileCompleted) {
      console.log('📝 Profile not completed, showing setup modal...');
      try {
        if (typeof showProfileSetupModal === 'function') {
          showProfileSetupModal(userProfile);
          console.log('✅ Profile setup modal shown');
        } else {
          console.warn('⚠️ showProfileSetupModal function not found');
        }
      } catch (error) {
        console.error('❌ Error showing profile setup modal:', error);
      }
    }
    
    // Render the dashboard
    try {
      console.log('🔄 Calling renderDashboard...');
      if (typeof renderDashboard === 'function') {
        await renderDashboard(session.user, userProfile);
        console.log('✅ Dashboard rendered successfully');
      } else {
        console.error('❌ renderDashboard function not found!');
        throw new Error('renderDashboard function not available');
      }
    } catch (error) {
      console.error('❌ Error rendering dashboard:', error);
      throw error;
    }
    
    // Step 8: Load additional data
    console.log('📊 Step 8: Loading additional dashboard components...');
    
    // Jobs
    try {
      console.log('🔄 Fetching jobs...');
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', session.user.id);
      
      console.log('📦 Jobs data:', jobs ? `${jobs.length} jobs found` : 'null');
      if (jobsError) console.warn('⚠️ Jobs error:', jobsError.message);
    } catch (err) {
      console.warn('⚠️ Could not fetch jobs:', err.message);
    }
    
    // Wallet
    try {
      console.log('🔄 Fetching wallet...');
      const { data: wallet, error: walletError } = await supabase
        .from('wallet')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      
      console.log('📦 Wallet data:', wallet ? 'Found' : 'null');
      if (walletError) console.warn('⚠️ Wallet error:', walletError.message);
    } catch (err) {
      console.warn('⚠️ Could not fetch wallet:', err.message);
    }
    
    // Transactions
    try {
      console.log('🔄 Fetching transactions...');
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      console.log('📦 Transactions data:', transactions ? `${transactions.length} transactions found` : 'null');
      if (txError) console.warn('⚠️ Transactions error:', txError.message);
    } catch (err) {
      console.warn('⚠️ Could not fetch transactions:', err.message);
    }
    
    // Start real-time updates for apprentices
    if (userProfile.role === "apprentice") {
      console.log('🔄 Starting real-time updates for apprentice...');
      try {
        if (typeof startRealTimeUpdates === "function") {
          startRealTimeUpdates(userProfile);
          console.log('✅ Real-time updates started');
        }
        if (typeof updateApprenticeStats === "function") {
          await updateApprenticeStats(userProfile);
          console.log('✅ Apprentice stats updated');
        }
      } catch (err) {
        console.warn('⚠️ Error starting real-time updates:', err.message);
      }
    }
    
    console.log('🎉 Dashboard initialization complete!');
    clearTimeout(timeoutId);
    
  } catch (error) {
    console.error('💥 FATAL ERROR in dashboard initialization:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    clearTimeout(timeoutId);
    
    // Hide spinner even on error
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
      loadingScreen.classList.add('hidden');
      console.log('🛑 Spinner hidden after error');
    }
    
    if (dashboardLayout) {
      dashboardLayout.classList.remove('hidden');
      dashboardLayout.style.display = '';
    }
    
    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'padding: 20px; background: #fee; color: #c00; text-align: center; margin: 20px; border-radius: 8px;';
    errorDiv.innerHTML = `
      <h3>Dashboard Failed to Load</h3>
      <p><strong>Error:</strong> ${error.message}</p>
      <p>Please refresh the page or contact support if the issue persists.</p>
      <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 10px; cursor: pointer;">
        Refresh Page
      </button>
    `;
    if (mainContent) {
      mainContent.prepend(errorDiv);
    } else {
      document.body.prepend(errorDiv);
    }
  }
}

// Check if DOMContentLoaded has already fired
if (document.readyState === 'loading') {
  // DOMContentLoaded hasn't fired yet, wait for it
  console.log('⏳ Document still loading, waiting for DOMContentLoaded...');
  document.addEventListener("DOMContentLoaded", initializeDashboardOnReady);
} else {
  // DOMContentLoaded has already fired, run immediately
  console.log('✅ Document already loaded, running initialization immediately...');
  initializeDashboardOnReady();
}

// --- Gallery Delete Button Setup ---
function setupGalleryDeleteButtons(userData) {
    // Add event listeners to all delete buttons
    document.addEventListener("click", (e) => {
        if (e.target.closest(".delete-post-btn")) {
            e.preventDefault();
            e.stopPropagation();

            const deleteBtn = e.target.closest(".delete-post-btn");
            const postId = deleteBtn.dataset.postId;
            const postTitle = deleteBtn.dataset.postTitle;

            // Show delete confirmation modal
            const titleSpan = document.getElementById("delete-post-title");
            if (titleSpan) titleSpan.textContent = postTitle;

            deletePostModal.classList.add("active");

            // Store post ID for deletion
            deletePostModal.dataset.postId = postId;
        }
    });

    // Handle delete confirmation
    const confirmDeleteBtn = document.getElementById("confirm-delete-post");
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", async () => {
            const postId = deletePostModal.dataset.postId;
            if (postId) {
                await handlePostDelete(postId, userData);
            }
        });
    }
}

// --- Gallery Image Handling ---
function setupGalleryImageHandling() {
    // Handle image loading states
    document.addEventListener("DOMContentLoaded", () => {
        const images = document.querySelectorAll(".gallery-image");
        images.forEach((img) => {
            img.classList.add("image-loading");

            img.onload = function () {
                this.classList.remove("image-loading");
                this.classList.add("image-loaded");
            };

            img.onerror = function () {
                this.classList.remove("image-loading");
                this.src =
                    "https://placehold.co/400x300/EBF4FF/3B82F6?text=Image+Not+Found";
                this.classList.add("opacity-50");
            };
        });
    });
}

// --- Enhanced Gallery Display ---
function enhanceGalleryDisplay() {
    // Add lazy loading for images
    const images = document.querySelectorAll(".gallery-image");
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src || img.src;
                img.classList.remove("lazy");
                observer.unobserve(img);
            }
        });
    });

    images.forEach((img) => {
        if (img.classList.contains("lazy")) {
            imageObserver.observe(img);
        }
    });
}

// --- Refresh Gallery Display ---
async function refreshGallery(userData) {
    try {
        const posts = await getUserPosts(userData.id);
        const galleryContent = memberContentTemplates.gallery(userData, posts);

        // Update the gallery content
        mainContent.innerHTML = galleryContent;

        // Re-setup gallery functionality
        setupGalleryImageHandling();
        enhanceGalleryDisplay();
        await enhanceGalleryDisplayWithUrlTesting(); // Test image URLs
        attachDynamicEventListeners("gallery", userData);

        // Replace feather icons
        if (typeof feather !== "undefined") {
            feather.replace();
        }

        console.log("Gallery refreshed with", posts.length, "posts");
    } catch (error) {
        console.error("Error refreshing gallery:", error);
        showNotification("Error refreshing gallery", "error");
    }
}

// --- Test Image URL Accessibility ---
async function testImageUrl(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;

        // Timeout after 10 seconds
        setTimeout(() => resolve(false), 10000);
    });
}

// --- Enhanced Gallery Display with URL Testing ---
async function enhanceGalleryDisplayWithUrlTesting() {
    const images = document.querySelectorAll(".gallery-image");

    for (const img of images) {
        const originalSrc = img.src;

        // Test if the image URL is accessible
        const isAccessible = await testImageUrl(originalSrc);

        if (!isAccessible) {
            console.warn(`Image URL not accessible: ${originalSrc}`);
            img.src =
                "https://placehold.co/400x300/EBF4FF/3B82F6?text=Image+Loading...";
            img.classList.add("opacity-50");

            // Try to refresh the image after a delay
            setTimeout(async () => {
                const retryAccessible = await testImageUrl(originalSrc);
                if (retryAccessible) {
                    img.src = originalSrc;
                    img.classList.remove("opacity-50");
                    console.log(`Image URL now accessible: ${originalSrc}`);
                }
            }, 2000);
        }
    }
}

// --- Storage Diagnostics ---
async function testStorageConfiguration() {
    try {
        console.log("Testing storage configuration...");

        // Test bucket listing
        const { data: buckets, error: listError } =
            await supabase.storage.listBuckets();
        if (listError) {
            console.error("❌ Cannot list buckets:", listError);
            return false;
        }

        console.log(
            "✅ Available buckets:",
            buckets.map((b) => b.name)
        );

        // Check if posts bucket exists
        const postsBucket = buckets.find((b) => b.name === "posts");
        if (!postsBucket) {
            console.log("⚠️ 'posts' bucket doesn't exist");

            // Try to create it
            const { error: createError } = await supabase.storage.createBucket(
                "posts",
                {
                    public: true,
                    allowedMimeTypes: ["image/*"],
                    fileSizeLimit: 5242880,
                }
            );

            if (createError) {
                console.error("❌ Cannot create posts bucket:", createError);
                return false;
            }

            console.log("✅ Created posts bucket successfully");
        } else {
            console.log("✅ posts bucket exists");
        }

        // Test bucket access
        const bucketAccessible = await checkStorageBucket("posts");
        if (bucketAccessible) {
            console.log("✅ posts bucket is accessible");
        } else {
            console.error("❌ posts bucket is not accessible");
            return false;
        }

        return true;
    } catch (error) {
        console.error("❌ Storage test failed:", error);
        return false;
    }
}

// Export functions for testing/debugging
export {
    renderDashboard,
    switchContent,
    fetchRecommendations,
    loadTrendingCreators,
    handleProfileUpdate,
    handleWorkUpload,
    handlePostDelete,
    togglePostLike,
    checkUserLike,
};

// --- Apprentice Dashboard Stats Management ---
async function updateApprenticeStats(userData) {
    try {
        // Get real stats from database
        const realStats = await getApprenticeStats(userData.id);

        // Use real data for job statistics
        const stats = {
            pendingJobs: realStats.pendingJobs || 0,
            activeJobs: realStats.activeJobs || 0,
            completedJobs: realStats.completedJobs || 0,
            totalEarned: realStats.totalEarned || 0,
            // Keep some placeholder values for features not yet implemented
            availableBalance: Math.floor(Math.random() * 3000000) + 750000, // ₦750,000-₦3,750,000 available
            thisMonth: Math.floor(Math.random() * 1500000) + 300000, // ₦300,000-₦1,800,000 this month
            goalProgress: Math.floor(Math.random() * 40) + 60, // 60-100% goal progress
        };

        // Update stats in the UI
        const statElements = document.querySelectorAll(".stat-card p.text-3xl");
        if (statElements.length >= 3) {
            statElements[0].textContent = stats.pendingJobs;
            statElements[1].textContent = stats.activeJobs;
            statElements[2].textContent = stats.completedJobs;
        }

        // Update earnings stats if on earnings page
        const earningsStats = document.querySelectorAll(
            ".stat-card p.text-3xl"
        );
        if (earningsStats.length >= 4) {
            earningsStats[0].textContent = `₦${(
                stats.totalEarned * 1500
            ).toLocaleString()}`;
            earningsStats[1].textContent = `₦${(
                stats.availableBalance * 1500
            ).toLocaleString()}`;
            earningsStats[2].textContent = `₦${(
                stats.thisMonth * 1500
            ).toLocaleString()}`;
            earningsStats[3].textContent = `${stats.goalProgress}%`;
        }

        return stats;
    } catch (error) {
        console.error("Error updating apprentice stats:", error);
        // Return default values if there's an error
        return {
            pendingJobs: 0,
            activeJobs: 0,
            completedJobs: 0,
            totalEarned: 0,
            availableBalance: 0,
            thisMonth: 0,
            goalProgress: 0,
        };
    }
}

// --- Real-time Updates ---
function startRealTimeUpdates(userData) {
    // Update stats every 30 seconds to simulate real-time data
    setInterval(async () => {
        if (
            currentActiveTab === "home" ||
            currentActiveTab === "jobs" ||
            currentActiveTab === "earnings"
        ) {
            await updateApprenticeStats(userData);
        }
    }, 30000);

    // Simulate new job notifications
    setInterval(() => {
        if (Math.random() < 0.1) {
            // 10% chance every 2 minutes
            const jobTitles = [
                "Logo Design for Startup",
                "Product Photography",
                "Website Development",
                "Social Media Graphics",
                "Brand Identity Design",
            ];
            const randomJob =
                jobTitles[Math.floor(Math.random() * jobTitles.length)];
            showNotification(`New job available: ${randomJob}`, "info");
        }
    }, 120000);
}

// --- Job System Handler Functions ---

// Handle job application
// Show job application modal with CV upload
function showJobApplicationModal(jobId, jobTitle) {
    // Remove existing modal if any
    const existingModal = document.getElementById("job-application-modal");
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement("div");
    modal.id = "job-application-modal";
    modal.className = "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center";
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="p-6 border-b border-gray-200">
                <div class="flex justify-between items-center">
                    <h3 class="text-xl font-bold text-gray-900">Apply for Job</h3>
                    <button id="close-application-modal" class="text-gray-400 hover:text-gray-600">
                        <i data-feather="x" class="w-6 h-6"></i>
                    </button>
                </div>
                <p class="text-gray-600 mt-2">${jobTitle}</p>
            </div>
            <form id="job-application-form" class="p-6 space-y-6">
                <div>
                    <label for="application-proposal" class="block text-sm font-medium text-gray-700 mb-2">
                        Proposal <span class="text-red-500">*</span>
                    </label>
                    <textarea 
                        id="application-proposal" 
                        name="proposal" 
                        rows="5" 
                        required
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Tell the client why you're the best fit for this job..."></textarea>
                    <p class="text-xs text-gray-500 mt-1">Describe your approach, experience, and why you're perfect for this job.</p>
                </div>
                
                <div>
                    <label for="application-cv" class="block text-sm font-medium text-gray-700 mb-2">
                        Upload CV <span class="text-red-500">*</span>
                    </label>
                    <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                        <input 
                            type="file" 
                            id="application-cv" 
                            name="cv" 
                            accept=".pdf,.doc,.docx,.txt"
                            required
                            class="hidden">
                        <div id="cv-upload-area" class="cursor-pointer">
                            <i data-feather="upload" class="w-12 h-12 text-gray-400 mx-auto mb-2"></i>
                            <p class="text-gray-600 font-medium">Click to upload CV</p>
                            <p class="text-xs text-gray-500 mt-1">PDF, DOC, DOCX, or TXT (Max 10MB)</p>
                        </div>
                        <div id="cv-file-info" class="hidden mt-4">
                            <div class="flex items-center justify-between bg-gray-50 p-3 rounded">
                                <div class="flex items-center">
                                    <i data-feather="file" class="w-5 h-5 text-blue-600 mr-2"></i>
                                    <span id="cv-file-name" class="text-sm text-gray-700"></span>
                                </div>
                                <button type="button" id="remove-cv" class="text-red-500 hover:text-red-700">
                                    <i data-feather="x" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-end space-x-4 pt-4 border-t border-gray-200">
                    <button 
                        type="button" 
                        id="cancel-application" 
                        class="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        id="submit-application"
                        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                        Submit Application
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Initialize Feather icons
    if (window.feather) {
        window.feather.replace();
    }
    
    // Setup file upload handlers
    const cvInput = modal.querySelector("#application-cv");
    const cvUploadArea = modal.querySelector("#cv-upload-area");
    const cvFileInfo = modal.querySelector("#cv-file-info");
    const cvFileName = modal.querySelector("#cv-file-name");
    const removeCvBtn = modal.querySelector("#remove-cv");
    
    cvUploadArea.addEventListener("click", () => cvInput.click());
    cvInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            cvFileName.textContent = file.name;
            cvFileInfo.classList.remove("hidden");
            cvUploadArea.classList.add("hidden");
        }
    });
    removeCvBtn.addEventListener("click", () => {
        cvInput.value = "";
        cvFileInfo.classList.add("hidden");
        cvUploadArea.classList.remove("hidden");
    });
    
    // Close modal handlers
    modal.querySelector("#close-application-modal").addEventListener("click", () => modal.remove());
    modal.querySelector("#cancel-application").addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Form submission
    modal.querySelector("#job-application-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        await handleJobApplication(jobId, modal);
    });
}

async function handleJobApplication(jobId, modal) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to apply for jobs", "error");
            return;
        }

        const form = modal.querySelector("#job-application-form");
        const proposal = form.querySelector("#application-proposal").value.trim();
        const cvFile = form.querySelector("#application-cv").files[0];
        const submitBtn = form.querySelector("#submit-application");
        const originalText = submitBtn.innerHTML;

        // Validate inputs
        if (!proposal) {
            showNotification("Please provide a proposal", "error");
            return;
        }

        if (!cvFile) {
            showNotification("Please upload your CV", "error");
            return;
        }

        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-feather="loader" class="w-4 h-4 animate-spin mr-2"></i> Uploading CV...';

        // Upload CV
        let cvUrl = null;
        try {
            cvUrl = await uploadCV(cvFile);
        } catch (uploadError) {
            console.error("CV upload error:", uploadError);
            showNotification(uploadError.message || "Failed to upload CV. Please try again.", "error");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            if (window.feather) window.feather.replace();
            return;
        }

        // Submit application
        submitBtn.innerHTML = '<i data-feather="loader" class="w-4 h-4 animate-spin mr-2"></i> Submitting...';
        await applyForJob(user.id, jobId, proposal, cvUrl);
        
        showNotification("Job application submitted successfully!", "success");
        modal.remove();

        // Refresh the jobs tab
        const jobsTab = document.querySelector('[data-tab="jobs"]');
        if (jobsTab) {
            jobsTab.click();
        }
    } catch (error) {
        console.error("Error applying for job:", error);
        showNotification(error.message || "Failed to apply for job", "error");
        const submitBtn = modal.querySelector("#submit-application");
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Submit Application";
        if (window.feather) window.feather.replace();
    }
}

// Handle job creation
async function handleJobCreation() {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to create jobs", "error");
            return;
        }

        const form = document.getElementById("create-job-form");
        const formData = new FormData(form);

        const jobData = {
            title: formData.get("title"),
            description: formData.get("description"),
            budgetMin: parseInt(formData.get("budgetMin")),
            budgetMax: parseInt(formData.get("budgetMax")),
            location: formData.get("location") || "Remote",
            deadline: formData.get("deadline"),
            skillsRequired: Array.from(
                form.querySelector("#job-skills").selectedOptions
            ).map((option) => option.value),
        };

        // Validate form data
        if (
            !jobData.title ||
            !jobData.description ||
            !jobData.budgetMin ||
            !jobData.budgetMax ||
            !jobData.deadline
        ) {
            showNotification("Please fill in all required fields", "error");
            return;
        }

        if (jobData.budgetMin > jobData.budgetMax) {
            showNotification(
                "Minimum budget cannot be greater than maximum budget",
                "error"
            );
            return;
        }

        if (jobData.budgetMin < 1500) {
            showNotification(
                "Minimum budget must be at least ₦1,500",
                "error"
            );
            return;
        }

        try {
            await createJobRequest(user.id, jobData);
            showNotification("Job request created successfully!", "success");

            // Refresh wallet balance if wallet interface is available
            if (window.initializeWalletInterface) {
                try {
                    await window.initializeWalletInterface();
                } catch (walletError) {
                    console.warn("Failed to refresh wallet balance:", walletError);
                }
            }

            // Reset form
            form.reset();

            // Refresh the jobs tab
            const jobsTab = document.querySelector('[data-tab="jobs"]');
            if (jobsTab) {
                jobsTab.click();
            }
        } catch (error) {
            // Check if error is due to insufficient funds
            if (error.message && error.message.includes("Insufficient funds")) {
                // Show modal to fund job via Flutterwave
                showJobFundingModal(jobData, error.message);
            } else {
                throw error; // Re-throw other errors
            }
        }
    } catch (error) {
        console.error("Error creating job:", error);
        showNotification(
            error.message || "Failed to create job request",
            "error"
        );
    }
}

// Show job funding modal when wallet balance is insufficient
async function showJobFundingModal(jobData, errorMessage) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.id = 'job-funding-modal';
    
    const escrowAmount = jobData.budgetMax;
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold text-gray-900">Fund Job via Flutterwave</h3>
                <button id="close-job-funding-modal" class="text-gray-400 hover:text-gray-600">
                    <i data-feather="x" class="w-6 h-6"></i>
                </button>
            </div>
            
            <div class="mb-6">
                <p class="text-gray-600 mb-4">${errorMessage}</p>
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p class="text-sm text-blue-800 mb-2"><strong>Job Details:</strong></p>
                    <p class="text-sm text-blue-900"><strong>Title:</strong> ${jobData.title}</p>
                    <p class="text-sm text-blue-900"><strong>Required Amount:</strong> ₦${escrowAmount.toLocaleString()}</p>
                </div>
                <p class="text-sm text-gray-600">
                    You can fund this job directly via Flutterwave. The job will be created and funded once payment is confirmed.
                </p>
            </div>
            
            <div class="space-y-3">
                <button id="fund-job-flutterwave-btn" class="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 flex items-center justify-center font-semibold">
                    <i data-feather="credit-card" class="w-5 h-5 mr-2"></i>
                    Pay ₦${escrowAmount.toLocaleString()} with Flutterwave
                </button>
                <button id="cancel-job-funding-btn" class="w-full bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-semibold">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeBtn = modal.querySelector('#close-job-funding-modal');
    const cancelBtn = modal.querySelector('#cancel-job-funding-btn');
    const fundBtn = modal.querySelector('#fund-job-flutterwave-btn');
    
    closeBtn.addEventListener('click', () => modal.remove());
    cancelBtn.addEventListener('click', () => modal.remove());
    
    fundBtn.addEventListener('click', async () => {
        await processJobFundingPayment(jobData, escrowAmount);
        modal.remove();
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
    
    if (window.feather) window.feather.replace();
}

// Process job funding payment via Flutterwave
async function processJobFundingPayment(jobData, amount) {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            showNotification("Please log in to continue", "error");
            return;
        }

        // First, create the job with pending_funding status
        const { data: job, error: jobError } = await supabase
            .from("job_requests")
            .insert({
                client_id: user.id,
                title: jobData.title,
                description: jobData.description,
                budget_min: jobData.budgetMin,
                budget_max: jobData.budgetMax,
                escrow_amount: amount,
                skills_required: jobData.skillsRequired,
                location: jobData.location,
                deadline: jobData.deadline,
                status: "pending_funding", // Special status for jobs awaiting payment
                escrow_status: "pending",
                locked: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (jobError || !job) {
            throw new Error("Failed to create job: " + (jobError?.message || "Unknown error"));
        }

        // Now initiate Flutterwave payment with the job_id
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            // Delete the job if payment initiation fails
            await supabase.from("job_requests").delete().eq("id", job.id);
            showNotification("Please log in to continue", "error");
            return;
        }

        const flutterwaveUrl = ENV_CONFIG.FLUTTERWAVE_FUNCTION_URL || 
            `${ENV_CONFIG.SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co')}/flutterwave-init-payment`;

        const response = await fetch(flutterwaveUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                amount: amount,
                type: "job_funding",
                job_id: job.id,
                description: `Job funding: ${jobData.title}`,
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            // Delete the job if payment initiation fails
            await supabase.from("job_requests").delete().eq("id", job.id);
            throw new Error(data.error || "Failed to start Flutterwave payment");
        }

        // Redirect to Flutterwave checkout
        window.location.href = data.payment_url;
    } catch (error) {
        console.error("Error initializing Flutterwave job funding payment:", error);
        showNotification(error.message || "Failed to start Flutterwave payment. Please try again.", "error");
    }
}

// Handle application action (accept/reject)
async function handleApplicationAction(appId, action) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to manage applications", "error");
            return;
        }

        await updateApplicationStatus(appId, action, user.id);
        showNotification(`Application ${action} successfully!`, "success");

        // Refresh the jobs tab
        const jobsTab = document.querySelector('[data-tab="jobs"]');
        if (jobsTab) {
            jobsTab.click();
        }
    } catch (error) {
        console.error("Error updating application:", error);
        showNotification(
            error.message || "Failed to update application",
            "error"
        );
    }
}

// Handle job progress update
async function handleJobProgressUpdate(jobId, progress) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to update job progress", "error");
            return;
        }

        await updateJobProgress(jobId, progress, user.id);
        showNotification(`Job progress updated to ${progress}%`, "success");

        // Refresh the jobs tab
        const jobsTab = document.querySelector('[data-tab="jobs"]');
        if (jobsTab) {
            jobsTab.click();
        }
    } catch (error) {
        console.error("Error updating job progress:", error);
        showNotification(
            error.message || "Failed to update job progress",
            "error"
        );
    }
}

// Handle CV viewing
async function handleViewCV(cvUrl) {
    try {
        const signedUrl = await getCVSignedUrl(cvUrl);
        // Open CV in new tab
        window.open(signedUrl, '_blank');
    } catch (error) {
        console.error("Error viewing CV:", error);
        showNotification(error.message || "Failed to open CV. Please try again.", "error");
    }
}

// Handle job completion
async function handleJobCompletion(jobId) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to complete jobs", "error");
            return;
        }

        const result = await completeJob(jobId, user.id);
        showNotification(
            result.message || "Job submitted for review",
            "success"
        );

        // Refresh the jobs tab
        const jobsTab = document.querySelector('[data-tab="jobs"]');
        if (jobsTab) {
            jobsTab.click();
        }
    } catch (error) {
        console.error("Error completing job:", error);
        showNotification(error.message || "Failed to complete job", "error");
    }
}

// Handle job review
async function handleJobReview(jobId) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to review jobs", "error");
            return;
        }

        // Get job details for review
        const { data: job, error: fetchError } = await supabase
            .from("job_requests")
            .select(
                `
                *,
                assigned_apprentice:profiles!job_requests_assigned_apprentice_id_fkey(
                    id,
                    name,
                    skill,
                    location,
                    email
                )
            `
            )
            .eq("id", jobId)
            .eq("client_id", user.id)
            .eq("status", "pending_review")
            .single();

        if (fetchError || !job) {
            showNotification("Job not found or unauthorized", "error");
            return;
        }

        // Populate review modal with job details
        const reviewJobDetails = document.getElementById("review-job-details");
        reviewJobDetails.innerHTML = `
            <div class="bg-gray-50 p-4 rounded-lg">
                <h4 class="text-lg font-semibold text-gray-900 mb-3">${
                    job.title
                }</h4>
                <p class="text-gray-600 mb-4">${job.description}</p>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span class="text-gray-500">Budget:</span>
                        <span class="font-medium">₦${(
                            job.budget_min
                        ).toLocaleString()}-₦${(
            job.budget_max
        ).toLocaleString()}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">Location:</span>
                        <span class="font-medium">${
                            job.location || "Remote"
                        }</span>
                    </div>
                    <div>
                        <span class="text-gray-500">Deadline:</span>
                        <span class="font-medium">${new Date(
                            job.deadline
                        ).toLocaleDateString()}</span>
                    </div>
                    <div>
                        <span class="text-gray-500">Completed:</span>
                        <span class="font-medium">${new Date(
                            job.completed_at
                        ).toLocaleDateString()}</span>
                    </div>
                </div>
                
                <div class="mt-4 p-3 bg-blue-50 rounded-lg">
                    <h5 class="font-medium text-blue-900 mb-2">Assigned Apprentice</h5>
                    <div class="flex items-center">
                        <img src="https://placehold.co/40x40/EBF4FF/3B82F6?text=${
                            job.assigned_apprentice?.name?.charAt(0) || "A"
                        }" 
                             alt="${
                                 job.assigned_apprentice?.name || "Apprentice"
                             }" 
                             class="w-10 h-10 rounded-full mr-3">
                        <div class="flex-1">
                            <p class="font-medium text-blue-900">${
                                job.assigned_apprentice?.name || "Anonymous"
                            }</p>
                            <p class="text-sm text-blue-700">${
                                job.assigned_apprentice?.skill || "Apprentice"
                            } • ${
            job.assigned_apprentice?.location || "Unknown"
        }</p>
                            <div id="apprentice-rating-${job.id}" class="mt-2">
                                <div class="flex items-center space-x-2">
                                    <span class="text-sm text-gray-500">Loading rating...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Set job ID for form submission
        jobReviewForm.dataset.jobId = jobId;

        // Load apprentice rating
        await loadApprenticeRating(jobId, job.assigned_apprentice?.id);

        // Show review modal
        jobReviewModal.classList.add("active");
    } catch (error) {
        console.error("Error loading job for review:", error);
        showNotification("Failed to load job details", "error");
    }
}

// Handle job deletion
async function handleJobDelete(jobId, jobTitle) {
    try {
        // Show confirmation dialog
        const confirmed = confirm(`Are you sure you want to delete the job "${jobTitle}"? This action cannot be undone.`);
        if (!confirmed) {
            return;
        }

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to delete jobs", "error");
            return;
        }

        // Call the delete function
        await deleteJobRequest(jobId, user.id);
        
        // Show success message
        showNotification("Job deleted successfully!", "success");
        
        // Refresh the jobs tab
        const jobsTab = document.querySelector('[data-tab="jobs"]');
        if (jobsTab) {
            jobsTab.click();
        }
    } catch (error) {
        console.error("Error deleting job:", error);
        let errorMessage = "Failed to delete job. Please try again.";
        
        if (error.message.includes("own job requests")) {
            errorMessage = "You can only delete your own job requests.";
        } else if (error.message.includes("in progress or completed")) {
            errorMessage = "Cannot delete job that is in progress or completed.";
        } else if (error.message.includes("not found")) {
            errorMessage = "Job not found or may have already been deleted.";
        }
        
        showNotification(errorMessage, "error");
    }
}

// Load and display apprentice rating
async function loadApprenticeRating(jobId, apprenticeId) {
    if (!apprenticeId) {
        console.log(`No apprenticeId provided for job ${jobId}`);
        return;
    }

    try {
        console.log(`Loading rating for apprentice ${apprenticeId} on job ${jobId}`);
        const ratingDetails = await getApprenticeRatingDetails(apprenticeId);
        console.log('Rating details received:', ratingDetails);
        const ratingContainer = document.getElementById(`apprentice-rating-${jobId}`);
        
        if (!ratingContainer) {
            console.log(`Rating container not found for job ${jobId}`);
            return;
        }

        if (ratingDetails.total_ratings > 0) {
            const averageRating = ratingDetails.average_rating;
            const ratings5Star = ratingDetails.ratings_5_star;
            
            // Generate star display
            const fullStars = Math.floor(averageRating);
            const hasHalfStar = averageRating % 1 >= 0.5;
            const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
            
            let starsHTML = '';
            for (let i = 0; i < fullStars; i++) {
                starsHTML += '<span class="text-yellow-400">★</span>';
            }
            if (hasHalfStar) {
                starsHTML += '<span class="text-yellow-400">☆</span>';
            }
            for (let i = 0; i < emptyStars; i++) {
                starsHTML += '<span class="text-gray-300">★</span>';
            }

            ratingContainer.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="flex items-center space-x-1">
                        <div class="flex">${starsHTML}</div>
                        <span class="text-sm font-medium text-gray-600 ml-1">${averageRating.toFixed(1)}</span>
                    </div>
                    <div class="flex items-center space-x-1">
                        <span class="text-xs text-gray-500">(${ratingDetails.total_ratings} rating${ratingDetails.total_ratings !== 1 ? 's' : ''})</span>
                        ${ratings5Star > 0 ? `<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">${ratings5Star} five-star</span>` : ''}
                    </div>
                </div>
            `;
        } else {
            ratingContainer.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span class="text-sm text-gray-500">No ratings yet</span>
                </div>
            `;
        }
    } catch (error) {
        console.error("Error loading apprentice rating:", error);
        const ratingContainer = document.getElementById(`apprentice-rating-${jobId}`);
        if (ratingContainer) {
            ratingContainer.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span class="text-sm text-gray-500">Rating unavailable</span>
                </div>
            `;
        }
    }
}

// Load ratings for all apprentice applications
async function loadAllApprenticeRatings() {
    try {
        console.log('Loading all apprentice ratings...');
        // Find all application rating containers
        const ratingContainers = document.querySelectorAll('[id^="apprentice-rating-app-"]');
        console.log(`Found ${ratingContainers.length} rating containers`);
        
        for (const container of ratingContainers) {
            const appId = container.id.replace('apprentice-rating-app-', '');
            
            // Find the apprentice ID from the application data
            const applicationCard = container.closest('.border');
            if (!applicationCard) continue;
            
            // Try to get apprentice ID from data attributes or find it in the DOM
            const apprenticeName = applicationCard.querySelector('h6')?.textContent;
            if (!apprenticeName) continue;
            
            // For now, we'll need to get the apprentice ID from the application data
            // This is a simplified approach - in a real implementation, you'd store the apprentice ID
            // in a data attribute when rendering the applications
            const apprenticeId = applicationCard.dataset.apprenticeId;
            if (!apprenticeId) continue;
            
            await loadApprenticeRatingForApplication(appId, apprenticeId);
        }
    } catch (error) {
        console.error("Error loading apprentice ratings:", error);
    }
}

// Load rating for a specific application
async function loadApprenticeRatingForApplication(appId, apprenticeId) {
    try {
        console.log(`Loading rating for application ${appId}, apprentice ${apprenticeId}`);
        const ratingDetails = await getApprenticeRatingDetails(apprenticeId);
        console.log('Application rating details received:', ratingDetails);
        const ratingContainer = document.getElementById(`apprentice-rating-app-${appId}`);
        
        if (!ratingContainer) {
            console.log(`Rating container not found for application ${appId}`);
            return;
        }

        if (ratingDetails.total_ratings > 0) {
            const averageRating = ratingDetails.average_rating;
            const ratings5Star = ratingDetails.ratings_5_star;
            
            // Generate star display
            const fullStars = Math.floor(averageRating);
            const hasHalfStar = averageRating % 1 >= 0.5;
            const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
            
            let starsHTML = '';
            for (let i = 0; i < fullStars; i++) {
                starsHTML += '<span class="text-yellow-400 text-sm">★</span>';
            }
            if (hasHalfStar) {
                starsHTML += '<span class="text-yellow-400 text-sm">☆</span>';
            }
            for (let i = 0; i < emptyStars; i++) {
                starsHTML += '<span class="text-gray-300 text-sm">★</span>';
            }

            ratingContainer.innerHTML = `
                <div class="flex items-center space-x-2">
                    <div class="flex items-center space-x-1">
                        <div class="flex">${starsHTML}</div>
                        <span class="text-xs font-medium text-gray-600 ml-1">${averageRating.toFixed(1)}</span>
                    </div>
                    <div class="flex items-center space-x-1">
                        <span class="text-xs text-gray-400">(${ratingDetails.total_ratings})</span>
                        ${ratings5Star > 0 ? `<span class="text-xs bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded">${ratings5Star} five-star</span>` : ''}
                    </div>
                </div>
            `;
        } else {
            ratingContainer.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span class="text-xs text-gray-400">No ratings</span>
                </div>
            `;
        }
    } catch (error) {
        console.error("Error loading application rating:", error);
        const ratingContainer = document.getElementById(`apprentice-rating-app-${appId}`);
        if (ratingContainer) {
            ratingContainer.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span class="text-xs text-gray-400">Rating unavailable</span>
                </div>
            `;
        }
    }
}

// Update rating display when stars are clicked
function updateRatingDisplay(rating) {
    const stars = document.querySelectorAll('.rating-star');
    const ratingText = document.getElementById('rating-text');
    const ratingInput = document.getElementById('rating-input');
    
    // Update star colors
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.remove('text-gray-300');
            star.classList.add('text-yellow-400');
        } else {
            star.classList.remove('text-yellow-400');
            star.classList.add('text-gray-300');
        }
    });
    
    // Update rating text
    const ratingTexts = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
    ratingText.textContent = `${rating} star${rating > 1 ? 's' : ''} - ${ratingTexts[rating]}`;
    
    // Store the rating value
    ratingInput.value = rating;
}

// Open rating modal for completed jobs
async function openRatingModal(jobId, apprenticeId) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to rate apprentices", "error");
            return;
        }

        // Check if user can rate this apprentice
        const canRate = await checkRatingEligibility(jobId, user.id);
        if (!canRate) {
            showNotification("You cannot rate this apprentice for this job", "error");
            return;
        }

        // Get job and apprentice details
        const { data: job, error: jobError } = await supabase
            .from("job_requests")
            .select(`
                *,
                assigned_apprentice:profiles!job_requests_assigned_apprentice_id_fkey(
                    id,
                    name,
                    skill,
                    location
                )
            `)
            .eq("id", jobId)
            .eq("client_id", user.id)
            .eq("status", "completed")
            .single();

        if (jobError || !job) {
            showNotification("Job not found or unauthorized", "error");
            return;
        }

        // Populate rating modal
        const ratingModal = document.getElementById("rating-modal");
        const ratingJobDetails = document.getElementById("rating-job-details");
        
        if (!ratingModal || !ratingJobDetails) {
            showNotification("Rating modal not found", "error");
            return;
        }

        ratingJobDetails.innerHTML = `
            <div class="bg-gray-50 p-4 rounded-lg">
                <h4 class="text-lg font-semibold text-gray-900 mb-3">${job.title}</h4>
                <p class="text-gray-600 mb-4">${job.description}</p>
                
                <div class="flex items-center space-x-3">
                    <div class="flex-shrink-0">
                        <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span class="text-blue-600 font-semibold text-sm">
                                ${job.assigned_apprentice?.name?.charAt(0) || 'A'}
                            </span>
                        </div>
                    </div>
                    <div>
                        <p class="font-medium text-gray-900">${job.assigned_apprentice?.name || "Anonymous"}</p>
                        <p class="text-sm text-gray-600">${job.assigned_apprentice?.skill || "Apprentice"} • ${job.assigned_apprentice?.location || "Unknown"}</p>
                    </div>
                </div>
            </div>
        `;

        // Set job ID for form submission
        document.getElementById("rating-form").dataset.jobId = jobId;
        document.getElementById("rating-form").dataset.apprenticeId = apprenticeId;

        // Show modal
        ratingModal.classList.add("active");
    } catch (error) {
        console.error("Error opening rating modal:", error);
        showNotification("Failed to open rating form", "error");
    }
}

// Handle rating submission
async function handleRatingSubmission(event) {
    event.preventDefault();

    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to submit rating", "error");
            return;
        }

        const jobId = document.getElementById("rating-form").dataset.jobId;
        const apprenticeId = document.getElementById("rating-form").dataset.apprenticeId;
        const rating = parseInt(document.getElementById("rating-input").value);
        const comment = document.getElementById("rating-comment-input").value;

        if (!jobId || !apprenticeId || !rating || rating < 1 || rating > 5) {
            showNotification("Please provide a valid rating (1-5 stars)", "error");
            return;
        }

        // Show loading state
        const submitBtn = document.getElementById("submit-rating");
        const spinner = document.getElementById("rating-spinner");
        submitBtn.disabled = true;
        spinner.classList.remove("hidden");

        // Submit rating
        await submitRating(jobId, rating, comment, user.id);

        // Hide modal
        document.getElementById("rating-modal").classList.remove("active");

        // Show success message
        showNotification("Rating submitted successfully!", "success");

        // Reset form
        document.getElementById("rating-form").reset();
        document.getElementById("rating-form").dataset.jobId = "";
        document.getElementById("rating-form").dataset.apprenticeId = "";

        // Refresh the jobs tab
        const jobsTab = document.querySelector('[data-tab="jobs"]');
        if (jobsTab) {
            jobsTab.click();
        }
    } catch (error) {
        console.error("Error submitting rating:", error);
        showNotification("Failed to submit rating. Please try again.", "error");
    } finally {
        // Hide loading state
        const submitBtn = document.getElementById("submit-rating");
        const spinner = document.getElementById("rating-spinner");
        submitBtn.disabled = false;
        spinner.classList.add("hidden");
    }
}

// Handle job review submission
async function handleJobReviewSubmission(event) {
    event.preventDefault();

    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to submit review", "error");
            return;
        }

        const jobId = jobReviewForm.dataset.jobId;
        const decision = document.querySelector(
            'input[name="review-decision"]:checked'
        ).value;
        const notes = document.getElementById("review-notes").value;
        const rating = parseInt(document.getElementById("rating-slider").value);
        const ratingComment = document.getElementById("rating-comment").value;

        if (!jobId || !decision || !notes) {
            showNotification("Please fill in all fields", "error");
            return;
        }

        // If approving, require a rating
        if (decision === "approve" && (!rating || rating < 1 || rating > 5)) {
            showNotification("Please provide a rating (1-5 stars) when approving the job", "error");
            return;
        }

        // Show loading state
        const submitBtn = document.getElementById("submit-review");
        const spinner = document.getElementById("review-spinner");
        submitBtn.disabled = true;
        spinner.classList.remove("hidden");

        // Submit review
        const result = await reviewJob(
            jobId,
            decision === "approve",
            notes,
            user.id
        );

        // Hide modal
        jobReviewModal.classList.remove("active");

        // Show success message
        if (result.approved) {
            // Submit rating if job was approved
            try {
                await submitRating(jobId, rating, ratingComment, user.id);
                showNotification(
                    `Job approved and rated ${rating} star${rating > 1 ? 's' : ''}! Payment of ₦${(
                        result.payment
                    ).toLocaleString()} has been released to the apprentice.`,
                    "success"
                );
            } catch (ratingError) {
                console.error("Error submitting rating:", ratingError);
                showNotification(
                    `Job approved! Payment of ₦${(
                        result.payment
                    ).toLocaleString()} has been released to the apprentice. Rating submission failed.`,
                    "warning"
                );
            }
        } else {
            showNotification(
                "Job rejected and returned to apprentice for revisions.",
                "success"
            );
        }

        // Reset form
        jobReviewForm.reset();
        jobReviewForm.dataset.jobId = "";

        // Refresh the jobs tab
        const jobsTab = document.querySelector('[data-tab="jobs"]');
        if (jobsTab) {
            jobsTab.click();
        }
    } catch (error) {
        console.error("Error submitting review:", error);
        showNotification(error.message || "Failed to submit review", "error");
    } finally {
        // Reset loading state
        const submitBtn = document.getElementById("submit-review");
        const spinner = document.getElementById("review-spinner");
        submitBtn.disabled = false;
        spinner.classList.add("hidden");
    }
}

// Handle gallery view for viewing apprentice galleries
async function handleGalleryView(userId, userName) {
    try {
        // Get current user for like functionality
        const {
            data: { user },
        } = await supabase.auth.getUser();
        const currentUserId = user ? user.id : null;

        // Get user profile for additional info
        const userProfile = await getUserProfile(userId);

        // Show modal and loading state
        const galleryModal = document.getElementById("gallery-view-modal");
        const galleryContent = document.getElementById("gallery-content");
        const galleryLoading = document.getElementById("gallery-loading");
        const galleryEmpty = document.getElementById("gallery-empty");
        const galleryUserName = document.getElementById("gallery-user-name");
        const galleryUserInfo = document.getElementById("gallery-user-info");
        const galleryUserAvatar = document.getElementById(
            "gallery-user-avatar"
        );

        // Set user info
        galleryUserName.textContent = userName;
        galleryUserInfo.textContent = `${userProfile.skill || "Apprentice"} • ${
            userProfile.location || "Unknown location"
        }`;
        setAvatarWithFallback(galleryUserAvatar, userName, 48);
        galleryUserAvatar.alt = userName;

        // Show modal
        galleryModal.classList.add("active");

        // Show loading
        galleryLoading.classList.remove("hidden");
        galleryContent.classList.add("hidden");
        galleryEmpty.classList.add("hidden");

        // Fetch user's posts
        const posts = await getUserPostsById(userId, currentUserId);

        // Hide loading
        galleryLoading.classList.add("hidden");

        if (posts.length === 0) {
            // Show empty state
            galleryEmpty.classList.remove("hidden");
            galleryContent.classList.add("hidden");
        } else {
            // Show posts
            galleryContent.classList.remove("hidden");
            galleryEmpty.classList.add("hidden");

            // Render posts
            galleryContent.innerHTML = posts
                .map(
                    (post) => `
                    <div class="bg-white rounded-lg shadow-md overflow-hidden gallery-image-container">
                        <div class="relative">
                            <img 
                                src="${post.image_url}" 
                                alt="${post.title}" 
                                class="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onclick="openImageViewer('${
                                    post.image_url
                                }', '${post.title}', '${post.description}')"
                            >
                            <div class="absolute top-2 right-2">
                                <button class="like-post-btn bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all ${
                                    post.user_liked
                                        ? "text-red-500"
                                        : "text-gray-500"
                                }" 
                                        data-post-id="${post.id}" 
                                        data-post-liked="${post.user_liked}">
                                    <i data-feather="heart" class="w-4 h-4 ${
                                        post.user_liked ? "fill-current" : ""
                                    }"></i>
                                </button>
                            </div>
                        </div>
                        <div class="p-4">
                            <h4 class="font-semibold text-gray-900 mb-1 line-clamp-2">${
                                post.title
                            }</h4>
                            <p class="text-sm text-gray-600 line-clamp-2">${
                                post.description
                            }</p>
                            <div class="flex items-center justify-between mt-3 text-xs text-gray-500">
                                <span>${new Date(
                                    post.created_at
                                ).toLocaleDateString()}</span>
                                <span class="flex items-center">
                                    <i data-feather="heart" class="w-3 h-3 mr-1"></i>
                                    ${post.likes || 0}
                                </span>
                            </div>
                        </div>
                    </div>
                `
                )
                .join("");

            // Replace feather icons
            if (typeof feather !== "undefined") {
                feather.replace();
            }
        }

        // Modal event handlers are now managed in attachDynamicEventListeners
    } catch (error) {
        console.error("Error loading gallery:", error);
        showNotification("Failed to load gallery", "error");
    }
}

// --- Progress Update & Feedback System Functions ---

// Handle progress update modal opening (for apprentices)
async function openProgressUpdateModal(jobId) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to submit progress updates", "error");
            return;
        }

        // Store job ID for form submission
        progressUpdateForm.dataset.jobId = jobId;
        
        // Show modal
        progressUpdateModal.classList.add("active");
        
        // Reset form
        progressUpdateForm.reset();
    } catch (error) {
        console.error("Error opening progress update modal:", error);
        showNotification("Failed to open progress update form", "error");
    }
}

// Handle final work modal opening (for apprentices)
async function openFinalWorkModal(jobId) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to submit final work", "error");
            return;
        }

        // Store job ID for form submission
        finalWorkForm.dataset.jobId = jobId;
        
        // Show modal
        finalWorkModal.classList.add("active");
        
        // Reset form
        finalWorkForm.reset();
    } catch (error) {
        console.error("Error opening final work modal:", error);
        showNotification("Failed to open final work form", "error");
    }
}

// Handle progress update form submission
async function handleProgressUpdateSubmission(e) {
    e.preventDefault();
    
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to submit progress updates", "error");
            return;
        }

        const jobId = progressUpdateForm.dataset.jobId;
        const title = document.getElementById("progress-title").value;
        const description = document.getElementById("progress-description").value;
        const file = document.getElementById("progress-file").files[0];
        const linkUrl = document.getElementById("progress-link").value;

        // Show loading state
        const submitBtn = document.getElementById("submit-progress-update");
        const spinner = document.getElementById("progress-update-spinner");
        submitBtn.disabled = true;
        spinner.classList.remove("hidden");

        let fileUrl = null;
        let fileType = null;

        // Upload file if provided
        if (file) {
            const fileExt = file.name.split('.').pop().toLowerCase();
            const fileName = `${user.id}/${Date.now()}-${file.name}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('progress-files')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            fileUrl = uploadData.path;
            fileType = fileExt;
        }

        // Prepare submission data
        const submissionData = {
            title,
            description,
            fileUrl,
            fileType,
            linkUrl: linkUrl || null
        };

        // Submit progress update
        await submitProgressUpdate(jobId, user.id, submissionData);
        
        showNotification("Progress update submitted successfully!", "success");
        
        // Close modal
        progressUpdateModal.classList.remove("active");
        
        // Refresh the jobs tab
        const jobsTab = document.querySelector('[data-tab="jobs"]');
        if (jobsTab) {
            jobsTab.click();
        }

    } catch (error) {
        console.error("Error submitting progress update:", error);
        showNotification(error.message || "Failed to submit progress update", "error");
    } finally {
        // Reset loading state
        const submitBtn = document.getElementById("submit-progress-update");
        const spinner = document.getElementById("progress-update-spinner");
        submitBtn.disabled = false;
        spinner.classList.add("hidden");
    }
}

// Handle final work form submission
async function handleFinalWorkSubmission(e) {
    e.preventDefault();
    
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to submit final work", "error");
            return;
        }

        const jobId = finalWorkForm.dataset.jobId;
        const title = document.getElementById("final-title").value;
        const description = document.getElementById("final-description").value;
        const file = document.getElementById("final-file").files[0];
        const linkUrl = document.getElementById("final-link").value;

        if (!file) {
            showNotification("Please upload your final work file", "error");
            return;
        }

        // Show loading state
        const submitBtn = document.getElementById("submit-final-work");
        const spinner = document.getElementById("final-work-spinner");
        submitBtn.disabled = true;
        spinner.classList.remove("hidden");

        // Upload file
        const fileExt = file.name.split('.').pop().toLowerCase();
        const fileName = `${user.id}/${Date.now()}-${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('final-work-files')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Prepare submission data
        const submissionData = {
            title,
            description,
            fileUrl: uploadData.path,
            fileType: fileExt,
            linkUrl: linkUrl || null
        };

        // Submit final work
        await submitFinalWork(jobId, user.id, submissionData);
        
        showNotification("Final work submitted successfully!", "success");
        
        // Close modal
        finalWorkModal.classList.remove("active");
        
        // Refresh the jobs tab
        const jobsTab = document.querySelector('[data-tab="jobs"]');
        if (jobsTab) {
            jobsTab.click();
        }

    } catch (error) {
        console.error("Error submitting final work:", error);
        showNotification(error.message || "Failed to submit final work", "error");
    } finally {
        // Reset loading state
        const submitBtn = document.getElementById("submit-final-work");
        const spinner = document.getElementById("final-work-spinner");
        submitBtn.disabled = false;
        spinner.classList.add("hidden");
    }
}

// Open dispute submission modal
async function openDisputeModal(jobId) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to submit a dispute", "error");
            return;
        }

        // Get job details
        const { data: job, error: jobError } = await supabase
            .from("job_requests")
            .select("*")
            .eq("id", jobId)
            .single();

        if (jobError || !job) {
            showNotification("Job not found", "error");
            return;
        }

        // Check if user is authorized to dispute
        const isMember = job.client_id === user.id;
        const isApprentice = job.assigned_apprentice_id === user.id;

        if (!isMember && !isApprentice) {
            showNotification("You are not authorized to dispute this job", "error");
            return;
        }

        // Check if job is in a state that can be disputed
        if (job.status !== 'in-progress' && job.status !== 'pending_review') {
            showNotification("This job cannot be disputed in its current state", "error");
            return;
        }

        // Populate job details
        const jobDetailsEl = document.getElementById("dispute-job-details");
        if (jobDetailsEl) {
            jobDetailsEl.innerHTML = `
                <h3 class="font-semibold text-lg mb-2">${job.title || 'Untitled Job'}</h3>
                <p class="text-sm text-gray-600 mb-2">Job ID: #${job.id}</p>
                <p class="text-sm text-gray-600">Budget: ₦${(job.budget || 0).toLocaleString()}</p>
            `;
        }

        // Set job ID on form
        const disputeForm = document.getElementById("dispute-form");
        if (disputeForm) {
            disputeForm.dataset.jobId = jobId;
        }

        // Show modal
        const disputeModal = document.getElementById("dispute-modal");
        if (disputeModal) {
            disputeModal.classList.add("active");
        }

        // Replace feather icons
        if (typeof feather !== "undefined") {
            feather.replace();
        }
    } catch (error) {
        console.error("Error opening dispute modal:", error);
        showNotification("Failed to open dispute form", "error");
    }
}

// Handle dispute form submission
async function handleDisputeSubmission(event) {
    event.preventDefault();

    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to submit a dispute", "error");
            return;
        }

        const disputeForm = document.getElementById("dispute-form");
        const jobId = disputeForm?.dataset.jobId;
        const disputeType = document.getElementById("dispute-type").value;
        const description = document.getElementById("dispute-description").value;
        const evidenceFiles = document.getElementById("dispute-evidence").files;

        if (!jobId || !disputeType || !description) {
            showNotification("Please fill in all required fields", "error");
            return;
        }

        // Show loading state
        const submitBtn = document.getElementById("submit-dispute");
        const spinner = document.getElementById("dispute-spinner");
        submitBtn.disabled = true;
        spinner.classList.remove("hidden");

        // Prepare dispute data
        const disputeData = {
            type: disputeType,
            description: description,
            evidenceFiles: Array.from(evidenceFiles)
        };

        // Submit dispute
        await submitDispute(jobId, user.id, disputeData);

        showNotification("Dispute submitted successfully! Admin will review it shortly.", "success");

        // Close modal
        const disputeModal = document.getElementById("dispute-modal");
        if (disputeModal) {
            disputeModal.classList.remove("active");
        }

        // Reset form
        disputeForm.reset();
        document.getElementById("dispute-evidence-preview").innerHTML = "";

        // Refresh jobs tab if on jobs page
        const jobsTab = document.querySelector('[data-tab="jobs"]');
        if (jobsTab) {
            jobsTab.click();
        }
    } catch (error) {
        console.error("Error submitting dispute:", error);
        showNotification(error.message || "Failed to submit dispute", "error");
    } finally {
        // Reset loading state
        const submitBtn = document.getElementById("submit-dispute");
        const spinner = document.getElementById("dispute-spinner");
        if (submitBtn) submitBtn.disabled = false;
        if (spinner) spinner.classList.add("hidden");
    }
}

// Make openDisputeModal globally available
window.openDisputeModal = openDisputeModal;

// Load progress updates for a job (for members)
async function loadProgressUpdates(jobId) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to view progress updates", "error");
            return;
        }

        // Get progress updates
        const updates = await getProgressUpdates(jobId, "member", user.id);
        
        // Display updates
        const container = document.getElementById(`progress-updates-${jobId}`);
        if (!container) return;

        if (updates.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-gray-500">
                    <i data-feather="clock" class="w-8 h-8 mx-auto mb-2"></i>
                    <p>No progress updates yet</p>
                </div>
            `;
        } else {
            container.innerHTML = updates.map(update => `
                <div class="border border-gray-200 rounded-lg p-4 mb-4">
                    <div class="flex justify-between items-start mb-2">
                        <h6 class="font-semibold text-gray-900">${update.title}</h6>
                        <span class="text-xs text-gray-500">v${update.version_number}</span>
                    </div>
                    <p class="text-sm text-gray-600 mb-3">${update.description}</p>
                    
                    ${update.file_url ? `
                        <div class="mb-3">
                            <a href="${update.file_url}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm">
                                <i data-feather="download" class="w-4 h-4 inline mr-1"></i>
                                View File
                            </a>
                        </div>
                    ` : ''}
                    
                    ${update.link_url ? `
                        <div class="mb-3">
                            <a href="${update.link_url}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm">
                                <i data-feather="external-link" class="w-4 h-4 inline mr-1"></i>
                                View Link
                            </a>
                        </div>
                    ` : ''}
                    
                    ${update.feedback && update.feedback.length > 0 ? `
                        <div class="mt-3 pt-3 border-t border-gray-200">
                            <h6 class="text-sm font-medium text-gray-700 mb-2">Feedback:</h6>
                            ${update.feedback.map(fb => `
                                <div class="bg-gray-50 rounded p-3 mb-2">
                                    <div class="flex justify-between items-start mb-1">
                                        <span class="text-xs font-medium text-gray-600">
                                            ${fb.member ? fb.member.name : 'Member'} - ${fb.feedback_type.replace('_', ' ')}
                                        </span>
                                        <span class="text-xs text-gray-500">
                                            ${new Date(fb.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    ${fb.remarks ? `<p class="text-sm text-gray-700">${fb.remarks}</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="flex justify-between items-center mt-3">
                        <span class="text-xs text-gray-500">
                            ${new Date(update.created_at).toLocaleString()}
                        </span>
                        <div class="flex space-x-2">
                            <span class="px-2 py-1 text-xs rounded-full ${
                                update.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                update.status === 'approved' ? 'bg-green-100 text-green-800' :
                                update.status === 'needs_changes' ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                            }">
                                ${update.status.replace('_', ' ')}
                            </span>
                            ${update.status === 'pending' ? `
                                <button class="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 feedback-progress-update-btn" 
                                        data-update-id="${update.id}">
                                    Review
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Replace feather icons
        if (typeof feather !== "undefined") {
            feather.replace();
        }

    } catch (error) {
        console.error("Error loading progress updates:", error);
        showNotification("Failed to load progress updates", "error");
    }
}

// Load progress updates for a job (for apprentices)
async function loadApprenticeProgressUpdates(jobId) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to view progress updates", "error");
            return;
        }

        // Get progress updates for this apprentice
        const updates = await getProgressUpdates(jobId, "apprentice", user.id);
        
        // Display updates
        const container = document.getElementById(`progress-updates-${jobId}`);
        if (!container) return;

        if (updates.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-gray-500">
                    <i data-feather="clock" class="w-8 h-8 mx-auto mb-2"></i>
                    <p>No progress updates yet</p>
                </div>
            `;
        } else {
            container.innerHTML = updates.map(update => `
                <div class="border border-gray-200 rounded-lg p-4 mb-4">
                    <div class="flex justify-between items-start mb-2">
                        <h6 class="font-semibold text-gray-900">${update.title}</h6>
                        <span class="text-xs text-gray-500">v${update.version_number}</span>
                    </div>
                    <p class="text-sm text-gray-600 mb-3">${update.description}</p>
                    
                    ${update.file_url ? `
                        <div class="mb-3">
                            <a href="${update.file_url}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm">
                                <i data-feather="download" class="w-4 h-4 inline mr-1"></i>
                                View File
                            </a>
                        </div>
                    ` : ''}
                    
                    ${update.link_url ? `
                        <div class="mb-3">
                            <a href="${update.link_url}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm">
                                <i data-feather="external-link" class="w-4 h-4 inline mr-1"></i>
                                View Link
                            </a>
                        </div>
                    ` : ''}
                    
                    ${update.feedback && update.feedback.length > 0 ? `
                        <div class="mt-3 pt-3 border-t border-gray-200">
                            <h6 class="text-sm font-medium text-gray-700 mb-2">Member Feedback:</h6>
                            ${update.feedback.map(fb => `
                                <div class="bg-blue-50 rounded p-3 mb-2">
                                    <div class="flex justify-between items-start mb-1">
                                        <span class="text-xs font-medium text-blue-600">
                                            ${fb.member ? fb.member.name : 'Member'} - ${fb.feedback_type.replace('_', ' ')}
                                        </span>
                                        <span class="text-xs text-gray-500">
                                            ${new Date(fb.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    ${fb.remarks ? `<p class="text-sm text-gray-700 mt-1">${fb.remarks}</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="flex justify-between items-center mt-3">
                        <span class="text-xs text-gray-500">
                            ${new Date(update.created_at).toLocaleString()}
                        </span>
                        <div class="flex space-x-2">
                            <span class="px-2 py-1 text-xs rounded-full ${
                                update.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                update.status === 'approved' ? 'bg-green-100 text-green-800' :
                                update.status === 'needs_changes' ? 'bg-red-100 text-red-800' :
                                'bg-blue-100 text-blue-800'
                            }">
                                ${update.status.replace('_', ' ')}
                            </span>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Replace feather icons
        if (typeof feather !== "undefined") {
            feather.replace();
        }

    } catch (error) {
        console.error("Error loading progress updates:", error);
        showNotification("Failed to load progress updates", "error");
    }
}

// Handle progress update feedback (for members)
async function handleProgressUpdateFeedback(updateId) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to provide feedback", "error");
            return;
        }

        // Store update ID for form submission
        progressFeedbackForm.dataset.updateId = updateId;
        
        // Show modal
        progressFeedbackModal.classList.add("active");
        
        // Reset form
        progressFeedbackForm.reset();

    } catch (error) {
        console.error("Error opening feedback modal:", error);
        showNotification("Failed to open feedback form", "error");
    }
}

// Handle progress feedback form submission
async function handleProgressFeedbackSubmission(e) {
    e.preventDefault();
    
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to submit feedback", "error");
            return;
        }

        const updateId = progressFeedbackForm.dataset.updateId;
        const feedbackType = document.querySelector('input[name="feedback-decision"]:checked').value;
        const remarks = document.getElementById("feedback-remarks").value;

        // Show loading state
        const submitBtn = document.getElementById("submit-progress-feedback");
        const spinner = document.getElementById("progress-feedback-spinner");
        submitBtn.disabled = true;
        spinner.classList.remove("hidden");

        // Submit feedback
        await submitProgressUpdateFeedback(updateId, user.id, {
            feedbackType,
            remarks
        });
        
        showNotification("Feedback submitted successfully!", "success");
        
        // Close modal
        progressFeedbackModal.classList.remove("active");
        
        // Refresh the jobs tab
        const jobsTab = document.querySelector('[data-tab="jobs"]');
        if (jobsTab) {
            jobsTab.click();
        }

    } catch (error) {
        console.error("Error submitting feedback:", error);
        showNotification(error.message || "Failed to submit feedback", "error");
    } finally {
        // Reset loading state
        const submitBtn = document.getElementById("submit-progress-feedback");
        const spinner = document.getElementById("progress-feedback-spinner");
        submitBtn.disabled = false;
        spinner.classList.add("hidden");
    }
}

// Load final submissions for a job (for members)
async function loadFinalSubmissions(jobId) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to view final submissions", "error");
            return;
        }

        // Get final submissions
        const submissions = await getFinalSubmissions(jobId, "member", user.id);
        
        // Display submissions
        const container = document.getElementById(`final-submissions-${jobId}`);
        if (!container) return;

        if (submissions.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-gray-500">
                    <i data-feather="clock" class="w-8 h-8 mx-auto mb-2"></i>
                    <p>No final submissions yet</p>
                </div>
            `;
        } else {
            container.innerHTML = submissions.map(submission => `
                <div class="border border-gray-200 rounded-lg p-4 mb-4">
                    <div class="flex justify-between items-start mb-2">
                        <h6 class="font-semibold text-gray-900">${submission.title}</h6>
                        <span class="px-2 py-1 text-xs rounded-full ${
                            submission.status === 'pending_review' ? 'bg-yellow-100 text-yellow-800' :
                            submission.status === 'approved' ? 'bg-green-100 text-green-800' :
                            submission.status === 'needs_revision' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                        }">
                            ${submission.status.replace('_', ' ')}
                        </span>
                    </div>
                    <p class="text-sm text-gray-600 mb-3">${submission.description}</p>
                    
                    ${submission.file_urls && submission.file_urls.length > 0 ? `
                        <div class="mb-3">
                            <h6 class="text-sm font-medium text-gray-700 mb-2">Files:</h6>
                            ${submission.file_urls.map(fileUrl => `
                                <a href="${fileUrl}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm block mb-1">
                                    <i data-feather="download" class="w-4 h-4 inline mr-1"></i>
                                    ${fileUrl.split('/').pop()}
                                </a>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${submission.links && submission.links.length > 0 ? `
                        <div class="mb-3">
                            <h6 class="text-sm font-medium text-gray-700 mb-2">Links:</h6>
                            ${submission.links.map(link => `
                                <a href="${link}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm block mb-1">
                                    <i data-feather="external-link" class="w-4 h-4 inline mr-1"></i>
                                    ${link}
                                </a>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="flex justify-between items-center mt-3">
                        <span class="text-xs text-gray-500">
                            Submitted: ${new Date(submission.created_at).toLocaleString()}
                        </span>
                        <div class="flex space-x-2">
                            ${submission.status === 'pending_review' ? `
                                <button class="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 review-final-submission-btn" 
                                        data-submission-id="${submission.id}">
                                    Review
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        }

        // Replace feather icons
        if (typeof feather !== "undefined") {
            feather.replace();
        }

    } catch (error) {
        console.error("Error loading final submissions:", error);
        showNotification("Failed to load final submissions", "error");
    }
}

// Handle final submission review (for members)
async function handleFinalSubmissionReview(submissionId) {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to review submissions", "error");
            return;
        }

        // Store submission ID for form submission
        finalSubmissionReviewForm.dataset.submissionId = submissionId;
        
        // Show the modal
        finalSubmissionReviewModal.classList.add("active");
        
    } catch (error) {
        console.error("Error opening final submission review:", error);
        showNotification("Failed to open review form", "error");
    }
}

// Handle final submission review form submission
async function handleFinalSubmissionReviewSubmission(e) {
    e.preventDefault();
    
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            showNotification("Please log in to submit review", "error");
            return;
        }

        const submissionId = finalSubmissionReviewForm.dataset.submissionId;
        const reviewDecision = document.querySelector('input[name="final-review-decision"]:checked').value;
        const reviewNotes = document.getElementById("final-review-notes").value;

        // Show loading state
        const submitBtn = document.getElementById("submit-final-review");
        const spinner = document.getElementById("final-review-spinner");
        submitBtn.disabled = true;
        spinner.classList.remove("hidden");

        // Submit review
        await submitFinalSubmissionFeedback(submissionId, user.id, {
            feedbackType: reviewDecision,
            remarks: reviewNotes
        });
        
        showNotification("Review submitted successfully!", "success");
        
        // Close modal
        finalSubmissionReviewModal.classList.remove("active");
        
        // Refresh the jobs tab
        const jobsTab = document.querySelector('[data-tab="jobs"]');
        if (jobsTab) {
            jobsTab.click();
        }

    } catch (error) {
        console.error("Error submitting review:", error);
        showNotification(error.message || "Failed to submit review", "error");
    } finally {
        // Reset loading state
        const submitBtn = document.getElementById("submit-final-review");
        const spinner = document.getElementById("final-review-spinner");
        submitBtn.disabled = false;
        spinner.classList.add("hidden");
    }
}

// Auto-acknowledge progress updates (runs periodically)
async function checkAndAutoAcknowledgeUpdates() {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Call the auto-acknowledge function
        await autoAcknowledgeProgressUpdates();
        
        console.log("Auto-acknowledgment check completed");
    } catch (error) {
        console.error("Error in auto-acknowledgment check:", error);
    }
}

// Set up periodic auto-acknowledgment (every 24 hours)
function setupAutoAcknowledgment() {
    // Run immediately on load
    checkAndAutoAcknowledgeUpdates();

    // Then run every 24 hours
    setInterval(checkAndAutoAcknowledgeUpdates, 24 * 60 * 60 * 1000);
}

// ==============================================
// REFERRAL WALLET EVENT HANDLERS
// ==============================================

// Handle payout method selection
function setupWithdrawalHandlers() {
    const payoutMethodSelect = document.getElementById('payout-method');
    const bankDetails = document.getElementById('bank-details');
    const mobileMoneyDetails = document.getElementById('mobile-money-details');
    const requestWithdrawalBtn = document.getElementById('request-withdrawal');

    if (payoutMethodSelect) {
        payoutMethodSelect.addEventListener('change', (e) => {
            const method = e.target.value;
            
            // Hide all detail sections
            if (bankDetails) bankDetails.classList.add('hidden');
            if (mobileMoneyDetails) mobileMoneyDetails.classList.add('hidden');
            
            // Show relevant section
            if (method === 'bank_transfer' && bankDetails) {
                bankDetails.classList.remove('hidden');
            } else if (method === 'mobile_money' && mobileMoneyDetails) {
                mobileMoneyDetails.classList.remove('hidden');
            }
        });
    }

    if (requestWithdrawalBtn) {
        requestWithdrawalBtn.addEventListener('click', handleWithdrawalRequest);
    }
}

// Handle withdrawal request
async function handleWithdrawalRequest() {
    try {
        const pointsInput = document.getElementById('withdrawal-points');
        const payoutMethodSelect = document.getElementById('payout-method');
        const bankNameInput = document.getElementById('bank-name');
        const accountNumberInput = document.getElementById('account-number');
        const accountNameInput = document.getElementById('account-name');
        const mobileProviderSelect = document.getElementById('mobile-provider');
        const mobileNumberInput = document.getElementById('mobile-number');

        // Validate inputs
        const points = parseFloat(pointsInput.value);
        const payoutMethod = payoutMethodSelect.value;

        if (!points || points < 20) {
            showNotification('Minimum withdrawal is 20 points', 'error');
            return;
        }

        if (!payoutMethod) {
            showNotification('Please select a payout method', 'error');
            return;
        }

        // Validate payout details
        let payoutDetails = {};
        if (payoutMethod === 'bank_transfer') {
            if (!bankNameInput.value || !accountNumberInput.value || !accountNameInput.value) {
                showNotification('Please fill in all bank details', 'error');
                return;
            }
            payoutDetails = {
                bank_name: bankNameInput.value,
                account_number: accountNumberInput.value,
                account_name: accountNameInput.value
            };
        } else if (payoutMethod === 'mobile_money') {
            if (!mobileProviderSelect.value || !mobileNumberInput.value) {
                showNotification('Please fill in all mobile money details', 'error');
                return;
            }
            payoutDetails = {
                provider: mobileProviderSelect.value,
                phone_number: mobileNumberInput.value
            };
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showNotification('Please log in to request withdrawal', 'error');
            return;
        }

        // Show loading state
        const btn = document.getElementById('request-withdrawal');
        const originalText = btn.textContent;
        btn.textContent = 'Processing...';
        btn.disabled = true;

        // Create withdrawal request
        const requestId = await createWithdrawalRequest(
            user.id,
            points,
            payoutMethod,
            payoutDetails
        );

        // Calculate amounts for display
        const currency = convertPointsToCurrency(points);
        
        showNotification(
            `Withdrawal request submitted! ${points} pts (₦${currency.ngn.toFixed(0)}) will be processed monthly.`,
            'success'
        );

        // Clear form
        pointsInput.value = '';
        payoutMethodSelect.value = '';
        if (bankNameInput) bankNameInput.value = '';
        if (accountNumberInput) accountNumberInput.value = '';
        if (accountNameInput) accountNameInput.value = '';
        if (mobileProviderSelect) mobileProviderSelect.value = '';
        if (mobileNumberInput) mobileNumberInput.value = '';
        
        // Hide detail sections
        const bankDetails = document.getElementById('bank-details');
        const mobileMoneyDetails = document.getElementById('mobile-money-details');
        if (bankDetails) bankDetails.classList.add('hidden');
        if (mobileMoneyDetails) mobileMoneyDetails.classList.add('hidden');

        // Reload the earnings section to show updated data
        if (currentUserData) {
            loadSection('earnings');
        }

    } catch (error) {
        console.error('Error creating withdrawal request:', error);
        showNotification(error.message || 'Failed to create withdrawal request', 'error');
    } finally {
        // Reset button state
        const btn = document.getElementById('request-withdrawal');
        if (btn) {
            btn.textContent = 'Request Withdrawal';
            btn.disabled = false;
        }
    }
}

// ==============================================
// PROFILE SETUP FUNCTIONS
// ==============================================

// Show profile setup modal based on user role
function showProfileSetupModal(userData) {
    console.log("Showing profile setup modal for role:", userData?.role);
    
    // Always hide loading screen first - use multiple methods to ensure it's hidden
    if (loadingScreen) {
        loadingScreen.classList.add("hidden");
        loadingScreen.style.display = "none";
        loadingScreen.style.visibility = "hidden";
        loadingScreen.style.opacity = "0";
        loadingScreen.style.zIndex = "-1";
    }
    
    const modalId = userData?.role === "apprentice" 
        ? "profile-setup-modal-apprentice" 
        : "profile-setup-modal-member";
    
    console.log("Looking for modal with ID:", modalId);
    const modal = document.getElementById(modalId);
    
    if (!modal) {
        console.error("Profile setup modal not found:", modalId);
        // Fallback: show dashboard with error message
        if (dashboardLayout) {
            dashboardLayout.classList.remove("hidden");
        }
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-red-500 mb-4">Profile setup modal not found. Please refresh the page.</p>
                    <button onclick="location.reload()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                        Refresh
                    </button>
                </div>
            `;
        }
        return;
    }
    
    console.log("Modal found, showing it");
    console.log("Modal parent:", modal.parentElement);
    console.log("Modal offsetParent:", modal.offsetParent);
    
    // Hide dashboard layout and show modal
    if (dashboardLayout) {
        dashboardLayout.classList.add("hidden");
        dashboardLayout.style.display = "none";
    }
    
    // Ensure body doesn't have overflow hidden
    document.body.style.overflow = "hidden";
    
    // Force show modal with all necessary styles
    modal.classList.add("active");
    modal.style.display = "flex";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
    modal.style.zIndex = "99999"; // Very high z-index
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.right = "0";
    modal.style.bottom = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.margin = "0";
    modal.style.padding = "0";
    
    // Remove any hidden class that might be interfering
    modal.classList.remove("hidden");
    
    console.log("Modal classes after setup:", modal.className);
    console.log("Modal display style:", modal.style.display);
    console.log("Modal z-index:", modal.style.zIndex);
    console.log("Modal computed display:", window.getComputedStyle(modal).display);
    console.log("Modal computed visibility:", window.getComputedStyle(modal).visibility);
    console.log("Modal computed z-index:", window.getComputedStyle(modal).zIndex);
    
    // Verify modal is visible immediately and after a delay
    const checkVisibility = () => {
        const computed = window.getComputedStyle(modal);
        const isVisible = computed.display !== "none" && 
                         computed.visibility !== "hidden" && 
                         computed.opacity !== "0";
        console.log("Modal visibility check:", {
            display: computed.display,
            visibility: computed.visibility,
            opacity: computed.opacity,
            zIndex: computed.zIndex,
            isVisible: isVisible
        });
        
        if (!isVisible) {
            console.error("Modal is not visible! Forcing display with !important...");
            modal.setAttribute("style", 
                "display: flex !important; " +
                "visibility: visible !important; " +
                "opacity: 1 !important; " +
                "z-index: 99999 !important; " +
                "position: fixed !important; " +
                "top: 0 !important; " +
                "left: 0 !important; " +
                "right: 0 !important; " +
                "bottom: 0 !important; " +
                "width: 100% !important; " +
                "height: 100% !important;"
            );
        }
    };
    
    // Check immediately
    checkVisibility();
    
    // Check after a short delay
    setTimeout(checkVisibility, 50);
    setTimeout(checkVisibility, 100);
    setTimeout(checkVisibility, 200);
    
    // Pre-fill existing data
    try {
        if (userData?.role === "apprentice") {
            if (typeof prefillApprenticeForm === "function") {
                prefillApprenticeForm(userData);
            }
            if (typeof setupApprenticeFormHandlers === "function") {
                setupApprenticeFormHandlers();
            }
        } else {
            if (typeof prefillMemberForm === "function") {
                prefillMemberForm(userData);
            }
            if (typeof setupMemberFormHandlers === "function") {
                setupMemberFormHandlers();
            }
        }
        console.log("Profile form setup completed");
    } catch (error) {
        console.error("Error setting up profile form:", error);
        // Show error in modal if possible
        const errorDiv = document.getElementById(userData?.role === "apprentice" 
            ? "apprentice-profile-error" 
            : "member-profile-error");
        if (errorDiv) {
            errorDiv.textContent = "Error loading form. Please refresh the page.";
            errorDiv.classList.remove("hidden");
        }
    }
}

// Pre-fill apprentice form with existing data
function prefillApprenticeForm(userData) {
    if (userData.name) document.getElementById("apprentice-name").value = userData.name;
    if (userData.username) document.getElementById("apprentice-username").value = userData.username;
    if (userData.email) document.getElementById("apprentice-email").value = userData.email;
    if (userData.phone) document.getElementById("apprentice-phone").value = userData.phone;
    if (userData.bio) document.getElementById("apprentice-bio").value = userData.bio;
    if (userData.skill_category) document.getElementById("apprentice-skill-category").value = userData.skill_category;
    if (userData.years_of_experience) document.getElementById("apprentice-experience").value = userData.years_of_experience;
    if (userData.education) document.getElementById("apprentice-education").value = userData.education;
    if (userData.certifications) document.getElementById("apprentice-certifications").value = userData.certifications;
    if (userData.preferred_job_type) document.getElementById("apprentice-job-type").value = userData.preferred_job_type;
    if (userData.availability) document.getElementById("apprentice-availability").value = userData.availability;
    if (userData.avatar_url) {
        document.getElementById("apprentice-avatar-preview").src = userData.avatar_url;
    }
    
    // Load sub-skills
    if (userData.sub_skills && userData.sub_skills.length > 0) {
        loadSubSkills(userData.skill_category || "", userData.sub_skills);
    } else if (userData.skill_category) {
        loadSubSkills(userData.skill_category, []);
    }
    
    // Load portfolio links
    if (userData.portfolio_links && userData.portfolio_links.length > 0) {
        const container = document.getElementById("apprentice-portfolio-links");
        container.innerHTML = "";
        userData.portfolio_links.forEach(link => {
            addPortfolioLinkInput(link);
        });
    }
}

// Pre-fill member form with existing data
function prefillMemberForm(userData) {
    if (userData.business_name || userData.name) {
        document.getElementById("member-business-name").value = userData.business_name || userData.name;
    }
    if (userData.email) document.getElementById("member-email").value = userData.email;
    if (userData.phone) document.getElementById("member-phone").value = userData.phone;
    if (userData.business_description || userData.description) {
        document.getElementById("member-description").value = userData.business_description || userData.description;
    }
    if (userData.industry || userData.creative_type) {
        document.getElementById("member-industry").value = userData.industry || userData.creative_type;
    }
    if (userData.business_location || userData.location) {
        document.getElementById("member-location").value = userData.business_location || userData.location;
    }
    if (userData.logo_url) {
        document.getElementById("member-logo-preview").src = userData.logo_url;
    }
    if (userData.budget_min) document.getElementById("member-budget-min").value = userData.budget_min;
    if (userData.budget_max) document.getElementById("member-budget-max").value = userData.budget_max;
    
    // Load services, project categories, and website links
    if (userData.services_offered && userData.services_offered.length > 0) {
        loadServices(userData.industry || userData.creative_type || "", userData.services_offered);
    } else if (userData.industry || userData.creative_type) {
        loadServices(userData.industry || userData.creative_type, []);
    }
    
    if (userData.project_categories && userData.project_categories.length > 0) {
        loadProjectCategories(userData.project_categories);
    }
    
    if (userData.website_social_links && userData.website_social_links.length > 0) {
        const container = document.getElementById("member-website-links");
        container.innerHTML = "";
        userData.website_social_links.forEach(link => {
            addWebsiteLinkInput(link);
        });
    }
}

// Setup apprentice form handlers
function setupApprenticeFormHandlers() {
    const form = document.getElementById("profile-setup-form-apprentice");
    const avatarInput = document.getElementById("apprentice-avatar-input");
    const skillCategorySelect = document.getElementById("apprentice-skill-category");
    const addPortfolioLinkBtn = document.getElementById("add-portfolio-link");
    const resumeInput = document.getElementById("apprentice-resume");
    const certificationsFileInput = document.getElementById("apprentice-certifications-file");
    
    console.log("Setting up apprentice form handlers:", {
        formExists: !!form,
        avatarInputExists: !!avatarInput,
        skillCategorySelectExists: !!skillCategorySelect,
        addPortfolioLinkBtnExists: !!addPortfolioLinkBtn,
        resumeInputExists: !!resumeInput,
        certificationsFileInputExists: !!certificationsFileInput,
    });
    
    // Avatar preview
    if (avatarInput) {
        avatarInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById("apprentice-avatar-preview").src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Skill category change - load sub-skills
    if (skillCategorySelect) {
        skillCategorySelect.addEventListener("change", (e) => {
            loadSubSkills(e.target.value, []);
        });
    }
    
    // Add portfolio link
    if (addPortfolioLinkBtn) {
        addPortfolioLinkBtn.addEventListener("click", () => {
            addPortfolioLinkInput();
        });
    }
    
    // Form submission
    if (form) {
        form.addEventListener("submit", async (e) => {
            console.log("Apprentice profile form submitted (submit event)");
            e.preventDefault();
            await handleApprenticeProfileSubmit();
        });
    }
}

// Setup member form handlers
function setupMemberFormHandlers() {
    const form = document.getElementById("profile-setup-form-member");
    const logoInput = document.getElementById("member-logo-input");
    const industrySelect = document.getElementById("member-industry");
    const addWebsiteLinkBtn = document.getElementById("add-website-link");
    
    // Logo preview
    if (logoInput) {
        logoInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById("member-logo-preview").src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    // Industry change - load services
    if (industrySelect) {
        industrySelect.addEventListener("change", (e) => {
            loadServices(e.target.value, []);
        });
    }
    
    // Add website link
    if (addWebsiteLinkBtn) {
        addWebsiteLinkBtn.addEventListener("click", () => {
            addWebsiteLinkInput();
        });
    }
    
    // Form submission
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            await handleMemberProfileSubmit();
        });
    }
}

// Handle apprentice profile submission
async function handleApprenticeProfileSubmit() {
    console.log("handleApprenticeProfileSubmit() called");
    const spinner = document.getElementById("apprentice-profile-spinner");
    const errorDiv = document.getElementById("apprentice-profile-error");
    const submitBtn = document.getElementById("submit-apprentice-profile");
    
    try {
        spinner.classList.remove("hidden");
        submitBtn.disabled = true;
        errorDiv.classList.add("hidden");
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");
        
        // Collect form data
        const profileData = {
            name: document.getElementById("apprentice-name").value.trim(),
            username: document.getElementById("apprentice-username").value.trim(),
            email: document.getElementById("apprentice-email").value.trim(),
            phone: document.getElementById("apprentice-phone").value.trim(),
            bio: document.getElementById("apprentice-bio").value.trim(),
            skill_category: document.getElementById("apprentice-skill-category").value,
            years_of_experience: parseInt(document.getElementById("apprentice-experience").value) || 0,
            education: document.getElementById("apprentice-education").value.trim(),
            certifications: document.getElementById("apprentice-certifications").value.trim(),
            preferred_job_type: document.getElementById("apprentice-job-type").value,
            availability: document.getElementById("apprentice-availability").value,
        };
        
        // Get sub-skills
        const subSkillsSelected = document.getElementById("apprentice-sub-skills-selected").value;
        profileData.sub_skills = subSkillsSelected ? subSkillsSelected.split(",").filter(s => s.trim()) : [];
        
        // Get portfolio links
        const portfolioInputs = document.querySelectorAll("#apprentice-portfolio-links input[type='url']");
        profileData.portfolio_links = Array.from(portfolioInputs)
            .map(input => input.value.trim())
            .filter(link => link);
        
        // Upload avatar if provided
        const avatarFile = document.getElementById("apprentice-avatar-input").files[0];
        if (avatarFile) {
            profileData.avatar_url = await uploadAvatar(user.id, avatarFile);
        }
        
        // Upload resume if provided
        const resumeFile = document.getElementById("apprentice-resume").files[0];
        if (resumeFile) {
            profileData.resume_url = await uploadCV(resumeFile);
        }
        
        // Upload certifications file if provided
        const certFile = document.getElementById("apprentice-certifications-file").files[0];
        if (certFile) {
            profileData.certifications_url = await uploadCertification(user.id, certFile);
        }
        
        // Save profile
        await saveApprenticeProfile(user.id, profileData);
        
        // Close modal and reload dashboard
        document.getElementById("profile-setup-modal-apprentice").classList.remove("active");
        location.reload();
        
    } catch (error) {
        console.error("Error saving apprentice profile:", error);
        errorDiv.textContent = error.message || "Failed to save profile. Please try again.";
        errorDiv.classList.remove("hidden");
    } finally {
        spinner.classList.add("hidden");
        submitBtn.disabled = false;
    }
}

// Expose apprentice profile submit handler globally so HTML onclick can call it
if (typeof window !== "undefined") {
    window.handleApprenticeProfileSubmit = handleApprenticeProfileSubmit;
}

// Handle member profile submission
async function handleMemberProfileSubmit() {
    const spinner = document.getElementById("member-profile-spinner");
    const errorDiv = document.getElementById("member-profile-error");
    const submitBtn = document.getElementById("submit-member-profile");
    
    try {
        spinner.classList.remove("hidden");
        submitBtn.disabled = true;
        errorDiv.classList.add("hidden");
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");
        
        // Collect form data
        const profileData = {
            business_name: document.getElementById("member-business-name").value.trim(),
            email: document.getElementById("member-email").value.trim(),
            phone: document.getElementById("member-phone").value.trim(),
            business_description: document.getElementById("member-description").value.trim(),
            industry: document.getElementById("member-industry").value,
            business_location: document.getElementById("member-location").value.trim(),
        };
        
        // Get services
        const servicesSelected = document.getElementById("member-services-selected").value;
        profileData.services_offered = servicesSelected ? servicesSelected.split(",").filter(s => s.trim()) : [];
        
        // Get project categories
        const categoriesSelected = document.getElementById("member-project-categories-selected").value;
        profileData.project_categories = categoriesSelected ? categoriesSelected.split(",").filter(s => s.trim()) : [];
        
        // Get website links
        const websiteInputs = document.querySelectorAll("#member-website-links input[type='url']");
        profileData.website_social_links = Array.from(websiteInputs)
            .map(input => input.value.trim())
            .filter(link => link);
        
        // Budget range
        const budgetMin = document.getElementById("member-budget-min").value;
        const budgetMax = document.getElementById("member-budget-max").value;
        if (budgetMin) profileData.budget_min = budgetMin;
        if (budgetMax) profileData.budget_max = budgetMax;
        
        // Upload logo if provided
        const logoFile = document.getElementById("member-logo-input").files[0];
        if (logoFile) {
            profileData.logo_url = await uploadLogo(user.id, logoFile);
        }
        
        // Save profile
        await saveMemberProfile(user.id, profileData);
        
        // Close modal and reload dashboard
        document.getElementById("profile-setup-modal-member").classList.remove("active");
        location.reload();
        
    } catch (error) {
        console.error("Error saving member profile:", error);
        errorDiv.textContent = error.message || "Failed to save profile. Please try again.";
        errorDiv.classList.remove("hidden");
    } finally {
        spinner.classList.add("hidden");
        submitBtn.disabled = false;
    }
}

// Helper functions for dynamic form elements
function loadSubSkills(category, selected = []) {
    const container = document.getElementById("apprentice-sub-skills");
    const hiddenInput = document.getElementById("apprentice-sub-skills-selected");
    
    const subSkillsMap = {
        "Photography": ["Portrait", "Wedding", "Event", "Product", "Fashion", "Real Estate", "Food", "Nature"],
        "Design": ["Graphic Design", "UI/UX", "Web Design", "Logo Design", "Branding", "Print Design", "Illustration"],
        "Artisan": ["Carpentry", "Metalwork", "Pottery", "Textiles", "Jewelry", "Leatherwork", "Glasswork"],
        "Programming": ["Web Development", "Mobile Development", "Backend", "Frontend", "Full Stack", "DevOps"],
        "Writing": ["Content Writing", "Copywriting", "Technical Writing", "Creative Writing", "Editing"],
        "Video Production": ["Editing", "Cinematography", "Animation", "Motion Graphics", "Color Grading"],
        "Music": ["Production", "Mixing", "Mastering", "Composition", "Sound Design"],
        "Other": []
    };
    
    const subSkills = subSkillsMap[category] || [];
    container.innerHTML = "";
    
    subSkills.forEach(skill => {
        const isSelected = selected.includes(skill);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `px-3 py-1 rounded-full text-sm ${isSelected ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`;
        button.textContent = skill;
        button.addEventListener("click", () => {
            button.classList.toggle("bg-blue-600");
            button.classList.toggle("text-white");
            button.classList.toggle("bg-gray-200");
            button.classList.toggle("text-gray-700");
            updateSubSkillsSelected();
        });
        container.appendChild(button);
    });
    
    function updateSubSkillsSelected() {
        const selected = Array.from(container.querySelectorAll(".bg-blue-600"))
            .map(btn => btn.textContent);
        hiddenInput.value = selected.join(",");
    }
    
    if (selected.length > 0) {
        updateSubSkillsSelected();
    }
}

function loadServices(industry, selected = []) {
    const container = document.getElementById("member-services");
    const hiddenInput = document.getElementById("member-services-selected");
    
    const servicesMap = {
        "Photography": ["Event Photography", "Portrait Sessions", "Product Photography", "Real Estate Photography"],
        "Design": ["Logo Design", "Branding", "Web Design", "Print Design", "UI/UX Design"],
        "Artisan": ["Custom Furniture", "Handmade Products", "Art Commissions", "Restoration"],
        "Technology": ["Web Development", "App Development", "Software Consulting", "IT Support"],
        "Media & Entertainment": ["Video Production", "Content Creation", "Event Management", "Marketing"],
        "Fashion": ["Custom Clothing", "Tailoring", "Fashion Consulting", "Styling"],
        "Food & Beverage": ["Catering", "Event Planning", "Culinary Services"],
        "Other": []
    };
    
    const services = servicesMap[industry] || [];
    container.innerHTML = "";
    
    services.forEach(service => {
        const isSelected = selected.includes(service);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `px-3 py-1 rounded-full text-sm ${isSelected ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`;
        button.textContent = service;
        button.addEventListener("click", () => {
            button.classList.toggle("bg-blue-600");
            button.classList.toggle("text-white");
            button.classList.toggle("bg-gray-200");
            button.classList.toggle("text-gray-700");
            updateServicesSelected();
        });
        container.appendChild(button);
    });
    
    function updateServicesSelected() {
        const selected = Array.from(container.querySelectorAll(".bg-blue-600"))
            .map(btn => btn.textContent);
        hiddenInput.value = selected.join(",");
    }
    
    if (selected.length > 0) {
        updateServicesSelected();
    }
}

function loadProjectCategories(selected = []) {
    const container = document.getElementById("member-project-categories");
    const hiddenInput = document.getElementById("member-project-categories-selected");
    
    const categories = ["Photography", "Design", "Development", "Writing", "Video", "Music", "Art", "Other"];
    container.innerHTML = "";
    
    categories.forEach(category => {
        const isSelected = selected.includes(category);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `px-3 py-1 rounded-full text-sm ${isSelected ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`;
        button.textContent = category;
        button.addEventListener("click", () => {
            button.classList.toggle("bg-blue-600");
            button.classList.toggle("text-white");
            button.classList.toggle("bg-gray-200");
            button.classList.toggle("text-gray-700");
            updateCategoriesSelected();
        });
        container.appendChild(button);
    });
    
    function updateCategoriesSelected() {
        const selected = Array.from(container.querySelectorAll(".bg-blue-600"))
            .map(btn => btn.textContent);
        hiddenInput.value = selected.join(",");
    }
    
    if (selected.length > 0) {
        updateCategoriesSelected();
    }
}

function addPortfolioLinkInput(value = "") {
    const container = document.getElementById("apprentice-portfolio-links");
    const div = document.createElement("div");
    div.className = "flex gap-2 mb-2";
    div.innerHTML = `
        <input type="url" placeholder="https://example.com/portfolio" value="${value}" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500">
        <button type="button" class="remove-portfolio-link text-red-600 hover:text-red-800 px-3">Remove</button>
    `;
    div.querySelector(".remove-portfolio-link").addEventListener("click", () => div.remove());
    container.appendChild(div);
}

function addWebsiteLinkInput(value = "") {
    const container = document.getElementById("member-website-links");
    const div = document.createElement("div");
    div.className = "flex gap-2 mb-2";
    div.innerHTML = `
        <input type="url" placeholder="https://example.com" value="${value}" class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500">
        <button type="button" class="remove-website-link text-red-600 hover:text-red-800 px-3">Remove</button>
    `;
    div.querySelector(".remove-website-link").addEventListener("click", () => div.remove());
    container.appendChild(div);
}

// ==============================================
// PROFILE DISPLAY COMPONENTS
// ==============================================

// Render Apprentice Profile Page (full profile view)
function renderApprenticeProfilePage(profile) {
    const joinedDate = profile.created_at 
        ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
        : 'Recently';
    
    return `
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
            <!-- Header Section -->
            <div class="bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-white">
                <div class="flex flex-col md:flex-row items-center md:items-start gap-6">
                    <img 
                        src="${profile.avatar_url || `https://placehold.co/150x150/EBF4FF/3B82F6?text=${(profile.name || 'U').charAt(0).toUpperCase()}`}" 
                        alt="${profile.name || 'User'}" 
                        class="w-32 h-32 rounded-full border-4 border-white object-cover shadow-lg"
                    >
                    <div class="flex-1 text-center md:text-left">
                        <h1 class="text-3xl font-bold mb-2">${profile.name || 'No Name'}</h1>
                        <p class="text-xl text-blue-100 mb-2">@${profile.username || 'username'}</p>
                        <p class="text-blue-200 mb-4">${profile.skill_category || profile.skill || 'Creative Professional'}</p>
                        <div class="flex flex-wrap gap-4 text-sm">
                            <span><i class="fas fa-map-marker-alt mr-1"></i> ${profile.location || 'Location not specified'}</span>
                            <span><i class="fas fa-briefcase mr-1"></i> ${profile.years_of_experience || 0} years experience</span>
                            <span><i class="fas fa-calendar mr-1"></i> Joined ${joinedDate}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Content Section -->
            <div class="p-8">
                <!-- Bio -->
                <div class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">About</h2>
                    <p class="text-gray-700 leading-relaxed">${profile.bio || 'No bio available.'}</p>
                </div>

                <!-- Skills -->
                <div class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Skills</h2>
                    <div class="flex flex-wrap gap-2">
                        ${(profile.sub_skills || []).map(skill => `
                            <span class="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">${skill}</span>
                        `).join('')}
                        ${(!profile.sub_skills || profile.sub_skills.length === 0) ? '<p class="text-gray-500">No skills specified</p>' : ''}
                    </div>
                </div>

                <!-- Experience & Availability -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div class="bg-gray-50 p-6 rounded-lg">
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">Experience</h3>
                        <p class="text-gray-700">${profile.years_of_experience || 0} years</p>
                        <p class="text-sm text-gray-600 mt-2">Preferred: ${profile.preferred_job_type || 'Not specified'}</p>
                    </div>
                    <div class="bg-gray-50 p-6 rounded-lg">
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">Availability</h3>
                        <p class="text-gray-700">${profile.availability || 'Not specified'}</p>
                    </div>
                </div>

                <!-- Education -->
                ${profile.education ? `
                    <div class="mb-8">
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Education & Training</h2>
                        <p class="text-gray-700 whitespace-pre-line">${profile.education}</p>
                    </div>
                ` : ''}

                <!-- Certifications -->
                ${profile.certifications ? `
                    <div class="mb-8">
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Certifications</h2>
                        <p class="text-gray-700 whitespace-pre-line">${profile.certifications}</p>
                        ${profile.certifications_url ? `
                            <a href="${profile.certifications_url}" target="_blank" class="text-blue-600 hover:text-blue-800 mt-2 inline-block">
                                <i class="fas fa-file-pdf mr-1"></i> View Certification Document
                            </a>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- Portfolio Links -->
                ${profile.portfolio_links && profile.portfolio_links.length > 0 ? `
                    <div class="mb-8">
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Portfolio</h2>
                        <div class="space-y-2">
                            ${profile.portfolio_links.map(link => `
                                <a href="${link}" target="_blank" class="text-blue-600 hover:text-blue-800 block">
                                    <i class="fas fa-external-link-alt mr-2"></i> ${link}
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Contact -->
                <div class="border-t border-gray-200 pt-6">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Contact</h2>
                    <div class="space-y-2 text-gray-700">
                        <p><i class="fas fa-envelope mr-2"></i> ${profile.email || 'Not provided'}</p>
                        ${profile.phone ? `<p><i class="fas fa-phone mr-2"></i> ${profile.phone}</p>` : ''}
                    </div>
                </div>

                <!-- Resume -->
                ${profile.resume_url ? `
                    <div class="mt-6">
                        <a href="${profile.resume_url}" target="_blank" class="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <i class="fas fa-file-pdf mr-2"></i> Download Resume
                        </a>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Render Apprentice CV View (for job applications)
function renderApprenticeCV(profile) {
    return `
        <div class="bg-white rounded-lg shadow p-8 max-w-4xl mx-auto">
            <!-- CV Header -->
            <div class="border-b-2 border-gray-300 pb-6 mb-6">
                <div class="flex items-center gap-6">
                    <img 
                        src="${profile.avatar_url || `https://placehold.co/100x100/EBF4FF/3B82F6?text=${(profile.name || 'U').charAt(0).toUpperCase()}`}" 
                        alt="${profile.name}" 
                        class="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
                    >
                    <div>
                        <h1 class="text-3xl font-bold text-gray-900">${profile.name || 'No Name'}</h1>
                        <p class="text-xl text-gray-600">${profile.skill_category || profile.skill || 'Creative Professional'}</p>
                        <p class="text-gray-500 mt-1">${profile.username ? '@' + profile.username : ''}</p>
                    </div>
                </div>
            </div>

            <!-- Contact Information -->
            <div class="mb-6">
                <h2 class="text-xl font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">Contact Information</h2>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <p><strong>Email:</strong> ${profile.email || 'Not provided'}</p>
                    <p><strong>Phone:</strong> ${profile.phone || 'Not provided'}</p>
                    <p><strong>Location:</strong> ${profile.location || 'Not specified'}</p>
                    <p><strong>Availability:</strong> ${profile.availability || 'Not specified'}</p>
                </div>
            </div>

            <!-- Professional Summary -->
            ${profile.bio ? `
                <div class="mb-6">
                    <h2 class="text-xl font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">Professional Summary</h2>
                    <p class="text-gray-700 leading-relaxed">${profile.bio}</p>
                </div>
            ` : ''}

            <!-- Skills -->
            <div class="mb-6">
                <h2 class="text-xl font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">Skills</h2>
                <div class="flex flex-wrap gap-2">
                    ${(profile.sub_skills || []).map(skill => `
                        <span class="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm">${skill}</span>
                    `).join('')}
                </div>
                <p class="text-sm text-gray-600 mt-2"><strong>Experience:</strong> ${profile.years_of_experience || 0} years</p>
                <p class="text-sm text-gray-600"><strong>Preferred Job Type:</strong> ${profile.preferred_job_type || 'Not specified'}</p>
            </div>

            <!-- Education -->
            ${profile.education ? `
                <div class="mb-6">
                    <h2 class="text-xl font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">Education & Training</h2>
                    <p class="text-gray-700 whitespace-pre-line">${profile.education}</p>
                </div>
            ` : ''}

            <!-- Certifications -->
            ${profile.certifications ? `
                <div class="mb-6">
                    <h2 class="text-xl font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">Certifications</h2>
                    <p class="text-gray-700 whitespace-pre-line">${profile.certifications}</p>
                </div>
            ` : ''}

            <!-- Portfolio -->
            ${profile.portfolio_links && profile.portfolio_links.length > 0 ? `
                <div class="mb-6">
                    <h2 class="text-xl font-bold text-gray-900 mb-3 border-b border-gray-200 pb-2">Portfolio</h2>
                    <ul class="list-disc list-inside space-y-1">
                        ${profile.portfolio_links.map(link => `
                            <li><a href="${link}" target="_blank" class="text-blue-600 hover:text-blue-800">${link}</a></li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;
}

// Render Apprentice Job ID Card (compact card view)
function renderApprenticeJobIDCard(profile, stats = {}) {
    const completedJobs = stats.completed_jobs || 0;
    const rating = typeof stats.average_rating === "number" ? stats.average_rating : 0;
    const roundedRating = Math.round(rating);
    const ratingStars =
        "★".repeat(roundedRating) + "☆".repeat(5 - roundedRating);
    const hasRating = rating > 0;
    
    return `
        <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-200">
            <div class="flex items-start gap-4">
                <img 
                    src="${profile.avatar_url || `https://placehold.co/80x80/EBF4FF/3B82F6?text=${(profile.name || 'U').charAt(0).toUpperCase()}`}" 
                    alt="${profile.name}" 
                    class="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                >
                <div class="flex-1">
                    <h3 class="text-lg font-bold text-gray-900 mb-1">${profile.name || 'No Name'}</h3>
                    <p class="text-sm text-blue-600 font-medium mb-2">${profile.skill_category || profile.skill || 'Creative Professional'}</p>
                    
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-yellow-500 text-sm">${ratingStars}</span>
                        <span class="text-sm text-gray-600">
                            ${hasRating ? rating.toFixed(1) : 'No ratings yet'}
                        </span>
                    </div>
                    
                    <div class="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <span><i class="fas fa-check-circle text-green-600 mr-1"></i> ${completedJobs} completed</span>
                        <span><i class="fas fa-briefcase mr-1"></i> ${profile.years_of_experience || 0} yrs exp</span>
                    </div>
                    
                    ${profile.bio ? `
                        <p class="text-sm text-gray-600 line-clamp-2 mt-2">${profile.bio.substring(0, 100)}${profile.bio.length > 100 ? '...' : ''}</p>
                    ` : ''}
                    
                    <div class="mt-3 text-xs text-gray-500">
                        <i class="fas fa-calendar mr-1"></i> Joined ${profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'Recently'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Render Member Profile Page (full profile view)
function renderMemberProfilePage(profile) {
    const joinedDate = profile.created_at 
        ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
        : 'Recently';
    
    return `
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
            <!-- Header Section -->
            <div class="bg-gradient-to-r from-purple-600 to-purple-800 p-8 text-white">
                <div class="flex flex-col md:flex-row items-center md:items-start gap-6">
                    <img 
                        src="${profile.logo_url || `https://placehold.co/150x150/EBF4FF/3B82F6?text=${(profile.business_name || profile.name || 'B').charAt(0).toUpperCase()}`}" 
                        alt="${profile.business_name || profile.name}" 
                        class="w-32 h-32 rounded-full border-4 border-white object-cover shadow-lg"
                    >
                    <div class="flex-1 text-center md:text-left">
                        <h1 class="text-3xl font-bold mb-2">${profile.business_name || profile.name || 'Business'}</h1>
                        <p class="text-xl text-purple-100 mb-2">${profile.industry || profile.creative_type || 'Business'}</p>
                        <div class="flex flex-wrap gap-4 text-sm">
                            <span><i class="fas fa-map-marker-alt mr-1"></i> ${profile.business_location || profile.location || 'Location not specified'}</span>
                            <span><i class="fas fa-calendar mr-1"></i> Joined ${joinedDate}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Content Section -->
            <div class="p-8">
                <!-- Business Description -->
                <div class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">About</h2>
                    <p class="text-gray-700 leading-relaxed">${profile.business_description || profile.description || 'No description available.'}</p>
                </div>

                <!-- Services Offered -->
                ${profile.services_offered && profile.services_offered.length > 0 ? `
                    <div class="mb-8">
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Services Offered</h2>
                        <div class="flex flex-wrap gap-2">
                            ${profile.services_offered.map(service => `
                                <span class="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">${service}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Project Categories -->
                ${profile.project_categories && profile.project_categories.length > 0 ? `
                    <div class="mb-8">
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Project Categories</h2>
                        <div class="flex flex-wrap gap-2">
                            ${profile.project_categories.map(category => `
                                <span class="px-4 py-2 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">${category}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Budget Range -->
                ${profile.budget_min || profile.budget_max ? `
                    <div class="mb-8">
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Budget Range</h2>
                        <p class="text-gray-700">
                            ₦${profile.budget_min ? profile.budget_min.toLocaleString() : '0'} - 
                            ₦${profile.budget_max ? profile.budget_max.toLocaleString() : 'Unlimited'}
                        </p>
                    </div>
                ` : ''}

                <!-- Website & Social Links -->
                ${profile.website_social_links && profile.website_social_links.length > 0 ? `
                    <div class="mb-8">
                        <h2 class="text-2xl font-bold text-gray-900 mb-4">Website & Social Links</h2>
                        <div class="space-y-2">
                            ${profile.website_social_links.map(link => `
                                <a href="${link}" target="_blank" class="text-purple-600 hover:text-purple-800 block">
                                    <i class="fas fa-external-link-alt mr-2"></i> ${link}
                                </a>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Contact -->
                <div class="border-t border-gray-200 pt-6">
                    <h2 class="text-2xl font-bold text-gray-900 mb-4">Contact</h2>
                    <div class="space-y-2 text-gray-700">
                        <p><i class="fas fa-envelope mr-2"></i> ${profile.email || 'Not provided'}</p>
                        ${profile.phone ? `<p><i class="fas fa-phone mr-2"></i> ${profile.phone}</p>` : ''}
                        <p><i class="fas fa-map-marker-alt mr-2"></i> ${profile.business_location || profile.location || 'Not specified'}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Render Member Business ID Card (compact card view)
function renderMemberBusinessIDCard(profile, stats = {}) {
    const completedHires = stats.completed_hires || 0;
    const email = profile.email || "";
    const phone = profile.phone || "";
    
    return `
        <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-200">
            <div class="flex items-start gap-4">
                <img 
                    src="${profile.logo_url || `https://placehold.co/80x80/EBF4FF/3B82F6?text=${(profile.business_name || profile.name || 'B').charAt(0).toUpperCase()}`}" 
                    alt="${profile.business_name || profile.name}" 
                    class="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                >
                <div class="flex-1">
                    <h3 class="text-lg font-bold text-gray-900 mb-1">${profile.business_name || profile.name || 'Business'}</h3>
                    <p class="text-sm text-purple-600 font-medium mb-2">${profile.industry || profile.creative_type || 'Business'}</p>
                    
                    <div class="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <span><i class="fas fa-check-circle text-green-600 mr-1"></i> ${completedHires} hires</span>
                    </div>
                    
                    ${profile.business_description || profile.description ? `
                        <p class="text-sm text-gray-600 line-clamp-2 mt-2">${(profile.business_description || profile.description).substring(0, 100)}${(profile.business_description || profile.description).length > 100 ? '...' : ''}</p>
                    ` : ''}

                    ${(email || phone) ? `
                        <div class="mt-3 text-xs text-gray-500 space-y-1">
                            ${email ? `
                                <div>
                                    <i class="fas fa-envelope mr-1"></i>
                                    <a href="mailto:${email}" class="hover:underline">${email}</a>
                                </div>
                            ` : ''}
                            ${phone ? `
                                <div>
                                    <i class="fas fa-phone mr-1"></i>
                                    <span>${phone}</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    <div class="mt-3 text-xs text-gray-500">
                        <i class="fas fa-map-marker-alt mr-1"></i> ${profile.business_location || profile.location || 'Location not specified'}
                    </div>
                    
                    <div class="mt-2 text-xs text-gray-500">
                        <i class="fas fa-calendar mr-1"></i> Joined ${profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'Recently'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Copy to clipboard function is already defined above

// Set up withdrawal handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupWithdrawalHandlers();
});

// Ensure profile setup form handlers are always wired when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        const apprenticeForm = document.getElementById('profile-setup-form-apprentice');
        if (apprenticeForm && typeof setupApprenticeFormHandlers === 'function') {
            setupApprenticeFormHandlers();
        }

        const memberForm = document.getElementById('profile-setup-form-member');
        if (memberForm && typeof setupMemberFormHandlers === 'function') {
            setupMemberFormHandlers();
        }
    } catch (error) {
        console.error('Error setting up profile form handlers on DOMContentLoaded:', error);
    }
});
