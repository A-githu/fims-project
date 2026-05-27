// src/components/layout/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Car, ClipboardCheck, Wrench, Users, LogOut, Bell, Shield, Activity, Settings, Eye, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useLanguageStore } from '../../store/languageStore'
import { useState } from 'react'
import toast from 'react-hot-toast'
import SettingsModal from '../ui/SettingsModal'

// ==================== TRADUCTIONS ====================
const translations = {
    fr: {
        fleetManagement: 'Fleet Management',
        menuPrincipal: 'Menu principal',
        dashboard: 'Tableau de bord',
        missions: 'Demandes & Missions',
        inspections: 'Inspections',
        vehicles: 'Parc Véhicules',
        maintenance: 'Maintenance',
        myMissions: 'Mes missions',
        myInspections: 'Mes inspections',
        users: 'Utilisateurs',
        settings: 'Paramètres',
        logout: 'Déconnexion',
        disconnected: 'Déconnecté',
        myVehicles: 'Mes véhicules',
        history: 'Historique inspections'
    },
    en: {
        fleetManagement: 'Fleet Management',
        menuPrincipal: 'Main menu',
        dashboard: 'Dashboard',
        missions: 'Missions & Requests',
        inspections: 'Inspections',
        vehicles: 'Fleet Vehicles',
        maintenance: 'Maintenance',
        myMissions: 'My missions',
        myInspections: 'My inspections',
        users: 'Users',
        settings: 'Settings',
        logout: 'Logout',
        disconnected: 'Disconnected',
        myVehicles: 'My vehicles',
        history: 'Inspection history'
    }
}

const NAV = {
    manager: [
        { to: '/manager/dashboard', icon: LayoutDashboard, key: 'dashboard' },
        { to: '/manager/missions', icon: ClipboardCheck, key: 'missions' },
        { to: '/manager/inspections', icon: Shield, key: 'inspections' },
        { to: '/manager/vehicles', icon: Car, key: 'vehicles' },
        { to: '/manager/maintenance', icon: Wrench, key: 'maintenance' },
    ],
    agent: [
        { to: '/agent/dashboard', icon: LayoutDashboard, key: 'dashboard' },
        { to: '/agent/missions', icon: ClipboardCheck, key: 'myMissions' },
        { to: '/agent/inspections', icon: Shield, key: 'myInspections' },
    ],
    admin: [
        { to: '/admin/dashboard', icon: LayoutDashboard, key: 'dashboard' },
        { to: '/admin/users', icon: Users, key: 'users' },
        { to: '/admin/vehicles', icon: Car, key: 'vehicles' },
        { to: '/admin/maintenance', icon: Wrench, key: 'maintenance' },
    ],
    // ✅ AJOUT: Navigation pour le Responsable d'Unité
    unit_supervisor: [
        { to: '/supervisor/dashboard', icon: LayoutDashboard, key: 'dashboard' },
        { to: '/supervisor/vehicles', icon: Car, key: 'myVehicles' },
        { to: '/supervisor/inspections', icon: ClipboardCheck, key: 'history' },
    ],
}

const Sidebar = ({ isOpen, onClose }) => {
    const { user, logout } = useAuthStore()
    const { language } = useLanguageStore()
    const navigate = useNavigate()
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    const t = translations[language]

    const handleLogout = () => {
        logout()
        navigate('/login')
        toast.success(t.disconnected)
    }

    const nav = NAV[user?.role] || []
    const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'

    // Fonction pour obtenir le label selon la clé de traduction
    const getLabel = (key) => {
        const labels = {
            dashboard: t.dashboard,
            missions: t.missions,
            inspections: t.inspections,
            vehicles: t.vehicles,
            maintenance: t.maintenance,
            myMissions: t.myMissions,
            myInspections: t.myInspections,
            users: t.users,
            myVehicles: t.myVehicles,
            history: t.history
        }
        return labels[key] || key
    }

    // Couleur de fond et badge selon le rôle
    const getRoleStyle = () => {
        switch (user?.role) {
            case 'admin':
                return { bg: 'from-red-500 to-red-600', text: 'text-red-500' }
            case 'manager':
                return { bg: 'from-blue-500 to-blue-600', text: 'text-blue-500' }
            case 'agent':
                return { bg: 'from-green-500 to-green-600', text: 'text-green-500' }
            case 'unit_supervisor':
                return { bg: 'from-purple-500 to-purple-600', text: 'text-purple-500' }
            default:
                return { bg: 'from-gray-500 to-gray-600', text: 'text-gray-500' }
        }
    }

    const roleStyle = getRoleStyle()

    return (
        <>
            {/* Backdrop pour mobile */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100 flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Logo */}
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-gradient-to-br from-eneo-lime to-green-600 rounded-xl flex items-center justify-center">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 tracking-tight">FIMS</h1>
                            <p className="text-xs text-gray-400">{t.fleetManagement}</p>
                        </div>
                    </div>
                    {/* Bouton fermer pour mobile */}
                    <button 
                        onClick={onClose}
                        className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* User info */}
                <div className="mx-4 mt-4 p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 bg-gradient-to-br ${roleStyle.bg} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{user?.full_name}</p>
                            <p className={`text-xs uppercase tracking-wide ${roleStyle.text}`}>
                                {user?.role === 'unit_supervisor' ? 'Responsable d\'Unité' : user?.role}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">{t.menuPrincipal}</p>
                    {nav.map(({ to, icon: Icon, key }) => (
                        <NavLink
                            key={to}
                            to={to}
                            onClick={() => {
                                if (window.innerWidth < 1024) onClose()
                            }}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm ${isActive
                                    ? 'bg-eneo-lime text-white shadow-md'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-eneo-lime'
                                }`
                            }
                        >
                            <Icon className="w-4 h-4" />
                            <span>{getLabel(key)}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Bottom avec bouton paramètres et déconnexion */}
                <div className="p-4 border-t border-gray-100">
                    {/* Bouton Paramètres */}
                    <button
                        onClick={() => {
                            setIsSettingsOpen(true)
                            if (window.innerWidth < 1024) onClose()
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-gray-600 hover:bg-gray-50 hover:text-eneo-lime transition-all duration-200 text-sm mb-2"
                    >
                        <Settings className="w-4 h-4" />
                        <span>{t.settings}</span>
                    </button>

                    {/* Bouton Déconnexion */}
                    <button
                        onClick={() => {
                            handleLogout()
                            if (window.innerWidth < 1024) onClose()
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-red-500 hover:bg-red-50 transition-all duration-200 text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>{t.logout}</span>
                    </button>
                    <p className="text-center text-[10px] text-gray-400 mt-3">FIMS v1.0</p>
                </div>
            </aside>

            {/* Modal Paramètres */}
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </>
    )
}

export default Sidebar