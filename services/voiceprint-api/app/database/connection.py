import pymysql
from typing import Optional
from contextlib import contextmanager
from ..core.config import settings
from ..core.logger import get_logger

logger = get_logger(__name__)


class DatabaseConnection:
    """数据库连接管理类"""

    def __init__(self):
        self._connection: Optional[pymysql.Connection] = None
        self._connect()

    def _connect(self) -> None:
        """建立数据库连接"""
        try:
            mysql_config = settings.mysql
            password = (
                str(mysql_config["password"])
                if mysql_config["password"] is not None
                else ""
            )

            self._connection = pymysql.connect(
                host=mysql_config["host"],
                port=mysql_config["port"],
                user=mysql_config["user"],
                password=password,
                database=mysql_config["database"],
                charset="utf8mb4",
                autocommit=True,
                # 连接池配置，提高并发性能
                max_allowed_packet=16777216,  # 16MB
                connect_timeout=10,
                read_timeout=30,
                write_timeout=30,
            )
            logger.success("数据库连接成功")
        except Exception as e:
            logger.fail(f"数据库连接失败: {e}")
            raise

    @contextmanager
    def get_cursor(self):
        """获取数据库游标的上下文管理器"""
        if not self._connection or not self._connection.open:
            self._connect()

        cursor = None
        try:
            cursor = self._connection.cursor()
            yield cursor
        except Exception as e:
            logger.fail(f"数据库操作失败: {e}")
            if self._connection:
                self._connection.rollback()
            raise
        finally:
            if cursor:
                cursor.close()

    def close(self) -> None:
        """关闭数据库连接"""
        if self._connection and self._connection.open:
            self._connection.close()
            logger.info("数据库连接已关闭")

    def __del__(self):
        """析构函数，确保连接被关闭"""
        try:
            self.close()
        except:
            pass  # 忽略析构时的异常


# 全局数据库连接实例
db_connection = DatabaseConnection()
