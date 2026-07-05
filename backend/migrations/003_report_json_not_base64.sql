-- Başvuru ve doktor raporları base64 TEXT yerine JSONB.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'application_surveys' AND column_name = 'pdf_data'
  ) THEN
    ALTER TABLE application_surveys ADD COLUMN IF NOT EXISTS report_json JSONB;
    UPDATE application_surveys
    SET report_json = CASE
      WHEN pdf_data IS NULL OR btrim(pdf_data) = '' THEN NULL
      WHEN btrim(pdf_data) ~ '^[\[{]' THEN pdf_data::jsonb
      ELSE NULL
    END
    WHERE report_json IS NULL;
    ALTER TABLE application_surveys DROP COLUMN pdf_data;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'application_final_reports' AND column_name = 'pdf_data'
  ) THEN
    ALTER TABLE application_final_reports ADD COLUMN IF NOT EXISTS report_json JSONB DEFAULT '{}'::jsonb;
    UPDATE application_final_reports
    SET report_json = CASE
      WHEN pdf_data IS NULL OR btrim(pdf_data) = '' THEN '{}'::jsonb
      WHEN btrim(pdf_data) ~ '^[\[{]' THEN pdf_data::jsonb
      ELSE '{}'::jsonb
    END
    WHERE report_json IS NULL OR report_json = '{}'::jsonb;
    ALTER TABLE application_final_reports DROP COLUMN pdf_data;
    ALTER TABLE application_final_reports ALTER COLUMN report_json SET DEFAULT '{}'::jsonb;
    ALTER TABLE application_final_reports ALTER COLUMN report_json SET NOT NULL;
  END IF;
END $$;
