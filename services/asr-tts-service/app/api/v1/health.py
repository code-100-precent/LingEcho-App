"""
健康检查端点
"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/health", tags=["Health"])


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    service: str
    version: str


@router.get("", response_model=HealthResponse)
async def health_check():
    """健康检查"""
    from app.core.config import settings
    
    return HealthResponse(
        status="healthy",
        service=settings.title,
        version=settings.version,
    )

