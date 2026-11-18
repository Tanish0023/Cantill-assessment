from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db, SessionLocal
from app.controllers.data_controller import DataController
from app.api.endpoints.data import router as data_router
from app.api.endpoints.rankings import router as rankings_router
from app.api.endpoints.batch import router as batch_router
from app.api.endpoints.chat import router as chat_router
from app.api.endpoints.policies import router as policies_router
from app.api.endpoints.contracts import router as contracts_router
from app.api.endpoints.buyer import router as buyer_router

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
    expose_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()
    db = SessionLocal()
    try:
        data_ctrl = DataController(db)
        if data_ctrl.get_stats()["items"] == 0:
            data_ctrl.import_all()
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
app.include_router(chat_router, prefix=f"{settings.API_V1_STR}/chat", tags=["chat"])
app.include_router(policies_router, prefix=f"{settings.API_V1_STR}/policies", tags=["policies"])
app.include_router(contracts_router, prefix=f"{settings.API_V1_STR}/contracts", tags=["contracts"])
app.include_router(buyer_router, prefix=f"{settings.API_V1_STR}/buyer", tags=["buyer"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
