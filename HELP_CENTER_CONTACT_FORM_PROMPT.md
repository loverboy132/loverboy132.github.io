# Help Center & Contact Form Implementation Prompt

## Context
Create a comprehensive Help Center and Contact Form system for **Craftnet** (also branded as Craftiva), a job marketplace platform connecting Members (clients) and Apprentices (workers). The platform uses:
- **Frontend**: HTML, JavaScript (ES6 modules), TailwindCSS
- **Backend**: Supabase (PostgreSQL database, authentication, storage)
- **Styling**: TailwindCSS with custom CSS for dark mode and mobile responsiveness
- **Icons**: Feather Icons and Font Awesome

## Requirements Summary

### 1. Help Center Page
Create a new `help-center.html` page that serves as a comprehensive help resource with:
- Clean, modern UI matching the platform's design language
- Mobile-responsive layout
- Navigation menu with links to:
  - FAQ sections (common questions organized by category)
  - Contact Form
  - Platform guides/tutorials
- Search functionality (optional but recommended)
- Category-based organization for easier navigation

### 2. Contact Form Page
Create a new `contact-form.html` page with the following specifications:

#### Form Fields (Required)
1. **Full Name** (text input, required)
2. **Email Address** (email input, required)
3. **Phone Number** (tel input, optional)
4. **Issue Category** (dropdown/select, required) with options:
   - Payment Issue
   - Job Issue
   - Dispute
   - Account Issue
   - Refund Request
   - Other
5. **Subject** (text input, required)
6. **Message** (textarea, required, minimum 10 characters)
7. **Optional Attachment** (file input, accepts: image/*, .pdf, max size: 5MB)

#### Form Validation
- All required fields must be validated before submission
- Email format validation
- Phone number format validation (if provided)
- File type and size validation for attachments
- Real-time validation feedback with clear error messages

#### Form Submission Flow
1. User fills out the form
2. If attachment is provided, upload to Supabase Storage first
3. Submit form data to Supabase database
4. Show immediate auto-response message (see below)
5. Send email notification to admin (optional, via Supabase Edge Function)
6. Clear form and show success state

#### Auto-Response Message (System)
After successful form submission, display this exact message:
```
Thank you for contacting Craftnet.
We have received your request and will review it within 72 hours.
You will be notified once there is an update.
```

The auto-response should:
- Be displayed prominently on the same page
- Include a success icon/checkmark
- Optionally send an email confirmation to the user's email address

### 3. Database Schema

Create a Supabase table `contact_requests` with the following structure:

```sql
CREATE TABLE public.contact_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    issue_category text NOT NULL CHECK (issue_category IN (
        'Payment Issue',
        'Job Issue',
        'Dispute',
        'Account Issue',
        'Refund Request',
        'Other'
    )),
    subject text NOT NULL,
    message text NOT NULL,
    attachment_url text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'in_progress',
        'resolved',
        'closed'
    )),
    admin_notes text,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX contact_requests_user_idx ON public.contact_requests(user_id, created_at DESC);
CREATE INDEX contact_requests_status_idx ON public.contact_requests(status, created_at DESC);
CREATE INDEX contact_requests_category_idx ON public.contact_requests(issue_category);

-- Enable RLS
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own contact requests
CREATE POLICY "users can view their contact requests"
    ON public.contact_requests
    FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can insert their own contact requests (including anonymous)
CREATE POLICY "users can create contact requests"
    ON public.contact_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all contact requests
CREATE POLICY "admins can view all contact requests"
    ON public.contact_requests
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Admins can update contact requests
CREATE POLICY "admins can update contact requests"
    ON public.contact_requests
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
```

#### Storage Bucket for Attachments
Create a Supabase Storage bucket `contact-attachments`:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('contact-attachments', 'contact-attachments', false);

-- Storage policies (users can upload, admins can read all)
CREATE POLICY "users can upload contact attachments"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'contact-attachments' AND
        (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid() IS NULL)
    );

CREATE POLICY "admins can read all contact attachments"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'contact-attachments' AND
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
```

### 4. Integration Points

#### Navigation Links
- Add "Help Center" link to:
  - Main navigation (if applicable)
  - Footer on all pages
  - Settings/Account menu in dashboard
- Add "Contact Us" link to:
  - Footer on all pages
  - Help Center page
  - Dashboard navigation (optional)

#### Notification Integration
As per bugfix.txt requirement:
- Every notification in the system must include a clickable "Contact Us" link
- Link text: "For any issues, contact us"
- Link must direct to: `contact-form.html`
- This applies to all notification types (job applications, payments, disputes, etc.)

### 5. UI/UX Requirements

#### Design Consistency
- Match existing platform design (blue color scheme: #1d4ed8)
- Use TailwindCSS classes for styling
- Implement dark mode support (if dark mode is enabled)
- Follow mobile-responsive patterns from existing pages

#### Form Design
- Clean, modern form layout
- Clear field labels and placeholders
- Visual feedback for validation errors
- Loading states during submission
- Success/error message display areas
- File upload with preview (for images)
- Accessible form (ARIA labels, keyboard navigation)

#### Page Structure (Help Center)
- Hero section with page title
- Category sections/cards
- FAQ accordion or expandable sections
- Quick links to common resources
- Call-to-action button linking to Contact Form

#### Page Structure (Contact Form)
- Page header/title
- Form container (centered, max-width for readability)
- Form fields with proper spacing
- Submit button (prominent, disabled during submission)
- Auto-response message area (hidden initially, shown after submission)

### 6. JavaScript Implementation

Create `contact-form.js` with the following functionality:

#### Core Functions
- `handleContactFormSubmit(e)` - Handle form submission
- `uploadAttachment(file)` - Upload file to Supabase Storage
- `submitContactRequest(data)` - Insert contact request to database
- `validateForm(formData)` - Validate all form fields
- `showAutoResponse()` - Display auto-response message
- `resetForm()` - Clear form after successful submission
- `formatFileSize(bytes)` - Helper for file size display

#### Form Handling
- Prevent default form submission
- Validate all fields before proceeding
- Show loading spinner during submission
- Handle errors gracefully with user-friendly messages
- Show success state with auto-response message

#### Storage Integration
- Upload attachments to `contact-attachments` bucket
- Generate unique file names (UUID-based)
- Store file path in database `attachment_url` column
- Handle upload errors

#### Database Integration
- Insert contact request using Supabase client
- Link to authenticated user if logged in (optional, but recommended)
- Handle database errors
- Log submission for debugging

### 7. File Structure

```
craftiva-main/
├── help-center.html
├── contact-form.html
├── contact-form.js
├── help-center.js (optional, for interactive features)
└── supabase/
    └── create-contact-requests-table.sql
```

### 8. Testing Requirements

Test the following scenarios:
- Form submission with all required fields
- Form submission with optional fields (phone, attachment)
- Form validation (missing fields, invalid email, invalid file type)
- File upload (success and failure cases)
- Database insertion (success and failure cases)
- Auto-response message display
- Mobile responsiveness
- Dark mode compatibility
- Navigation links from various pages
- Notification "Contact Us" links
- Anonymous user submissions (if not logged in)
- Authenticated user submissions (if logged in)

### 9. Admin Features (Optional Enhancement)

Consider adding admin functionality to view and manage contact requests:
- Admin dashboard section for contact requests
- Filter by status, category, date
- Update request status
- Add admin notes
- View attachments
- Mark as resolved
- Email users when status changes

### 10. Additional Considerations

- **Rate Limiting**: Consider implementing rate limiting to prevent spam (e.g., max 5 submissions per hour per user/IP)
- **Email Notifications**: Optionally send email to admin when new request is submitted (via Supabase Edge Function)
- **Search Functionality**: Add search to Help Center for finding relevant articles/FAQs
- **Analytics**: Track which categories are most common for future improvements
- **Accessibility**: Ensure WCAG 2.1 AA compliance (keyboard navigation, screen readers, etc.)

## Implementation Priority

1. **Phase 1 (Critical)**:
   - Contact Form page with all required fields
   - Database table and storage bucket setup
   - Form submission and auto-response functionality
   - Basic validation

2. **Phase 2 (Important)**:
   - Help Center page structure
   - Navigation links integration
   - Notification "Contact Us" links
   - File upload functionality

3. **Phase 3 (Enhancement)**:
   - Admin dashboard integration
   - Email notifications
   - Search functionality
   - Analytics tracking

## Reference Files

When implementing, refer to:
- `index.html` - Landing page structure and styling
- `dashboard-supabase.html` - Dashboard layout patterns
- `dashboard-supabase.js` - Form handling patterns
- `supabase-auth.js` - Supabase integration patterns
- `mobile-responsive.css` - Mobile responsiveness patterns
- `dark-mode.css` - Dark mode styling patterns

## Success Criteria

The implementation is successful when:
- ✅ Contact form is accessible and functional
- ✅ All required fields are present and validated
- ✅ Form submissions are stored in database
- ✅ Auto-response message displays correctly
- ✅ File uploads work for images and PDFs
- ✅ Help Center page is accessible and navigable
- ✅ "Contact Us" links work from notifications
- ✅ Mobile responsive design works on all screen sizes
- ✅ Dark mode is supported (if enabled)
- ✅ Anonymous and authenticated users can submit forms
- ✅ Admin can view contact requests (if admin dashboard exists)

---

**Note**: This prompt should be used to guide the development of the Help Center and Contact Form feature. Adjust implementation details based on existing codebase patterns and requirements.

