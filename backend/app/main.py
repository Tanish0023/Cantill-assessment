from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db, SessionLocal
from app.models import Item
from app.services.data_import import import_all_master_data
from app.api.endpoints.data import router as data_router
from app.api.endpoints.rankings import router as rankings_router
from app.api.endpoints.batch import router as batch_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()
    db = SessionLocal()
    try:
        if db.query(Item).count() == 0:
            import_all_master_data(db)
    finally:
        db.close()

@app.get("/health")
def health():
    return {"status": "healthy", "service": settings.PROJECT_NAME}

@app.get(f"{settings.API_V1_STR}/health")
def api_health():
    return {"status": "healthy", "version": "1.0.0"}

app.include_router(data_router, prefix=f"{settings.API_V1_STR}/data", tags=["data"])
app.include_router(rankings_router, prefix=f"{settings.API_V1_STR}/rankings", tags=["rankings"])
app.include_router(batch_router, prefix=settings.API_V1_STR, tags=["batch"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
