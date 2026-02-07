// supabase-auth.js - Fixed version
import { supabase } from "./supabase-client.js";
export { supabase } from "./supabase-client.js";
import {
    notifyJobApplicationSubmitted,
    notifyJobApplicationStatus,
    notifyJobAlert,
} from "./payment-notifications.js";
import { getUserWallet } from "./manual-payment-system.js";

// Constants
export const FINAL_SUBMISSION_BUCKET = "final-submissions";
export const PERSONAL_FINAL_BUCKET = "personal-final-submissions";

// --- Error Handling ---
export function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
        if (message) {
            errorEl.textContent = message;
            errorEl.classList.remove("hidden-view", "hidden");
        } else {
            // Clear error
            errorEl.textContent = "";
            errorEl.classList.add("hidden-view", "hidden");
        }
    } else {
        // Fallback: show alert if element not found
        if (message) {
            console.error("Error element not found:", elementId, "Message:", message);
            alert(message);
        }
    }
}

function updateMessageElement(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) {
        return null;
    }

    if (message) {
        el.textContent = message;
        el.classList.remove("hidden-view", "hidden");
    } else {
        el.textContent = "";
        el.classList.add("hidden-view", "hidden");
    }

    return el;
}

// --- Referral System Functions ---

// Generate a unique referral code for a user
export async function generateReferralCode(userId) {
    try {
        // Check if user already has a referral code
        const { data: existingCode, error: checkError } = await supabase
            .from("referral_codes")
            .select("id, code")
            .eq("user_id", userId)
            .eq("is_active", true)
            .single();

        if (checkError && checkError.code !== "PGRST116") {
            throw checkError;
        }

        if (existingCode) {
            return existingCode.code;
        }

        // Generate new referral code using a simple approach
        let generatedCode;
        let attempts = 0;
        const maxAttempts = 10;

        do {
            // Generate a simple 8-character alphanumeric code
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            generatedCode = "";
            for (let i = 0; i < 8; i++) {
                generatedCode += chars.charAt(
                    Math.floor(Math.random() * chars.length)
                );
            }

            // Check if this code already exists
            const { data: existingCode, error: checkError } = await supabase
                .from("referral_codes")
                .select("id")
                .eq("code", generatedCode)
                .single();

            if (checkError && checkError.code === "PGRST116") {
                // Code doesn't exist, we can use it
                break;
            }

            attempts++;
        } while (attempts < maxAttempts);

        if (attempts >= maxAttempts) {
            throw new Error(
                "Failed to generate unique referral code after multiple attempts"
            );
        }

        const { data: newCode, error: generateError } = await supabase
            .from("referral_codes")
            .insert({
                user_id: userId,
                code: generatedCode,
                is_active: true,
            })
            .select("code")
            .single();

        if (generateError) throw generateError;
        return newCode.code;
    } catch (error) {
        console.error("Error generating referral code:", error);
        console.error("Error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });
        // Return a fallback code instead of throwing to prevent infinite loading
        return `REF${userId.substring(0, 8).toUpperCase()}`;
    }
}

// Get user's referral code
export async function getUserReferralCode(userId) {
    try {
        const { data, error } = await supabase
            .from("referral_codes")
            .select("code, total_referrals, created_at")
            .eq("user_id", userId)
            .eq("is_active", true)
            .single();

        if (error && error.code === "PGRST116") {
            // No referral code exists, generate one
            const code = await generateReferralCode(userId);
            return {
                code: code,
                total_referrals: 0,
                created_at: new Date().toISOString(),
            };
        }

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error getting user referral code:", error);
        console.error("Error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });
        // Return a default object instead of throwing to prevent infinite loading
        return {
            code: null,
            total_referrals: 0,
            created_at: new Date().toISOString(),
        };
    }
}

// Validate a referral code
export async function validateReferralCode(code) {
    try {
        const { data, error } = await supabase
            .from("referral_codes")
            .select("id, user_id, is_active")
            .eq("code", code.toUpperCase())
            .eq("is_active", true)
            .single();

        if (error && error.code === "PGRST116") {
            return null; // Code not found
        }

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error validating referral code:", error);
        return null;
    }
}

// Award referral points when a new user signs up
export async function awardReferralPoints(
    referrerUserId,
    referredUserId,
    referralCodeId
) {
    try {
        const { data, error } = await supabase.rpc("award_referral_points", {
            referrer_user_id: referrerUserId,
            referred_user_id: referredUserId,
            referral_code_id: referralCodeId,
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error awarding referral points:", error);
        throw error;
    }
}

// Get user's referral statistics
export async function getUserReferralStats(userId) {
    try {
        const { data, error } = await supabase
            .from("referrals")
            .select(
                `
                id,
                referred_user:profiles!referrals_referred_user_id_fkey(
                    id,
                    name,
                    email,
                    created_at
                ),
                points_awarded,
                created_at
            `
            )
            .eq("referrer_id", userId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error getting referral stats:", error);
        // Return empty array instead of throwing to prevent loading issues
        return [];
    }
}

// --- Authentication Functions ---
export async function handleLogin(email, password) {
    console.log('🔄 Starting login...');
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        console.log('📦 Login response:', { data: data ? { user: data.user?.email } : null, error: error ? error.message : null });

        if (error) {
            const normalizedMessage = error.message?.toLowerCase() || "";
            if (normalizedMessage.includes("email not confirmed")) {
                const verificationError = new Error("EMAIL_NOT_VERIFIED");
                verificationError.code = "EMAIL_NOT_VERIFIED";
                throw verificationError;
            }
            throw error;
        }

        const user = data?.user;
        if (!user) {
            throw new Error("User data missing from login response.");
        }

        const isEmailVerified = Boolean(
            user.email_confirmed_at || user.confirmed_at
        );

        if (!isEmailVerified) {
            await supabase.auth.signOut();
            const verificationError = new Error("EMAIL_NOT_VERIFIED");
            verificationError.code = "EMAIL_NOT_VERIFIED";
            throw verificationError;
        }

        // Wait longer for the session to be fully established and persisted
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify the session is established before redirecting
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
            throw new Error("Session not established");
        }

        console.log('✅ User logged in:', user.email);
        console.log('✅ Session verified:', session.user.id);
        console.log('🔄 Checking user role for redirect...');

        // Check user's role to determine redirect destination
        const { data: profile, error: loginProfileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        // Use relative URLs - works both locally and on GitHub Pages
        if (loginProfileError) {
            console.warn("Could not fetch user profile, defaulting to regular dashboard");
            console.log('🔄 Redirecting to dashboard...');
            // Use window.location.replace to avoid back button issues
            window.location.replace('dashboard-supabase.html');
            return;
        }

        // Redirect based on user role
        if (profile.role === 'admin') {
            console.log("Admin user detected, redirecting to admin dashboard");
            console.log('🔄 Redirecting to admin dashboard...');
            window.location.replace('admin-dashboard-simplified.html');
        } else {
            console.log("Regular user detected, redirecting to dashboard");
            console.log('🔄 Redirecting to dashboard...');
            window.location.replace('dashboard-supabase.html');
        }
    } catch (error) {
        console.error("Login error:", error);
        if (error?.code === "EMAIL_NOT_VERIFIED" || error?.message === "EMAIL_NOT_VERIFIED") {
            showError(
                "login-error",
                "Please verify your email before signing in. Check your inbox for the confirmation link."
            );
        } else {
            showError("login-error", "Invalid email or password.");
        }
        throw error;
    }
}

export async function handleMemberSignup(
    name,
    email,
    password,
    creativeType,
    referralCode = null
) {
    let submitButton = null;
    let originalButtonText = "Sign Up";
    
    try {
        // Try to find the submit button
        submitButton = document.querySelector('#signup-member-form button[type="submit"]');
        if (submitButton) {
            originalButtonText = submitButton.textContent || "Sign Up";
        }
        
        // Show loading state
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Signing up...";
            submitButton.classList.add("opacity-50", "cursor-not-allowed");
        }
        
        // Clear any previous errors or success states
        showError("signup-member-error", "");
        updateMessageElement("signup-member-success", "");

        const emailRedirectTo =
            typeof window !== "undefined"
                ? `${window.location.origin}/login-supabase.html`
                : undefined;
        
        // Step 1: Sign up the user
        const { data: authData, error: authError } = await supabase.auth.signUp(
            {
                email,
                password,
                options: {
                    emailRedirectTo,
                    data: {
                        name: name,
                        role: "member",
                        creative_type: creativeType,
                    },
                },
            }
        );

        if (authError) {
            console.error("Auth error:", authError);
            throw new Error(authError.message || "Failed to create account. Please check your email and password.");
        }

        if (!authData.user) {
            throw new Error("User creation failed. Please try again.");
        }

        // Step 2: Use upsert to handle potential existing profile
        const { error: profileError } = await supabase.from("profiles").upsert(
            {
                id: authData.user.id,
                name: name,
                email: email,
                role: "member",
                creative_type: creativeType,
                description: "",
                eligibility_points: 0,
                referral_points: 0,
                referrals: 0,
                followers: 0,
                following: 0,
                subscription_plan: "free",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "id",
            }
        );

        if (profileError) {
            console.error("Profile creation error:", profileError);
            // If it's a table not found error, provide helpful message
            if (profileError.message?.includes("relation") || profileError.message?.includes("does not exist")) {
                throw new Error("Database table not found. Please ensure the 'profiles' table exists in your Supabase database.");
            }
            // For other errors, log but continue (profile might already exist)
            console.warn("Profile creation warning:", profileError);
        }

        // Step 3: Handle referral if provided
        if (referralCode) {
            try {
                const referralData = await validateReferralCode(referralCode);
                if (referralData && referralData.user_id !== authData.user.id) {
                    await awardReferralPoints(
                        referralData.user_id,
                        authData.user.id,
                        referralData.id
                    );
                    console.log("Referral points awarded successfully");
                }
            } catch (referralError) {
                console.warn("Referral processing failed:", referralError);
                // Don't fail the signup if referral fails
            }
        }

        const successMessage = `Almost there! We've sent a verification link to ${email}. Please confirm your email before signing in.`;
        updateMessageElement("signup-member-success", successMessage);

        await supabase.auth.signOut();

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText || "Sign Up";
            submitButton.classList.remove("opacity-50", "cursor-not-allowed");
        }
    } catch (error) {
        console.error("Member signup error:", error);
        const errorMessage = error.message || "An unexpected error occurred. Please try again.";
        showError("signup-member-error", errorMessage);
        
        // Re-enable button
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText || "Sign Up";
            submitButton.classList.remove("opacity-50", "cursor-not-allowed");
        }
    }
}

export async function handleApprenticeSignup(
    name,
    skill,
    location,
    email,
    password,
    referralCode = null
) {
    let submitButton = null;
    let originalButtonText = "Sign Up";
    
    try {
        // Try to find the submit button
        submitButton = document.querySelector('#signup-apprentice-form button[type="submit"]');
        if (submitButton) {
            originalButtonText = submitButton.textContent || "Sign Up";
        }
        
        // Show loading state
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Signing up...";
            submitButton.classList.add("opacity-50", "cursor-not-allowed");
        }
        
        // Clear any previous errors or success states
        showError("signup-apprentice-error", "");
        updateMessageElement("signup-apprentice-success", "");

        const emailRedirectTo =
            typeof window !== "undefined"
                ? `${window.location.origin}/login-supabase.html`
                : undefined;
        
        // Step 1: Sign up the user
        const { data: authData, error: authError } = await supabase.auth.signUp(
            {
                email,
                password,
                options: {
                    emailRedirectTo,
                    data: {
                        name: name,
                        role: "apprentice",
                        skill: skill,
                        location: location,
                    },
                },
            }
        );

        if (authError) {
            console.error("Auth error:", authError);
            throw new Error(authError.message || "Failed to create account. Please check your email and password.");
        }

        if (!authData.user) {
            throw new Error("User creation failed. Please try again.");
        }

        // Step 2: Use upsert to handle potential existing profile
        const { error: profileError } = await supabase.from("profiles").upsert(
            {
                id: authData.user.id,
                name: name,
                email: email,
                role: "apprentice",
                skill: skill,
                location: location,
                description: "",
                followers: 0,
                following: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            {
                onConflict: "id",
            }
        );

        if (profileError) {
            console.error("Profile creation error:", profileError);
            // If it's a table not found error, provide helpful message
            if (profileError.message?.includes("relation") || profileError.message?.includes("does not exist")) {
                throw new Error("Database table not found. Please ensure the 'profiles' table exists in your Supabase database.");
            }
            // For other errors, log but continue (profile might already exist)
            console.warn("Profile creation warning:", profileError);
        }

        // Step 3: Handle referral if provided
        if (referralCode) {
            try {
                const referralData = await validateReferralCode(referralCode);
                if (referralData && referralData.user_id !== authData.user.id) {
                    await awardReferralPoints(
                        referralData.user_id,
                        authData.user.id,
                        referralData.id
                    );
                    console.log("Referral points awarded successfully");
                }
            } catch (referralError) {
                console.warn("Referral processing failed:", referralError);
                // Don't fail the signup if referral fails
            }
        }

        const successMessage = `Almost there! We've sent a verification link to ${email}. Please confirm your email before signing in.`;
        updateMessageElement("signup-apprentice-success", successMessage);

        await supabase.auth.signOut();

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText || "Sign Up";
            submitButton.classList.remove("opacity-50", "cursor-not-allowed");
        }
    } catch (error) {
        console.error("Apprentice signup error:", error);
        const errorMessage = error.message || "An unexpected error occurred. Please try again.";
        showError("signup-apprentice-error", errorMessage);
        
        // Re-enable button
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText || "Sign Up";
            submitButton.classList.remove("opacity-50", "cursor-not-allowed");
        }
    }
}

export async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Logout error:", error);
            throw error;
        }
        // Redirect to login page after successful logout
        window.location.href = "login-supabase.html";
    } catch (error) {
        console.error("Logout failed:", error);
        // Still redirect even if there's an error
        window.location.href = "login-supabase.html";
    }
}

// --- Helper Functions for Database Operations ---

// Get current user profile with retry logic
export async function getUserProfile(userId) {
    let retries = 3;
    let lastError;

    while (retries > 0) {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();

            if (error && error.code === "PGRST116") {
                // Profile not found, create it with basic info
                const { data: userData } = await supabase.auth.getUser();
                if (userData.user) {
                    const userMetadata = userData.user.user_metadata || {};
                    await createBasicProfile(userId, userMetadata);
                    // Retry fetching after creating
                    retries--;
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    continue;
                }
            }

            if (error) throw error;
            return data;
        } catch (error) {
            lastError = error;
            retries--;
            if (retries > 0) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    }

    throw lastError;
}

// Create basic profile if it doesn't exist
async function createBasicProfile(userId, metadata) {
    const profileData = {
        id: userId,
        name: metadata.name || "New User",
        email: metadata.email || "",
        role: metadata.role || "member",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    if (metadata.role === "member") {
        profileData.creative_type = metadata.creative_type || "Other";
        profileData.description = "";
        profileData.eligibility_points = 0;
        profileData.referral_points = 0;
        profileData.referrals = 0;
        profileData.subscription_plan = "free";
    } else if (metadata.role === "apprentice") {
        profileData.skill = metadata.skill || "Not specified";
        profileData.location = metadata.location || "Not specified";
        profileData.description = "";
    }

    profileData.followers = 0;
    profileData.following = 0;

    const { error } = await supabase
        .from("profiles")
        .upsert(profileData, { onConflict: "id" });

    if (error) {
        console.warn("Failed to create basic profile:", error);
    }
}

// Update user profile
export async function updateUserProfile(userId, updates) {
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

    if (error) throw error;
    return data;
}

// Increment points
export async function incrementUserPoints(userId, pointType, amount) {
    const { data: currentData, error: fetchError } = await supabase
        .from("profiles")
        .select(pointType)
        .eq("id", userId)
        .single();

    if (fetchError) throw fetchError;

    const newValue = (currentData[pointType] || 0) + amount;

    const { error: updateError } = await supabase
        .from("profiles")
        .update({
            [pointType]: newValue,
            updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

    if (updateError) throw updateError;
}

// Add a post
export async function addPost(userId, title, description, imageUrl) {
    const { data, error } = await supabase.from("posts").insert({
        user_id: userId,
        title: title,
        description: description,
        image_url: imageUrl,
        likes: 0,
        created_at: new Date().toISOString(),
    });

    if (error) throw error;
    return data;
}

// Get user posts
export async function getUserPosts(userId, limit = 20) {
    try {
        // Get posts with like counts
        const { data: posts, error: postsError } = await supabase
            .from("posts")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (postsError) throw postsError;

        // Check which posts the current user has liked
        const postsWithLikes = await Promise.all(
            posts.map(async (post) => {
                const userLiked = await checkUserLike(post.id, userId);
                return {
                    ...post,
                    user_liked: userLiked,
                };
            })
        );

        return postsWithLikes;
    } catch (error) {
        console.error("Error getting user posts:", error);
        throw error;
    }
}

// Get posts by a specific user ID (for viewing other users' galleries)
export async function getUserPostsById(
    targetUserId,
    currentUserId = null,
    limit = 20
) {
    try {
        // Get posts with like counts
        const { data: posts, error: postsError } = await supabase
            .from("posts")
            .select("*")
            .eq("user_id", targetUserId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (postsError) throw postsError;

        // Check which posts the current user has liked (if currentUserId is provided)
        const postsWithLikes = await Promise.all(
            posts.map(async (post) => {
                let userLiked = false;
                if (currentUserId) {
                    userLiked = await checkUserLike(post.id, currentUserId);
                }
                return {
                    ...post,
                    user_liked: userLiked,
                };
            })
        );

        return postsWithLikes;
    } catch (error) {
        console.error("Error getting user posts by ID:", error);
        throw error;
    }
}

// Delete a post
export async function deletePost(postId, userId) {
    try {
        // First get the post to check ownership and get image URL
        const { data: post, error: fetchError } = await supabase
            .from("posts")
            .select("image_url, user_id")
            .eq("id", postId)
            .single();

        if (fetchError) throw fetchError;

        // Check if user owns the post
        if (post.user_id !== userId) {
            throw new Error("You can only delete your own posts");
        }

        // Delete the post from database
        const { error: deleteError } = await supabase
            .from("posts")
            .delete()
            .eq("id", postId)
            .eq("user_id", userId);

        if (deleteError) throw deleteError;

        // Try to delete the image file from storage (optional - won't fail if file doesn't exist)
        if (post.image_url) {
            try {
                const imagePath = post.image_url.split("/").slice(-2).join("/"); // Extract path from URL
                await supabase.storage.from("posts").remove([imagePath]);
            } catch (storageError) {
                console.warn("Could not delete image file:", storageError);
                // Don't fail the whole operation if storage deletion fails
            }
        }

        return true;
    } catch (error) {
        console.error("Error deleting post:", error);
        throw error;
    }
}

// Like/Unlike a post
export async function togglePostLike(postId, userId) {
    try {
        // Check if user already liked this post
        const { data: existingLike, error: checkError } = await supabase
            .from("post_likes")
            .select("id")
            .eq("post_id", postId)
            .eq("user_id", userId)
            .single();

        if (checkError && checkError.code !== "PGRST116") {
            throw checkError;
        }

        if (existingLike) {
            // Unlike: remove the like
            const { error: unlikeError } = await supabase
                .from("post_likes")
                .delete()
                .eq("post_id", postId)
                .eq("user_id", userId);

            if (unlikeError) throw unlikeError;

            // Decrease like count - first get current likes
            const { data: currentPost, error: fetchError } = await supabase
                .from("posts")
                .select("likes")
                .eq("id", postId)
                .single();

            if (fetchError) throw fetchError;

            const newLikeCount = Math.max((currentPost.likes || 0) - 1, 0);
            const { error: updateError } = await supabase
                .from("posts")
                .update({ likes: newLikeCount })
                .eq("id", postId);

            if (updateError) throw updateError;

            return { liked: false, action: "unliked" };
        } else {
            // Like: add the like
            const { error: likeError } = await supabase
                .from("post_likes")
                .insert({
                    post_id: postId,
                    user_id: userId,
                    created_at: new Date().toISOString(),
                });

            if (likeError) throw likeError;

            // Increase like count - first get current likes
            const { data: currentPost, error: fetchError } = await supabase
                .from("posts")
                .select("likes")
                .eq("id", postId)
                .single();

            if (fetchError) throw fetchError;

            const newLikeCount = (currentPost.likes || 0) + 1;
            const { error: updateError } = await supabase
                .from("posts")
                .update({ likes: newLikeCount })
                .eq("id", postId);

            if (updateError) throw updateError;

            return { liked: true, action: "liked" };
        }
    } catch (error) {
        console.error("Error toggling post like:", error);
        throw error;
    }
}

// Check if user has liked a post
export async function checkUserLike(postId, userId) {
    try {
        const { data, error } = await supabase
            .from("post_likes")
            .select("id")
            .eq("post_id", postId)
            .eq("user_id", userId)
            .single();

        if (error && error.code === "PGRST116") {
            return false; // No like found
        }

        if (error) throw error;
        return true; // Like found
    } catch (error) {
        console.error("Error checking user like:", error);
        return false;
    }
}

// Get users by role
export async function getUsersByRole(role, limit = 50) {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", role)
        .limit(limit);

    if (error) throw error;
    return data;
}

// Search users
export async function searchUsers(
    searchTerm,
    creativeTypeFilter = "",
    role = "member",
    limit = 50
) {
    let query = supabase
        .from("profiles")
        .select("*")
        .eq("role", role)
        .limit(limit);

    if (creativeTypeFilter && creativeTypeFilter.trim() !== "") {
        if (role === "member") {
            query = query.eq("creative_type", creativeTypeFilter);
        } else {
            query = query.ilike("skill", `%${creativeTypeFilter}%`);
        }
    }

    if (searchTerm && searchTerm.trim() !== "") {
        const term = searchTerm.trim();
        query = query.or(
            `name.ilike.%${term}%,email.ilike.%${term}%,creative_type.ilike.%${term}%,skill.ilike.%${term}%,location.ilike.%${term}%`
        );
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
}

// Get top users by points
export async function getTopUsers(limit = 10) {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "member")
        .order("referral_points", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}

// Get trending creators
export async function getTrendingCreators(role = "member", limit = 10) {
    const targetRole = role === "member" ? "apprentice" : "member";

    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", targetRole)
        .order("followers", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}

// Follow a user
export async function followUser(followerId, followingId) {
    try {
        // Check if already following
        const { data: existingFollow, error: checkError } = await supabase
            .from("follows")
            .select("id")
            .eq("follower_id", followerId)
            .eq("following_id", followingId)
            .single();

        if (checkError && checkError.code !== "PGRST116") {
            throw checkError;
        }

        if (existingFollow) {
            return true; // Already following
        }

        // Create follow relationship
        const { error: followError } = await supabase.from("follows").insert({
            follower_id: followerId,
            following_id: followingId,
            created_at: new Date().toISOString(),
        });

        if (followError) throw followError;

        // Update follower counts using RPC functions
        const { error: incrementError } = await supabase.rpc(
            "increment_followers",
            { user_id: followingId }
        );

        if (incrementError) throw incrementError;

        const { error: incrementFollowingError } = await supabase.rpc(
            "increment_following",
            { user_id: followerId }
        );

        if (incrementFollowingError) throw incrementFollowingError;

        // Award points to follower
        await incrementUserPoints(followerId, "eligibility_points", 25);

        return true;
    } catch (error) {
        console.error("Error following user:", error);
        return false;
    }
}

// Upload file to Supabase Storage
export async function uploadFile(bucket, path, file) {
    try {
        // First, check if the bucket exists
        const { data: buckets, error: listError } =
            await supabase.storage.listBuckets();

        if (listError) {
            console.error("Error listing buckets:", listError);
            throw new Error("Failed to access storage");
        }

        // Check if our bucket exists
        const bucketExists = buckets.some((b) => b.name === bucket);

        if (!bucketExists) {
            console.log(
                `Bucket '${bucket}' doesn't exist, attempting to create it...`
            );

            // Try to create the bucket
            const { error: createError } = await supabase.storage.createBucket(
                bucket,
                {
                    public: true,
                    allowedMimeTypes: ["image/*"],
                    fileSizeLimit: 5242880, // 5MB
                }
            );

            if (createError) {
                console.error("Error creating bucket:", createError);
                throw new Error(
                    `Storage bucket '${bucket}' not accessible. Please contact support.`
                );
            }
        }

        // Upload the file
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, file, {
                cacheControl: "3600",
                upsert: false,
            });

        if (error) {
            console.error("Upload error:", error);
            throw error;
        }

        console.log("File uploaded successfully:", data);
        return data;
    } catch (error) {
        console.error("Upload file error:", error);
        throw error;
    }
}

// Get public URL for uploaded file
export function getFileUrl(bucket, path) {
    try {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);

        if (!data.publicUrl) {
            throw new Error("Failed to generate public URL");
        }

        console.log("Generated public URL:", data.publicUrl);
        return data.publicUrl;
    } catch (error) {
        console.error("Error getting file URL:", error);
        throw error;
    }
}

export function getFinalSubmissionPublicUrl(filePath) {
  if (!filePath) return null;
  const { data } = supabase.storage
    .from("final-submissions")
    .getPublicUrl(filePath);
  return data?.publicUrl ?? null;
}

export async function hasFinalSubmissions(jobRequestId) {
  if (!jobRequestId) return false;
  const { data, error } = await supabase
    .from("job_final_submissions")
    .select("id", { count: "exact", head: true })
    .eq("job_request_id", jobRequestId);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function getJobRequestById(jobRequestId) {
  if (!jobRequestId) return null;
  const { data, error } = await supabase
    .from("job_requests")
    .select("id, job_type, client_id, assigned_apprentice_id, status")
    .eq("id", jobRequestId)
    .single();
  if (error) {
    console.error("Error fetching job request:", error);
    return null;
  }
  return data;
}

// Check if storage bucket exists and is accessible
export async function checkStorageBucket(bucketName) {
    try {
        console.log(`🔍 Checking bucket '${bucketName}'...`);

        // First check if the bucket exists by listing all buckets
        const { data: buckets, error: listError } =
            await supabase.storage.listBuckets();

        if (listError) {
            console.error(`❌ Error listing buckets:`, listError);
            return false;
        }

        console.log(
            `📦 Available buckets:`,
            buckets.map((b) => b.name)
        );

        // Check if our specific bucket exists
        const bucketExists = buckets.some((b) => b.name === bucketName);

        if (!bucketExists) {
            console.log(
                `❌ Bucket '${bucketName}' does not exist in available buckets`
            );
            return false;
        }

        console.log(`✅ Bucket '${bucketName}' exists in bucket list`);

        // Now test if we can access the bucket by trying to list files
        try {
            const { data, error } = await supabase.storage
                .from(bucketName)
                .list("", { limit: 1 });

            if (error) {
                console.error(
                    `❌ Bucket '${bucketName}' access failed:`,
                    error
                );
                return false;
            }

            console.log(
                `✅ Bucket '${bucketName}' is accessible and can list files`
            );
            return true;
        } catch (accessError) {
            console.error(
                `❌ Error accessing bucket '${bucketName}':`,
                accessError
            );
            return false;
        }
    } catch (error) {
        console.error(
            `❌ Unexpected error checking bucket '${bucketName}':`,
            error
        );
        return false;
    }
}

// --- Job Request System Functions ---

// Create a new job request
export async function createJobRequest(userId, jobData) {
    try {
        // Check subscription plan and monthly job limit for free plan users
        const userProfile = await getUserProfile(userId);
        const subscriptionPlan = userProfile?.subscription_plan || "free";
        
        if (subscriptionPlan === "free") {
            // Get the start and end of current month
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            
            // Count jobs created this month by this user
            const { data: monthlyJobs, error: countError } = await supabase
                .from("job_requests")
                .select("id", { count: "exact", head: false })
                .eq("client_id", userId)
                .gte("created_at", startOfMonth.toISOString())
                .lte("created_at", endOfMonth.toISOString());
            
            if (countError) {
                console.error("Error counting monthly jobs:", countError);
                // Don't block job creation if count fails, but log it
            } else {
                const jobCount = monthlyJobs?.length || 0;
                if (jobCount >= 3) {
                    throw new Error(
                        "Free plan members can post up to 3 jobs per month. " +
                        "You have reached your monthly limit. " +
                        "Upgrade to Creative plan to post unlimited jobs."
                    );
                }
            }
        }
        
        // Get user wallet to check balance
        const wallet = await getUserWallet(userId);
        if (!wallet) {
            throw new Error("Wallet not found. Please contact support.");
        }

        // Calculate escrow amount (use fixed_price as the escrow amount)
        const escrowAmount = jobData.fixedPrice;
        
        // Validate fixed price range
        if (escrowAmount < 3000) {
            throw new Error("Fixed price must be at least ₦3,000");
        }
        if (escrowAmount > 50000) {
            throw new Error("Fixed price cannot exceed ₦50,000");
        }
        const currentBalance = wallet.balance_ngn || 0;

        // Check if wallet has sufficient funds
        if (currentBalance < escrowAmount) {
            throw new Error(
                `Insufficient funds. Required: ₦${escrowAmount.toLocaleString()}, Available: ₦${currentBalance.toLocaleString()}`
            );
        }

        // Deduct escrow amount from wallet
        const newBalance = currentBalance - escrowAmount;
        const { error: walletUpdateError } = await supabase
            .from("user_wallets")
            .update({
                balance_ngn: newBalance,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

        if (walletUpdateError) {
            throw new Error("Failed to deduct funds from wallet: " + walletUpdateError.message);
        }

        // Create wallet transaction for escrow hold
        const { error: transactionError } = await supabase
            .from("wallet_transactions")
            .insert({
                user_id: userId,
                transaction_type: "escrow_hold",
                amount_ngn: -escrowAmount,
                amount_points: 0,
                description: `Escrow hold for job: ${jobData.title}`,
                reference: `JOB-ESCROW-${Date.now()}`,
                status: "completed",
                metadata: {
                    job_title: jobData.title,
                    escrow_type: "job_request"
                }
            });

        if (transactionError) {
            console.warn("Failed to create wallet transaction:", transactionError);
            // Don't fail the job creation if transaction logging fails
        }

        // Create job request with escrow amount
        const { data, error } = await supabase
            .from("job_requests")
            .insert({
                client_id: userId,
                title: jobData.title,
                description: jobData.description,
                fixed_price: escrowAmount,
                budget_min: escrowAmount, // Set to fixed_price for backwards compatibility
                budget_max: escrowAmount, // Set to fixed_price for backwards compatibility
                escrow_amount: escrowAmount,
                skills_required: jobData.skillsRequired,
                location: jobData.location,
                deadline: jobData.deadline,
                status: "open",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            // If job creation fails, refund the wallet
            await supabase
                .from("user_wallets")
                .update({
                    balance_ngn: currentBalance,
                    updated_at: new Date().toISOString(),
                })
                .eq("user_id", userId);
            throw error;
        }

        try {
            await broadcastJobAlertsForRequest(data);
        } catch (notificationError) {
            console.warn(
                "Failed to broadcast job alerts for new request:",
                notificationError
            );
        }

        return data;
    } catch (error) {
        console.error("Error creating job request:", error);
        throw error;
    }
}

async function broadcastJobAlertsForRequest(jobRecord) {
    try {
        if (!jobRecord?.id) {
            return;
        }

        const rawSkills =
            (Array.isArray(jobRecord.skills_required) &&
                jobRecord.skills_required) ||
            (Array.isArray(jobRecord.skillsRequired) &&
                jobRecord.skillsRequired) ||
            [];

        const normalizedSkills = rawSkills
            .map((skill) =>
                typeof skill === "string" ? skill.trim().toLowerCase() : ""
            )
            .filter(Boolean);

        if (!normalizedSkills.length) {
            console.info(
                "Job created without skills_required; skipping job alert broadcast."
            );
            return;
        }

        let query = supabase
            .from("profiles")
            .select("id, skill, creative_type")
            .eq("role", "apprentice");

        const orFilters = normalizedSkills
            .map((skill) => {
                const sanitized = skill.replace(/[^a-z0-9\s-]/gi, "");
                if (!sanitized) {
                    return null;
                }
                return [
                    `skill.ilike.%${sanitized}%`,
                    `creative_type.ilike.%${sanitized}%`,
                ];
            })
            .filter(Boolean)
            .flat();

        if (orFilters.length) {
            query = query.or(orFilters.join(","));
        }

        query = query.limit(200);

        const { data: apprentices, error } = await query;

        if (error) {
            console.warn(
                "Failed to load apprentices for job alert broadcast:",
                error
            );
            return;
        }

        if (!apprentices || !apprentices.length) {
            console.info(
                "No apprentices matched job skills; skipping alert broadcast."
            );
            return;
        }

        const summarySource =
            jobRecord.description || jobRecord.summary || "";
        const summary =
            summarySource.length > 200
                ? `${summarySource.slice(0, 197)}...`
                : summarySource;

        const recipients = apprentices.slice(0, 50);

        for (const apprentice of recipients) {
            try {
                await notifyJobAlert({
                    userId: apprentice.id,
                    jobId: jobRecord.id,
                    jobTitle: jobRecord.title,
                    summary,
                    skillsMatch: rawSkills,
                });
            } catch (notificationError) {
                console.warn(
                    "Failed to send job alert notification:",
                    notificationError
                );
            }
        }
    } catch (error) {
        console.warn("Job alert broadcast failed:", error);
    }
}

// Get all job requests (for apprentices to browse)
export async function getAllJobRequests(filters = {}, currentUserId = null) {
    // Safe ENV getter for browser compatibility
    const ENV = (typeof window !== "undefined" && window.ENV) ? window.ENV : {};
    const NODE_ENV =
        (typeof window !== "undefined" && window.ENV && window.ENV.NODE_ENV) ? window.ENV.NODE_ENV : "production";

    // Defensive guard for Supabase configuration
    if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
        console.error("Supabase ENV missing. Ensure env.js is loaded before supabase-auth.js");
        throw new Error("Supabase configuration missing");
    }

    try {
        // Query A: Get all open non-personal (public) jobs
        let publicJobsQuery = supabase
            .from("job_requests")
            .select(
                `
                *,
                client:profiles!job_requests_client_id_fkey(
                    id,
                    name,
                    email,
                    creative_type,
                    location
                )
            `
            )
            .eq("status", "open")
            .neq("job_type", "personal");

        // Query B: Get open personal jobs only where current user is the assigned apprentice
        let personalJobsQuery = null;
        if (currentUserId) {
            personalJobsQuery = supabase
                .from("job_requests")
                .select(
                    `
                    *,
                    client:profiles!job_requests_client_id_fkey(
                        id,
                        name,
                        email,
                        creative_type,
                        location
                    )
                `
                )
                .eq("status", "open")
                .eq("job_type", "personal")
                .eq("assigned_apprentice_id", currentUserId);
        }

        // Execute queries in parallel
        const [publicJobsResult, personalJobsResult] = await Promise.all([
            publicJobsQuery,
            personalJobsQuery || Promise.resolve({ data: [], error: null })
        ]);

        if (publicJobsResult.error) throw publicJobsResult.error;
        if (personalJobsResult.error) throw personalJobsResult.error;

        // Merge results
        let allJobs = [...publicJobsResult.data];

        if (personalJobsResult.data && personalJobsResult.data.length > 0) {
            allJobs = [...allJobs, ...personalJobsResult.data];
        }

        // Remove duplicates by id (shouldn't happen but safety check)
        const uniqueJobs = allJobs.filter((job, index, self) =>
            index === self.findIndex(j => j.id === job.id)
        );

        // Sort by created_at desc
        uniqueJobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Apply filters to merged results
        let filteredJobs = uniqueJobs;

        if (filters.skillsRequired) {
            filteredJobs = filteredJobs.filter(job =>
                job.skills_required && job.skills_required.includes(filters.skillsRequired)
            );
        }
        if (filters.location) {
            filteredJobs = filteredJobs.filter(job =>
                job.location && job.location.toLowerCase().includes(filters.location.toLowerCase())
            );
        }
        // Filter by fixed price range (for backward compatibility, also check budget_max)
        if (filters.budgetMin) {
            filteredJobs = filteredJobs.filter(job => {
                const price = job.fixed_price || job.budget_max || 0;
                return price >= filters.budgetMin;
            });
        }
        if (filters.budgetMax) {
            filteredJobs = filteredJobs.filter(job => {
                const price = job.fixed_price || job.budget_max || 0;
                return price <= filters.budgetMax;
            });
        }

        // Debug logging (only in development)
        if (NODE_ENV === 'development' || (typeof window !== "undefined" && window.location.hostname === 'localhost')) {
            console.log('[JOB REQUESTS DEBUG]', {
                totalJobs: filteredJobs.length,
                publicJobsCount: publicJobsResult.data.length,
                personalJobsCount: personalJobsResult.data ? personalJobsResult.data.length : 0,
                personalJobsForUser: personalJobsResult.data ? personalJobsResult.data.filter(job => job.assigned_apprentice_id === currentUserId).length : 0,
                currentUserId
            });
        }

        return filteredJobs;
    } catch (error) {
        console.error("Error fetching job requests:", error);
        throw error;
    }
}

// Get job requests created by a specific client
export async function getClientJobRequests(clientId) {
    try {
        const { data, error } = await supabase
            .from("job_requests")
            .select(
                `
                *,
                applications:job_applications(
                    id,
                    status,
                    created_at,
                    cv_url,
                    proposal,
                    apprentice:profiles!job_applications_apprentice_id_fkey(
                        id,
                        name,
                        username,
                        email,
                        phone,
                        avatar_url,
                        bio,
                        skill,
                        skill_category,
                        sub_skills,
                        location,
                        years_of_experience,
                        portfolio_links,
                        education,
                        certifications,
                        preferred_job_type,
                        availability,
                        resume_url,
                        created_at
                    )
                )
            `
            )
            .eq("client_id", clientId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching client job requests:", error);
        throw error;
    }
}

// Get job applications for an apprentice
export async function getApprenticeJobApplications(apprenticeId) {
    try {
        const { data, error } = await supabase
            .from("job_applications")
            .select(
                `
                *,
                job_request:job_requests(
                    id,
                    title,
                    description,
                    fixed_price,
                    budget_min,
                    budget_max,
                    deadline,
                    status,
                    client:profiles!job_requests_client_id_fkey(
                        id,
                        name,
                        business_name,
                        email,
                        phone,
                        logo_url,
                        creative_type,
                        industry,
                        business_description,
                        description,
                        business_location,
                        location,
                        services_offered,
                        website_social_links,
                        project_categories,
                        budget_min,
                        budget_max,
                        created_at
                    )
                )
            `
            )
            .eq("apprentice_id", apprenticeId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching apprentice applications:", error);
        throw error;
    }
}

// Apply for a job
export async function applyForJob(apprenticeId, jobRequestId, proposal, cvUrl = null) {
    try {
        const { data: jobRequest, error: jobError } = await supabase
            .from("job_requests")
            .select("id, title, client_id")
            .eq("id", jobRequestId)
            .single();

        if (jobError || !jobRequest) {
            throw new Error("Job request not found");
        }

        // Check if already applied
        const { data: existingApplication } = await supabase
            .from("job_applications")
            .select("id")
            .eq("apprentice_id", apprenticeId)
            .eq("job_request_id", jobRequestId)
            .single();

        if (existingApplication) {
            throw new Error("You have already applied for this job");
        }

        // CV is required
        if (!cvUrl) {
            throw new Error("CV is required to apply for jobs");
        }

        const { data, error } = await supabase
            .from("job_applications")
            .insert({
                apprentice_id: apprenticeId,
                job_request_id: jobRequestId,
                proposal: proposal,
                cv_url: cvUrl,
                status: "pending",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;
        try {
            const { data: apprentice } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", apprenticeId)
                .single();

            await notifyJobApplicationSubmitted({
                clientId: jobRequest.client_id,
                jobId: jobRequest.id,
                jobTitle: jobRequest.title,
                apprenticeName: apprentice?.name || "An apprentice",
            });
        } catch (notificationError) {
            console.warn(
                "Failed to send job application notification:",
                notificationError
            );
        }

        return data;
    } catch (error) {
        console.error("Error applying for job:", error);
        throw error;
    }
}

// Accept or reject a job application
export async function updateApplicationStatus(applicationId, status, clientId) {
    try {
        // Verify the client owns the job request
        const { data: application, error: fetchError } = await supabase
            .from("job_applications")
            .select(
                `
                *,
                job_request:job_requests!inner(
                    client_id,
                    title,
                    client:profiles!job_requests_client_id_fkey(
                        id,
                        name
                    )
                )
            `
            )
            .eq("id", applicationId)
            .eq("job_request.client_id", clientId)
            .single();

        if (fetchError || !application) {
            throw new Error("Application not found or unauthorized");
        }

        const { data, error } = await supabase
            .from("job_applications")
            .update({
                status: status,
                updated_at: new Date().toISOString(),
            })
            .eq("id", applicationId)
            .select()
            .single();

        if (error) throw error;

        // If accepted, update job request status to "in_progress"
        if (status === "accepted") {
            await supabase
                .from("job_requests")
                .update({
                    status: "in_progress",
                    assigned_apprentice_id: application.apprentice_id,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", application.job_request_id);
        }

        try {
            await notifyJobApplicationStatus({
                apprenticeId: application.apprentice_id,
                jobTitle: application.job_request?.title || "a job",
                status,
                clientName: application.job_request?.client?.name || null,
            });
        } catch (notificationError) {
            console.warn(
                "Failed to send job status notification:",
                notificationError
            );
        }

        return data;
    } catch (error) {
        console.error("Error updating application status:", error);
        throw error;
    }
}

// Update job progress
export async function updateJobProgress(jobRequestId, progress, apprenticeId) {
    try {
        // Verify the apprentice is assigned to this job
        const { data: job, error: fetchError } = await supabase
            .from("job_requests")
            .select("assigned_apprentice_id")
            .eq("id", jobRequestId)
            .eq("assigned_apprentice_id", apprenticeId)
            .single();

        if (fetchError || !job) {
            throw new Error("Job not found or unauthorized");
        }

        const { data, error } = await supabase
            .from("job_requests")
            .update({
                progress: progress,
                updated_at: new Date().toISOString(),
            })
            .eq("id", jobRequestId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error updating job progress:", error);
        throw error;
    }
}

// Complete a job
export async function completeJob(jobRequestId, apprenticeId) {
    try {
        // Verify the apprentice is assigned to this job
        const { data: job, error: fetchError } = await supabase
            .from("job_requests")
            .select("assigned_apprentice_id, fixed_price, budget_min, budget_max")
            .eq("id", jobRequestId)
            .eq("assigned_apprentice_id", apprenticeId)
            .single();

        if (fetchError || !job) {
            throw new Error("Job not found or unauthorized");
        }

        const { data, error } = await supabase
            .from("job_requests")
            .update({
                status: "pending_review",
                completed_at: new Date().toISOString(),
                review_submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", jobRequestId)
            .select()
            .single();

        if (error) throw error;

        return { ...data, message: "Job submitted for review" };
    } catch (error) {
        console.error("Error completing job:", error);
        throw error;
    }
}

// Get apprentice statistics
export async function getApprenticeStats(apprenticeId) {
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select(
                `
                total_earnings,
                completed_jobs,
                pending_jobs:job_applications(count),
                active_jobs:job_requests(count)
            `
            )
            .eq("id", apprenticeId)
            .single();

        if (error) throw error;

        // Get pending applications count
        const { count: pendingApplications } = await supabase
            .from("job_applications")
            .select("*", { count: "exact", head: true })
            .eq("apprentice_id", apprenticeId)
            .eq("status", "pending");

        // Get active jobs count
        const { count: activeJobs } = await supabase
            .from("job_requests")
            .select("*", { count: "exact", head: true })
            .eq("assigned_apprentice_id", apprenticeId)
            .eq("status", "in_progress");

        // Get pending review jobs count
        const { count: pendingReviewJobs } = await supabase
            .from("job_requests")
            .select("*", { count: "exact", head: true })
            .eq("assigned_apprentice_id", apprenticeId)
            .eq("status", "pending_review");

        return {
            totalEarned: data.total_earnings || 0,
            completedJobs: data.completed_jobs || 0,
            pendingJobs: pendingApplications || 0,
            pendingApplications: pendingApplications || 0,
            activeJobs: activeJobs || 0,
            pendingReviewJobs: pendingReviewJobs || 0,
        };
    } catch (error) {
        console.error("Error fetching apprentice stats:", error);
        throw error;
    }
}

// Get client statistics
export async function getClientStats(clientId) {
    try {
        const { data, error } = await supabase
            .from("job_requests")
            .select("*")
            .eq("client_id", clientId);

        if (error) throw error;

        const stats = {
            totalJobs: data.length,
            openJobs: data.filter((job) => job.status === "open").length,
            inProgressJobs: data.filter((job) => job.status === "in_progress")
                .length,
            pendingReviewJobs: data.filter(
                (job) => job.status === "pending_review"
            ).length,
            completedJobs: data.filter((job) => job.status === "completed")
                .length,
            totalSpent: data
                .filter((job) => job.status === "completed")
                .reduce(
                    (sum, job) =>
                        sum + (job.fixed_price || job.budget_max || (job.budget_min && job.budget_max ? Math.round((job.budget_min + job.budget_max) / 2) : 0)),
                    0
                ),
        };

        return stats;
    } catch (error) {
        console.error("Error fetching client stats:", error);
        throw error;
    }
}

// Generic profile card stats helper used by compact profile cards
export async function fetchProfileCardStats(profileId, role) {
    try {
        if (!profileId || !role) {
            console.warn("fetchProfileCardStats called without profileId or role");
            return {};
        }

        if (role === "apprentice") {
            // Fetch apprentice stats and rating details in parallel
            const [apprenticeStats, ratingDetails] = await Promise.all([
                getApprenticeStats(profileId),
                getApprenticeRatingDetails(profileId),
            ]);

            return {
                completed_jobs:
                    (apprenticeStats && apprenticeStats.completed_jobs) || 0,
                average_rating:
                    (ratingDetails && ratingDetails.average_rating) || 0,
            };
        }

        if (role === "member") {
            // Count completed hires for member/client
            const { count, error } = await supabase
                .from("job_requests")
                .select("*", { count: "exact", head: true })
                .eq("client_id", profileId)
                .eq("status", "completed");

            if (error) {
                throw error;
            }

            return {
                completed_hires: count || 0,
            };
        }

        // Unknown role – return empty stats gracefully
        return {};
    } catch (error) {
        console.error("Error fetching profile card stats:", error);
        return {};
    }
}

// Get jobs pending review for a client
export async function getJobsPendingReview(clientId) {
    try {
        const { data, error } = await supabase
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
            .eq("client_id", clientId)
            .eq("status", "pending_review")
            .order("review_submitted_at", { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching jobs pending review:", error);
        throw error;
    }
}

// Review and approve/reject a completed job
export async function reviewJob(jobRequestId, approved, reviewNotes, clientId) {
    try {
        // Verify the client owns the job request and get escrow amount
        const { data: job, error: fetchError } = await supabase
            .from("job_requests")
            .select("assigned_apprentice_id, fixed_price, budget_min, budget_max, client_id, escrow_amount, title, status")
            .eq("id", jobRequestId)
            .eq("client_id", clientId)
            .eq("status", "pending_review")
            .single();

        if (fetchError || !job) {
            throw new Error("Job not found or unauthorized");
        }

        // Get escrow amount (use escrow_amount if available, otherwise use fixed_price or budget_max)
        const escrowAmount = job.escrow_amount || job.fixed_price || job.budget_max || (job.budget_min && job.budget_max ? Math.round((job.budget_min + job.budget_max) / 2) : 0);

        const updateData = {
            review_approved: approved,
            review_notes: reviewNotes,
            updated_at: new Date().toISOString(),
        };

        if (approved) {
            // Safety check: Prevent double payment by checking if payment was already made.
            // Some databases may not have a `status` column on `wallet_transactions`,
            // so we only check by reference and (optionally) transaction_type.
            const paymentReference = `JOB-PAYMENT-${jobRequestId}`;
            const { data: existingPayments, error: paymentCheckError } = await supabase
                .from("wallet_transactions")
                .select("id")
                .eq("reference", paymentReference)
                .eq("transaction_type", "escrow_release")
                .limit(1);

            if (paymentCheckError) {
                throw new Error("Failed to check existing payment: " + paymentCheckError.message);
            }

            const paymentAlreadyProcessed =
                Array.isArray(existingPayments) && existingPayments.length > 0;

            if (paymentAlreadyProcessed) {
                console.warn(`Payment already processed for job ${jobRequestId}. Skipping payment dispatch.`);
                // Still update the job status, but skip payment
                updateData.status = "completed";
                updateData.payment = escrowAmount;
            } else {
                // If approved, mark as completed and release payment to apprentice
                updateData.status = "completed";

                // Calculate payment (use escrow amount or average of min and max budget)
                const payment = escrowAmount;

                // First, update job status to completed (atomic operation)
                const { data: updatedJob, error: statusUpdateError } = await supabase
                    .from("job_requests")
                    .update({
                        status: "completed",
                        review_approved: approved,
                        review_notes: reviewNotes,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", jobRequestId)
                    .select()
                    .single();

                if (statusUpdateError) {
                    throw new Error("Failed to update job status: " + statusUpdateError.message);
                }

                // Only proceed with payment if status update was successful
                try {
                    // Get apprentice wallet
                    const apprenticeWallet = await getUserWallet(job.assigned_apprentice_id);
                    if (!apprenticeWallet) {
                        throw new Error("Apprentice wallet not found");
                    }

                    // Credit apprentice wallet
                    const newApprenticeBalance = (apprenticeWallet.balance_ngn || 0) + payment;
                    const { error: apprenticeWalletError } = await supabase
                        .from("user_wallets")
                        .update({
                            balance_ngn: newApprenticeBalance,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("user_id", job.assigned_apprentice_id);

                    if (apprenticeWalletError) {
                        throw new Error("Failed to credit apprentice wallet: " + apprenticeWalletError.message);
                    }

                    // Create wallet transaction for apprentice (escrow release)
                    const { error: apprenticeTransactionError } = await supabase
                        .from("wallet_transactions")
                        .insert({
                            user_id: job.assigned_apprentice_id,
                            transaction_type: "escrow_release",
                            amount_ngn: payment,
                            amount_points: 0,
                            description: `Payment released for completed job: ${job.title}`,
                            reference: paymentReference,
                            status: "completed",
                            metadata: {
                                job_request_id: jobRequestId,
                                job_title: job.title,
                                payment_type: "job_completion"
                            }
                        });

                    if (apprenticeTransactionError) {
                        throw new Error("Failed to create apprentice wallet transaction: " + apprenticeTransactionError.message);
                    }

                    // Add earnings to apprentice profile
                    const { data: currentProfile, error: profileError } = await supabase
                        .from("profiles")
                        .select("total_earnings, completed_jobs")
                        .eq("id", job.assigned_apprentice_id)
                        .single();

                    if (profileError) throw profileError;

                    const newTotalEarnings =
                        (currentProfile.total_earnings || 0) + payment;
                    const newCompletedJobs = (currentProfile.completed_jobs || 0) + 1;

                    await supabase
                        .from("profiles")
                        .update({
                            total_earnings: newTotalEarnings,
                            completed_jobs: newCompletedJobs,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", job.assigned_apprentice_id);

                    // Log successful payment dispatch
                    console.log(`Funds of ₦${payment.toLocaleString()} dispatched to Apprentice ID: ${job.assigned_apprentice_id} for Job ID: ${jobRequestId}`);

                    updateData.payment = payment;
                    return { ...updatedJob, approved, payment };
                } catch (paymentError) {
                    // If payment fails, revert job status back to pending_review
                    console.error("Payment failed, reverting job status:", paymentError);
                    await supabase
                        .from("job_requests")
                        .update({
                            status: "pending_review",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", jobRequestId);
                    throw new Error("Failed to dispatch funds to apprentice: " + paymentError.message);
                }
            }
        } else {
            // If rejected, refund escrow back to client and set status back to in_progress
            updateData.status = "in_progress";

            // Get client wallet
            const clientWallet = await getUserWallet(clientId);
            if (!clientWallet) {
                throw new Error("Client wallet not found");
            }

            // Refund escrow to client wallet
            const newClientBalance = (clientWallet.balance_ngn || 0) + escrowAmount;
            const { error: clientWalletError } = await supabase
                .from("user_wallets")
                .update({
                    balance_ngn: newClientBalance,
                    updated_at: new Date().toISOString(),
                })
                .eq("user_id", clientId);

            if (clientWalletError) {
                throw new Error("Failed to refund client wallet: " + clientWalletError.message);
            }

            // Create wallet transaction for client (escrow refund)
            const { error: clientTransactionError } = await supabase
                .from("wallet_transactions")
                .insert({
                    user_id: clientId,
                    transaction_type: "escrow_refund",
                    amount_ngn: escrowAmount,
                    amount_points: 0,
                    description: `Escrow refunded for rejected job: ${job.title}`,
                    reference: `JOB-REFUND-${jobRequestId}`,
                    status: "completed",
                    metadata: {
                        job_request_id: jobRequestId,
                        job_title: job.title,
                        refund_type: "job_rejection"
                    }
                });

            if (clientTransactionError) {
                console.warn("Failed to create client refund transaction:", clientTransactionError);
            }
        }

        // Update job status (for rejected case or if payment was already made)
        const { data, error } = await supabase
            .from("job_requests")
            .update(updateData)
            .eq("id", jobRequestId)
            .select()
            .single();

        if (error) throw error;

        return { ...data, approved, payment: updateData.payment };
    } catch (error) {
        console.error("Error reviewing job:", error);
        throw error;
    }
}

// --- Update & Feedback System Functions ---

// Submit a progress update for a job
export async function submitJobUpdate(jobRequestId, apprenticeId, updateData) {
    try {
        // Verify the apprentice is assigned to this job
        const { data: job, error: fetchError } = await supabase
            .from("job_requests")
            .select("assigned_apprentice_id, status")
            .eq("id", jobRequestId)
            .eq("assigned_apprentice_id", apprenticeId)
            .eq("status", "in_progress")
            .single();

        if (fetchError || !job) {
            throw new Error("Job not found or unauthorized");
        }

        // Get next version number
        const { data: versionData, error: versionError } = await supabase
            .rpc("get_next_version_number", { job_id: jobRequestId });

        if (versionError) throw versionError;

        const { data, error } = await supabase
            .from("job_updates")
            .insert({
                job_request_id: jobRequestId,
                apprentice_id: apprenticeId,
                title: updateData.title,
                description: updateData.description,
                update_type: updateData.updateType || "progress",
                version_number: versionData,
                file_urls: updateData.fileUrls || [],
                links: updateData.links || [],
                status: "pending_review",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error submitting job update:", error);
        throw error;
    }
}

// Get job updates for a specific job
export async function getJobUpdates(jobRequestId, userId) {
    try {
        const { data, error } = await supabase
            .from("job_updates")
            .select(`
                *,
                apprentice:profiles!job_updates_apprentice_id_fkey(
                    id,
                    name,
                    skill,
                    location
                ),
                feedback:job_feedback(
                    id,
                    feedback_type,
                    remarks,
                    created_at,
                    member:profiles!job_feedback_member_id_fkey(
                        id,
                        name
                    )
                )
            `)
            .eq("job_request_id", jobRequestId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching job updates:", error);
        throw error;
    }
}

// Submit feedback on a job update
export async function submitJobFeedback(jobUpdateId, memberId, feedbackData) {
    try {
        // Verify the member owns the job
        const { data: update, error: fetchError } = await supabase
            .from("job_updates")
            .select(`
                id,
                job_request:job_requests!inner(client_id)
            `)
            .eq("id", jobUpdateId)
            .eq("job_request.client_id", memberId)
            .single();

        if (fetchError || !update) {
            throw new Error("Update not found or unauthorized");
        }

        // Check if feedback already exists
        const { data: existingFeedback, error: checkError } = await supabase
            .from("job_feedback")
            .select("id")
            .eq("job_update_id", jobUpdateId)
            .eq("member_id", memberId)
            .single();

        let result;
        if (existingFeedback) {
            // Update existing feedback
            const { data, error } = await supabase
                .from("job_feedback")
                .update({
                    feedback_type: feedbackData.feedbackType,
                    remarks: feedbackData.remarks,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", existingFeedback.id)
                .select()
                .single();

            if (error) throw error;
            result = data;
        } else {
            // Create new feedback
            const { data, error } = await supabase
                .from("job_feedback")
                .insert({
                    job_update_id: jobUpdateId,
                    member_id: memberId,
                    feedback_type: feedbackData.feedbackType,
                    remarks: feedbackData.remarks,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (error) throw error;
            result = data;
        }

        // Update the job update status based on feedback
        let newStatus = "pending_review";
        if (feedbackData.feedbackType === "approve") {
            newStatus = "approved";
        } else if (feedbackData.feedbackType === "needs_changes") {
            newStatus = "needs_changes";
        }

        const { error: updateError } = await supabase
            .from("job_updates")
            .update({
                status: newStatus,
                updated_at: new Date().toISOString(),
            })
            .eq("id", jobUpdateId);

        if (updateError) throw updateError;

        return result;
    } catch (error) {
        console.error("Error submitting job feedback:", error);
        throw error;
    }
}

// Submit final work for a job - RPC ONLY
export async function submitFinalWork(jobRequestId, jobId, submissionData) {
    const normalizeUuid = (v) => {
      if (v === undefined || v === null) return null;
      if (typeof v !== "string") return null;
      const t = v.trim();
      if (!t || t === "undefined" || t === "null") return null;
      const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t);
      return ok ? t : null;
    };

    const jrId = normalizeUuid(jobRequestId);
    const jId  = normalizeUuid(jobId);

    if (!jrId && !jId) throw new Error("Missing/invalid jobRequestId or jobId");

    console.log("[RPC SUBMIT] submitFinalWork called", {
        jobRequestId,
        jobId,
        submissionData
    });

    const { data, error } = await supabase.rpc(
        "submit_final_work_v2",  // ← CHANGED: New function name
        {
            p_job_request_id: jrId,
            p_job_id: jId,  // ← ADDED: Support for normal jobs
            p_title: submissionData.title ?? null,
            p_description: submissionData.description ?? null,
            p_file_urls: submissionData.fileUrls ?? [],
            p_links: submissionData.links ?? []
        }
    );

    if (error) {
        console.error("RPC submit_final_work_v2 failed:", error);
        throw error;
    }

    // Handle new response format
    if (data && data.success === false) {
        throw new Error(data.error || "Submission failed");
    }

    console.log("[RPC SUBMIT] success:", data);
    return data;
}

// Review final submission (approve/reject/request revision)
export async function reviewFinalSubmission(submissionId, memberId, reviewData) {
    try {
        // Verify the member owns the job
        const { data: submission, error: fetchError } = await supabase
            .from("job_final_submissions")
            .select(`
                id,
                job_request:job_requests!inner(client_id)
            `)
            .eq("id", submissionId)
            .eq("job_request.client_id", memberId)
            .single();

        if (fetchError || !submission) {
            throw new Error("Submission not found or unauthorized");
        }

        const { data, error } = await supabase
            .from("job_final_submissions")
            .update({
                status: reviewData.status,
                review_notes: reviewData.reviewNotes,
                reviewed_by: memberId,
                reviewed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", submissionId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error reviewing final submission:", error);
        throw error;
    }
}


// Get updates pending review for a member
export async function getUpdatesPendingReview(memberId) {
    try {
        const { data, error } = await supabase
            .from("job_updates")
            .select(`
                *,
                job_request:job_requests!inner(
                    id,
                    title,
                    client_id
                ),
                apprentice:profiles!job_updates_apprentice_id_fkey(
                    id,
                    name,
                    skill,
                    location
                )
            `)
            .eq("job_request.client_id", memberId)
            .eq("status", "pending_review")
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching updates pending review:", error);
        throw error;
    }
}

// Get final submissions pending review for a member
export async function getFinalSubmissionsPendingReview(memberId) {
    try {
        const { data, error } = await supabase
            .from("job_final_submissions")
            .select(`
                *,
                job_request:job_requests!inner(
                    id,
                    title,
                    client_id
                ),
                apprentice:profiles!job_final_submissions_apprentice_id_fkey(
                    id,
                    name,
                    skill,
                    location
                )
            `)
            .eq("job_request.client_id", memberId)
            .eq("status", "pending_review")
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching final submissions pending review:", error);
        throw error;
    }
}

// Auto-acknowledge updates (to be called by a scheduled job)
export async function autoAcknowledgeUpdates() {
    try {
        const { data, error } = await supabase.rpc("auto_acknowledge_updates");
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error auto-acknowledging updates:", error);
        throw error;
    }
}

// --- Progress Updates & Feedback System Functions ---

// Submit a progress update
export async function submitProgressUpdate(jobRequestId, apprenticeId, updateData) {
    try {
        // Get next version number
        const { data: versionData, error: versionError } = await supabase
            .rpc('get_next_version_number', { job_id: jobRequestId });
        
        if (versionError) throw versionError;

        const { data, error } = await supabase
            .from('progress_updates')
            .insert({
                job_request_id: jobRequestId,
                apprentice_id: apprenticeId,
                version_number: versionData,
                title: updateData.title,
                description: updateData.description,
                file_url: updateData.fileUrl,
                file_type: updateData.fileType,
                link_url: updateData.linkUrl,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error submitting progress update:", error);
        throw error;
    }
}


// Submit feedback on a progress update
export async function submitProgressUpdateFeedback(progressUpdateId, memberId, feedbackData) {
    try {
        const { data, error } = await supabase
            .from('update_feedback')
            .insert({
                progress_update_id: progressUpdateId,
                member_id: memberId,
                feedback_type: feedbackData.feedbackType,
                remarks: feedbackData.remarks
            })
            .select()
            .single();

        if (error) throw error;

        // Update the progress update status based on feedback
        // Only update status if it's not a remark
        if (feedbackData.feedbackType !== 'remark') {
            let newStatus = 'acknowledged';
            if (feedbackData.feedbackType === 'approve') {
                newStatus = 'approved';
            } else if (feedbackData.feedbackType === 'needs_changes') {
                newStatus = 'needs_changes';
            }

            await supabase
                .from('progress_updates')
                .update({ 
                    status: newStatus,
                    acknowledged_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', progressUpdateId);
        } else {
            // For remarks, just update the updated_at timestamp
            await supabase
                .from('progress_updates')
                .update({ 
                    updated_at: new Date().toISOString()
                })
                .eq('id', progressUpdateId);
        }

        return data;
    } catch (error) {
        console.error("Error submitting progress update feedback:", error);
        throw error;
    }
}




// Get pending progress updates for a member
export async function getPendingProgressUpdates(memberId) {
    try {
        const { data, error } = await supabase
            .from('progress_updates')
            .select(`
                *,
                job_request:job_requests!inner(
                    id,
                    title,
                    client_id
                ),
                apprentice:profiles!progress_updates_apprentice_id_fkey(
                    id,
                    name,
                    skill
                )
            `)
            .eq('job_request.client_id', memberId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching pending progress updates:", error);
        throw error;
    }
}

// Get pending final submissions for a member
export async function getPendingFinalSubmissions(memberId) {
    try {
        const { data, error } = await supabase
            .from('job_final_submissions')
            .select(`
                *,
                job_request:job_requests!inner(
                    id,
                    title,
                    client_id
                ),
                apprentice:profiles!job_final_submissions_apprentice_id_fkey(
                    id,
                    name,
                    skill
                )
            `)
            .eq('job_request.client_id', memberId)
            .eq('status', 'pending_review')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching pending final submissions:", error);
        throw error;
    }
}

// Auto-acknowledge progress updates (to be called by a scheduled job)
export async function autoAcknowledgeProgressUpdates() {
    try {
        const { data, error } = await supabase.rpc("auto_acknowledge_progress_updates");
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error auto-acknowledging progress updates:", error);
        throw error;
    }
}

// --- Progress Updates & Feedback System Functions ---


// Get progress updates for a job
export async function getProgressUpdates(jobRequestId, userRole, userId) {
    try {
        let query = supabase
            .from("progress_updates")
            .select(`
                *,
                apprentice:profiles!progress_updates_apprentice_id_fkey(
                    id,
                    name,
                    skill,
                    location
                ),
                feedback:update_feedback(
                    *,
                    member:profiles!update_feedback_member_id_fkey(
                        id,
                        name,
                        skill
                    )
                )
            `)
            .eq("job_request_id", jobRequestId)
            .order("version_number", { ascending: true });

        // Apply RLS based on user role
        if (userRole === "apprentice") {
            query = query.eq("apprentice_id", userId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Convert storage paths to signed URLs
        const updatesWithUrls = await Promise.all((data || []).map(async (update) => {
            if (update.file_url) {
                // Check if it's already a full URL
                if (update.file_url.startsWith('http')) {
                    return update;
                }

                // Convert storage path to signed URL
                const { data: signedUrl } = await supabase.storage
                    .from('progress-files')  // Your bucket name
                    .createSignedUrl(update.file_url, 3600); // 1 hour expiry

                return {
                    ...update,
                    file_url: signedUrl?.signedUrl || update.file_url
                };
            }
            return update;
        }));

        return updatesWithUrls;
    } catch (error) {
        console.error("Error fetching progress updates:", error);
        throw error;
    }
}



// Get final submissions for a job
export async function getFinalSubmissions(jobRequestId, userRole, userId) {
    try {
        let query = supabase
            .from("job_final_submissions")
            .select(`
                *,
                apprentice:profiles!job_final_submissions_apprentice_id_fkey(
                    id,
                    name,
                    skill,
                    location
                ),
                feedback:job_final_submission_feedback(
                    *,
                    member:profiles!job_final_submission_feedback_member_id_fkey(
                        id,
                        name,
                        skill
                    )
                )
            `)
            .eq("job_request_id", jobRequestId)
            .order("created_at", { ascending: false });

        // Apply RLS based on user role
        if (userRole === "apprentice") {
            query = query.eq("apprentice_id", userId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching final submissions:", error);
        throw error;
    }
}

// Submit feedback on final submission
export async function submitFinalSubmissionFeedback(finalSubmissionId, memberId, feedbackData) {
    try {
        const { data, error } = await supabase
            .from("job_final_submission_feedback")
            .insert({
                job_final_submission_id: finalSubmissionId,
                member_id: memberId,
                feedback_type: feedbackData.feedbackType,
                remarks: feedbackData.remarks
            })
            .select()
            .single();

        if (error) throw error;

        // Update the final submission status based on feedback
        let newStatus = "pending";
        if (feedbackData.feedbackType === "approve") {
            newStatus = "approved";
        } else if (feedbackData.feedbackType === "request_revision") {
            newStatus = "needs_revision";
        } else if (feedbackData.feedbackType === "dispute") {
            newStatus = "disputed";
        }

        // If approving, run payout first; only finalize submission/job status if payout succeeds.
        if (newStatus === "approved") {
            try {
                // Step 1: Get data (job_request_id, apprentice_id) from the submission
                const { data: submission, error: submissionError } = await supabase
                    .from("job_final_submissions")
                    .select("job_request_id, apprentice_id")
                    .eq("id", finalSubmissionId)
                    .single();

                if (submissionError || !submission) {
                    throw new Error("Failed to fetch submission details: " + (submissionError?.message || "Unknown error"));
                }

                const jobRequestId = submission.job_request_id;
                const apprenticeId = submission.apprentice_id;

                if (!jobRequestId) {
                    throw new Error("Missing job_request_id for this submission");
                }
                if (!apprenticeId) {
                    throw new Error("Missing apprentice_id for this submission");
                }

                // Step 2: Update submission status to "approved" BEFORE processing payout
                // This ensures the RPC function sees the correct status
                // If payout fails, we'll rollback this status update
                const { data: currentSubmission, error: fetchCurrentError } = await supabase
                    .from("job_final_submissions")
                    .select("status")
                    .eq("id", finalSubmissionId)
                    .single();

                const previousStatus = currentSubmission?.status || "pending_review";

                const { error: statusUpdateError } = await supabase
                    .from("job_final_submissions")
                    .update({
                        status: "approved",
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", finalSubmissionId);

                if (statusUpdateError) {
                    throw new Error(
                        "Failed to update submission status: " + statusUpdateError.message
                    );
                }

                // Step 3: Update job status to "completed" BEFORE processing payout
                // The payout RPC requires the job to be in "completed" status
                const { error: jobStatusError } = await supabase
                    .from("job_requests")
                    .update({
                        status: "completed",
                        completed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", jobRequestId)
                    .eq("status", "pending_review"); // Only update if currently pending_review

                if (jobStatusError) {
                    // Rollback submission status if job update failed
                    await supabase
                        .from("job_final_submissions")
                        .update({
                            status: previousStatus,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", finalSubmissionId);

                    throw new Error(
                        "Failed to update job status to completed: " + jobStatusError.message
                    );
                }

                // Step 4: Process payout using secure RPC function
                // This function validates ownership, prevents duplicates, and handles wallet updates atomically
                // It also fetches and validates job details internally, so we don't need to fetch them separately
                console.log("[FinalSubmission] Processing payout via RPC", {
                    finalSubmissionId,
                    jobRequestId,
                    apprenticeId,
                    payerId: memberId,
                });

                const { data: payoutResult, error: payoutError } = await supabase.rpc(
                    "process_job_payout",
                    {
                        p_final_submission_id: finalSubmissionId,
                        p_job_request_id: jobRequestId,
                        p_apprentice_id: apprenticeId,
                        p_payer_id: memberId,
                    }
                );

                if (payoutError) {
                    // Rollback submission status if payout failed
                    await supabase
                        .from("job_final_submissions")
                        .update({
                            status: previousStatus,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", finalSubmissionId);

                    // Extract meaningful error message
                    const errorMessage = payoutError.message || payoutError.details || "Unknown payout error";
                    console.error("[FinalSubmission] Payout RPC error:", {
                        code: payoutError.code,
                        message: errorMessage,
                        hint: payoutError.hint,
                        details: payoutError.details,
                    });
                    throw new Error(`Payout processing failed: ${errorMessage}`);
                }

                if (!payoutResult || !payoutResult.success) {
                    // Rollback submission status if payout was unsuccessful
                    await supabase
                        .from("job_final_submissions")
                        .update({
                            status: previousStatus,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", finalSubmissionId);

                    throw new Error(
                        payoutResult?.message || "Payout processing returned unsuccessful result"
                    );
                }

                // Log payout result
                if (payoutResult.skipped) {
                    console.warn(
                        `[FinalSubmission] Payout skipped - already processed. Transaction ID: ${payoutResult.existing_transaction_id}`
                    );
                } else {
                    console.log("[FinalSubmission] Payout processed successfully:", {
                        transactionId: payoutResult.transaction_id,
                        amount: payoutResult.amount_ngn,
                        previousBalance: payoutResult.previous_balance,
                        newBalance: payoutResult.new_balance,
                    });
                }

            } catch (paymentError) {
                // Critical: do not mark job/submission as approved/completed if payout failed.
                // The error message should be clear and actionable
                const errorDetails = paymentError?.message || String(paymentError);
                console.error("[FinalSubmission] Payout processing error:", {
                    error: paymentError,
                    finalSubmissionId,
                    memberId,
                });
                throw new Error(
                    `Approval saved, but payout failed. ${errorDetails} Please try again or contact support if the issue persists.`
                );
            }
        } else if (newStatus !== "pending") {
            // Non-approval status updates can proceed normally.
            await supabase
                .from("job_final_submissions")
                .update({
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", finalSubmissionId);
        }

        return data;
    } catch (error) {
        console.error("Error submitting final submission feedback:", error);
        throw error;
    }
}

// --- DISPUTE SYSTEM FUNCTIONS ---

// Submit a dispute for a job
export async function submitDispute(jobRequestId, userId, disputeData) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user || user.id !== userId) {
            throw new Error("User not authenticated");
        }

        // Get job details to determine member and apprentice
        const { data: job, error: jobError } = await supabase
            .from("job_requests")
            .select("id, client_id, assigned_apprentice_id, status")
            .eq("id", jobRequestId)
            .single();

        if (jobError || !job) {
            throw new Error("Job not found");
        }

        // Determine if user is member or apprentice
        const isMember = job.client_id === userId;
        const isApprentice = job.assigned_apprentice_id === userId;

        if (!isMember && !isApprentice) {
            throw new Error("You are not authorized to dispute this job");
        }

        // Get escrow amount if exists
        const { data: escrow } = await supabase
            .from("job_escrow")
            .select("amount_ngn")
            .eq("job_id", jobRequestId)
            .eq("status", "held")
            .single();

        // Upload evidence files if provided
        // Store file paths instead of URLs for private bucket compatibility
        let evidencePaths = [];
        if (disputeData.evidenceFiles && disputeData.evidenceFiles.length > 0) {
            for (const file of disputeData.evidenceFiles) {
                const fileExt = file.name.split('.').pop().toLowerCase();
                const fileName = `${userId}/disputes/${Date.now()}-${file.name}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('dispute-evidence')
                    .upload(fileName, file);

                if (uploadError) {
                    console.error('Error uploading evidence file:', uploadError);
                    continue;
                }

                // Store the file path (not URL) for private bucket
                // Format: dispute-evidence/{userId}/disputes/{filename}
                const filePath = `dispute-evidence/${fileName}`;
                evidencePaths.push(filePath);
            }
        }

        // Create dispute record
        const disputeRecord = {
            job_id: jobRequestId,
            member_id: isMember ? userId : job.client_id,
            apprentice_id: isApprentice ? userId : job.assigned_apprentice_id,
            raised_by: userId,
            type: disputeData.type || 'payment',
            status: 'open',
            description: disputeData.description || '',
            evidence: evidencePaths.length > 0 ? JSON.stringify(evidencePaths) : null,
            amount: escrow?.amount_ngn || 0,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from("disputes")
            .insert(disputeRecord)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error("Error submitting dispute:", error);
        throw error;
    }
}

// Get user's disputes
export async function getUserDisputes(userId) {
    try {
        const { data, error } = await supabase
            .from("disputes")
            .select(`
                *,
                job_requests (
                    id,
                    title,
                    description
                )
            `)
            .or(`member_id.eq.${userId},apprentice_id.eq.${userId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error getting user disputes:", error);
        throw error;
    }
}

// Get signed URL for dispute evidence file
// Handles both old format (full URLs) and new format (storage paths)
export async function getDisputeEvidenceSignedUrl(evidenceReference, expiresIn = 3600) {
    try {
        // If it's already a full URL (old format or external URL), return as-is
        if (evidenceReference && (evidenceReference.startsWith('http://') || evidenceReference.startsWith('https://'))) {
            return evidenceReference;
        }

        // If it's a storage path (new format: dispute-evidence/{userId}/disputes/{filename})
        if (evidenceReference && evidenceReference.startsWith('dispute-evidence/')) {
            const filePath = evidenceReference.replace('dispute-evidence/', '');
            const { data, error } = await supabase.storage
                .from('dispute-evidence')
                .createSignedUrl(filePath, expiresIn);

            if (error) {
                console.error('Error creating signed URL for dispute evidence:', error);
                throw new Error('Failed to generate file access URL. Please contact support.');
            }

            return data.signedUrl;
        }

        // If it's just a file path without the bucket prefix, try to use it directly
        if (evidenceReference) {
            const { data, error } = await supabase.storage
                .from('dispute-evidence')
                .createSignedUrl(evidenceReference, expiresIn);

            if (error) {
                console.error('Error creating signed URL for dispute evidence:', error);
                throw new Error('Failed to generate file access URL. Please contact support.');
            }

            return data.signedUrl;
        }

        throw new Error('Invalid evidence reference provided');
    } catch (error) {
        console.error('Error getting dispute evidence signed URL:', error);
        throw error;
    }
}

// Get all disputes for admin
export async function getAllDisputes() {
    try {
        // First, try with explicit foreign key (preferred method)
        let data, error;
        const query = supabase
            .from("disputes")
            .select(`
                *,
                job_requests (
                    id,
                    title,
                    description,
                    status
                ),
                member:profiles!disputes_member_id_fkey (
                    id,
                    email,
                    name
                ),
                apprentice:profiles!disputes_apprentice_id_fkey (
                    id,
                    email,
                    name
                ),
                raised_by_profile:profiles!disputes_raised_by_fkey (
                    id,
                    email,
                    name
                )
            `)
            .order('created_at', { ascending: false });

        const result = await query;
        data = result.data;
        error = result.error;

        // If foreign key error, fallback to alternative query method
        if (error && error.code === 'PGRST200' && error.message?.includes('disputes_raised_by_fkey')) {
            console.warn('Foreign key constraint missing, using alternative query method');
            
            // Use implicit foreign key syntax or fetch profiles separately
            const fallbackResult = await supabase
                .from("disputes")
                .select(`
                    *,
                    job_requests (
                        id,
                        title,
                        description,
                        status
                    ),
                    member:profiles!member_id (
                        id,
                        email,
                        name
                    ),
                    apprentice:profiles!apprentice_id (
                        id,
                        email,
                        name
                    ),
                    raised_by_profile:profiles!raised_by (
                        id,
                        email,
                        name
                    )
                `)
                .order('created_at', { ascending: false });

            if (fallbackResult.error) throw fallbackResult.error;
            return fallbackResult.data || [];
        }

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error getting all disputes:", error);
        throw error;
    }
}

// Update dispute status (admin only)
export async function updateDisputeStatus(disputeId, status, adminNotes = null, resolution = null) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error("User not authenticated");
        }

        // Check if user is admin
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile || profile.role !== 'admin') {
            throw new Error("Admin privileges required");
        }

        const updateData = {
            status: status,
            updated_at: new Date().toISOString()
        };

        if (adminNotes) {
            updateData.admin_notes = adminNotes;
        }

        if (resolution) {
            updateData.resolution = resolution;
        }

        if (status === 'resolved' || status === 'closed') {
            updateData.resolved_at = new Date().toISOString();
            updateData.resolved_by = user.id;
        }

        const { data, error } = await supabase
            .from("disputes")
            .update(updateData)
            .eq("id", disputeId)
            .select()
            .single();

        if (error) throw error;

        // If dispute is resolved, update job status if needed
        if (status === 'resolved' && resolution) {
            const { data: dispute } = await supabase
                .from("disputes")
                .select("job_id")
                .eq("id", disputeId)
                .single();

            if (dispute && dispute.job_id) {
                // Update job status based on resolution
                if (resolution === 'favor_member') {
                    // Refund escrow to member
                    const { data: escrow } = await supabase
                        .from("job_escrow")
                        .select("id")
                        .eq("job_id", dispute.job_id)
                        .eq("status", "held")
                        .single();

                    if (escrow) {
                        // Refund logic would go here - call refundEscrowFunds
                        // This is handled by the admin in the UI
                    }
                } else if (resolution === 'favor_apprentice') {
                    // Release escrow to apprentice
                    const { data: escrow } = await supabase
                        .from("job_escrow")
                        .select("id")
                        .eq("job_id", dispute.job_id)
                        .eq("status", "held")
                        .single();

                    if (escrow) {
                        // Release logic would go here - call releaseEscrowFunds
                        // This is handled by the admin in the UI
                    }
                }
            }
        }

        return data;
    } catch (error) {
        console.error("Error updating dispute status:", error);
        throw error;
    }
}

// --- RATING SYSTEM FUNCTIONS ---

// Submit a rating for an apprentice after job completion
export async function submitRating(jobRequestId, rating, comment, raterId) {
    try {
        // Validate rating
        if (rating < 1 || rating > 5) {
            throw new Error("Rating must be between 1 and 5 stars");
        }

        // Get job details to verify ownership and get apprentice ID
        const { data: job, error: jobError } = await supabase
            .from("job_requests")
            .select("assigned_apprentice_id, client_id, status")
            .eq("id", jobRequestId)
            .eq("client_id", raterId)
            .eq("status", "completed")
            .single();

        if (jobError || !job) {
            throw new Error("Job not found or unauthorized");
        }

        // Check if already rated
        const { data: existingRating } = await supabase
            .from("ratings")
            .select("id")
            .eq("job_request_id", jobRequestId)
            .eq("rater_id", raterId)
            .single();

        if (existingRating) {
            throw new Error("You have already rated this job");
        }

        // Insert rating
        const { data, error } = await supabase
            .from("ratings")
            .insert({
                job_request_id: jobRequestId,
                rater_id: raterId,
                ratee_id: job.assigned_apprentice_id,
                rating: rating,
                comment: comment || null
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error("Error submitting rating:", error);
        throw error;
    }
}

// Get apprentice rating details
export async function getApprenticeRatingDetails(apprenticeId) {
    try {
        console.log(`Fetching rating details for apprentice: ${apprenticeId}`);
        const { data, error } = await supabase
            .rpc('get_apprentice_rating_details', { apprentice_uuid: apprenticeId });

        if (error) {
            console.error("Database error getting apprentice rating details:", error);
            throw error;
        }

        console.log("Raw data from database:", data);
        
        const result = data[0] || {
            total_ratings: 0,
            average_rating: 0.00,
            ratings_5_star: 0,
            recent_ratings: []
        };
        
        console.log("Processed rating details:", result);
        return result;
    } catch (error) {
        console.error("Error getting apprentice rating details:", error);
        throw error;
    }
}

// Check if member can rate apprentice for a specific job
export async function canRateApprentice(jobRequestId, memberId) {
    try {
        const { data, error } = await supabase
            .rpc('can_rate_apprentice', { 
                job_uuid: jobRequestId, 
                member_uuid: memberId 
            });

        if (error) throw error;

        return data;
    } catch (error) {
        console.error("Error checking rating eligibility:", error);
        return false;
    }
}

// Get ratings for a specific job
export async function getJobRatings(jobRequestId) {
    try {
        const { data, error } = await supabase
            .from("ratings")
            .select(`
                *,
                rater:profiles!ratings_rater_id_fkey(
                    id,
                    name,
                    creative_type
                )
            `)
            .eq("job_request_id", jobRequestId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error("Error getting job ratings:", error);
        throw error;
    }
}

// Update an existing rating
export async function updateRating(ratingId, rating, comment, raterId) {
    try {
        // Validate rating
        if (rating < 1 || rating > 5) {
            throw new Error("Rating must be between 1 and 5 stars");
        }

        // Verify ownership
        const { data: existingRating, error: fetchError } = await supabase
            .from("ratings")
            .select("id")
            .eq("id", ratingId)
            .eq("rater_id", raterId)
            .single();

        if (fetchError || !existingRating) {
            throw new Error("Rating not found or unauthorized");
        }

        // Update rating
        const { data, error } = await supabase
            .from("ratings")
            .update({
                rating: rating,
                comment: comment || null,
                updated_at: new Date().toISOString()
            })
            .eq("id", ratingId)
            .select()
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error("Error updating rating:", error);
        throw error;
    }
}

// Delete a rating
export async function deleteRating(ratingId, raterId) {
    try {
        // Verify ownership
        const { data: existingRating, error: fetchError } = await supabase
            .from("ratings")
            .select("id")
            .eq("id", ratingId)
            .eq("rater_id", raterId)
            .single();

        if (fetchError || !existingRating) {
            throw new Error("Rating not found or unauthorized");
        }

        // Delete rating
        const { error } = await supabase
            .from("ratings")
            .delete()
            .eq("id", ratingId);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error("Error deleting rating:", error);
        throw error;
    }
}

// Delete job request
export async function deleteJobRequest(jobRequestId, clientId) {
    try {
        // ============================================
        // STEP 1: VALIDATE INPUTS
        // ============================================
        if (!jobRequestId) {
            throw new Error("Job request ID is required");
        }
        if (!clientId) {
            throw new Error("Client ID is required");
        }

        console.log(`[DELETE JOB] Starting deletion process`);
        console.log(`[DELETE JOB] Job ID: ${jobRequestId} (type: ${typeof jobRequestId})`);
        console.log(`[DELETE JOB] Client ID: ${clientId} (type: ${typeof clientId})`);
        
        // ============================================
        // STEP 2: FETCH JOB REQUEST AND VERIFY OWNERSHIP
        // ============================================
        const { data: jobRequest, error: fetchError } = await supabase
            .from('job_requests')
            .select('id, client_id, status, escrow_amount, title, assigned_apprentice_id')
            .eq('id', jobRequestId)
            .single();

        if (fetchError) {
            console.error("[DELETE JOB] Error fetching job request:", fetchError);
            console.error("[DELETE JOB] Fetch error code:", fetchError.code);
            console.error("[DELETE JOB] Fetch error message:", fetchError.message);
            throw new Error("Job request not found");
        }

        if (!jobRequest) {
            console.error("[DELETE JOB] Job request not found in database");
            throw new Error("Job request not found");
        }

        console.log(`[DELETE JOB] Job found:`, {
            id: jobRequest.id,
            client_id: jobRequest.client_id,
            status: jobRequest.status,
            escrow_amount: jobRequest.escrow_amount,
            assigned_apprentice_id: jobRequest.assigned_apprentice_id
        });

        if (jobRequest.client_id !== clientId) {
            console.error(`[DELETE JOB] Ownership mismatch: Job client_id (${jobRequest.client_id}) !== provided clientId (${clientId})`);
            throw new Error("You can only delete your own job requests");
        }

        // Check if an apprentice has accepted the job
        if (jobRequest.assigned_apprentice_id) {
            throw new Error("Cannot delete job: An apprentice has already been assigned to this job");
        }

        // Check if job is in a state that allows deletion
        if (jobRequest.status === 'in_progress' || jobRequest.status === 'completed') {
            throw new Error("Cannot delete job that is in progress or completed");
        }

        // Store escrow amount from DB (server-side, secure) before deletion
        const escrowAmount = jobRequest.escrow_amount || 0;
        const jobTitle = jobRequest.title || 'Job Request';

        // ============================================
        // STEP 3: DELETE ALL DEPENDENCIES FIRST
        // ============================================
        console.log(`[DELETE JOB] Step 3: Deleting all dependent records...`);
        
        // 3.1: Delete job applications
        console.log(`[DELETE JOB] 3.1: Checking for job_applications...`);
        const { data: applications, error: appsError } = await supabase
            .from('job_applications')
            .select('id', { count: 'exact' })
            .eq('job_request_id', jobRequestId);

        if (appsError) {
            console.error("[DELETE JOB] Error checking applications:", appsError);
            throw new Error(`Failed to check related applications: ${appsError.message}`);
        }

        if (applications && applications.length > 0) {
            console.log(`[DELETE JOB] Found ${applications.length} job applications - deleting...`);
            const { count: deletedAppsCount, error: deleteAppsError } = await supabase
                .from('job_applications')
                .delete({ count: 'exact' })
                .eq('job_request_id', jobRequestId);
            
            if (deleteAppsError) {
                console.error("[DELETE JOB] Error deleting applications:", deleteAppsError);
                throw new Error(`Failed to delete related applications: ${deleteAppsError.message}`);
            }
            console.log(`[DELETE JOB] Successfully deleted ${deletedAppsCount || applications.length} job applications`);
        } else {
            console.log(`[DELETE JOB] No job applications found`);
        }

        // 3.2: Delete disputes related to this job
        console.log(`[DELETE JOB] 3.2: Checking for disputes...`);
        const { data: disputes, error: disputesError } = await supabase
            .from('disputes')
            .select('id', { count: 'exact' })
            .eq('job_request_id', jobRequestId);

        if (disputesError) {
            console.warn("[DELETE JOB] Error checking disputes (table may not exist):", disputesError);
            // Don't throw - disputes table might not exist
        } else if (disputes && disputes.length > 0) {
            console.log(`[DELETE JOB] Found ${disputes.length} disputes - deleting...`);
            const { count: deletedDisputesCount, error: deleteDisputesError } = await supabase
                .from('disputes')
                .delete({ count: 'exact' })
                .eq('job_request_id', jobRequestId);
            
            if (deleteDisputesError) {
                console.warn("[DELETE JOB] Error deleting disputes:", deleteDisputesError);
                // Don't throw - continue with deletion
            } else {
                console.log(`[DELETE JOB] Successfully deleted ${deletedDisputesCount || disputes.length} disputes`);
            }
        } else {
            console.log(`[DELETE JOB] No disputes found`);
        }

        // 3.3: Delete notifications that reference this job in metadata
        console.log(`[DELETE JOB] 3.3: Checking for notifications with job metadata...`);
        try {
            // Fetch all notifications and filter client-side for those referencing this job
            const { data: allNotifications, error: notifError } = await supabase
                .from('notifications')
                .select('id, metadata');
            
            if (notifError) {
                console.warn("[DELETE JOB] Error checking notifications:", notifError);
            } else if (allNotifications && allNotifications.length > 0) {
                // Filter notifications that reference this job in metadata
                const jobNotifications = allNotifications.filter(notif => {
                    const metadata = notif.metadata || {};
                    return metadata.jobId === jobRequestId || 
                           metadata.job_request_id === jobRequestId ||
                           metadata.jobId === String(jobRequestId) ||
                           metadata.job_request_id === String(jobRequestId);
                });
                
                if (jobNotifications.length > 0) {
                    console.log(`[DELETE JOB] Found ${jobNotifications.length} notifications referencing this job - deleting...`);
                    const notificationIds = jobNotifications.map(n => n.id);
                    const { count: deletedNotifCount, error: deleteNotifError } = await supabase
                        .from('notifications')
                        .delete({ count: 'exact' })
                        .in('id', notificationIds);
                    
                    if (deleteNotifError) {
                        console.warn("[DELETE JOB] Error deleting notifications:", deleteNotifError);
                    } else {
                        console.log(`[DELETE JOB] Successfully deleted ${deletedNotifCount || jobNotifications.length} notifications`);
                    }
                } else {
                    console.log(`[DELETE JOB] No notifications found referencing this job`);
                }
            } else {
                console.log(`[DELETE JOB] No notifications found`);
            }
        } catch (notifCheckError) {
            console.warn("[DELETE JOB] Could not check/delete notifications:", notifCheckError);
            // Continue - notifications are not critical
        }

        console.log(`[DELETE JOB] All dependencies deleted successfully`);

        // ============================================
        // STEP 4: VERIFY CURRENT USER CONTEXT
        // ============================================
        console.log(`[DELETE JOB] Step 4: Verifying current user context...`);
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
            console.error("[DELETE JOB] Error getting current user:", userError);
            throw new Error(`Authentication error: ${userError.message}`);
        }
        
        if (!currentUser) {
            console.error("[DELETE JOB] No current user found");
            throw new Error("Authentication required - no user session found");
        }
        
        console.log(`[DELETE JOB] Current user ID: ${currentUser.id}`);
        console.log(`[DELETE JOB] Client ID from parameter: ${clientId}`);
        console.log(`[DELETE JOB] User IDs match: ${currentUser.id === clientId}`);
        
        // Verify the current user matches the clientId
        if (currentUser.id !== clientId) {
            console.error(`[DELETE JOB] User ID mismatch: current user (${currentUser.id}) !== clientId (${clientId})`);
            throw new Error("You can only delete your own job requests");
        }

        // ============================================
        // STEP 5: VERIFY RLS ACCESS BEFORE DELETE
        // ============================================
        console.log(`[DELETE JOB] Step 5: Verifying RLS access to job...`);
        
        // Try to select the job with current user context to verify RLS allows access
        const { data: rlsCheck, error: rlsError } = await supabase
            .from('job_requests')
            .select('id, client_id, status, assigned_apprentice_id')
            .eq('id', jobRequestId)
            .eq('client_id', currentUser.id)
            .maybeSingle();
        
        if (rlsError) {
            console.error("[DELETE JOB] RLS check error:", rlsError);
            console.warn("[DELETE JOB] RLS check failed, but continuing with delete attempt...");
        } else if (!rlsCheck) {
            console.error("[DELETE JOB] RLS check: Job not accessible with current user context");
            console.error("[DELETE JOB] This may indicate an RLS policy issue");
            // Don't throw yet - try the delete and see what happens
        } else {
            console.log(`[DELETE JOB] ✓ RLS check passed - job is accessible`);
            console.log(`[DELETE JOB] RLS check result:`, rlsCheck);
        }

        // ============================================
        // STEP 6: DELETE JOB REQUEST (HARD DELETE)
        // ============================================
        console.log(`[DELETE JOB] Step 6: Attempting hard delete from job_requests table...`);
        console.log(`[DELETE JOB] Delete query: .eq('id', '${jobRequestId}').eq('client_id', '${clientId}')`);
        
        // Use currentUser.id instead of clientId parameter to ensure we're using the authenticated user
        let { count: deletedCount, data: deletedRows, error: deleteError } = await supabase
            .from('job_requests')
            .delete({ count: 'exact' })
            .eq('id', jobRequestId)
            .eq('client_id', currentUser.id)  // Use authenticated user ID
            .select('id');

        console.log(`[DELETE JOB] Delete operation completed (with client_id check)`);
        console.log(`[DELETE JOB] Deleted count: ${deletedCount}`);
        console.log(`[DELETE JOB] Deleted rows:`, deletedRows);
        console.log(`[DELETE JOB] Delete error:`, deleteError);

        // If delete returned 0 rows, try with just ID (RLS should still enforce ownership)
        if (!deleteError && (deletedCount === 0 || (!deletedRows || deletedRows.length === 0))) {
            console.warn(`[DELETE JOB] Delete with client_id check returned 0 rows, trying with ID only...`);
            console.warn(`[DELETE JOB] This may indicate an RLS policy issue - checking if job still exists...`);
            
            // Verify job still exists
            const { data: stillExists, error: existsError } = await supabase
                .from('job_requests')
                .select('id, client_id, status')
                .eq('id', jobRequestId)
                .maybeSingle();
            
            if (stillExists) {
                console.error(`[DELETE JOB] Job still exists after delete attempt:`, stillExists);
                console.error(`[DELETE JOB] Job client_id: ${stillExists.client_id}, Current user: ${currentUser.id}`);
                console.error(`[DELETE JOB] This indicates RLS DELETE policy may be missing or incorrect`);
            }
            
            // Try delete with just ID - RLS policy should enforce ownership
            const { count: deletedCount2, data: deletedRows2, error: deleteError2 } = await supabase
                .from('job_requests')
                .delete({ count: 'exact' })
                .eq('id', jobRequestId)
                .select('id');
            
            console.log(`[DELETE JOB] Delete operation (ID only) completed`);
            console.log(`[DELETE JOB] Deleted count: ${deletedCount2}`);
            console.log(`[DELETE JOB] Deleted rows:`, deletedRows2);
            console.log(`[DELETE JOB] Delete error:`, deleteError2);
            
            // Use the second attempt's results
            deletedCount = deletedCount2;
            deletedRows = deletedRows2;
            deleteError = deleteError2;
        }

        if (deleteError) {
            console.error("[DELETE JOB] Delete error details:", JSON.stringify(deleteError, null, 2));
            console.error("[DELETE JOB] Delete error code:", deleteError.code);
            console.error("[DELETE JOB] Delete error message:", deleteError.message);
            console.error("[DELETE JOB] Delete error hint:", deleteError.hint);
            console.error("[DELETE JOB] Delete error details:", deleteError.details);
            
            // Check if it's an RLS policy error
            if (deleteError.code === '42501' || deleteError.message?.includes('permission') || deleteError.message?.includes('policy')) {
                throw new Error(`Permission denied: Row Level Security policy may be blocking deletion. Please check RLS policies for job_requests table.`);
            }
            
            throw new Error(`Failed to delete job request: ${deleteError.message || deleteError.code || 'Unknown error'}`);
        }

        // ============================================
        // STEP 6: CONFIRM DELETION - EXACTLY 1 ROW
        // ============================================
        if (deletedCount === null || deletedCount === undefined) {
            console.warn(`[DELETE JOB] Delete count is null/undefined - verifying manually...`);
            
            // Fallback: Check if rows were returned
            if (!deletedRows || deletedRows.length === 0) {
                // Verify the job still exists
                const { data: verifyStillExists, error: verifyError } = await supabase
                    .from('job_requests')
                    .select('id')
                    .eq('id', jobRequestId)
                    .maybeSingle();
                
                if (verifyStillExists) {
                    console.error(`[DELETE JOB] CRITICAL: Delete returned 0 rows but job still exists!`);
                    console.error(`[DELETE JOB] This is likely an RLS (Row Level Security) policy issue.`);
                    console.error(`[DELETE JOB] Please run the SQL script: supabase/fix-job-requests-delete-policy.sql`);
                    throw new Error("Delete operation failed - job still exists in database. This is likely due to a missing RLS DELETE policy. Please run the SQL script: supabase/fix-job-requests-delete-policy.sql");
                }
                
                console.log("[DELETE JOB] Job was already deleted or not found");
                return { success: true, alreadyDeleted: true, deleted: false };
            }
            
            // Use row count as fallback
            if (deletedRows.length !== 1) {
                throw new Error(`Unexpected deletion result: ${deletedRows.length} rows deleted (expected 1)`);
            }
            
            console.log(`[DELETE JOB] Deletion confirmed by row count: ${deletedRows.length} row(s) deleted`);
        } else if (deletedCount !== 1) {
            if (deletedCount === 0) {
                // Verify the job still exists
                const { data: verifyStillExists, error: verifyError } = await supabase
                    .from('job_requests')
                    .select('id')
                    .eq('id', jobRequestId)
                    .maybeSingle();
                
                if (verifyStillExists) {
                    console.error(`[DELETE JOB] CRITICAL: Delete returned 0 rows but job still exists!`);
                    console.error(`[DELETE JOB] This is likely an RLS (Row Level Security) policy issue.`);
                    console.error(`[DELETE JOB] Please run the SQL script: supabase/fix-job-requests-delete-policy.sql`);
                    throw new Error("Delete operation failed - job still exists in database. This is likely due to a missing RLS DELETE policy. Please run the SQL script: supabase/fix-job-requests-delete-policy.sql");
                }
                
                console.log("[DELETE JOB] Job was already deleted or not found");
                return { success: true, alreadyDeleted: true, deleted: false };
            } else {
                throw new Error(`Unexpected deletion result: ${deletedCount} rows deleted (expected exactly 1)`);
            }
        }

        console.log(`[DELETE JOB] ✓ Confirmed: Exactly 1 row deleted (count: ${deletedCount || deletedRows?.length || 0})`);

        // ============================================
        // STEP 7: VERIFY DELETION (FINAL CHECK)
        // ============================================
        console.log(`[DELETE JOB] Step 6: Final verification - checking if job still exists...`);
        await new Promise(resolve => setTimeout(resolve, 100)); // Brief wait for DB consistency
        
        const { data: verifyDeleted, error: verifyError } = await supabase
            .from('job_requests')
            .select('id')
            .eq('id', jobRequestId)
            .maybeSingle();
        
        if (verifyDeleted) {
            console.error(`[DELETE JOB] CRITICAL: Delete confirmed but job still exists in database!`);
            console.error(`[DELETE JOB] Verification query returned:`, verifyDeleted);
            console.error(`[DELETE JOB] This is likely an RLS (Row Level Security) policy issue.`);
            console.error(`[DELETE JOB] Please run the SQL script: supabase/fix-job-requests-delete-policy.sql`);
            throw new Error("Delete operation failed - job still exists after deletion. This is likely due to a missing RLS DELETE policy. Please run the SQL script: supabase/fix-job-requests-delete-policy.sql");
        }
        
        if (verifyError && verifyError.code !== 'PGRST116') {
            console.warn("[DELETE JOB] Verification query error (may be expected):", verifyError);
        }
        
        console.log(`[DELETE JOB] ✓ Final verification passed - job no longer exists in database`);

        // ============================================
        // STEP 8: PROCESS REFUND (ONLY ON SUCCESS)
        // ============================================
        // Refund is ONLY executed here, inside the success block
        // This ensures no refund happens if deletion failed
        console.log(`[DELETE JOB] Step 7: Processing refund for escrow amount: ${escrowAmount}`);
        await processRefund(clientId, escrowAmount, jobRequestId, jobTitle);

        console.log("[DELETE JOB] ✓ Job request deleted successfully and refund processed");
        return { success: true, deleted: true, refunded: escrowAmount > 0 };
    } catch (error) {
        console.error("[DELETE JOB] ✗ Error in deleteJobRequest:", error);
        console.error("[DELETE JOB] Error stack:", error.stack);
        // NO REFUND ON ERROR - state remains consistent
        throw error;
    }
}


// ============================================
// HELPER FUNCTION: PROCESS REFUND
// ============================================
async function processRefund(clientId, escrowAmount, jobRequestId, jobTitle) {
    if (escrowAmount <= 0) {
        console.log(`[REFUND] No refund needed (escrow amount: ${escrowAmount})`);
        return;
    }

    try {
        const clientWallet = await getUserWallet(clientId);
        if (!clientWallet) {
            console.warn("[REFUND] Client wallet not found for refund");
            throw new Error("Client wallet not found for refund");
        }

        console.log(`[REFUND] Current wallet balance: ${clientWallet.balance_ngn}`);
        console.log(`[REFUND] Refund amount: ${escrowAmount}`);
        
        // Refund escrow to client wallet
        const newClientBalance = (clientWallet.balance_ngn || 0) + escrowAmount;
        console.log(`[REFUND] New wallet balance will be: ${newClientBalance}`);
        
        const { error: clientWalletError } = await supabase
            .from("user_wallets")
            .update({
                balance_ngn: newClientBalance,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", clientId);

        if (clientWalletError) {
            console.error("[REFUND] Failed to update wallet:", clientWalletError);
            throw new Error(`Failed to refund escrow: ${clientWalletError.message || clientWalletError.code || 'Unknown error'}`);
        }

        console.log(`[REFUND] Wallet updated successfully`);

        // Create wallet transaction for escrow refund
        const { error: refundTransactionError } = await supabase
            .from("wallet_transactions")
            .insert({
                user_id: clientId,
                transaction_type: "escrow_refund",
                amount_ngn: escrowAmount,
                amount_points: 0,
                description: `Escrow refunded for deleted job: ${jobTitle}`,
                reference: `JOB-DELETE-${jobRequestId}-${Date.now()}`,
                status: "completed",
                metadata: {
                    job_request_id: jobRequestId,
                    job_title: jobTitle,
                    refund_type: "job_deletion"
                }
            });

        if (refundTransactionError) {
            console.warn("[REFUND] Failed to create refund transaction:", refundTransactionError);
            // Don't throw - wallet was updated, transaction log is secondary
        } else {
            console.log(`[REFUND] Refund transaction logged successfully`);
        }
    } catch (error) {
        console.error("[REFUND] Error processing refund:", error);
        throw error;
    }
}

// ==============================================
// REFERRAL WALLET SYSTEM FUNCTIONS
// ==============================================

// Get user's referral wallet
export async function getReferralWallet(userId) {
    try {
        const { data: wallet, error } = await supabase
            .from('referral_wallets')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        // If no wallet exists, create one
        if (!wallet) {
            const { data: newWallet, error: createError } = await supabase
                .from('referral_wallets')
                .insert({ user_id: userId })
                .select('*')
                .single();

            if (createError) throw createError;
            return newWallet;
        }

        return wallet;
    } catch (error) {
        console.error("Error getting referral wallet:", error);
        // Return default wallet object instead of throwing to prevent UI breakage
        return {
            user_id: userId,
            available_points: 0,
            locked_points: 0,
            total_points: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }
}

// Get user's referral earnings
export async function getReferralEarnings(userId, limit = 50) {
    try {
        const { data: earnings, error } = await supabase
            .from('referral_earnings')
            .select(`
                *,
                referrer:profiles!referral_earnings_referrer_id_fkey(
                    id, username, full_name, avatar_url
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return earnings || [];
    } catch (error) {
        console.error("Error getting referral earnings:", error);
        // Return empty array instead of throwing to prevent UI breakage
        return [];
    }
}

// Get user's referral transactions
export async function getReferralTransactions(userId, limit = 50) {
    try {
        const { data: transactions, error } = await supabase
            .from('referral_transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return transactions || [];
    } catch (error) {
        console.error("Error getting referral transactions:", error);
        throw error;
    }
}

// Award referral points for apprentice job completion
export async function awardApprenticeReferralPoints(apprenticeId, jobAmount, referrerId) {
    try {
        const { data, error } = await supabase.rpc('award_apprentice_referral_points', {
            apprentice_id: apprenticeId,
            job_amount: jobAmount,
            referrer_id: referrerId
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error awarding apprentice referral points:", error);
        throw error;
    }
}

// Award referral points for member subscription
export async function awardMemberReferralPoints(memberId, subscriptionFee, referrerId) {
    try {
        const { data, error } = await supabase.rpc('award_member_referral_points', {
            member_id: memberId,
            subscription_fee: subscriptionFee,
            referrer_id: referrerId
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error awarding member referral points:", error);
        throw error;
    }
}

// Unlock referral points for free members who subscribe
export async function unlockReferralPoints(userId) {
    try {
        const { data, error } = await supabase.rpc('unlock_referral_points', {
            user_uuid: userId
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error unlocking referral points:", error);
        throw error;
    }
}

// Check if withdrawal window is open
export async function isWithdrawalWindowOpen() {
    try {
        const { data, error } = await supabase.rpc('is_withdrawal_window_open');
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error checking withdrawal window:", error);
        // Return false instead of throwing to prevent UI breakage
        return false;
    }
}

// Create withdrawal request
export async function createWithdrawalRequest(userId, pointsRequested, payoutMethod, payoutDetails) {
    try {
        if (!userId) {
            throw new Error("Unable to create withdrawal request: missing user information.");
        }

        // Check if user has sufficient balance BEFORE creating the request
        const wallet = await getUserWallet(userId);
        if (!wallet) {
            throw new Error("Unable to retrieve your wallet. Please try again.");
        }

        // Get user's role to determine fee
        const { data: userProfile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (profileError) {
            console.warn('Could not fetch user profile for role check:', profileError);
        }

        // Calculate fee: 10% for apprentices, 0% for members
        const userRole = userProfile?.role || 'member';
        const withdrawalFeePercentage = userRole === 'apprentice' ? 0.10 : 0;
        const withdrawalFeePoints = userRole === 'apprentice' 
            ? Math.round(pointsRequested * withdrawalFeePercentage * 100) / 100  // Round to 2 decimal places
            : 0;
        const totalDeductionPoints = pointsRequested + withdrawalFeePoints;

        const availablePoints = wallet.balance_points ?? 0;
        if (availablePoints < totalDeductionPoints) {
            const feeMessage = withdrawalFeePoints > 0 
                ? `with the ${withdrawalFeePoints.toFixed(2)} point fee (10%)` 
                : `with no fee`;
            throw new Error(
                `Insufficient points balance. You requested ${pointsRequested} points, but ${feeMessage}, you need ${totalDeductionPoints.toFixed(2)} points total. You have ${availablePoints.toFixed(2)} pts available.`
            );
        }

        // Always try the RPC first (bypasses RLS if it exists)
        try {
            const { data, error } = await supabase.rpc('create_withdrawal_request', {
                user_uuid: userId,
                points_requested: pointsRequested,
                payout_method: payoutMethod,
                payout_details: payoutDetails
            });

            if (error && error.code !== '42883') {
                // RPC exists but returned an error we need to surface
                throw error;
            }

            if (data && !error) {
                return data;
            }
        } catch (rpcError) {
            // If the RPC is missing (42883) or failed, fall back to direct insert
            console.warn('create_withdrawal_request RPC unavailable, falling back to direct insert:', rpcError);
        }
        const { ngn: amountNgn } = convertPointsToCurrency(pointsRequested);
        const { ngn: withdrawalFeeNgn } = convertPointsToCurrency(withdrawalFeePoints);
        const totalDeductionNgn = amountNgn + withdrawalFeeNgn;
        const supportsExtendedWithdrawalColumns = await withdrawalExtendedColumnsAvailable();

        const normalizedDetails = {
            ...(payoutDetails || {})
        };

        if (payoutMethod && !normalizedDetails.payout_method) {
            normalizedDetails.payout_method = payoutMethod;
        }

        const withdrawalInsertPayload = {
            user_id: userId,
            amount_points: pointsRequested,
            amount_ngn: amountNgn,
            bank_details: normalizedDetails,
            status: 'pending'
        };

        if (supportsExtendedWithdrawalColumns) {
            withdrawalInsertPayload.withdrawal_fee_points = withdrawalFeePoints;
            withdrawalInsertPayload.withdrawal_fee_ngn = withdrawalFeeNgn;
            withdrawalInsertPayload.total_deduction_points = totalDeductionPoints;
            withdrawalInsertPayload.total_deduction_ngn = totalDeductionNgn;
        }

        let newRequest;
        let insertError;

        ({ data: newRequest, error: insertError } = await supabase
            .from('wallet_withdrawal_requests')
            .insert(withdrawalInsertPayload)
            .select('*')
            .single());

        if (insertError) {
            if (referencesMissingWithdrawalExtendedColumns(insertError)) {
                console.warn('Extended withdrawal columns missing in schema, retrying without them.');
                const fallbackPayload = { ...withdrawalInsertPayload };
                delete fallbackPayload.withdrawal_fee_points;
                delete fallbackPayload.withdrawal_fee_ngn;
                delete fallbackPayload.total_deduction_points;
                delete fallbackPayload.total_deduction_ngn;

                ({ data: newRequest, error: insertError } = await supabase
                    .from('wallet_withdrawal_requests')
                    .insert(fallbackPayload)
                    .select('*')
                    .single());
            } else if (
                !supportsExtendedWithdrawalColumns &&
                referencesWithdrawalExtendedColumnsNotNull(insertError)
            ) {
                console.warn('Extended withdrawal columns enforced by schema, retrying with them.');
                withdrawalInsertPayload.withdrawal_fee_points = withdrawalFeePoints;
                withdrawalInsertPayload.withdrawal_fee_ngn = withdrawalFeeNgn;
                withdrawalInsertPayload.total_deduction_points = totalDeductionPoints;
                withdrawalInsertPayload.total_deduction_ngn = totalDeductionNgn;
                cachedWithdrawalExtendedColumnsAvailable = true;

                ({ data: newRequest, error: insertError } = await supabase
                    .from('wallet_withdrawal_requests')
                    .insert(withdrawalInsertPayload)
                    .select('*')
                    .single());
            }
        }

        if (insertError) {
            throw insertError;
        }

        return newRequest;
    } catch (error) {
        console.error("Error creating withdrawal request:", error);
        throw error;
    }
}

// Get user's withdrawal requests
export async function getWithdrawalRequests(userId) {
    try {
        const { data: requests, error } = await supabase
            .from('withdrawal_requests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return requests || [];
    } catch (error) {
        console.error("Error getting withdrawal requests:", error);
        // Return empty array instead of throwing to prevent UI breakage
        return [];
    }
}

// Get all withdrawal requests (admin only)
export async function getAllWithdrawalRequests(status = null) {
    try {
        let query = supabase
            .from('withdrawal_requests')
            .select(`
                *,
                user:profiles!withdrawal_requests_user_id_fkey(
                    id, username, full_name, email, avatar_url
                )
            `)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data: requests, error } = await query;

        if (error) throw error;
        return requests || [];
    } catch (error) {
        console.error("Error getting all withdrawal requests:", error);
        throw error;
    }
}

// Update withdrawal request status (admin only)
export async function updateWithdrawalRequestStatus(requestId, status, adminNotes = null) {
    try {
        const updateData = {
            status: status,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (adminNotes) {
            updateData.admin_notes = adminNotes;
        }

        const { data, error } = await supabase
            .from('withdrawal_requests')
            .update(updateData)
            .eq('id', requestId)
            .select('*')
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error updating withdrawal request status:", error);
        throw error;
    }
}

// Use referral points for subscription payment
export async function useReferralPointsForSubscription(userId, pointsToUse) {
    try {
        const { data, error } = await supabase.rpc('update_referral_wallet', {
            user_uuid: userId,
            points_amount: pointsToUse,
            transaction_type: 'used_subscription'
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error using referral points for subscription:", error);
        throw error;
    }
}

// Get referral statistics
export async function getReferralStats(userId) {
    try {
        const [wallet, earnings, transactions] = await Promise.all([
            getReferralWallet(userId),
            getReferralEarnings(userId, 100),
            getReferralTransactions(userId, 100)
        ]);

        const totalEarned = earnings.reduce((sum, earning) => sum + parseFloat(earning.points_earned), 0);
        const totalWithdrawn = transactions
            .filter(t => t.transaction_type === 'withdrawn')
            .reduce((sum, t) => sum + parseFloat(t.points_amount), 0);
        const totalUsed = transactions
            .filter(t => t.transaction_type === 'used_subscription')
            .reduce((sum, t) => sum + parseFloat(t.points_amount), 0);

        return {
            wallet,
            totalEarned,
            totalWithdrawn,
            totalUsed,
            recentEarnings: earnings.slice(0, 10),
            recentTransactions: transactions.slice(0, 10)
        };
    } catch (error) {
        console.error("Error getting referral stats:", error);
        throw error;
    }
}

// Check if user can refer (only members can refer)
export async function canUserRefer(userId) {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role, subscription_tier')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // Only members can refer (not apprentices)
        return profile.role === 'member';
    } catch (error) {
        console.error("Error checking if user can refer:", error);
        return false;
    }
}

// ==============================================
// PROFILE SETUP FUNCTIONS
// ==============================================

// Check if user profile is completed
export async function isProfileCompleted(userId) {
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("profile_completed, role")
            .eq("id", userId)
            .single();

        if (error) throw error;
        return data?.profile_completed === true;
    } catch (error) {
        console.error("Error checking profile completion:", error);
        return false;
    }
}

// Upload avatar/profile picture
export async function uploadAvatar(userId, file) {
    try {
        if (!file) {
            throw new Error("No file provided");
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error("Invalid file type. Please upload JPG, PNG, GIF, or WEBP files only.");
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error("File size too large. Please upload files smaller than 5MB.");
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `avatar-${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        // Upload file to Supabase storage
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true // Allow overwriting existing avatar
            });

        if (error) {
            console.error("Avatar upload error:", error);
            throw new Error(`Failed to upload avatar: ${error.message}`);
        }

        // Get public URL
        const avatarUrl = getFileUrl('avatars', filePath);
        return avatarUrl;
    } catch (error) {
        console.error("Error uploading avatar:", error);
        throw error;
    }
}

// Upload business logo
export async function uploadLogo(userId, file) {
    try {
        if (!file) {
            throw new Error("No file provided");
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error("Invalid file type. Please upload JPG, PNG, GIF, or WEBP files only.");
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error("File size too large. Please upload files smaller than 5MB.");
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        // Upload file to Supabase storage
        const { data, error } = await supabase.storage
            .from('logos')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true // Allow overwriting existing logo
            });

        if (error) {
            console.error("Logo upload error:", error);
            throw new Error(`Failed to upload logo: ${error.message}`);
        }

        // Get public URL
        const logoUrl = getFileUrl('logos', filePath);
        return logoUrl;
    } catch (error) {
        console.error("Error uploading logo:", error);
        throw error;
    }
}

// Upload certification document
export async function uploadCertification(userId, file) {
    try {
        if (!file) {
            throw new Error("No file provided");
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error("Invalid file type. Please upload PDF, JPG, or PNG files only.");
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error("File size too large. Please upload files smaller than 10MB.");
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `certification-${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        // Upload file to Supabase storage
        const { data, error } = await supabase.storage
            .from('certifications')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error("Certification upload error:", error);
            throw new Error(`Failed to upload certification: ${error.message}`);
        }

        // Get signed URL (since certifications bucket is private)
        const { data: urlData } = await supabase.storage
            .from('certifications')
            .createSignedUrl(filePath, 31536000); // 1 year expiry

        if (!urlData?.signedUrl) {
            throw new Error("Failed to generate certification URL");
        }

        return urlData.signedUrl;
    } catch (error) {
        console.error("Error uploading certification:", error);
        throw error;
    }
}

// Save apprentice profile
export async function saveApprenticeProfile(userId, profileData) {
    try {
        // Validate required fields
        const requiredFields = ['name', 'username', 'email', 'phone', 'bio', 'skill_category', 'years_of_experience', 'preferred_job_type', 'availability'];
        const missingFields = requiredFields.filter(field => !profileData[field]);

        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Prepare update data
        const updateData = {
            name: profileData.name,
            username: profileData.username,
            email: profileData.email,
            phone: profileData.phone,
            bio: profileData.bio,
            skill_category: profileData.skill_category,
            sub_skills: profileData.sub_skills || [],
            years_of_experience: parseInt(profileData.years_of_experience) || 0,
            portfolio_links: profileData.portfolio_links || [],
            education: profileData.education || '',
            certifications: profileData.certifications || '',
            preferred_job_type: profileData.preferred_job_type,
            availability: profileData.availability,
            profile_completed: true,
            profile_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Add optional fields if provided
        if (profileData.avatar_url) {
            updateData.avatar_url = profileData.avatar_url;
        }
        if (profileData.certifications_url) {
            updateData.certifications_url = profileData.certifications_url;
        }
        if (profileData.resume_url) {
            updateData.resume_url = profileData.resume_url;
        }

        // Update profile
        const { data, error } = await supabase
            .from("profiles")
            .update(updateData)
            .eq("id", userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error saving apprentice profile:", error);
        throw error;
    }
}

// Save member profile
export async function saveMemberProfile(userId, profileData) {
    try {
        // Validate required fields
        const requiredFields = ['business_name', 'email', 'phone', 'business_description', 'industry', 'business_location'];
        const missingFields = requiredFields.filter(field => !profileData[field]);

        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Prepare update data
        const updateData = {
            name: profileData.business_name, // Also update name field
            business_name: profileData.business_name,
            email: profileData.email,
            phone: profileData.phone,
            business_description: profileData.business_description,
            industry: profileData.industry,
            services_offered: profileData.services_offered || [],
            business_location: profileData.business_location,
            website_social_links: profileData.website_social_links || [],
            project_categories: profileData.project_categories || [],
            profile_completed: true,
            profile_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Add optional fields if provided
        if (profileData.logo_url) {
            updateData.logo_url = profileData.logo_url;
        }
        if (profileData.budget_min !== undefined && profileData.budget_min !== null) {
            updateData.budget_min = parseFloat(profileData.budget_min);
        }
        if (profileData.budget_max !== undefined && profileData.budget_max !== null) {
            updateData.budget_max = parseFloat(profileData.budget_max);
        }

        // Update profile
        const { data, error } = await supabase
            .from("profiles")
            .update(updateData)
            .eq("id", userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error saving member profile:", error);
        throw error;
    }
}

// Get referral commission percentage based on subscription tier
export function getReferralCommissionPercentage(subscriptionTier) {
    switch (subscriptionTier) {
        case 'creative':
            return 10;
        default:
            return 0;
    }
}

// Convert points to USD and NGN
export function convertPointsToCurrency(points) {
    const usd = points / 10; // 10 pts = $1
    const ngn = usd * 1500; // $1 = ₦1500
    return { usd, ngn };
}

// Convert USD to points
export function convertUsdToPoints(usd) {
    return usd * 10; // $1 = 10 pts
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

        if (error && referencesMissingWithdrawalExtendedColumns(error)) {
            cachedWithdrawalExtendedColumnsAvailable = false;
            return false;
        }

        cachedWithdrawalExtendedColumnsAvailable = true;
        return true;
    } catch (error) {
        console.warn('Unable to verify withdrawal fee columns, assuming unavailable.', error);
        cachedWithdrawalExtendedColumnsAvailable = false;
        return false;
    }
}

// ==================== ADMIN USER MANAGEMENT FUNCTIONS ====================

// Get all users with their statistics and activities (for admin)
export async function getAllUsersWithStats(role = null, limit = 100, offset = 0, search = '') {
    try {
        let query = supabase
            .from('profiles')
            .select('*');

        if (role) {
            query = query.eq('role', role);
        }

        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
        }

        const { data: profiles, error } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        // Get stats and wallets for each user
        const profilesWithStats = await Promise.all(
            (profiles || []).map(async (profile) => {
                const stats = await getUserActivityStats(profile.id, profile.role);
                
                // Get wallet separately
                const { data: walletData } = await supabase
                    .from('user_wallets')
                    .select('*')
                    .eq('user_id', profile.id)
                    .single();
                
                return {
                    ...profile,
                    stats,
                    wallet: walletData ? [walletData] : null
                };
            })
        );

        // Get total count
        let countQuery = supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        if (role) {
            countQuery = countQuery.eq('role', role);
        }

        if (search) {
            countQuery = countQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
        }

        const { count, error: countError } = await countQuery;

        if (countError) throw countError;

        return {
            users: profilesWithStats,
            total: count || 0
        };
    } catch (error) {
        console.error('Error fetching users with stats:', error);
        throw error;
    }
}

// Get user activity statistics
export async function getUserActivityStats(userId, role) {
    try {
        const stats = {
            totalJobs: 0,
            activeJobs: 0,
            completedJobs: 0,
            totalApplications: 0,
            pendingApplications: 0,
            totalEarnings: 0,
            totalSpent: 0,
            walletBalance: 0,
            lastActivity: null
        };

        if (role === 'apprentice') {
            // Get job applications
            const { count: totalApps, error: appsError } = await supabase
                .from('job_applications')
                .select('*', { count: 'exact', head: true })
                .eq('apprentice_id', userId);

            if (!appsError) {
                stats.totalApplications = totalApps || 0;

                const { count: pendingApps } = await supabase
                    .from('job_applications')
                    .select('*', { count: 'exact', head: true })
                    .eq('apprentice_id', userId)
                    .eq('status', 'pending');

                stats.pendingApplications = pendingApps || 0;
            }

            // Get jobs assigned
            const { data: assignedJobs, error: jobsError } = await supabase
                .from('job_requests')
                .select('id, status, created_at, updated_at')
                .eq('assigned_apprentice_id', userId);

            if (!jobsError && assignedJobs) {
                stats.totalJobs = assignedJobs.length;
                stats.activeJobs = assignedJobs.filter(j => j.status === 'in_progress').length;
                stats.completedJobs = assignedJobs.filter(j => j.status === 'completed').length;

                // Get last activity
                const lastJobUpdate = assignedJobs
                    .map(j => j.updated_at || j.created_at)
                    .sort()
                    .reverse()[0];
                if (lastJobUpdate) {
                    stats.lastActivity = lastJobUpdate;
                }
            }

            // Get earnings from profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('total_earnings')
                .eq('id', userId)
                .single();

            if (profile) {
                stats.totalEarnings = profile.total_earnings || 0;
            }
        } else if (role === 'member') {
            // Get jobs created
            const { data: createdJobs, error: jobsError } = await supabase
                .from('job_requests')
                .select('id, status, created_at, updated_at')
                .eq('client_id', userId);

            if (!jobsError && createdJobs) {
                stats.totalJobs = createdJobs.length;
                stats.activeJobs = createdJobs.filter(j => j.status === 'in_progress').length;
                stats.completedJobs = createdJobs.filter(j => j.status === 'completed').length;

                // Get last activity
                const lastJobUpdate = createdJobs
                    .map(j => j.updated_at || j.created_at)
                    .sort()
                    .reverse()[0];
                if (lastJobUpdate) {
                    stats.lastActivity = lastJobUpdate;
                }
            }

            // Get total spent (from funding requests)
            const { data: fundingRequests } = await supabase
                .from('funding_requests')
                .select('amount_ngn, status')
                .eq('user_id', userId)
                .eq('status', 'approved');

            if (fundingRequests) {
                stats.totalSpent = fundingRequests.reduce((sum, req) => sum + (req.amount_ngn || 0), 0);
            }
        }

        // Get wallet balance
        const { data: wallet } = await supabase
            .from('user_wallets')
            .select('balance_ngn, balance_points')
            .eq('user_id', userId)
            .single();

        if (wallet) {
            stats.walletBalance = wallet.balance_ngn || 0;
        }

        return stats;
    } catch (error) {
        console.error('Error fetching user activity stats:', error);
        return {
            totalJobs: 0,
            activeJobs: 0,
            completedJobs: 0,
            totalApplications: 0,
            pendingApplications: 0,
            totalEarnings: 0,
            totalSpent: 0,
            walletBalance: 0,
            lastActivity: null
        };
    }
}

// Get user activities (recent actions)
export async function getUserActivities(userId, limit = 50) {
    try {
        const activities = [];

        // Get job activities
        const { data: jobs } = await supabase
            .from('job_requests')
            .select('id, title, status, created_at, updated_at, client_id, assigned_apprentice_id')
            .or(`client_id.eq.${userId},assigned_apprentice_id.eq.${userId}`)
            .order('updated_at', { ascending: false })
            .limit(20);

        if (jobs) {
            jobs.forEach(job => {
                activities.push({
                    id: `job-${job.id}`,
                    type: 'job',
                    action: job.client_id === userId ? 'created_job' : 'assigned_job',
                    title: job.title,
                    status: job.status,
                    timestamp: job.updated_at || job.created_at,
                    metadata: { jobId: job.id }
                });
            });
        }

        // Get application activities (for apprentices)
        const { data: applications } = await supabase
            .from('job_applications')
            .select('id, status, created_at, updated_at, job_request_id, job_requests(title)')
            .eq('apprentice_id', userId)
            .order('updated_at', { ascending: false })
            .limit(20);

        if (applications) {
            applications.forEach(app => {
                activities.push({
                    id: `app-${app.id}`,
                    type: 'application',
                    action: `application_${app.status}`,
                    title: app.job_requests?.title || 'Job Application',
                    status: app.status,
                    timestamp: app.updated_at || app.created_at,
                    metadata: { applicationId: app.id, jobId: app.job_request_id }
                });
            });
        }

        // Get wallet transactions
        const { data: transactions } = await supabase
            .from('wallet_transactions')
            .select('id, transaction_type, amount_ngn, description, created_at, status')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (transactions) {
            transactions.forEach(trans => {
                activities.push({
                    id: `trans-${trans.id}`,
                    type: 'transaction',
                    action: trans.transaction_type,
                    title: trans.description || `${trans.transaction_type} transaction`,
                    status: trans.status,
                    timestamp: trans.created_at,
                    metadata: { 
                        transactionId: trans.id,
                        amount: trans.amount_ngn 
                    }
                });
            });
        }

        // Sort by timestamp and limit
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return activities.slice(0, limit);
    } catch (error) {
        console.error('Error fetching user activities:', error);
        return [];
    }
}

// Get detailed user information
export async function getUserDetails(userId) {
    try {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError) throw profileError;

        const stats = await getUserActivityStats(userId, profile.role);
        const activities = await getUserActivities(userId, 100);
        
        // Get wallet info
        const { data: wallet } = await supabase
            .from('user_wallets')
            .select('*')
            .eq('user_id', userId)
            .single();

        // Get recent transactions
        const { data: recentTransactions } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        return {
            profile,
            stats,
            activities,
            wallet: wallet || null,
            recentTransactions: recentTransactions || []
        };
    } catch (error) {
        console.error('Error fetching user details:', error);
        throw error;
    }
}

// Get final submission by ID
export async function getFinalSubmissionById(finalSubmissionId, userId, userRole) {
    if (!finalSubmissionId) throw new Error("Missing finalSubmissionId");

    const { data, error } = await supabase
        .from("job_final_submissions")
        .select(`
            *,
            apprentice:apprentice_id(id, name, email),
            job_request:job_requests(id, title, client_id, apprentice_id, job_type)
        `)
        .eq("id", finalSubmissionId)
        .single();

    if (error) throw error;
    return data;
}

// --- Personal Job Request Functions ---

// Create personal job request
export async function createPersonalJobRequest(jobData) {
    try {
        const {
            apprenticeId,
            title,
            description,
            fixedPrice,
            deadline,
            location,
            skillsRequired
        } = jobData;

        // Validate required fields
        if (!title || !description || !fixedPrice) {
            throw new Error("Title, description, and fixed price are required");
        }

        // Normalize skills to array
        let skillsArray = [];
        if (Array.isArray(skillsRequired)) {
            skillsArray = skillsRequired;
        } else if (typeof skillsRequired === 'string') {
            skillsArray = skillsRequired.split(',').map(s => s.trim()).filter(s => s);
        }

        // Call the RPC function
        const { data, error } = await supabase.rpc('create_personal_job_request', {
            p_apprentice_id: apprenticeId,
            p_title: title,
            p_description: description,
            p_fixed_price: parseFloat(fixedPrice),
            p_skills_required: skillsArray,
            p_location: location || null,
            p_deadline: deadline ? new Date(deadline).toISOString().split('T')[0] : null
        });

        if (error) {
            // Handle insufficient funds error
            if (error.message && error.message.includes('Insufficient funds')) {
                throw new Error("Insufficient wallet balance");
            }
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error creating personal job request:', error);
        throw error;
    }
}

// Get incoming personal requests for apprentice
export async function getIncomingPersonalRequests() {
    try {
        const { data, error } = await supabase.rpc('get_incoming_personal_requests');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting incoming personal requests:', error);
        throw error;
    }
}

// Get sent personal requests for member
export async function getSentPersonalRequests() {
    try {
        const { data, error } = await supabase.rpc('get_sent_personal_requests');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error getting sent personal requests:', error);
        throw error;
    }
}

// Respond to personal job request (accept/reject)
export async function respondToPersonalRequest(jobRequestId, decision) {
    try {
        if (!['accept', 'reject'].includes(decision)) {
            throw new Error("Decision must be 'accept' or 'reject'");
        }

        const { data, error } = await supabase.rpc('respond_to_personal_request', {
            p_job_request_id: jobRequestId,
            p_response: decision
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error responding to personal job request:', error);
        throw error;
    }
}

// Get apprentice active jobs from job_requests table (source of truth)
export async function getApprenticeActiveJobs(apprenticeId) {
    try {
        console.log("Fetching active jobs for apprentice:", apprenticeId);
        const { data, error } = await supabase
            .from("job_requests")
            .select(`
                *,
                client:profiles!job_requests_client_id_fkey(id, name, email, location),
                assigned_apprentice:profiles!job_requests_assigned_apprentice_id_fkey(id, name, email)
            `)
            .eq("assigned_apprentice_id", apprenticeId)
            .eq("status", "in_progress")
            .order("updated_at", { ascending: false });

        if (error) throw error;
        console.log("Found active jobs:", data?.length || 0);
        return data;
    } catch (error) {
        console.error("Error fetching apprentice active jobs:", error);
        throw error;
    }
}


