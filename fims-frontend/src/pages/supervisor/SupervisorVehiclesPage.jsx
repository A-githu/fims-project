// src/pages/supervisor/SupervisorVehiclesPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import {
    Car, Search, Filter, AlertTriangle, Bell, Eye, FileText,
    CheckCircle, XCircle, Clock, Calendar, Gauge, User, Download,
    Wrench, RefreshCw, Info, AlertCircle, Shield
} from 'lucide-react'
import api from '../../services/api'
import Spinner from '../../components/ui/Spinner'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import { formatDate } from '../../utils/helpers'
import toast from 'react-hot-toast'

const SupervisorVehiclesPage = () => {
    const { user } = useAuthStore()
    const queryClient = useQueryClient()
    const [filterStatus, setFilterStatus] = useState('all')
    const [filterInspection, setFilterInspection] = 'all'
    const [searchTerm, setSearchTerm] = useState('')
    const [notifyModal, setNotifyModal] = useState(null)
    const [notifyMessage, setNotifyMessage] = useState('')
    const [selectedAgentId, setSelectedAgentId] = useState('')
    const [expandedId, setExpandedId] = useState(null)
    const [inspectionsDetail, setInspectionsDetail] = useState({})

    const { data: vehicles, isLoading } = useQuery({
        queryKey: ['supervisor-vehicles', filterStatus, filterInspection],
        queryFn: () => api.get('/api/supervisor/vehicles', {
            params: {
                status: filterStatus !== 'all' ? filterStatus : undefined,
                needs_attention: filterInspection === 'attention' ? true : (filterInspection === 'never' ? false : undefined),
                never_inspected: filterInspection === 'never' ? true : undefined,
            }
        }).then(r => r.data?.items || r.data || []),
        staleTime: 60000,
    })

    const { data: departmentAgents } = useQuery({
        queryKey: ['supervisor-agents'],
        queryFn: () => api.get('/api/supervisor/agents').then(r => r.data?.items || r.data || []),
        enabled: !!notifyModal,
    })

    const { data: vehicleInspections, refetch: refetchInspections } = useQuery({
        queryKey: ['supervisor-vehicle-inspections', expandedId],
        queryFn: () => api.get('/api/supervisor/inspections', {
            params: { vehicle_id: expandedId, limit: 20 }
        }).then(r => r.data?.items || r.data || []),
        enabled: !!expandedId,
    })

    const notifyMutation = useMutation({
        mutationFn: (payload) => api.post('/api/supervisor/notify-agent', payload).then(r => r.data),
        onSuccess: (data) => {
            queryClient.invalidateQueries(['supervisor-vehicles'])
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

    const getInspectionAgeColor = (days) => {
        if (days === null || days === undefined) return '#ef4444'
        if (days < 30) return '#22c55e'
        if (days < 60) return '#f59e0b'
        return '#ef4444'
    }

    const getInspectionAgeLabel = (days) => {
        if (days === null) return 'Jamais inspecté'
        if (days === 0) return 'Inspecté aujourd\'hui'
        if (days === 1) return 'Il y a 1 jour'
        return `Il y a ${days} jours`
    }

    const getStatusConfig = (status) => {
        const map = {
            'active': { label: 'Disponible', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
            'in_mission': { label: 'En mission', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
            'maintenance': { label: 'Maintenance', icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
            'blocked': { label: 'Bloqué', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
            'decommissioned': { label: 'Hors service', icon: AlertTriangle, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
        }
        return map[status] || map.active
    }

    const getConclusionConfig = (conclusion) => {
        const map = {
            'fit': { label: 'Conforme', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
            'warning': { label: 'Avec réserves', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100' },
            'unfit': { label: 'Inapte', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' }
        }
        return map[conclusion] || map.fit
    }

    const filteredVehicles = vehicles?.filter(v => {
        if (!searchTerm) return true
        return v.plate_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.model.toLowerCase().includes(searchTerm.toLowerCase())
    }) || []

    if (isLoading) return <Spinner />

    // Statistiques pour les filtres
    const stats = {
        total: filteredVehicles.length,
        active: filteredVehicles.filter(v => v.status === 'active').length,
        in_mission: filteredVehicles.filter(v => v.status === 'in_mission').length,
        maintenance: filteredVehicles.filter(v => v.status === 'maintenance').length,
        blocked: filteredVehicles.filter(v => v.status === 'blocked').length,
        needs_attention: filteredVehicles.filter(v => v.needs_attention).length,
        never_inspected: filteredVehicles.filter(v => v.days_since_last_inspection === null).length,
    }

    return (
        <div className="space-y-6">
            {/* En-tête */}
            <PageHeader
                title="Mes Véhicules"
                subtitle={`${stats.total} véhicule(s) dans votre unité · Lecture seule`}
            />

            {/* Barre de recherche */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Rechercher par immatriculation, marque ou modèle..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                />
            </div>

            {/* Filtres par statut */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${filterStatus === 'all'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    Tous ({stats.total})
                </button>
                <button
                    onClick={() => setFilterStatus('active')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all flex items-center gap-1 ${filterStatus === 'active'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    <CheckCircle className="w-3.5 h-3.5" /> Disponibles ({stats.active})
                </button>
                <button
                    onClick={() => setFilterStatus('in_mission')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all flex items-center gap-1 ${filterStatus === 'in_mission'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    <Clock className="w-3.5 h-3.5" /> En mission ({stats.in_mission})
                </button>
                <button
                    onClick={() => setFilterStatus('maintenance')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all flex items-center gap-1 ${filterStatus === 'maintenance'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    <Wrench className="w-3.5 h-3.5" /> Maintenance ({stats.maintenance})
                </button>
                <button
                    onClick={() => setFilterStatus('blocked')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all flex items-center gap-1 ${filterStatus === 'blocked'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    <XCircle className="w-3.5 h-3.5" /> Bloqués ({stats.blocked})
                </button>
            </div>

            {/* Filtres par inspection */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setFilterInspection('all')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${filterInspection === 'all'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    Inspectés récemment
                </button>
                <button
                    onClick={() => setFilterInspection('attention')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all flex items-center gap-1 ${filterInspection === 'attention'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    <AlertCircle className="w-3.5 h-3.5" /> À surveiller ({stats.needs_attention})
                </button>
                <button
                    onClick={() => setFilterInspection('never')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all flex items-center gap-1 ${filterInspection === 'never'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                >
                    <AlertTriangle className="w-3.5 h-3.5" /> Jamais inspectés ({stats.never_inspected})
                </button>
            </div>

            {/* Liste des véhicules */}
            {filteredVehicles.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <EmptyState title="Aucun véhicule" description="Aucun véhicule ne correspond à vos critères" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredVehicles.map(vehicle => {
                        const statusConfig = getStatusConfig(vehicle.status)
                        const StatusIcon = statusConfig.icon
                        const borderColor = getInspectionAgeColor(vehicle.days_since_last_inspection)
                        const needsAttention = vehicle.needs_attention || vehicle.days_since_last_inspection === null

                        return (
                            <div
                                key={vehicle.id}
                                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
                            >
                                {/* Bandeau supérieur avec statut */}
                                <div className={`px-5 py-3 border-b ${statusConfig.bg} ${statusConfig.border}`}>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                                            <span className={`text-sm font-semibold ${statusConfig.color}`}>{statusConfig.label}</span>
                                        </div>
                                        {needsAttention && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                                <AlertTriangle className="w-3 h-3" />
                                                Inspection requise
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Corps de la carte */}
                                <div className="p-5">
                                    {/* Identification */}
                                    <div className="mb-4">
                                        <p className="font-mono text-xl font-bold text-gray-900">{vehicle.plate_number}</p>
                                        <p className="text-sm text-gray-500">{vehicle.brand} {vehicle.model} · {vehicle.year}</p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                            <span className="flex items-center gap-1"><Gauge className="w-3 h-3" /> {vehicle.current_mileage?.toLocaleString()} km</span>
                                            <span className="flex items-center gap-1"><Car className="w-3 h-3" /> {vehicle.fuel_type}</span>
                                        </div>
                                    </div>

                                    {/* Dernière inspection */}
                                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dernière inspection</p>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-sm text-gray-700">
                                                    <User className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                                                    {vehicle.last_agent_name || '—'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Validée par: {vehicle.last_manager_name || '—'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-semibold ${vehicle.last_inspection_conclusion === 'fit' ? 'text-green-600' :
                                                        vehicle.last_inspection_conclusion === 'warning' ? 'text-amber-600' : 'text-red-600'
                                                    }`}>
                                                    {vehicle.last_inspection_conclusion === 'fit' ? 'Conforme' :
                                                        vehicle.last_inspection_conclusion === 'warning' ? 'Avec réserves' : 'Inapte'}
                                                </p>
                                                <p className="text-xs text-gray-400">{getInspectionAgeLabel(vehicle.days_since_last_inspection)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <button
                                            onClick={() => { setExpandedId(expandedId === vehicle.id ? null : vehicle.id) }}
                                            className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"
                                        >
                                            <Eye className="w-4 h-4" />
                                            {expandedId === vehicle.id ? 'Masquer les inspections' : 'Voir les inspections'} ({vehicle.total_inspections_count})
                                        </button>
                                        <button
                                            onClick={() => { setNotifyModal(vehicle); setNotifyMessage(''); setSelectedAgentId('') }}
                                            className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"
                                        >
                                            <Bell className="w-4 h-4" />
                                            Signaler à un agent
                                        </button>
                                    </div>
                                </div>

                                {/* Section expandable - Historique des inspections */}
                                {expandedId === vehicle.id && (
                                    <div className="border-t border-gray-100 bg-gray-50 p-5">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-purple-500" />
                                            Historique des inspections
                                        </h4>
                                        {vehicleInspections?.length === 0 ? (
                                            <p className="text-sm text-gray-400 text-center py-4">Aucune inspection enregistrée pour ce véhicule</p>
                                        ) : (
                                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                                {vehicleInspections?.map(insp => {
                                                    const conclusionConfig = getConclusionConfig(insp.agent_conclusion)
                                                    const ConclusionIcon = conclusionConfig.icon
                                                    return (
                                                        <div key={insp.id} className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-sm transition">
                                                            <div className="flex flex-wrap justify-between items-start gap-3">
                                                                <div className="flex-1">
                                                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${conclusionConfig.bg} ${conclusionConfig.color}`}>
                                                                            <ConclusionIcon className="w-3 h-3" />
                                                                            {conclusionConfig.label}
                                                                        </span>
                                                                        <span className="text-xs text-gray-400">{formatDate(insp.submitted_at)}</span>
                                                                    </div>
                                                                    <p className="text-sm text-gray-700">
                                                                        <User className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                                                                        Agent: {insp.agent_name || '—'}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500 mt-1">
                                                                        Manager: {insp.manager_name || '—'} · {insp.mileage_at_inspection?.toLocaleString()} km
                                                                    </p>
                                                                    {insp.observations && (
                                                                        <p className="text-xs text-gray-500 italic mt-2 line-clamp-2">"{insp.observations}"</p>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDownloadPDF(insp.id, vehicle.plate_number)}
                                                                    className="text-green-600 hover:text-green-700 p-1.5 hover:bg-green-50 rounded-lg transition"
                                                                    title="Télécharger le rapport"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Modal Signalement */}
            <Modal isOpen={notifyModal !== null} onClose={() => { setNotifyModal(null); setNotifyMessage(''); setSelectedAgentId('') }} title="Signaler un besoin d'inspection" size="md">
                {notifyModal && (
                    <div className="space-y-5">
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-amber-800">Rappel d'inspection</p>
                                    <p className="text-sm text-amber-700 mt-1">
                                        Vous allez envoyer un rappel à un agent de votre unité pour effectuer l'inspection du véhicule <strong>{notifyModal.plate_number}</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Sélectionner un agent *</label>
                            <select
                                value={selectedAgentId}
                                onChange={(e) => setSelectedAgentId(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                            >
                                <option value="">-- Choisir un agent --</option>
                                {departmentAgents?.map(agent => (
                                    <option key={agent.id} value={agent.id}>{agent.full_name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Message (optionnel)</label>
                            <textarea
                                rows={3}
                                value={notifyMessage}
                                onChange={(e) => setNotifyMessage(e.target.value)}
                                placeholder="Ex: Ce véhicule n'a pas été inspecté depuis longtemps. Merci d'effectuer le check-up dès que possible."
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition resize-none"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => { setNotifyModal(null); setNotifyMessage(''); setSelectedAgentId('') }}
                                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => {
                                    if (!selectedAgentId) { toast.error('Veuillez sélectionner un agent'); return }
                                    notifyMutation.mutate({ agent_id: selectedAgentId, vehicle_id: notifyModal.id, message: notifyMessage })
                                }}
                                disabled={notifyMutation.isPending}
                                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {notifyMutation.isPending ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Bell className="w-4 h-4" />
                                        Envoyer le signalement
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default SupervisorVehiclesPage