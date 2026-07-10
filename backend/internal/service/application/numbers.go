package application

import (
	"context"

	"github.com/jackc/pgx/v5"
)

func (s *Service) allocateApplicationNumber(ctx context.Context, tx pgx.Tx) (string, error) {
	var num string
	err := tx.QueryRow(ctx, `
		DELETE FROM recycled_application_numbers
		WHERE number = (
			SELECT number FROM recycled_application_numbers
			ORDER BY recycled_at ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING number
	`).Scan(&num)
	if err == nil && num != "" {
		return num, nil
	}
	err = tx.QueryRow(ctx, `
		SELECT 'BSV-' || LPAD(nextval('application_number_seq')::text, 6, '0')
	`).Scan(&num)
	return num, err
}
