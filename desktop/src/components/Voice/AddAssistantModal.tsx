import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, MessageCircle, Users, Zap, Circle } from 'lucide-react'
import { cn } from '@/utils/cn'

interface AddAssistantModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (assistant: { name: string; description: string; icon: string }) => void
}

const ICON_MAP = {
  Bot: <Bot className="w-5 h-5" />,
  MessageCircle: <MessageCircle className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />,
  Zap: <Zap className="w-5 h-5" />,
  Circle: <Circle className="w-5 h-5" />
}

const AddAssistantModal: React.FC<AddAssistantModalProps> = ({
  isOpen,
  onClose,
  onAdd
}) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('Bot')

  const handleSubmit = () => {
    if (!name || !description) return
    
    onAdd({
      name,
      description,
      icon: selectedIcon
    })
    
    // 重置表单
    setName('')
    setDescription('')
    setSelectedIcon('Bot')
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-neutral-800 p-6 rounded-xl max-w-md w-full mx-4"
          >
            <h3 className="text-lg font-semibold mb-4">添加自定义客服</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">客服名称</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 mt-1 border rounded-lg dark:bg-neutral-700 dark:border-neutral-600"
                  placeholder="请输入客服名称"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500">客服描述</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 mt-1 border rounded-lg dark:bg-neutral-700 dark:border-neutral-600"
                  rows={2}
                  placeholder="请输入客服描述"
                />
              </div>
              
              <div>
                <label className="text-sm text-gray-500">选择图标</label>
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {Object.keys(ICON_MAP).map(iconName => (
                    <button
                      key={iconName}
                      onClick={() => setSelectedIcon(iconName)}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        selectedIcon === iconName
                          ? 'bg-purple-100 dark:bg-neutral-700'
                          : 'hover:bg-gray-100 dark:hover:bg-neutral-600'
                      )}
                    >
                      {ICON_MAP[iconName as keyof typeof ICON_MAP]}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  保存客服
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default AddAssistantModal
