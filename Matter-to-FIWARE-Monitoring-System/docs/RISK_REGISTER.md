# RISK_REGISTER

## R1 - Hardware fail lúc demo
- Impact: cao
- Mitigation: có mock command fallback + video backup

## R2 - Latency cao
- Impact: trung bình-cao
- Mitigation: tối ưu polling, giảm log noise, cache context

## R3 - Alert spam
- Impact: trung bình
- Mitigation: cooldown window, dedupe key theo event

## R4 - AI reasoning lệch
- Impact: trung bình
- Mitigation: rule-first, AI chỉ hỗ trợ giải thích + đề xuất

## R5 - Mất kết nối Orion
- Impact: cao
- Mitigation: health check + auto-retry + trạng thái degraded mode
