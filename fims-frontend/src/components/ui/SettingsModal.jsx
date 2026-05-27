import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useLanguageStore } from '../../store/languageStore'
import { useThemeStore } from '../../store/themeStore'
import { updateCurrentUser, changePassword, deleteAccount } from '../../services/api'
import { X, User, Lock, Moon, Sun, Globe, Save, Trash2, LogOut, Info, Check, Car } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from './Modal'


// ==================== TRADUCTIONS ====================
const translations = {
    fr: {
        title: 'Paramètres',
        profile: 'Mon profil',
        security: 'Sécurité',
        appearance: 'Apparence',
        about: 'À propos',
        logout: 'Déconnexion',
        fullName: 'Nom complet',
        email: 'Email',
        role: 'Rôle',
        department: 'Département',
        saveChanges: 'Enregistrer les modifications',
        changePassword: 'Changer le mot de passe',
        currentPassword: 'Mot de passe actuel',
        newPassword: 'Nouveau mot de passe',
        confirmPassword: 'Confirmer le nouveau mot de passe',
        passwordMinLength: 'Minimum 6 caractères',
        deleteAccount: 'Supprimer le compte',
        deleteWarning: 'Cette action est irréversible. Toutes vos données seront supprimées.',
        confirmDelete: 'Tapez "SUPPRIMER" pour confirmer',
        theme: 'Thème',
        light: 'Clair',
        dark: 'Sombre',
        language: 'Langue',
        french: 'Français',
        english: 'English',
        admin: 'Administrateur',
        manager: 'Manager',
        agent: 'Agent',
        notSpecified: 'Non spécifié',
        aboutTitle: 'À propos de FIMS',
        aboutDescription: 'Fleet Inspection & Management System (FIMS) est une solution complète de gestion des inspections de véhicules pour ENEO Cameroun.',
        version: 'Version',
        features: 'Fonctionnalités',
        feature1: 'Digitalisation des inspections véhicules',
        feature2: 'Gestion des missions et du parc automobile',
        feature3: 'Workflow complet agent → manager',
        feature4: 'Génération de rapports PDF conformes ENEO',
        feature5: 'Tableaux de bord par rôle',
        copyright: '© 2025 FIMS - Tous droits réservés',
        developedBy: 'Développé par',
        close: 'Fermer'
    },
    en: {
        title: 'Settings',
        profile: 'My profile',
        security: 'Security',
        appearance: 'Appearance',
        about: 'About',
        logout: 'Logout',
        fullName: 'Full name',
        email: 'Email',
        role: 'Role',
        department: 'Department',
        saveChanges: 'Save changes',
        changePassword: 'Change password',
        currentPassword: 'Current password',
        newPassword: 'New password',
        confirmPassword: 'Confirm new password',
        passwordMinLength: 'Minimum 6 characters',
        deleteAccount: 'Delete account',
        deleteWarning: 'This action is irreversible. All your data will be deleted.',
        confirmDelete: 'Type "DELETE" to confirm',
        theme: 'Theme',
        light: 'Light',
        dark: 'Dark',
        language: 'Language',
        french: 'French',
        english: 'English',
        admin: 'Administrator',
        manager: 'Manager',
        agent: 'Agent',
        notSpecified: 'Not specified',
        aboutTitle: 'About FIMS',
        aboutDescription: 'Fleet Inspection & Management System (FIMS) is a complete vehicle inspection management solution for ENEO Cameroon.',
        version: 'Version',
        features: 'Features',
        feature1: 'Digital vehicle inspections',
        feature2: 'Mission and fleet management',
        feature3: 'Complete agent → manager workflow',
        feature4: 'ENEO-compliant PDF report generation',
        feature5: 'Role-based dashboards',
        copyright: '© 2025 FIMS - All rights reserved',
        developedBy: 'Developed by',
        close: 'Close'
    }
}

const SettingsModal = ({ isOpen, onClose }) => {
    const { user, updateUser: updateUserStore, logout } = useAuthStore()
    const { language, setLanguage } = useLanguageStore()
    const { theme, setTheme } = useThemeStore()
    const [activeTab, setActiveTab] = useState('profile')
    const [loading, setLoading] = useState(false)

    const t = translations[language]

    // Formulaires
    const [profileForm, setProfileForm] = useState({
        full_name: user?.full_name || '',
        email: user?.email || ''
    })
    const [passwordForm, setPasswordForm] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    })
    const [deleteConfirm, setDeleteConfirm] = useState('')

    useEffect(() => {
        if (user) {
            setProfileForm({
                full_name: user.full_name || '',
                email: user.email || ''
            })
        }
    }, [user])

    const handleUpdateProfile = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            const response = await updateCurrentUser({
                full_name: profileForm.full_name,
                email: profileForm.email
            })
            updateUserStore(response.data)
            toast.success(t.saveChanges === 'Enregistrer les modifications' ? 'Profil mis à jour avec succès' : 'Profile updated successfully')
        } catch (error) {
            toast.error(error.response?.data?.detail || (t.saveChanges === 'Enregistrer les modifications' ? 'Erreur lors de la mise à jour' : 'Update error'))
        } finally {
            setLoading(false)
        }
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        if (passwordForm.new_password !== passwordForm.confirm_password) {
            toast.error(t.confirmPassword === 'Confirmer le nouveau mot de passe' ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match')
            return
        }
        if (passwordForm.new_password.length < 6) {
            toast.error(t.passwordMinLength === 'Minimum 6 caractères' ? 'Le mot de passe doit contenir au moins 6 caractères' : 'Password must be at least 6 characters')
            return
        }
        setLoading(true)
        try {
            await changePassword({
                current_password: passwordForm.current_password,
                new_password: passwordForm.new_password
            })
            toast.success(t.changePassword === 'Changer le mot de passe' ? 'Mot de passe modifié avec succès' : 'Password changed successfully')
            setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
        } catch (error) {
            toast.error(error.response?.data?.detail || (t.changePassword === 'Changer le mot de passe' ? 'Erreur lors du changement' : 'Change error'))
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteAccount = async () => {
        const confirmWord = language === 'fr' ? 'SUPPRIMER' : 'DELETE'
        if (deleteConfirm !== confirmWord) {
            toast.error(language === 'fr' ? 'Tapez "SUPPRIMER" pour confirmer' : 'Type "DELETE" to confirm')
            return
        }
        setLoading(true)
        try {
            await deleteAccount()
            toast.success(language === 'fr' ? 'Compte supprimé avec succès' : 'Account deleted successfully')
            logout()
            onClose()
            window.location.href = '/login'
        } catch (error) {
            toast.error(error.response?.data?.detail || (language === 'fr' ? 'Erreur lors de la suppression' : 'Delete error'))
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        logout()
        onClose()
    }

    const getRoleLabel = () => {
        const role = user?.role
        if (role === 'admin') return t.admin
        if (role === 'manager') return t.manager
        if (role === 'agent') return t.agent
        return role || t.notSpecified
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t.title} size="lg">
            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar des onglets */}
                <div className="md:w-48 space-y-1">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-left ${activeTab === 'profile'
                            ? 'bg-green-50 text-green-600'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <User className="w-4 h-4" />
                        <span className="text-sm font-medium">{t.profile}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-left ${activeTab === 'security'
                            ? 'bg-green-50 text-green-600'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Lock className="w-4 h-4" />
                        <span className="text-sm font-medium">{t.security}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('appearance')}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-left ${activeTab === 'appearance'
                            ? 'bg-green-50 text-green-600'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Globe className="w-4 h-4" />
                        <span className="text-sm font-medium">{t.appearance}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('about')}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-left ${activeTab === 'about'
                            ? 'bg-green-50 text-green-600'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Info className="w-4 h-4" />
                        <span className="text-sm font-medium">{t.about}</span>
                    </button>
                    <hr className="my-2 border-gray-200" />
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-all text-left"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-medium">{t.logout}</span>
                    </button>
                </div>

                {/* Contenu principal */}
                <div className="flex-1">
                    {/* Onglet Profil */}
                    {activeTab === 'profile' && (
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t.fullName}</label>
                                <input
                                    type="text"
                                    value={profileForm.full_name}
                                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t.email}</label>
                                <input
                                    type="email"
                                    value={profileForm.email}
                                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    required
                                />
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-sm text-gray-600">
                                    <span className="font-medium">{t.role}:</span> {getRoleLabel()}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium">{t.department}:</span> {user?.department || t.notSpecified}
                                </p>
                            </div>
                            <div className="flex justify-end pt-2">
                                <button type="submit" disabled={loading} className="btn-primary">
                                    {loading ? (language === 'fr' ? 'Enregistrement...' : 'Saving...') : t.saveChanges}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Onglet Sécurité */}
                    {activeTab === 'security' && (
                        <div className="space-y-6">
                            <form onSubmit={handleChangePassword} className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900">{t.changePassword}</h3>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.currentPassword}</label>
                                    <input
                                        type="password"
                                        value={passwordForm.current_password}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.newPassword}</label>
                                    <input
                                        type="password"
                                        value={passwordForm.new_password}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        required
                                    />
                                    <p className="text-xs text-gray-400 mt-1">{t.passwordMinLength}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{t.confirmPassword}</label>
                                    <input
                                        type="password"
                                        value={passwordForm.confirm_password}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button type="submit" disabled={loading} className="btn-primary">
                                        {loading ? (language === 'fr' ? 'Changement...' : 'Changing...') : t.changePassword}
                                    </button>
                                </div>
                            </form>

                            <hr className="border-gray-200" />

                            <div>
                                <h3 className="text-lg font-semibold text-red-600 mb-3">{t.deleteAccount}</h3>
                                <p className="text-sm text-gray-600 mb-3">{t.deleteWarning}</p>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder={t.confirmDelete}
                                        value={deleteConfirm}
                                        onChange={(e) => setDeleteConfirm(e.target.value)}
                                        className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    />
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={loading}
                                        className="w-full py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        {loading ? (language === 'fr' ? 'Suppression...' : 'Deleting...') : t.deleteAccount}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Onglet Apparence */}
                    {activeTab === 'appearance' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.theme}</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`flex items-center justify-center gap-3 p-4 border rounded-xl transition-all ${theme === 'light'
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Sun className="w-5 h-5 text-amber-500" />
                                        <span className="font-medium">{t.light}</span>
                                        {theme === 'light' && <Check className="w-4 h-4 text-green-500 ml-auto" />}
                                    </button>
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`flex items-center justify-center gap-3 p-4 border rounded-xl transition-all ${theme === 'dark'
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Moon className="w-5 h-5 text-indigo-500" />
                                        <span className="font-medium">{t.dark}</span>
                                        {theme === 'dark' && <Check className="w-4 h-4 text-green-500 ml-auto" />}
                                    </button>
                                </div>
                            </div>

                            <hr className="border-gray-200" />

                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.language}</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setLanguage('fr')}
                                        className={`flex items-center justify-center gap-3 p-4 border rounded-xl transition-all ${language === 'fr'
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <span className="text-2xl">🇫🇷</span>
                                        <span className="font-medium">{t.french}</span>
                                        {language === 'fr' && <Check className="w-4 h-4 text-green-500 ml-auto" />}
                                    </button>
                                    <button
                                        onClick={() => setLanguage('en')}
                                        className={`flex items-center justify-center gap-3 p-4 border rounded-xl transition-all ${language === 'en'
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <span className="text-2xl">🇬🇧</span>
                                        <span className="font-medium">{t.english}</span>
                                        {language === 'en' && <Check className="w-4 h-4 text-green-500 ml-auto" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Onglet À propos - CORRIGÉ */}
                    {activeTab === 'about' && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <Car className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">{t.aboutTitle}</h2>
                                <p className="text-sm text-gray-500 mt-2">{t.aboutDescription}</p>
                            </div>

                            <div className="border-t border-gray-200 pt-4">
                                <p className="text-xs text-gray-400 text-center">{t.version} 1.0.0</p>
                            </div>

                            <div>
                                <h3 className="text-md font-semibold text-gray-800 mb-3">{t.features}</h3>
                                <ul className="space-y-2">
                                    <li className="flex items-center gap-2 text-sm text-gray-600">
                                        <Check className="w-4 h-4 text-green-500" />
                                        {t.feature1}
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-gray-600">
                                        <Check className="w-4 h-4 text-green-500" />
                                        {t.feature2}
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-gray-600">
                                        <Check className="w-4 h-4 text-green-500" />
                                        {t.feature3}
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-gray-600">
                                        <Check className="w-4 h-4 text-green-500" />
                                        {t.feature4}
                                    </li>
                                    <li className="flex items-center gap-2 text-sm text-gray-600">
                                        <Check className="w-4 h-4 text-green-500" />
                                        {t.feature5}
                                    </li>
                                </ul>
                            </div>

                            <div className="border-t border-gray-200 pt-4">
                                <p className="text-xs text-gray-400 text-center">{t.copyright}</p>
                                <p className="text-xs text-gray-400 text-center mt-1">
                                    {t.developedBy} <span className="text-green-600">ENEO Cameroun - Direction Logistique</span>
                                </p>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button onClick={() => setActiveTab('profile')} className="btn-secondary">
                                    {t.close}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    )
}

export default SettingsModal