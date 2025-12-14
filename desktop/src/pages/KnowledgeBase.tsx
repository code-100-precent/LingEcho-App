// src/pages/KnowledgeBase.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Search, FileText, BookOpen, Upload, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { showAlert } from '@/utils/notification'
import Button from '@/components/UI/Button';
import {
    getKnowledgeBaseByUser,
    createKnowledgeBase,
    deleteKnowledgeBase,
    uploadKnowledgeBase,
    askKnowledgeBase
} from '@/api/knowledge';

interface KnowledgeBaseItem {
    id: number;
    userid: number;
    knowledge_key: string;
    knowledge_name: string;
    created_at: string;
    update_at: string;
    delete_at: string;
}

const KnowledgeBase = () => {
    const navigate = useNavigate();
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [pendingDeleteKey, setPendingDeleteKey] = useState<string>('');
    const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
    const [filteredKnowledgeBases, setFilteredKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isAskModalOpen, setIsAskModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<KnowledgeBaseItem | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        knowledgeName: ''
    });
    const [file, setFile] = useState<File | null>(null);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [userId] = useState<number>(1); // 实际应用中应从认证信息获取

    // 获取知识库列表
    useEffect(() => {
        fetchKnowledgeBases();
    }, []);
    useEffect(() => {
        console.log('知识库数据更新:', knowledgeBases);
        // 确保 filteredKnowledgeBases 也同步更新
        if (!searchTerm) {
            setFilteredKnowledgeBases(knowledgeBases);
        }
    }, [knowledgeBases]);
    // 搜索过滤
    useEffect(() => {
        if (!searchTerm) {
            setFilteredKnowledgeBases(knowledgeBases || []); // 添加空值保护
        } else {
            const filtered = (knowledgeBases || []).filter(kb =>
                kb.knowledge_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                kb.knowledge_key.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredKnowledgeBases(filtered);
        }
    }, [searchTerm, knowledgeBases]);

    const fetchKnowledgeBases = async () => {
        try {
            setIsLoading(true);
            const response = await getKnowledgeBaseByUser();
            console.log('获取知识库列表响应:', response);

            if (response.code === 200) {
                // 处理 null 或空数组情况
                const responseData = response.data || [];

                // 后端现在返回的是包含 name 和 key 的对象数组
                const transformedData: KnowledgeBaseItem[] = responseData.map((item: { name: string; key: string }, index: number) => ({
                    id: index + 1,
                    userid: userId,
                    knowledge_key: item.key,
                    knowledge_name: item.name,
                    created_at: new Date().toISOString(),
                    update_at: new Date().toISOString(),
                    delete_at: ''
                }));

                console.log('转换后的数据:', transformedData);
                setKnowledgeBases(transformedData);
                setFilteredKnowledgeBases(transformedData);
            } else {
                // 处理错误情况，清空数据
                setKnowledgeBases([]);
                setFilteredKnowledgeBases([]);
                console.error('获取知识库列表失败:', response.msg);
            }
        } catch (error) {
            console.error('获取知识库列表失败:', error);
            // 出错时清空数据
            setKnowledgeBases([]);
            setFilteredKnowledgeBases([]);
            showAlert('获取知识库列表失败', 'error', '获取失败');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = () => {
        setCurrentItem(null);
        setFormData({
            knowledgeName: ''
        });
        setFile(null);
        setIsCreateModalOpen(true);
    };

    const handleShowUpload = (item: KnowledgeBaseItem) => {
        setCurrentItem(item);
        setUploadFile(null);
        setIsUploadModalOpen(true);
    };
    const handleDelete = (knowledgeKey: string) => {
        setPendingDeleteKey(knowledgeKey);
        setIsDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        try {
            const response = await deleteKnowledgeBase(pendingDeleteKey);
            if (response.code === 200) {
                // 明确设置加载状态
                setIsLoading(true);

                // 确保数据刷新完成
                await fetchKnowledgeBases();

                // 额外检查数据是否正确更新
                console.log('删除后知识库数据:', knowledgeBases);

                showAlert('知识库删除成功', 'success', '删除成功');
            } else {
                console.error('删除失败:', response.msg);
                showAlert('删除失败: ' + response.msg, 'error', '删除失败');
            }
        } catch (error) {
            console.error('删除知识库失败:', error);
            showAlert('删除知识库失败，请稍后重试', 'error', '删除失败');
        } finally {
            // 确保状态重置
            setIsDeleteConfirmOpen(false);
            setPendingDeleteKey('');
            setIsLoading(false);
        }
    };

    const cancelDelete = () => {
        setIsDeleteConfirmOpen(false);
        setPendingDeleteKey('');
    };



    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!file) {
            // 替换 alert 为 showAlert
            showAlert('请选择一个文件', 'warning', '文件缺失');
            return;
        }

        // 限制知识库名称在10个字符以内
        if (formData.knowledgeName.length > 10) {
            // 替换 alert 为 showAlert
            showAlert('知识库名称不能超过10个字符', 'warning', '名称过长');
            return;
        }

        try {
            setIsCreating(true);
            const response = await createKnowledgeBase({
                knowledgeName: formData.knowledgeName,
                file: file
            });

            if (response.code === 200) {
                await fetchKnowledgeBases();
                setIsCreateModalOpen(false);
                // 替换 alert 为 showAlert
                showAlert('知识库创建成功', 'success', '创建成功');
            } else {
                console.error('创建失败:', response.msg);
                // 替换 alert 为 showAlert
                showAlert('创建失败: ' + response.msg, 'error', '创建失败');
            }
        } catch (error) {
            console.error('创建知识库失败:', error);
            // 替换 alert 为 showAlert
            showAlert('创建知识库失败，请稍后重试', 'error', '创建失败');
        } finally {
            setIsCreating(false);
        }
    };


    // 在 handleUploadSubmit 函数中添加更多错误处理和日志
    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!uploadFile || !currentItem) return;

        try {
            console.log('准备上传文件:', uploadFile);
            console.log('知识库key:', currentItem.knowledge_key);

            const response = await uploadKnowledgeBase({
                file: uploadFile,
                knowledgeKey: currentItem.knowledge_key
            });

            console.log('上传响应:', response);

            if (response.code === 200) {
                showAlert('文件上传成功', 'success', '上传成功');
                setIsUploadModalOpen(false);
            } else {
                console.error('上传失败:', response.msg);
                showAlert('上传失败: ' + response.msg, 'error', '上传失败');
            }
        } catch (error) {
            console.error('上传文件失败:', error);
            showAlert('上传文件失败，请稍后重试', 'error', '上传失败');
        }
    };


    const handleAskSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!question || !currentItem) return;

        try {
            const response = await askKnowledgeBase({
                knowledgeKey: currentItem.knowledge_key,
                message: question
            });

            if (response.code === 200) {
                setAnswer(response.data);
            } else {
                console.error('提问失败:', response.msg);
            }
        } catch (error) {
            console.error('提问失败:', error);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadFile(e.target.files[0]);
        }
    };

    return (
        <>
            <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
                {/* 顶部导航栏 */}
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-gray-200/50 dark:border-slate-700/50 sticky top-0 z-40">
                    <div className="max-w-7xl mx-auto px-4 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Button
                                    onClick={() => navigate(-1)}
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                                    className="border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 transition-all duration-200"
                                >
                                    返回
                                </Button>
                                <div className="h-8 w-px bg-slate-300 dark:bg-slate-600"></div>
                                <div>
                                    <h2 className="text-2xl font-bold">知识库管理</h2>
                                    <p className="text-sm mt-1">
                                        智能文档管理与问答系统
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <div className="text-sm font-medium">
                                        {filteredKnowledgeBases.length} 个知识库
                                    </div>
                                    <div className="text-xs">
                                        总计 {knowledgeBases.length} 个
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 py-6">

                {/* 操作栏 */}
                <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl border border-white/20 dark:border-slate-700/30 p-4 mb-6 shadow-lg">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div className="flex-1 max-w-md">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="搜索知识库名称或标识..."
                                    className="w-full pl-10 pr-3 py-2.5 bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-slate-400 dark:placeholder-slate-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-sm">
                                快速操作
                            </div>
                            <Button
                                onClick={handleCreate}
                                leftIcon={<Plus className="w-4 h-4" />}
                                className="px-4 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                            >
                                新建知识库
                            </Button>
                        </div>
                    </div>
                </div>

                {/* 知识库列表 */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 dark:border-slate-700"></div>
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-current border-t-transparent absolute top-0 left-0"></div>
                        </div>
                        <p className="mt-4 font-medium">加载知识库中...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <AnimatePresence>
                            {filteredKnowledgeBases.map((kb) => (
                                <motion.div
                                    key={kb.id}
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                    className="group bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-white/20 dark:border-slate-700/30 shadow-lg hover:shadow-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
                                >
                                    {/* 卡片头部 */}
                                    <div className="p-4 pb-3">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2.5 rounded-lg shadow-lg">
                                                    <BookOpen className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="text-lg font-bold truncate transition-colors">
                                                        {kb.knowledge_name}
                                                    </h3>
                                                    <p className="text-sm mt-1">
                                                        ID: {kb.knowledge_key}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleShowUpload(kb)}
                                                    className="p-2 rounded-lg transition-all duration-200 group/btn"
                                                    title="上传文件"
                                                >
                                                    <Upload className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(kb.knowledge_key)}
                                                    className="p-2 rounded-lg transition-all duration-200 group/btn"
                                                    title="删除知识库"
                                                >
                                                    <Trash2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* 知识库信息 */}
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm">
                                                <div className="w-2 h-2 rounded-full"></div>
                                                <span>状态: 活跃</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <FileText className="w-4 h-4" />
                                                <span>用户ID: {kb.userid}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 卡片底部 */}
                                    <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-700/30 border-t border-slate-200/50 dark:border-slate-600/30">
                                        <div className="flex justify-between items-center text-sm">
                                            <div>
                                                创建于 {new Date(kb.created_at).toLocaleDateString()}
                                            </div>
                                            <div>
                                                #{kb.id.toString().padStart(3, '0')}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                {/* 空状态 */}
                {!isLoading && filteredKnowledgeBases.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="relative mb-6">
                            <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-full flex items-center justify-center">
                                <BookOpen className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                            </div>
                            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center">
                                <span className="text-sm font-bold">?</span>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2">
                            {searchTerm ? '未找到匹配的知识库' : '还没有知识库'}
                        </h3>
                        <p className="mb-6 max-w-md">
                            {searchTerm
                                ? '请尝试使用其他关键词搜索，或者检查拼写是否正确'
                                : '创建您的第一个知识库，开始构建智能文档管理系统'}
                        </p>
                        {!searchTerm && (
                            <Button
                                onClick={handleCreate}
                                leftIcon={<Plus className="w-4 h-4" />}
                                className="px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                            >
                                创建第一个知识库
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
            <AnimatePresence>
                {isDeleteConfirmOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                        onClick={cancelDelete}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl w-full max-w-md shadow-2xl border border-white/20 dark:border-slate-700/30"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                                        <Trash2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">
                                            确认删除
                                        </h2>
                                        <p className="text-sm">
                                            此操作不可撤销
                                        </p>
                                    </div>
                                </div>
                                    <p className="mb-8 leading-relaxed">
                                    确定要删除这个知识库吗？删除后，所有相关的文档和数据都将被永久移除，无法恢复。
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={cancelDelete}
                                        className="px-4 py-2.5 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 font-medium"
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirmDelete}
                                        className="px-4 py-2.5 rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                                    >
                                        确定删除
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 创建知识库模态框 */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                        onClick={() => setIsCreateModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl w-full max-w-lg shadow-2xl border border-white/20 dark:border-slate-700/30"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                                        <Plus className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">
                                            创建知识库
                                        </h2>
                                        <p className="text-sm">
                                            上传文档并创建智能知识库
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={handleCreateSubmit} className="space-y-4">
                                    <div>
                                            <label className="block text-sm font-semibold mb-2">
                                            知识库名称
                                            <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">(最多10个字符)</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="knowledgeName"
                                            value={formData.knowledgeName}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2.5 bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-slate-400 dark:placeholder-slate-500"
                                            placeholder="请输入知识库名称"
                                            required
                                            maxLength={10}
                                        />
                                    </div>

                                    <div>
                                            <label className="block text-sm font-semibold mb-2">
                                            上传文档
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="file"
                                                onChange={handleFileChange}
                                                className="w-full px-4 py-3 bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                required
                                            />
                                        </div>
                                        <p className="text-xs mt-2">
                                            支持 PDF、TXT、DOC 等格式
                                        </p>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsCreateModalOpen(false)}
                                            className="px-4 py-2.5 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 font-medium"
                                        >
                                            取消
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-2.5 rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl flex items-center gap-2"
                                            disabled={isCreating}
                                        >
                                            {isCreating ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                                                    创建中...
                                                </>
                                            ) : (
                                                <>
                                                    <Plus className="w-4 h-4" />
                                                    创建知识库
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 上传文件模态框 */}
            <AnimatePresence>
                {isUploadModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                        onClick={() => setIsUploadModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl w-full max-w-md shadow-2xl border border-white/20 dark:border-slate-700/30"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                                        <Upload className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">
                                            上传文件
                                        </h2>
                                        <p className="text-sm">
                                            添加到 {currentItem?.knowledge_name}
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={handleUploadSubmit} className="space-y-4">
                                    <div>
                                            <label className="block text-sm font-semibold mb-2">
                                            选择文件
                                        </label>
                                        <input
                                            type="file"
                                            onChange={handleUploadFileChange}
                                            className="w-full px-4 py-3 bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                            required
                                        />
                                        <p className="text-xs mt-2">
                                            支持多种文档格式
                                        </p>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsUploadModalOpen(false)}
                                            className="px-4 py-2.5 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 font-medium"
                                        >
                                            取消
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-3 rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl flex items-center gap-2"
                                        >
                                            <Upload className="w-4 h-4" />
                                            上传文件
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI提问模态框 */}
            <AnimatePresence>
                {isAskModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                        onClick={() => setIsAskModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl w-full max-w-2xl shadow-2xl border border-white/20 dark:border-slate-700/30"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                                        <Search className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">
                                            AI 智能问答
                                        </h2>
                                        <p className="text-sm">
                                            向 {currentItem?.knowledge_name} 提问
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={handleAskSubmit} className="space-y-4">
                                    <div>
                                            <label className="block text-sm font-semibold mb-2">
                                            您的问题
                                        </label>
                                        <textarea
                                            value={question}
                                            onChange={(e) => setQuestion(e.target.value)}
                                            rows={4}
                                            className="w-full px-3 py-2.5 bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 placeholder-slate-400 dark:placeholder-slate-500 resize-none"
                                            placeholder="请输入您的问题，AI将基于知识库内容为您解答..."
                                            required
                                        />
                                    </div>

                                    {answer && (
                                        <div className="space-y-2">
                                            <label className="block text-sm font-semibold">
                                                AI 回答
                                            </label>
                                            <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-1">
                                                        <span className="text-sm font-bold">AI</span>
                                                    </div>
                                                    <p className="whitespace-pre-wrap leading-relaxed">
                                                        {answer}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3 pt-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsAskModalOpen(false)}
                                            className="px-4 py-2.5 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 font-medium"
                                        >
                                            关闭
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-2.5 rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl flex items-center gap-2"
                                        >
                                            <Search className="w-4 h-4" />
                                            提问
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default KnowledgeBase;
