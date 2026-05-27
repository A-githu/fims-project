// src/components/ui/NotificationBell.jsx
import { useState, useEffect, useRef } from 'react'
import { Bell, BellRing, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
    getMissions,
    getPendingMissions,
    getPendingInspections,
    getInspections,
    getAvailableVehicles
} from '../../services/api'
import { useAuthStore } from '../../store/authStore'

const NotificationBell = () => {
    const [notifications, setNotifications] = useState([])
    const [isOpen, setIsOpen] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const dropdownRef = useRef(null)
    const navigate = useNavigate()
    const { user } = useAuthStore()

    const fetchNotifications = async () => {
        if (!user) return

        setLoading(true)
        try {
            const newNotifications = []
            const now = new Date()

            console.log('🔔 Fetching notifications for role:', user?.role)

            // ============================================================
            // MANAGER: Missions en attente d'attribution
            // ============================================================
            if (user?.role === 'manager') {
                try {
                    // Utiliser getPendingMissions qui retourne EN_ATTENTE_ATTRIBUTION et NOUVEAU_VEHICULE_REQUIS
                    const pendingRes = await getPendingMissions()
                    let pendingMissions = pendingRes.data?.items || pendingRes.data || []

                    console.log('📋 Manager - Missions en attente trouvées:', pendingMissions.length)

                    pendingMissions.forEach(mission => {
                        const notifId = `mission_${mission.id}`
                        // Éviter les doublons
                        if (!newNotifications.some(n => n.id === notifId)) {
                            newNotifications.push({
                                id: notifId,
                                type: 'mission',
                                title: '🚗 Nouvelle demande de mission',
                                message: `${mission.destination} - par ${mission.agent?.full_name || 'Agent'}`,
                                read: false,
                                created_at: mission.created_at,
                                actionUrl: '/manager/missions',
                                actionLabel: 'Attribuer un véhicule'
                            })
                        }
                    })
                } catch (e) {
                    console.error('Erreur getPendingMissions:', e)
                    // Fallback: récupérer toutes les missions et filtrer
                    try {
                        const missionsRes = await getMissions()
                        const allMissions = missionsRes.data?.items || missionsRes.data || []
                        const pendingMissions = allMissions.filter(m =>
                            m.status === 'EN_ATTENTE_ATTRIBUTION' || m.status === 'NOUVEAU_VEHICULE_REQUIS'
                        )
                        pendingMissions.forEach(mission => {
                            newNotifications.push({
                                id: `mission_${mission.id}`,
                                type: 'mission',
                                title: '🚗 Nouvelle demande de mission',
                                message: `${mission.destination} - par ${mission.agent?.full_name || 'Agent'}`,
                                read: false,
                                created_at: mission.created_at,
                                actionUrl: '/manager/missions',
                                actionLabel: 'Attribuer un véhicule'
                            })
                        })
                    } catch (e2) {
                        console.error('Fallback aussi en erreur:', e2)
                    }
                }
            }

            // ============================================================
            // MANAGER: Inspections à valider
            // ============================================================
            if (user?.role === 'manager') {
                try {
                    const pendingInspectionsRes = await getPendingInspections()
                    let pendingInspections = pendingInspectionsRes.data?.items || pendingInspectionsRes.data || []

                    console.log('📋 Manager - Inspections à valider:', pendingInspections.length)

                    pendingInspections.forEach(insp => {
                        const notifId = `inspection_${insp.id}`
                        if (!newNotifications.some(n => n.id === notifId)) {
                            newNotifications.push({
                                id: notifId,
                                type: 'inspection',
                                title: '📋 Inspection à valider',
                                message: `Véhicule ${insp.vehicle?.plate_number || 'N/A'} - ${insp.agent?.full_name || 'Agent'}`,
                                read: false,
                                created_at: insp.submitted_at,
                                actionUrl: '/manager/inspections',
                                actionLabel: 'Valider l\'inspection'
                            })
                        }
                    })
                } catch (e) {
                    console.error('Erreur getPendingInspections:', e)
                }
            }

            // ============================================================
            // AGENT: Véhicule attribué (Manager a attribué)
            // ============================================================
            if (user?.role === 'agent') {
                try {
                    const userMissionsRes = await getMissions()
                    let userMissions = userMissionsRes.data?.items || userMissionsRes.data || []

                    // Filtrer les missions avec véhicule attribué
                    const assignedMissions = userMissions.filter(m =>
                        m.status === 'VEHICULE_ATTRIBUE' && m.vehicle_id
                    )

                    console.log('📋 Agent - Missions avec véhicule attribué:', assignedMissions.length)

                    assignedMissions.forEach(mission => {
                        const notifId = `assigned_${mission.id}`
                        if (!newNotifications.some(n => n.id === notifId)) {
                            const isSupervisor = mission.destination?.includes('Superviseur')
                            newNotifications.push({
                                id: notifId,
                                type: isSupervisor ? 'supervisor_assignment' : 'assignment',
                                title: isSupervisor ? '⚠️ Inspection requise (Superviseur)' : '✅ Véhicule attribué',
                                message: `Véhicule ${mission.vehicle?.plate_number || 'N/A'} pour ${mission.destination}`,
                                read: false,
                                created_at: mission.updated_at || mission.created_at,
                                actionUrl: `/agent/inspections/new?mission=${mission.id}`,
                                actionLabel: 'Démarrer l\'inspection'
                            })
                        }
                    })
                } catch (e) {
                    console.error('Erreur récupération missions agent:', e)
                }
            }

            // ============================================================
            // AGENT: Inspection validée par le manager
            // ============================================================
            if (user?.role === 'agent') {
                try {
                    const allInspectionsRes = await getInspections()
                    let allInspections = allInspectionsRes.data?.items || allInspectionsRes.data || []

                    // Inspections approuvées
                    const approvedInspections = allInspections.filter(insp =>
                        insp.manager_decision === 'approved'
                    )

                    console.log('📋 Agent - Inspections approuvées:', approvedInspections.length)

                    approvedInspections.forEach(insp => {
                        const notifId = `approved_${insp.id}`
                        if (!newNotifications.some(n => n.id === notifId)) {
                            newNotifications.push({
                                id: notifId,
                                type: 'approved',
                                title: '✅ Inspection validée',
                                message: `Votre inspection a été validée par le manager. Vous pouvez maintenant terminer la mission.`,
                                read: false,
                                created_at: insp.decided_at || insp.submitted_at,
                                actionUrl: '/agent/missions',
                                actionLabel: 'Voir mes missions'
                            })
                        }
                    })

                    // Inspections rejetées
                    const rejectedInspections = allInspections.filter(insp =>
                        insp.manager_decision === 'rejected'
                    )

                    rejectedInspections.forEach(insp => {
                        const notifId = `rejected_${insp.id}`
                        if (!newNotifications.some(n => n.id === notifId)) {
                            newNotifications.push({
                                id: notifId,
                                type: 'rejected',
                                title: '❌ Inspection rejetée',
                                message: `Votre inspection a été rejetée: ${insp.manager_comment?.substring(0, 60) || 'Nouveau véhicule requis'}`,
                                read: false,
                                created_at: insp.decided_at || insp.submitted_at,
                                actionUrl: '/agent/missions',
                                actionLabel: 'Voir les détails'
                            })
                        }
                    })
                } catch (e) {
                    console.error('Erreur récupération inspections agent:', e)
                }
            }

            // Trier par date (plus récent en premier)
            newNotifications.sort((a, b) => {
                const dateA = new Date(a.created_at)
                const dateB = new Date(b.created_at)
                return dateB - dateA
            })

            const limitedNotifications = newNotifications.slice(0, 20)

            // Récupérer les IDs déjà lus
            const readIds = JSON.parse(localStorage.getItem('notification_read_ids') || '[]')
            const notificationsWithRead = limitedNotifications.map(n => ({
                ...n,
                read: readIds.includes(n.id)
            }))

            setNotifications(notificationsWithRead)
            setUnreadCount(notificationsWithRead.filter(n => !n.read).length)

            console.log('🔔 Total notifications:', notificationsWithRead.length, 'Non lues:', notificationsWithRead.filter(n => !n.read).length)

        } catch (error) {
            console.error('Erreur chargement notifications:', error)
        } finally {
            setLoading(false)
        }
    }

    // Rafraîchir toutes les 5 secondes
    useEffect(() => {
        if (user) {
            fetchNotifications()
            const interval = setInterval(fetchNotifications, 5000)
            return () => clearInterval(interval)
        }
    }, [user?.role, user?.id])

    // Fermer le dropdown au clic en dehors
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const markAsRead = (notificationId) => {
        const readIds = JSON.parse(localStorage.getItem('notification_read_ids') || '[]')
        if (!readIds.includes(notificationId)) {
            readIds.push(notificationId)
            localStorage.setItem('notification_read_ids', JSON.stringify(readIds))
        }
        setNotifications(prev => prev.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
        ))
        setUnreadCount(prev => Math.max(0, prev - 1))
    }

    const markAllAsRead = () => {
        const allIds = notifications.map(n => n.id)
        localStorage.setItem('notification_read_ids', JSON.stringify(allIds))
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
        toast.success('Toutes les notifications ont été marquées comme lues')
    }

    const handleNotificationClick = (notif) => {
        if (!notif.read) {
            markAsRead(notif.id)
        }
        setIsOpen(false)
        if (notif.actionUrl) {
            navigate(notif.actionUrl)
        }
    }

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'mission': return '🚗'
            case 'inspection': return '📋'
            case 'assignment': return '✅'
            case 'supervisor_assignment': return '⚠️'
            case 'approved': return '✅'
            case 'rejected': return '❌'
            default: return '📢'
        }
    }

    const getTimeAgo = (dateStr) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now - date
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'À l\'instant'
        if (diffMins < 60) return `Il y a ${diffMins} min`
        if (diffHours < 24) return `Il y a ${diffHours} h`
        return `Il y a ${diffDays} j`
    }

    if (!user) return null

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
                {unreadCount > 0 ? (
                    <BellRing className="w-5 h-5 text-green-500" />
                ) : (
                    <Bell className="w-5 h-5 text-gray-500" />
                )}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                            <button onClick={markAllAsRead} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                                <CheckCheck className="w-3 h-3" /> Tout marquer lu
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {loading && notifications.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="animate-spin w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                <p className="text-xs text-gray-400">Chargement...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Aucune notification</p>
                            </div>
                        ) : (
                            notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 ${!notif.read ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="text-2xl">{getNotificationIcon(notif.type)}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${!notif.read ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{notif.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-xs text-gray-400">{getTimeAgo(notif.created_at)}</span>
                                            {notif.actionLabel && <span className="text-xs text-green-600 font-medium">{notif.actionLabel} →</span>}
                                        </div>
                                    </div>
                                    {!notif.read && <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default NotificationBell