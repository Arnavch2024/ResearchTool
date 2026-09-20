import requests

HF_DAILY_PAPERS_API = "https://huggingface.co/api/daily_papers"


def search_benchmarks_and_sota(query: str = "", max_results: int = 6) -> list[dict]:
    """
    Search state-of-the-art (SOTA) research papers, benchmarks, and official codebases.
    Powered by Hugging Face Daily Papers & SOTA Evaluation Graph.
    """
    headers = {
        "User-Agent": "ResearchRAG-Assistant/1.0 (academic benchmarking & sota tracker)"
    }

    try:
        resp = requests.get(HF_DAILY_PAPERS_API, headers=headers, timeout=12)
        if resp.status_code != 200:
            return []

        data = resp.json()
        raw_papers = [item.get("paper") for item in data if item.get("paper")]

        q = (query or "").strip().lower()

        # If a query is provided, filter by keyword matching in title, summary, or org
        if q:
            words = [w for w in q.split() if len(w) > 2]
            matched = []
            for p in raw_papers:
                title = (p.get("title") or "").lower()
                summary = (p.get("summary") or "").lower()
                org = ((p.get("organization") or {}).get("name") or "").lower()

                score = 0
                for w in words:
                    if w in title:
                        score += 3
                    elif w in org:
                        score += 2
                    elif w in summary:
                        score += 1

                if score > 0:
                    matched.append((score, p))

            matched.sort(key=lambda x: (x[0], x[1].get("upvotes", 0)), reverse=True)
            selected = [p for _, p in matched[:max_results]]
        else:
            # Return top trending by upvotes
            raw_papers.sort(key=lambda p: p.get("upvotes", 0), reverse=True)
            selected = raw_papers[:max_results]

        # If query returned fewer than max_results, supplement with top trending
        if len(selected) < max_results and not q:
            remaining = [p for p in raw_papers if p not in selected]
            selected.extend(remaining[:max_results - len(selected)])

        results = []
        for p in selected:
            paper_id = p.get("id", "")
            title = p.get("title", "")
            summary = p.get("summary", "")
            upvotes = p.get("upvotes", 0)
            published = (p.get("publishedAt") or "")[:10]
            project_page = p.get("projectPage") or ""
            media_urls = p.get("mediaUrls") or []
            media_url = media_urls[0] if media_urls else ""

            org_obj = p.get("organization") or {}
            org_name = org_obj.get("fullname") or org_obj.get("name") or ""

            authors = [a.get("name") for a in (p.get("authors") or []) if isinstance(a, dict) and a.get("name")]

            results.append({
                "id": paper_id,
                "title": title,
                "summary": summary[:350] + "..." if len(summary) > 350 else summary,
                "abstract": summary,
                "upvotes": upvotes,
                "published": published,
                "org": org_name,
                "project_page": project_page,
                "media_url": media_url,
                "authors": authors[:4],
                "url": f"https://huggingface.co/papers/{paper_id}",
                "pdf_url": f"https://arxiv.org/pdf/{paper_id}",
                "source": "sota_benchmarks",
            })

        return results
    except Exception as e:
        print(f"[SOTA Benchmarks Tool Error]: {e}")
        return []
