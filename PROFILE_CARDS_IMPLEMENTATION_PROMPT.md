# Profile Cards Implementation Prompt

## Context
You are implementing Profile Cards for the Craftnet/Craftiva platform (a Supabase-based job marketplace connecting Apprentices with Members). The project uses vanilla JavaScript, HTML, Tailwind CSS, and Supabase for backend.

## Task: Implement Profile Cards (uupdates.txt lines 53-68)

### Requirements

#### 1. Apprentice Job ID Card
Create/update a reusable card component that displays:
- **Avatar** (from `profile.avatar_url` or placeholder with initials)
- **Name** (from `profile.name`)
- **Skill category** (from `profile.skill_category` or `profile.skill`)
- **Rating** (average rating from ratings table, display as stars + numeric value)
- **Completed jobs** (from `profile.completed_jobs` or stats)
- **Joined date** (from `profile.created_at`, formatted as "Month Year" or "Recently")
- **Bio preview** (truncated to ~100 chars with ellipsis)

#### 2. Member Business ID Card
Create/update a reusable card component that displays:
- **Logo/photo** (from `profile.logo_url` or placeholder with initials)
- **Business name** (from `profile.business_name` or `profile.name`)
- **Industry** (from `profile.industry` or `profile.creative_type`)
- **Completed hires** (calculated from completed job_requests where client_id matches)
- **Contact details** (email and phone from `profile.email` and `profile.phone`)
- **Joined date** (from `profile.created_at`, formatted as "Month Year" or "Recently")

## Current State Analysis

### Existing Code
- `renderApprenticeJobIDCard()` exists in `dashboard-supabase.js` (lines 8793-8833)
- `renderMemberBusinessIDCard()` exists in `dashboard-supabase.js` (lines 8934-8968)
- Both functions accept `(profile, stats = {})` parameters
- Rating system exists: `getApprenticeRatingDetails()` in `supabase-auth.js` (line 3039)
- Stats functions exist: `getApprenticeStats()` and `getClientStats()` in `supabase-auth.js`

### What Needs to Be Done

1. **Update `renderMemberBusinessIDCard()`** to include contact details (email and phone)
2. **Ensure proper stats fetching** when cards are displayed:
   - For Apprentices: Fetch `completed_jobs` and `average_rating`
   - For Members: Calculate `completed_hires` from job_requests table
3. **Create helper function** to fetch stats for cards efficiently
4. **Integrate cards** in all relevant places:
   - Search results
   - Explore page
   - Job applications list
   - Profile listings
   - Anywhere user profiles are displayed

## Implementation Steps

### Step 1: Update Member Business ID Card
- Add email and phone display to `renderMemberBusinessIDCard()` function
- Format contact details with icons (envelope for email, phone icon for phone)
- Handle missing contact info gracefully

### Step 2: Create Stats Fetching Helper
- Create `async function fetchProfileCardStats(profileId, role)` that:
  - For apprentices: Returns `{ completed_jobs, average_rating }`
  - For members: Returns `{ completed_hires }` (count of completed job_requests)
- Use existing Supabase queries and functions where possible

### Step 3: Update Card Rendering Functions
- Ensure `renderApprenticeJobIDCard()` always shows rating (even if 0, show "No ratings yet")
- Ensure both cards handle missing data gracefully
- Add proper error handling

### Step 4: Integration Points
Find and update all places where profile cards should be displayed:
- Search results (around line 3338 in dashboard-supabase.js)
- Explore page recommendations
- Job application lists
- Profile galleries
- Any grid/list views showing users

### Step 5: Ensure Data Flow
- When displaying cards, fetch stats before rendering
- Cache stats if displaying multiple cards to avoid N+1 queries
- Use batch queries where possible

## Technical Details

### Database Schema
- `profiles` table has all required fields (see `supabase/extend-profiles-table-for-profile-setup.sql`)
- `ratings` table exists for apprentice ratings
- `job_requests` table tracks completed jobs/hires

### Functions to Use
- `getApprenticeRatingDetails(apprenticeId)` - Returns rating stats
- `getApprenticeStats(apprenticeId)` - Returns completed_jobs count
- Query `job_requests` table for member completed hires:
  ```sql
  SELECT COUNT(*) FROM job_requests 
  WHERE client_id = memberId AND status = 'completed'
  ```

### Styling Guidelines
- Use Tailwind CSS classes (already in use)
- Maintain consistent card design with existing UI
- Cards should be responsive (grid layout)
- Hover effects: `hover:shadow-lg transition-shadow`
- Border: `border border-gray-200`
- Rounded corners: `rounded-lg`
- Padding: `p-6`

## Success Criteria

1. ✅ Apprentice cards display all 7 required fields correctly
2. ✅ Member cards display all 6 required fields correctly (including contact details)
3. ✅ Cards are used consistently across the application
4. ✅ Stats are fetched efficiently (no unnecessary queries)
5. ✅ Missing data is handled gracefully (shows placeholders/defaults)
6. ✅ Cards are responsive and match existing design system
7. ✅ Dark mode compatibility (if dark mode is implemented)

## Files to Modify

1. `dashboard-supabase.js` - Update card rendering functions and integration points
2. `supabase-auth.js` - Add helper function for fetching member completed hires (if needed)

## Testing Checklista

- [ ] Apprentice card shows all fields with valid data
- [ ] Apprentice card handles missing avatar, bio, rating gracefully
- [ ] Member card shows all fields including contact details
- [ ] Member card handles missing logo, contact info gracefully
- [ ] Cards display correctly in search results
- [ ] Cards display correctly in explore page
- [ ] Stats are fetched correctly for both roles
- [ ] Performance: No N+1 query issues when displaying multiple cards
- [ ] Responsive design works on mobile/tablet/desktop

## Notes

- The existing card functions are close to complete but missing contact details for members
- Rating display should always be visible (show "No ratings" if 0)
- Contact details should be formatted nicely with icons
- Consider creating a shared card container component if cards are used in many places





