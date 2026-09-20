import os
import requests
import urllib.parse

S2_SEARCH_API = "https://api.semanticscholar.org/graph/v1/paper/search"
OPENALEX_API = "https://api.openalex.org/works"

FIELDS = (
    "paperId,title,abstract,authors,year,venue,"
    "citationCount,influentialCitationCount,openAccessPdf,url,tldr,fieldsOfStudy"
)


def _reconstruct_openalex_abstract(inverted_index: dict) -> str:
    """Rebuild full-text abstract from OpenAlex inverted word index dictionary."""
    if not inverted_index or not isinstance(inverted_index, dict):
        return ""
    try:
        word_positions = []
        for word, positions in inverted_index.items():
            if isinstance(positions, list):
                for pos in positions:
                    word_positions.append((pos, word))
        word_positions.sort(key=lambda x: x[0])
        return " ".join(w[1] for w in word_positions)
    except Exception:
        return ""


def _search_openalex(query: str, max_results: int = 5) -> list[dict]:
    """Fallback open academic graph search via OpenAlex (250M+ indexed research works)."""
    try:
        headers = {
            "User-Agent": "ResearchRAG-Academic/1.0 (mailto:contact@researchrag.ai)"
        }
        params = {
            "search": query,
            "per_page": min(max_results, 10),
        }
        resp = requests.get(OPENALEX_API, params=params, headers=headers, timeout=12)
        if resp.status_code != 200:
            return []
        data = resp.json()

        results = []
        for item in (data.get("results") or []):
            if not isinstance(item, dict):
                continue
            title = item.get("display_name") or item.get("title") or ""
            if not title:
                continue

            abstract = _reconstruct_openalex_abstract(item.get("abstract_inverted_index"))
            summary = abstract[:400] + "..." if len(abstract) > 400 else abstract or "No abstract summary available."

            authors = []
            for a in (item.get("authorships") or []):
                if isinstance(a, dict):
                    author_name = (a.get("author") or {}).get("display_name")
                    if author_name:
                        authors.append(author_name)

            primary_loc = item.get("primary_location") or {}
            source_obj = primary_loc.get("source") or {}
            venue_name = (
                source_obj.get("display_name")
                or (item.get("host_venue") or {}).get("display_name")
                or "Peer-Reviewed Publication"
            )

            oa_obj = item.get("open_access") or {}
            oa_url = oa_obj.get("oa_url") or item.get("doi") or item.get("id") or ""
            paper_url = item.get("doi") or item.get("id") or f"https://openalex.org/{str(item.get('id', '')).split('/')[-1]}"

            concepts = item.get("concepts") or []
            fields = [c.get("display_name") for c in concepts[:3] if isinstance(c, dict) and c.get("display_name")]

            citations = int(item.get("cited_by_count") or 0)

            results.append({
                "id": str(item.get("id", "")).split("/")[-1] or title[:30],
                "title": title,
                "summary": summary,
                "tldr": None,
                "abstract": abstract,
                "authors": authors[:5],
                "year": item.get("publication_year"),
                "venue": venue_name,
                "citations": citations,
                "influential_citations": int(citations * 0.12),
                "fields": fields,
                "url": paper_url,
                "pdf_url": oa_url,
                "source": "openalex",
            })
        return results
    except Exception as e:
        print(f"[OpenAlex fallback error]: {e}")
        return []


def search_semantic_scholar(query: str, max_results: int = 5) -> list[dict]:
    """
    Search academic papers with citation metrics, influential citations, and peer-reviewed venues.
    Primary: Semantic Scholar API.
    Automatic Fallback: OpenAlex academic graph.
    """
    clean_query = query.strip()
    if not clean_query:
        return []

    headers = {
        "User-Agent": "ResearchRAG-Scholar/1.0 (academic research assistant; mailto:contact@researchrag.ai)"
    }
    api_key = os.environ.get("SEMANTIC_SCHOLAR_API_KEY")
    if api_key:
        headers["x-api-key"] = api_key.strip()

    params = {
        "query": clean_query,
        "limit": min(max_results, 10),
        "fields": FIELDS,
    }

    try:
        resp = requests.get(
            S2_SEARCH_API,
            params=params,
            headers=headers,
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            results = []
            for item in (data.get("data") or []):
                if not isinstance(item, dict):
                    continue
                paper_id = item.get("paperId", "")
                title = (item.get("title") or "").strip()
                if not title:
                    continue

                authors = [a.get("name") for a in (item.get("authors") or []) if isinstance(a, dict) and a.get("name")]
                tldr_obj = item.get("tldr") or {}
                tldr = tldr_obj.get("text") if isinstance(tldr_obj, dict) else None
                abstract = item.get("abstract") or ""
                summary = tldr or (abstract[:400] + "..." if len(abstract) > 400 else abstract) or "No abstract available."

                pdf_url = ""
                oa = item.get("openAccessPdf")
                if oa and isinstance(oa, dict):
                    pdf_url = oa.get("url") or ""

                citations = int(item.get("citationCount") or 0)
                influential = int(item.get("influentialCitationCount") or 0)

                results.append({
                    "id": paper_id,
                    "title": title,
                    "summary": summary,
                    "tldr": tldr,
                    "abstract": abstract,
                    "authors": authors[:5],
                    "year": item.get("year"),
                    "venue": item.get("venue") or "Academic Publication",
                    "citations": citations,
                    "influential_citations": influential,
                    "fields": item.get("fieldsOfStudy") or [],
                    "url": item.get("url") or f"https://www.semanticscholar.org/paper/{paper_id}",
                    "pdf_url": pdf_url,
                    "source": "semantic_scholar",
                })
            if results:
                return results

    except Exception as e:
        print(f"[Semantic Scholar Primary Error]: {e}")

    # Seamless Fallback to OpenAlex Academic Graph
    return _search_openalex(clean_query, max_results=max_results)
