// src/pages/manager/ManagerMissionsPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getMissions, getPendingMissions, assignMissionVehicle, rejectMission, getAvailableVehicles } from '../../services/api'
import { Eye, Car, AlertTriangle, X } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { formatDate } from '../../utils/helpers'

const MISSION_STATUS_LABELS = {
    EN_ATTENTE_ATTRIBUTION: "En attente d'attribution",
    DEMANDE_CREEE: "Nouvelle demande",
    VEHICULE_ATTRIBUE: "Véhicule attribué",
    INSPECTION_SOUMISE: "Inspection soumise",
    APPROUVEE: "Approuvée",
    NOUVEAU_VEHICULE_REQUIS: "Nouveau véhicule requis",
    TERMINEE: "Terminée",
    REJETEE: "Rejetée"
}

const getStatusBadgeClass = (status) => {
    const map = {
        'EN_ATTENTE_ATTRIBUTION': 'badge-blue',
        'DEMANDE_CREEE': 'badge-blue',
        'VEHICULE_ATTRIBUE': 'badge-amber',
        'INSPECTION_SOUMISE': 'badge-amber',
        'APPROUVEE': 'badge-green',
        'TERMINEE': 'badge-green',
        'REJETEE': 'badge-red',
        'NOUVEAU_VEHICULE_REQUIS': 'badge-amber'
    }
    return map[status] || 'badge-gray'
}

const ManagerMissionsPage = () => {
    const [selectedMission, setSelectedMission] = useState(null)
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
    const [isViewModalOpen, setIsViewModalOpen] = useState(false)
    const [activeTab, setActiveTab] = useState('pending')
    const [selectedVehicleId, setSelectedVehicleId] = useState(null)
    const [step, setStep] = useState('summary')
    const queryClient = useQueryClient()

    const { data: pendingMissions, isLoading: pendingLoading } = useQuery({
        queryKey: ['missions-pending-manager'],
        queryFn: () => getPendingMissions().then(res => res.data?.items || res.data || []),
    })

    const { data: allMissions, isLoading: allLoading } = useQuery({
        queryKey: ['missions-all-manager'],
        queryFn: () => getMissions().then(res => res.data?.items || res.data || []),
    })

    const { data: availableVehicles, refetch: refetchVehicles } = useQuery({
        queryKey: ['vehicles-available'],
        queryFn: () => getAvailableVehicles().then(res => res.data || []),
        enabled: isAssignModalOpen,
    })

    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm()
    const rejectComment = watch('comment')

    const assignMutation = useMutation({
        mutationFn: ({ id, data }) => assignMissionVehicle(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['missions-pending-manager'] })
            queryClient.invalidateQueries({ queryKey: ['missions-all-manager'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
            queryClient.invalidateQueries({ queryKey: ['vehicles-available'] })
            toast.success('Véhicule attribué — agent notifié ✓')
            setIsAssignModalOpen(false)
            setSelectedMission(null)
            setSelectedVehicleId(null)
            setStep('summary')
            reset()
        },
        onError: (error) => {
            const message = error.response?.data?.detail || 'Erreur lors de l\'attribution'
            toast.error(message)
        },
    })

    const rejectMutation = useMutation({
        mutationFn: ({ id, data }) => rejectMission(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['missions-pending-manager'] })
            queryClient.invalidateQueries({ queryKey: ['missions-all-manager'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
            toast.success('Demande rejetée')
            setIsRejectModalOpen(false)
            setSelectedMission(null)
            reset()
        },
        onError: (error) => {
            const message = error.response?.data?.detail || 'Erreur lors du rejet'
            toast.error(message)
        },
    })

    const onAssignSubmit = () => {
        if (!selectedVehicleId) {
            toast.error('Veuillez sélectionner un véhicule')
            return
        }
        assignMutation.mutate({ id: selectedMission.id, data: { vehicle_id: selectedVehicleId } })
    }

    const onRejectSubmit = (data) => {
        rejectMutation.mutate({ id: selectedMission.id, data: { comment: data.comment } })
    }

    const handleAssignClick = (mission) => {
        setSelectedMission(mission)
        setStep('summary')
        refetchVehicles()
        setIsAssignModalOpen(true)
    }

    const getVehicleLabel = (vehicleId) => {
        const vehicle = availableVehicles?.find(v => v.id === vehicleId)
        return vehicle ? vehicle.plate_number : ''
    }

    const isLoading = pendingLoading || allLoading
    if (isLoading) return <Spinner />

    const pendingList = Array.isArray(pendingMissions) ? pendingMissions : []
    const allList = Array.isArray(allMissions) ? allMissions : []

    return (
        <div className="space-y-6">
            <PageHeader title="Demandes & Missions" subtitle="Gestion des demandes de mission et attributions" />

            <div className="flex gap-2 border-b border-gray-200 overflow-x-auto pb-2 scrollbar-thin">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'pending' ? 'bg-green-500 text-white rounded-lg' : 'bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50'}`}
                >
                    En attente ({pendingList.length})
                </button>
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-green-500 text-white rounded-lg' : 'bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50'}`}
                >
                    Toutes les missions
                </button>
                <button
                    onClick={() => setActiveTab('inprogress')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'inprogress' ? 'bg-green-500 text-white rounded-lg' : 'bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50'}`}
                >
                    En cours
                </button>
                <button
                    onClick={() => setActiveTab('completed')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'completed' ? 'bg-green-500 text-white rounded-lg' : 'bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50'}`}
                >
                    Terminées
                </button>
                <button
                    onClick={() => setActiveTab('rejected')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'rejected' ? 'bg-green-500 text-white rounded-lg' : 'bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50'}`}
                >
                    Rejetées
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Agent</th>
                                <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Destination</th>
                                <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Date</th>
                                <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Service</th>
                                <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Tentatives</th>
                                <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Statut</th>
                                <th className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                let displayList = []
                                if (activeTab === 'pending') displayList = pendingList
                                else if (activeTab === 'all') displayList = allList
                                else if (activeTab === 'inprogress') displayList = allList.filter(m => ['VEHICULE_ATTRIBUE', 'INSPECTION_SOUMISE', 'APPROUVEE'].includes(m.status))
                                else if (activeTab === 'completed') displayList = allList.filter(m => m.status === 'TERMINEE')
                                else if (activeTab === 'rejected') displayList = allList.filter(m => m.status === 'REJETEE')
                                else displayList = allList

                                if (displayList.length === 0) {
                                    return (
                                        <tr><td colSpan="7" className="px-5 py-8 text-center text-gray-400">
                                            <EmptyState title="Aucune mission" description="Aucune mission trouvée pour ce filtre" />
                                        </td></tr>
                                    )
                                }

                                return displayList.map((mission) => (
                                    <tr key={mission.id} className={`border-b border-gray-100 hover:bg-gray-50 transition ${mission.vehicle_attempt_count >= 3 ? 'bg-red-50' : ''}`}>
                                        <td className="px-5 py-3 text-sm text-gray-700">{mission.agent?.full_name || 'N/A'}</td>
                                        <td className="px-5 py-3 text-sm text-gray-700">{mission.destination}</td>
                                        <td className="px-5 py-3 text-sm text-gray-600 font-mono">{formatDate(mission.mission_date)}</td>
                                        <td className="px-5 py-3 text-sm text-gray-600">{mission.department || '—'}</td>
                                        <td className="px-5 py-3 text-sm font-mono">
                                            <span className={mission.vehicle_attempt_count >= 2 ? 'text-amber-600 font-bold' : 'text-gray-600'}>
                                                {mission.vehicle_attempt_count || 0}/3
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex flex-col gap-1">
                                                <span className={`${getStatusBadgeClass(mission.status)} rounded-full px-3 py-1 text-xs font-medium w-fit`}>
                                                    {MISSION_STATUS_LABELS[mission.status] || mission.status}
                                                </span>
                                                {mission.vehicle_attempt_count >= 3 && (
                                                    <span className="bg-red-600 text-white rounded-full px-2 py-0.5 text-[10px] font-bold animate-pulse flex items-center gap-1 w-fit">
                                                        <AlertTriangle className="w-3 h-3" /> Alerte critique
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex gap-2">
                                                {(mission.status === 'EN_ATTENTE_ATTRIBUTION' || mission.status === 'NOUVEAU_VEHICULE_REQUIS') && (
                                                    <>
                                                        <button
                                                            onClick={() => handleAssignClick(mission)}
                                                            className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded-lg transition-all hover:scale-110"
                                                            title="Attribuer un véhicule"
                                                        >
                                                            <Car className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedMission(mission)
                                                                setIsRejectModalOpen(true)
                                                            }}
                                                            className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg transition-all hover:scale-110"
                                                            title="Rejeter la demande"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                {mission.status === 'INSPECTION_SOUMISE' && (
                                                    <button
                                                        onClick={() => window.location.href = '/manager/inspections'}
                                                        className="bg-amber-500 hover:bg-amber-600 text-white p-1.5 rounded-lg"
                                                        title="Examiner l'inspection"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setSelectedMission(mission)
                                                        setIsViewModalOpen(true)
                                                    }}
                                                    className="bg-gray-100 hover:bg-gray-200 text-gray-600 p-1.5 rounded-lg"
                                                    title="Détails"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Attribution */}
            <Modal isOpen={isAssignModalOpen} onClose={() => {
                setIsAssignModalOpen(false)
                setSelectedMission(null)
                setSelectedVehicleId(null)
                setStep('summary')
            }} title="Traitement de la demande" size="lg">
                <div className="space-y-5">
                    {selectedMission && (
                        <>
                            {step === 'summary' && (
                                <div>
                                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                                        <h4 className="font-semibold text-gray-900 mb-3">DÉTAILS DE LA DEMANDE</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                            <p><span className="text-gray-500">Agent :</span> {selectedMission.agent?.full_name}</p>
                                            <p><span className="text-gray-500">Destination :</span> {selectedMission.destination}</p>
                                            <p><span className="text-gray-500">Date :</span> {formatDate(selectedMission.mission_date)}</p>
                                            <p><span className="text-gray-500">Durée :</span> {selectedMission.estimated_duration || '—'} heures</p>
                                            <p><span className="text-gray-500">Service :</span> {selectedMission.department || '—'}</p>
                                            <p className="col-span-1 sm:col-span-2"><span className="text-gray-500">Motif :</span> {selectedMission.purpose}</p>
                                            <p className="col-span-1 sm:col-span-2"><span className="text-gray-500">Tentatives :</span> {selectedMission.vehicle_attempt_count || 0}/3</p>
                                        </div>
                                    </div>

                                    {selectedMission.vehicle_attempt_count >= 3 && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                                            <div className="flex items-center gap-2 text-red-700">
                                                <AlertTriangle className="w-5 h-5" />
                                                <span className="font-semibold">⚠ ALERTE — 3 véhicules inaptes consécutifs !</span>
                                            </div>
                                            <p className="text-xs text-red-600 mt-1">Notification envoyée à la Direction.</p>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                        <button
                                            onClick={() => {
                                                setIsAssignModalOpen(false)
                                                setSelectedMission(null)
                                                setSelectedVehicleId(null)
                                                setStep('summary')
                                            }}
                                            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg px-4 py-2"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            onClick={() => setIsRejectModalOpen(true)}
                                            className="bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded-lg px-4 py-2"
                                        >
                                            Rejeter
                                        </button>
                                        <button
                                            onClick={() => setStep('assign')}
                                            className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-4 py-2"
                                        >
                                            Attribuer un véhicule →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 'assign' && (
                                <div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-3">Sélectionner un véhicule disponible</label>
                                        <div className="space-y-3 max-h-96 overflow-y-auto">
                                            {availableVehicles?.map((vehicle) => (
                                                <label
                                                    key={vehicle.id}
                                                    className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedVehicleId === vehicle.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="vehicle"
                                                        checked={selectedVehicleId === vehicle.id}
                                                        onChange={() => setSelectedVehicleId(vehicle.id)}
                                                        className="w-4 h-4 accent-green-500"
                                                    />
                                                    <div className="flex-1">
                                                        <p className="font-mono font-bold text-gray-900 text-lg">{vehicle.plate_number}</p>
                                                        <p className="text-sm text-gray-600">{vehicle.brand} {vehicle.model}</p>
                                                        <p className="text-xs text-gray-400">{vehicle.fuel_type} · {vehicle.current_mileage?.toLocaleString()} km</p>
                                                    </div>
                                                    <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium">✓ Disponible</span>
                                                </label>
                                            ))}
                                            {(!availableVehicles || availableVehicles.length === 0) && (
                                                <p className="text-center text-gray-500 py-6">Aucun véhicule disponible actuellement.</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                        <button
                                            onClick={() => setStep('summary')}
                                            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg px-4 py-2"
                                        >
                                            ← Retour
                                        </button>
                                        <button
                                            onClick={onAssignSubmit}
                                            disabled={!selectedVehicleId || assignMutation.isPending}
                                            className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
                                        >
                                            {assignMutation.isPending ? 'Attribution...' : `✓ Attribuer ${selectedVehicleId ? getVehicleLabel(selectedVehicleId) : ''}`}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Modal>

            {/* Modal Rejet */}
            <Modal isOpen={isRejectModalOpen} onClose={() => {
                setIsRejectModalOpen(false)
                setSelectedMission(null)
                reset()
            }} title="Rejeter la demande" size="md">
                <form onSubmit={handleSubmit(onRejectSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Motif du refus *</label>
                        <textarea
                            {...register('comment', { required: 'Le motif est requis', minLength: { value: 10, message: 'Minimum 10 caractères requis' } })}
                            rows={4}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 resize-none"
                            placeholder="Expliquez la raison du refus (obligatoire, min 10 caractères)..."
                        />
                        <p className="text-xs text-gray-400 mt-1">{rejectComment?.length || 0}/10 caractères minimum</p>
                        {errors.comment && <p className="text-red-500 text-xs mt-1">{errors.comment.message}</p>}
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button type="button" onClick={() => setIsRejectModalOpen(false)} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg px-4 py-2">Annuler</button>
                        <button type="submit" disabled={!rejectComment || rejectComment.length < 10 || rejectMutation.isPending} className="bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-50">
                            {rejectMutation.isPending ? 'Rejet...' : '✗ Confirmer le refus'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal Détails */}
            <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Détails de la mission" size="lg">
                {selectedMission && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Agent</p><p className="text-sm font-medium mt-1">{selectedMission.agent?.full_name || 'N/A'}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Destination</p><p className="text-sm mt-1">{selectedMission.destination}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Date mission</p><p className="text-sm mt-1">{formatDate(selectedMission.mission_date)}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Durée estimée</p><p className="text-sm mt-1">{selectedMission.estimated_duration || '—'} heures</p></div>
                            <div className="col-span-1 sm:col-span-2 bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Motif</p><p className="text-sm mt-1">{selectedMission.purpose}</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Tentatives véhicules</p><p className={`text-sm font-semibold mt-1 ${selectedMission.vehicle_attempt_count >= 2 ? 'text-amber-600' : 'text-gray-900'}`}>{selectedMission.vehicle_attempt_count || 0}/3</p></div>
                            <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500 uppercase">Statut</p><div className="mt-1"><span className={`${getStatusBadgeClass(selectedMission.status)} rounded-full px-3 py-1 text-xs font-medium`}>{MISSION_STATUS_LABELS[selectedMission.status] || selectedMission.status}</span></div></div>
                        </div>
                        {selectedMission.vehicle && (
                            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                <p className="text-xs text-green-700 uppercase">Véhicule attribué</p>
                                <p className="text-sm font-mono font-semibold mt-1">{selectedMission.vehicle.plate_number} - {selectedMission.vehicle.brand} {selectedMission.vehicle.model}</p>
                            </div>
                        )}
                        {selectedMission.manager_comment && (
                            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                                <p className="text-xs text-red-700 uppercase">Commentaire rejet</p>
                                <p className="text-sm mt-1 italic">{selectedMission.manager_comment}</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default ManagerMissionsPage