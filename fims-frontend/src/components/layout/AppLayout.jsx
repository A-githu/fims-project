import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import NotificationBell from '../ui/NotificationBell'
import { useAuthStore } from '../../store/authStore'

const AppLayout = () => {
    const { user } = useAuthStore()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    // Déterminer le titre selon le rôle
    const getRoleTitle = () => {
        switch (user?.role) {
            case 'admin': return 'Espace Administrateur'
            case 'manager': return 'Espace Manager'
            case 'agent': return 'Espace Agent'
            case 'unit_supervisor': return 'Espace Supervision'
            default: return 'Tableau de bord'
        }
    }

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <main className="flex-1 lg:ml-64 ml-0 min-h-screen bg-gray-50">
                {/* Header avec notifications */}
                <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
                    <div className="px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {/* Bouton burger pour mobile */}
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">{getRoleTitle()}</h1>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Bouton de notification */}
                            <NotificationBell />

                            {/* Profil utilisateur */}
                            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-semibold text-gray-900">{user?.full_name}</p>
                                    <p className="text-xs text-eneo-lime capitalize">{user?.role === 'unit_supervisor' ? 'Responsable d\'Unité' : user?.role}</p>
                                </div>
                                <div className="w-10 h-10 bg-gradient-to-br from-eneo-lime to-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                                    {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contenu principal */}
                <div className="p-4 sm:p-6">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    )
}

export default AppLayout