# Gap — AI Context Selection

## What the requirement says

> "Show that you: summarize, select context, structure prompts"

Context *selection* means deliberately choosing which ads (and how much of them) to send to the model — not blindly forwarding everything.

## Current state

The chat controller fetches all ads for a brand with no limit:

```ts
// AnalysisController.ts — streamChat
const [brand, ads] = await Promise.all([
  Brand.findById(brandId).lean(),
  Ad.find({ brandId }).lean(),   // ← no .limit()
])
```

`ClaudeService.streamChat` then maps all of them into the system prompt:

```ts
const adContext = ads.map((ad, i) => [   // ← all ads, no slice
  `--- Ad ${i + 1} ---`,
  `Platform: ${ad.platform} | Status: ${ad.status}`,
  ad.headline ? `Headline: ${ad.headline}` : null,
  ad.primaryText ? `Primary Text: ${ad.primaryText}` : null,
].filter(Boolean).join('\n')).join('\n\n')
```

Images are capped at 5, but text is unbounded.

The README claims "first 15 ads and 10 images are sent" — this is inaccurate.

## Why this matters

- **Token cost**: A brand with 50 ads, each with 300-character primary text, adds ~15 000 tokens to every chat request. At claude-sonnet-4-6 pricing this is non-trivial and grows linearly with brand size.
- **Context quality**: Claude performs better with focused, well-selected context than with a long dump of marginally relevant data. Sending 50 ads for a question about "hook angles" is wasteful.
- **Requirement signal**: The panel specifically asks to "show context selection" — sending everything raw is the opposite of that.

## Recommended fix

### 1. Hard cap on ads sent to chat

In `AnalysisController.streamChat`, limit the DB query:

```ts
Ad.find({ brandId }).limit(20).lean()
```

In `ClaudeService.streamChat`, cap the text context and images independently:

```ts
const contextAds = ads.slice(0, 20)
const imageUrls = ads
  .map(ad => ad.thumbnailUrl || ad.imageUrl)
  .filter(Boolean)
  .slice(0, 10)   // was 5, bump to 10 for better visual coverage
```

### 2. Prioritise active ads

Active ads are more signal-rich than inactive ones. Sort before slicing:

```ts
const contextAds = [...ads]
  .sort((a, b) => {
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1
    if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1
    return 0
  })
  .slice(0, 20)
```

### 3. Truncate long primary text

Some ads have very long body copy. Cap per-ad text to avoid one ad dominating the context:

```ts
ad.primaryText ? `Primary Text: ${ad.primaryText.slice(0, 300)}` : null,
```

### 4. Tell Claude how many ads exist vs. how many were selected

```ts
const system = `You are an AI creative analyst for brand advertising intelligence.
You have access to a sample of ${contextAds.length} ads from "${brandName}"'s library \
(${ads.length} total ads available).
...`
```

This is honest, demonstrates context selection thinking, and gives Claude useful framing.

### 5. Fix the README

Update the README to match actual behaviour after the fix:

```md
**AI context window**: Up to 20 ads (prioritising active ones) and 10 images
are sent per chat request. Primary text is truncated at 300 characters per ad.
```

## Files to touch

| File | Change |
|---|---|
| `backend/src/controllers/AnalysisController.ts` | Add `.limit(20)` to `Ad.find()` in `streamChat` |
| `backend/src/services/ClaudeService.ts` | Sort by status, `slice(0, 20)` for text, `slice(0, 10)` for images, truncate primaryText, update system prompt header |
| `README.md` | Correct the "15 ads / 10 images" claim to reflect actual limits |

## Token impact (rough estimate)

| Scenario | Before fix | After fix |
|---|---|---|
| 20-ad brand | ~6 000 tokens | ~4 000 tokens |
| 50-ad brand | ~15 000 tokens | ~4 000 tokens |
| 100-ad brand | ~30 000 tokens | ~4 000 tokens |

The fix makes cost predictable and bounded regardless of brand size.
