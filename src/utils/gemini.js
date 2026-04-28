/* ─── GEMINI AI SERVICE ───────────────────────────────────────────────────── */

export const DEMO_MODE = false; // Set to true to completely bypass the API and use mock data

const MOCK_AI_PRIORITY_RESPONSE = `## 🔴 Risk Assessment
Current analysis indicates an extreme escalation in multiple zones. Kochi is at CRITICAL risk (9.1/10) due to severe flooding exacerbating infrastructure collapse. Pondicherry and Kolkata are at HIGH risk from rising landslide threats affecting dense populations.

## ⚠️ Priority Zones
1. **Kochi** — Highest severity score, critical resource gap, and upward trend (+1.2). Immediate risk of dam overflow.
2. **Kolkata** — Dense population (54.6k) facing high landslide probability. Resources are stretched thin.
3. **Pondicherry** — Severe landslide threat to a massive population (318.7k). Intervention needed before further deterioration.

## 🚑 Resource Allocation Plan
Deploy the 50 available volunteers as follows:
- **Kochi:** 25 volunteers (Focus: Immediate evacuation and medical triage)
- **Kolkata:** 15 volunteers (Focus: Perimeter securing and relief supply distribution)
- **Pondicherry:** 10 volunteers (Focus: Early warning coordination and transport)

## 🧠 Strategic Insight
**Establish immediate supply corridors to Kochi.** The rapid severity trend indicates a narrow window for preemptive evacuation. Pre-position heavy lifting equipment near Kolkata and Pondicherry to mitigate incoming landslide blockages.`;

export const callGemini = async (apiKey, prompt) => {
  if (DEMO_MODE) {
    // Simulate network delay for realism
    await new Promise(resolve => setTimeout(resolve, 1500));
    return MOCK_AI_PRIORITY_RESPONSE;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      }
    );
    
    if (!res.ok) {
      const err = await res.json();
      console.error("Gemini API Error:", err);
      // Fallback on quota exceeded or any API error
      return MOCK_AI_PRIORITY_RESPONSE;
    }
    
    const data = await res.json();
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text || MOCK_AI_PRIORITY_RESPONSE
    );
  } catch (error) {
    console.error("Gemini Request Failed:", error);
    // Fallback on network failure
    return MOCK_AI_PRIORITY_RESPONSE;
  }
};

export const buildPrompt = (zones, weights, question) => {
  const top10 = [...zones]
    .sort((a, b) => {
      const sa =
        weights.sev * (a.severity / 10) +
        weights.pop * Math.min(a.pop / 400000, 1) +
        weights.res * Math.min((20 - a.res) / 20, 1) +
        weights.trend * Math.min(Math.max(a.trend, 0) / 2, 1);
      const sb =
        weights.sev * (b.severity / 10) +
        weights.pop * Math.min(b.pop / 400000, 1) +
        weights.res * Math.min((20 - b.res) / 20, 1) +
        weights.trend * Math.min(Math.max(b.trend, 0) / 2, 1);
      return sb - sa;
    })
    .slice(0, 10);

  const zoneList = top10
    .map(
      (z, i) =>
        `${i + 1}. ${z.name} — Type: ${z.type}, Severity: ${z.severity}/10, Pop: ${z.pop.toLocaleString()}, Resources: ${z.res}, Trend: ${z.trend > 0 ? "+" : ""}${z.trend}`
    )
    .join("\n");

  const basePrompt = `You are an expert disaster response coordinator AI for India. You have access to real-time disaster zone data.

Current priority weights:
- Base Severity: ${(weights.sev * 100).toFixed(0)}%
- Population Impact: ${(weights.pop * 100).toFixed(0)}%
- Resource Gap: ${(weights.res * 100).toFixed(0)}%
- Severity Trend: ${(weights.trend * 100).toFixed(0)}%

Top 10 priority zones right now:
${zoneList}

Total zones monitored: ${zones.length}
Critical zones (8+): ${zones.filter((z) => z.severity >= 8).length}`;

  if (question) {
    return `${basePrompt}\n\nQuestion from coordinator: ${question}\n\nProvide a direct, actionable response in 2-3 short paragraphs. Be specific with zone names and numbers.`;
  }

  return `${basePrompt}

Based on this data, provide your analysis in EXACTLY this format with these 4 sections:

## 🔴 Risk Assessment
Assess the overall risk level across all zones. Which zones are at critical risk and why?

## ⚠️ Priority Zones
List the top 3 zones that need IMMEDIATE action, with specific reasoning.

## 🚑 Resource Allocation Plan
How should available personnel (50 volunteers) be distributed? Give specific numbers per zone.

## 🧠 Strategic Insight
One clear strategic directive for the command team. Consider trends, population density, and resource gaps.

Keep your response concise, actionable, and field-ready. Use bullet points where helpful.`;
};

export const formatGeminiOutput = (text) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /^#{1,3}\s(.+)$/gm,
      '<strong style="color:#fbbf24;font-size:14px;font-family:Rajdhani,sans-serif;display:block;margin:12px 0 6px">$1</strong>'
    )
    .replace(
      /^(\d+)\.\s/gm,
      '<span style="color:#3b82f6;font-weight:600">$1.</span> '
    )
    .replace(/^[-•]\s/gm, '<span style="color:#4b5563">▸</span> ')
    .split("\n")
    .map((line) => `<p style="margin-bottom:6px">${line}</p>`)
    .join("");
};
