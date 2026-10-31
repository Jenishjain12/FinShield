from __future__ import annotations

import math
import re
from collections import Counter

TOKEN_RE = re.compile(r"[a-z0-9]{3,}")
STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "your",
    "you",
    "our",
    "are",
    "from",
    "investment",
    "invest",
    "money",
    "call",
    "now",
    "today",
    "apply",
    "click",
    "visit",
    "account",
    "bank",
    "loan",
    "offer",
    "free",
    "best",
    "get",
    "http",
    "https",
    "www",
    "com",
}


def tokenize(text: str) -> list[str]:
    return [token for token in TOKEN_RE.findall(text.lower()) if token not in STOPWORDS]


def tfidf_vectors(documents: list[str]) -> list[dict[str, float]]:
    tokenized = [tokenize(doc) for doc in documents]
    df: Counter[str] = Counter()
    for tokens in tokenized:
        df.update(set(tokens))
    n = len(documents) or 1
    vectors: list[dict[str, float]] = []
    for tokens in tokenized:
        tf = Counter(tokens)
        length = len(tokens) or 1
        vector: dict[str, float] = {}
        for term, count in tf.items():
            idf = math.log((1 + n) / (1 + df[term])) + 1
            vector[term] = (count / length) * idf
        vectors.append(vector)
    return vectors


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    shared = set(a) & set(b)
    if not shared:
        return 0.0
    numerator = sum(a[term] * b[term] for term in shared)
    denom = math.sqrt(sum(v * v for v in a.values())) * math.sqrt(sum(v * v for v in b.values()))
    if denom == 0:
        return 0.0
    return numerator / denom


def text_similarity(a: str, b: str) -> float:
    vectors = tfidf_vectors([a, b])
    return cosine(vectors[0], vectors[1])
