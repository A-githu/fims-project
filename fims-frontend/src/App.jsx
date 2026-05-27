// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useLanguageStore } from './store/languageStore'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'

// Manager pages
import ManagerDashboard from './pages/manager/ManagerDashboard'
import VehiclesPage from './pages/manager/VehiclesPage'
import ManagerMissionsPage from './pages/manager/ManagerMissionsPage'
import ManagerInspectionsPage from './pages/manager/ManagerInspectionsPage'
import MaintenancePage from './pages/manager/MaintenancePage'

// Agent pages
import AgentDashboard from './pages/agent/AgentDashboard'
import AgentMissionsPage from './pages/agent/AgentMissionsPage'
import AgentInspectionsPage from './pages/agent/AgentInspectionsPage'
import NewInspectionPage from './pages/agent/NewInspectionPage'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import UsersPage from './pages/admin/UsersPage'

// ✅ Supervisor pages (Responsable d'Unité)
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard'
import SupervisorVehiclesPage from './pages/supervisor/SupervisorVehiclesPage'
import SupervisorInspectionsPage from './pages/supervisor/SupervisorInspectionsPage'

// Composant pour fournir la langue à tous les enfants (si nécessaire)
import { createContext, useContext } from 'react'

// Création du contexte de langue
export const LanguageContext = createContext({
    language: 'fr',
    setLanguage: () => { },
    t: (key) => key
})

// Hook personnalisé pour utiliser la langue
export const useLanguage = () => useContext(LanguageContext)

// Traductions globales
export const translations = {
    fr: {
        // Navigation
        dashboard: 'Tableau de bord',
        missions: 'Missions',
        inspections: 'Inspections',
        vehicles: 'Véhicules',
        maintenance: 'Maintenance',
        users: 'Utilisateurs',

        // Actions
        add: 'Ajouter',
        edit: 'Modifier',
        delete: 'Supprimer',
        save: 'Enregistrer',
        cancel: 'Annuler',
        confirm: 'Confirmer',
        search: 'Rechercher',
        filter: 'Filtrer',
        export: 'Exporter',

        // Status
        active: 'Actif',
        inactive: 'Inactif',
        pending: 'En attente',
        approved: 'Approuvé',
        rejected: 'Rejeté',
        completed: 'Terminé',

        // Messages
        welcome: 'Bienvenue',
        logout: 'Déconnexion',
        login: 'Connexion',
        loading: 'Chargement...',
        noData: 'Aucune donnée',
        error: 'Une erreur est survenue',
        success: 'Opération réussie',

        // Form labels
        email: 'Email',
        password: 'Mot de passe',
        fullName: 'Nom complet',
        role: 'Rôle',
        department: 'Département',
        registrationNumber: 'Immatriculation',
        brand: 'Marque',
        model: 'Modèle',
        year: 'Année',
        startLocation: 'Lieu de départ',
        endLocation: 'Destination',
        startDate: 'Date de départ',
        endDate: 'Date de retour',
        reason: 'Motif',
        mileage: 'Kilométrage',
        location: 'Lieu',
        observations: 'Observations',
        conclusion: 'Conclusion',
    },
    en: {
        // Navigation
        dashboard: 'Dashboard',
        missions: 'Missions',
        inspections: 'Inspections',
        vehicles: 'Vehicles',
        maintenance: 'Maintenance',
        users: 'Users',

        // Actions
        add: 'Add',
        edit: 'Edit',
        delete: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
        confirm: 'Confirm',
        search: 'Search',
        filter: 'Filter',
        export: 'Export',

        // Status
        active: 'Active',
        inactive: 'Inactive',
        pending: 'Pending',
        approved: 'Approved',
        rejected: 'Rejected',
        completed: 'Completed',

        // Messages
        welcome: 'Welcome',
        logout: 'Logout',
        login: 'Login',
        loading: 'Loading...',
        noData: 'No data',
        error: 'An error occurred',
        success: 'Operation successful',

        // Form labels
        email: 'Email',
        password: 'Password',
        fullName: 'Full name',
        role: 'Role',
        department: 'Department',
        registrationNumber: 'Registration number',
        brand: 'Brand',
        model: 'Model',
        year: 'Year',
        startLocation: 'Start location',
        endLocation: 'Destination',
        startDate: 'Start date',
        endDate: 'End date',
        reason: 'Reason',
        mileage: 'Mileage',
        location: 'Location',
        observations: 'Observations',
        conclusion: 'Conclusion',
    }
}

// Provider component
export const LanguageProvider = ({ children }) => {
    const { language, setLanguage } = useLanguageStore()

    const t = (key) => {
        return translations[language]?.[key] || translations.fr[key] || key
    }

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    )
}

function AppContent() {
    const { token, user } = useAuthStore()

    const getDefaultRedirect = () => {
        if (!user) return '/login'
        switch (user.role) {
            case 'agent': return '/agent/dashboard'
            case 'manager': return '/manager/dashboard'
            case 'admin': return '/admin/dashboard'
            case 'unit_supervisor': return '/supervisor/dashboard'  // ✅ AJOUT
            default: return '/login'
        }
    }

    // Si pas de token, rediriger vers login
    if (!token || !user) {
        return (
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        )
    }

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Routes Manager */}
            <Route element={<ProtectedRoute allowedRoles={['manager', 'admin']} />}>
                <Route element={<AppLayout />}>
                    <Route path="/manager/dashboard" element={<ManagerDashboard />} />
                    <Route path="/manager/vehicles" element={<VehiclesPage />} />
                    <Route path="/manager/missions" element={<ManagerMissionsPage />} />
                    <Route path="/manager/inspections" element={<ManagerInspectionsPage />} />
                    <Route path="/manager/maintenance" element={<MaintenancePage />} />
                </Route>
            </Route>

            {/* Routes Agent */}
            <Route element={<ProtectedRoute allowedRoles={['agent', 'manager', 'admin']} />}>
                <Route element={<AppLayout />}>
                    <Route path="/agent/dashboard" element={<AgentDashboard />} />
                    <Route path="/agent/missions" element={<AgentMissionsPage />} />
                    <Route path="/agent/inspections" element={<AgentInspectionsPage />} />
                    <Route path="/agent/inspections/new" element={<NewInspectionPage />} />
                </Route>
            </Route>

            {/* Routes Admin */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route element={<AppLayout />}>
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/users" element={<UsersPage />} />
                    <Route path="/admin/vehicles" element={<VehiclesPage />} />
                    <Route path="/admin/maintenance" element={<MaintenancePage />} />
                </Route>
            </Route>

            {/* ✅ Routes Supervisor (Responsable d'Unité) - NOUVEAU */}
            <Route element={<ProtectedRoute allowedRoles={['unit_supervisor', 'admin']} />}>
                <Route element={<AppLayout />}>
                    <Route path="/supervisor/dashboard" element={<SupervisorDashboard />} />
                    <Route path="/supervisor/vehicles" element={<SupervisorVehiclesPage />} />
                    <Route path="/supervisor/inspections" element={<SupervisorInspectionsPage />} />
                </Route>
            </Route>

            <Route path="/" element={<Navigate to={getDefaultRedirect()} replace />} />
            <Route path="*" element={<Navigate to={getDefaultRedirect()} replace />} />
        </Routes>
    )
}

function App() {
    return (
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    )
}

export default App