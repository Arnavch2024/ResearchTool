import requests
import os

GITHUB_API = "https://api.github.com/search/repositories"


def search_github(query: str, max_results: int = 5) -> list[dict]:
    """Search GitHub repositories (60 req/hr without token, 5000 with token)."""
    headers = {"Accept": "application/vnd.github+json"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    params = {
        "q": query,
        "sort": "stars",
        "order": "desc",
        "per_page": max_results,
    }
    resp = requests.get(GITHUB_API, headers=headers, params=params, timeout=10)
    resp.raise_for_status()

    items = resp.json().get("items", [])
    results = []

    for repo in items:
        results.append({
            "name": repo["full_name"],
            "description": repo.get("description") or "No description",
            "stars": repo["stargazers_count"],
            "language": repo.get("language") or "Unknown",
            "url": repo["html_url"],
            "topics": repo.get("topics", [])[:5],
        })

    return results
