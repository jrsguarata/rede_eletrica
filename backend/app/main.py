import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import AsyncSessionLocal
from app.api.bdgd import router as bdgd_router, carregar_tabelas_permitidas
from app.auth import router as auth_router, cleanup_expired_sessions


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: carregar tabelas permitidas
    async with AsyncSessionLocal() as db:
        await carregar_tabelas_permitidas(db)
        print("✓ Tabelas permitidas carregadas")

    # Cleanup de sessões expiradas a cada 30 minutos
    async def session_cleanup_loop():
        while True:
            await asyncio.sleep(1800)
            cleanup_expired_sessions()

    cleanup_task = asyncio.create_task(session_cleanup_loop())

    yield

    # Shutdown
    cleanup_task.cancel()
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
app.include_router(auth_router)
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
