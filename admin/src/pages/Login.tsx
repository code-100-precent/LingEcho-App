import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Eye, EyeOff, LogIn, Lock as LockIcon } from 'lucide-react'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import { useAuthStore } from '@/stores/authStore'
import { showAlert } from '@/utils/notification'
import { post } from '@/utils/request'
import { getApiBaseURL } from '@/config/apiConfig'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      showAlert('请填写完整信息', 'error', '登录失败')
      return
    }

    setLoading(true)
    try {
      // 调用管理员登录API（专门用于管理后台，会验证用户是否是staff或admin）
      const response = await post(`${getApiBaseURL()}/admin/auth/login`, {
        email,
        password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        remember: true,
        authToken: true
      })

      // 后端直接返回用户对象（不是标准响应格式 {code, msg, data}）
      // response 可能是用户对象本身，或者包装在 data 中
      const userData = response.data || response
      
      // 检查是否有token字段（表示登录成功）
      const token = userData.token || userData.AuthToken
      
      if (!token) {
        throw new Error('登录失败：未获取到token')
      }
      
      // 使用authStore的login方法
      const success = await login(token, {
        id: userData.id || userData.ID || 0,
        email: userData.email || email,
        displayName: userData.displayName || userData.display_name || email.split('@')[0],
        avatar: userData.avatar || userData.Avatar,
        ...userData
      })
      
      if (success) {
        showAlert('登录成功', 'success', '欢迎回来')
        navigate('/dashboard')
      } else {
        throw new Error('登录处理失败')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      showAlert(
        error?.msg || error?.message || '登录失败，请检查邮箱和密码',
        'error',
        '登录失败'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-300 dark:bg-blue-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-30 animate-pulse animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-20 animate-pulse animation-delay-4000" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10 px-4"
      >
        <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-10 border border-slate-200/50 dark:border-slate-700/50">
          {/* Logo和标题 */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center mb-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl blur-lg opacity-50 animate-pulse" />
                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-xl">
                  <img 
                    src="/logo.png" 
                    alt="Logo" 
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      // 如果logo加载失败，显示默认图标
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent) {
                        parent.innerHTML = '<svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>'
                      }
                    }}
                  />
                </div>
              </div>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text mb-2"
            >
              灵语回响
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-slate-600 dark:text-slate-400 text-sm"
            >
              管理后台登录
            </motion.p>
          </div>

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Input
                type="email"
                label="邮箱"
                placeholder="请输入邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                size="lg"
                required
                disabled={loading}
              />
            </div>

            <div>
              <Input
                type={showPassword ? 'text' : 'password'}
                label="密码"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<LockIcon className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
                size="lg"
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              leftIcon={<LogIn className="w-4 h-4" />}
              className="mt-6"
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>

          {/* 底部提示 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-center"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">
              默认管理员账号请联系系统管理员获取
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-600" />
              <span>安全登录</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-600" />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export default Login

