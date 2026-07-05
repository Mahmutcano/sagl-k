package validate

import (
	"encoding/json"
	"strings"
	"unicode/utf8"
)

const minSurveyAnswerLen = 10

// ApplicationSurveyAnswers validates patient intake answers stored in surveyData.data JSON.
func ApplicationSurveyAnswers(errs *Errors, data string) {
	data = strings.TrimSpace(data)
	if data == "" || data == "{}" {
		errs.Add("surveyData.chiefComplaint", "required", "Başvuru nedeni / şikayet zorunludur.")
		errs.Add("surveyData.medicalHistory", "required", "Tıbbi öykü zorunludur.")
		errs.Add("surveyData.questionsForDoctor", "required", "Doktora sorular zorunludur.")
		return
	}
	if !json.Valid([]byte(data)) {
		errs.Add("surveyData.data", "format", "Anket verisi geçerli JSON olmalıdır.")
		return
	}
	var answers map[string]string
	if err := json.Unmarshal([]byte(data), &answers); err != nil {
		errs.Add("surveyData.data", "format", "Anket verisi geçerli JSON olmalıdır.")
		return
	}
	requireSurveyText(errs, "surveyData.chiefComplaint", answers["chiefComplaint"], "Başvuru nedeni / şikayet")
	requireSurveyText(errs, "surveyData.medicalHistory", answers["medicalHistory"], "Tıbbi öykü")
	requireSurveyText(errs, "surveyData.questionsForDoctor", answers["questionsForDoctor"], "Doktora sormak istediğiniz sorular")
	optionalSurveyText(errs, "surveyData.currentMedications", answers["currentMedications"], "Kullandığı ilaçlar")
	optionalSurveyText(errs, "surveyData.previousDiagnosis", answers["previousDiagnosis"], "Önceki tanı / tedavi")
	optionalSurveyText(errs, "surveyData.additionalNotes", answers["additionalNotes"], "Ek açıklama")
}

func requireSurveyText(errs *Errors, field, value, label string) {
	value = strings.TrimSpace(value)
	if value == "" {
		errs.Add(field, "required", label+" zorunludur.")
		return
	}
	if utf8.RuneCountInString(value) < minSurveyAnswerLen {
		errs.Add(field, "min_length", label+" en az 10 karakter olmalıdır.")
	}
	if utf8.RuneCountInString(value) > MaxNoteLength {
		errs.Add(field, "max_length", label+" en fazla 2000 karakter olabilir.")
	}
}

func optionalSurveyText(errs *Errors, field, value, label string) {
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}
	if utf8.RuneCountInString(value) > MaxNoteLength {
		errs.Add(field, "max_length", label+" en fazla 2000 karakter olabilir.")
	}
}
