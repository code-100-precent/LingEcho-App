import React, { useEffect, useState, useRef } from 'react';
import TransparentCanvas, { TransparentCanvasRef } from '@/components/DesktopPet/TransparentCanvas';
import { Phone, PhoneOff, Settings, LogIn, Bot } from 'lucide-react';
import { getAssistantList, AssistantListItem, getAssistantJS, oneShotAudio, getAudioStatus } from '@/api/assistant';

const DesktopPetWindow: React.FC = () => {
    // 通话状态管理
    const [isCalling, setIsCalling] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [callTimer, setCallTimer] = useState<NodeJS.Timeout | null>(null);
    
    // 通话方式配置
    type VoiceMode = 'webrtc' | 'websocket' | 'http';
    const [voiceMode, setVoiceMode] = useState<VoiceMode>('webrtc');
    const [showConfigPanel, setShowConfigPanel] = useState(false);

    // WebRTC相关状态
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [pendingCandidates, setPendingCandidates] = useState<any[]>([]);
    
    // HTTP录音相关状态
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

    // 按钮显示状态
    const [showButtons, setShowButtons] = useState(false);
    
    // 登录提示状态
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);

    // 聊天消息状态（用于清空聊天记录）
    const [, setChatMessages] = useState<any[]>([]);

    // 助手相关状态
    const [assistants, setAssistants] = useState<AssistantListItem[]>([]);
    const [selectedAssistant, setSelectedAssistant] = useState<AssistantListItem | null>(null);
    const [showAssistantList, setShowAssistantList] = useState(false);
    
    // 自定义助手相关状态
    const [customAssistantJS, setCustomAssistantJS] = useState<string | null>(null);
    const [isLoadingCustomAssistant, setIsLoadingCustomAssistant] = useState(false);
    const [customAssistantError, setCustomAssistantError] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // 桌宠动画引用
    const petRef = useRef<TransparentCanvasRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 检查登录状态的函数
    const checkAuthStatus = () => {
        const token = localStorage.getItem('auth_token');
        return !!token;
    };




    // 组件挂载日志
    useEffect(() => {
        console.log('桌宠窗口组件挂载');
    }, []);

    // 获取助手列表
    const fetchAssistants = async () => {
        try {
            const response = await getAssistantList();
            if (response.data) {
                setAssistants(response.data);
                // 默认选择第一个助手
                if (response.data.length > 0 && !selectedAssistant) {
                    setSelectedAssistant(response.data[0]);
                }
            }
        } catch (error) {
            console.error('获取助手列表失败:', error);
        }
    };

    // 设置页面标题和透明样式
    useEffect(() => {
        document.title = '桌宠 - 声驭智核';

        // 设置整个页面的透明样式
        document.body.style.backgroundColor = 'transparent';
        document.body.style.background = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';
        document.documentElement.style.background = 'transparent';

        // 移除任何可能影响透明的样式
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';

        // 确保根元素也是透明的
        const rootElement = document.getElementById('root');
        if (rootElement) {
            rootElement.style.backgroundColor = 'transparent';
            rootElement.style.background = 'transparent';
        }

        // 添加特殊的透明样式类
        document.body.classList.add('desktop-pet-transparent');
        document.documentElement.classList.add('desktop-pet-transparent');

        console.log('DesktopPetWindow: 加载完成，透明模式已启用');
    }, []);

    // 获取助手列表
    useEffect(() => {
        if (checkAuthStatus()) {
            fetchAssistants();
        }
    }, []);

    // 从localStorage恢复选择的助手
    useEffect(() => {
        const savedAssistant = localStorage.getItem('selectedAssistant');
        if (savedAssistant) {
            try {
                const assistant = JSON.parse(savedAssistant) as AssistantListItem;
                setSelectedAssistant(assistant);
                
                // 先确保清理状态
                setCustomAssistantJS(null);
                setCustomAssistantError(null);
                setIsLoadingCustomAssistant(false);
                
                // 如果助手有JsSourceId，加载自定义JS
                if (assistant.jsSourceId && assistant.jsSourceId.trim() !== '') {
                    console.log('恢复自定义助手JS，ID:', assistant.jsSourceId);
                    // 延迟加载，确保状态清理完成
                    setTimeout(() => {
                        loadCustomAssistantJS(assistant.jsSourceId);
                    }, 100);
                } else {
                    console.log('使用默认桌宠，JsSourceId为空');
                    setCustomAssistantJS(null);
                }
                
                // 标记为已初始化
                setIsInitialized(true);
            } catch (error) {
                console.error('恢复选择的助手失败:', error);
                localStorage.removeItem('selectedAssistant');
                setIsInitialized(true);
            }
        } else {
            // 没有保存的助手，使用默认状态
            setIsInitialized(true);
        }
    }, [assistants]); // 依赖assistants，确保助手列表加载完成后再恢复

    // 组件初始化时清理可能残留的自定义JS元素
    useEffect(() => {
        // 延迟清理，确保DOM完全加载
        const timer = setTimeout(() => {
            clearCustomAssistantJS();
        }, 500);
        
        return () => {
            clearTimeout(timer);
        };
    }, []);


    // 处理动画完成事件
    const handleAnimationComplete = (animationName: string) => {
        console.log(`动画完成: ${animationName}`);
    };

    // 处理桌宠点击事件 - 切换动画状态
    const handlePetClick = () => {
        if (!checkAuthStatus()) {
            setShowLoginPrompt(true);
            return;
        }
        
        if (petRef.current) {
            petRef.current.playNextAnimation();
            console.log('桌宠被点击，切换到下一个动画状态');
        }
    };

    // 连接七牛云语音服务
    const connectQiniuVoice = () => {
        // 先关闭现有连接
        if (socket && socket.readyState !== WebSocket.CLOSED) {
            socket.close();
        }

        // 获取认证token
        const token = localStorage.getItem('auth_token') || 'test-token-123';
        
        // 连接七牛云语音WebSocket
        const wsUrl = `ws://localhost:7072/api/voice/qiniu?assistantId=${selectedAssistant?.id || 1}&token=${token}`;
        const newSocket = new WebSocket(wsUrl);

        newSocket.onopen = async () => {
            console.log('[桌宠七牛云语音] WebSocket已连接');
            
            try {
                // 获取麦克风权限
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                
                setLocalStream(stream);
                
                // 开始实时录音和发送
                startQiniuRecording(stream, newSocket);
                
                console.log('[桌宠七牛云语音] 连接已建立');
            } catch (error) {
                console.error('[桌宠七牛云语音] 获取麦克风失败:', error);
            }
        };

        newSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[桌宠七牛云语音] 收到消息:', data);
                
                switch (data.type) {
                    case 'asr_result':
                        // 显示识别结果
                        console.log('[桌宠七牛云语音] ASR结果:', data.text);
                        break;
                    case 'llm_response':
                        // 显示LLM回复
                        console.log('[桌宠七牛云语音] LLM回复:', data.text);
                        break;
                    case 'tts_audio':
                        // 播放TTS音频
                        if (data.audioUrl) {
                            const audio = new Audio(data.audioUrl);
                            audio.play().catch(err => {
                                console.error('[桌宠七牛云语音] 播放音频失败:', err);
                            });
                        }
                        break;
                    case 'error':
                        console.error('[桌宠七牛云语音] 错误:', data.message);
                        break;
                }
            } catch (error) {
                console.error('[桌宠七牛云语音] 消息解析失败:', error);
            }
        };

        newSocket.onerror = (error) => {
            console.error('[桌宠七牛云语音] WebSocket错误:', error);
        };

        newSocket.onclose = () => {
            console.log('[桌宠七牛云语音] WebSocket连接关闭');
        };

        setSocket(newSocket);
    };

    // 开始七牛云录音 - 使用Web Audio API获取PCM数据
    const startQiniuRecording = (stream: MediaStream, ws: WebSocket) => {
        console.log('[桌宠七牛云语音] 开始录音，使用Web Audio API获取PCM数据');
        
        try {
            // 创建AudioContext
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 16000 // 设置采样率为16kHz
            });
            
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (event) => {
                // 检查WebSocket连接状态
                if (ws.readyState !== WebSocket.OPEN) {
                    console.log('[桌宠七牛云语音] WebSocket已关闭，停止发送音频数据');
                    return;
                }
                
                const inputBuffer = event.inputBuffer;
                const pcmData = inputBuffer.getChannelData(0);
                
                // 转换为PCM16格式
                const pcm16Data = new Int16Array(pcmData.length);
                for (let i = 0; i < pcmData.length; i++) {
                    // 将float32 (-1.0 到 1.0) 转换为int16 (-32768 到 32767)
                    pcm16Data[i] = Math.max(-32768, Math.min(32767, pcmData[i] * 32768));
                }
                
                // 发送PCM数据
                console.log('[桌宠七牛云语音] 发送PCM音频数据，大小:', pcm16Data.byteLength);
                try {
                    ws.send(pcm16Data.buffer);
                } catch (error) {
                    console.error('[桌宠七牛云语音] 发送音频数据失败:', error);
                }
            };
            
            // 连接音频处理链
            source.connect(processor);
            processor.connect(audioContext.destination);
            
            // 保存引用以便清理
            (window as any).qiniuAudioContext = audioContext;
            (window as any).qiniuProcessor = processor;
            
        } catch (error) {
            console.error('[桌宠七牛云语音] 录音启动失败:', error);
            // 降级到MediaRecorder方式
            startQiniuRecordingFallback(stream, ws);
        }
    };

    // 七牛云录音降级方案 - 使用MediaRecorder
    const startQiniuRecordingFallback = (stream: MediaStream, ws: WebSocket) => {
        console.log('[桌宠七牛云语音] 使用MediaRecorder降级方案');
        
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                const reader = new FileReader();
                reader.onload = () => {
                    const arrayBuffer = reader.result as ArrayBuffer;
                    console.log('[桌宠七牛云语音] 发送WebM音频数据，大小:', arrayBuffer.byteLength);
                    ws.send(arrayBuffer);
                };
                reader.readAsArrayBuffer(event.data);
            }
        };
        
        mediaRecorder.start(100); // 每100ms发送一次数据
    };

    // HTTP轮询方式
    const startHttpPollingCall = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            const chunks: BlobPart[] = [];

            mediaRecorder.ondataavailable = (event) => {
                chunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(chunks, { type: 'audio/wav' });
                const formData = new FormData();
                formData.append('audio', audioBlob, 'recording.wav');
                formData.append('assistantId', (selectedAssistant?.id || 1).toString());
                formData.append('language', 'zh-cn');

                try {
                    console.log('[桌宠HTTP轮询] 发送音频数据，大小:', audioBlob.size);
                    const response = await oneShotAudio(formData);
                    console.log('[桌宠HTTP轮询] 收到响应:', response);
                    
                    if (response.data?.requestId) {
                        console.log('[桌宠HTTP轮询] 开始轮询音频状态，requestId:', response.data.requestId);
                        // 开始轮询获取音频状态
                        pollAudioStatus(response.data.requestId, `assistant_${Date.now()}`);
                    }
                } catch (error) {
                    console.error('[桌宠HTTP轮询] 发送音频失败:', error);
                }
            };

            mediaRecorder.start();
            setMediaRecorder(mediaRecorder); // 保存引用以便手动停止
            
            // 最多10秒后自动停止录音（用户可以提前结束）
            setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, 10000);

        } catch (error) {
            console.error('HTTP轮询通话启动失败:', error);
        }
    };

    // 轮询音频状态
    const pollAudioStatus = async (requestId: string, _messageId: string) => {
        console.log('[桌宠HTTP轮询] 开始轮询音频状态，requestId:', requestId);
        
        const pollInterval = setInterval(async () => {
            try {
                const status = await getAudioStatus(requestId);
                console.log('[桌宠HTTP轮询] 音频状态:', status);
                
                if (status.data?.status === 'completed') {
                    clearInterval(pollInterval);
                    console.log('[桌宠HTTP轮询] 音频处理完成');
                    
                    if (status.data?.audioUrl) {
                        // 播放TTS音频
                        const audio = new Audio(status.data.audioUrl);
                        audio.play().catch(err => {
                            console.error('[桌宠HTTP轮询] 播放音频失败:', err);
                        });
                    }
                } else if (status.data?.status === 'failed') {
                    clearInterval(pollInterval);
                    console.error('[桌宠HTTP轮询] 音频处理失败');
                }
            } catch (error) {
                console.error('[桌宠HTTP轮询] 轮询状态失败:', error);
            }
        }, 1000); // 每秒轮询一次
        
        // 30秒后停止轮询
        setTimeout(() => {
            clearInterval(pollInterval);
            console.log('[桌宠HTTP轮询] 轮询超时，停止轮询');
        }, 30000);
    };

    // 连接WebSocket (WebRTC方式)
    const connectWebSocket = () => {
        // 先关闭现有连接
        if (socket && socket.readyState !== WebSocket.CLOSED) {
            socket.close();
        }

        // 将认证信息作为查询参数添加到URL中
        const apiKey = "1234567";
        const apiSecret = "1234567";
        const wsUrl = `ws://localhost:7072/api/chat/call?apiKey=${apiKey}&apiSecret=${apiSecret}`;
        const newSocket = new WebSocket(wsUrl);

        newSocket.onopen = async () => {
            console.log('[桌宠WebSocket] 已连接');

            try {
                // 1. 创建 RTCPeerConnection
                const newPeerConnection = new RTCPeerConnection({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' } // 公共 STUN 服务器
                    ]
                });

                // 2. 获取麦克风音频
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                    }
                });

                stream.getTracks().forEach(track => {
                    newPeerConnection.addTrack(track, stream);
                });

                // 3. 收集 ICE 候选，并发送给后端
                newPeerConnection.onicecandidate = (event) => {
                    if (event.candidate && newSocket.readyState === WebSocket.OPEN) {
                        newSocket.send(JSON.stringify({
                            type: 'ice-candidate',
                            candidate: event.candidate
                        }));
                    }
                };

                newPeerConnection.ontrack = (event) => {
                    const remoteAudio = new Audio();
                    remoteAudio.srcObject = event.streams[0];
                    remoteAudio.play().catch(err => {
                        console.error('[桌宠WebRTC] 播放远端音频失败:', err);
                    });
                };

                newPeerConnection.onconnectionstatechange = () => {
                    switch (newPeerConnection.connectionState) {
                        case 'connected':
                            console.log('[桌宠WebRTC] 已连接');
                            break;
                        case 'disconnected':
                        case 'failed':
                        case 'closed':
                            console.log('[桌宠WebRTC] 连接关闭/失败');
                            break;
                    }
                };

                // 4. 创建 offer
                const offer = await newPeerConnection.createOffer();
                await newPeerConnection.setLocalDescription(offer);

                // 5. 发送 offer to websocket
                if (newSocket.readyState === WebSocket.OPEN) {
                    newSocket.send(JSON.stringify({
                        type: 'offer',
                        sdp: offer.sdp,
                        assistantId: selectedAssistant?.id || 1, // 使用选中的助手ID
                        instruction: "请以清晰、专业的方式回答用户的提问，尽量提供步骤化的解决方案。",
                        language: "zh-cn",
                        maxTokens: 50,
                        personaTag: "技术支持",
                        speaker: "101016",
                        speed: 1,
                        systemPrompt: "你是一个专业的技术支持工程师，专注于帮助用户解决技术相关的问题。",
                        temperature: 0.6,
                        volume: 5,
                    }));
                }

                setPeerConnection(newPeerConnection);
                setLocalStream(stream);

                // 设置WebSocket消息处理
                newSocket.onmessage = async (event) => {
                    console.log('[桌宠WebSocket] 收到消息:', event.data);
                    const data = JSON.parse(event.data);

                    switch (data.type) {
                        case 'answer':
                            if (newPeerConnection && data.sdp) {
                                const remoteDesc = new RTCSessionDescription({
                                    type: 'answer',
                                    sdp: data.sdp,
                                });
                                await newPeerConnection.setRemoteDescription(remoteDesc);

                                // 处理缓存的 ICE 候选
                                for (const candidate of pendingCandidates) {
                                    try {
                                        await newPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                                    } catch (err) {
                                        console.error('[桌宠WebRTC] 添加缓存 ICE 候选失败:', err);
                                    }
                                }
                                setPendingCandidates([]);
                            }
                            break;
                        case 'ice-candidate':
                            if (newPeerConnection) {
                                const candidate = new RTCIceCandidate(data.candidate);
                                if (newPeerConnection.remoteDescription && newPeerConnection.remoteDescription.type) {
                                    try {
                                        await newPeerConnection.addIceCandidate(candidate);
                                    } catch (err) {
                                        console.error('[桌宠WebRTC] 添加 ICE 候选失败:', err);
                                    }
                                } else {
                                    setPendingCandidates(prev => [...prev, data.candidate]);
                                }
                            }
                            break;
                    }
                };

            } catch (error) {
                console.error('[桌宠WebRTC] 初始化失败:', error);
            }
        };

        newSocket.onerror = (error) => {
            console.error('[桌宠WebSocket] 连接出错:', error);
        };

        newSocket.onclose = () => {
            console.log('[桌宠WebSocket] 连接关闭');
        };

        setSocket(newSocket);
    };

    // 开始通话
    const startCall = async () => {
        if (!checkAuthStatus()) {
            setShowLoginPrompt(true);
            return;
        }

        try {
            setIsCalling(true);
            setCallDuration(0);
            setChatMessages([]); // 清空当前聊天记录

            // 根据选择的通话方式启动相应的连接
            switch (voiceMode) {
                case 'webrtc':
                    // WebRTC实时通信
                    connectWebSocket();
                    break;
                case 'websocket':
                    // 七牛云语音服务
                    connectQiniuVoice();
                    break;
                case 'http':
                    // HTTP轮询方式
                    startHttpPollingCall();
                    break;
                default:
                    console.error('未知的通话方式:', voiceMode);
                    setIsCalling(false);
                    return;
            }

            // 开始通话计时器
            const timer = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
            setCallTimer(timer);

            console.log('[桌宠] 通话已开始');
        } catch (err: any) {
            console.error('[桌宠] 通话启动失败:', err);
            setIsCalling(false);
        }
    };

    // 停止通话
    const stopCall = async () => {
        try {
            console.log('[桌宠] 开始停止通话');

            // 停止通话计时器
            if (callTimer) {
                clearInterval(callTimer);
                setCallTimer(null);
            }

            // 停止WebRTC连接
            if (peerConnection && peerConnection.connectionState !== 'closed') {
                peerConnection.close();
                setPeerConnection(null);
            }

            // 关闭WebSocket连接
            if (socket && socket.readyState !== WebSocket.CLOSED) {
                socket.close();
                setSocket(null);
            }

            // 停止HTTP录音
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                setMediaRecorder(null);
            }

            // 清理七牛云音频处理器
            if ((window as any).qiniuAudioContext) {
                try {
                    (window as any).qiniuAudioContext.close();
                    (window as any).qiniuAudioContext = null;
                } catch (error) {
                    console.error('[桌宠七牛云语音] 关闭AudioContext失败:', error);
                }
            }
            if ((window as any).qiniuProcessor) {
                try {
                    (window as any).qiniuProcessor.disconnect();
                    (window as any).qiniuProcessor = null;
                } catch (error) {
                    console.error('[桌宠七牛云语音] 断开音频处理器失败:', error);
                }
            }

            // 停止本地音频流
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                setLocalStream(null);
            }

            setIsCalling(false);
            setCallDuration(0);
            setPendingCandidates([]);

            console.log('[桌宠] 通话已结束');
        } catch (err: any) {
            console.error('[桌宠] 终止通话失败:', err);
        }
    };

    // 切换按钮显示状态
    const toggleButtons = () => {
        setShowButtons(!showButtons);
    };

        // 简化的加载自定义助手JS
        const loadCustomAssistantJS = async (jsSourceId: string) => {
            // 检查jsSourceId是否有效
            if (!jsSourceId || jsSourceId.trim() === '') {
                console.log('JsSourceId为空，跳过加载');
                return;
            }
            
            try {
                setIsLoadingCustomAssistant(true);
                setCustomAssistantError(null);
                
                console.log('开始加载自定义助手JS，ID:', jsSourceId);
                const jsContent = await getAssistantJS(jsSourceId);
                console.log('JS内容长度:', jsContent.length);
                
                setCustomAssistantJS(jsContent);
                
                // 创建script标签来执行JS代码
                const script = document.createElement('script');
                script.textContent = jsContent;
                script.id = 'custom-assistant-script';
                
                // 添加错误处理
                script.onerror = (error) => {
                    console.error('脚本执行错误:', error);
                    setCustomAssistantError('脚本执行失败');
                };
                
                // 添加到页面
                document.head.appendChild(script);
                
                console.log('自定义助手JS加载成功');
            } catch (error) {
                console.error('加载自定义助手JS失败:', error);
                const errorMessage = error instanceof Error ? error.message : '未知错误';
                setCustomAssistantError(`加载自定义助手失败: ${errorMessage}`);
            } finally {
                setIsLoadingCustomAssistant(false);
            }
        };

    // 简化的清理自定义助手JS（页面刷新后不需要复杂清理）
    const clearCustomAssistantJS = () => {
        console.log('清理自定义助手JS（页面刷新后）');
        
        // 只清理基本的脚本标签
        try {
            const customScript = document.getElementById('custom-assistant-script');
            if (customScript) {
                console.log('移除自定义脚本标签');
                customScript.remove();
            }
        } catch (e) {
            console.warn('移除脚本标签时出错:', e);
        }
        
        // 强制清理画布（如果有的话）
        try {
            if (petRef.current) {
                petRef.current.clearCanvas();
            }
        } catch (e) {
            console.warn('清理画布时出错:', e);
        }
        
        // 重置状态
        setCustomAssistantJS(null);
        setCustomAssistantError(null);
        setIsLoadingCustomAssistant(false);
    };

    // 不再需要DOM观察器，页面刷新会清理所有状态

    // 选择助手
    const handleAssistantSelect = async (assistant: AssistantListItem) => {
        console.log('选择助手:', assistant.name, 'JsSourceId:', assistant.jsSourceId);
        
        // 保存选择的助手到localStorage
        localStorage.setItem('selectedAssistant', JSON.stringify(assistant));
        
        // 直接刷新页面来完全清理状态
        window.location.reload();
    };

    // 点击外部关闭助手列表
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-assistant-list]') && !target.closest('[data-assistant-button]')) {
            setShowAssistantList(false);
        }
    };

    // 添加点击外部关闭助手列表的监听器
    useEffect(() => {
        if (showAssistantList) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showAssistantList]);

    // 组件卸载时清理资源
    useEffect(() => {
        return () => {
            if (callTimer) {
                clearInterval(callTimer);
            }
            if (socket && socket.readyState !== WebSocket.CLOSED) {
                socket.close();
            }
            if (peerConnection && peerConnection.connectionState !== 'closed') {
                peerConnection.close();
            }
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            
            // 清理自定义助手脚本
            clearCustomAssistantJS();
        };
    }, []);

    return (
        <>
            {/* 主容器 - 会被模糊 */}
            <div
                ref={containerRef}
                data-tauri-drag-region
                style={{
                    width: '250px',
                    height: '280px',
                    backgroundColor: 'transparent',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    zIndex: showAssistantList ? 1 : 9999,
                    pointerEvents: 'auto',
                    overflow: 'hidden',
                    filter: showLoginPrompt ? 'blur(3px)' : 'none',
                    transition: 'filter 0.3s ease',
                    userSelect: 'none'
                }}
            >
            {/* 拖动区域 - 顶部拖动手柄 */}
            <div
                data-tauri-drag-region
                style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    right: '0',
                    height: '40px',
                    backgroundColor: 'transparent',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'auto'
                }}
                title="拖动桌宠"
            >
                {/* 拖动指示器 */}
                <div
                    style={{
                        width: '60px',
                        height: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                        borderRadius: '2px',
                        transition: 'all 0.3s ease',
                        opacity: 0.6
                    }}
                />
            </div>

            {/* 控制按钮区域 */}
            <div
                style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    pointerEvents: 'auto',
                    zIndex: 10000
                }}
                onMouseDown={(e) => e.stopPropagation()}
            >

                {/* 主控制按钮 */}
                <button
                    onClick={toggleButtons}
                    style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                        e.currentTarget.style.transform = 'scale(1.1)';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                    }}
                >
                    <Settings size={16} />
                </button>

                {/* 功能按钮组 */}
                {showButtons && (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            animation: 'fadeIn 0.3s ease-in-out'
                        }}
                    >
                        {/* 通话按钮 */}
                        <button
                            onClick={isCalling ? stopCall : startCall}
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: isCalling ? 'rgba(239, 68, 68, 0.9)' : 'rgba(34, 197, 94, 0.9)',
                                border: '2px solid rgba(255, 255, 255, 0.4)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 3px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)';
                                e.currentTarget.style.boxShadow = '0 5px 16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                                e.currentTarget.style.boxShadow = '0 3px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                            }}
                        >
                            {isCalling ? <PhoneOff size={16} /> : <Phone size={16} />}
                        </button>

                        {/* 助手选择按钮 */}
                        <button
                            data-assistant-button
                            onClick={() => setShowAssistantList(!showAssistantList)}
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(59, 130, 246, 0.9)',
                                border: '2px solid rgba(255, 255, 255, 0.4)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 3px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                position: 'relative'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.9)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)';
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.boxShadow = '0 5px 16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = '0 3px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                            }}
                            title={selectedAssistant ? `当前助手: ${selectedAssistant.name}` : '选择助手'}
                        >
                            <Bot size={16} />
                        </button>

                        {/* 通话方式配置按钮 */}
                        <button
                            onClick={() => setShowConfigPanel(!showConfigPanel)}
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(147, 51, 234, 0.9)',
                                border: '2px solid rgba(255, 255, 255, 0.4)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 3px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(126, 34, 206, 0.9)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)';
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.boxShadow = '0 5px 16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.9)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = '0 3px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                            }}
                            title={`当前: ${voiceMode === 'webrtc' ? 'WebRTC' : voiceMode === 'websocket' ? 'WebSocket' : 'HTTP'} - 点击配置`}
                        >
                            <Settings size={16} />
                        </button>

                        {/* 唤起主窗口按钮 */}
                        <button
                            onClick={() => {
                                try {
                                    // 使用Tauri API唤起主窗口
                                    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
                                        (window as any).__TAURI__.core.invoke('show_main_window');
                                    } else {
                                        // 如果不在Tauri环境中，打开新标签页
                                        window.open(window.location.origin.replace('/desktop-pet-window', ''), '_blank');
                                    }
                                } catch (error) {
                                    console.error('唤起主窗口失败:', error);
                                    // 备用方案：打开新标签页
                                    window.open(window.location.origin.replace('/desktop-pet-window', ''), '_blank');
                                }
                            }}
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                border: '2px solid rgba(255, 255, 255, 0.4)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 3px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)';
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.boxShadow = '0 5px 16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = '0 3px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                            }}
                            title="打开主应用"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <line x1="9" y1="9" x2="15" y2="15"/>
                                <line x1="15" y1="9" x2="9" y2="15"/>
                            </svg>
                        </button>
                    </div>
                )}
            </div>


            {/* 通话状态显示 */}
            {isCalling && (
                <div
                    style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        padding: '8px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        pointerEvents: 'auto',
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <div
                        style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#ef4444',
                            animation: 'pulse 1s infinite'
                        }}
                    />
                    {Math.floor(callDuration / 60).toString().padStart(2, '0')}:
                    {(callDuration % 60).toString().padStart(2, '0')}
                </div>
            )}


            {/* 只在初始化完成后才渲染助手 */}
            {isInitialized && (
                <>
                    {/* 自定义助手容器 - 只在有自定义JS且没有错误时显示 */}
                    {customAssistantJS && !customAssistantError && !isLoadingCustomAssistant ? (
                        <div
                            id="custom-assistant-container"
                            style={{
                                pointerEvents: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                height: '100%'
                            }}
                        />
                    ) : null}

                    {/* 默认透明画布组件 - 只在没有自定义JS且不在加载时显示 */}
                    {!customAssistantJS && !isLoadingCustomAssistant && (
                        <div
                            style={{
                                pointerEvents: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <TransparentCanvas
                                ref={petRef}
                                width={200}
                                height={200}
                                onAnimationComplete={handleAnimationComplete}
                                autoPlay={true}
                                randomBehavior={true}
                                randomBehaviorInterval={3000}
                                onClick={handlePetClick}
                                isCalling={isCalling}
                                style={{
                                    filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))',
                                    transform: 'scaleX(-1)',
                                    transition: 'transform 0.3s ease-in-out'
                                }}
                            />
                        </div>
                    )}
                </>
            )}

            {/* 自定义助手加载状态 */}
            {isLoadingCustomAssistant && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        pointerEvents: 'auto',
                        zIndex: 10000
                    }}
                >
                    正在加载自定义助手...
                </div>
            )}

            {/* 自定义助手错误提示 */}
            {customAssistantError && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'rgba(239, 68, 68, 0.9)',
                        color: 'white',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        pointerEvents: 'auto',
                        zIndex: 10000
                    }}
                >
                    {customAssistantError}
                </div>
            )}

            {/* CSS动画样式 */}
            <style>
                {`
                    /* 隐藏浏览器UI元素 */
                    body {
                        overflow: hidden !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    /* 隐藏可能的地址栏和工具栏 */
                    ::-webkit-scrollbar {
                        display: none !important;
                    }
                    
                    /* 透明背景覆盖样式 */
                    .desktop-pet-transparent {
                        background: transparent !important;
                        background-color: transparent !important;
                    }
                    
                    .desktop-pet-transparent * {
                        background: transparent !important;
                        background-color: transparent !important;
                    }
                    
                    /* 确保画布容器透明 */
                    .transparent-canvas {
                        background: transparent !important;
                        background-color: transparent !important;
                    }
                    
                    .transparent-canvas canvas {
                        background: transparent !important;
                        background-color: transparent !important;
                    }
                    
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.5; }
                    }
                    
                    /* 强制助手选择框背景不透明 */
                    .assistant-overlay {
                        background: #000000 !important;
                        background-color: #000000 !important;
                        opacity: 1 !important;
                    }
                    
                    .assistant-overlay * {
                        background: #000000 !important;
                        background-color: #000000 !important;
                    }
                    
                    /* 隐藏滚动条 */
                    .assistant-overlay::-webkit-scrollbar {
                        display: none;
                    }
                    
                    .assistant-overlay {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}
            </style>
            </div>

            {/* 助手选择列表 - 不受模糊影响 */}
            {showAssistantList && (
                <>
                    {/* 强制背景层 */}
                    <div
                        className="assistant-overlay"
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            backgroundColor: '#000000',
                            zIndex: 9999,
                            pointerEvents: 'none'
                        }}
                    />
                    
                    {/* 蒙层背景 */}
                    <div
                        className="assistant-overlay"
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            backgroundColor: '#000000',
                            zIndex: 10000,
                            pointerEvents: 'auto'
                        }}
                        onClick={() => setShowAssistantList(false)}
                    />
                    
                    {/* 选择框内容 */}
                    <div
                        data-assistant-list
                        className="assistant-overlay"
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            backgroundColor: '#000000',
                            color: 'white',
                            padding: '0',
                            pointerEvents: 'auto',
                            zIndex: 10001,
                            overflowY: 'auto',
                            animation: 'fadeIn 0.3s ease-in-out',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none'
                        }}
                    >
                        <div style={{ 
                            fontSize: '14px', 
                            fontWeight: '600', 
                            padding: '12px 16px',
                            borderBottom: '1px solid #374151',
                            color: '#f3f4f6',
                            textAlign: 'center',
                            backgroundColor: 'rgba(17, 24, 39, 0.8)',
                            position: 'sticky',
                            top: '0',
                            zIndex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            选择助手
                            <button
                                onClick={() => setShowAssistantList(false)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(75, 85, 99, 0.5)',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease',
                                    fontSize: '12px'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.7)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.5)';
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div style={{ padding: '8px' }}>
                            {assistants.length === 0 ? (
                                <div style={{ 
                                    padding: '12px', 
                                    textAlign: 'center', 
                                    color: '#9ca3af',
                                    fontSize: '11px'
                                }}>
                                    暂无可用助手
                                </div>
                            ) : (
                                assistants.map((assistant) => (
                                <button
                                    key={assistant.id}
                                    onClick={() => handleAssistantSelect(assistant)}
                                    style={{
                                        width: '100%',
                                        padding: '6px 8px',
                                        backgroundColor: selectedAssistant?.id === assistant.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(31, 41, 55, 0.3)',
                                        border: selectedAssistant?.id === assistant.id ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
                                        color: 'white',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        marginBottom: '2px'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (selectedAssistant?.id !== assistant.id) {
                                            e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.5)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (selectedAssistant?.id !== assistant.id) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }
                                    }}
                                >
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        backgroundColor: selectedAssistant?.id === assistant.id ? 'rgba(59, 130, 246, 0.3)' : 'rgba(75, 85, 99, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <Bot size={12} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', fontSize: '11px' }}>
                                            {assistant.name}
                                        </div>
                                    </div>
                                    {selectedAssistant?.id === assistant.id && (
                                        <div style={{ 
                                            width: '4px', 
                                            height: '4px', 
                                            borderRadius: '50%', 
                                            backgroundColor: '#3b82f6',
                                            flexShrink: 0,
                                            boxShadow: '0 0 2px rgba(59, 130, 246, 0.6)'
                                        }} />
                                    )}
                                </button>
                            ))
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* 通话方式配置面板 */}
            {showConfigPanel && (
                <>
                    {/* 蒙层背景 */}
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            backgroundColor: '#000000',
                            zIndex: 50000,
                            pointerEvents: 'auto'
                        }}
                        onClick={() => setShowConfigPanel(false)}
                    />
                    
                    {/* 配置面板内容 */}
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            backgroundColor: '#000000',
                            color: 'white',
                            padding: '0',
                            pointerEvents: 'auto',
                            zIndex: 50001,
                            overflowY: 'auto',
                            animation: 'fadeIn 0.3s ease-in-out',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none'
                        }}
                    >
                        <div style={{ 
                            fontSize: '14px', 
                            fontWeight: '600', 
                            padding: '12px 16px',
                            borderBottom: '1px solid #374151',
                            color: '#f3f4f6',
                            textAlign: 'center',
                            backgroundColor: 'rgba(17, 24, 39, 0.8)',
                            position: 'sticky',
                            top: '0',
                            zIndex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            选择通话方式
                            <button
                                onClick={() => setShowConfigPanel(false)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(75, 85, 99, 0.5)',
                                    border: 'none',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease',
                                    fontSize: '12px'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.7)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.5)';
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div style={{ padding: '8px' }}>
                            {/* WebRTC选项 */}
                            <button
                                onClick={() => {
                                    setVoiceMode('webrtc');
                                    setShowConfigPanel(false);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    backgroundColor: voiceMode === 'webrtc' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(31, 41, 55, 0.3)',
                                    border: voiceMode === 'webrtc' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
                                    color: 'white',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginBottom: '2px'
                                }}
                                onMouseEnter={(e) => {
                                    if (voiceMode !== 'webrtc') {
                                        e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.5)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (voiceMode !== 'webrtc') {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: voiceMode === 'webrtc' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(75, 85, 99, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <div style={{ fontSize: '12px' }}>⚡</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '600', fontSize: '11px' }}>
                                        WebRTC实时通信
                                    </div>
                                </div>
                                {voiceMode === 'webrtc' && (
                                    <div style={{ 
                                        width: '4px', 
                                        height: '4px', 
                                        borderRadius: '50%', 
                                        backgroundColor: '#3b82f6',
                                        flexShrink: 0,
                                        boxShadow: '0 0 2px rgba(59, 130, 246, 0.6)'
                                    }} />
                                )}
                            </button>

                            {/* WebSocket选项 */}
                            <button
                                onClick={() => {
                                    setVoiceMode('websocket');
                                    setShowConfigPanel(false);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    backgroundColor: voiceMode === 'websocket' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(31, 41, 55, 0.3)',
                                    border: voiceMode === 'websocket' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
                                    color: 'white',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginBottom: '2px'
                                }}
                                onMouseEnter={(e) => {
                                    if (voiceMode !== 'websocket') {
                                        e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.5)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (voiceMode !== 'websocket') {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: voiceMode === 'websocket' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(75, 85, 99, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <div style={{ fontSize: '12px' }}>🔗</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '600', fontSize: '11px' }}>
                                        WebSocket语音服务
                                    </div>
                                </div>
                                {voiceMode === 'websocket' && (
                                    <div style={{ 
                                        width: '4px', 
                                        height: '4px', 
                                        borderRadius: '50%', 
                                        backgroundColor: '#3b82f6',
                                        flexShrink: 0,
                                        boxShadow: '0 0 2px rgba(59, 130, 246, 0.6)'
                                    }} />
                                )}
                            </button>

                            {/* HTTP选项 */}
                            <button
                                onClick={() => {
                                    setVoiceMode('http');
                                    setShowConfigPanel(false);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    backgroundColor: voiceMode === 'http' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(31, 41, 55, 0.3)',
                                    border: voiceMode === 'http' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
                                    color: 'white',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    marginBottom: '2px'
                                }}
                                onMouseEnter={(e) => {
                                    if (voiceMode !== 'http') {
                                        e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.5)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (voiceMode !== 'http') {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: voiceMode === 'http' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(75, 85, 99, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <div style={{ fontSize: '12px' }}>🌐</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '600', fontSize: '11px' }}>
                                        HTTP轮询方式
                                    </div>
                                </div>
                                {voiceMode === 'http' && (
                                    <div style={{ 
                                        width: '4px', 
                                        height: '4px', 
                                        borderRadius: '50%', 
                                        backgroundColor: '#3b82f6',
                                        flexShrink: 0,
                                        boxShadow: '0 0 2px rgba(59, 130, 246, 0.6)'
                                    }} />
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* 蒙层和弹窗 - 不受模糊影响 */}
            {showLoginPrompt && (
                <>
                    {/* 蒙层 */}
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '90%',
                            height: '100%',
                            backgroundColor: 'rgba(0, 0, 0, 0.4)',
                            zIndex: 10000,
                            pointerEvents: 'auto'
                        }}
                        onClick={() => setShowLoginPrompt(false)}
                    />
                    
                    {/* 登录提示弹窗 */}
                    <div
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: '#1f2937',
                            color: 'white',
                            padding: '16px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            pointerEvents: 'auto',
                            zIndex: 10001,
                            textAlign: 'center',
                            minWidth: '200px',
                            maxWidth: '240px',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
                            border: '1px solid #374151',
                            animation: 'fadeIn 0.3s ease-in-out',
                            backdropFilter: 'blur(10px)'
                        }}
                    >
                        <div style={{ marginBottom: '12px' }}>
                            <LogIn size={18} style={{ marginBottom: '6px' }} />
                            <div style={{ fontSize: '13px', fontWeight: '500' }}>需要登录才能使用桌宠功能</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setShowLoginPrompt(false)}
                                style={{
                                    flex: 1,
                                    padding: '6px 12px',
                                    backgroundColor: '#4b5563',
                                    border: '1px solid #6b7280',
                                    borderRadius: '6px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#6b7280';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#4b5563';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        // 打开浏览器中的登录页面
                                        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
                                            // 在Tauri应用中，使用Tauri的API打开外部浏览器
                                            await (window as any).__TAURI__.shell.open('http://localhost:3000/login');
                                        } else {
                                            // 在浏览器中，打开新标签页
                                            window.open('http://localhost:3000/login', '_blank');
                                        }
                                        setShowLoginPrompt(false);
                                    } catch (error) {
                                        console.error('打开登录页面失败:', error);
                                        // 如果Tauri API失败，尝试使用浏览器方式
                                        window.open('http://localhost:3535/profile', '_blank');
                                        setShowLoginPrompt(false);
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    padding: '6px 12px',
                                    backgroundColor: '#3b82f6',
                                    border: '1px solid #2563eb',
                                    borderRadius: '6px',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#2563eb';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#3b82f6';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                去登录
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default DesktopPetWindow;

