# Gap — Video Analysis

## What the requirement says

> "Need to analyze the media itself - video / image, not only the text."

## Current state

Video ads are detected and displayed with a "VIDEO" badge in the UI, but the video content itself is never sent to Claude. `ClaudeService` only sends `thumbnailUrl || imageUrl`:

```ts
// ClaudeService.ts — streamAnalysis
const imageUrl = ad.thumbnailUrl || ad.imageUrl  // videoUrl ignored

// ClaudeService.ts — streamChat
const imageUrls = ads
  .map(ad => ad.thumbnailUrl || ad.imageUrl)      // videoUrl ignored
  .filter(Boolean)
  .slice(0, 5)
```

If an ad has a `videoUrl` but no `thumbnailUrl` or `imageUrl`, Claude receives zero visual context for that ad — only text.

## Why this matters

The requirement explicitly calls out video. A brand may run mostly video ads (common on Instagram/Reels). Without visual analysis of those creatives, the AI insights are incomplete and the requirement is technically unmet.

## Constraint

Claude's API does not accept video files or URLs — only images (PNG, JPEG, WebP, GIF). There is no native video understanding in the Anthropic API as of the current version.

## Recommended fix — Option A (pragmatic, no new infra)

**Ensure every video ad has a thumbnail populated**, then be transparent in the AI prompt.

### 1. Scraper / extraction layer

When a video ad is scraped and `thumbnailUrl` is missing, attempt to derive one:
- Apify's Meta Ads Library actor often returns a `snapshot.videos[].video_hd_url` with a matching `snapshot.images[0].url` that serves as the thumbnail — make sure the extraction code maps this correctly.
- If no thumbnail is available from the raw data, store `null` and mark the ad as `videoOnly: true`.

### 2. Prompt transparency

Update `buildPrompt` (single-ad) and `streamChat` (brand chat) to tell Claude what it's looking at:

```ts
// For a video ad with a thumbnail:
"Note: This is a video ad. The image below is the thumbnail frame used as a visual proxy."

// For a video ad with no thumbnail:
"Note: This is a video ad. No thumbnail was available — visual analysis is limited to ad copy only."
```

This is honest, shows awareness of the constraint, and lets Claude flag the limitation in its response.

### 3. UI label

In `AdCard`, change the "VIDEO" badge to also indicate whether visual analysis was possible:

```tsx
{ad.videoUrl && !hasMedia && (
  <span title="Video ad — thumbnail unavailable, visual analysis limited">
    VIDEO (no thumbnail)
  </span>
)}
```

## Recommended fix — Option B (proper, needs infra)

Extract a frame from the video at scrape time and store it as the thumbnail.

- **Tool**: FFmpeg (self-hosted Lambda / Cloud Run) or a 3rd-party service (e.g. Mux, api.video)
- **When**: During the extraction pipeline, after scraping, before saving to MongoDB
- **Output**: Upload the frame to S3/R2, store the URL as `thumbnailUrl`
- **Cost**: ~$0.001 per video frame extract; adds ~2–5s to scrape time per video ad

This fully satisfies the requirement but adds meaningful infrastructure. Not recommended for the current scope.

## Decision

**Implement Option A.** It is honest about the constraint, requires no new services, and demonstrates understanding of both the requirement and the API limitation. Document the limitation in the README under Known Limitations.

## Files to touch

| File | Change |
|---|---|
| `backend/src/services/ClaudeService.ts` | Add prompt note for video ads (thumbnail proxy vs. no visual) |
| `backend/src/services/ExtractionService.ts` | Verify `thumbnailUrl` is populated from video snapshot data |
| `frontend/src/components/AdCard/AdCard.tsx` | Show "VIDEO (no thumbnail)" label when thumbnail missing |
| `README.md` | Add Known Limitations section noting video constraint |
