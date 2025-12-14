// 动画库 - 管理多帧动画
export interface AnimationFrame {
  src: string;
  duration: number; // 每帧持续时间（毫秒）
}

export interface Animation {
  name: string;
  frames: AnimationFrame[];
  loop: boolean; // 是否循环播放
  priority: number; // 动画优先级，数字越大优先级越高
}

export class AnimationLibrary {
  private animations: Map<string, Animation> = new Map();
  private currentAnimation: string | null = null;
  private currentFrameIndex: number = 0;
  private lastFrameTime: number = 0;
  private isPlaying: boolean = false;
  private onFrameChange?: (frame: AnimationFrame) => void;
  private isCalling: boolean = false; // 通话状态标志

  constructor() {
    this.initializeAnimations();
  }

  // 初始化所有动画
  private initializeAnimations() {
    // Ghost 待机动画
    this.addAnimation({
      name: 'idle',
      frames: [
        { src: '/sprites/ghost_idle.png', duration: 1000 }
      ],
      loop: true,
      priority: 1
    });

    // Ghost 哭泣动画
    this.addAnimation({
      name: 'cry',
      frames: [
        { src: '/sprites/ghost_cry_1.png', duration: 200 },
        { src: '/sprites/ghost_cry_2.png', duration: 200 },
        { src: '/sprites/ghost_cry_3.png', duration: 200 },
        { src: '/sprites/ghost_cry_4.png', duration: 200 }
      ],
      loop: true,
      priority: 3
    });

    // Ghost 发呆动画
    this.addAnimation({
      name: 'daze',
      frames: [
        { src: '/sprites/ghost_daze_1.png', duration: 150 },
        { src: '/sprites/ghost_daze_2.png', duration: 150 },
        { src: '/sprites/ghost_daze_3.png', duration: 150 },
        { src: '/sprites/ghost_daze_4.png', duration: 150 },
        { src: '/sprites/ghost_daze_5.png', duration: 150 },
        { src: '/sprites/ghost_daze_6.png', duration: 150 },
        { src: '/sprites/ghost_daze_7.png', duration: 150 },
        { src: '/sprites/ghost_daze_8.png', duration: 150 }
      ],
      loop: true,
      priority: 2
    });

    // Ghost 掉落动画
    this.addAnimation({
      name: 'falldown',
      frames: [
        { src: '/sprites/ghost_falldown_1.png', duration: 100 },
        { src: '/sprites/ghost_falldown_2.png', duration: 100 },
        { src: '/sprites/ghost_falldown_3.png', duration: 100 }
      ],
      loop: false,
      priority: 4
    });

    // Ghost 唱歌动画
    this.addAnimation({
      name: 'sing',
      frames: [
        { src: '/sprites/ghost_sing_1.png', duration: 120 },
        { src: '/sprites/ghost_sing_2.png', duration: 120 },
        { src: '/sprites/ghost_sing_3.png', duration: 120 },
        { src: '/sprites/ghost_sing_4.png', duration: 120 },
        { src: '/sprites/ghost_sing_5.png', duration: 120 },
        { src: '/sprites/ghost_sing_6.png', duration: 120 },
        { src: '/sprites/ghost_sing_7.png', duration: 120 },
      ],
      loop: true,
      priority: 5 // 最高优先级，确保通话状态下不会被其他动画覆盖
    });

    // Ghost 流动动画
    this.addAnimation({
      name: 'flow',
      frames: [
        { src: '/sprites/ghost_flow_1.png', duration: 200 }
      ],
      loop: true,
      priority: 2
    });

    // Ghost 隐藏动画
    this.addAnimation({
      name: 'hide',
      frames: [
        { src: '/sprites/ghost_hide_1.png', duration: 150 },
        { src: '/sprites/ghost_hide_2.png', duration: 150 },
        { src: '/sprites/ghost_hide_3.png', duration: 150 },
        { src: '/sprites/ghost_hide_4.png', duration: 150 },
        { src: '/sprites/ghost_hide_5.png', duration: 150 },
        { src: '/sprites/ghost_hide_6.png', duration: 150 },
        { src: '/sprites/ghost_hide_7.png', duration: 150 },
        { src: '/sprites/ghost_hide_8.png', duration: 150 },
        { src: '/sprites/ghost_hide_9.png', duration: 150 }
      ],
      loop: false,
      priority: 3
    });

    // Ghost 悲伤动画
    this.addAnimation({
      name: 'sad',
      frames: [
        { src: '/sprites/ghost_sad_1.png', duration: 200 },
        { src: '/sprites/ghost_sad_2.png', duration: 200 },
        { src: '/sprites/ghost_sad_3.png', duration: 200 },
        { src: '/sprites/ghost_sad_4.png', duration: 200 }
      ],
      loop: true,
      priority: 3
    });
  }

  // 添加动画
  addAnimation(animation: Animation) {
    this.animations.set(animation.name, animation);
  }

  // 播放动画
  playAnimation(name: string, force: boolean = false) {
    // 通话状态下，如果不是 sing 动画且不是强制播放，则强制播放 sing 动画
    if (this.isCalling && name !== 'sing' && !force) {
      console.log('通话状态下，强制播放 sing 动画');
      this.playAnimation('sing', true);
      return;
    }

    const animation = this.animations.get(name);
    if (!animation) {
      console.warn(`Animation "${name}" not found`);
      return;
    }

    // 检查优先级
    if (!force && this.currentAnimation) {
      const currentAnim = this.animations.get(this.currentAnimation);
      if (currentAnim && currentAnim.priority > animation.priority) {
        return; // 当前动画优先级更高，不切换
      }
    }

    this.currentAnimation = name;
    this.currentFrameIndex = 0;
    this.lastFrameTime = Date.now();
    this.isPlaying = true;

    // 立即显示第一帧
    this.updateFrame();
  }

  // 停止动画
  stopAnimation() {
    this.isPlaying = false;
    this.currentAnimation = null;
    this.currentFrameIndex = 0;
  }

  // 更新动画
  update() {
    if (!this.isPlaying || !this.currentAnimation) return;

    const animation = this.animations.get(this.currentAnimation);
    if (!animation) return;

    const currentTime = Date.now();
    const currentFrame = animation.frames[this.currentFrameIndex];
    
    if (currentTime - this.lastFrameTime >= currentFrame.duration) {
      this.currentFrameIndex++;
      
      // 检查是否到达最后一帧
      if (this.currentFrameIndex >= animation.frames.length) {
        if (animation.loop) {
          this.currentFrameIndex = 0; // 循环播放
        } else {
          // 不循环，播放完成，回到待机状态
          this.playAnimation('idle', true);
          return;
        }
      }
      
      this.lastFrameTime = currentTime;
      this.updateFrame();
    }
  }

  // 更新当前帧
  private updateFrame() {
    if (!this.currentAnimation) return;
    
    const animation = this.animations.get(this.currentAnimation);
    if (!animation) return;

    const frame = animation.frames[this.currentFrameIndex];
    if (frame && this.onFrameChange) {
      this.onFrameChange(frame);
    }
  }

  // 设置帧变化回调
  setOnFrameChange(callback: (frame: AnimationFrame) => void) {
    this.onFrameChange = callback;
  }

  // 获取当前动画信息
  getCurrentAnimation() {
    return this.currentAnimation;
  }

  // 获取当前帧
  getCurrentFrame() {
    if (!this.currentAnimation) return null;
    
    const animation = this.animations.get(this.currentAnimation);
    if (!animation) return null;
    
    return animation.frames[this.currentFrameIndex];
  }

  // 随机播放动画（用于随机行为）
  playRandomAnimation() {
    const animationNames = Array.from(this.animations.keys());
    const randomName = animationNames[Math.floor(Math.random() * animationNames.length)];
    this.playAnimation(randomName, true);
  }

  // 播放特定优先级的随机动画
  playRandomAnimationByPriority(minPriority: number = 1) {
    const availableAnimations = Array.from(this.animations.values())
      .filter(anim => anim.priority >= minPriority);
    
    if (availableAnimations.length === 0) return;
    
    const randomAnim = availableAnimations[Math.floor(Math.random() * availableAnimations.length)];
    this.playAnimation(randomAnim.name, true);
  }

  // 获取所有动画名称
  getAllAnimationNames() {
    return Array.from(this.animations.keys());
  }

  // 按顺序播放下一个动画
  playNextAnimation() {
    // 通话状态下不允许切换动画
    if (this.isCalling) {
      console.log('通话状态下，不允许切换动画');
      return;
    }

    const allAnimations = this.getAllAnimationNames();
    if (allAnimations.length === 0) return;

    let nextIndex = 0;
    if (this.currentAnimation) {
      const currentIndex = allAnimations.indexOf(this.currentAnimation);
      if (currentIndex !== -1) {
        nextIndex = (currentIndex + 1) % allAnimations.length;
      }
    }

    const nextAnimation = allAnimations[nextIndex];
    this.playAnimation(nextAnimation, true);
  }

  // 设置通话状态
  setCallingState(calling: boolean) {
    this.isCalling = calling;
    if (calling) {
      // 通话状态下强制播放 sing 动画
      this.playAnimation('sing', true);
    }
  }
}
