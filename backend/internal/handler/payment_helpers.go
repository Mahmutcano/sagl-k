package handler

import (
	"strings"

	appcfg "medical-consultation-platform/backend/internal/config"
)

func isLivePaymentProvider(cfg appcfg.Config, provider string) bool {
	_ = provider
	return strings.EqualFold(cfg.Param.Mode, "live")
}

func isTestPaymentProvider(cfg appcfg.Config) bool {
	return strings.EqualFold(cfg.Param.Mode, "test")
}
