import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, intelligence } = body;

    if (!query || !intelligence || intelligence.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // Create a condensed version of intelligence for the AI to search
    const candidateSummaries = intelligence.map((intel: any, index: number) => ({
      index,
      name: intel.name,
      summary: intel.ai_summary,
      skills: intel.skills?.join(', '),
      availability: intel.availability?.join(', '),
      location: intel.location_preferences?.join(', '),
      qualifications: intel.qualifications?.join(', '),
      transport: intel.transport,
      experience: intel.experience_details,
      rate: intel.rate_expectations,
      positives: intel.positive_signals?.join(', '),
      concerns: intel.red_flags?.join(', ')
    }));

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `You are a recruitment assistant helping find the best candidate matches from a database of candidate intelligence.
Analyze the search query and return the indices of candidates that match, ranked by relevance.
Consider partial matches, synonyms, and related terms.`,
      messages: [
        {
          role: 'user',
          content: `Search query: "${query}"

Candidate database:
${JSON.stringify(candidateSummaries, null, 2)}

Return a JSON object with:
{
  "matchedIndices": [list of candidate indices that match the query, best matches first],
  "reasoning": "brief explanation of why these candidates match"
}

Consider:
- Exact matches (e.g., "HCA" matches skills containing "HCA")
- Semantic matches (e.g., "weekends" matches availability containing "Saturday" or "Sunday")
- Location proximity (e.g., "near London" matches locations in greater London area)
- Role equivalents (e.g., "carer" matches "care assistant", "support worker")

Return ONLY the JSON object.`
        }
      ]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ matches: [] });
    }

    try {
      let jsonText = content.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      const result = JSON.parse(jsonText);
      
      // Map indices back to full intelligence objects
      const matches = (result.matchedIndices || [])
        .filter((idx: number) => idx >= 0 && idx < intelligence.length)
        .map((idx: number) => intelligence[idx]);
      
      return NextResponse.json({ 
        matches,
        reasoning: result.reasoning 
      });
    } catch (parseError) {
      // Fallback to simple text search if AI parsing fails
      const queryLower = query.toLowerCase();
      const matches = intelligence.filter((intel: any) => 
        intel.name?.toLowerCase().includes(queryLower) ||
        intel.ai_summary?.toLowerCase().includes(queryLower) ||
        intel.skills?.some((s: string) => s.toLowerCase().includes(queryLower)) ||
        intel.availability?.some((a: string) => a.toLowerCase().includes(queryLower)) ||
        intel.qualifications?.some((q: string) => q.toLowerCase().includes(queryLower))
      );
      
      return NextResponse.json({ matches });
    }
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error.message, matches: [] },
      { status: 500 }
    );
  }
}
