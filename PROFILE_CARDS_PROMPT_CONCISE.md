# Profile Cards Implementation - Concise Prompt

Implement Profile Cards for Craftnet (Supabase + vanilla JS + Tailwind CSS) based on uupdates.txt lines 53-68.

## Requirements

**Apprentice Job ID Card** must display:
1. Avatar (from `profile.avatar_url` or placeholder)
2. Name
3. Skill category
4. Rating (stars + numeric, show "No ratings" if 0)
5. Completed jobs count
6. Joined date (formatted)
7. Bio preview (truncated ~100 chars)

**Member Business ID Card** must display:
1. Logo/photo (from `profile.logo_url` or placeholder)
2. Business name
3. Industry
4. Completed hires count
5. Contact details (email + phone) ← **MISSING, NEEDS TO BE ADDED**
6. Joined date (formatted)

## Current State
- `renderApprenticeJobIDCard()` exists in `dashboard-supabase.js` (line 8793) - mostly complete
- `renderMemberBusinessIDCard()` exists in `dashboard-supabase.js` (line 8934) - missing contact details
- Rating system: `getApprenticeRatingDetails()` in `supabase-auth.js`
- Stats: `getApprenticeStats()` and `getClientStats()` exist

## Tasks
1. **Add contact details** to `renderMemberBusinessIDCard()` (email + phone with icons)
2. **Ensure rating always displays** in apprentice card (show "No ratings yet" if 0)
3. **Create helper** `fetchProfileCardStats(profileId, role)` for efficient stats fetching
4. **Integrate cards** in search results, explore page, job applications, profile listings
5. **Optimize queries** - batch fetch stats when displaying multiple cards

## Technical Notes
- Use existing Supabase functions where possible
- Member completed hires: `COUNT(*) FROM job_requests WHERE client_id = memberId AND status = 'completed'`
- Style: Tailwind CSS, responsive grid, `hover:shadow-lg`, `rounded-lg`, `p-6`
- Handle missing data gracefully with placeholders

## Files to Modify
- `dashboard-supabase.js` - Update card functions and integration points
- `supabase-auth.js` - Add member completed hires helper (if needed)



