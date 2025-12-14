"""
服务启动入口
"""
from app.core.logger import setup_logging, get_logger

# 设置日志（只调用一次）
setup_logging()

import socket
import uvicorn
from app.core.config import settings

# 设置日志
logger = get_logger(__name__)


def get_local_ip() -> str:
    """获取本机IP地址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "127.0.0.1"


if __name__ == "__main__":
    try:
        logger.info(f"开发环境服务启动，监听地址: {settings.host}:{settings.port}")
        logger.info(f"API文档: http://{settings.host}:{settings.port}/docs")
        logger.info("=" * 60)
        local_ip = get_local_ip()
        logger.info(f"服务地址: http://{local_ip}:{settings.port}/api/v1")
        logger.info("=" * 60)

        # 启动服务
        uvicorn.run(
            "app.application:app",
            host=settings.host,
            port=settings.port,
            reload=True,  # 开发环境开启热重载
            workers=1,  # 单进程模式，避免模型重复加载
            access_log=False,  # 关闭uvicorn自带access日志
            log_level="info",
        )
    except KeyboardInterrupt:
        logger.info("收到中断信号，正在退出服务。")
    except Exception as e:
        logger.error(f"服务启动失败: {e}")
        raise

