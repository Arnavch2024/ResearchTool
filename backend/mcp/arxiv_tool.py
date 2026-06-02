import requests
import xml.etree.ElementTree as ET

ARXIV_API = "https://export.arxiv.org/api/query"
NS = "{http://www.w3.org/2005/Atom}"


def search_arxiv(query: str, max_results: int = 5) -> list[dict]:
    """Search ArXiv papers via REST API (no key needed)."""
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": max_results,
        "sortBy": "relevance",
        "sortOrder": "descending",
    }
    resp = requests.get(ARXIV_API, params=params, timeout=10)
    resp.raise_for_status()

    root = ET.fromstring(resp.text)
    results = []

    for entry in root.findall(f"{NS}entry"):
        paper_id = entry.find(f"{NS}id").text.split("/abs/")[-1]
        title = entry.find(f"{NS}title").text.strip().replace("\n", " ")
        summary = entry.find(f"{NS}summary").text.strip().replace("\n", " ")
        authors = [a.find(f"{NS}name").text for a in entry.findall(f"{NS}author")]
        published = entry.find(f"{NS}published").text[:10]
        pdf_url = f"https://arxiv.org/pdf/{paper_id}"

        results.append({
            "id": paper_id,
            "title": title,
            "summary": summary[:400] + "..." if len(summary) > 400 else summary,
            "authors": authors[:4],
            "published": published,
            "url": f"https://arxiv.org/abs/{paper_id}",
            "pdf_url": pdf_url,
        })

    return results
