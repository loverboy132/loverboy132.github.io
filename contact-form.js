// contact-form.js - Contact form handling with Supabase integration
import { supabase } from './supabase-client.js';
import { getUsersByRole } from './supabase-auth.js';
import { createNotification } from './payment-notifications.js';

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
const BUCKET_NAME = 'contact-attachments';

// DOM Elements
const contactForm = document.getElementById('contact-form');
const submitBtn = document.getElementById('submit-btn');
const submitText = document.getElementById('submit-text');
const submitSpinner = document.getElementById('submit-spinner');
const autoResponse = document.getElementById('auto-response');
const formError = document.getElementById('form-error');
const formErrorText = document.getElementById('form-error-text');
const attachmentInput = document.getElementById('attachment');
const filePreview = document.getElementById('file-preview');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactFormSubmit);
    }
    
    if (attachmentInput) {
        attachmentInput.addEventListener('change', handleFileSelect);
    }
});

/**
 * Handle form submission
 */
async function handleContactFormSubmit(e) {
    e.preventDefault();
    
    // Clear previous errors
    clearErrors();
    hideFormError();
    
    // Get form data
    const formData = {
        fullName: document.getElementById('full-name').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim() || null,
        issueCategory: document.getElementById('issue-category').value,
        subject: document.getElementById('subject').value.trim(),
        message: document.getElementById('message').value.trim(),
        attachment: attachmentInput?.files[0] || null
    };
    
    // Validate form
    const validation = validateForm(formData);
    if (!validation.isValid) {
        showValidationErrors(validation.errors);
        return;
    }
    
    // Disable submit button and show loading
    setLoadingState(true);
    
    try {
        // Get current user if logged in
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || null;
        
        // Upload attachment if provided
        let attachmentUrl = null;
        if (formData.attachment) {
            attachmentUrl = await uploadAttachment(formData.attachment, userId);
        }
        
        // Submit contact request
        const contactRequest = {
            user_id: userId,
            full_name: formData.fullName,
            email: formData.email,
            phone: formData.phone,
            issue_category: formData.issueCategory,
            subject: formData.subject,
            message: formData.message,
            attachment_url: attachmentUrl,
            status: 'pending'
        };
        
        const { data, error } = await supabase
            .from('contact_requests')
            .insert([contactRequest])
            .select()
            .single();
        
        if (error) {
            throw error;
        }
        
        // Notify all admins about the new contact request
        await notifyAdminsOfContactRequest(data);
        
        // Success - show auto-response and reset form
        showAutoResponse();
        resetForm();
        
        console.log('✅ Contact request submitted successfully:', data);
        
    } catch (error) {
        console.error('❌ Error submitting contact request:', error);
        showFormError(error.message || 'Failed to submit your request. Please try again.');
    } finally {
        setLoadingState(false);
    }
}

/**
 * Validate form fields
 */
function validateForm(formData) {
    const errors = {};
    
    // Full Name
    if (!formData.fullName) {
        errors.fullName = 'Full name is required';
    } else if (formData.fullName.length < 2) {
        errors.fullName = 'Full name must be at least 2 characters';
    }
    
    // Email
    if (!formData.email) {
        errors.email = 'Email address is required';
    } else if (!isValidEmail(formData.email)) {
        errors.email = 'Please enter a valid email address';
    }
    
    // Phone (optional but validate if provided)
    if (formData.phone && !isValidPhone(formData.phone)) {
        errors.phone = 'Please enter a valid phone number';
    }
    
    // Issue Category
    if (!formData.issueCategory) {
        errors.issueCategory = 'Please select an issue category';
    }
    
    // Subject
    if (!formData.subject) {
        errors.subject = 'Subject is required';
    } else if (formData.subject.length < 3) {
        errors.subject = 'Subject must be at least 3 characters';
    }
    
    // Message
    if (!formData.message) {
        errors.message = 'Message is required';
    } else if (formData.message.length < 10) {
        errors.message = 'Message must be at least 10 characters';
    }
    
    // Attachment validation
    if (formData.attachment) {
        const fileError = validateFile(formData.attachment);
        if (fileError) {
            errors.attachment = fileError;
        }
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone number format (basic validation)
 */
function isValidPhone(phone) {
    // Allow various phone formats: +234..., 080..., etc.
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Validate file
 */
function validateFile(file) {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return `File size exceeds 5MB limit. Your file is ${formatFileSize(file.size)}`;
    }
    
    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        return `File type not allowed. Please upload an image (JPG, PNG, GIF) or PDF file.`;
    }
    
    return null;
}

/**
 * Upload attachment to Supabase Storage
 */
async function uploadAttachment(file, userId) {
    try {
        // Generate unique file name
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = userId ? `${userId}/${fileName}` : `anonymous/${fileName}`;
        
        // Upload file
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) {
            throw error;
        }
        
        // Get public URL (or signed URL for private buckets)
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path);
        
        return urlData.publicUrl;
        
    } catch (error) {
        console.error('❌ Error uploading attachment:', error);
        throw new Error(`Failed to upload attachment: ${error.message}`);
    }
}

/**
 * Show validation errors
 */
function showValidationErrors(errors) {
    Object.keys(errors).forEach(fieldName => {
        const errorElement = document.getElementById(`${fieldName}-error`);
        if (errorElement) {
            errorElement.textContent = errors[fieldName];
            errorElement.classList.remove('hidden');
        }
        
        // Highlight field
        const fieldElement = document.getElementById(fieldName);
        if (fieldElement) {
            fieldElement.classList.add('border-red-500');
            fieldElement.addEventListener('input', function clearError() {
                fieldElement.classList.remove('border-red-500');
                if (errorElement) {
                    errorElement.classList.add('hidden');
                }
                fieldElement.removeEventListener('input', clearError);
            });
        }
    });
}

/**
 * Clear all validation errors
 */
function clearErrors() {
    document.querySelectorAll('.form-error').forEach(el => {
        el.classList.add('hidden');
        el.textContent = '';
    });
    
    document.querySelectorAll('input, select, textarea').forEach(el => {
        el.classList.remove('border-red-500');
    });
}

/**
 * Show form error message
 */
function showFormError(message) {
    if (formError && formErrorText) {
        formErrorText.textContent = message;
        formError.classList.remove('hidden');
        
        // Scroll to error
        formError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Hide form error message
 */
function hideFormError() {
    if (formError) {
        formError.classList.add('hidden');
    }
}

/**
 * Show auto-response message
 */
function showAutoResponse() {
    if (autoResponse) {
        autoResponse.classList.remove('hidden');
        
        // Scroll to auto-response
        autoResponse.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Replace feather icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }
}

/**
 * Reset form after successful submission
 */
function resetForm() {
    if (contactForm) {
        contactForm.reset();
        clearErrors();
        hideFormError();
        clearFilePreview();
        
        // Reset message counter
        const messageCount = document.getElementById('message-count');
        if (messageCount) {
            messageCount.textContent = '0';
        }
    }
}

/**
 * Set loading state
 */
function setLoadingState(isLoading) {
    if (submitBtn) {
        submitBtn.disabled = isLoading;
    }
    
    if (submitText) {
        submitText.textContent = isLoading ? 'Submitting...' : 'Submit Request';
    }
    
    if (submitSpinner) {
        if (isLoading) {
            submitSpinner.classList.remove('hidden');
        } else {
            submitSpinner.classList.add('hidden');
        }
    }
}

/**
 * Handle file selection
 */
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) {
        clearFilePreview();
        return;
    }
    
    // Validate file
    const error = validateFile(file);
    if (error) {
        showFileError(error);
        e.target.value = ''; // Clear file input
        return;
    }
    
    // Show preview
    showFilePreview(file);
}

/**
 * Show file preview
 */
function showFilePreview(file) {
    if (!filePreview) return;
    
    clearFilePreview();
    
    if (file.type.startsWith('image/')) {
        // Image preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'file-preview';
            img.alt = 'File preview';
            filePreview.appendChild(img);
        };
        reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
        // PDF preview (just show file name and size)
        const div = document.createElement('div');
        div.className = 'bg-gray-100 p-3 rounded-lg';
        div.innerHTML = `
            <div class="flex items-center">
                <i data-feather="file" class="w-8 h-8 text-red-500 mr-3"></i>
                <div>
                    <p class="font-medium text-sm">${file.name}</p>
                    <p class="text-xs text-gray-500">${formatFileSize(file.size)}</p>
                </div>
            </div>
        `;
        filePreview.appendChild(div);
        
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }
}

/**
 * Clear file preview
 */
function clearFilePreview() {
    if (filePreview) {
        filePreview.innerHTML = '';
    }
}

/**
 * Show file error
 */
function showFileError(message) {
    const errorElement = document.getElementById('attachment-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }
}

/**
 * Notify all admins about a new contact request
 */
async function notifyAdminsOfContactRequest(contactRequest) {
    try {
        // Get all admin users
        const admins = await getUsersByRole('admin', 50);
        
        if (!admins || admins.length === 0) {
            console.warn('⚠️ No admin users found to notify');
            return;
        }

        // Create notification for each admin
        const notificationPromises = admins.map(admin => 
            createNotification({
                userId: admin.id,
                type: 'contact_request',
                title: 'New Contact Request',
                message: `New contact request from ${contactRequest.full_name} (${contactRequest.issue_category})`,
                metadata: {
                    contact_request_id: contactRequest.id,
                    issue_category: contactRequest.issue_category,
                    subject: contactRequest.subject,
                    from_name: contactRequest.full_name,
                    from_email: contactRequest.email
                },
                channels: ['in_app']
            }).catch(error => {
                console.error(`Failed to notify admin ${admin.id}:`, error);
                return null;
            })
        );

        await Promise.allSettled(notificationPromises);
        console.log(`✅ Notified ${admins.length} admin(s) about new contact request`);
    } catch (error) {
        console.error('❌ Error notifying admins:', error);
        // Don't throw - we don't want to fail the form submission if notification fails
    }
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

