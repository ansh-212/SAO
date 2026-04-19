"""
InterviewVault — Perplexity Service
Real-time company intelligence retrieval for interview prep personalization.
"""
import httpx
from typing import Optional
from config import settings


def search_company_interview_data(company: str, role: str) -> Optional[str]:
    """
    Use Perplexity (sonar model with web search) to fetch company-specific
    interview patterns, topics, and process details.
    Returns raw text for Gemini to synthesize.
    """
    if not settings.PERPLEXITY_API_KEY:
        print("[Perplexity] API key not set — skipping web search")
        return None

    headers = {
        "Authorization": f"Bearer {settings.PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.PERPLEXITY_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are a research assistant specializing in tech company interview processes. Provide detailed, factual information about interview patterns, commonly tested topics, and interview process format."
            },
            {
                "role": "user",
                "content": (
                    f"What are the most commonly asked interview questions, topics, and difficulty patterns "
                    f"for a {role} position at {company}? Include:\n"
                    f"1. Most tested technical topics and their frequency\n"
                    f"2. Interview rounds and format\n"
                    f"3. Difficulty level expectations\n"
                    f"4. Any known favorite questions or patterns\n"
                    f"5. Domain/product area focus of the company\n"
                    f"Cite sources from Glassdoor, LeetCode discussions, and engineering blogs."
                )
            }
        ],
        "return_citations": True,
        "search_recency_filter": "month",
    }

    try:
        response = httpx.post(
            "https://api.perplexity.ai/chat/completions",
            headers=headers,
            json=payload,
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        print(f"[Perplexity] Successfully retrieved data for {company} - {role}")
        return content
    except httpx.TimeoutException:
        print(f"[Perplexity] Timeout for {company} - {role}")
        return None
    except Exception as e:
        print(f"[Perplexity] Error: {e}")
        return None


def synthesize_company_insights(company: str, role: str, raw_data: str) -> dict:
    """
    Use Gemini to synthesize Perplexity raw data into structured company insights.
    Returns a structured dict with topics, patterns, and analysis summary.
    """
    from services.ai_service import _generate, _safe_parse_json

    prompt = f"""You are an expert interview coach analyzing interview intelligence for {company} - {role} position.

Raw research data:
{raw_data[:5000]}

Based on this data, create a structured analysis. Be specific and actionable.

Return JSON:
{{
  "topics": ["Most important topic 1", "Topic 2", "Topic 3"],
  "topic_weights": {{
    "Most important topic 1": 95,
    "Topic 2": 80,
    "Topic 3": 65
  }},
  "patterns": [
    "2-3 coding rounds with medium-hard LeetCode style problems",
    "System design round for senior roles",
    "Strong focus on behavioral questions using STAR format"
  ],
  "analysis_summary": "2-3 paragraphs summarizing the interview process, culture expectations, and what to prepare most...",
  "domain": "e-commerce / fintech / saas / etc",
  "difficulty_level": "high / medium / low",
  "key_focus_areas": ["Area 1", "Area 2"]
}}"""

    raw = _generate(prompt, json_mode=True)
    if raw:
        result = _safe_parse_json(raw)
        if isinstance(result, dict) and "topics" in result:
            return result

    # Fallback structure
    return {
        "topics": [f"{role} Core Concepts", "System Design", "Behavioral Questions"],
        "topic_weights": {},
        "patterns": [f"Standard {role} interview process"],
        "analysis_summary": f"Interview data for {company} {role} position. Prepare standard {role} topics.",
        "domain": "technology",
        "difficulty_level": "medium",
        "key_focus_areas": [role],
    }
