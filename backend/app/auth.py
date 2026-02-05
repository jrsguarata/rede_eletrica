import uuid
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Request, Response, HTTPException, Depends

from app.config import settings

# Sessões in-memory: {session_id: {user_data + expires_at}}
sessions: dict[str, dict] = {}

SESSION_DURATION = 8 * 60 * 60  # 8 horas
COOKIE_NAME = "session_id"


def create_session(user_data: dict) -> str:
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        **user_data,
        "expires_at": time.time() + SESSION_DURATION,
    }
    return session_id


def get_session(session_id: str) -> Optional[dict]:
    session = sessions.get(session_id)
    if not session:
        return None
    if time.time() > session["expires_at"]:
        sessions.pop(session_id, None)
        return None
    return session


def destroy_session(session_id: str) -> None:
    sessions.pop(session_id, None)


def cleanup_expired_sessions() -> None:
    now = time.time()
    expired = [sid for sid, data in sessions.items() if now > data["expires_at"]]
    for sid in expired:
        del sessions[sid]


async def get_current_user(request: Request) -> dict:
    """Dependency que valida sessão via cookie. Retorna user ou 401."""
    session_id = request.cookies.get(COOKIE_NAME)
    if not session_id:
        raise HTTPException(status_code=401, detail="Nao autenticado")

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Sessao expirada")

    return {
        "id": session["id"],
        "email": session["email"],
        "name": session["name"],
        "role": session["role"],
        "companyId": session.get("companyId"),
        "returnUrl": session.get("returnUrl", ""),
    }


# ============================================
# ROUTER
# ============================================

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/sso")
async def sso_login(request: Request, response: Response):
    """Recebe sso_token, valida com SignOn, cria sessão local."""
    body = await request.json()
    sso_token = body.get("sso_token")

    if not sso_token:
        raise HTTPException(status_code=400, detail="sso_token obrigatorio")

    async with httpx.AsyncClient() as client:
        try:
            sso_response = await client.post(
                f"{settings.SSO_API_URL}/api/auth/validate",
                json={"token": sso_token},
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": settings.SSO_API_KEY,
                },
                timeout=10.0,
            )
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Erro ao conectar ao SignOn")

    if sso_response.status_code != 200:
        error_msg = "Token SSO invalido"
        try:
            error_data = sso_response.json()
            error_msg = error_data.get("error", error_msg)
        except Exception:
            pass
        raise HTTPException(status_code=401, detail=error_msg)

    data = sso_response.json()
    if not data.get("success") or not data.get("data", {}).get("valid"):
        raise HTTPException(status_code=401, detail="Token SSO invalido")

    user = data["data"]["user"]

    return_url = body.get("return_url", "")

    session_id = create_session({
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "companyId": user.get("companyId"),
        "returnUrl": return_url,
    })

    response.set_cookie(
        key=COOKIE_NAME,
        value=session_id,
        httponly=True,
        samesite="lax",
        secure=False,  # True em produção com HTTPS
        max_age=SESSION_DURATION,
        path="/",
    )

    return {
        "success": True,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "returnUrl": return_url,
        },
    }


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Retorna o usuário autenticado da sessão atual."""
    return {"user": user}


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Destrói a sessão e limpa o cookie."""
    session_id = request.cookies.get(COOKIE_NAME)
    if session_id:
        destroy_session(session_id)

    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"success": True}
