import { useState } from 'react'
import { Settings, User, Lock, Globe, Moon, Sun, LogOut } from 'lucide-react'
import SettingsModal from './SettingsModal'

const SettingsButton = ({ className = '' }) => {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${className}`}
                title="Paramètres"
            >
                <Settings className="w-5 h-5 text-gray-600" />
            </button>
            <SettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    )
}

export default SettingsButton