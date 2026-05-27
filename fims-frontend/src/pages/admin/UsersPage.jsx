// src/pages/admin/UsersPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getUsers, createUser, updateUser, deleteUser, getDepartments } from '../../services/api'
import { Plus, Pencil, Trash2, Shield, User, UserCog, Eye } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { formatDate } from '../../utils/helpers'

// Badges pour les rôles
const roleBadges = {
    admin: { label: 'Administrateur', class: 'badge-active' },
    manager: { label: 'Manager', class: 'badge-maintenance' },
    agent: { label: 'Agent', class: 'badge-pending' },
    unit_supervisor: { label: 'Responsable d\'Unité', class: 'badge-supervisor' }
}

const UsersPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingUser, setEditingUser] = useState(null)
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const queryClient = useQueryClient()

    // Récupérer la liste des utilisateurs
    const { data: users, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: () => getUsers().then(res => res.data?.items || res.data || []),
    })

    // Récupérer la liste des départements
    const { data: departmentsData } = useQuery({
        queryKey: ['departments'],
        queryFn: () => getDepartments().then(res => res.data || []),
    })

    const { register, handleSubmit, reset, formState: { errors } } = useForm()

    // Création d'un utilisateur
    const createMutation = useMutation({
        mutationFn: createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            toast.success('Utilisateur créé avec succès')
            handleCloseModal()
        },
        onError: (error) => {
            const message = error.response?.data?.detail || 'Erreur lors de la création'
            toast.error(message)
        },
    })

    // Modification d'un utilisateur
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => updateUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            toast.success('Utilisateur modifié avec succès')
            handleCloseModal()
        },
        onError: (error) => {
            const message = error.response?.data?.detail || 'Erreur lors de la modification'
            toast.error(message)
        },
    })

    // Suppression d'un utilisateur
    const deleteMutation = useMutation({
        mutationFn: (id) => deleteUser(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            toast.success('Utilisateur supprimé avec succès')
            setDeleteConfirm(null)
        },
        onError: (error) => {
            const message = error.response?.data?.detail || 'Erreur lors de la suppression'
            toast.error(message)
        },
    })

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setEditingUser(null)
        reset()
    }

    const onSubmit = (data) => {
        // Pour la création, le mot de passe est requis
        if (!editingUser && !data.password) {
            toast.error('Le mot de passe est requis pour un nouvel utilisateur')
            return
        }

        if (editingUser) {
            const updateData = {
                full_name: data.full_name,
                email: data.email,
                role: data.role,
                department: data.department
            }
            updateMutation.mutate({ id: editingUser.id, data: updateData })
        } else {
            createMutation.mutate(data)
        }
    }

    const handleDeleteClick = (user) => {
        setDeleteConfirm(user)
    }

    const confirmDelete = () => {
        if (deleteConfirm) {
            deleteMutation.mutate(deleteConfirm.id)
        }
    }

    const getRoleIcon = (role) => {
        switch (role) {
            case 'admin': return <Shield className="w-4 h-4 text-purple-500" />
            case 'manager': return <UserCog className="w-4 h-4 text-blue-500" />
            case 'unit_supervisor': return <Eye className="w-4 h-4 text-purple-500" />
            default: return <User className="w-4 h-4 text-green-500" />
        }
    }

    const getRoleBadge = (role) => {
        const badge = roleBadges[role] || { label: role, class: 'badge-pending' }
        const badgeClasses = {
            'badge-active': 'bg-green-100 text-green-700 border border-green-200 rounded-full px-3 py-1 text-xs font-medium',
            'badge-maintenance': 'bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-xs font-medium',
            'badge-pending': 'bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-3 py-1 text-xs font-medium',
            'badge-supervisor': 'bg-purple-100 text-purple-700 border border-purple-200 rounded-full px-3 py-1 text-xs font-medium'
        }
        return <span className={badgeClasses[badge.class] || badgeClasses['badge-pending']}>{badge.label}</span>
    }

    if (isLoading) return <Spinner />

    const userList = Array.isArray(users) ? users : []

    return (
        <div className="space-y-6">
            <PageHeader
                title="Gestion des utilisateurs"
                actions={
                    <button onClick={() => setIsModalOpen(true)} className="bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg px-4 py-2 flex items-center gap-2 transition-all">
                        <Plus className="w-4 h-4" />
                        Nouvel utilisateur
                    </button>
                }
            />

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-gray-500">Nom complet</th>
                                <th className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-gray-500">Email</th>
                                <th className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-gray-500">Rôle</th>
                                <th className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-gray-500">Département</th>
                                <th className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-gray-500">Date création</th>
                                <th className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {userList.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center">
                                        <EmptyState title="Aucun utilisateur" description="Commencez par créer des utilisateurs" />
                                    </td>
                                </tr>
                            ) : (
                                userList.map((user) => (
                                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                {getRoleIcon(user.role)}
                                                <span className="text-sm font-medium text-gray-900">{user.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{user.email}</td>
                                        <td className="py-3 px-4">{getRoleBadge(user.role)}</td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{user.department || '—'}</td>
                                        <td className="py-3 px-4 text-sm text-gray-500 font-mono">{formatDate(user.created_at)}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingUser(user)
                                                        reset({
                                                            full_name: user.full_name,
                                                            email: user.email,
                                                            role: user.role,
                                                            department: user.department,
                                                        })
                                                        setIsModalOpen(true)
                                                    }}
                                                    className="p-1.5 text-gray-500 hover:text-green-600 transition rounded-lg hover:bg-green-50"
                                                    title="Modifier"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(user)}
                                                    className="p-1.5 text-gray-500 hover:text-red-500 transition rounded-lg hover:bg-red-50"
                                                    title="Supprimer"
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

            {/* Modal Ajout/Modification Utilisateur */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={editingUser ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur'} size="lg">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
                        <input
                            {...register('full_name', { required: 'Champ requis' })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                            placeholder="Jean Dupont"
                        />
                        {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                        <input
                            type="email"
                            {...register('email', { required: 'Champ requis', pattern: /^\S+@\S+$/i })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                            placeholder="utilisateur@fims.cm"
                        />
                        {errors.email && <p className="text-red-500 text-xs mt-1">Email invalide</p>}
                    </div>

                    {!editingUser && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
                            <input
                                type="password"
                                {...register('password', { required: !editingUser, minLength: 6 })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                                placeholder="••••••••"
                            />
                            {errors.password && <p className="text-red-500 text-xs mt-1">Minimum 6 caractères</p>}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
                            <select {...register('role', { required: 'Champ requis' })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500">
                                <option value="agent">Agent</option>
                                <option value="manager">Manager</option>
                                <option value="admin">Administrateur</option>
                                <option value="unit_supervisor">Responsable d'Unité</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Département</label>
                            <select
                                {...register('department')}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 bg-white"
                            >
                                <option value="">Aucun</option>
                                {departmentsData?.map((dept) => (
                                    <option key={dept.id || dept.name} value={dept.name}>
                                        {dept.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-400 mt-1">Important pour les responsables d'unité</p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">Annuler</button>
                        <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-6 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 transition">
                            {createMutation.isPending || updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal Confirmation Suppression */}
            <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirmer la suppression" size="sm">
                <div className="space-y-4">
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                        <p className="text-sm text-red-800">
                            Êtes-vous sûr de vouloir supprimer cet utilisateur ?
                        </p>
                        <p className="text-sm font-semibold text-red-900 mt-2">
                            {deleteConfirm?.full_name} ({deleteConfirm?.email})
                        </p>
                        <p className="text-xs text-red-600 mt-2">
                            Cette action est irréversible.
                        </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Annuler</button>
                        <button onClick={confirmDelete} disabled={deleteMutation.isPending} className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50">
                            {deleteMutation.isPending ? 'Suppression...' : 'Confirmer la suppression'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default UsersPage