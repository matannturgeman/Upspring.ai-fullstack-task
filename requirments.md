# Founding Engineer Task - [Upspring.ai](https://upspring.ai)

Welcome to the Upspring.ai Founding Engineer Task Candidate Challenge! This task is designed to test your technical and execution skills and creativity as a founding team member. You'll need to be resourceful and hands-on, simulating how you would take major part of the R&D efforts

**Confidentiality Notice**: The information shared here about our product and plans is confidential. Please do not discuss or share any details about the product or this assignment outside of this process. We appreciate your understanding and cooperation.

---

## Context

We're building a creative intelligence platform for marketers and agencies.
This assignment simulates a **real product slice** we work on: creative research, competitor analysis, and AI-driven insights.

This is **not a system design interview** and **not a scaling challenge** - but we do care deeply about **product thinking, robustness, and clarity**.

---

## Goal

Build a small web app that allows a user to:

1. Enter a **brand name**
2. Fetch and display that brand's **public Meta ads**
3. Ask AI questions about those ads
4. Discover **relevant competitors** and explore their ads as well

The emphasis is on:

- end-to-end ownership
- real-world integrations
- thoughtful UI
- AI used as a reasoning tool (not magic)

---

## Core Requirements

### 1️⃣ Fetch real public ads data

When a user enters a brand name, the system should:

- Fetch **real public ads** for that brand from Meta (or equivalent public source)
- You may use **any third-party service**, for example:
  - Apify
  - ScrapingBee
  - RapidAPI
  - Any other legitimate scraping / data provider

**Important notes**

- Partial / imperfect data is acceptable
- You should handle:
  - empty results
  - rate limits
  - provider errors
  - timeouts

We care about *how you approach real-world data acquisition*, not about perfect coverage.

---

### 2️⃣ Ads exploration UI

Display the fetched ads in a clear, usable UI.
Minimum expectations:

- Ad preview (image or video thumbnail)
- Basic metadata (platform, start date if available)
- Ad text (headline / primary text)
- Some performance signals *if available* (or clearly marked as missing)

---

### 3️⃣ AI Analysis about the brand's ads

The user should be able to ask AI questions about the ads, for example:

- "What messaging angles are used most?"
- "What patterns do you see across creatives?"
- "What might be working well here, and why?"

Requirements:

- Use an LLM of your choice
- **Need to analyze the media itself - video / image, not only the text.**
- Show that you:
  - summarize
  - select context
  - structure prompts
- Display answers clearly in the UI

---

## Bonus: Competitor discovery

Add a **"Find competitors"** action.

When triggered:

- The system should attempt to identify **relevant competing brands**
- This does **not** need to be perfect
- You may use:
  - LLM reasoning
  - web search APIs
  - ad content analysis
  - or any combination

What we care about:

- Your **approach**
- How you reason from weak signals
- How you explain *why* a competitor is considered relevant

After discovering competitors:

- Allow the user to select one
- Fetch and explore their ads using the same flow

---

## Error handling & fallbacks

We care a lot about robustness. Please handle and clearly communicate:

- No ads found
- Data provider errors
- AI failures
- Partial data
- Slow responses

The UI should:

- Never break silently
- Always explain what happened
- Provide fallback messaging or actions

---

## Explicit constraints

This assignment is not built for scale, and you are not expected to over-engineer with complex infra.
However, we do expect full ownership of the system you build. So you'll be able to answer questions like:

- What parts of the system are most expensive
- What would break first under heavier usage
- Where failures are most likely to happen
- How you would evolve the system if scale or reliability became important
- How you would monitor and debug it in production

You do not need to implement these things - but they should be part of your mental model when building the solution, and reflected in your explanations.

---

## Technical expectations

- Full-stack solution (frontend + backend + DB)
- Reasonable project structure
- Clear separation of concerns
- [Node.js](https://nodejs.org) | [React.js](https://react.dev) | MongoDB are preferred since that's our current stack, but not mandatory

You may use AI tools while building - just be ready to explain how and why.

---

## Deliverables

- Public accessible URL to your live web application
- GitHub repository
- README with:
  - setup instructions
  - explanations and tradeoffs
  - What would you do different for high scale system, what will break first and how to handle it

---

## Helpful Resources

- Meta Ads Library (public ads) - https://www.facebook.com/ads/library
- Perplexity API - https://www.perplexity.ai/api-platform
