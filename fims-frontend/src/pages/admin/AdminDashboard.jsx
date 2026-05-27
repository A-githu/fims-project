// src/pages/admin/AdminDashboard.jsx
import { useQuery } from '@tanstack/react-query'
import { getDashboardStats, getUsers } from '../../services/api'
import {
    Users, Car, ClipboardList, Wrench, TrendingUp, AlertTriangle,
    Shield, Clock, CheckCircle, XCircle, Activity, Calendar,
    Gauge, BarChart3, PieChart as PieChartIcon, FileText,
    Truck, UserCheck, UserX, Settings, Zap, Bell, Award
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts'
import { format } from 'date-fns'
import fr from 'date-fns/locale/fr'
import Spinner from '../../components/ui/Spinner'

/* ── Carte KPI améliorée ── */
const KpiCard = ({ icon: Icon, label, value, trend, trendLabel, color = '#84cc16', bg = '#f7fee7' }) => {
    return (
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all duration-200">
            <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg }}>
                    <Icon size={22} style={{ color: color }} />
                </div>
                {trend && (
                    <div className="flex items-center gap-1">
                        <TrendingUp size={14} className={trend > 0 ? 'text-green-500' : 'text-red-500'} />
                        <span className={`text-xs font-semibold ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {trend > 0 ? `+${trend}` : trend}%
                        </span>
                        {trendLabel && <span className="text-xs text-gray-400">{trendLabel}</span>}
                    </div>
                )}
            </div>
            <p className="text-3xl font-bold text-gray-900 mt-4">{value ?? '—'}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
        </div>
    )
}

/* ── Carte de statistique simple ── */
const StatCard = ({ label, value, icon: Icon, color, bg }) => (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg }}>
                <Icon size={18} style={{ color }} />
            </div>
        </div>
    </div>
)

/* ── Tooltip personnalisé ── */
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
            <p className="text-sm font-semibold text-gray-700">{label || payload[0].name}</p>
            <p className="text-2xl font-bold" style={{ color: payload[0].color || payload[0].fill || '#84cc16' }}>
                {payload[0].value}
            </p>
            <p className="text-xs text-gray-400 mt-1">Total</p>
        </div>
    )
}

const AdminDashboard = () => {
    const { data: dashboard, isLoading: sl } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: () => getDashboardStats().then(r => r.data),
    })

    const { data: users, isLoading: ul } = useQuery({
        queryKey: ['users'],
        queryFn: () => getUsers().then(r => r.data),
    })

    if (sl || ul) return <Spinner />

    const userList = users?.items || users || []
    const parc = dashboard?.parc_vehicules || {}
    const missions = dashboard?.missions || {}
    const inspections = dashboard?.inspections || {}
    const maintenance = dashboard?.maintenance || {}
    const alertes = dashboard?.alertes || {}

    // Statistiques utilisateurs
    const agentsCount = userList.filter(u => u.role === 'agent').length
    const managersCount = userList.filter(u => u.role === 'manager').length
    const adminsCount = userList.filter(u => u.role === 'admin').length
    const unitSupervisorsCount = userList.filter(u => u.role === 'unit_supervisor').length  // ✅ AJOUT
    const activeUsers = userList.filter(u => u.is_active !== false).length

    // Répartition des utilisateurs par rôle
    const userRoleData = [
        { name: 'Agents', value: agentsCount, color: '#84cc16', icon: '👤' },
        { name: 'Managers', value: managersCount, color: '#3b82f6', icon: '👔' },
        { name: 'Admins', value: adminsCount, color: '#f59e0b', icon: '⚙️' },
        { name: 'Responsables', value: unitSupervisorsCount, color: '#a855f7', icon: '👁️' },  // ✅ AJOUT
    ].filter(r => r.value > 0)

    // État du parc véhicules
    const vehicleStatusData = [
        { name: 'Actifs', value: parc.actifs || 0, color: '#84cc16', bg: '#f7fee7' },
        { name: 'En mission', value: parc.en_mission || 0, color: '#3b82f6', bg: '#eff6ff' },
        { name: 'Maintenance', value: parc.en_maintenance || 0, color: '#f59e0b', bg: '#fffbeb' },
        { name: 'Bloqués', value: parc.bloques || 0, color: '#ef4444', bg: '#fef2f2' },
        { name: 'Hors service', value: parc.hors_service || 0, color: '#6b7280', bg: '#f3f4f6' },
    ]

    // Statut des missions
    const missionStatusData = [
        { name: 'En attente', value: missions.en_attente_attribution || 0, color: '#3b82f6', icon: '⏳' },
        { name: 'Véhicule attribué', value: missions.vehicule_attribue || 0, color: '#f59e0b', icon: '🚗' },
        { name: 'Inspection soumise', value: missions.inspection_soumise || 0, color: '#8b5cf6', icon: '📋' },
        { name: 'Approuvées', value: missions.approuvees || 0, color: '#84cc16', icon: '✅' },
        { name: 'Terminées', value: missions.terminees || 0, color: '#10b981', icon: '🏁' },
        { name: 'Rejetées', value: missions.rejetees || 0, color: '#ef4444', icon: '❌' },
    ]

    // Conclusion des inspections
    const inspectionConclusionsData = [
        { name: 'Aptes', value: inspections.conclusions?.aptes || 0, color: '#84cc16', bg: '#f7fee7' },
        { name: 'Avec réserves', value: inspections.conclusions?.avec_reserves || 0, color: '#f59e0b', bg: '#fffbeb' },
        { name: 'Inaptes', value: inspections.conclusions?.inaptes || 0, color: '#ef4444', bg: '#fef2f2' },
    ]

    // Statistiques des décisions manager
    const managerDecisionsData = [
        { name: 'Approuvées', value: inspections.approuvees || 0, color: '#84cc16' },
        { name: 'Rejetées', value: inspections.rejetees || 0, color: '#ef4444' },
        { name: 'En attente', value: inspections.en_attente_decision_manager || 0, color: '#f59e0b' },
    ]

    // Construction des alertes
    const criticalAlerts = []
    const warningAlerts = []

    if ((alertes.vehicules_bloques || 0) > 0) {
        criticalAlerts.push({ message: `${alertes.vehicules_bloques} véhicule(s) bloqué(s)`, action: 'Vérifier le parc' })
    }
    if ((alertes.missions_bloquees_sans_vehicule || 0) > 0) {
        criticalAlerts.push({ message: `${alertes.missions_bloquees_sans_vehicule} mission(s) bloquées sans véhicule`, action: 'Attribuer un véhicule' })
    }
    if ((alertes.inspections_sans_decision || 0) > 0) {
        warningAlerts.push({ message: `${alertes.inspections_sans_decision} inspection(s) en attente de décision`, action: 'Valider les inspections' })
    }
    if ((alertes.taches_maintenance_urgentes || 0) > 0) {
        warningAlerts.push({ message: `${alertes.taches_maintenance_urgentes} tâche(s) de maintenance urgentes`, action: 'Planifier la maintenance' })
    }

    // Calculs de tendances
    const totalVehicles = parc.total || 0
    const availableVehicles = parc.actifs || 0
    const availabilityRate = totalVehicles > 0 ? ((availableVehicles / totalVehicles) * 100).toFixed(1) : 0
    const totalInspections = (inspections.approuvees || 0) + (inspections.rejetees || 0) + (inspections.en_attente_decision_manager || 0)

    return (
        <div className="space-y-6">
            {/* Header avec date et bienvenue */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-2 text-sm text-green-600 mb-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="font-mono text-xs uppercase tracking-wide">Administration</span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Tableau de bord Administrateur</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })} — Vue globale du système
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg">
                    <Activity className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700">Système opérationnel</span>
                </div>
            </div>

            {/* 5 KPI principaux */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <KpiCard
                    icon={Users}
                    label="Utilisateurs actifs"
                    value={activeUsers}
                    color="#3b82f6"
                    bg="#eff6ff"
                />
                <KpiCard
                    icon={Car}
                    label="Véhicules en parc"
                    value={totalVehicles}
                    trend={5}
                    trendLabel="vs mois dernier"
                    color="#84cc16"
                    bg="#f7fee7"
                />
                <KpiCard
                    icon={ClipboardList}
                    label="Inspections totales"
                    value={totalInspections}
                    color="#8b5cf6"
                    bg="#f5f3ff"
                />
                <KpiCard
                    icon={Wrench}
                    label="Maintenances actives"
                    value={(maintenance.en_attente || 0) + (maintenance.en_cours || 0)}
                    color="#f59e0b"
                    bg="#fffbeb"
                />
                <KpiCard
                    icon={Gauge}
                    label="Taux disponibilité"
                    value={`${availabilityRate}%`}
                    trend={availabilityRate > 70 ? 8 : -3}
                    trendLabel="vs objectif"
                    color="#10b981"
                    bg="#ecfdf5"
                />
            </div>

            {/* Section stats rapides */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="Taux conformité"
                    value={parc.taux_disponibilite || '0%'}
                    icon={Award}
                    color="#84cc16"
                    bg="#f7fee7"
                />
                <StatCard
                    label="Missions en attente"
                    value={missions.en_attente_attribution || 0}
                    icon={Clock}
                    color="#f59e0b"
                    bg="#fffbeb"
                />
                <StatCard
                    label="Inspections approuvées"
                    value={inspections.approuvees || 0}
                    icon={CheckCircle}
                    color="#84cc16"
                    bg="#f7fee7"
                />
                <StatCard
                    label="Véhicules inaptes"
                    value={inspections.conclusions?.inaptes || 0}
                    icon={XCircle}
                    color="#ef4444"
                    bg="#fef2f2"
                />
            </div>

            {/* Graphiques principaux - rangée 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* État du parc - Pie Chart */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                            <Truck className="w-5 h-5 text-green-600" />
                            État du parc véhicules
                        </h3>
                        <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                            Total: {totalVehicles} véhicules
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <Pie
                                data={vehicleStatusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={90}
                                dataKey="value"
                                label={({ name, percent }) => percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                                labelLine={false}
                            >
                                {vehicleStatusData.map((entry, idx) => (
                                    <Cell key={idx} fill={entry.color} stroke="#fff" strokeWidth={2} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                formatter={(value, entry, index) => (
                                    <span className="text-xs text-gray-600">{value}</span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Répartition des utilisateurs */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            Répartition des utilisateurs
                        </h3>
                        <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                            Total: {userList.length} utilisateurs
                        </div>
                    </div>
                    {userRoleData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={userRoleData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={90}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {userRoleData.map((entry, idx) => (
                                        <Cell key={idx} fill={entry.color} stroke="#fff" strokeWidth={2} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Aucun utilisateur</p>
                            </div>
                        </div>
                    )}

                    {/* Stats utilisateurs supplémentaires */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
                        <div className="text-center">
                            <p className="text-xs text-gray-400">Agents</p>
                            <p className="text-lg font-bold text-green-600">{agentsCount}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-400">Managers</p>
                            <p className="text-lg font-bold text-blue-600">{managersCount}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-400">Admins</p>
                            <p className="text-lg font-bold text-amber-600">{adminsCount}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-400">Responsables</p>
                            <p className="text-lg font-bold text-purple-600">{unitSupervisorsCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Graphiques principaux - rangée 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Statut des missions */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-purple-600" />
                            Statut des missions
                        </h3>
                        <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                            Total: {(missions.en_attente_attribution || 0) + (missions.vehicule_attribue || 0) + (missions.inspection_soumise || 0) + (missions.terminees || 0) + (missions.rejetees || 0)} missions
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={missionStatusData} layout="vertical" margin={{ left: 100, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                            <XAxis type="number" stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} />
                            <YAxis
                                type="category"
                                dataKey="name"
                                stroke="#94a3b8"
                                fontSize={11}
                                axisLine={false}
                                tickLine={false}
                                width={100}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                                {missionStatusData.map((entry, idx) => (
                                    <Cell key={idx} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Conclusion des inspections */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-orange-600" />
                            Résultats des inspections
                        </h3>
                        <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                            Total: {(inspections.conclusions?.aptes || 0) + (inspections.conclusions?.avec_reserves || 0) + (inspections.conclusions?.inaptes || 0)} inspections
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        {inspectionConclusionsData.map((item, idx) => (
                            <div key={idx} className="text-center p-3 rounded-lg" style={{ backgroundColor: item.bg }}>
                                <p className="text-2xl font-bold" style={{ color: item.color }}>{item.value}</p>
                                <p className="text-xs text-gray-600 mt-1">{item.name}</p>
                            </div>
                        ))}
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={inspectionConclusionsData} layout="vertical" margin={{ left: 80 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                            <XAxis type="number" stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} axisLine={false} tickLine={false} width={80} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                                {inspectionConclusionsData.map((entry, idx) => (
                                    <Cell key={idx} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Section Décisions Manager et Maintenance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Décisions Manager */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-green-600" />
                        Décisions Manager
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <span className="text-sm font-medium text-gray-700">Inspections approuvées</span>
                            </div>
                            <span className="text-2xl font-bold text-green-600">{inspections.approuvees || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <XCircle className="w-5 h-5 text-red-600" />
                                <span className="text-sm font-medium text-gray-700">Inspections rejetées</span>
                            </div>
                            <span className="text-2xl font-bold text-red-600">{inspections.rejetees || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-amber-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-amber-600" />
                                <span className="text-sm font-medium text-gray-700">En attente de décision</span>
                            </div>
                            <span className="text-2xl font-bold text-amber-600">{inspections.en_attente_decision_manager || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Maintenance */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-blue-600" />
                        Suivi Maintenance
                    </h3>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="text-center p-3 rounded-lg bg-amber-50">
                            <p className="text-2xl font-bold text-amber-600">{maintenance.en_attente || 0}</p>
                            <p className="text-xs text-gray-600 mt-1">En attente</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-blue-50">
                            <p className="text-2xl font-bold text-blue-600">{maintenance.en_cours || 0}</p>
                            <p className="text-xs text-gray-600 mt-1">En cours</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-green-50">
                            <p className="text-2xl font-bold text-green-600">{maintenance.terminees || 0}</p>
                            <p className="text-xs text-gray-600 mt-1">Terminées</p>
                        </div>
                    </div>
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Tâches actives</span>
                            <span className="text-lg font-bold text-gray-900">
                                {(maintenance.en_attente || 0) + (maintenance.en_cours || 0)}
                            </span>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${((maintenance.en_cours || 0) / ((maintenance.en_attente || 0) + (maintenance.en_cours || 0) || 1)) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Alertes système */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                            <Bell className="w-5 h-5 text-amber-500" />
                            Centre d'alertes
                        </h3>
                        {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
                            <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                                {criticalAlerts.length + warningAlerts.length} alerte(s)
                            </span>
                        )}
                    </div>
                </div>
                <div className="p-6">
                    {criticalAlerts.length > 0 && (
                        <div className="mb-4">
                            <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Critiques
                            </p>
                            <div className="space-y-2">
                                {criticalAlerts.map((alert, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                                        <div className="flex items-center gap-3">
                                            <AlertTriangle className="w-4 h-4 text-red-500" />
                                            <span className="text-sm text-red-700">{alert.message}</span>
                                        </div>
                                        <button className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-full transition">
                                            {alert.action}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {warningAlerts.length > 0 && (
                        <div>
                            <p className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Attention
                            </p>
                            <div className="space-y-2">
                                {warningAlerts.map((alert, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                                        <div className="flex items-center gap-3">
                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                            <span className="text-sm text-amber-700">{alert.message}</span>
                                        </div>
                                        <button className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1 rounded-full transition">
                                            {alert.action}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {criticalAlerts.length === 0 && warningAlerts.length === 0 && (
                        <div className="text-center py-8">
                            <Shield className="w-12 h-12 text-green-400 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">Aucune alerte système</p>
                            <p className="text-xs text-gray-400 mt-1">Tous les indicateurs sont au vert</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default AdminDashboard