import React, { useEffect, useRef, useState } from 'react';
import { AnimationLibrary, AnimationFrame } from '@/utils/animationLibrary';

interface AnimatedSpriteProps {
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  onAnimationComplete?: (animationName: string) => void;
  autoPlay?: boolean;
  randomBehavior?: boolean;
  randomBehaviorInterval?: number; // 随机行为间隔（毫秒）
}

export interface AnimatedSpriteRef {
  playAnimation: (name: string, force?: boolean) => void;
  stopAnimation: () => void;
  getCurrentAnimation: () => string | null;
}

const AnimatedSprite = React.forwardRef<AnimatedSpriteRef, AnimatedSpriteProps>(({
  width = 100,
  height = 100,
  className = '',
  style = {},
  onAnimationComplete,
  autoPlay = true,
  randomBehavior = true,
  randomBehaviorInterval = 5000
}, ref) => {
  const [currentFrame, setCurrentFrame] = useState<AnimationFrame | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const animationLibraryRef = useRef<AnimationLibrary | null>(null);
  const animationLoopRef = useRef<number | null>(null);
  const randomBehaviorRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化动画库
  useEffect(() => {
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

    // 设置动画完成回调
    if (onAnimationComplete) {
      // 这里可以添加动画完成检测逻辑
      // 目前简化处理，在动画库中已经处理了循环和优先级
    }

    // 随机行为
    if (randomBehavior) {
      const startRandomBehavior = () => {
        randomBehaviorRef.current = setTimeout(() => {
          if (animationLibraryRef.current) {
            // 随机播放动画，优先播放高优先级动画
            const random = Math.random();
            if (random < 0.3) {
              // 30% 概率播放高优先级动画（cry, sing, sad, hide）
              animationLibraryRef.current.playRandomAnimationByPriority(3);
            } else if (random < 0.6) {
              // 30% 概率播放中等优先级动画（daze, flow）
              animationLibraryRef.current.playRandomAnimationByPriority(2);
            } else {
              // 40% 概率播放任何动画
              animationLibraryRef.current.playRandomAnimation();
            }
          }
          startRandomBehavior(); // 递归调用，持续随机行为
        }, randomBehaviorInterval + Math.random() * 2000); // 添加随机延迟
      };
      startRandomBehavior();
    }

    // 监听自定义事件来播放特定动画
    const handlePlayAnimation = (event: CustomEvent) => {
      const { animationName } = event.detail;
      if (animationLibraryRef.current) {
        animationLibraryRef.current.playAnimation(animationName, true);
      }
    };

    window.addEventListener('playDesktopPetAnimation', handlePlayAnimation as EventListener);

    return () => {
      // 清理
      if (animationLoopRef.current) {
        cancelAnimationFrame(animationLoopRef.current);
      }
      if (randomBehaviorRef.current) {
        clearTimeout(randomBehaviorRef.current);
      }
      window.removeEventListener('playDesktopPetAnimation', handlePlayAnimation as EventListener);
    };
  }, [autoPlay, randomBehavior, randomBehaviorInterval]);

  // 播放指定动画
  const playAnimation = (name: string, force: boolean = false) => {
    if (animationLibraryRef.current) {
      animationLibraryRef.current.playAnimation(name, force);
    }
  };

  // 停止动画
  const stopAnimation = () => {
    if (animationLibraryRef.current) {
      animationLibraryRef.current.stopAnimation();
    }
  };

  // 获取当前动画名称
  const getCurrentAnimation = () => {
    return animationLibraryRef.current?.getCurrentAnimation() || null;
  };

  // 暴露方法给父组件
  React.useImperativeHandle(ref, () => ({
    playAnimation,
    stopAnimation,
    getCurrentAnimation
  }), []);

  return (
    <div
      className={`animated-sprite ${className}`}
      style={{
        width,
        height,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style
      }}
    >
      {currentFrame && (
        <img
          src={currentFrame.src}
          alt="Animated Sprite"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            userSelect: 'none',
            pointerEvents: 'none',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
            backgroundColor: 'transparent',
            background: 'transparent'
          }}
          onLoad={() => {
            setIsLoaded(true);
          }}
          onError={(e) => {
            console.error('Sprite frame load error:', e);
            setIsLoaded(false);
          }}
          draggable={false}
        />
      )}
    </div>
  );
});

AnimatedSprite.displayName = 'AnimatedSprite';

export default AnimatedSprite;
