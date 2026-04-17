const MOCK_ANALYSIS = `## Ad Analysis

**Hook & Attention**
The headline immediately establishes urgency and value. The copy leads with the benefit rather than the feature — a classic direct-response technique that reduces cognitive load and drives clicks.

**Visual Strategy**
High-contrast creative with a clear focal point draws the eye. The image reinforces the offer rather than competing with it, keeping the viewer's attention on the CTA.

**Copy Structure**
Short, punchy sentences with active voice. The primary text handles objection removal early ("limited time") before the viewer disengages. The tone is confident without being aggressive.

**Target Audience**
Based on platform placement and copy style, this ad is likely optimized for a 25–44 age bracket with demonstrated purchase intent. The casual tone suggests a mid-funnel retargeting audience rather than cold traffic.

**Call to Action**
The CTA is direct and action-oriented. It creates a sense of loss aversion ("today only") which consistently outperforms neutral CTAs in A/B tests on Meta.

**Overall Assessment**
Strengths: clear hierarchy, benefit-led copy, strong urgency mechanism.
Opportunity: A/B test the headline with social proof (e.g. "10,000 customers chose this") to see if credibility signals improve conversion rate at scale.`

export async function* streamMockChat(): AsyncGenerator<string> {
  const text =
    'The most common messaging angle is **urgency** — several ads use "limited time" framing. Across creatives, short punchy headlines dominate, paired with benefit-led primary text. The target audience skews 25–44 with demonstrated purchase intent.'
  for (const token of text.split(/(\s+)/)) {
    if (token) yield token
    await new Promise((r) => setTimeout(r, 15))
  }
}

export async function* streamMockAnalysis(): AsyncGenerator<string> {
  const tokens = MOCK_ANALYSIS.split(/(\s+)/).filter(Boolean)
  for (const token of tokens) {
    yield token
    await new Promise((r) => setTimeout(r, 18))
  }
}
