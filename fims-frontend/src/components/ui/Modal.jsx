import { useEffect } from 'react'
import { X } from 'lucide-react'

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) {
            document.addEventListener('keydown', handleEsc)
            document.body.style.overflow = 'hidden'
        }
        return () => {
            document.removeEventListener('keydown', handleEsc)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    const sizes = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay noir semi-transparent */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Modal - Fond blanc, bordures grises */}
            <div className={`relative bg-white rounded-xl border border-gray-200 shadow-xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`}>
                {/* Header - Fond blanc, bordure grise */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center rounded-t-xl">
                    <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-green-500 transition-colors duration-200 rounded-lg p-1 hover:bg-gray-100"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body - Contenu */}
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    )
}

export default Modal