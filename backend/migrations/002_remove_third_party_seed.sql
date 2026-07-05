-- Harici marka / üçüncü taraf kurum seed verilerini kaldır (yalnızca Erciyes kalsın).
DELETE FROM care_providers WHERE target_institution <> 1;
DELETE FROM professions WHERE target_institution <> 1;
DELETE FROM hospitals WHERE code <> 'erciyes' OR target_institution <> 1;

UPDATE hospitals
SET settings = '{"inpatient_warning":true}'::jsonb
WHERE code = 'erciyes';
