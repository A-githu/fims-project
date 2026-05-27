// src/pages/agent/AgentDashboard.jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMissions, completeMission } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { Car, CheckCircle, AlertTriangle, MapPin, Plus, ArrowRight, Shield, TrendingUp, Clock, Flag } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import fr from 'date-fns/locale/fr'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import { formatDate } from '../../utils/helpers'
import toast from 'react-hot-toast'
import { useState } from 'react'
import Modal from '../../components/ui/Modal'

// ✅ STATUTS CORRIGÉS selon le workflow FIMS
const ACTIVE_STATUSES = ['VEHICULE_ATTRIBUE', 'INSPECTION_SOUMISE']
const PENDING_STATUSES = ['EN_ATTENTE_ATTRIBUTION', 'NOUVEAU_VEHICULE_REQUIS']

const AgentDashboard = () => {
    const { user } = useAuthStore()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [showCompleteModal, setShowCompleteModal] = useState(false)
    const [selectedMission, setSelectedMission] = useState(null)
    const [completeData, setCompleteData] = useState({ finalMileage: '', notes: '' })

    // ✅ Rafraîchissement toutes les 5 secondes pour les notifications
    const { data: missions, isLoading, refetch } = useQuery({
        queryKey: ['missions'],
        queryFn: async () => {
            try {
                const res = await getMissions()
                return res.data?.items || res.data || []
            } catch (err) {
                console.error('❌ Erreur getMissions:', err)
                return []
            }
        },
        refetchIntervalInBackground: true,
    })

    const completeMutation = useMutation({
        mutationFn: ({ missionId, finalMileage, notes }) =>
            completeMission(missionId, { final_mileage: finalMileage || null, notes: notes || null }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['missions'] })
            toast.success('Mission terminée — Véhicule libéré ✓')
            setShowCompleteModal(false)
            setSelectedMission(null)
            setCompleteData({ finalMileage: '', notes: '' })
        },
        onError: (error) => {
            const msg = error.response?.data?.detail || 'Erreur lors de la finalisation'
            toast.error(msg)
        },
    })

    const handleCompleteClick = (mission) => {
        setSelectedMission(mission)
        setCompleteData({ finalMileage: mission.vehicle?.current_mileage || '', notes: '' })
        setShowCompleteModal(true)
    }

    const handleComplete = () => {
        if (!selectedMission) return
        completeMutation.mutate({
            missionId: selectedMission.id,
            finalMileage: completeData.finalMileage,
            notes: completeData.notes
        })
    }

    if (isLoading) return <Spinner />

    const missionList = Array.isArray(missions) ? missions : []

    // ✅ CORRECTION: Mission active = statut VEHICULE_ATTRIBUE (doit faire inspection)
    const activeMission = missionList.find(m => m.status === 'VEHICULE_ATTRIBUE')

    // ✅ Mission approuvée = statut APPROUVEE (peut terminer)
    const approvedMission = missionList.find(m => m.status === 'APPROUVEE')

    // ✅ Mission en attente d'attribution
    const pendingMission = missionList.find(m => PENDING_STATUSES.includes(m.status))

    const recentMissions = missionList.slice(0, 5)

    const totalMissions = missionList.length
    const approvedMissions = missionList.filter(m => m.status === 'APPROUVEE' || m.status === 'TERMINEE').length
    const rejectedMissions = missionList.filter(m => m.status === 'REJETEE').length
    const pendingMissionsCount = missionList.filter(m => PENDING_STATUSES.includes(m.status)).length
    const conformityRate = totalMissions > 0 ? Math.round((approvedMissions / totalMissions) * 100) : 0

    return (
        <div className="space-y-6">
            {/* En-tête */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="font-mono text-xs uppercase tracking-wide">Espace Agent</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.full_name?.split(' ')[0] || 'Agent'}</h1>
                    <p className="text-sm text-gray-500 mt-1">{format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}</p>
                </div>
                <button
                    onClick={() => navigate('/agent/missions')}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Nouvelle demande
                </button>
            </div>

            {/* ✅ SECTION 1: Mission active - VEHICULE_ATTRIBUE (doit faire l'inspection) */}
            {activeMission && (
                <div className="bg-gradient-to-r from-green-50 to-white rounded-xl p-5 border border-green-200">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <Car className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Véhicule attribué - Inspection requise</p>
                                <h3 className="text-lg font-bold text-gray-900">{activeMission.destination || '—'}</h3>
                                {activeMission.vehicle?.plate_number && (
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        Véhicule: <span className="font-mono font-semibold">{activeMission.vehicle.plate_number}</span>
                                    </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                    Demande créée le {formatDate(activeMission.created_at)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <StatusBadge status="VEHICULE_ATTRIBUE" />
                            <button
                                onClick={() => navigate(`/agent/inspections/new?mission=${activeMission.id}`)}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2"
                            >
                                <Shield className="w-4 h-4" /> Démarrer l'inspection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ SECTION 2: Mission approuvée - APPROUVEE (peut terminer la mission) */}
            {approvedMission && (
                <div className="bg-gradient-to-r from-blue-50 to-white rounded-xl p-5 border border-blue-200">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <Flag className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">✅ Inspection validée - En mission</p>
                                <h3 className="text-lg font-bold text-gray-900">{approvedMission.destination || '—'}</h3>
                                {approvedMission.vehicle?.plate_number && (
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        Véhicule: <span className="font-mono font-semibold">{approvedMission.vehicle.plate_number}</span>
                                    </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                    Mission approuvée le {formatDate(approvedMission.updated_at)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <StatusBadge status="APPROUVEE" />
                            <button
                                onClick={() => handleCompleteClick(approvedMission)}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4" /> Terminer la mission
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ SECTION 3: Mission en attente d'attribution */}
            {pendingMission && !activeMission && !approvedMission && (
                <div className="bg-gradient-to-r from-amber-50 to-white rounded-xl p-5 border border-amber-200">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                <Clock className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Demande en attente</p>
                                <h3 className="text-lg font-bold text-gray-900">{pendingMission.destination || '—'}</h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    En attente d'attribution par le Manager
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <StatusBadge status={pendingMission.status} />
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ SECTION 4: Aucune mission active */}
            {!activeMission && !approvedMission && !pendingMission && (
                <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
                    <Car className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-gray-900">Aucune mission active</h3>
                    <p className="text-sm text-gray-500 mt-1">Créez une demande de mission pour commencer</p>
                    <button
                        onClick={() => navigate('/agent/missions')}
                        className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                    >
                        + Nouvelle demande
                    </button>
                </div>
            )}

            {/* Cartes statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-blue-50">
                        <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{totalMissions}</p>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">Total missions</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-green-50">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{approvedMissions}</p>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">Approuvées / Terminées</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-orange-50">
                        <Clock className="w-5 h-5 text-orange-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{pendingMissionsCount}</p>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">En attente</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-green-50">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{conformityRate}%</p>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">Taux conformité</p>
                </div>
            </div>

            {/* Tableau des missions récentes */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <h3 className="text-base font-semibold text-gray-900">Mes missions récentes</h3>
                    <Link to="/agent/missions" className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1">
                        Voir tout <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Destination</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentMissions.length > 0 ? recentMissions.map((m) => (
                                <tr
                                    key={m.id}
                                    className="border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer"
                                    onClick={() => {
                                        if (m.status === 'VEHICULE_ATTRIBUE') {
                                            navigate(`/agent/inspections/new?mission=${m.id}`)
                                        } else if (m.status === 'APPROUVEE') {
                                            handleCompleteClick(m)
                                        } else {
                                            navigate('/agent/missions')
                                        }
                                    }}
                                >
                                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{m.destination || '—'}</td>
                                    <td className="px-5 py-3 text-sm text-gray-500">{formatDate(m.mission_date)}</td>
                                    <td className="px-5 py-3">
                                        <StatusBadge status={m.status} />
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="3" className="px-5 py-8 text-center text-gray-400">
                                        Aucune mission pour le moment
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de confirmation de fin de mission */}
            <Modal isOpen={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="Terminer la mission" size="md">
                <div className="space-y-4">
                    {selectedMission && (
                        <>
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                <p className="text-sm text-blue-800">
                                    <CheckCircle className="w-4 h-4 inline mr-1" />
                                    Confirmez-vous la fin de cette mission ?
                                </p>
                                <p className="text-xs text-blue-600 mt-1">
                                    Véhicule: <span className="font-mono font-semibold">{selectedMission.vehicle?.plate_number}</span>
                                </p>
                                <p className="text-xs text-blue-600">
                                    Destination: {selectedMission.destination}
                                </p>
                                <p className="text-xs text-blue-600 mt-2 italic">
                                    Après confirmation, le véhicule sera libéré et redeviendra disponible.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kilométrage final</label>
                                <input
                                    type="number"
                                    value={completeData.finalMileage}
                                    onChange={(e) => setCompleteData({ ...completeData, finalMileage: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    placeholder="Commentaires sur la mission..."
                                />
                            </div>
                        </>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button
                            onClick={() => setShowCompleteModal(false)}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleComplete}
                            disabled={completeMutation.isPending}
                            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 flex items-center gap-2"
                        >
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

export default AgentDashboard