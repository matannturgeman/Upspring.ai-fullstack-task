# Gaps vs. Requirements

## 1. Video Media Analysis (Required — not optional)

**Requirement:** "Need to analyze the media itself - video / image, not only the text."

**Current state:** Video ads are analyzed using only the thumbnail image (or skipped entirely if no thumbnail). Claude does not accept video input.

**What's missing:**
- Actual video content analysis (frames, motion, visual storytelling)
- Currently the "analyze" button on a video ad sends only a static thumbnail to Claude, which is effectively the same as image analysis

**Fix:** Use Google Gemini (supports video URLs natively via `gemini-2.0-flash`) as a secondary analyzer for video ads. When an ad has a `videoUrl`, route it to Gemini instead of Claude.

---

## 2. Performance Signals — Not Clearly Marked as Missing in UI

**Requirement:** "Some performance signals if available (or clearly marked as missing)"

**Current state:** The `performanceData` field exists in the schema and is stored as `null`. It's unclear from the UI whether this is intentional (data not available) or a bug.

**What's missing:**
- A visible "Performance data unavailable from Meta Ads Library" label on each ad card
- No tooltip or explanation telling the user *why* it's missing

**Fix:** Add an explicit "No performance data" badge/label to AdCard with a short explanation tooltip.

---

## Summary Table

| Gap | Severity | Effort |
|-----|----------|--------|
| Video analysis (Gemini) | High — explicitly required | Medium |
| Performance signals clearly marked missing | Low — cosmetic/UX | Small |
