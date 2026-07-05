package handler

import (
	"strings"

	appcfg "medical-consultation-platform/backend/internal/config"
	paysvc "medical-consultation-platform/backend/internal/service/payment"
)

func isLivePaymentProvider(cfg appcfg.Config, provider string) bool {
	switch paysvc.NormalizeProvider(provider) {
	case "bizim_hesap":
		return strings.EqualFold(cfg.BizimHesap.Mode, "live")
	default:
		return strings.EqualFold(cfg.Param.Mode, "live")
	}
}
