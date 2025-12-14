"""
FastAPI 应用主文件
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logger import setup_logging, get_logger
from app.api.v1.api import api_router

# 设置日志
setup_logging()
logger = get_logger(__name__)

# 创建 FastAPI 应用
app = FastAPI(
    title=settings.title,
    version=settings.version,
    description="ASR (语音识别) 和 TTS (文本转语音) 服务",
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    """启动事件"""
    logger.info(f"{settings.title} v{settings.version} 启动成功")
    logger.info(f"服务地址: http://{settings.host}:{settings.port}")
    logger.info(f"API 文档: http://{settings.host}:{settings.port}/docs")


@app.on_event("shutdown")
async def shutdown_event():
    """关闭事件"""
    logger.info(f"{settings.title} 正在关闭...")

