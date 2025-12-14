import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import NotFound from "@/pages/NotFound.tsx";
import PWAInstaller from "@/components/PWA/PWAInstaller.tsx";
import ErrorBoundary from "@/components/ErrorBoundary/ErrorBoundary.tsx";
import VoiceAssistant from "@/pages/VoiceAssistant.tsx";
import VoiceTraining from "@/pages/VoiceTraining.tsx";
import DevErrorHandler from "@/components/Dev/DevErrorHandler.tsx";
import Documentation from "@/pages/Documentation.tsx";
import NotificationContainer from "@/components/UI/NotificationContainer.tsx";
import NotificationCenter from "@/pages/NotificationCenter.tsx";
import Profile from "@/pages/Profile.tsx";
import Layout from "@/components/Layout/Layout.tsx";
import KnowledgeBase from "@/pages/KnowledgeBase.tsx";
import CredentialManager from "@/pages/CredentialManager.tsx";
import ProtectedRoute from "@/components/Auth/ProtectedRoute.tsx";
import JSTemplateManager from "@/pages/JSTemplateManager.tsx";
import DesktopPetWindow from "@/pages/DesktopPetWindow.tsx";

function App() {

    return (
        <ErrorBoundary>
            <Router>
                <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                    <Routes>
                        {/* 文档页面 - 不需要登录 */}
                        <Route path="/docs" element={<Documentation />} />
                        {/* 需要登录的页面 */}
                        <Route path="/knowledge" element={
                            <ProtectedRoute>
                                <Layout>
                                    <KnowledgeBase />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/profile" element={
                            <ProtectedRoute>
                                <Layout>
                                    <Profile />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/" element={
                            <Layout>
                                <VoiceAssistant />
                            </Layout>
                        } />
                        <Route path="/voice-training" element={
                            <ProtectedRoute>
                                <Layout>
                                    <VoiceTraining />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/notifications" element={
                            <ProtectedRoute>
                                <Layout>
                                    <NotificationCenter />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/credential" element={
                            <ProtectedRoute>
                                <Layout>
                                    <CredentialManager />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/js-templates" element={
                            <ProtectedRoute>
                                <Layout>
                                    <JSTemplateManager />
                                </Layout>
                            </ProtectedRoute>
                        } />
                        <Route path="/desktop-pet-window" element={<DesktopPetWindow />} />
                        {/* 404页面 */}
                        <Route path="*" element={<NotFound />}/>
                    </Routes>

                    {/* PWA 安装提示 */}
                    <PWAInstaller
                        showOnLoad={true}
                        delay={5000}
                        position="bottom-right"
                    />

                    {/* 自定义通知系统 */}
                    <NotificationContainer />

                    {/* 开发环境错误处理 */}
                    <DevErrorHandler />
                </div>
            </Router>
        </ErrorBoundary>
    );
}

export default App;