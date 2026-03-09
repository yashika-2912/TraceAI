import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const INTEGRITY_MODES = {
  assignment_safe: {
    max_source_influence: 20,
    min_originality: 60,
    max_ai_synthesis: 25,
    description: "Academic essays & formal submissions - Strictest",
    label: "Assignment Safe",
    focus: "Plagiarism Prevention",
  },
  research_draft: {
    max_source_influence: 40,
    min_originality: 40,
    max_ai_synthesis: 35,
    description: "Research papers & technical docs - Balanced",
    label: "Research Draft",
    focus: "Attribution Balance",
  },
  creative: {
    max_source_influence: 100, // No hard limit
    min_originality: 0,
    max_ai_synthesis: 100,
    description: "Stories & brainstorming - Permissive",
    label: "Creative",
    focus: "Inspiration Transparency",
  },
};

export async function generateTraceContent(query, sources, mode) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const sourcesText = sources
    .map((src, i) => `[Source ${i + 1}]: ${src}`)
    .join("\n");

  const prompt = `
    You are TraceAI, an attribution-first AI content system. Your goal is to provide transparent, honest content generation.
    
    USER QUERY: ${query}
    
    REFERENCE SOURCES:
    ${sourcesText}
    
    INTEGRITY MODE: ${mode.toUpperCase()}
    
    ANALYSIS LOGIC FOR ${mode.toUpperCase()}:
    ${
      mode === "assignment_safe"
        ? `
    1. Calculate source influence score: Compare generated paragraph against all sources using embeddings and phrase matching.
    2. Flag Risk Levels: >20% (HIGH), 15-20% (MEDIUM), <15% (SAFE).
    3. Calculate Originality Index: 100% - (Source% + AI Synthesis%). Must be >= 60%.
    `
        : mode === "research_draft"
        ? `
    1. Multi-Source Attribution Tracking: Identify which sources contributed and weight them individually.
    2. Flag Problematic Patterns: Single source > 50% or total sources > 40%.
    3. Quality Metrics: Calculate Source Diversity Score (0-10) and Synthesis Quality (0-10).
    `
        : `
    1. Track Inspiration Sources: Identify which sources INSPIRED the direction (mark as inspirations vs citations).
    2. Flag Content Quality: Rate AI synthesis quality (0-10).
    3. Provide Inspiration Transparency: Help user understand idea origins.
    `
    }
    
    STRICT CONSTRAINTS for ${mode} mode:
    - Maximum allowed source influence: ${INTEGRITY_MODES[mode].max_source_influence}%
    - Minimum required user originality: ${INTEGRITY_MODES[mode].min_originality}%
    - Prioritize original synthesis over direct source parroting.
    
    TASK:
    1. Generate a high-quality paragraph answering the query.
    2. Perform a granular attribution analysis based on the ${mode.toUpperCase()} logic above.
    3. Ensure all percentages sum to exactly 100%.
    
    RESPONSE FORMAT (JSON):
    {
      "paragraph": "The generated text...",
      "source_references": [1, 2], // Indices of sources used
      "attribution_breakdown": {
        "source_influence_percent": number,
        "ai_synthesis_percent": number,
        "user_originality_percent": number,
        "individual_source_weights": { "1": 20, "2": 15 } // Optional: Weight for each source index
      },
      "quality_score": number, // 0-10
      "source_diversity_score": number, // 0-10
      "reasoning": "Detailed explanation of how the attribution percentages were calculated based on semantic overlap and synthesis depth."
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          paragraph: { type: Type.STRING },
          source_references: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
          attribution_breakdown: {
            type: Type.OBJECT,
            properties: {
              source_influence_percent: { type: Type.NUMBER },
              ai_synthesis_percent: { type: Type.NUMBER },
              user_originality_percent: { type: Type.NUMBER },
              individual_source_weights: {
                type: Type.OBJECT,
                description: "Map of source index to its influence percentage",
              },
            },
            required: [
              "source_influence_percent",
              "ai_synthesis_percent",
              "user_originality_percent",
            ],
          },
          quality_score: { type: Type.NUMBER },
          source_diversity_score: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
        },
        required: ["paragraph", "source_references", "attribution_breakdown", "reasoning"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  
  return JSON.parse(text);
}
