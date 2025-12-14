import { AlertTriangle, Info, CheckCircle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger' | 'warning' | 'success'
  icon?: React.ReactNode
}

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  icon
}: ConfirmDialogProps) => {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const getIcon = () => {
    if (icon) return icon
    
    switch (variant) {
      case 'danger':
        return <AlertTriangle className="w-6 h-6" />
      case 'warning':
        return <AlertTriangle className="w-6 h-6" />
      case 'success':
        return <CheckCircle className="w-6 h-6" />
      default:
        return <Info className="w-6 h-6" />
    }
  }

  const getIconStyles = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
      case 'warning':
        return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'success':
        return 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
      default:
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
    }
  }

  const getButtonVariant = () => {
    switch (variant) {
      case 'danger':
        return 'error'
      case 'warning':
        return 'warning'
      case 'success':
        return 'success'
      default:
        return 'default'
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      className="max-w-md z-[99999]"
    >
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${getIconStyles()}`}>
            {getIcon()}
          </div>
          <div className="flex-1">
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="px-6"
          >
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            variant={getButtonVariant() as any}
            className="px-6"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
