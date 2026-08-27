from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

app = FastAPI()

# Loaded once at startup, reused across requests — loading this model per
# request would be far too slow.
model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

class Candidate(BaseModel):
    id: str
    content: str


class RerankRequest(BaseModel):
    query: str
    candidates: list[Candidate]
    top_k: int = 5


class RerankedResult(BaseModel):
    id: str
    score: float


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/rerank")
def rerank(req: RerankRequest) -> list[RerankedResult]:
    pairs = [(req.query, c.content) for c in req.candidates]
    scores = model.predict(pairs)

    scored = list(zip(req.candidates, scores))
    scored.sort(key=lambda x: x[1], reverse=True)

    return [
        RerankedResult(id=c.id, score=float(s))
        for c, s in scored[: req.top_k]
    ]