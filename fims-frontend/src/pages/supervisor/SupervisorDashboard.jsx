// src/pages/supervisor/SupervisorDashboard.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import {
    Car, CheckCircle, AlertTriangle, FileText,
    Calendar, Clock, TrendingUp, Activity, Bell,
    Download, Eye, User, MapPin, Gauge, RefreshCw
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import { format, subDays } from 'date-fns'
import fr from 'date-fns/locale/fr'
import api from '../../services/api'
import Spinner from '../../components/ui/Spinner'
import PageHeader from '../../components/ui/PageHeader'
import { formatDate, formatDateTime } from '../../utils/helpers'
import Modal from '../../components/ui/Modal'
import toast from 'react-hot-toast'

const SupervisorDashboard = () => {
    const { user } = useAuthStore()
    const queryClient = useQueryClient()
    const [selectedVehicle, setSelectedVehicle] = useState(null)
    const [notifyModal, setNotifyModal] = useState(null)
    const [notifyMessage, setNotifyMessage] = useState('')
    const [selectedAgentId, setSelectedAgentId] = useState('')
    const [isRefreshing, setIsRefreshing] = useState(false)

    // ✅ Dashboard stats avec rafraîchissement automatique toutes les 10 secondes
    const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
        queryKey: ['supervisor-dashboard'],
        queryFn: () => api.get('/api/supervisor/dashboard').then(r => r.data),
        refetchInterval: 10000, // Rafraîchissement automatique toutes les 10 secondes
        staleTime: 5000,
    })

    // ✅ Véhicules nécessitant attention
    const { data: vehicles, isLoading: vehiclesLoading, refetch: refetchVehicles } = useQuery({
        queryKey: ['supervisor-vehicles-needing-attention'],
        queryFn: () => api.get('/api/supervisor/vehicles', {
            params: { needs_attention: true, limit: 10 }
        }).then(r => r.data?.items || r.data || []),
        refetchInterval: 10000,
        staleTime: 5000,
    })

    // ✅ Inspections récentes
    const { data: recentInspections, isLoading: inspectionsLoading, refetch: refetchInspections } = useQuery({
        queryKey: ['supervisor-recent-inspections'],
        queryFn: () => api.get('/api/supervisor/inspections', {
            params: { limit: 10 }
        }).then(r => r.data?.items || r.data || []),
        refetchInterval: 10000,
        staleTime: 5000,
    })

    const { data: departmentAgents } = useQuery({
        queryKey: ['supervisor-agents'],
        queryFn: () => api.get('/api/supervisor/agents').then(r => r.data?.items || r.data || []),
        enabled: !!notifyModal,
    })

    // ✅ Rafraîchissement manuel
    const handleManualRefresh = async () => {
        setIsRefreshing(true)
        await Promise.all([
            refetchStats(),
            refetchVehicles(),
            refetchInspections()
        ])
        setIsRefreshing(false)
        toast.success('Données actualisées')
    }

    const notifyMutation = useMutation({
        mutationFn: (payload) => api.post('/api/supervisor/notify-agent', payload).then(r => r.data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['supervisor-vehicles-needing-attention'] })
            toast.success(`Signalement envoyé à ${data.notified_agent} ✓`)
            setNotifyModal(null)
            setNotifyMessage('')
            setSelectedAgentId('')
        },
        onError: (err) => toast.error(err.response?.data?.detail || 'Erreur lors de l\'envoi')
    })

    const handleDownloadPDF = async (inspectionId, plate) => {
        try {
            toast.loading('Génération du PDF...', { id: 'pdf-loading' })
            const token = localStorage.getItem('fims_token')
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
            const response = await fetch(`${API_URL}/api/inspections/${inspectionId}/pdf`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!response.ok) throw new Error()
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `ENEO_Checkup_${plate}_${inspectionId}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
            toast.success('Fiche PDF téléchargée ✓', { id: 'pdf-loading' })
        } catch {
            toast.error('Erreur lors du téléchargement', { id: 'pdf-loading' })
        }
    }

    if (statsLoading || vehiclesLoading || inspectionsLoading) return <Spinner />

    const vehicleStatusData = stats?.vehicles_by_status ? [
        { name: 'Actifs', value: stats.vehicles_by_status.active || 0, color: '#22c55e' },
        { name: 'En mission', value: stats.vehicles_by_status.in_mission || 0, color: '#3b82f6' },
        { name: 'Maintenance', value: stats.vehicles_by_status.maintenance || 0, color: '#f59e0b' },
        { name: 'Bloqués', value: stats.vehicles_by_status.blocked || 0, color: '#ef4444' },
    ] : []

    const alertVehicles = vehicles?.filter(v => v.needs_attention) || []

    return (
        <div className="space-y-6">
            {/* En-tête avec bouton refresh */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-2 text-sm text-purple-600 mb-1">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        <span className="font-mono text-xs uppercase tracking-wide">Supervision lecture seule</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Mon Parc — {stats?.department_name || user?.department || 'Mon unité'}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {stats?.total_vehicles || 0} véhicule(s) dans votre unité · Taux de conformité: {stats?.conformity_rate || 0}%
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Actualiser
                    </button>
                    <div className="flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-lg border border-purple-200">
                        <span className="text-purple-600 text-sm font-medium">👤 Responsable d'Unité</span>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Véhicules dans l'unité</p>
                            <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.total_vehicles || 0}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <Car className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Taux de conformité</p>
                            <p className="text-3xl font-bold text-green-600 mt-1">{stats?.conformity_rate || 0}%</p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Inspections approuvées</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Inspections totales</p>
                            <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.total_inspections || 0}</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                            <FileText className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Ce mois: {stats?.inspections_this_month || 0}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">À surveiller</p>
                            <p className="text-3xl font-bold text-amber-600 mt-1">{stats?.vehicles_not_inspected_30_days || 0}</p>
                        </div>
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-amber-600" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">+ {stats?.vehicles_never_inspected || 0} jamais inspecté(s)</p>
                </div>
            </div>

            {/* État du parc - Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-green-600" /> État du parc
                    </h3>
                    <div className="space-y-3">
                        {vehicleStatusData.map(item => (
                            <div key={item.name}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-600">{item.name}</span>
                                    <span className="font-semibold text-gray-900">{item.value}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="h-2 rounded-full transition-all" style={{ width: `${(item.value / (stats?.total_vehicles || 1)) * 100}%`, backgroundColor: item.color }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" /> Dernière inspection
                    </h3>
                    {stats?.last_inspection_date ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{formatDate(stats.last_inspection_date)}</p>
                            <p className="text-sm text-gray-500 mt-1">Dernière inspection enregistrée</p>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-gray-400">
                            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Aucune inspection enregistrée</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Dernières inspections */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-600" /> Dernières inspections
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Véhicule</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Manager</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Résultat</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">PDF</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentInspections.length === 0 ? (
                                <tr><td colSpan="6" className="px-5 py-8 text-center text-gray-400">Aucune inspection trouvée</td></tr>
                            ) : (
                                recentInspections.map(insp => {
                                    const conclusionColor = insp.agent_conclusion === 'fit' ? 'bg-green-100 text-green-700' :
                                        insp.agent_conclusion === 'warning' ? 'bg-amber-100 text-amber-700' :
                                            'bg-red-100 text-red-700'
                                    const conclusionIcon = insp.agent_conclusion === 'fit' ? '✓' : insp.agent_conclusion === 'warning' ? '⚠' : '✗'
                                    const conclusionLabel = insp.agent_conclusion === 'fit' ? 'Conforme' : insp.agent_conclusion === 'warning' ? 'Avec réserves' : 'Inapte'
                                    return (
                                        <tr key={insp.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                            <td className="px-5 py-3 font-mono text-sm font-medium text-gray-900">{insp.vehicle_plate}</td>
                                            <td className="px-5 py-3 text-sm text-gray-600">{insp.agent_name}</td>
                                            <td className="px-5 py-3 text-sm text-gray-600">{insp.manager_name || '—'}</td>
                                            <td className="px-5 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${conclusionColor}`}>{conclusionIcon} {conclusionLabel}</span></td>
                                            <td className="px-5 py-3 text-sm text-gray-500">{formatDate(insp.submitted_at)}</td>
                                            <td className="px-5 py-3">
                                                <button onClick={() => handleDownloadPDF(insp.id, insp.vehicle_plate)} className="text-green-600 hover:text-green-700">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Alertes - Véhicules sans inspection récente (déplacé à la fin) */}
            {alertVehicles.length > 0 && (
                <div className="bg-red-50 rounded-xl border border-red-200 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <h3 className="font-semibold text-red-800">⚠️ {alertVehicles.length} véhicule(s) sans inspection récente</h3>
                    </div>
                    <div className="space-y-3">
                        {alertVehicles.map(vehicle => (
                            <div key={vehicle.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100">
                                <div className="flex-1">
                                    <p className="font-mono font-semibold text-gray-900">{vehicle.plate_number} — {vehicle.brand} {vehicle.model}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Dernière inspection: {vehicle.days_since_last_inspection === null ? 'Jamais inspecté' : `il y a ${vehicle.days_since_last_inspection} jours`}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedVehicle(vehicle)
                                        setNotifyModal(vehicle)
                                        setNotifyMessage('')
                                        setSelectedAgentId('')
                                    }}
                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg flex items-center gap-1 transition"
                                >
                                    <Bell className="w-3.5 h-3.5" /> Signaler à un agent
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal Signalement */}
            <Modal isOpen={notifyModal !== null} onClose={() => { setNotifyModal(null); setNotifyMessage(''); setSelectedAgentId('') }} title="Signaler un besoin d'inspection" size="md">
                {notifyModal && (
                    <div className="space-y-4">
                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                            <p className="text-sm text-amber-800">
                                <AlertTriangle className="w-4 h-4 inline mr-1" />
                                Vous allez envoyer un rappel à un agent de votre unité pour effectuer l'inspection du véhicule <strong>{notifyModal.plate_number}</strong>.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sélectionner un agent *</label>
                            <select
                                value={selectedAgentId}
                                onChange={(e) => setSelectedAgentId(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="">-- Choisir un agent --</option>
                                {departmentAgents?.map(agent => (
                                    <option key={agent.id} value={agent.id}>{agent.full_name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Message (optionnel)</label>
                            <textarea
                                rows={3}
                                value={notifyMessage}
                                onChange={(e) => setNotifyMessage(e.target.value)}
                                placeholder="Ex: Ce véhicule n'a pas été inspecté depuis longtemps..."
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 resize-none"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => { setNotifyModal(null); setNotifyMessage(''); setSelectedAgentId('') }} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Annuler</button>
                            <button
                                onClick={() => {
                                    if (!selectedAgentId) { toast.error('Veuillez sélectionner un agent'); return }
                                    notifyMutation.mutate({ agent_id: selectedAgentId, vehicle_id: notifyModal.id, message: notifyMessage })
                                }}
                                disabled={notifyMutation.isPending}
                                className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {notifyMutation.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Bell className="w-4 h-4" />}
                                Envoyer le signalement
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default SupervisorDashboard