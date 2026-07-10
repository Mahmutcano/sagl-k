package application

import (
	"encoding/json"
	"testing"
)

func TestFlexJSONString_StringOrObject(t *testing.T) {
	var asString SurveyPayload
	if err := json.Unmarshal([]byte(`{"surveyName":"patient_intake","data":"{\"chiefComplaint\":\"abc\"}"}`), &asString); err != nil {
		t.Fatal(err)
	}
	if asString.Data.String() != `{"chiefComplaint":"abc"}` {
		t.Fatalf("string form: got %q", asString.Data.String())
	}

	var asObject SurveyPayload
	if err := json.Unmarshal([]byte(`{"surveyName":"patient_intake","data":{"chiefComplaint":"abc"}}`), &asObject); err != nil {
		t.Fatal(err)
	}
	if asObject.Data.String() != `{"chiefComplaint":"abc"}` {
		t.Fatalf("object form: got %q", asObject.Data.String())
	}
}
