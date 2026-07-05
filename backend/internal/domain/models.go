package domain

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID                 uuid.UUID
	Email              string
	PhoneNumber        string
	PhoneCountryCode   string
	PasswordHash       string
	FirstName          string
	MiddleName         *string
	LastName           string
	NationalIdentifier *string
	DateOfBirth        *time.Time
	Gender             *int
	Nationality        string
	Role               string
	IsEmailVerified    bool
	IsPhoneVerified    bool
	IsDeveloper        bool
	HospitalID         *uuid.UUID
	IsActive           bool
	CreatedAt          time.Time
}

type Application struct {
	ID                   uuid.UUID
	OwnerUserID          uuid.UUID
	HospitalID           *uuid.UUID
	TargetInstitution    int
	StatusCode           int
	EcommerceNumber      *string
	ExternalOrderNumber  *string
	ProfessionCode       *string
	ProfessionName       *string
	CareProviderID       *uuid.UUID
	DoctorUserID         *uuid.UUID
	DoctorRejectionReason *string
	IsForRelative        bool
	CreatedAt            time.Time
	UpdatedAt            time.Time
}

type ApplicationSurvey struct {
	ID            uuid.UUID
	ApplicationID uuid.UUID
	SurveyName    string
	Data          []byte // JSON
	ReportJSON    []byte // JSON (base64 PDF değil)
}

type ApplicationTemporalReport struct {
	ApplicationID uuid.UUID
	Data          []byte
	AuthorUserID  *uuid.UUID
}

type Hospital struct {
	ID                uuid.UUID
	Code              string
	Name              string
	TargetInstitution int
	IsActive          bool
	Settings          []byte
}

type CareProvider struct {
	ID                uuid.UUID
	UserID            *uuid.UUID
	HospitalID        *uuid.UUID
	ProfessionCode    string
	FullName          string
	Title             *string
	TargetInstitution int
	IsActive          bool
}

type Profession struct {
	ID                uuid.UUID
	Code              string
	Name              string
	TargetInstitution int
}

type Payment struct {
	ID                    uuid.UUID
	ApplicationID         uuid.UUID
	UserID                uuid.UUID
	Provider              string
	ProviderTransactionID *string
	Amount                float64
	Currency              string
	Status                string
	IdempotencyKey        *string
}

type NotificationLog struct {
	ID          uuid.UUID
	Channel     string
	Recipient   string
	Subject     *string
	TemplateKey string
	Status      string
	UserID      *uuid.UUID
	ApplicationID *uuid.UUID
	CreatedAt   time.Time
}

// Status codes matching medical-con
const (
	StatusPaymentPending       = 0
	StatusPaymentCompleted     = 1
	StatusApproved             = 2
	StatusRejected             = 3
	StatusInProgress           = 4
	StatusInfoRequired         = 5
	StatusConcluded            = 6
	StatusCancelled            = 7
	StatusRefundPending        = 8
	StatusRefunded             = 9
	StatusDoctorApprovalPending = 10
	StatusMedicalSecretary     = 11
)
