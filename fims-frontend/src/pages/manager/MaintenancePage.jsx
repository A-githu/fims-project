// src/pages/manager/MaintenancePage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { formatDate, formatDateTime } from '../../utils/helpers'
import {
    Wrench, AlertTriangle, CheckCircle, Clock, Plus,
    Eye, XCircle, Calendar, DollarSign, User, Car,
    FileText, ChevronDown, Filter
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'

const MAINTENANCE_STATUSES = {
    waiting: { label: "En attente", badge: "badge-blue", icon: "⏳" },
    in_progress: { label: "En cours", badge: "badge-amber", icon: "🔧" },
    done: { label: "Terminée", badge: "badge-green", icon: "✓" },
    validated: { label: "Archivée", badge: "badge-gray", icon: "📁" },
}

const PRIORITY_CONFIG = {
    low: { label: "Faible", color: "text-gray-600", bg: "bg-gray-100", icon: "🔵" },
    normal: { label: "Normale", color: "text-blue-600", bg: "bg-blue-100", icon: "📌" },
    high: { label: "Haute", color: "text-amber-600", bg: "bg-amber-100", icon: "⚠️" },
    critical: { label: "Critique", color: "text-red-600", bg: "bg-red-100", icon: "🔥" },
}

const MaintenanceCard = ({ task, onViewDetail, onComplete }) => {
    const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal
    const statusCfg = MAINTENANCE_STATUSES[task.status] || MAINTENANCE_STATUSES.waiting
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done' && task.status !== 'validated'

    return (
        <div className={`bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${isOverdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
            }`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${priority.bg} ${priority.color}`}>
                        {priority.icon} {priority.label}
                    </span>
                    <span className={`${statusCfg.badge} text-xs font-medium px-2.5 py-1 rounded-full`}>
                        {statusCfg.icon} {statusCfg.label}
                    </span>
                    {isOverdue && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                            En retard
                        </span>
                    )}
                </div>
            </div>

            {/* Titre et véhicule */}
            <h3 className="font-bold text-gray-900 text-base mb-1">{task.title}</h3>
            <p className="text-sm font-mono font-semibold text-amber-600 mb-3">
                <Car className="w-3.5 h-3.5 inline mr-1" /> {task.vehicle_plate} — {task.vehicle_brand} {task.vehicle_model}
            </p>

            {/* Infos grille */}
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                <span>📅 Constatée le : <strong className="text-gray-700">{formatDate(task.fault_date)}</strong></span>
                {task.due_date && (
                    <span>🏁 Fin prévue : <strong className={isOverdue ? 'text-red-600' : 'text-gray-700'}>{formatDate(task.due_date)}</strong></span>
                )}
                {task.provider && (
                    <span>🔧 Prestataire : <strong className="text-gray-700">{task.provider}</strong></span>
                )}
                {task.estimated_cost && (
                    <span>💰 Coût estimé : <strong className="text-gray-700">{task.estimated_cost.toLocaleString()} FCFA</strong></span>
                )}
                <span>👤 Créé par : <strong className="text-gray-700">{task.creator_name}</strong></span>
                <span>🕐 Créé le : <strong className="text-gray-700">{formatDate(task.created_at)}</strong></span>
            </div>

            {/* Notes */}
            {task.notes && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 italic mb-3 border-l-3 border-l-amber-400">
                    📝 Note : {task.notes}
                </div>
            )}

            {/* Note de clôture si terminée */}
            {task.status === 'done' && task.closure_note && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 mb-3">
                    <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                    <strong>Clôture :</strong> {task.closure_note}
                    {task.completed_at && <span className="ml-1 text-green-500">— {formatDateTime(task.completed_at)}</span>}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-gray-100">
                {task.status !== 'done' && task.status !== 'validated' && (
                    <button
                        onClick={() => onComplete(task)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition-colors"
                    >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Véhicule prêt — Retour flotte
                    </button>
                )}
                <button
                    onClick={() => onViewDetail(task)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                >
                    <Eye className="w-3.5 h-3.5" />
                    Voir détail
                </button>
            </div>
        </div>
    )
}

const MaintenancePage = () => {
    const [searchParams] = useSearchParams()
    const queryClient = useQueryClient()
    const [filterStatus, setFilterStatus] = useState('all')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showCompleteModal, setShowCompleteModal] = useState(null)
    const [showDetailModal, setShowDetailModal] = useState(null)
    const [closureNote, setClosureNote] = useState('')
    const [updateNotes, setUpdateNotes] = useState('')
    const [updateStatus, setUpdateStatus] = useState('')

    // Charger les fiches de maintenance
    const { data: tasks, isLoading, refetch } = useQuery({
        queryKey: ['maintenance', filterStatus],
        queryFn: () => api.get('/api/maintenance/', {
            params: filterStatus !== 'all' ? { status: filterStatus } : {}
        }).then(r => r.data?.items || r.data || []),
    })

    // Charger les véhicules pour le formulaire
    const { data: vehicles } = useQuery({
        queryKey: ['vehicles-all'],
        queryFn: () => api.get('/api/vehicles/').then(r => r.data?.items || r.data || []),
        enabled: showCreateModal,
    })

    // Charger les inspections unfit pour le formulaire
    const { data: unfitInspections } = useQuery({
        queryKey: ['inspections-unfit'],
        queryFn: () => api.get('/api/inspections/').then(r => {
            const all = r.data?.items || r.data || []
            return all.filter(i => i.agent_conclusion === 'unfit' || i.agent_conclusion === 'warning')
        }),
        enabled: showCreateModal,
    })

    const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm({
        defaultValues: {
            priority: 'normal',
            fault_date: new Date().toISOString().split('T')[0],
            vehicle_id: '',
            inspection_id: '',
            title: '',
            description: '',
            provider: '',
            estimated_cost: '',
            due_date: '',
            notes: '',
        }
    })

    const selectedVehicleId = watch('vehicle_id')
    const selectedVehicle = vehicles?.find(v => v.id === selectedVehicleId)
    const isVehicleAlreadyInMaintenance = selectedVehicle?.status === 'maintenance'

    // Mutation créer
    const createMutation = useMutation({
        mutationFn: (payload) => api.post('/api/maintenance/', payload).then(r => r.data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['maintenance'] })
            queryClient.invalidateQueries({ queryKey: ['vehicles'] })
            queryClient.invalidateQueries({ queryKey: ['vehicles-all'] })
            queryClient.invalidateQueries({ queryKey: ['available-vehicles'] })
            toast.success(`Fiche créée — ${data.vehicle_plate} placé en maintenance`)
            setShowCreateModal(false)
            reset()
        },
        onError: (err) => toast.error(err.response?.data?.detail || 'Erreur création')
    })


    // Modifier la mutation completeMutation
    const completeMutation = useMutation({
        mutationFn: ({ id, closure_note }) =>
            api.put(`/api/maintenance/${id}/complete`, { closure_note }).then(r => r.data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['maintenance'] })
            queryClient.invalidateQueries({ queryKey: ['vehicles'] })
            queryClient.invalidateQueries({ queryKey: ['vehicles-all'] })
            queryClient.invalidateQueries({ queryKey: ['available-vehicles'] })
            queryClient.invalidateQueries({ queryKey: ['inspections-pending-manager'] })
            queryClient.invalidateQueries({ queryKey: ['inspections-all-manager'] })

            toast.success(`Véhicule ${data.vehicle_plate || 'remis en service'} ✓`)
            setShowCompleteModal(null)
            setClosureNote('')

            // Rediriger vers la page des inspections pour reprogrammer
            setTimeout(() => {
                navigate('/manager/inspections?highlight=recent')
            }, 1500)
        },
        onError: (error) => {
            toast.error(error.response?.data?.detail || 'Erreur lors de la clôture')
        }
    })
    // Mutation mise à jour
    const updateMutation = useMutation({
        mutationFn: ({ id, ...payload }) =>
            api.put(`/api/maintenance/${id}`, payload).then(r => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['maintenance'] })
            toast.success('Fiche mise à jour ✓')
            setShowDetailModal(null)
            setUpdateNotes('')
            setUpdateStatus('')
        },
        onError: (err) => toast.error(err.response?.data?.detail || 'Erreur mise à jour')
    })

    const onSubmit = (data) => {
        const payload = {
            vehicle_id: data.vehicle_id,
            inspection_id: data.inspection_id || null,
            title: data.title,
            description: data.description,
            fault_date: data.fault_date,
            priority: data.priority,
            provider: data.provider || null,
            estimated_cost: data.estimated_cost ? parseFloat(data.estimated_cost) : null,
            due_date: data.due_date || null,
            notes: data.notes || null,
        }
        createMutation.mutate(payload)
    }

    const handleComplete = (task) => {
        setShowCompleteModal(task)
        setClosureNote('')
    }

    const confirmComplete = () => {
        if (closureNote.trim().length < 5) {
            toast.error('La note de clôture est obligatoire (minimum 5 caractères)')
            return
        }
        completeMutation.mutate({ id: showCompleteModal.id, closure_note: closureNote })
    }

    const handleUpdateStatus = () => {
        if (!showDetailModal) return
        const payload = {}
        if (updateStatus) payload.status = updateStatus
        if (updateNotes) payload.notes = updateNotes
        if (Object.keys(payload).length === 0) {
            toast.error('Veuillez modifier au moins un champ')
            return
        }
        updateMutation.mutate({ id: showDetailModal.id, ...payload })
    }

    if (isLoading) return <Spinner />

    const taskList = Array.isArray(tasks) ? tasks : []
    const waitingCount = taskList.filter(t => t.status === 'waiting').length
    const inProgressCount = taskList.filter(t => t.status === 'in_progress').length

    return (
        <div className="space-y-6">
            <PageHeader
                title="Maintenance du Parc"
                subtitle={`${taskList.filter(t => t.status !== 'done' && t.status !== 'validated').length} véhicule(s) en maintenance · ${waitingCount} en attente, ${inProgressCount} en cours`}
                actions={
                    <button onClick={() => setShowCreateModal(true)} className="bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg px-4 py-2 flex items-center gap-2 transition-all">
                        <Plus className="w-4 h-4" />
                        Nouvelle fiche de maintenance
                    </button>
                }
            />

            {/* Filtres */}
            <div className="flex flex-wrap gap-2">
                {[
                    { key: 'all', label: 'Toutes', icon: '📋' },
                    { key: 'waiting', label: `En attente (${waitingCount})`, icon: '' },
                    { key: 'in_progress', label: `En cours (${inProgressCount})`, icon: '' },
                    { key: 'done', label: 'Terminées', icon: '✓' },
                ].map(filter => (
                    <button
                        key={filter.key}
                        onClick={() => setFilterStatus(filter.key)}
                        className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${filterStatus === filter.key
                            ? 'bg-green-500 text-white'
                            : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        {filter.icon} {filter.label}
                    </button>
                ))}
            </div>

            {/* Liste des fiches */}
            {taskList.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                    <Wrench className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <EmptyState
                        title="Aucune fiche de maintenance"
                        description="Créez votre première fiche de maintenance pour suivre les réparations"
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {taskList.map(task => (
                        <MaintenanceCard
                            key={task.id}
                            task={task}
                            onViewDetail={(t) => {
                                setShowDetailModal(t)
                                setUpdateNotes(t.notes || '')
                                setUpdateStatus(t.status)
                            }}
                            onComplete={handleComplete}
                        />
                    ))}
                </div>
            )}

            {/* MODALE CRÉATION FICHE */}
            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nouvelle fiche de maintenance" size="lg">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-h-[70vh] overflow-y-auto px-1">
                    {/* SECTION 1 - Identification */}
                    <div className="bg-gray-50 p-4 rounded-xl">
                        <h3 className="font-semibold text-gray-900 mb-3">1. Identification du véhicule</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Véhicule concerné *</label>
                                <select
                                    {...register('vehicle_id', { required: 'Veuillez sélectionner un véhicule' })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                                >
                                    <option value="">-- Sélectionner un véhicule --</option>
                                    {vehicles?.filter(v => v.status !== 'decommissioned').map(v => (
                                        <option key={v.id} value={v.id} disabled={v.status === 'maintenance'}>
                                            {v.plate_number} — {v.brand} {v.model} ({v.status === 'active' ? 'Disponible' :
                                                v.status === 'in_mission' ? 'En mission' :
                                                    v.status === 'maintenance' ? '⚠️ DÉJÀ EN MAINTENANCE' : 'Bloqué'})
                                        </option>
                                    ))}
                                </select>
                                {errors.vehicle_id && <p className="text-red-500 text-xs mt-1">{errors.vehicle_id.message}</p>}
                            </div>

                            {selectedVehicleId && !isVehicleAlreadyInMaintenance && (
                                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
                                    <span>
                                        Ce véhicule sera placé en <strong>maintenance</strong> et ne sera plus disponible
                                        pour les missions jusqu'à la clôture de cette fiche.
                                    </span>
                                </div>
                            )}

                            {isVehicleAlreadyInMaintenance && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
                                    <span>
                                        ⚠️ Ce véhicule est <strong>déjà en maintenance</strong>. Créer une nouvelle fiche pour ce véhicule créera une deuxième tâche.
                                    </span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lié à une inspection (optionnel)</label>
                                <select {...register('inspection_id')} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                                    <option value="">-- Aucune inspection associée --</option>
                                    {unfitInspections?.map(i => (
                                        <option key={i.id} value={i.id}>
                                            Insp. {formatDate(i.submitted_at)} — {i.vehicle?.plate_number} ({i.agent_conclusion === 'unfit' ? 'Inapte' : 'Avec réserves'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2 - Description */}
                    <div className="bg-gray-50 p-4 rounded-xl">
                        <h3 className="font-semibold text-gray-900 mb-3">2. Description de la panne</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Titre de la panne *</label>
                                <input
                                    {...register('title', { required: 'Titre requis', minLength: { value: 5, message: 'Minimum 5 caractères' } })}
                                    placeholder="Ex: Pneu avant gauche éclaté"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                                />
                                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description détaillée *</label>
                                <textarea
                                    {...register('description', { required: 'Description requise', minLength: { value: 10, message: 'Minimum 10 caractères' } })}
                                    rows={4}
                                    placeholder="Décrivez précisément la panne, les symptômes, les points de contrôle concernés..."
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 resize-none"
                                />
                                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de constatation *</label>
                                    <input
                                        type="date"
                                        {...register('fault_date', { required: 'Date requise' })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    />
                                    {errors.fault_date && <p className="text-red-500 text-xs mt-1">{errors.fault_date.message}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priorité *</label>
                                    <select {...register('priority')} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                                        <option value="low">Faible</option>
                                        <option value="normal">Normale</option>
                                        <option value="high">Haute</option>
                                        <option value="critical">Critique</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3 - Intervention */}
                    <div className="bg-gray-50 p-4 rounded-xl">
                        <h3 className="font-semibold text-gray-900 mb-3">3. Informations d'intervention (optionnel)</h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Prestataire / Garage</label>
                                <input {...register('provider')} placeholder="Ex: Garage Central Douala" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Coût estimé (FCFA)</label>
                                <input type="number" {...register('estimated_cost')} placeholder="Ex: 85000" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date prévue de fin</label>
                                <input type="date" {...register('due_date')} min={new Date().toISOString().split('T')[0]} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                            </div>

                            <div className="col-span-1 sm:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes initiales</label>
                                <textarea {...register('notes')} rows={2} placeholder="Pièces à commander, informations utiles..." className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-none" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                            Annuler
                        </button>
                        <button type="submit" disabled={createMutation.isPending} className="px-6 py-2 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 disabled:opacity-50">
                            {createMutation.isPending ? 'Création...' : '⚠ Mettre en maintenance et enregistrer'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* MODALE CLÔTURE */}
            <Modal isOpen={showCompleteModal !== null} onClose={() => setShowCompleteModal(null)} title="Clôture de maintenance — Retour en flotte" size="md">
                {showCompleteModal && (
                    <div className="space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <p className="font-bold text-amber-900">{showCompleteModal.vehicle_plate} — {showCompleteModal.vehicle_brand} {showCompleteModal.vehicle_model}</p>
                            <p className="text-sm text-amber-700 mt-1">{showCompleteModal.title}</p>
                            <p className="text-xs text-amber-600 mt-2">Créée le {formatDate(showCompleteModal.created_at)}</p>
                        </div>

                        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                            <span>
                                Ce véhicule va <strong>retourner dans la flotte</strong> et sera de nouveau
                                disponible pour les missions.
                            </span>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Note de clôture * <span className="font-normal text-gray-400">(décrivez les réparations effectuées)</span>
                            </label>
                            <textarea
                                rows={4}
                                value={closureNote}
                                onChange={e => setClosureNote(e.target.value)}
                                placeholder="Ex: Pneu avant gauche remplacé par neuf. Freins vérifiés et approuvés. Véhicule contrôlé et prêt pour remise en service."
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 resize-none"
                            />
                            <p className="text-xs text-gray-400 mt-1">{closureNote.length} / 5 caractères minimum</p>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowCompleteModal(null)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium text-sm">
                                Annuler
                            </button>
                            <button
                                onClick={confirmComplete}
                                disabled={closureNote.trim().length < 5 || completeMutation.isPending}
                                className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {completeMutation.isPending ? 'Libération...' : '✓ Confirmer — Libérer le véhicule'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODALE DÉTAIL / MISE À JOUR */}
            <Modal isOpen={showDetailModal !== null} onClose={() => setShowDetailModal(null)} title="Détail de la fiche de maintenance" size="lg">
                {showDetailModal && (
                    <div className="space-y-5 max-h-[70vh] overflow-y-auto px-1">
                        {/* En-tête */}
                        <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-200">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PRIORITY_CONFIG[showDetailModal.priority]?.bg} ${PRIORITY_CONFIG[showDetailModal.priority]?.color}`}>
                                {PRIORITY_CONFIG[showDetailModal.priority]?.icon} {PRIORITY_CONFIG[showDetailModal.priority]?.label}
                            </span>
                            <span className={`${MAINTENANCE_STATUSES[showDetailModal.status]?.badge} text-xs font-medium px-2.5 py-1 rounded-full`}>
                                {MAINTENANCE_STATUSES[showDetailModal.status]?.icon} {MAINTENANCE_STATUSES[showDetailModal.status]?.label}
                            </span>
                        </div>

                        <div>
                            <h3 className="text-xl font-bold text-gray-900">{showDetailModal.title}</h3>
                            <p className="text-sm font-mono font-semibold text-amber-600 mt-1">
                                <Car className="w-4 h-4 inline mr-1" /> {showDetailModal.vehicle_plate} — {showDetailModal.vehicle_brand} {showDetailModal.vehicle_model}
                            </p>
                        </div>

                        {/* Grille d'infos */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div className="bg-gray-50 p-2 rounded-lg"><span className="text-gray-500">Constatée le :</span><br /><strong>{formatDate(showDetailModal.fault_date)}</strong></div>
                            {showDetailModal.due_date && <div className="bg-gray-50 p-2 rounded-lg"><span className="text-gray-500">Fin prévue :</span><br /><strong>{formatDate(showDetailModal.due_date)}</strong></div>}
                            {showDetailModal.provider && <div className="bg-gray-50 p-2 rounded-lg"><span className="text-gray-500">Prestataire :</span><br /><strong>{showDetailModal.provider}</strong></div>}
                            {showDetailModal.estimated_cost && <div className="bg-gray-50 p-2 rounded-lg"><span className="text-gray-500">Coût estimé :</span><br /><strong>{showDetailModal.estimated_cost.toLocaleString()} FCFA</strong></div>}
                            <div className="bg-gray-50 p-2 rounded-lg"><span className="text-gray-500">Créé par :</span><br /><strong>{showDetailModal.creator_name}</strong></div>
                            <div className="bg-gray-50 p-2 rounded-lg"><span className="text-gray-500">Créé le :</span><br /><strong>{formatDateTime(showDetailModal.created_at)}</strong></div>
                        </div>

                        {/* Description */}
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-2">Description de la panne</h4>
                            <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700">{showDetailModal.description}</div>
                        </div>

                        {/* Notes existantes */}
                        {showDetailModal.notes && (
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Notes d'avancement</h4>
                                <div className="bg-amber-50 p-3 rounded-lg text-sm text-amber-800 italic">📝 {showDetailModal.notes}</div>
                            </div>
                        )}

                        {/* Note de clôture */}
                        {showDetailModal.status === 'done' && showDetailModal.closure_note && (
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Note de clôture</h4>
                                <div className="bg-green-50 p-3 rounded-lg text-sm text-green-800">
                                    <CheckCircle className="w-4 h-4 inline mr-1" /> {showDetailModal.closure_note}
                                    {showDetailModal.completed_at && <span className="block text-xs text-green-600 mt-1">Clôturé le {formatDateTime(showDetailModal.completed_at)}</span>}
                                </div>
                            </div>
                        )}

                        {/* Mise à jour - uniquement si non terminée */}
                        {showDetailModal.status !== 'done' && showDetailModal.status !== 'validated' && (
                            <div className="border-t border-gray-200 pt-4 mt-2">
                                <h4 className="font-semibold text-gray-900 mb-3">Mise à jour de la fiche</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Changer le statut</label>
                                        <select value={updateStatus} onChange={e => setUpdateStatus(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                                            <option value="waiting">En attente</option>
                                            <option value="in_progress">En cours</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Ajouter une note d'avancement</label>
                                        <textarea rows={3} value={updateNotes} onChange={e => setUpdateNotes(e.target.value)} placeholder="Décrivez l'avancement des travaux..." className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-none" />
                                    </div>
                                    <button onClick={handleUpdateStatus} disabled={updateMutation.isPending} className="w-full py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50">
                                        {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    )
}

export default MaintenancePage