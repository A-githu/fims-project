import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getMissions, createMission, cancelMission, completeMission } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { Plus, Eye, XCircle, Calendar, MapPin, FileText, Clock, Building, Car, ArrowRight, Flag, CheckCircle } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { formatDateTime } from '../../utils/helpers'

const MISSION_STATUS_LABELS = {
    EN_ATTENTE_ATTRIBUTION: "En attente d'attribution",
    VEHICULE_ATTRIBUE: "Véhicule attribué",
    INSPECTION_SOUMISE: "Inspection soumise",
    APPROUVEE: "Approuvée",
    NOUVEAU_VEHICULE_REQUIS: "Nouveau véhicule requis",
    TERMINEE: "Terminée",
    REJETEE: "Rejetée"
}

const getStatusBadgeClass = (status) => {
    if (status === 'EN_ATTENTE_ATTRIBUTION') return 'badge-pending'
    if (status === 'VEHICULE_ATTRIBUE') return 'badge-maintenance'
    if (status === 'INSPECTION_SOUMISE') return 'badge-maintenance'
    if (status === 'APPROUVEE') return 'badge-active'
    if (status === 'TERMINEE') return 'badge-active'
    if (status === 'REJETEE') return 'badge-blocked'
    if (status === 'NOUVEAU_VEHICULE_REQUIS') return 'badge-maintenance'
    return 'badge-pending'
}

const AgentMissionsPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedMission, setSelectedMission] = useState(null)
    const [isViewModalOpen, setIsViewModalOpen] = useState(false)
    const [showCompleteModal, setShowCompleteModal] = useState(false)
    const [completeData, setCompleteData] = useState({ missionId: null, finalMileage: '', notes: '' })
    const { user } = useAuthStore()
    const queryClient = useQueryClient()

    const { data: missions, isLoading } = useQuery({
        queryKey: ['missions'],
        queryFn: () => getMissions().then(res => res.data?.items || res.data || []),
    })

    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        defaultValues: {
            mission_date: '',
            destination: '',
            start_location: '',
            end_location: '',
            purpose: '',
            estimated_duration: '',
            department: ''
        }
    })

    const createMutation = useMutation({
        mutationFn: (data) => createMission({
            mission_date: data.mission_date,
            destination: data.destination,
            start_location: data.start_location || null,
            end_location: data.end_location || null,
            purpose: data.purpose,
            estimated_duration: data.estimated_duration ? parseInt(data.estimated_duration) : null,
            department: data.department || null
        }),
        onSuccess: () => {
            queryClient.invalidateQueries(['missions'])
            toast.success('Demande de mission envoyée au Manager ✓')
            setIsModalOpen(false)
            reset()
        },
        onError: (error) => {
            const msg = error.response?.data?.detail || 'Erreur lors de la création'
            toast.error(msg)
        },
    })

    const cancelMutation = useMutation({
        mutationFn: ({ id, comment }) => cancelMission(id, { comment }),
        onSuccess: () => {
            queryClient.invalidateQueries(['missions'])
            toast.success('Mission annulée')
        },
        onError: (error) => toast.error(error.response?.data?.detail || 'Erreur'),
    })

    const completeMutation = useMutation({
        mutationFn: ({ missionId, finalMileage, notes }) =>
            completeMission(missionId, { final_mileage: finalMileage || null, notes: notes || null }),
        onSuccess: () => {
            queryClient.invalidateQueries(['missions'])
            queryClient.invalidateQueries(['available-vehicles'])
            toast.success('Mission terminée — Véhicule libéré ✓')
            setShowCompleteModal(false)
            setCompleteData({ missionId: null, finalMileage: '', notes: '' })
        },
        onError: (error) => {
            const msg = error.response?.data?.detail || 'Erreur lors de la finalisation'
            toast.error(msg)
        },
    })

    const onSubmit = (data) => {
        createMutation.mutate(data)
    }

    const handleCancel = (missionId) => {
        const comment = prompt('Motif de l\'annulation :')
        if (comment) {
            cancelMutation.mutate({ id: missionId, comment })
        }
    }

    const handleComplete = () => {
        if (!completeData.missionId) return
        completeMutation.mutate(completeData)
    }

    if (isLoading) return <Spinner />

    const missionList = Array.isArray(missions) ? missions : []

    return (
        <div className="space-y-6">
            <PageHeader
                title="Mes Missions"
                subtitle="Suivez l'état de vos demandes de mission"
                actions={
                    <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Nouvelle demande
                    </button>
                }
            />

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-gray-500">Départ → Destination</th>
                                <th className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-gray-500">Date</th>
                                <th className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-gray-500">Durée</th>
                                <th className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-gray-500">Statut</th>
                                <th className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-gray-500">Véhicule</th>
                                <th className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {missionList.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center">
                                        <EmptyState title="Aucune mission" description="Créez votre première demande de mission" />
                                    </td>
                                </tr>
                            ) : (
                                missionList.map((mission) => (
                                    <>
                                        <tr key={mission.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                            <td className="py-3 px-4 text-sm font-medium text-gray-900">
                                                {mission.start_location || '—'} → {mission.end_location || mission.destination || '—'}
                                                {mission.destination?.includes('Superviseur') && (
                                                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wide">
                                                        ⚠️ Requis par Superviseur
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 font-mono">{formatDateTime(mission.mission_date)}</td>
                                            <td className="py-3 px-4 text-sm text-gray-500">{mission.estimated_duration ? `${mission.estimated_duration}h` : '—'}</td>
                                            <td className="py-3 px-4">
                                                <span className={`badge ${getStatusBadgeClass(mission.status)}`}>
                                                    {MISSION_STATUS_LABELS[mission.status] || mission.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm font-mono text-gray-600">{mission.vehicle?.plate_number || '—'}</td>
                                            <td className="py-3 px-4">
                                                <div className="flex gap-2 flex-wrap">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedMission(mission)
                                                            setIsViewModalOpen(true)
                                                        }}
                                                        className="p-1.5 text-gray-500 hover:text-green-600 rounded-lg hover:bg-green-50"
                                                        title="Voir détails"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {mission.status === 'VEHICULE_ATTRIBUE' && (
                                                        <button
                                                            onClick={() => window.location.href = `/agent/inspections/new?mission=${mission.id}`}
                                                            className="btn-primary text-xs px-3 py-1"
                                                        >
                                                            Inspecter
                                                        </button>
                                                    )}

                                                    {(mission.status === 'EN_ATTENTE_ATTRIBUTION' || mission.status === 'DEMANDE_CREEE') && (
                                                        <button
                                                            onClick={() => handleCancel(mission.id)}
                                                            className="btn-secondary text-red-600 hover:bg-red-50 p-1.5"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    {mission.status === 'APPROUVEE' && (
                                                        <button
                                                            onClick={() => setCompleteData({
                                                                missionId: mission.id,
                                                                finalMileage: mission.vehicle?.current_mileage || '',
                                                                notes: ''
                                                            }) || setShowCompleteModal(true)}
                                                            className="btn-primary text-xs px-3 py-1 flex items-center gap-1"
                                                            title="Terminer la mission et libérer le véhicule"
                                                        >
                                                            <CheckCircle className="w-3 h-3" /> Terminer
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {mission.status === 'REJETEE' && mission.manager_comment && (
                                            <tr className="bg-red-50/50">
                                                <td colSpan="6" className="px-4 py-2 text-xs text-red-600 italic border-b border-red-100">
                                                    <span className="font-bold">Motif du rejet :</span> {mission.manager_comment}
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Création Mission */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nouvelle demande de mission" size="lg">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Calendar className="w-4 h-4 inline mr-1 text-green-600" /> Date de la mission *
                        </label>
                        <input
                            type="date"
                            {...register('mission_date', { required: 'La date est requise' })}
                            className="input-field"
                            min={new Date().toISOString().split('T')[0]}
                        />
                        {errors.mission_date && <p className="text-red-500 text-xs mt-1">{errors.mission_date.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <Flag className="w-4 h-4 inline mr-1 text-green-600" /> Lieu de départ
                        </label>
                        <input
                            {...register('start_location')}
                            className="input-field"
                            placeholder="Ex: Douala"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <MapPin className="w-4 h-4 inline mr-1 text-green-600" /> Destination *
                        </label>
                        <input
                            {...register('destination', { required: 'La destination est requise' })}
                            className="input-field"
                            placeholder="Ex: Site Bassa"
                        />
                        {errors.destination && <p className="text-red-500 text-xs mt-1">{errors.destination.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <ArrowRight className="w-4 h-4 inline mr-1 text-green-600" /> Destination précise (optionnel)
                        </label>
                        <input
                            {...register('end_location')}
                            className="input-field"
                            placeholder="Ex: Site Bassa - Zone industrielle"
                        />
                        <p className="text-xs text-gray-400 mt-1">Si différent de la destination principale</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            <FileText className="w-4 h-4 inline mr-1 text-green-600" /> Motif de la mission *
                        </label>
                        <textarea
                            {...register('purpose', { required: 'Le motif est requis', minLength: { value: 5, message: 'Minimum 5 caractères' } })}
                            rows={3}
                            className="input-field resize-none"
                            placeholder="Raison détaillée de la mission..."
                        />
                        {errors.purpose && <p className="text-red-500 text-xs mt-1">{errors.purpose.message}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Clock className="w-4 h-4 inline mr-1 text-green-600" /> Durée estimée (heures)
                            </label>
                            <input
                                type="number"
                                {...register('estimated_duration')}
                                className="input-field"
                                placeholder="Ex: 4"
                                min="0"
                                max="72"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Building className="w-4 h-4 inline mr-1 text-green-600" /> Service / Unité
                            </label>
                            <input
                                {...register('department')}
                                className="input-field"
                                placeholder="Ex: Direction Technique"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Annuler</button>
                        <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                            {createMutation.isPending ? 'Envoi...' : 'Envoyer la demande'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal Visualisation Mission Détails */}
            <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Détails de la mission" size="lg">
                {selectedMission && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Lieu de départ</p>
                                <p className="text-sm font-medium mt-1">{selectedMission.start_location || '—'}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Destination</p>
                                <p className="text-sm font-medium mt-1">{selectedMission.end_location || selectedMission.destination || '—'}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
                                <p className="text-sm mt-1">{formatDateTime(selectedMission.mission_date)}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Durée estimée</p>
                                <p className="text-sm mt-1">{selectedMission.estimated_duration ? `${selectedMission.estimated_duration} heures` : 'Non spécifiée'}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Service / Unité</p>
                                <p className="text-sm mt-1">{selectedMission.department || '—'}</p>
                            </div>
                            <div className="col-span-1 sm:col-span-2 bg-gray-50 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Motif</p>
                                <p className="text-sm mt-1">{selectedMission.purpose || '—'}</p>
                            </div>
                        </div>

                        {selectedMission.vehicle && (
                            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                <p className="text-xs text-green-700 uppercase tracking-wide">Véhicule attribué</p>
                                <p className="text-sm font-mono font-semibold mt-1">
                                    {selectedMission.vehicle.plate_number} - {selectedMission.vehicle.brand} {selectedMission.vehicle.model}
                                </p>
                                <p className="text-xs text-green-600 mt-1">Kilométrage: {selectedMission.vehicle.current_mileage?.toLocaleString()} km</p>
                            </div>
                        )}

                        {selectedMission.manager_comment && (
                            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                                <p className="text-xs text-red-700 uppercase tracking-wide">Commentaire du Manager</p>
                                <p className="text-sm mt-1">{selectedMission.manager_comment}</p>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Statut</p>
                                <div className="mt-1">
                                    <span className={`badge ${getStatusBadgeClass(selectedMission.status)}`}>
                                        {MISSION_STATUS_LABELS[selectedMission.status] || selectedMission.status}
                                    </span>
                                </div>
                            </div>
                            {selectedMission.status === 'VEHICULE_ATTRIBUE' && (
                                <button
                                    onClick={() => window.location.href = `/agent/inspections/new?mission=${selectedMission.id}`}
                                    className="btn-primary"
                                >
                                    Démarrer l'inspection
                                </button>
                            )}
                            {selectedMission.status === 'APPROUVEE' && (
                                <button
                                    onClick={() => setCompleteData({
                                        missionId: selectedMission.id,
                                        finalMileage: selectedMission.vehicle?.current_mileage || '',
                                        notes: ''
                                    }) || setShowCompleteModal(true)}
                                    className="btn-primary"
                                >
                                    <CheckCircle className="w-4 h-4" /> Terminer la mission
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal de confirmation de fin de mission */}
            <Modal isOpen={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="Terminer la mission" size="md">
                <div className="space-y-4">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800">
                            <CheckCircle className="w-4 h-4 inline mr-1" />
                            Confirmez-vous la fin de cette mission ?
                        </p>
                        <p className="text-xs text-blue-600 mt-1">Le véhicule sera libéré et deviendra disponible pour d'autres missions.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kilométrage final</label>
                        <input
                            type="number"
                            value={completeData.finalMileage}
                            onChange={(e) => setCompleteData({ ...completeData, finalMileage: e.target.value })}
                            className="input-field"
                            placeholder="Kilométrage actuel"
                        />
                        <p className="text-xs text-gray-400 mt-1">Optionnel - sera mis à jour dans le véhicule</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                        <textarea
                            rows={2}
                            value={completeData.notes}
                            onChange={(e) => setCompleteData({ ...completeData, notes: e.target.value })}
                            className="input-field"
                            placeholder="Commentaires sur la mission..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button onClick={() => setShowCompleteModal(false)} className="btn-secondary">Annuler</button>
                        <button onClick={handleComplete} disabled={completeMutation.isPending} className="btn-primary">
                            {completeMutation.isPending ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <CheckCircle className="w-4 h-4" />
                            )}
                            Confirmer la fin de mission
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default AgentMissionsPage