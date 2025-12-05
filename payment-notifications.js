// payment-notifications.js - Unified Notification Service
import { supabase } from "./supabase-client.js";
import { ENV_CONFIG } from "./env.js";

const DEFAULT_CHANNELS = ["in_app"];
const EMAIL_FUNCTION_NAME =
    ENV_CONFIG?.EMAIL_FUNCTION_NAME || "send-notification-email";
const EMAIL_NOTIFICATIONS_ENABLED =
    ENV_CONFIG?.ENABLE_EMAIL_NOTIFICATIONS ?? false;

// ==============================================
// CORE NOTIFICATION HELPERS
// ==============================================

async function getCurrentUserId() {
    try {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        return user?.id || null;
    } catch (error) {
        console.warn("Unable to resolve current user for notification:", error);
        return null;
    }
}

async function fetchUserContact(userId) {
    if (!userId) return { email: null, name: null };
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("email, name")
            .eq("id", userId)
            .single();

        if (error) {
            console.warn("Failed to fetch user contact:", error);
            return { email: null, name: null };
        }

        return { email: data?.email || null, name: data?.name || null };
    } catch (error) {
        console.warn("Error fetching user contact:", error);
        return { email: null, name: null };
    }
}

async function sendEmailNotification({
    userId,
    to,
    subject,
    html,
    text,
    metadata = {},
}) {
    if (!EMAIL_NOTIFICATIONS_ENABLED) {
        return { skipped: true, reason: "disabled" };
    }

    try {
        let recipient = to;
        if (!recipient && userId) {
            const { email } = await fetchUserContact(userId);
            recipient = email;
        }

        if (!recipient) {
            return { skipped: true, reason: "no-email" };
        }

        const payload = {
            to: recipient,
            subject: subject || "Craftiva Notification",
            html: html || `<p>${text || "You have a new notification."}</p>`,
            text: text || "You have a new notification.",
            metadata,
        };

        const { data, error } = await supabase.functions.invoke(
            EMAIL_FUNCTION_NAME,
            {
                body: payload,
            }
        );

        if (error) {
            console.warn("Email notification failed:", error);
            return { skipped: true, reason: error.message };
        }

        return { delivered: true, data };
    } catch (error) {
        console.warn("Email notification error:", error);
        return { skipped: true, reason: error.message };
    }
}

async function createNotificationRecord({
    userId,
    type,
    title,
    message,
    metadata = {},
    channels = DEFAULT_CHANNELS,
    actorId = null,
}) {
    if (!userId) {
        throw new Error("userId is required to create a notification");
    }

    const resolvedActorId = actorId || (await getCurrentUserId());

    const { data, error } = await supabase.rpc("create_notification", {
        p_actor_id: resolvedActorId,
        p_user_id: userId,
        p_type: type,
        p_title: title,
        p_message: message,
        p_metadata: metadata,
        p_channels: channels,
    });

    if (error) {
        console.error("Failed to create notification:", error);
        throw error;
    }

    return data;
}

// Public API
export async function createNotification({
    userId,
    type,
    title,
    message,
    metadata = {},
    channels = DEFAULT_CHANNELS,
    actorId = null,
    emailOptions = null,
}) {
    const notification = await createNotificationRecord({
        userId,
        type,
        title,
        message,
        metadata,
        channels,
        actorId,
    });

    if (emailOptions) {
        await sendEmailNotification({
            userId,
            ...emailOptions,
            subject: emailOptions.subject || title,
            text: emailOptions.text || message,
        });
    }

    return notification;
}

// ==============================================
// PAYMENT NOTIFICATION TRIGGERS
// ==============================================

export async function notifyFundingRequestCreated(
    userId,
    amount,
    bankReference
) {
    const title = "Funding Request Submitted";
    const message = `Your funding request for ${formatCurrency(
        amount
    )} has been submitted. Reference: ${bankReference}. We'll verify and credit your wallet within 24 hours.`;

    return createNotification({
        userId,
        type: "funding_request",
        title,
        message,
        metadata: { amount, bankReference, status: "pending" },
        emailOptions: {
            subject: title,
            html: buildEmailTemplate({
                heading: title,
                body: message,
            }),
        },
    });
}

export async function notifyFundingRequestApproved(
    userId,
    amount,
    transactionReference
) {
    const title = "Wallet Funded Successfully";
    const message = `${formatCurrency(
        amount
    )} has been credited to your wallet. Transaction Reference: ${
        transactionReference || "N/A"
    }.`;

    return createNotification({
        userId,
        type: "funding_approved",
        title,
        message,
        metadata: { amount, transactionReference, status: "approved" },
        emailOptions: {
            subject: title,
            html: buildEmailTemplate({
                heading: title,
                body: message,
            }),
        },
    });
}

export async function notifyFundingRequestRejected(userId, amount, reason) {
    const title = "Funding Request Rejected";
    const message = `Your funding request for ${formatCurrency(
        amount
    )} was rejected. Reason: ${reason}.`;

    return createNotification({
        userId,
        type: "funding_rejected",
        title,
        message,
        metadata: { amount, reason, status: "rejected" },
        emailOptions: {
            subject: title,
            html: buildEmailTemplate({
                heading: title,
                body: message,
            }),
        },
    });
}

export async function notifyWithdrawalRequestCreated(
    userId,
    amountPoints,
    bankDetails
) {
    const title = "Withdrawal Request Submitted";
    const message = `Your withdrawal request for ${formatPoints(
        amountPoints
    )} has been submitted. Processing time: 1-3 business days.`;

    return createNotification({
        userId,
        type: "withdrawal_request",
        title,
        message,
        metadata: { amountPoints, bankDetails, status: "pending" },
        emailOptions: {
            subject: title,
            html: buildEmailTemplate({
                heading: title,
                body: message,
            }),
        },
    });
}

export async function notifyWithdrawalRequestApproved(
    userId,
    amountPoints,
    bankTransactionId
) {
    const title = "Withdrawal Approved";
    const message = `Your withdrawal request for ${formatPoints(
        amountPoints
    )} has been approved. Bank Transaction ID: ${
        bankTransactionId || "N/A"
    }. Funds should arrive within 24 hours.`;

    return createNotification({
        userId,
        type: "withdrawal_approved",
        title,
        message,
        metadata: {
            amountPoints,
            bankTransactionId,
            status: "approved",
        },
        emailOptions: {
            subject: title,
            html: buildEmailTemplate({
                heading: title,
                body: message,
            }),
        },
    });
}

export async function notifyWithdrawalRequestRejected(userId, amount, reason) {
    const title = "Withdrawal Request Rejected";
    const message = `Your withdrawal request for ${formatPoints(
        amount
    )} was rejected. Reason: ${reason}. Funds have been refunded to your wallet.`;

    return createNotification({
        userId,
        type: "withdrawal_rejected",
        title,
        message,
        metadata: { amount, reason, status: "rejected" },
        emailOptions: {
            subject: title,
            html: buildEmailTemplate({
                heading: title,
                body: message,
            }),
        },
    });
}

export async function notifyEscrowFundsHeld(userId, amount, jobTitle) {
    const title = "Funds Held in Escrow";
    const message = `${formatCurrency(
        amount
    )} has been held in escrow for job: "${jobTitle}". Funds will be released upon job completion.`;

    return createNotification({
        userId,
        type: "escrow_hold",
        title,
        message,
        metadata: { amount, jobTitle, status: "held" },
    });
}

export async function notifyEscrowFundsReleased(userId, amount, jobTitle) {
    const title = "Escrow Funds Released";
    const message = `${formatCurrency(
        amount
    )} has been released from escrow for completed job: "${jobTitle}". Funds are now in your wallet.`;

    return createNotification({
        userId,
        type: "escrow_released",
        title,
        message,
        metadata: { amount, jobTitle, status: "released" },
    });
}

export async function notifyEscrowFundsRefunded(
    userId,
    amount,
    jobTitle,
    reason
) {
    const title = "Escrow Funds Refunded";
    const message = `${formatCurrency(
        amount
    )} has been refunded from escrow for job: "${jobTitle}". Reason: ${reason}.`;

    return createNotification({
        userId,
        type: "escrow_refunded",
        title,
        message,
        metadata: { amount, jobTitle, reason, status: "refunded" },
    });
}

// ==============================================
// JOB & ALERT NOTIFICATIONS
// ==============================================

export async function notifyJobApplicationSubmitted({
    clientId,
    jobId,
    jobTitle,
    apprenticeName,
}) {
    const title = "New Job Application";
    const message = `${
        apprenticeName || "An apprentice"
    } applied for "${jobTitle}". Review the proposal and respond when ready.`;

    return createNotification({
        userId: clientId,
        type: "job_application",
        title,
        message,
        metadata: { jobId, jobTitle, applicant: apprenticeName },
        emailOptions: {
            subject: `New application for ${jobTitle}`,
            html: buildEmailTemplate({
                heading: title,
                body: message,
                cta: {
                    label: "Review application",
                    url: `${ENV_CONFIG.SITE_URL}/dashboard-supabase.html#jobs`,
                },
            }),
        },
    });
}

export async function notifyJobApplicationStatus({
    apprenticeId,
    jobTitle,
    status,
    clientName,
}) {
    const isAccepted = status === "accepted";
    const title = isAccepted ? "Job Application Accepted" : "Job Application Update";
    const message = isAccepted
        ? `${clientName || "The client"} accepted your application for "${jobTitle}". Get ready to start!`
        : `${clientName || "The client"} updated your application for "${jobTitle}". Status: ${status}.`;

    return createNotification({
        userId: apprenticeId,
        type: isAccepted ? "job_application_accepted" : "job_application_update",
        title,
        message,
        metadata: { jobTitle, status, clientName },
        emailOptions: {
            subject: title,
            html: buildEmailTemplate({
                heading: title,
                body: message,
                cta: {
                    label: "Open job board",
                    url: `${ENV_CONFIG.SITE_URL}/dashboard-supabase.html#jobs`,
                },
            }),
        },
    });
}

export async function notifyJobAlert({
    userId,
    jobId = null,
    jobTitle,
    summary,
    skillsMatch = [],
}) {
    const title = "Job Alert";
    const fallbackSummary = summary || "Check it out before it fills up.";
    const truncatedSummary =
        fallbackSummary.length > 160
            ? `${fallbackSummary.slice(0, 157)}...`
            : fallbackSummary;
    const message = `New job posted: "${jobTitle}". ${truncatedSummary}`;

    return createNotification({
        userId,
        type: "job_alert",
        title,
        message,
        metadata: { jobId, jobTitle, summary: truncatedSummary, skillsMatch },
        emailOptions: {
            subject: `New job match: ${jobTitle}`,
            html: buildEmailTemplate({
                heading: title,
                body: `${message}${
                    skillsMatch?.length
                        ? `<br/><br/><strong>Focus skills:</strong> ${skillsMatch.join(
                              ", "
                          )}`
                        : ""
                }`,
                cta: {
                    label: "Open job board",
                    url: `${ENV_CONFIG.SITE_URL}/dashboard-supabase.html#jobs`,
                },
            }),
        },
    });
}

// ==============================================
// NOTIFICATION QUERIES & REALTIME
// ==============================================

export async function getUserNotifications(userId, limit = 20, offset = 0) {
    const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error("Error fetching notifications:", error);
        throw error;
    }

    return data || [];
}

export async function markNotificationAsRead(notificationId) {
    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);

    if (error) {
        console.error("Error marking notification as read:", error);
        throw error;
    }

    return true;
}

export async function markAllNotificationsAsRead(userId) {
    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("is_read", false);

    if (error) {
        console.error("Error marking all notifications as read:", error);
        throw error;
    }

    return true;
}

export async function getUnreadNotificationCount(userId) {
    const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);

    if (error) {
        console.error("Error counting unread notifications:", error);
        return 0;
    }

    return count || 0;
}

export function subscribeToNotifications(userId, { onInsert, onError } = {}) {
    if (!userId) return null;
    const channel = supabase
        .channel(`notifications:user:${userId}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "notifications",
                filter: `user_id=eq.${userId}`,
            },
            (payload) => {
                if (typeof onInsert === "function") {
                    onInsert(payload.new);
                }
            }
        )
        .subscribe((status) => {
            if (status === "CHANNEL_ERROR" && typeof onError === "function") {
                onError(new Error("Notification channel error"));
            }
        });

    return channel;
}

export function unsubscribeFromNotifications(channel) {
    if (channel) {
        supabase.removeChannel(channel);
    }
}

// ==============================================
// NOTIFICATION DISPLAY (TOASTS)
// ==============================================

export function displayNotification(notification) {
    const notificationElement = createNotificationElement(notification);
    const container =
        document.getElementById("notifications-container") ||
        createNotificationContainer();
    container.appendChild(notificationElement);

    setTimeout(() => {
        if (notificationElement.parentNode) {
            notificationElement.remove();
        }
    }, 5000);
}

function createNotificationElement(notification) {
    const element = document.createElement("div");
    element.className = `notification notification-${notification.type}`;
    element.innerHTML = `
        <div class="notification-icon">
            <i class="fas ${getNotificationIcon(notification.type)}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${notification.title}</div>
            <div class="notification-message">${notification.message}</div>
            <div class="notification-time">${new Date(
                notification.created_at
            ).toLocaleString()}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    return element;
}

function createNotificationContainer() {
    const container = document.createElement("div");
    container.id = "notifications-container";
    container.className = "notifications-container";
    document.body.appendChild(container);
    return container;
}

function getNotificationIcon(type) {
    const icons = {
        funding_request: "fa-plus-circle",
        funding_approved: "fa-check-circle",
        funding_rejected: "fa-times-circle",
        withdrawal_request: "fa-money-bill-wave",
        withdrawal_approved: "fa-check-circle",
        withdrawal_rejected: "fa-times-circle",
        escrow_hold: "fa-lock",
        escrow_released: "fa-unlock",
        escrow_refunded: "fa-undo",
        job_alert: "fa-briefcase",
        job_application: "fa-user-plus",
        job_application_accepted: "fa-check-circle",
        job_application_update: "fa-info-circle",
    };
    return icons[type] || "fa-bell";
}

// ==============================================
// UTILS & STYLES
// ==============================================

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
    }).format(amount || 0);
}

function formatPoints(points = 0) {
    return `${Number(points).toFixed(2)} pts`;
}

function buildEmailTemplate({ heading, body, cta }) {
    return `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background-color: #f8fafc;">
            <div style="background: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
                <h2 style="margin-top: 0; color: #111827; font-size: 20px;">${heading}</h2>
                <p style="color: #4b5563; line-height: 1.5;">${body}</p>
                ${
                    cta
                        ? `<a href="${cta.url}" style="display: inline-block; margin-top: 16px; background: #2563eb; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">${cta.label}</a>`
                        : ""
                }
            </div>
            <p style="text-align:center; color:#94a3b8; font-size: 12px; margin-top: 16px;">Craftiva Notifications</p>
        </div>
    `;
}

export const notificationStyles = `
    .notifications-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
    }

    .notification {
        display: flex;
        align-items: flex-start;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        margin-bottom: 10px;
        padding: 15px;
        border-left: 4px solid #667eea;
        animation: slideIn 0.3s ease-out;
    }

    .notification.job_alert {
        border-left-color: #0ea5e9;
    }

    .notification-icon {
        margin-right: 12px;
        margin-top: 2px;
    }

    .notification-icon i {
        font-size: 1.2rem;
        color: #667eea;
    }

    .notification-content {
        flex: 1;
    }

    .notification-title {
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
    }

    .notification-message {
        color: #666;
        font-size: 0.9rem;
        line-height: 1.4;
        margin-bottom: 4px;
    }

    .notification-time {
        color: #999;
        font-size: 0.8rem;
    }

    .notification-close {
        background: none;
        border: none;
        color: #999;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0;
        margin-left: 10px;
    }

    .notification-close:hover {
        color: #666;
    }

    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @media (max-width: 768px) {
        .notifications-container {
            top: 10px;
            right: 10px;
            left: 10px;
            max-width: none;
        }
    }
`;

export function injectNotificationStyles() {
    if (!document.getElementById("notification-styles")) {
        const style = document.createElement("style");
        style.id = "notification-styles";
        style.textContent = notificationStyles;
        document.head.appendChild(style);
    }
}

// Backwards compatibility with global usage
window.createNotification = createNotification;
window.createPaymentNotification = (userId, type, title, message, metadata) =>
    createNotification({ userId, type, title, message, metadata });
window.getUserNotifications = getUserNotifications;
window.markNotificationAsRead = markNotificationAsRead;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.getUnreadNotificationCount = getUnreadNotificationCount;
window.displayNotification = displayNotification;
window.injectNotificationStyles = injectNotificationStyles;

