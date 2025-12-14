from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Depends
from fastapi.security import HTTPBearer
from typing import List
import time
from ...models.voiceprint import VoiceprintRegisterResponse, VoiceprintIdentifyResponse
from ...services.voiceprint_service import voiceprint_service
from ...api.dependencies import AuthorizationToken
from ...core.logger import get_logger

# 创建安全模式
security = HTTPBearer(description="接口令牌")

logger = get_logger(__name__)

router = APIRouter()


@router.post(
    "/register",
    summary="声纹注册",
    response_model=VoiceprintRegisterResponse,
    description="注册新的声纹特征",
    dependencies=[Depends(security)],
)
async def register_voiceprint(
    token: AuthorizationToken,
    speaker_id: str = Form(..., description="说话人ID"),
    file: UploadFile = File(..., description="WAV音频文件"),
):
    """
    注册声纹接口

    Args:
        token: 接口令牌（Header）
        speaker_id: 说话人ID
        file: 说话人音频文件（WAV）

    Returns:
        VoiceprintRegisterResponse: 注册结果
    """
    try:
        # 验证文件类型
        if not file.filename.lower().endswith(".wav"):
            raise HTTPException(status_code=400, detail="只支持WAV格式音频文件")

        # 读取音频数据
        audio_bytes = await file.read()

        # 注册声纹
        success = voiceprint_service.register_voiceprint(speaker_id, audio_bytes)

        if success:
            return VoiceprintRegisterResponse(success=True, msg=f"已登记: {speaker_id}")
        else:
            raise HTTPException(status_code=500, detail="声纹注册失败")

    except HTTPException:
        raise
    except Exception as e:
        logger.fail(f"声纹注册异常: {e}")
        raise HTTPException(status_code=500, detail=f"声纹注册失败: {str(e)}")


@router.post(
    "/identify",
    summary="声纹识别",
    response_model=VoiceprintIdentifyResponse,
    description="识别音频中的说话人",
    dependencies=[Depends(security)],
)
async def identify_voiceprint(
    token: AuthorizationToken,
    speaker_ids: str = Form(..., description="候选说话人ID，逗号分隔"),
    file: UploadFile = File(..., description="WAV音频文件"),
):
    """
    声纹识别接口

    Args:
        token: 接口令牌（Header）
        speaker_ids: 候选说话人ID，逗号分隔
        file: 待识别音频文件（WAV）

    Returns:
        VoiceprintIdentifyResponse: 识别结果
    """
    start_time = time.time()
    logger.info(f"开始声纹识别请求 - 候选说话人: {speaker_ids}, 文件: {file.filename}")

    try:
        # 验证文件类型
        validation_start = time.time()
        if not file.filename.lower().endswith(".wav"):
            raise HTTPException(status_code=400, detail="只支持WAV格式音频文件")
        validation_time = time.time() - validation_start
        logger.info(f"文件类型验证完成，耗时: {validation_time:.3f}秒")

        # 解析候选说话人ID
        parse_start = time.time()
        candidate_ids = [x.strip() for x in speaker_ids.split(",") if x.strip()]
        if not candidate_ids:
            raise HTTPException(status_code=400, detail="候选说话人ID不能为空")
        parse_time = time.time() - parse_start
        logger.info(
            f"候选说话人ID解析完成，共{len(candidate_ids)}个，耗时: {parse_time:.3f}秒"
        )

        # 读取音频数据
        read_start = time.time()
        audio_bytes = await file.read()
        read_time = time.time() - read_start
        logger.info(
            f"音频文件读取完成，大小: {len(audio_bytes)}字节，耗时: {read_time:.3f}秒"
        )

        # 识别声纹
        identify_start = time.time()
        logger.info("开始调用声纹识别服务...")
        match_name, match_score = voiceprint_service.identify_voiceprint(
            candidate_ids, audio_bytes
        )
        identify_time = time.time() - identify_start
        logger.info(f"声纹识别服务调用完成，耗时: {identify_time:.3f}秒")

        total_time = time.time() - start_time
        logger.info(
            f"声纹识别请求完成，总耗时: {total_time:.3f}秒，识别结果: {match_name}, 分数: {match_score:.4f}"
        )

        return VoiceprintIdentifyResponse(speaker_id=match_name, score=match_score)

    except HTTPException:
        total_time = time.time() - start_time
        logger.error(f"声纹识别请求失败，总耗时: {total_time:.3f}秒")
        raise
    except Exception as e:
        total_time = time.time() - start_time
        logger.error(f"声纹识别异常，总耗时: {total_time:.3f}秒，错误: {e}")
        raise HTTPException(status_code=500, detail=f"声纹识别失败: {str(e)}")


@router.delete(
    "/{speaker_id}",
    summary="删除声纹",
    description="删除指定说话人的声纹特征",
    dependencies=[Depends(security)],
)
async def delete_voiceprint(
    token: AuthorizationToken,
    speaker_id: str,
):
    """
    删除声纹接口

    Args:
        token: 接口令牌（Header）
        speaker_id: 说话人ID

    Returns:
        dict: 删除结果
    """
    try:
        success = voiceprint_service.delete_voiceprint(speaker_id)

        if success:
            return {"success": True, "msg": f"已删除: {speaker_id}"}
        else:
            raise HTTPException(status_code=404, detail=f"未找到说话人: {speaker_id}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除声纹异常 {speaker_id}: {e}")
        raise HTTPException(status_code=500, detail=f"删除声纹失败: {str(e)}")
