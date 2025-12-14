"""
API 路由聚合
"""
from fastapi import APIRouter
from app.api.v1 import asr, tts, health

api_router = APIRouter()

api_router.include_router(asr.router)
api_router.include_router(tts.router)
api_router.include_router(health.router)

