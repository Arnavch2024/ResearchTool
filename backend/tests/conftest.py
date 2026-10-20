"""Shared pytest configuration for the Research RAG backend test-suite.

Puts the backend package root on ``sys.path`` so tests can ``import security``,
``import auth`` and ``import rag.*`` no matter which directory pytest is run
from (e.g. ``pytest`` from ``backend/`` or ``pytest backend/tests`` from the
repo root).
"""

import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
