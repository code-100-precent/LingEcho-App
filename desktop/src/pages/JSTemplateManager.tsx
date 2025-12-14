import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Card, { CardFooter, CardHeader, CardTitle } from '@/components/UI/Card.tsx'
import Button from '@/components/UI/Button.tsx'
import Input from '@/components/UI/Input.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/UI/Select.tsx'
import { jsTemplateService, JSTemplate, CreateJSTemplateForm } from '@/api/jsTemplate'
import MonacoEditor from '@monaco-editor/react'
import { ArrowLeft, Plus, Code, Eye } from 'lucide-react'

const JSTemplateManager = () => {
    const navigate = useNavigate()
    const [templates, setTemplates] = useState<JSTemplate[]>([])
    const [isCreating, setIsCreating] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState<JSTemplate | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'default' | 'custom'>('all')
    const [isLoading, setIsLoading] = useState(false)
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        type: 'custom' as 'default' | 'custom',
        content: '// 在此编写您的JavaScript代码\n// 代码将实时注入到左侧预览页面\n\n// 示例: 创建一个彩色方块\nconst box = document.createElement("div");\nbox.style.width = "200px";\nbox.style.height = "200px";\nbox.style.backgroundColor = "#3b82f6";\nbox.style.margin = "20px auto";\nbox.style.borderRadius = "12px";\nbox.style.display = "flex";\nbox.style.alignItems = "center";\nbox.style.justifyContent = "center";\nbox.style.color = "white";\nbox.style.fontSize = "18px";\nbox.style.fontWeight = "bold";\nbox.textContent = "Hello, JS Template!";\ndocument.body.appendChild(box);',
        usage: ''
    })

    // 获取模板数据
    useEffect(() => {
        fetchTemplates()
    }, [])

    const fetchTemplates = async () => {
        setIsLoading(true)
        try {
            const response = await jsTemplateService.getTemplates({ page: 1, limit: 100 })
            if (response.code === 200) {
                setTemplates(response.data.data)
            }
        } catch (error) {
            console.error('获取模板失败:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const filteredTemplates = templates.filter(template => {
        const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             template.content.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesFilter = filterType === 'all' || template.type === filterType
        return matchesSearch && matchesFilter
    })

    // 搜索功能
    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            fetchTemplates()
            return
        }
        
        setIsLoading(true)
        try {
            const response = await jsTemplateService.searchTemplates({
                keyword: searchTerm,
                page: 1,
                limit: 100
            })
            if (response.code === 200) {
                setTemplates(response.data.data)
            } else {
                console.error('搜索模板失败:', response.msg)
            }
        } catch (error) {
            console.error('搜索模板失败:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // 监听搜索词变化，延迟搜索
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.trim()) {
                handleSearch()
            } else {
                fetchTemplates()
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [searchTerm])


    const handleCreateTemplate = () => {
        setIsCreating(true)
        setIsEditing(false)
        setEditingTemplate(null)
    }

    const handleEditTemplate = (template: JSTemplate) => {
        setEditingTemplate(template)
        setNewTemplate({
            name: template.name,
            type: template.type,
            content: template.content,
            usage: template.usage || ''
        })
        setIsEditing(true)
        setIsCreating(false)
    }

    const handleSaveNewTemplate = async () => {
        try {
            const templateData: CreateJSTemplateForm = {
                name: newTemplate.name,
                type: newTemplate.type,
                content: newTemplate.content,
                usage: newTemplate.usage
            }
            
            if (isEditing && editingTemplate) {
                // 编辑模式 - 调用更新API
                const response = await jsTemplateService.updateTemplate(editingTemplate.id, templateData)
                if (response.code === 200) {
                    setIsEditing(false)
                    setEditingTemplate(null)
                    setNewTemplate({
                        name: '',
                        type: 'custom',
                        content: '// 在此编写您的JavaScript代码\n// 代码将实时注入到左侧预览页面\n\n// 示例: 创建一个彩色方块\nconst box = document.createElement("div");\nbox.style.width = "200px";\nbox.style.height = "200px";\nbox.style.backgroundColor = "#3b82f6";\nbox.style.margin = "20px auto";\nbox.style.borderRadius = "12px";\nbox.style.display = "flex";\nbox.style.alignItems = "center";\nbox.style.justifyContent = "center";\nbox.style.color = "white";\nbox.style.fontSize = "18px";\nbox.style.fontWeight = "bold";\nbox.textContent = "Hello, JS Template!";\ndocument.body.appendChild(box);',
                        usage: ''
                    })
                    fetchTemplates()
                } else {
                    console.error('更新模板失败:', response.msg)
                    alert('更新模板失败: ' + response.msg)
                }
            } else {
                // 创建模式 - 调用创建API
                const response = await jsTemplateService.createTemplate(templateData)
                if (response.code === 200 || response.code === 201) {
                    setIsCreating(false)
                    setNewTemplate({
                        name: '',
                        type: 'custom',
                        content: '// 在此编写您的JavaScript代码\n// 代码将实时注入到左侧预览页面\n\n// 示例: 创建一个彩色方块\nconst box = document.createElement("div");\nbox.style.width = "200px";\nbox.style.height = "200px";\nbox.style.backgroundColor = "#3b82f6";\nbox.style.margin = "20px auto";\nbox.style.borderRadius = "12px";\nbox.style.display = "flex";\nbox.style.alignItems = "center";\nbox.style.justifyContent = "center";\nbox.style.color = "white";\nbox.style.fontSize = "18px";\nbox.style.fontWeight = "bold";\nbox.textContent = "Hello, JS Template!";\ndocument.body.appendChild(box);',
                        usage: ''
                    })
                    fetchTemplates()
                } else {
                    console.error('创建模板失败:', response.msg)
                    alert('创建模板失败: ' + response.msg)
                }
            }
        } catch (error) {
            console.error(isEditing ? '更新模板失败:' : '创建模板失败:', error)
            alert(isEditing ? '更新模板失败' : '创建模板失败')
        }
    }

    const handleDeleteTemplate = async (templateId: string) => {
        console.log('handleDeleteTemplate called with templateId:', templateId)
        
        if (!templateId) {
            console.error('Template ID is undefined or empty')
            alert('模板ID无效，无法删除')
            return
        }
        
        if (!confirm('确定要删除这个模板吗？')) {
            return
        }
        
        try {
            console.log('Calling deleteTemplate with ID:', templateId)
            const response = await jsTemplateService.deleteTemplate(templateId)
            if (response.code === 200) {
                // 重新获取模板列表
                fetchTemplates()
                // 如果删除的是当前编辑的模板，清空编辑状态
                if (editingTemplate?.id === templateId) {
                    setEditingTemplate(null)
                    setIsEditing(false)
                }
            } else {
                console.error('删除模板失败:', response.msg)
                alert('删除模板失败: ' + response.msg)
            }
        } catch (error) {
            console.error('删除模板失败:', error)
            alert('删除模板失败')
        }
    }

    const handleCancelCreate = () => {
        setIsCreating(false)
        setIsEditing(false)
        setEditingTemplate(null)
        setNewTemplate({
            name: '',
            type: 'custom',
            content: '// 在此编写您的JavaScript代码\n// 代码将实时注入到左侧预览页面\n\n// 示例: 创建一个彩色方块\nconst box = document.createElement("div");\nbox.style.width = "200px";\nbox.style.height = "200px";\nbox.style.backgroundColor = "#3b82f6";\nbox.style.margin = "20px auto";\nbox.style.borderRadius = "12px";\nbox.style.display = "flex";\nbox.style.alignItems = "center";\nbox.style.justifyContent = "center";\nbox.style.color = "white";\nbox.style.fontSize = "18px";\nbox.style.fontWeight = "bold";\nbox.textContent = "Hello, JS Template!";\ndocument.body.appendChild(box);',
            usage: ''
        })
    }

    // 用于更新预览页面
    const iframeRef = useRef<HTMLIFrameElement | null>(null)

    const updateIframe = () => {
        if (iframeRef.current) {
            const iframeDoc = iframeRef.current.contentDocument
            if (iframeDoc) {
                iframeDoc.open()
                iframeDoc.write(`
                    <!DOCTYPE html>
                    <html lang="zh-CN">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>JS代码预览</title>
                        </head>
                        <body>
                            <div id="preview-content">
                                <script>
                                    try {
                                        ${newTemplate.content}
                                    } catch (error) {
                                        const errorDiv = document.createElement('div');
                                        errorDiv.style.cssText = 'background: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0; color: #991b1b;';
                                        errorDiv.innerHTML = '<h3 style="margin-bottom: 10px; font-size: 18px;">⚠️ 代码执行错误</h3><pre style="white-space: pre-wrap; font-family: monospace; font-size: 14px;">' + error.message + '</pre>';
                                        document.getElementById('preview-content').appendChild(errorDiv);
                                        console.error('JS Template Error:', error);
                                    }
                                </script>
                            </div>
                        </body>
                    </html>
                `)
                iframeDoc.close()
            }
        }
    }

    useEffect(() => {
        if (isCreating || isEditing) {
            updateIframe()
        }
    }, [newTemplate.content, isCreating, isEditing])

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            {/* 页面头部 */}
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
                                <h1 className="text-2xl font-bold">JS模板管理</h1>
                                <p className="text-sm mt-1">
                                    创建和管理JavaScript模板，为语音助手应用接入提供自定义能力
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-sm font-medium">
                                    {filteredTemplates.length} 个模板
                                </div>
                                <div className="text-xs">
                                    总计 {templates.length} 个
                                </div>
                            </div>
                            <Button 
                                onClick={handleCreateTemplate} 
                                leftIcon={<Plus className="w-4 h-4" />}
                                className="px-4 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                            >
                                创建模板
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* 搜索和过滤栏 */}
                <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl border border-white/20 dark:border-slate-700/30 p-4 mb-6 shadow-lg">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div className="flex-1 max-w-md">
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <Input
                                    placeholder="搜索模板名称或内容..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-9 bg-white/80 dark:bg-slate-700/80 border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-sm">筛选类型</div>
                            <Select value={filterType} onValueChange={(value: string) => setFilterType(value as 'all' | 'default' | 'custom')}>
                                <SelectTrigger className="w-32 h-9 bg-white/80 dark:bg-slate-700/80 border-slate-200 dark:border-slate-600 rounded-lg">
                                    <SelectValue>
                                        {filterType === 'all' && '全部'}
                                        {filterType === 'default' && '默认'}
                                        {filterType === 'custom' && '自定义'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="z-50 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                                    <SelectItem value="all">全部</SelectItem>
                                    <SelectItem value="default">默认</SelectItem>
                                    <SelectItem value="custom">自定义</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* 主体内容区域 */}
                <div className="w-full">
                    {/* 模板列表 */}
                    <div className="w-full">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="relative">
                                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 dark:border-slate-700"></div>
                                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent absolute top-0 left-0"></div>
                                </div>
                                <p className="mt-4 font-medium">加载模板中...</p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    <AnimatePresence>
                                        {filteredTemplates.map((template: JSTemplate) => (
                                            <motion.div
                                                key={template.id}
                                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                                                transition={{ duration: 0.4, ease: "easeOut" }}
                                                className="group"
                                            >
                                                <Card
                                                    className="h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-white/20 dark:border-slate-700/30 hover:border-slate-300 dark:hover:border-slate-600"
                                                >
                                                    <CardHeader className="p-4 pb-3">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <div className="p-2 rounded-lg shadow-lg">
                                                                        <Code className="w-5 h-5" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <CardTitle className="text-lg font-bold truncate">
                                                                            {template.name}
                                                                        </CardTitle>
                                                                        <p className="text-sm mt-1">
                                                                            {template.type === 'default' ? '默认模板' : '自定义模板'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {template.type === 'default' && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg">
                                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                        </svg>
                                                                        默认
                                                                    </span>
                                                                )}
                                                                {template.type === 'custom' && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg">
                                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                                                                        </svg>
                                                                        自定义
                                                                    </span>
                                                                )}
                                                                {template.type === 'custom' && (
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                handleEditTemplate(template)
                                                                            }}
                                                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all duration-200 group/edit"
                                                                            title="编辑模板"
                                                                        >
                                                                            <svg className="w-4 h-4 group-hover/edit:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                            </svg>
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                handleDeleteTemplate(template.id)
                                                                            }}
                                                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all duration-200 group/delete"
                                                                            title="删除模板"
                                                                        >
                                                                            <svg className="w-4 h-4 group-hover/delete:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                    <CardFooter className="px-4 py-3 bg-slate-50/50 dark:bg-slate-700/30 border-t border-slate-200/50 dark:border-slate-600/30">
                                                        <div className="flex justify-between items-center text-sm w-full">
                                                            <div>
                                                                更新: {new Date(template.updated_at).toLocaleDateString()}
                                                            </div>
                                                            <div className="text-slate-400">
                                                                #{template.id.slice(-4)}
                                                            </div>
                                                        </div>
                                                    </CardFooter>
                                                </Card>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                                {filteredTemplates.length === 0 && !isLoading && (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="relative mb-6">
                                            <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-full flex items-center justify-center">
                                                <Code className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                                            </div>
                                            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center">
                                                <span className="text-sm font-bold">?</span>
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">
                                            {searchTerm ? '未找到匹配的模板' : '还没有模板'}
                                        </h3>
                                        <p className="mb-6 max-w-md">
                                            {searchTerm
                                                ? '请尝试使用其他关键词搜索，或者检查拼写是否正确'
                                                : '创建您的第一个JS模板，开始构建自定义功能'}
                                        </p>
                                        <Button 
                                            onClick={handleCreateTemplate} 
                                            leftIcon={<Plus className="w-4 h-4" />}
                                            className="px-6 py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                                        >
                                            创建第一个模板
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* 全屏创建/编辑模板抽屉 */}
            <AnimatePresence>
                {(isCreating || isEditing) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 overflow-hidden"
                    >
                        {/* 遮罩层 */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={handleCancelCreate}
                        />

                        {/* 全屏抽屉内容 */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-2xl flex flex-col"
                        >
                            {/* 抽屉头部 */}
                            <div className="flex-shrink-0 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg shadow-lg">
                                            <Code className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold">
                                                {isEditing ? '编辑JS模板' : '创建JS模板'}
                                            </h2>
                                            <p className="text-sm mt-1">
                                                {isEditing ? '编辑自定义JavaScript模板' : '创建自定义JavaScript模板'}，用于语音助手应用接入
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            onClick={handleCancelCreate}
                                            variant="outline"
                                            size="sm"
                                            leftIcon={<ArrowLeft className="w-4 h-4" />}
                                            className="border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 transition-all duration-200"
                                        >
                                            取消
                                        </Button>
                                        <Button
                                            onClick={handleSaveNewTemplate}
                                            size="sm"
                                            leftIcon={<Plus className="w-4 h-4" />}
                                            className="px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                                            disabled={!newTemplate.name || !newTemplate.content}
                                        >
                                            {isEditing ? '更新模板' : '保存模板'}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* 左右分栏主体内容 */}
                            <div className="flex-1 flex overflow-hidden">
                                {/* 左侧: 实时预览 */}
                                <div className="w-1/2 border-r border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col">
                                    <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                                        <h3 className="text-sm font-semibold flex items-center gap-2">
                                            <Eye className="w-4 h-4" />
                                            代码预览
                                        </h3>
                                        <p className="text-xs mt-1">
                                            您的代码将在这里实时执行和显示效果
                                        </p>
                                    </div>
                                    <div className="flex-1 p-4 overflow-hidden">
                                        <iframe
                                            ref={iframeRef}
                                            className="w-full h-full border border-slate-300 dark:border-slate-600 bg-white rounded-lg shadow-sm"
                                            title="JS代码实时预览"
                                        />
                                    </div>
                                </div>

                                {/* 右侧: 编辑区域 */}
                                <div className="w-1/2 flex flex-col overflow-hidden">
                                    <div className="flex-1 overflow-y-auto">
                                        <div className="p-6 space-y-6">
                                            <div>
                                                <label className="block text-sm font-semibold mb-2">
                                                    模板名称
                                                </label>
                                                <Input
                                                    placeholder="请输入模板名称"
                                                    value={newTemplate.name}
                                                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                                    className="h-9 bg-white/80 dark:bg-slate-700/80 border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-semibold mb-2">
                                                    使用说明 (Markdown格式)
                                                </label>
                                                <textarea
                                                    placeholder="请输入使用说明..."
                                                    value={newTemplate.usage}
                                                    onChange={(e) => setNewTemplate({ ...newTemplate, usage: e.target.value })}
                                                    className="w-full p-3 border border-slate-200 dark:border-slate-600 dark:bg-slate-700/80 rounded-lg resize-none text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                                    rows={4}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-semibold mb-2">
                                                    JavaScript代码
                                                </label>
                                                <div className="border border-slate-200 dark:border-slate-600 overflow-hidden rounded-lg shadow-sm">
                                                    <MonacoEditor
                                                        height="400px"
                                                        language="javascript"
                                                        value={newTemplate.content}
                                                        onChange={(value) => setNewTemplate({ ...newTemplate, content: value || '' })}
                                                        options={{
                                                            minimap: { enabled: false },
                                                            scrollBeyondLastLine: false,
                                                            fontSize: 14,
                                                            lineNumbers: 'on',
                                                            wordWrap: 'on',
                                                            automaticLayout: true,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default JSTemplateManager