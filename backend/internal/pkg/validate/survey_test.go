package validate

import "testing"

func TestApplicationSurveyAnswers(t *testing.T) {
	valid := `{"chiefComplaint":"Göğüs ağrısı ve nefes darlığı şikayetim var","medicalHistory":"Hipertansiyon tanısı mevcut, düzenli ilaç kullanıyorum","questionsForDoctor":"Ameliyat gerekir mi, riskler nelerdir?"}`
	var errs Errors
	ApplicationSurveyAnswers(&errs, valid)
	if errs.Has() {
		t.Fatalf("expected valid survey, got %v", errs)
	}

	errs = nil
	ApplicationSurveyAnswers(&errs, `{}`)
	if !errs.Has() {
		t.Fatal("expected empty survey to fail")
	}

	errs = nil
	short := `{"chiefComplaint":"kısa","medicalHistory":"uzun bir tıbbi öykü metni burada","questionsForDoctor":"doktora soracağım uzun sorular burada"}`
	ApplicationSurveyAnswers(&errs, short)
	if !errs.Has() {
		t.Fatal("expected short chiefComplaint to fail")
	}
}
