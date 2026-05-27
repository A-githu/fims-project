// src/pages/manager/VehiclesPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getVehicles, createVehicle, updateVehicle, decommissionVehicle } from '../../services/api'
import api from '../../services/api'
import { Plus, Pencil, Trash2, History, Wrench, RefreshCw } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'

// ✅ Configuration des statuts avec badges et icônes
const VEHICLE_STATUS_CONFIG = {
    active: { label: 'Disponible', badge: 'badge-green', dot: 'bg-green-500', icon: '✅' },
    in_mission: { label: 'En mission', badge: 'badge-blue', dot: 'bg-blue-500', icon: '🚗' },
    maintenance: { label: 'Maintenance', badge: 'badge-amber', dot: 'bg-amber-500', icon: '🔧' },
    blocked: { label: 'Bloqué', badge: 'badge-red', dot: 'bg-red-500', icon: '❌' },
    decommissioned: { label: 'Hors service', badge: 'badge-gray', dot: 'bg-gray-400', icon: '📁' },
}

// ✅ Composant StatusBadge personnalisé pour véhicules
const VehicleStatusBadge = ({ status }) => {
    const cfg = VEHICLE_STATUS_CONFIG[status] || VEHICLE_STATUS_CONFIG.active
    return (
        <span className={`${cfg.badge} rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1 w-fit`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
            {cfg.icon} {cfg.label}
        </span>
    )
}

const VehiclesPage = () => {
    const navigate = useNavigate()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingVehicle, setEditingVehicle] = useState(null)
    const [showHistoryId, setShowHistoryId] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')
    const [reactivatingId, setReactivatingId] = useState(null)
    const queryClient = useQueryClient()

    const { data: vehicles, isLoading, refetch } = useQuery({
        queryKey: ['vehicles', statusFilter],
        queryFn: () => {
            const params = statusFilter !== 'all' ? { status: statusFilter } : {}
            return getVehicles(params).then(res => res.data?.items || res.data || [])
        },
    })

    const { register, handleSubmit, reset, formState: { errors } } = useForm()

    const createMutation = useMutation({
        mutationFn: createVehicle,
        onSuccess: () => {
            queryClient.invalidateQueries(['vehicles'])
            toast.success('Véhicule créé avec succès')
            handleCloseModal()
        },
        onError: (error) => {
            const message = error.response?.data?.detail || 'Erreur lors de la création'
            toast.error(message)
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => updateVehicle(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['vehicles'])
            toast.success('Véhicule modifié avec succès')
            handleCloseModal()
        },
        onError: (error) => {
            const message = error.response?.data?.detail || 'Erreur lors de la modification'
            toast.error(message)
        },
    })

    const deleteMutation = useMutation({
        mutationFn: decommissionVehicle,
        onSuccess: () => {
            queryClient.invalidateQueries(['vehicles'])
            toast.success('Véhicule mis hors service avec succès')
        },
        onError: (error) => {
            const message = error.response?.data?.detail || 'Erreur lors de la mise hors service'
            toast.error(message)
        },
    })

    // ✅ Mutation pour réactiver un véhicule bloqué
    const reactivateVehicleMutation = useMutation({
        mutationFn: ({ id }) =>
            api.put(`/api/vehicles/${id}/reactivate`).then(r => r.data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['vehicles'] })
            queryClient.invalidateQueries({ queryKey: ['vehicles-all'] })
            queryClient.invalidateQueries({ queryKey: ['available-vehicles'] })
            toast.success(`Véhicule ${data.plate_number} réactivé et disponible dans la flotte ✓`)
            setReactivatingId(null)
        },
        onError: (error) => {
            const message = error.response?.data?.detail || 'Erreur lors de la réactivation'
            toast.error(message)
            setReactivatingId(null)
        }
    })

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setEditingVehicle(null)
        reset()
    }

    const onSubmit = (data) => {
        const payload = {
            plate_number: data.plate_number.toUpperCase(),
            brand: data.brand,
            model: data.model,
            year: parseInt(data.year),
            fuel_type: data.fuel_type,
            current_mileage: parseInt(data.current_mileage) || 0,
            department_id: data.department_id || null,
            next_revision_date: data.next_revision_date || null,
        }

        if (editingVehicle) {
            updateMutation.mutate({ id: editingVehicle.id, data: payload })
        } else {
            createMutation.mutate(payload)
        }
    }

    const handleDelete = (id, plateNumber) => {
        if (confirm(`Êtes-vous sûr de vouloir mettre le véhicule "${plateNumber}" hors service ?`)) {
            deleteMutation.mutate(id)
        }
    }

    // ✅ Fonction pour gérer le clic sur maintenance
    const handleMaintenanceClick = (vehicle) => {
        if (vehicle.status === 'blocked') {
            // Si le véhicule est bloqué, demander confirmation pour réactiver
            if (confirm(`Le véhicule ${vehicle.plate_number} est actuellement BLOQUÉ.\n\nVoulez-vous le réactiver pour qu'il retourne dans la flotte ?`)) {
                reactivateVehicleMutation.mutate({ id: vehicle.id })
            }
        } else if (vehicle.status === 'maintenance') {
            // Si déjà en maintenance, rediriger vers la page maintenance
            navigate(`/manager/maintenance?vehicle_id=${vehicle.id}`)
        } else {
            // Sinon, créer une nouvelle fiche de maintenance
            navigate(`/manager/maintenance?vehicle_id=${vehicle.id}`)
        }
    }

    if (isLoading) return <Spinner />

    const vehicleList = Array.isArray(vehicles) ? vehicles : []

    // ✅ Compteurs pour les filtres
    const allCount = vehicleList.length
    const activeCount = vehicleList.filter(v => v.status === 'active').length
    const inMissionCount = vehicleList.filter(v => v.status === 'in_mission').length
    const maintenanceCount = vehicleList.filter(v => v.status === 'maintenance').length
    const blockedCount = vehicleList.filter(v => v.status === 'blocked').length

    return (
        <div className="space-y-6">
            <PageHeader
                title="Parc Véhicules"
                subtitle={`${activeCount} véhicule(s) disponible(s) · ${maintenanceCount} en maintenance · ${blockedCount} bloqué(s)`}
                actions={
                    <button onClick={() => setIsModalOpen(true)} className="bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg px-4 py-2 flex items-center gap-2 transition-all">
                        <Plus className="w-4 h-4" />
                        Nouveau véhicule
                    </button>
                }
            />

            {/* ✅ Filtres de statut */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${statusFilter === 'all' ? 'bg-green-500 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                    📋 Tous ({allCount})
                </button>
                <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${statusFilter === 'active' ? 'bg-green-500 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                    Disponibles ({activeCount})
                </button>
                <button
                    onClick={() => setStatusFilter('in_mission')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${statusFilter === 'in_mission' ? 'bg-green-500 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                    En mission ({inMissionCount})
                </button>
                <button
                    onClick={() => setStatusFilter('maintenance')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${statusFilter === 'maintenance' ? 'bg-green-500 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                    En maintenance ({maintenanceCount})
                </button>
                <button
                    onClick={() => setStatusFilter('blocked')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${statusFilter === 'blocked' ? 'bg-green-500 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                    Bloqués ({blockedCount})
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Immatriculation</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Marque / Modèle</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Année</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Carburant</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kilométrage</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vehicleList.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-5 py-8 text-center text-gray-400">
                                        <EmptyState title="Aucun véhicule" description="Commencez par ajouter un véhicule à la flotte" />
                                    </td>
                                </tr>
                            ) : (
                                vehicleList.map((vehicle) => (
                                    <tr key={vehicle.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                                        <td className="px-5 py-3 text-sm font-mono font-medium text-gray-900">{vehicle.plate_number}</td>
                                        <td className="px-5 py-3 text-sm text-gray-700">{vehicle.brand} {vehicle.model}</td>
                                        <td className="px-5 py-3 text-sm text-gray-600">{vehicle.year}</td>
                                        <td className="px-5 py-3 text-sm text-gray-600">{vehicle.fuel_type}</td>
                                        <td className="px-5 py-3 text-sm text-gray-600">{vehicle.current_mileage?.toLocaleString()} km</td>
                                        <td className="px-5 py-3"><VehicleStatusBadge status={vehicle.status} /></td>
                                        <td className="px-5 py-3">
                                            <div className="flex gap-2">
                                                {/* ✅ Bouton Maintenance - pour véhicules bloqués ou maintenance */}
                                                {(vehicle.status === 'blocked' || vehicle.status === 'maintenance') && (
                                                    <button
                                                        onClick={() => handleMaintenanceClick(vehicle)}
                                                        disabled={reactivatingId === vehicle.id}
                                                        className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition disabled:opacity-50"
                                                        title={vehicle.status === 'blocked' ? "Réactiver le véhicule" : "Voir la maintenance"}
                                                    >
                                                        {reactivatingId === vehicle.id ? (
                                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        ) : (
                                                            <Wrench className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setEditingVehicle(vehicle)
                                                        reset({
                                                            plate_number: vehicle.plate_number,
                                                            brand: vehicle.brand,
                                                            model: vehicle.model,
                                                            year: vehicle.year,
                                                            fuel_type: vehicle.fuel_type,
                                                            current_mileage: vehicle.current_mileage,
                                                            next_revision_date: vehicle.next_revision_date || '',
                                                        })
                                                        setIsModalOpen(true)
                                                    }}
                                                    className="p-1.5 text-gray-500 hover:text-green-600 transition rounded-lg hover:bg-green-50"
                                                    title="Modifier"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(vehicle.id, vehicle.plate_number)}
                                                    className="p-1.5 text-gray-500 hover:text-red-500 transition rounded-lg hover:bg-red-50"
                                                    title="Mettre hors service"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Ajout/Modification */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingVehicle ? 'Modifier le véhicule' : 'Ajouter un véhicule'} size="lg">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Immatriculation *</label>
                            <input
                                {...register('plate_number', { required: 'Champ requis' })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 uppercase"
                                placeholder="LT-1234-CM"
                            />
                            {errors.plate_number && <p className="text-red-500 text-xs mt-1">{errors.plate_number.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Marque *</label>
                            <input {...register('brand', { required: 'Champ requis' })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500" placeholder="Toyota" />
                            {errors.brand && <p className="text-red-500 text-xs mt-1">{errors.brand.message}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Modèle *</label>
                            <input {...register('model', { required: 'Champ requis' })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500" placeholder="HiLux" />
                            {errors.model && <p className="text-red-500 text-xs mt-1">{errors.model.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Année *</label>
                            <input type="number" {...register('year', { required: 'Champ requis', min: 1990, max: 2030 })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500" />
                            {errors.year && <p className="text-red-500 text-xs mt-1">{errors.year.message}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type de carburant *</label>
                            <select {...register('fuel_type', { required: 'Champ requis' })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500">
                                <option value="essence">Essence</option>
                                <option value="diesel">Diesel</option>
                                <option value="electrique">Électrique</option>
                                <option value="hybride">Hybride</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Kilométrage actuel</label>
                            <input type="number" {...register('current_mileage')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500" placeholder="0" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prochaine révision</label>
                        <input type="date" {...register('next_revision_date')} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500" />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">Annuler</button>
                        <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-6 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 transition">
                            {createMutation.isPending || updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default VehiclesPage