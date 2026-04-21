/**
 * reset-password.js - Craftnet password reset page
 * Uses existing supabase client from supabase-client.js (do not initialize twice).
 *
 * Supabase Dashboard → Auth → URL Configuration:
 * Add Redirect URL: http://127.0.0.1:5500/reset-password.html
 * And your production domain .../reset-password.html
 */

import { supabase } from "./supabase-client.js";

(function () {
    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const hash = (window.location.hash || "").replace(/^#/, "");
        const hashParams = new URLSearchParams(hash);
        return { params, hashParams };
    }

    function hasRecoveryInHash() {
        const { hashParams } = getUrlParams();
        return hashParams.has("access_token") || hashParams.get("type") === "recovery";
    }

    function getCodeFromQuery() {
        const { params } = getUrlParams();
        return params.get("code") || null;
    }

    function showResetError(msg) {
        const el = document.getElementById("reset-error");
        if (!el) return;
        el.textContent = msg || "";
        el.classList.toggle("hidden-view", !msg);
    }

    function setFormVisible(visible) {
        const form = document.getElementById("reset-password-form");
        const noSession = document.getElementById("reset-no-session");
        if (form) form.classList.toggle("hidden-view", !visible);
        if (noSession) noSession.classList.toggle("hidden-view", visible);
    }

    function isPasswordStrong(pwd) {
        if (!pwd || pwd.length < 6) return false;
        return true;
    }

    async function ensureSession() {
        const code = getCodeFromQuery();
        if (code) {
            try {
                const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                    console.error("exchangeCodeForSession error:", error);
                    return false;
                }
                if (data?.session) return true;
            } catch (e) {
                console.error("exchangeCodeForSession exception:", e);
                return false;
            }
        }

        if (hasRecoveryInHash()) {
            await supabase.auth.getSession();
        }

        const { data: { session } } = await supabase.auth.getSession();
        return !!session;
    }

    function redirectToLoginWithSuccess() {
        const path = window.location.pathname;
        const dir = path.substring(0, path.lastIndexOf("/") + 1);
        window.location.replace(dir + "login-supabase.html?reset=success");
    }

    function initResetPage() {
        const form = document.getElementById("reset-password-form");
        const noSession = document.getElementById("reset-no-session");
        if (!form) return;

        ensureSession().then(function (hasSession) {
            if (hasSession) {
                setFormVisible(true);
            } else {
                setFormVisible(false);
            }
        }).catch(function () {
            setFormVisible(false);
        });

        if (form.hasAttribute("data-reset-handler-attached")) return;
        form.setAttribute("data-reset-handler-attached", "true");

        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            const newPwdEl = document.getElementById("new-password");
            const confirmEl = document.getElementById("confirm-password");
            const submitBtn = document.getElementById("reset-submit");
            const btnText = document.getElementById("reset-button-text");
            const spinEl = document.getElementById("reset-spinner");
            if (!newPwdEl || !confirmEl) return;

            const newPwd = newPwdEl.value;
            const confirmPwd = confirmEl.value;

            showResetError("");
            if (newPwd !== confirmPwd) {
                showResetError("Passwords do not match.");
                return;
            }
            if (!isPasswordStrong(newPwd)) {
                showResetError("Password must be at least 6 characters.");
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                if (btnText) btnText.textContent = "Updating...";
                if (spinEl) spinEl.classList.remove("hidden");
            }

            try {
                const { error } = await supabase.auth.updateUser({ password: newPwd });
                if (error) throw error;
                await supabase.auth.signOut();
                redirectToLoginWithSuccess();
            } catch (err) {
                showResetError(err?.message || "Failed to update password.");
                if (submitBtn) submitBtn.disabled = false;
                if (btnText) btnText.textContent = "Update password";
                if (spinEl) spinEl.classList.add("hidden");
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initResetPage);
    } else {
        initResetPage();
    }
})();
