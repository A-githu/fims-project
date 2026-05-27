// src/pages/manager/ManagerDashboard.jsx
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    Car, AlertTriangle, CheckCircle, XCircle, Clock,
    Calendar, MapPin, User, FileText, TrendingUp,
    Activity, Shield, Wrench, RefreshCw, Bell
} from 'lucide-react'
import { getDashboardStats, getPendingMissions, getPendingInspections } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import Spinner from '../../components/ui/Spinner'

const ManagerDashboard = () => {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const queryClient = useQueryClient()
    const [refreshing, setRefreshing] = useState(false)

    // Récupérer les stats du dashboard (rafraîchissement toutes les 5 secondes)
    const { data: stats, isLoading, refetch } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: () => getDashboardStats().then(res => res.data),
        refetchIntervalInBackground: true,
    })

    // Récupérer les missions en attente
    const { data: pendingMissions } = useQuery({
        queryKey: ['dashboard-pending-missions'],
        queryFn: () => getPendingMissions().then(res => res.data?.items || res.data || []),
    })

    // Récupérer les inspections en attente
    const { data: pendingInspections } = useQuery({
        queryKey: ['dashboard-pending-inspections'],
        queryFn: () => getPendingInspections().then(res => res.data?.items || res.data || []),
    })

    const handleRefresh = async () => {
        setRefreshing(true)
        await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
        await queryClient.invalidateQueries({ queryKey: ['dashboard-pending-missions'] })
        await queryClient.invalidateQueries({ queryKey: ['dashboard-pending-inspections'] })
        await refetch()
        setTimeout(() => setRefreshing(false), 500)
    }

    if (isLoading) return <Spinner />

    const parc = stats?.parc_vehicules || {}
    const missions = stats?.missions || {}
    const inspections = stats?.inspections || {}
    const alertes = stats?.alertes || {}

    return (
        <div className="space-y-6">
            {/* En-tête avec bouton refresh */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Tableau de bord Manager</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Bienvenue, {user?.full_name} | Dernière mise à jour: {new Date().toLocaleTimeString('fr-FR')}
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Rafraîchir
                </button>
            </div>

            {/* Alertes importantes */}
            {(alertes.missions_sans_vehicule > 0 || alertes.inspections_sans_decision > 0 || alertes.vehicules_bloques > 0) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <div className="flex-1">
                            <p className="font-semibold text-amber-800">Alertes en cours</p>
                            <div className="flex flex-wrap gap-4 mt-1">
                                {alertes.missions_sans_vehicule > 0 && (
                                    <span className="text-sm text-amber-700">
                                        📋 {alertes.missions_sans_vehicule} mission(s) sans véhicule
                                    </span>
                                )}
                                {alertes.inspections_sans_decision > 0 && (
                                    <span className="text-sm text-amber-700">
                                        📝 {alertes.inspections_sans_decision} inspection(s) à valider
                                    </span>
                                )}
                                {alertes.vehicules_bloques > 0 && (
                                    <span className="text-sm text-amber-700">
                                        🚫 {alertes.vehicules_bloques} véhicule(s) bloqué(s)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* KPIs - Cartes stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Carte Véhicules */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Parc Véhicules</p>
                            <p className="text-3xl font-bold text-gray-900 mt-1">{parc.total || 0}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <Car className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                    <div className="mt-3 flex justify-between text-xs">
                        <span className="text-green-600">✓ Actifs: {parc.actifs || 0}</span>
                        <span className="text-amber-600">⚠ En mission: {parc.en_mission || 0}</span>
                        <span className="text-red-600">✗ Bloqués: {parc.bloques || 0}</span>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${parc.taux_disponibilite || 0}` }}></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Disponibilité: {parc.taux_disponibilite || 0}</p>
                </div>

                {/* Carte Missions */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Missions</p>
                            <p className="text-3xl font-bold text-gray-900 mt-1">
                                {(missions.en_attente_attribution || 0) + (missions.vehicule_attribue || 0) + (missions.inspection_soumise || 0)}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
                        <span className="text-amber-600">⏳ En attente: {missions.en_attente_attribution || 0}</span>
                        <span className="text-blue-600">🚗 Attribuées: {missions.vehicule_attribue || 0}</span>
                        <span className="text-purple-600">📋 Inspections: {missions.inspection_soumise || 0}</span>
                        <span className="text-green-600">✓ Terminées: {missions.terminees || 0}</span>
                    </div>
                </div>

                {/* Carte Inspections */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Inspections</p>
                            <p className="text-3xl font-bold text-gray-900 mt-1">{inspections.en_attente_decision_manager || 0}</p>
                            <p className="text-xs text-gray-400">en attente de validation</p>
                        </div>
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                            <FileText className="w-6 h-6 text-amber-600" />
                        </div>
                    </div>
                    <div className="mt-3 flex justify-between text-xs">
                        <span className="text-green-600">✓ Approuvées: {inspections.approuvees || 0}</span>
                        <span className="text-red-600">✗ Rejetées: {inspections.rejetees || 0}</span>
                    </div>
                </div>

                {/* Carte Alertes */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Alertes actives</p>
                            <p className="text-3xl font-bold text-gray-900 mt-1">
                                {(alertes.missions_sans_vehicule || 0) + (alertes.inspections_sans_decision || 0) + (alertes.vehicules_bloques || 0)}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                    <div className="mt-3 space-y-1 text-xs">
                        {alertes.missions_sans_vehicule > 0 && (
                            <p className="text-amber-600">⚠ {alertes.missions_sans_vehicule} mission(s) sans véhicule</p>
                        )}
                        {alertes.inspections_sans_decision > 0 && (
                            <p className="text-amber-600">⚠ {alertes.inspections_sans_decision} inspection(s) à valider</p>
                        )}
                        {alertes.vehicules_bloques > 0 && (
                            <p className="text-red-600">⚠ {alertes.vehicules_bloques} véhicule(s) bloqué(s)</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Missions en attente */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Widget: Demandes de mission en attente */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-amber-500" />
                            <h2 className="font-semibold text-gray-900">Demandes de mission en attente</h2>
                        </div>
                        <button
                            onClick={() => navigate('/manager/missions')}
                            className="text-xs text-green-600 hover:text-green-700 font-medium"
                        >
                            Voir toutes →
                        </button>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                        {pendingMissions && pendingMissions.length > 0 ? (
                            pendingMissions.slice(0, 5).map((mission) => (
                                <div key={mission.id} className="p-4 hover:bg-gray-50 transition cursor-pointer" onClick={() => navigate('/manager/missions')}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-900">{mission.destination}</span>
                                                {mission.vehicle_attempt_count >= 2 && (
                                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                                        {mission.vehicle_attempt_count}/3 tentatives
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" /> {mission.agent?.full_name || 'Agent'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> {new Date(mission.mission_date).toLocaleDateString('fr-FR')}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">{mission.purpose}</p>
                                        </div>
                                        <button className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded-lg">
                                            Attribuer
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-400">
                                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-300" />
                                <p className="text-sm">Aucune mission en attente</p>
                                <p className="text-xs">Toutes les demandes ont été traitées</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Widget: Inspections à valider */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-purple-500" />
                            <h2 className="font-semibold text-gray-900">Inspections à valider</h2>
                        </div>
                        <button
                            onClick={() => navigate('/manager/inspections')}
                            className="text-xs text-green-600 hover:text-green-700 font-medium"
                        >
                            Voir toutes →
                        </button>
                    </div>
                    <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                        {pendingInspections && pendingInspections.length > 0 ? (
                            pendingInspections.slice(0, 5).map((inspection) => (
                                <div key={inspection.id} className="p-4 hover:bg-gray-50 transition cursor-pointer" onClick={() => navigate('/manager/inspections')}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-semibold text-gray-900">
                                                    {inspection.vehicle?.plate_number || 'N/A'}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${inspection.agent_conclusion === 'fit' ? 'bg-green-100 text-green-700' :
                                                    inspection.agent_conclusion === 'warning' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    {inspection.agent_conclusion === 'fit' ? '✓ Apte' :
                                                        inspection.agent_conclusion === 'warning' ? '⚠ Réserves' : '✗ Inapte'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" /> {inspection.agent?.full_name || 'Agent'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {inspection.mileage_at_inspection} km
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                                                Soumis le {new Date(inspection.submitted_at).toLocaleString('fr-FR')}
                                            </p>
                                        </div>
                                        <button className="bg-purple-500 hover:bg-purple-600 text-white text-xs px-3 py-1 rounded-lg">
                                            Examiner
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-400">
                                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-300" />
                                <p className="text-sm">Aucune inspection à valider</p>
                                <p className="text-xs">Toutes les inspections ont été traitées</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ManagerDashboard