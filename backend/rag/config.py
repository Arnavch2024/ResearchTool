"""Central configuration: model identifiers and the shared Groq client factory.

Model names and client construction previously lived in both `pipeline` and
`app`; keeping them here means a single place to change and one client cache.
"""

import os
from typing import Optional

from groq import Groq

# Model identifiers (override via env for deployments)
LLM_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
FAST_MODEL = os.environ.get("GROQ_FAST_MODEL", "openai/gpt-oss-20b")

_groq_client: Optional[Groq] = None


def get_groq(api_key: Optional[str] = None) -> Groq:
    """Return a Groq client, prioritizing a user-provided per-request API key.

    Falls back to a process-wide client built from $GROQ_API_KEY.
    """
    if api_key and api_key.strip():
        return Groq(api_key=api_key.strip())
    global _groq_client
    if _groq_client is None:
        default_key = os.environ.get("GROQ_API_KEY")
        if not default_key:
            raise ValueError("No Groq API key provided. Please configure your Groq API key in Settings.")
        _groq_client = Groq(api_key=default_key)
    return _groq_client
