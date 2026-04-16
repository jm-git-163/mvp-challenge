from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import edit, analyze

app = FastAPI(title="MVP Video API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(edit.router, prefix="/edit", tags=["edit"])
app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])


@app.get("/health")
def health():
    return {"status": "ok"}
