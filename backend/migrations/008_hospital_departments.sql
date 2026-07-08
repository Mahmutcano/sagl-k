-- Step 1: Drop the old unique constraint that prevented registering the same profession code (e.g. cardiology) under different hospitals.
ALTER TABLE professions DROP CONSTRAINT IF EXISTS professions_code_target_institution_key;

-- Step 2: Create a new unique constraint including hospital_id to allow hospital-specific professions.
ALTER TABLE professions ADD CONSTRAINT professions_code_target_institution_hospital_id_key UNIQUE (code, target_institution, hospital_id);
