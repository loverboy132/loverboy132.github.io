-- Check if apprentice_id foreign key exists in job_final_submissions table
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'job_final_submissions'
    AND tc.constraint_type = 'FOREIGN KEY';

-- If missing, add the foreign key (uncomment and run):
-- ALTER TABLE job_final_submissions ADD CONSTRAINT fk_apprentice FOREIGN KEY (apprentice_id) REFERENCES auth.users(id);

-- Force PostgREST schema reload:
-- NOTIFY pgrst, 'reload schema';