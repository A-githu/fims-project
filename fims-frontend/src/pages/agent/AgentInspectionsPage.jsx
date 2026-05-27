// src/pages/agent/AgentInspectionsPage.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getInspections } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { formatDateTime } from '../../utils/helpers'
import {
    Eye, Download, FileText, CheckCircle, XCircle, AlertTriangle,
    Calendar, Gauge, User, Car, Clock, Search, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'

const AgentInspectionsPage = () => {
    const [selectedInspection, setSelectedInspection] = useState(null)
    const [isViewModalOpen, setIsViewModalOpen] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const { user } = useAuthStore()

    const { data: inspections, isLoading, error } = useQuery({
        queryKey: ['inspections-agent'],
        queryFn: () => getInspections().then(res => res.data?.items || res.data || []),
        staleTime: 60000,
    })

    const handleDownloadPDF = async (inspectionId) => {
        setDownloading(true)
        try {
            toast.loading('Génération du PDF...', { id: 'pdf-loading' })
            const token = localStorage.getItem('fims_token')
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
            const response = await fetch(`${API_URL}/api/inspections/${inspectionId}/pdf`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (!response.ok) {
                throw new Error('Erreur lors du téléchargement')
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `ENEO_Checkup_${inspectionId}.pdf`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
            toast.success('PDF téléchargé avec succès', { id: 'pdf-loading' })
        } catch (error) {
            console.error('Erreur PDF:', error)
            toast.error('Erreur lors du téléchargement du PDF', { id: 'pdf-loading' })
        } finally {
            setDownloading(false)
        }
    }

    const getConclusionConfig = (conclusion) => {
        const map = {
            'fit': { label: 'Apte', icon: CheckCircle, bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
            'warning': { label: 'Avec réserves', icon: AlertTriangle, bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
            'unfit': { label: 'Inapte', icon: XCircle, bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' }
        }
        return map[conclusion] || { label: conclusion, icon: FileText, bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' }
    }

    const getDecisionConfig = (decision) => {
        const map = {
            'approved': { label: 'Approuvée', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle },
            'rejected': { label: 'Rejetée', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
            'pending': { label: 'En attente', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock }
        }
        return map[decision] || { label: decision, bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', icon: FileText }
    }

    if (isLoading) return (
        <div className="flex items-center justify-center h-96">
            <Spinner />
        </div>
    )

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center max-w-md mx-auto p-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Erreur de chargement</h3>
                    <p className="text-gray-500 mb-4">Impossible de charger vos inspections. Veuillez réessayer.</p>
                    <button onClick={() => window.location.reload()} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition">
                        Réessayer
                    </button>
                </div>
            </div>
        )
    }

    const inspectionList = Array.isArray(inspections) ? inspections : []

    // Filtrer les inspections
    const filteredInspections = inspectionList.filter(insp => {
        const matchesSearch = searchTerm === '' ||
            insp.vehicle?.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            insp.vehicle?.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            insp.vehicle?.model?.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesFilter = filterStatus === 'all' || insp.manager_decision === filterStatus

        return matchesSearch && matchesFilter
    })

    return (
        <div className="space-y-6">
            {/* En-tête */}
            <PageHeader
                title="Mes Inspections"
                subtitle="Historique complet de vos inspections véhicules"
            />

            {/* Barre de recherche et filtres */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher par immatriculation, marque ou modèle..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-all ${filterStatus === 'all'
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Toutes
                    </button>
                    <button
                        onClick={() => setFilterStatus('approved')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-all ${filterStatus === 'approved'
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        ✓ Approuvées
                    </button>
                    <button
                        onClick={() => setFilterStatus('rejected')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-all ${filterStatus === 'rejected'
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        ✗ Rejetées
                    </button>
                    <button
                        onClick={() => setFilterStatus('pending')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-all ${filterStatus === 'pending'
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        ⏳ En attente
                    </button>
                </div>
            </div>

            {/* Liste des inspections */}
            {filteredInspections.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-10 h-10 text-gray-300" />
                    </div>
                    <EmptyState
                        title="Aucune inspection"
                        description={searchTerm || filterStatus !== 'all' ? "Aucune inspection ne correspond à vos critères" : "Les inspections que vous réaliserez s'afficheront ici"}
                    />
                    {(searchTerm || filterStatus !== 'all') && (
                        <button
                            onClick={() => { setSearchTerm(''); setFilterStatus('all') }}
                            className="mt-4 text-sm text-green-600 hover:text-green-700"
                        >
                            Réinitialiser les filtres
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Résultat count */}
                    <p className="text-sm text-gray-500">
                        {filteredInspections.length} inspection{filteredInspections.length > 1 ? 's' : ''} trouvée{filteredInspections.length > 1 ? 's' : ''}
                    </p>

                    {/* Grille des cartes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredInspections.map((insp) => {
                            const inspectionId = insp?.id
                            const vehiclePlate = insp?.vehicle?.plate_number || 'N/A'
                            const vehicleBrand = insp?.vehicle?.brand || ''
                            const vehicleModel = insp?.vehicle?.model || ''
                            const agentConclusion = insp?.agent_conclusion || 'fit'
                            const managerDecision = insp?.manager_decision || 'pending'
                            const submittedAt = insp?.submitted_at || insp?.created_at
                            const mileage = insp?.mileage_at_inspection || 0
                            const conclusionConfig = getConclusionConfig(agentConclusion)
                            const decisionConfig = getDecisionConfig(managerDecision)
                            const ConclusionIcon = conclusionConfig.icon
                            const DecisionIcon = decisionConfig.icon

                            return (
                                <div
                                    key={inspectionId}
                                    className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-green-200 transition-all duration-300 overflow-hidden cursor-pointer"
                                    onClick={() => {
                                        setSelectedInspection(insp)
                                        setIsViewModalOpen(true)
                                    }}
                                >
                                    {/* En-tête avec immatriculation et décision */}
                                    <div className={`px-4 py-3 border-b ${decisionConfig.bg} ${decisionConfig.border}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                                    <Car className="w-4 h-4 text-gray-600" />
                                                </div>
                                                <div>
                                                    <p className="font-mono text-sm font-bold text-gray-900">{vehiclePlate}</p>
                                                    {(vehicleBrand || vehicleModel) && (
                                                        <p className="text-xs text-gray-500">{vehicleBrand} {vehicleModel}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${decisionConfig.bg} ${decisionConfig.text}`}>
                                                <DecisionIcon className="w-3 h-3" />
                                                {decisionConfig.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Corps de la carte */}
                                    <div className="p-4 space-y-3">
                                        {/* Date et kilométrage */}
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-500 flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {formatDateTime(submittedAt).split(' ')[0]}
                                            </span>
                                            <span className="text-gray-500 flex items-center gap-1.5">
                                                <Gauge className="w-3.5 h-3.5" />
                                                {mileage.toLocaleString()} km
                                            </span>
                                        </div>

                                        {/* Conclusion */}
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600">
                                            <ConclusionIcon className="w-3 h-3" />
                                            Conclusion: <span className={`font-semibold ${conclusionConfig.text}`}>{conclusionConfig.label}</span>
                                        </div>

                                        {/* Observations preview */}
                                        {insp?.observations && (
                                            <div className="mt-2 p-2 bg-gray-50 rounded-lg border-l-3 border-l-amber-400">
                                                <p className="text-xs text-gray-500 line-clamp-2 italic">
                                                    "{insp.observations.substring(0, 70)}{insp.observations.length > 70 ? '...' : ''}"
                                                </p>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setSelectedInspection(insp)
                                                    setIsViewModalOpen(true)
                                                }}
                                                className="flex-1 py-2 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg flex items-center justify-center gap-2 transition group-hover:bg-gray-100"
                                            >
                                                <Eye className="w-4 h-4" /> Détails
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDownloadPDF(inspectionId)
                                                }}
                                                disabled={downloading}
                                                className="flex-1 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                                            >
                                                <Download className="w-4 h-4" /> PDF
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}

            {/* Modal Détails Inspection */}
            <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Détails de l'inspection" size="xl">
                {selectedInspection && (
                    <div className="space-y-6 max-h-[80vh] overflow-y-auto px-1">
                        {/* En-tête avec statut */}
                        <div className={`p-5 rounded-xl ${getDecisionConfig(selectedInspection.manager_decision).bg} border ${getDecisionConfig(selectedInspection.manager_decision).border}`}>
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                                        <Car className="w-6 h-6 text-gray-700" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide">Véhicule</p>
                                        <p className="text-xl font-mono font-bold text-gray-900">
                                            {selectedInspection.vehicle?.plate_number || 'N/A'}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            {selectedInspection.vehicle?.brand} {selectedInspection.vehicle?.model}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Décision Manager</p>
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${getDecisionConfig(selectedInspection.manager_decision).bg} ${getDecisionConfig(selectedInspection.manager_decision).text}`}>
                                        {(() => {
                                            const Icon = getDecisionConfig(selectedInspection.manager_decision).icon
                                            return <Icon className="w-4 h-4" />
                                        })()}
                                        {getDecisionConfig(selectedInspection.manager_decision).label}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Informations générales */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                    <User className="w-3 h-3" /> Agent
                                </p>
                                <p className="text-sm font-medium text-gray-900 mt-1">
                                    {selectedInspection.agent?.full_name || 'N/A'}
                                </p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                    <Gauge className="w-3 h-3" /> Kilométrage
                                </p>
                                <p className="text-sm font-medium text-gray-900 mt-1">
                                    {selectedInspection.mileage_at_inspection?.toLocaleString()} km
                                </p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Date de soumission
                                </p>
                                <p className="text-sm font-medium text-gray-900 mt-1">
                                    {formatDateTime(selectedInspection.submitted_at)}
                                </p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Conclusion Agent</p>
                                <div className="mt-1">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getConclusionConfig(selectedInspection.agent_conclusion).bg} ${getConclusionConfig(selectedInspection.agent_conclusion).text}`}>
                                        {(() => {
                                            const Icon = getConclusionConfig(selectedInspection.agent_conclusion).icon
                                            return <Icon className="w-3 h-3" />
                                        })()}
                                        {getConclusionConfig(selectedInspection.agent_conclusion).label}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Points de contrôle */}
                        {selectedInspection.inspection_data && (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-4 bg-green-500 rounded-full"></div>
                                    Points de contrôle
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                                    {Object.entries(selectedInspection.inspection_data).map(([key, value]) => {
                                        const status = value?.status || 'conforme'
                                        const comment = value?.comment || ''
                                        const statusConfig = {
                                            'conforme': { icon: '✓', label: 'Conforme', class: 'bg-green-100 text-green-700' },
                                            'surveiller': { icon: '⚠', label: 'À surveiller', class: 'bg-amber-100 text-amber-700' },
                                            'non_conforme': { icon: '✗', label: 'Non conforme', class: 'bg-red-100 text-red-700' }
                                        }
                                        const cfg = statusConfig[status] || statusConfig.conforme
                                        const label = key.replace(/_/g, ' ')

                                        return (
                                            <div key={key} className="flex flex-col p-3 bg-white rounded-lg border border-gray-100 hover:shadow-sm transition">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-xs font-medium text-gray-700 capitalize">
                                                        {label}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.class}`}>
                                                        {cfg.icon} {cfg.label}
                                                    </span>
                                                </div>
                                                {comment && (
                                                    <p className="text-xs text-gray-500 italic mt-2 pt-1 border-t border-gray-100">
                                                        "{comment}"
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Observations */}
                        {selectedInspection.observations && (
                            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
                                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-2">
                                    <AlertTriangle className="w-3 h-3" />
                                    Observations de l'agent
                                </p>
                                <p className="text-sm text-gray-700 mt-2 italic">{selectedInspection.observations}</p>
                            </div>
                        )}

                        {/* Commentaire Manager */}
                        {selectedInspection.manager_comment && (
                            <div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded-r-lg">
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                                    <User className="w-3 h-3" />
                                    Commentaire du Manager
                                </p>
                                <p className="text-sm text-gray-700 mt-2 italic">{selectedInspection.manager_comment}</p>
                            </div>
                        )}

                        {/* Date de décision */}
                        {selectedInspection.decided_at && (
                            <div className="text-right text-xs text-gray-400 flex items-center justify-end gap-1">
                                <Clock className="w-3 h-3" />
                                Décision prise le {formatDateTime(selectedInspection.decided_at)}
                            </div>
                        )}

                        {/* Bouton PDF */}
                        <div className="flex justify-end pt-4 border-t border-gray-200">
                            <button
                                onClick={() => handleDownloadPDF(selectedInspection.id)}
                                disabled={downloading}
                                className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-2 transition disabled:opacity-50 font-medium"
                            >
                                {downloading ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                                Télécharger le rapport PDF
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default AgentInspectionsPage