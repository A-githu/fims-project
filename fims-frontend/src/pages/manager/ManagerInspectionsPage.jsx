// src/pages/manager/ManagerInspectionsPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getInspections, getPendingInspections, validateInspection, rejectInspection } from '../../services/api'
import api from '../../services/api'
import { Eye, Download, FileText, CheckCircle, XCircle, Wrench, RefreshCw, AlertTriangle } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { formatDateTime } from '../../utils/helpers'

const INSPECTION_SECTIONS = [
    {
        title: "À l'extérieur du véhicule / Outside the vehicle",
        headerBg: "bg-green-50 border-green-200 text-green-800",
        items: [
            { key: "pneumatiques", label: "Pneumatiques", labelEn: "Tyre condition" },
            { key: "eclairages", label: "Éclairages (phares, feux)", labelEn: "Headlights" },
            { key: "retroviseurs", label: "Rétroviseurs", labelEn: "Mirrors" },
            { key: "carrosserie", label: "Carrosserie", labelEn: "Chassis" },
        ]
    },
    {
        title: "À l'intérieur du véhicule / Inside the vehicle",
        headerBg: "bg-blue-50 border-blue-200 text-blue-800",
        items: [
            { key: "ceintures", label: "Ceintures de sécurité", labelEn: "Seatbelt" },
            { key: "commande_retroviseurs", label: "Commande des rétroviseurs", labelEn: "Mirror control" },
            { key: "commande_essuie_glaces", label: "Commande essuie-glaces", labelEn: "Wiper control" },
            { key: "volant", label: "Volant", labelEn: "Steering wheel" },
            { key: "eclairage_interne", label: "Éclairage interne", labelEn: "Internal lighting" },
            { key: "klaxon", label: "Klaxon", labelEn: "Horn" },
            { key: "tableau_bord", label: "Tableau de bord", labelEn: "Dashboard" },
            { key: "fonctionnement_freins", label: "Fonctionnement des freins", labelEn: "Brakes" },
            { key: "demarrage", label: "Démarrage", labelEn: "Startup" },
            { key: "confort", label: "Confort", labelEn: "Comfort" },
        ]
    },
    {
        title: "Sous le capot / Under the hood",
        headerBg: "bg-orange-50 border-orange-200 text-orange-800",
        items: [
            { key: "niveau_huile", label: "Niveau d'huile", labelEn: "Oil level" },
            { key: "batterie", label: "Batterie", labelEn: "Battery" },
            { key: "etat_moteur", label: "État du moteur", labelEn: "Engine condition" },
            { key: "liquide_refroidissement", label: "Liquide de refroidissement", labelEn: "Coolant" },
        ]
    },
    {
        title: "Kit Conducteur / Driver kit",
        headerBg: "bg-purple-50 border-purple-200 text-purple-800",
        items: [
            { key: "triangle_presignalisation", label: "Triangle de présignalisation", labelEn: "Warning triangle" },
            { key: "gilet_reflechissant", label: "Gilet réfléchissant", labelEn: "Reflective vest" },
            { key: "EXTINCTEUR", label: "Extincteur", labelEn: "Fire extinguisher" },
            { key: "cric_cle_roue", label: "Cric et clé de roue", labelEn: "Jack" },
            { key: "roue_secours", label: "Roue de secours", labelEn: "Spare tyre" },
        ]
    }
]

const ManagerInspectionsPage = () => {
    const navigate = useNavigate()
    const [selectedInspection, setSelectedInspection] = useState(null)
    const [isViewModalOpen, setIsViewModalOpen] = useState(false)
    const [validateComment, setValidateComment] = useState('')
    const [rejectComment, setRejectComment] = useState('')
    const [activeTab, setActiveTab] = useState('pending')
    const [showReprogramModal, setShowReprogramModal] = useState(false)
    const [selectedMissionForReprogram, setSelectedMissionForReprogram] = useState(null)
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
    const queryClient = useQueryClient()

    const { data: pendingInspections, isLoading: pendingLoading } = useQuery({
        queryKey: ['inspections-pending-manager'],
        queryFn: () => getPendingInspections().then(res => res.data?.items || res.data || []),
    })

    const { data: allInspections, isLoading: allLoading } = useQuery({
        queryKey: ['inspections-all-manager'],
        queryFn: () => getInspections().then(res => res.data?.items || res.data || []),
    })

    const validateMutation = useMutation({
        mutationFn: ({ id, comment }) => validateInspection(id, { comment: comment || '' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspections-pending-manager'] })
            queryClient.invalidateQueries({ queryKey: ['inspections-all-manager'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
            queryClient.invalidateQueries({ queryKey: ['missions-pending-manager'] })
            toast.success('Inspection validée — mission approuvée ✓')
            setIsViewModalOpen(false)
            setSelectedInspection(null)
            setValidateComment('')
        },
        onError: (error) => {
            const message = error.response?.data?.detail || 'Erreur lors de la validation'
            toast.error(message)
        },
    })

    const rejectMutation = useMutation({
        mutationFn: ({ id, comment }) => rejectInspection(id, { comment }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inspections-pending-manager'] })
            queryClient.invalidateQueries({ queryKey: ['inspections-all-manager'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
            queryClient.invalidateQueries({ queryKey: ['missions-pending-manager'] })
            queryClient.invalidateQueries({ queryKey: ['vehicles-available'] })
            toast.success('Inspection rejetée — nouveau véhicule requis')
            setIsViewModalOpen(false)
            setIsRejectModalOpen(false)
            setSelectedInspection(null)
            setRejectComment('')
        },
        onError: (error) => {
            const message = error.response?.data?.detail || 'Erreur lors du rejet'
            toast.error(message)
        },
    })

    // Mutation pour reprogrammer l'inspection après maintenance
    const reassignMutation = useMutation({
        mutationFn: (missionId) =>
            api.put(`/api/missions/${missionId}/reschedule`, { note: '' }).then(r => r.data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['inspections-pending-manager'] })
            queryClient.invalidateQueries({ queryKey: ['inspections-all-manager'] })
            queryClient.invalidateQueries({ queryKey: ['missions-pending-manager'] })
            queryClient.invalidateQueries({ queryKey: ['missions-all-manager'] })
            queryClient.invalidateQueries({ queryKey: ['vehicles-available'] })
            toast.success(`Mission reprogrammée pour ${data.agent_name || 'l\'agent'} avec le véhicule ${data.vehicle_plate}`)
            setShowReprogramModal(false)
            setSelectedMissionForReprogram(null)
        },
        onError: (error) => {
            toast.error(error.response?.data?.detail || 'Erreur lors de la reprogrammation')
        }
    })

    const handleDownloadPDF = async (inspectionId) => {
        try {
            toast.loading('Génération du PDF...', { id: 'pdf-loading' })
            const token = localStorage.getItem('fims_token')
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
            const response = await fetch(`${API_URL}/api/inspections/${inspectionId}/pdf`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!response.ok) throw new Error()
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `ENEO_Checkup_${inspectionId}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
            toast.success('Fiche PDF téléchargée ✓', { id: 'pdf-loading' })
        } catch (error) {
            toast.error('Erreur lors du téléchargement', { id: 'pdf-loading' })
        }
    }

    // Fonction pour ouvrir la page maintenance avec préremplissage
    const handleOpenMaintenanceFromInspection = (inspection) => {
        navigate(`/manager/maintenance?from_inspection=${inspection.id}&vehicle_id=${inspection.vehicle_id}`)
    }

    // Fonction pour ouvrir la modale de reprogrammation
    const handleReprogram = (mission) => {
        setSelectedMissionForReprogram(mission)
        setShowReprogramModal(true)
    }

    // Fonction pour ouvrir la modale de rejet avec motif panne
    const handleRejectWithBreakdown = (inspection) => {
        const defaultComment = `Véhicule en panne - Maintenance requise. ${inspection.agent_conclusion === 'unfit' ? 'Véhicule déclaré inapte lors de l\'inspection.' : ''}`
        setRejectComment(defaultComment)
        setSelectedInspection(inspection)
        setIsRejectModalOpen(true)
    }

    const getConclusionBadge = (conclusion) => {
        const map = {
            'fit': { label: 'Apte', color: 'bg-green-100 text-green-700' },
            'warning': { label: 'Avec réserves', color: 'bg-amber-100 text-amber-700' },
            'unfit': { label: 'Inapte', color: 'bg-red-100 text-red-700' }
        }
        const m = map[conclusion] || { label: conclusion, color: 'bg-gray-100 text-gray-700' }
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.color}`}>{m.label}</span>
    }

    const getStatusRowClass = (status) => {
        if (status === 'non_conforme') return 'bg-red-50'
        if (status === 'surveiller') return 'bg-amber-50'
        return ''
    }

    const isLoading = pendingLoading || allLoading
    if (isLoading) return <Spinner />

    const pendingList = Array.isArray(pendingInspections) ? pendingInspections : []
    const allList = Array.isArray(allInspections) ? allInspections : []

    return (
        <div className="space-y-6">
            <PageHeader title="Rapports d'Inspection" subtitle="Examen et validation des inspections" />

            <div className="flex gap-2 border-b border-gray-200 overflow-x-auto pb-2 scrollbar-thin">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'pending' ? 'bg-green-500 text-white rounded-lg' : 'bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50'}`}
                >
                    En attente ({pendingList.length})
                </button>
                <button
                    onClick={() => setActiveTab('approved')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'approved' ? 'bg-green-500 text-white rounded-lg' : 'bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50'}`}
                >
                    Approuvées
                </button>
                <button
                    onClick={() => setActiveTab('rejected')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'rejected' ? 'bg-green-500 text-white rounded-lg' : 'bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50'}`}
                >
                    Rejetées
                </button>
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-green-500 text-white rounded-lg' : 'bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50'}`}
                >
                    Toutes
                </button>
            </div>

            {/* Vue pending - cartes */}
            {activeTab === 'pending' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pendingList.length === 0 ? (
                        <div className="col-span-full bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                            <EmptyState title="Aucune inspection en attente" description="Toutes les inspections ont été traitées" />
                        </div>
                    ) : (
                        pendingList.map((inspection) => (
                            <div
                                key={inspection.id}
                                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-green-300 transition-all cursor-pointer"
                                onClick={() => {
                                    setSelectedInspection(inspection)
                                    setIsViewModalOpen(true)
                                    setValidateComment('')
                                    setRejectComment('')
                                }}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    {getConclusionBadge(inspection.agent_conclusion)}
                                    <span className="text-xs text-gray-400">{formatDateTime(inspection.submitted_at)}</span>
                                </div>
                                <p className="font-mono text-sm font-semibold mb-1">{inspection.vehicle?.plate_number || 'N/A'}</p>
                                <p className="text-sm text-gray-500 mb-2">Agent: {inspection.agent?.full_name}</p>
                                <p className="text-xs text-gray-400">Km relevés: {inspection.mileage_at_inspection} km</p>
                                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end gap-2">
                                    {(inspection.agent_conclusion === 'warning' || inspection.agent_conclusion === 'unfit') && (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleOpenMaintenanceFromInspection(inspection)
                                                }}
                                                className="bg-amber-500 hover:bg-amber-600 text-white text-xs py-1 px-2 rounded-lg flex items-center gap-1"
                                            >
                                                <Wrench className="w-3 h-3" /> Maintenance
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleRejectWithBreakdown(inspection)
                                                }}
                                                className="bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-2 rounded-lg flex items-center gap-1"
                                            >
                                                <XCircle className="w-3 h-3" /> Rejeter (Panne)
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDownloadPDF(inspection.id)
                                        }}
                                        className="bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-2 rounded-lg flex items-center gap-1"
                                    >
                                        <Download className="w-3 h-3" /> PDF
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Vue historique - tableau */}
            {(activeTab === 'approved' || activeTab === 'rejected' || activeTab === 'all') && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Agent</th>
                                    <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Véhicule</th>
                                    <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Km</th>
                                    <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Conclusion</th>
                                    <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Décision</th>
                                    <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Soumis le</th>
                                    <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allList.filter(i => {
                                    if (activeTab === 'approved') return i.manager_decision === 'approved'
                                    if (activeTab === 'rejected') return i.manager_decision === 'rejected'
                                    return true
                                }).map((inspection) => (
                                    <tr key={inspection.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                        <td className="px-5 py-3 text-sm">{inspection.agent?.full_name || 'N/A'}</td>
                                        <td className="px-5 py-3 font-mono text-sm">{inspection.vehicle?.plate_number || 'N/A'}</td>
                                        <td className="px-5 py-3 text-sm text-gray-600">{inspection.mileage_at_inspection} km</td>
                                        <td className="px-5 py-3">{getConclusionBadge(inspection.agent_conclusion)}</td>
                                        <td className="px-5 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${inspection.manager_decision === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {inspection.manager_decision === 'approved' ? 'Approuvée' : 'Rejetée'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-sm text-gray-500">{formatDateTime(inspection.submitted_at)}</td>
                                        <td className="px-5 py-3">
                                            <div className="flex gap-2 flex-wrap">
                                                {(inspection.agent_conclusion === 'warning' || inspection.agent_conclusion === 'unfit') && (
                                                    <button
                                                        onClick={() => handleOpenMaintenanceFromInspection(inspection)}
                                                        className="bg-amber-500 hover:bg-amber-600 text-white p-1.5 rounded-lg"
                                                        title="Mettre en maintenance"
                                                    >
                                                        <Wrench className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setSelectedInspection(inspection)
                                                        setIsViewModalOpen(true)
                                                    }}
                                                    className="bg-gray-100 hover:bg-gray-200 p-1.5 rounded-lg"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadPDF(inspection.id)}
                                                    className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded-lg"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {allList.filter(i => {
                                    if (activeTab === 'approved') return i.manager_decision === 'approved'
                                    if (activeTab === 'rejected') return i.manager_decision === 'rejected'
                                    return true
                                }).length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="px-5 py-8 text-center text-gray-400">Aucune inspection trouvée</td>
                                        </tr>
                                    )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Détails Inspection */}
            <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Rapport d'Inspection Complet" size="xl">
                {selectedInspection && (
                    <div className="space-y-5 max-h-[80vh] overflow-y-auto px-1">
                        {/* Bloc résumé */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                            <div><p className="text-xs text-gray-500 uppercase">Agent</p><p className="font-medium text-gray-900">{selectedInspection.agent?.full_name}</p></div>
                            <div><p className="text-xs text-gray-500 uppercase">Véhicule</p><p className="font-mono font-semibold text-gray-900">{selectedInspection.vehicle?.plate_number}</p></div>
                            <div><p className="text-xs text-gray-500 uppercase">Kilométrage</p><p className="text-gray-900">{selectedInspection.mileage_at_inspection} km</p></div>
                            <div><p className="text-xs text-gray-500 uppercase">Mission</p><p className="text-sm">{selectedInspection.mission?.destination || '—'}</p></div>
                            <div><p className="text-xs text-gray-500 uppercase">Date soumission</p><p className="text-sm">{formatDateTime(selectedInspection.submitted_at)}</p></div>
                            <div><p className="text-xs text-gray-500 uppercase">Conclusion Agent</p>{getConclusionBadge(selectedInspection.agent_conclusion)}</div>
                        </div>

                        {/* Grille d'inspection - 23 points en lecture seule */}
                        {INSPECTION_SECTIONS.map((section, idx) => (
                            <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className={`${section.headerBg} px-4 py-2 font-semibold text-sm`}>{section.title}</div>
                                <div className="divide-y divide-gray-100">
                                    {section.items.map(item => {
                                        const data = selectedInspection.inspection_data?.[item.key]
                                        const status = data?.status || 'conforme'
                                        const comment = data?.comment || ''
                                        const rowClass = getStatusRowClass(status)
                                        const badgeClass = status === 'conforme' ? 'bg-green-100 text-green-700 border-green-200' :
                                            status === 'surveiller' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                'bg-red-100 text-red-700 border-red-200'
                                        const icon = status === 'conforme' ? '✓' : status === 'surveiller' ? '⚠' : '✗'
                                        const statusLabel = status === 'conforme' ? 'Conforme' : status === 'surveiller' ? 'À surveiller' : 'Non conforme'
                                        return (
                                            <div key={item.key} className={`flex flex-col md:flex-row md:items-center justify-between p-3 ${rowClass}`}>
                                                <div className="flex-1"><p className="text-sm font-medium text-gray-800">{item.label}</p></div>
                                                <div className="flex items-center gap-3 mt-2 md:mt-0">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badgeClass}`}>
                                                        {icon} {statusLabel}
                                                    </span>
                                                    {comment && <span className="text-xs text-gray-500 italic">"{comment}"</span>}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* Observations */}
                        {selectedInspection.observations && (
                            <div className="bg-gray-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observations de l'agent</p>
                                <p className="text-sm text-gray-700 italic">{selectedInspection.observations}</p>
                            </div>
                        )}

                        {/* Bloc Décision Manager */}
                        {selectedInspection.manager_decision === 'pending' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex flex-col gap-3">
                                    <h4 className="font-bold text-green-800 flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5" /> Valider la mission
                                    </h4>
                                    <p className="text-sm text-green-700">
                                        Le véhicule est autorisé à circuler. La mission sera marquée "Approuvée".
                                        L'agent pourra déclarer la fin de mission.
                                    </p>
                                    <textarea
                                        placeholder="Commentaire du Manager (optionnel)..."
                                        value={validateComment}
                                        onChange={(e) => setValidateComment(e.target.value)}
                                        className="w-full border border-green-200 rounded-xl px-3 py-2 text-sm bg-white resize-none focus:ring-2 focus:ring-green-400"
                                        rows={3}
                                    />
                                    <button
                                        onClick={() => validateMutation.mutate({ id: selectedInspection.id, comment: validateComment })}
                                        disabled={validateMutation.isPending}
                                        className="w-full py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 disabled:opacity-50"
                                    >
                                        {validateMutation.isPending ? 'Validation...' : '✓ Confirmer la validation'}
                                    </button>
                                </div>

                                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex flex-col gap-3">
                                    <h4 className="font-bold text-red-800 flex items-center gap-2">
                                        <XCircle className="w-5 h-5" /> Rejeter — Nouveau véhicule
                                    </h4>
                                    <p className="text-sm text-red-700">
                                        Un nouveau véhicule sera attribué.
                                        {selectedInspection.agent_conclusion === 'unfit' && ' Ce véhicule sera bloqué (inapte).'}
                                    </p>
                                    <textarea
                                        placeholder="Motif du refus obligatoire (min 5 caractères)..."
                                        value={rejectComment}
                                        onChange={(e) => setRejectComment(e.target.value)}
                                        className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm bg-white resize-none focus:ring-2 focus:ring-red-400"
                                        rows={3}
                                    />
                                    <p className="text-xs text-red-400">{rejectComment.length}/5 min</p>
                                    <button
                                        onClick={() => rejectMutation.mutate({ id: selectedInspection.id, comment: rejectComment })}
                                        disabled={rejectComment.trim().length < 5 || rejectMutation.isPending}
                                        className="w-full py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50"
                                    >
                                        {rejectMutation.isPending ? 'Rejet...' : '✗ Confirmer le rejet'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className={`p-5 rounded-2xl border-2 ${selectedInspection.manager_decision === 'approved' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                                <p className={`font-bold text-lg ${selectedInspection.manager_decision === 'approved' ? 'text-green-800' : 'text-red-800'}`}>
                                    {selectedInspection.manager_decision === 'approved' ? '✓ Inspection validée' : '✗ Inspection rejetée'}
                                </p>
                                {selectedInspection.manager_comment && (
                                    <p className="text-sm text-gray-700 mt-2 italic">"{selectedInspection.manager_comment}"</p>
                                )}
                                <p className="text-xs text-gray-500 mt-2">{formatDateTime(selectedInspection.decided_at)}</p>
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <button onClick={() => handleDownloadPDF(selectedInspection.id)} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
                                <FileText size={16} /> Télécharger la Fiche ENEO (PDF)
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODALE DE REJET POUR PANNE */}
            <Modal isOpen={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Rejeter l'inspection - Véhicule en panne" size="md">
                {selectedInspection && (
                    <div className="space-y-4">
                        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-red-800">Cette inspection va être rejetée</p>
                                    <p className="text-sm text-red-700 mt-1">
                                        Véhicule: <strong>{selectedInspection.vehicle?.plate_number}</strong>
                                    </p>
                                    <p className="text-xs text-red-600 mt-1">
                                        Motif: <strong>Véhicule en panne - Maintenance requise</strong>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Motif du rejet * <span className="text-gray-400 text-xs">(minimum 5 caractères)</span>
                            </label>
                            <textarea
                                rows={3}
                                value={rejectComment}
                                onChange={(e) => setRejectComment(e.target.value)}
                                placeholder="Décrivez la panne..."
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 resize-none"
                            />
                            <p className="text-xs text-red-500 mt-1">{rejectComment.length} / 5 caractères minimum</p>
                        </div>

                        <div className="bg-amber-50 p-3 rounded-lg">
                            <p className="text-xs text-amber-700">
                                ⚠️ Après rejet, vous pourrez créer une fiche de maintenance depuis la liste "Rejetées" ou depuis la page Maintenance.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsRejectModalOpen(false)}
                                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => {
                                    if (rejectComment.trim().length < 5) {
                                        toast.error('Le motif doit contenir au moins 5 caractères')
                                        return
                                    }
                                    rejectMutation.mutate({
                                        id: selectedInspection.id,
                                        comment: rejectComment
                                    })
                                }}
                                disabled={rejectMutation.isPending}
                                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {rejectMutation.isPending ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    '✓ Confirmer le rejet'
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODALE REPROGRAMMATION - Après maintenance terminée */}
            <Modal isOpen={showReprogramModal} onClose={() => setShowReprogramModal(false)} title="Reprogrammer l'inspection" size="md">
                {selectedMissionForReprogram && (
                    <div className="space-y-4">
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <p className="text-sm text-green-800">
                                La maintenance du véhicule <strong>{selectedMissionForReprogram.vehicle?.plate_number}</strong> est terminée.
                            </p>
                            <p className="text-sm text-green-800 mt-2">
                                Voulez-vous reprogrammer une inspection pour l'agent <strong>{selectedMissionForReprogram.agent?.full_name}</strong> ?
                            </p>
                            <p className="text-xs text-green-600 mt-2">
                                Destination: {selectedMissionForReprogram.destination}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowReprogramModal(false)}
                                className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Non, plus tard
                            </button>
                            <button
                                onClick={() => reassignMutation.mutate(selectedMissionForReprogram.id)}
                                disabled={reassignMutation.isPending}
                                className="flex-1 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                {reassignMutation.isPending ? 'Reprogrammation...' : 'Oui, reprogrammer l\'inspection'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default ManagerInspectionsPage