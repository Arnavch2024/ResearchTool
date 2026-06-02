import requests

HF_API = "https://huggingface.co/api"


def search_datasets(query: str, max_results: int = 5) -> list[dict]:
    """Search HuggingFace datasets (no key needed)."""
    resp = requests.get(
        f"{HF_API}/datasets",
        params={"search": query, "limit": max_results, "sort": "downloads"},
        timeout=10,
    )
    resp.raise_for_status()
    items = resp.json()
    results = []

    for ds in items:
        results.append({
            "id": ds.get("id"),
            "downloads": ds.get("downloads", 0),
            "likes": ds.get("likes", 0),
            "tags": ds.get("tags", [])[:5],
            "url": f"https://huggingface.co/datasets/{ds.get('id')}",
        })

    return results


def search_models(query: str, max_results: int = 5) -> list[dict]:
    """Search HuggingFace models (no key needed)."""
    resp = requests.get(
        f"{HF_API}/models",
        params={"search": query, "limit": max_results, "sort": "downloads"},
        timeout=10,
    )
    resp.raise_for_status()
    items = resp.json()
    results = []

    for model in items:
        results.append({
            "id": model.get("id"),
            "pipeline_tag": model.get("pipeline_tag", "unknown"),
            "downloads": model.get("downloads", 0),
            "likes": model.get("likes", 0),
            "url": f"https://huggingface.co/{model.get('id')}",
        })

    return results
