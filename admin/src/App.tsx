import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import ErrorBoundary from '@/components/ErrorBoundary/ErrorBoundary'
import PWAInstaller from '@/components/PWA/PWAInstaller'
import NotificationContainer from '@/components/UI/NotificationContainer'
import GlobalSearch from '@/components/UI/GlobalSearch'
import DevErrorHandler from '@/components/Dev/DevErrorHandler'
import ProtectedRoute from '@/components/Auth/ProtectedRoute'
import { useAuthStore } from '@/stores/authStore'

// Pages
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Users from '@/pages/Users'
import UserEdit from '@/pages/UserEdit'
import Content from '@/pages/Content'
import Settings from '@/pages/Settings'
import Profile from '@/pages/Profile'
import Notifications from '@/pages/Notifications'
import Orders from '@/pages/Orders'
import Playmates from '@/pages/Playmates'
import Posts from '@/pages/Posts'
import PostEdit from '@/pages/PostEdit'
import Tags from '@/pages/Tags'
import Topics from '@/pages/Topics'
import Rankings from '@/pages/Rankings'
import Social from '@/pages/Social'

function App() {
  const { refreshUserInfo, isAuthenticated } = useAuthStore()

  // 初始化时检查用户登录状态
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token && !isAuthenticated) {
      refreshUserInfo()
    }
  }, [])

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          <Routes>
            {/* 登录页 */}
            <Route
              path="/login"
              element={
                isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
              }
            />

            {/* 受保护的路由 */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users/:id/edit"
              element={
                <ProtectedRoute>
                  <UserEdit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/content"
              element={
                <ProtectedRoute>
                  <Content />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/playmates"
              element={
                <ProtectedRoute>
                  <Playmates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/posts"
              element={
                <ProtectedRoute>
                  <Posts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/posts/new"
              element={
                <ProtectedRoute>
                  <PostEdit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/posts/:id/edit"
              element={
                <ProtectedRoute>
                  <PostEdit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tags"
              element={
                <ProtectedRoute>
                  <Tags />
                </ProtectedRoute>
              }
            />
            <Route
              path="/topics"
              element={
                <ProtectedRoute>
                  <Topics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rankings"
              element={
                <ProtectedRoute>
                  <Rankings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/social"
              element={
                <ProtectedRoute>
                  <Social />
                </ProtectedRoute>
              }
            />

            {/* 默认重定向 */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>

          {/* 全局组件 */}
          <PWAInstaller
            showOnLoad={true}
            delay={5000}
            position="bottom-right"
          />
          <NotificationContainer />
          <DevErrorHandler />
          <GlobalSearch />
        </div>
      </Router>
    </ErrorBoundary>
  )
}

export default App
