import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { AnimationLibrary, AnimationFrame } from '@/utils/animationLibrary';

interface TransparentCanvasProps {
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  onAnimationComplete?: (animationName: string) => void;
  autoPlay?: boolean;
  randomBehavior?: boolean;
  randomBehaviorInterval?: number;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  isCalling?: boolean; // 是否处于通话状态
}

export interface TransparentCanvasRef {
  playAnimation: (name: string, force?: boolean) => void;
  stopAnimation: () => void;
  getCurrentAnimation: () => string | null;
  playNextAnimation: () => void;
  clearCanvas: () => void;
}

const TransparentCanvas = forwardRef<TransparentCanvasRef, TransparentCanvasProps>(({
  width = 200,
  height = 200,
  className = '',
  style = {},
  autoPlay = true,
  randomBehavior = true,
  randomBehaviorInterval = 5000,
  onClick,
  onMouseDown,
  isCalling = false
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationLibraryRef = useRef<AnimationLibrary | null>(null);
  const animationLoopRef = useRef<number | null>(null);
  const randomBehaviorRef = useRef<NodeJS.Timeout | null>(null);
  const [currentFrame, setCurrentFrame] = useState<AnimationFrame | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    playAnimation: (name: string, force: boolean = false) => {
      if (animationLibraryRef.current) {
        animationLibraryRef.current.playAnimation(name, force);
      }
    },
    stopAnimation: () => {
      if (animationLibraryRef.current) {
        animationLibraryRef.current.stopAnimation();
      }
    },
    getCurrentAnimation: () => {
      return animationLibraryRef.current?.getCurrentAnimation() || null;
    },
    playNextAnimation: () => {
      if (animationLibraryRef.current) {
        animationLibraryRef.current.playNextAnimation();
      }
    },
    clearCanvas: () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1.0;
        }
      }
    }
  }), []);

  // 初始化动画库和画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布尺寸
    canvas.width = width;
    canvas.height = height;

    // 初始化动画库
    const animationLibrary = new AnimationLibrary();
    animationLibraryRef.current = animationLibrary;

    // 设置帧变化回调
    animationLibrary.setOnFrameChange((frame) => {
      setCurrentFrame(frame);
    });

    // 开始动画循环
    const animate = () => {
      animationLibrary.update();
      animationLoopRef.current = requestAnimationFrame(animate);
    };
    animationLoopRef.current = requestAnimationFrame(animate);

    // 自动播放
    if (autoPlay) {
      animationLibrary.playAnimation('idle');
    }

    // 随机行为（仅在非通话状态下）
    if (randomBehavior && !isCalling) {
      const startRandomBehavior = () => {
        randomBehaviorRef.current = setTimeout(() => {
          if (animationLibraryRef.current && !isCalling) {
            const random = Math.random();
            if (random < 0.3) {
              animationLibraryRef.current.playRandomAnimationByPriority(3);
            } else if (random < 0.6) {
              animationLibraryRef.current.playRandomAnimationByPriority(2);
            } else {
              animationLibraryRef.current.playRandomAnimation();
            }
          }
          if (!isCalling) {
            startRandomBehavior();
          }
        }, randomBehaviorInterval + Math.random() * 2000);
      };
      startRandomBehavior();
    }

    return () => {
      if (animationLoopRef.current) {
        cancelAnimationFrame(animationLoopRef.current);
      }
      if (randomBehaviorRef.current) {
        clearTimeout(randomBehaviorRef.current);
      }
      
      // 清理画布
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // 重置画布状态
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1.0;
        }
      }
    };
  }, [autoPlay, randomBehavior, randomBehaviorInterval, width, height]);

  // 监听通话状态变化
  useEffect(() => {
    if (animationLibraryRef.current) {
      if (isCalling) {
        // 通话状态下设置通话状态并强制播放 sing 动画
        animationLibraryRef.current.setCallingState(true);
        // 清除随机行为定时器
        if (randomBehaviorRef.current) {
          clearTimeout(randomBehaviorRef.current);
          randomBehaviorRef.current = null;
        }
        console.log('通话状态：桌宠切换到唱歌动画');
      } else {
        // 非通话状态下恢复随机行为
        animationLibraryRef.current.setCallingState(false);
        if (randomBehavior) {
          const startRandomBehavior = () => {
            randomBehaviorRef.current = setTimeout(() => {
              if (animationLibraryRef.current && !isCalling) {
                const random = Math.random();
                if (random < 0.3) {
                  animationLibraryRef.current.playRandomAnimationByPriority(3);
                } else if (random < 0.6) {
                  animationLibraryRef.current.playRandomAnimationByPriority(2);
                } else {
                  animationLibraryRef.current.playRandomAnimation();
                }
              }
              if (!isCalling) {
                startRandomBehavior();
              }
            }, randomBehaviorInterval + Math.random() * 2000);
          };
          startRandomBehavior();
          console.log('非通话状态：桌宠恢复随机行为');
        }
      }
    }
  }, [isCalling, randomBehavior, randomBehaviorInterval]);

  // 绘制当前帧到画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentFrame) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布（透明）
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 确保画布完全透明
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    // 创建图片对象
    const img = new Image();
    img.onload = () => {
      // 绘制图片到画布中心
      const x = (canvas.width - img.width) / 2;
      const y = (canvas.height - img.height) / 2;
      
      ctx.drawImage(img, x, y);
      setIsLoaded(true);
    };
    img.onerror = () => {
      console.error('Failed to load sprite frame:', currentFrame.src);
      setIsLoaded(false);
    };
    img.src = currentFrame.src;
  }, [currentFrame]);

  // 处理点击事件
  const handleClick = () => {
    // 通话状态下禁用点击
    if (isCalling) {
      console.log('通话状态下，桌宠点击被禁用');
      return;
    }
    if (onClick) {
      onClick();
    }
  };

  // 处理鼠标按下事件
  const handleMouseDownEvent = (e: React.MouseEvent) => {
    if (onMouseDown) {
      onMouseDown(e);
    }
  };

  return (
    <div
      className={`transparent-canvas ${className}`}
      style={{
        width,
        height,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        background: 'transparent',
        cursor: (onClick && !isCalling) ? 'pointer' : 'default',
        ...style
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDownEvent}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'transparent',
          background: 'transparent',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          pointerEvents: 'none' // 确保点击事件由父容器处理
        }}
      />
    </div>
  );
});

TransparentCanvas.displayName = 'TransparentCanvas';

export default TransparentCanvas;
