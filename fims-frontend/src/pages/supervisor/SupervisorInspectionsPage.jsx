// src/pages/supervisor/SupervisorInspectionsPage.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { Search, Filter, Download, Eye, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle, Clock, Calendar, User, Car } from 'lucide-react'
import api from '../../services/api'
import Spinner from '../../components/ui/Spinner'
import PageHeader from '../../components/ui/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { formatDate, formatDateTime } from '../../utils/helpers'
import toast from 'react-hot-toast'

const INSPECTION_SECTIONS = [
    { title: "À l'extérieur du véhicule", items: ["pneumatiques", "eclairages", "retroviseurs", "carrosserie"] },
    { title: "À l'intérieur du véhicule", items: ["ceintures", "commande_retroviseurs", "commande_essuie_glaces", "volant", "eclairage_interne", "klaxon", "tableau_bord", "fonctionnement_freins", "demarrage", "confort"] },
    { title: "Sous le capot", items: ["niveau_huile", "batterie", "etat_moteur", "liquide_refroidissement"] },
    { title: "Kit Conducteur", items: ["triangle_presignalisation", "gilet_reflechissant", "EXTINCTEUR", "cric_cle_roue", "roue_secours"] }
]

const SupervisorInspectionsPage = () => {
    const { user } = useAuthStore()
    const [searchTerm, setSearchTerm] = useState('')
    const [conclusionFilter, setConclusionFilter] = useState('all')
    const [decisionFilter, setDecisionFilter] = useState('all')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [selectedVehicleId, setSelectedVehicleId] = useState('')
    const [expandedId, setExpandedId] = useState(null)
    const [detailData, setDetailData] = useState({})

    const { data: vehicles } = useQuery({
        queryKey: ['supervisor-vehicles-list'],
        queryFn: () => api.get('/api/supervisor/vehicles').then(r => r.data?.items || r.data || []),
        staleTime: 60000,
    })

    const { data: inspections, isLoading } = useQuery({
        queryKey: ['supervisor-inspections', conclusionFilter, decisionFilter, fromDate, toDate, selectedVehicleId, searchTerm],
        queryFn: () => api.get('/api/supervisor/inspections', { params: { conclusion: conclusionFilter !== 'all' ? conclusionFilter : undefined, decision: decisionFilter !== 'all' ? decisionFilter : undefined, from_date: fromDate || undefined, to_date: toDate || undefined, vehicle_id: selectedVehicleId || undefined, search: searchTerm || undefined, limit: 100 } }).then(r => r.data?.items || r.data || []),
        staleTime: 60000,
    })

    const handleDownloadPDF = async (inspectionId, plate) => {
        try {
            toast.loading('Génération du PDF...', { id: 'pdf-loading' })
            const token = localStorage.getItem('fims_token')
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
            const response = await fetch(`${API_URL}/api/inspections/${inspectionId}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
            if (!response.ok) throw new Error()
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `ENEO_Checkup_${plate}_${inspectionId}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
            toast.success('Fiche PDF téléchargée ✓', { id: 'pdf-loading' })
        } catch { toast.error('Erreur lors du téléchargement', { id: 'pdf-loading' }) }
    }

    const handleExpand = async (insp) => {
        if (expandedId === insp.id) { setExpandedId(null); return }
        setExpandedId(insp.id)
        if (!detailData[insp.id]) {
            const res = await api.get(`/api/inspections/${insp.id}`)
            setDetailData(prev => ({ ...prev, [insp.id]: res.data }))
        }
    }

    const getConclusionBadge = (conclusion) => {
        const map = { 'fit': { label: '✓ Conforme', color: 'bg-green-100 text-green-700' }, 'warning': { label: '⚠ Avec réserves', color: 'bg-amber-100 text-amber-700' }, 'unfit': { label: '✗ Inapte', color: 'bg-red-100 text-red-700' } }
        const m = map[conclusion] || { label: conclusion, color: 'bg-gray-100 text-gray-700' }
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.color}`}>{m.label}</span>
    }

    const getDecisionBadge = (decision, managerName) => {
        const map = { 'approved': { label: `✓ Approuvé par ${managerName || 'Manager'}`, color: 'bg-green-100 text-green-700' }, 'rejected': { label: `✗ Rejeté par ${managerName || 'Manager'}`, color: 'bg-red-100 text-red-700' }, 'pending': { label: '⏳ En attente', color: 'bg-amber-100 text-amber-700' } }
        const m = map[decision] || { label: decision, color: 'bg-gray-100 text-gray-700' }
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.color}`}>{m.label}</span>
    }

    if (isLoading) return <Spinner />

    const filteredInspections = inspections?.filter(insp => {
        if (!searchTerm) return true
        const searchLower = searchTerm.toLowerCase()
        return insp.vehicle_plate?.toLowerCase().includes(searchLower) || insp.agent_name?.toLowerCase().includes(searchLower) || insp.manager_name?.toLowerCase().includes(searchLower)
    }) || []

    return (
        <div className="space-y-6">
            <PageHeader title="Historique des Inspections" subtitle={`Toutes les inspections des véhicules de ${user?.department || 'votre unité'} · Lecture seule`} />

            {/* Filtres */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Immatriculation, agent..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" /></div>
                <div><label className="block text-xs text-gray-500 mb-1">Résultat</label><select value={conclusionFilter} onChange={(e) => setConclusionFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2"><option value="all">Tous</option><option value="fit">✓ Conformes</option><option value="warning">⚠ Avec réserves</option><option value="unfit">✗ Inaptes</option></select></div>
                <div><label className="block text-xs text-gray-500 mb-1">Décision Manager</label><select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2"><option value="all">Toutes</option><option value="approved">✓ Approuvées</option><option value="rejected">✗ Rejetées</option><option value="pending">⏳ En attente</option></select></div>
                <div><label className="block text-xs text-gray-500 mb-1">Véhicule</label><select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2"><option value="">Tous</option>{vehicles?.map(v => (<option key={v.id} value={v.id}>{v.plate_number} — {v.brand} {v.model}</option>))}</select></div>
                <div className="flex gap-2"><div className="flex-1"><label className="block text-xs text-gray-500 mb-1">Du</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div><div className="flex-1"><label className="block text-xs text-gray-500 mb-1">Au</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" /></div></div>
            </div>

            {/* Tableau des inspections */}
            {filteredInspections.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center"><Search className="w-16 h-16 text-gray-300 mx-auto mb-4" /><EmptyState title="Aucune inspection" description="Aucune inspection ne correspond à vos critères" /></div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full"><thead><tr className="bg-gray-50 border-b border-gray-200"><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Véhicule</th><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent</th><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Manager</th><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Résultat</th><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Décision</th><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Km</th><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th><th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th></tr></thead>
                            <tbody>{filteredInspections.map(insp => (<tr key={insp.id} className="border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer" onClick={() => handleExpand(insp)}><td className="px-5 py-3 font-mono text-sm font-medium text-gray-900">{insp.vehicle_plate}</td><td className="px-5 py-3 text-sm text-gray-600">{insp.agent_name}</td><td className="px-5 py-3 text-sm text-gray-600">{insp.manager_name || '—'}</td><td className="px-5 py-3">{getConclusionBadge(insp.agent_conclusion)}</td><td className="px-5 py-3">{getDecisionBadge(insp.manager_decision, insp.manager_name)}</td><td className="px-5 py-3 text-sm text-gray-600">{insp.mileage_at_inspection?.toLocaleString()} km</td><td className="px-5 py-3 text-sm text-gray-500">{formatDate(insp.submitted_at)}</td><td className="px-5 py-3"><button onClick={(e) => { e.stopPropagation(); handleDownloadPDF(insp.id, insp.vehicle_plate) }} className="text-green-600 hover:text-green-700"><Download className="w-4 h-4" /></button></td></tr>))}</tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Détail expandable */}
            {expandedId && detailData[expandedId] && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center"><h3 className="font-semibold text-gray-900 flex items-center gap-2"><Car className="w-5 h-5 text-purple-600" /> Détail de l'inspection · {detailData[expandedId].vehicle?.plate_number} · {formatDate(detailData[expandedId].submitted_at)}</h3><button onClick={() => handleDownloadPDF(expandedId, detailData[expandedId].vehicle?.plate_number)} className="text-green-600 hover:text-green-700 flex items-center gap-1"><Download className="w-4 h-4" /> PDF</button></div>
                    <div className="p-5 space-y-5">
                        {INSPECTION_SECTIONS.map(section => {
                            const sectionItems = section.items.filter(key => detailData[expandedId].inspection_data?.[key])
                            if (sectionItems.length === 0) return null
                            return (<div key={section.title}><h4 className="font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-200">{section.title}</h4><div className="space-y-2">{sectionItems.map(key => { const item = detailData[expandedId].inspection_data?.[key]; const status = item?.status || 'conforme'; const comment = item?.comment || ''; const statusConfig = { conforme: { icon: '✓', label: 'Conforme', class: 'text-green-600' }, surveiller: { icon: '⚠', label: 'À surveiller', class: 'text-amber-600' }, non_conforme: { icon: '✗', label: 'Non conforme', class: 'text-red-600' } }[status]; return (<div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg"><span className="text-sm text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span><div className="flex items-center gap-3"><span className={`text-sm font-medium ${statusConfig.class}`}>{statusConfig.icon} {statusConfig.label}</span>{comment && <span className="text-xs text-gray-400 italic">"{comment}"</span>}</div></div>) })}</div></div>)
                        })}
                        {detailData[expandedId].observations && (<div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg"><p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Observations de l'agent</p><p className="text-sm text-gray-700 mt-1 italic">{detailData[expandedId].observations}</p></div>)}
                        {detailData[expandedId].manager_comment && (<div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded-r-lg"><p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Commentaire du Manager</p><p className="text-sm text-gray-700 mt-1 italic">{detailData[expandedId].manager_comment}</p></div>)}
                        <div className="flex justify-between items-center pt-3 border-t border-gray-200"><div><p className="text-xs text-gray-500">Conclusion agent: <strong>{detailData[expandedId].agent_conclusion === 'fit' ? 'Apte' : detailData[expandedId].agent_conclusion === 'warning' ? 'Avec réserves' : 'Inapte'}</strong></p></div><div><p className="text-xs text-gray-500">Décision Manager: <strong>{detailData[expandedId].manager_decision === 'approved' ? 'Approuvée' : detailData[expandedId].manager_decision === 'rejected' ? 'Rejetée' : 'En attente'}</strong> {detailData[expandedId].decided_at && `le ${formatDateTime(detailData[expandedId].decided_at)}`}</p></div></div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default SupervisorInspectionsPage