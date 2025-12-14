import { motion } from 'framer-motion'
import { Home, ArrowLeft, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../components/UI/Button'
import FadeIn from '../components/Animations/FadeIn'

const NotFound = () => {
  return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <FadeIn direction="up">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-9xl font-bold text-primary mb-8"
            >
              404
            </motion.div>
          </FadeIn>

          <FadeIn direction="up" delay={0.3}>
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="mb-8"
            >
              <h1 className="text-4xl md:text-5xl font-display font-bold">
                页面未找到
              </h1>
            </motion.div>
          </FadeIn>

          <FadeIn direction="up" delay={0.4}>
            <p className="text-xl text-neutral-600 mb-8 leading-relaxed">
              抱歉，您访问的页面不存在或已被移动。请检查 URL 是否正确，或返回首页继续浏览。
            </p>
          </FadeIn>

          <FadeIn direction="up" delay={0.5}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/">
                <Button variant="primary" size="lg" leftIcon={<Home className="w-5 h-5" />}>
                  返回首页
                </Button>
              </Link>
              <Button
                  variant="outline"
                  size="lg"
                  leftIcon={<ArrowLeft className="w-5 h-5" />}
                  onClick={() => window.history.back()}
              >
                返回上页
              </Button>
            </div>
          </FadeIn>

          <FadeIn direction="up" delay={0.6}>
            <div className="mt-12 p-6 rounded-xl">
              <div className="flex items-center justify-center mb-4">
                <Search className="w-6 h-6 mr-2" />
                <h3 className="text-lg font-semibold">需要帮助？</h3>
              </div>
              <p className="mb-4">
                如果您认为这是一个错误，请联系我们的支持团队。
              </p>
              <Button variant="ghost" size="sm">
                联系支持
              </Button>
            </div>
          </FadeIn>
        </div>
      </div>
  )
}

export default NotFound