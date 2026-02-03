from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import AsyncSessionLocal
from app.api.bdgd import router as bdgd_router, carregar_tabelas_permitidas


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: carregar tabelas permitidas
    async with AsyncSessionLocal() as db:
        await carregar_tabelas_permitidas(db)
        print("✓ Tabelas permitidas carregadas")
    yield
    # Shutdown
    print("Encerrando aplicação...")


app = FastAPI(
    title="API BDGD - Rede Elétrica",
    description="API para visualização dos dados do BDGD",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas
app.include_router(bdgd_router)


@app.get("/")
async def root():
    return {
        "message": "API BDGD - Rede Elétrica",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
