// src/pages/agent/NewInspectionPage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getMission, createInspection } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import {
    CheckCircle, AlertTriangle, XCircle, Download, ChevronLeft,
    Car, MapPin, Calendar, User, FileText, PenLine, Trash2, Plus, Minus, ZoomIn
} from 'lucide-react'
import Spinner from '../../components/ui/Spinner'

// Image placée dans le dossier public
const VehicleImage = './12345.png'

const TOTAL_POINTS = 23

// Configuration des parties principales du véhicule avec leurs positions (en pourcentage sur l'image)
// Ajustez les coordonnées X et Y selon votre image (entre 0 et 100)
const VEHICLE_PARTS = [
    // Pare-chocs avant
    { id: 'front_bumper', name: 'Pare-chocs avant', nameEn: 'Front bumper', x: 8, y: 65, area: 'Carrosserie' },
    // Phare gauche
    { id: 'left_headlight', name: 'Phare avant gauche', nameEn: 'Left headlight', x: 12, y: 52, area: 'Éclairage' },
    // Phare droit
    { id: 'right_headlight', name: 'Phare avant droit', nameEn: 'Right headlight', x: 12, y: 68, area: 'Éclairage' },
    // Capot
    { id: 'hood', name: 'Capot moteur', nameEn: 'Engine hood', x: 22, y: 48, area: 'Moteur' },
    // Pare-brise
    { id: 'windshield', name: 'Pare-brise', nameEn: 'Windshield', x: 35, y: 38, area: 'Vitrage' },
    // Toit
    { id: 'roof', name: 'Toit', nameEn: 'Roof', x: 52, y: 32, area: 'Carrosserie' },
    // Lunette arrière
    { id: 'rear_windshield', name: 'Lunette arrière', nameEn: 'Rear windshield', x: 72, y: 42, area: 'Vitrage' },
    // Coffre
    { id: 'trunk', name: 'Coffre', nameEn: 'Trunk', x: 82, y: 55, area: 'Carrosserie' },
    // Pare-chocs arrière
    { id: 'rear_bumper', name: 'Pare-chocs arrière', nameEn: 'Rear bumper', x: 92, y: 68, area: 'Carrosserie' },
    // Feu arrière gauche
    { id: 'left_taillight', name: 'Feu arrière gauche', nameEn: 'Left taillight', x: 88, y: 52, area: 'Éclairage' },
    // Feu arrière droit
    { id: 'right_taillight', name: 'Feu arrière droit', nameEn: 'Right taillight', x: 88, y: 68, area: 'Éclairage' },
    // Porte conducteur
    { id: 'driver_door', name: 'Porte conducteur', nameEn: 'Driver door', x: 45, y: 65, area: 'Carrosserie' },
    // Porte passager
    { id: 'passenger_door', name: 'Porte passager', nameEn: 'Passenger door', x: 60, y: 65, area: 'Carrosserie' },
    // Rétroviseur gauche
    { id: 'side_mirror_left', name: 'Rétroviseur gauche', nameEn: 'Left mirror', x: 28, y: 45, area: 'Rétroviseurs' },
    // Rétroviseur droit
    { id: 'side_mirror_right', name: 'Rétroviseur droit', nameEn: 'Right mirror', x: 72, y: 45, area: 'Rétroviseurs' },
    // Roue avant
    { id: 'front_wheel', name: 'Roue avant', nameEn: 'Front wheel', x: 28, y: 82, area: 'Pneumatiques' },
    // Roue arrière
    { id: 'rear_wheel', name: 'Roue arrière', nameEn: 'Rear wheel', x: 72, y: 82, area: 'Pneumatiques' },
    // Aile avant
    { id: 'front_fender', name: 'Aile avant', nameEn: 'Front fender', x: 18, y: 58, area: 'Carrosserie' },
    // Aile arrière
    { id: 'rear_fender', name: 'Aile arrière', nameEn: 'Rear fender', x: 82, y: 62, area: 'Carrosserie' },
    // Vitre avant
    { id: 'front_window', name: 'Vitre avant', nameEn: 'Front window', x: 38, y: 52, area: 'Vitrage' },
    // Vitre arrière
    { id: 'rear_window', name: 'Vitre arrière', nameEn: 'Rear window', x: 65, y: 52, area: 'Vitrage' },
    // Calandre
    { id: 'grille', name: 'Calandre', nameEn: 'Grille', x: 10, y: 60, area: 'Carrosserie' },
]

const INSPECTION_SECTIONS = [
    {
        title: "À l'extérieur du véhicule",
        titleEn: "Outside the vehicle",
        headerBg: "bg-green-50 border-green-200 text-green-800",
        items: [
            { key: "pneumatiques", label: "Pneumatiques", labelEn: "Tyre condition and pressure" },
            { key: "eclairages", label: "Éclairages (phares, feux)", labelEn: "Headlight optics and light transparency" },
            { key: "retroviseurs", label: "Rétroviseurs", labelEn: "Side mirrors" },
            { key: "carrosserie", label: "Carrosserie (chocs, rayures)", labelEn: "Vehicle chassis condition" },
        ]
    },
    {
        title: "À l'intérieur du véhicule",
        titleEn: "Inside the vehicle",
        headerBg: "bg-blue-50 border-blue-200 text-blue-800",
        items: [
            { key: "ceintures", label: "Ceintures de sécurité", labelEn: "Seatbelt" },
            { key: "commande_retroviseurs", label: "Commande des rétroviseurs", labelEn: "Side mirror control" },
            { key: "commande_essuie_glaces", label: "Commande essuie-glaces", labelEn: "Windshield wiper control" },
            { key: "volant", label: "Volant", labelEn: "Steering wheel" },
            { key: "eclairage_interne", label: "Éclairage interne", labelEn: "Internal lighting" },
            { key: "klaxon", label: "Avertisseur sonore (Klaxon)", labelEn: "Buzzer / Horn" },
            { key: "tableau_bord", label: "Tableau de bord / Voyants", labelEn: "Dashboard" },
            { key: "fonctionnement_freins", label: "Fonctionnement des freins", labelEn: "Brakes operation" },
            { key: "demarrage", label: "Démarrage", labelEn: "Startup" },
            { key: "confort", label: "Confort (tapisserie, clim, CD)", labelEn: "Comfort (upholstery, air cond., CD)" },
        ]
    },
    {
        title: "Sous le capot",
        titleEn: "Under the hood",
        headerBg: "bg-orange-50 border-orange-200 text-orange-800",
        items: [
            { key: "niveau_huile", label: "Niveau d'huile moteur", labelEn: "Engine oil level" },
            { key: "batterie", label: "État de la batterie", labelEn: "Battery status" },
            { key: "etat_moteur", label: "État général du moteur", labelEn: "Engine general condition" },
            { key: "liquide_refroidissement", label: "Liquide de refroidissement", labelEn: "Coolant level" },
        ]
    },
    {
        title: "Kit Conducteur",
        titleEn: "Driver kit",
        headerBg: "bg-purple-50 border-purple-200 text-purple-800",
        items: [
            { key: "triangle_presignalisation", label: "Triangle de présignalisation", labelEn: "Signs (triangle, safety vest)" },
            { key: "gilet_reflechissant", label: "Gilet réfléchissant", labelEn: "Reflective vest" },
            { key: "EXTINCTEUR", label: "Extincteur", labelEn: "Fire extinguisher" },
            { key: "cric_cle_roue", label: "Cric et clé de roue", labelEn: "Jack, cranks, metal block" },
            { key: "roue_secours", label: "Roue de secours", labelEn: "Spare tyre" },
        ]
    }
]

// Composant Signature Canvas
const SignatureCanvas = ({ onSign, onClear, value }) => {
    const canvasRef = useRef(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [ctx, setCtx] = useState(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (canvas) {
            const context = canvas.getContext('2d')
            context.strokeStyle = '#1a4d1a'
            context.lineWidth = 2
            context.lineCap = 'round'
            context.lineJoin = 'round'
            setCtx(context)

            if (value) {
                const img = new Image()
                img.src = value
                img.onload = () => {
                    context.drawImage(img, 0, 0, canvas.width, canvas.height)
                }
            }
        }
    }, [])

    const startDrawing = (e) => {
        setIsDrawing(true)
        const rect = canvasRef.current.getBoundingClientRect()
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0)
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0)
        const x = clientX - rect.left
        const y = clientY - rect.top
        ctx.beginPath()
        ctx.moveTo(x, y)
    }

    const draw = (e) => {
        if (!isDrawing) return
        e.preventDefault()
        const rect = canvasRef.current.getBoundingClientRect()
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0)
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0)
        const x = clientX - rect.left
        const y = clientY - rect.top
        ctx.lineTo(x, y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x, y)
    }

    const stopDrawing = () => {
        setIsDrawing(false)
        ctx.beginPath()
        const signatureData = canvasRef.current.toDataURL()
        onSign(signatureData)
    }

    const clearSignature = () => {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        ctx.beginPath()
        onSign('')
    }

    return (
        <div className="space-y-2">
            <canvas
                ref={canvasRef}
                width={500}
                height={150}
                style={{ width: '100%', height: '150px', border: '1px solid #ccc', borderRadius: '8px', cursor: 'crosshair', touchAction: 'none' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            <div className="flex gap-2">
                <button type="button" onClick={clearSignature} className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Effacer la signature
                </button>
            </div>
        </div>
    )
}

// Composant Modal
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null
    const sizeClasses = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
            <div className={`bg-white rounded-xl shadow-xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    )
}

const NewInspectionPage = () => {
    const [searchParams] = useSearchParams()
    const missionId = searchParams.get('mission')
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const queryClient = useQueryClient()
    const [submitted, setSubmitted] = useState(false)
    const [createdInspectionId, setCreatedInspectionId] = useState(null)

    const [points, setPoints] = useState({})
    const [observations, setObservations] = useState('')
    const [mileage, setMileage] = useState('')
    const [conclusion, setConclusion] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [signature, setSignature] = useState('')
    const [defectiveParts, setDefectiveParts] = useState([])
    const [selectedPart, setSelectedPart] = useState(null)
    const [partComment, setPartComment] = useState('')
    const [showPartModal, setShowPartModal] = useState(false)
    const [hoveredPart, setHoveredPart] = useState(null)

    const { data: mission, isLoading: missionLoading } = useQuery({
        queryKey: ['mission', missionId],
        queryFn: () => getMission(missionId).then(res => res.data),
        enabled: !!missionId,
    })

    useEffect(() => {
        const initialPoints = {}
        INSPECTION_SECTIONS.flatMap(s => s.items).forEach(item => {
            initialPoints[item.key] = { status: 'conforme', comment: '' }
        })
        setPoints(initialPoints)
    }, [])

    const updatePointStatus = (key, status) => {
        setPoints(prev => ({ ...prev, [key]: { ...prev[key], status } }))
    }

    const updatePointComment = (key, comment) => {
        setPoints(prev => ({ ...prev, [key]: { ...prev[key], comment } }))
    }

    const handlePartClick = (part) => {
        setSelectedPart(part)
        const existingPart = defectiveParts.find(p => p.id === part.id)
        setPartComment(existingPart?.comment || '')
        setShowPartModal(true)
    }

    const addDefectivePart = () => {
        if (!selectedPart) return

        const existingIndex = defectiveParts.findIndex(p => p.id === selectedPart.id)
        const partData = {
            id: selectedPart.id,
            name: selectedPart.name,
            nameEn: selectedPart.nameEn,
            area: selectedPart.area,
            comment: partComment,
            timestamp: new Date().toISOString()
        }

        if (existingIndex >= 0) {
            const newParts = [...defectiveParts]
            newParts[existingIndex] = partData
            setDefectiveParts(newParts)
        } else {
            setDefectiveParts([...defectiveParts, partData])
        }

        if (selectedPart.area === 'Carrosserie') {
            updatePointStatus('carrosserie', 'non_conforme')
        } else if (selectedPart.area === 'Éclairage') {
            updatePointStatus('eclairages', 'non_conforme')
        } else if (selectedPart.area === 'Moteur') {
            updatePointStatus('etat_moteur', 'non_conforme')
        } else if (selectedPart.area === 'Vitrage') {
            updatePointStatus('carrosserie', 'non_conforme')
        } else if (selectedPart.area === 'Pneumatiques') {
            updatePointStatus('pneumatiques', 'non_conforme')
        } else if (selectedPart.area === 'Rétroviseurs') {
            updatePointStatus('retroviseurs', 'non_conforme')
        }

        setShowPartModal(false)
        setPartComment('')
        setSelectedPart(null)
        toast.success(`${selectedPart.name} marqué comme défectueux`)
    }

    const removeDefectivePart = (partId) => {
        setDefectiveParts(defectiveParts.filter(p => p.id !== partId))
        toast.success('Partie retirée')
    }

    const getAutoConclusion = () => {
        const values = Object.values(points).map(v => v.status)
        if (values.includes('non_conforme')) return 'unfit'
        if (values.includes('surveiller')) return 'warning'
        if (Object.keys(points).length === TOTAL_POINTS && values.every(v => v === 'conforme')) return 'fit'
        return null
    }

    useEffect(() => {
        const auto = getAutoConclusion()
        if (auto && !conclusion) {
            setConclusion(auto)
        }
    }, [points, conclusion])

    const completedCount = Object.keys(points).length
    const canSubmit = completedCount >= TOTAL_POINTS && mileage && mileage > 0 && conclusion && signature

    const handleDownloadPDF = async (inspectionId) => {
        if (!inspectionId) return
        try {
            toast.loading('Génération du PDF...', { id: 'pdf-loading' })
            const token = localStorage.getItem('fims_token')
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
            const response = await fetch(`${API_URL}/api/inspections/${inspectionId}/pdf`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (!response.ok) {
                throw new Error('Erreur téléchargement')
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `ENEO_Checkup_${inspectionId}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
            toast.success('PDF téléchargé', { id: 'pdf-loading' })
        } catch (error) {
            console.error('Erreur PDF:', error)
            toast.error('Erreur lors du téléchargement du PDF', { id: 'pdf-loading' })
        }
    }

    const handleSubmit = async () => {
        if (!canSubmit) {
            toast.error(`Complétez l'inspection (${completedCount}/${TOTAL_POINTS} points)${!mileage ? ' · Kilométrage requis' : ''}${!signature ? ' · Signature requise' : ''}`)
            return
        }

        setSubmitting(true)
        try {
            const formattedData = {}
            Object.entries(points).forEach(([key, value]) => {
                formattedData[key] = {
                    status: value.status,
                    comment: value.comment || ''
                }
            })

            const partsObservations = defectiveParts.map(p =>
                `• ${p.name}: ${p.comment || 'Défaut constaté'}`
            ).join('\n')

            const signatureText = signature ? `\n\n--- SIGNATURE ÉLECTRONIQUE ---\nSigné par: ${user?.full_name}\nDate: ${new Date().toLocaleString('fr-FR')}\nSignature électronique validée` : ''

            const fullObservations = [observations, partsObservations, signatureText].filter(Boolean).join('\n\n')

            const payload = {
                mission_id: missionId,
                mileage_at_inspection: parseInt(mileage),
                inspection_data: formattedData,
                observations: fullObservations || null,
                agent_conclusion: conclusion,
                photos: [],
            }

            const response = await createInspection(payload)
            const inspectionId = response.data.id
            setCreatedInspectionId(inspectionId)
            setSubmitted(true)
            queryClient.invalidateQueries({ queryKey: ['missions'] })
            toast.success('Inspection soumise au Manager ✓')
        } catch (error) {
            const message = error.response?.data?.detail || 'Erreur lors de la soumission'
            toast.error(message)
        } finally {
            setSubmitting(false)
        }
    }

    if (missionLoading) return <Spinner />
    if (!mission) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <p className="text-gray-600">Mission non trouvée</p>
                    <button onClick={() => navigate('/agent/missions')} className="bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg px-4 py-2 mt-4">Retour</button>
                </div>
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 p-6">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Inspection soumise !</h2>
                    <p className="text-gray-500 mt-1">Le Manager va examiner votre rapport d'inspection.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                    <button onClick={() => handleDownloadPDF(createdInspectionId)} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600">
                        <FileText className="w-5 h-5" />
                        Télécharger la Fiche PDF ENEO
                    </button>
                    <button onClick={() => navigate('/agent/missions')} className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium">
                        ← Retour aux missions
                    </button>
                </div>
            </div>
        )
    }

    const progress = (completedCount / TOTAL_POINTS) * 100

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h1 className="text-2xl font-bold text-gray-900">FICHE D'INSPECTION ENEO</h1>
                <p className="text-sm text-gray-500 mt-1">EO FO QHSE QAC 001 FE-A</p>
            </div>

            <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Car className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs text-green-600">Véhicule</p>
                            <p className="font-mono font-bold text-gray-900">{mission.vehicle?.plate_number || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs text-green-600">Destination</p>
                            <p className="font-medium text-gray-900">{mission.destination}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs text-green-600">Agent</p>
                            <p className="font-medium text-gray-900">{user?.full_name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs text-green-600">Date mission</p>
                            <p className="font-medium text-gray-900">{new Date(mission.mission_date).toLocaleDateString('fr-FR')}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="sticky top-0 z-10 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">FICHE D'INSPECTION — {mission.vehicle?.plate_number} | {completedCount}/{TOTAL_POINTS} points</span>
                    <span className="text-sm font-medium text-green-600">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-green-50 px-4 py-3 border-b border-green-200">
                    <h2 className="text-sm font-semibold text-green-800 uppercase tracking-wider">A — INFORMATIONS GÉNÉRALES / GENERAL INFORMATIONS</h2>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><p className="text-xs text-gray-500">Date du contrôle / Check-up date</p><p className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{new Date().toLocaleString('fr-FR')}</p></div>
                    <div><p className="text-xs text-gray-500">Immatriculation / Vehicle registration</p><p className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{mission.vehicle?.plate_number || 'N/A'}</p></div>
                    <div><p className="text-xs text-gray-500">Marque / Mark</p><p className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{mission.vehicle?.brand || 'N/A'}</p></div>
                    <div><p className="text-xs text-gray-500">Modèle / Model</p><p className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{mission.vehicle?.model || 'N/A'}</p></div>
                    <div><p className="text-xs text-gray-500">Agent / Conducteur</p><p className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{user?.full_name}</p></div>
                    <div><p className="text-xs text-gray-500">Région / Region</p><p className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{mission.destination}</p></div>
                    <div><p className="text-xs text-gray-500">Unité utilisatrice / User unit</p><p className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{mission.department || '—'}</p></div>
                    <div>
                        <p className="text-xs text-gray-500">KILOMÉTRAGE * / Checkup mileage</p>
                        <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500" placeholder="Ex: 45320" />
                    </div>
                </div>
            </div>

            {/* SCHÉMA INTERACTIF AVEC IMAGE IMPORTÉE */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
                    <h2 className="text-sm font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-2">
                        <ZoomIn className="w-4 h-4" /> Schéma interactif du véhicule - Cliquez sur les boutons + pour signaler les défauts
                    </h2>
                </div>
                <div className="p-6">
                    <div className="relative">
                        {/* Image du véhicule */}
                        <img
                            src={VehicleImage}
                            alt="Schéma du véhicule"
                            className="w-full h-auto rounded-lg shadow-sm"
                            style={{ maxWidth: '100%', pointerEvents: 'none' }}
                        />

                        {/* Overlay avec les boutons + */}
                        <div className="absolute inset-0">
                            {VEHICLE_PARTS.map((part) => {
                                const isDefective = defectiveParts.some(p => p.id === part.id)
                                const showTooltip = hoveredPart === part.id

                                return (
                                    <div key={part.id}>
                                        {/* Bouton + circulaire */}
                                        <button
                                            className={`absolute transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 ${isDefective
                                                ? 'bg-red-500 hover:bg-red-600'
                                                : 'bg-green-500 hover:bg-green-600'
                                                }`}
                                            style={{
                                                left: `${part.x}%`,
                                                top: `${part.y}%`,
                                                zIndex: 10
                                            }}
                                            onClick={() => handlePartClick(part)}
                                            onMouseEnter={() => setHoveredPart(part.id)}
                                            onMouseLeave={() => setHoveredPart(null)}
                                        >
                                            <span className="text-white text-xs font-bold">
                                                {isDefective ? '✓' : '+'}
                                            </span>
                                        </button>

                                        {/* Tooltip */}
                                        {showTooltip && (
                                            <div
                                                className="absolute bg-gray-900 text-white text-xs rounded-lg py-1 px-2 whitespace-nowrap z-20 shadow-lg"
                                                style={{
                                                    left: `${part.x}%`,
                                                    top: `${part.y - 8}%`,
                                                    transform: 'translateX(-50%) translateY(-100%)'
                                                }}
                                            >
                                                <div className="font-semibold">{part.name}</div>
                                                <div className="text-gray-400 text-[10px]">{part.nameEn}</div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Légende */}
                    <div className="flex flex-wrap justify-center gap-6 mt-6">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-bold">+</div>
                            <span className="text-xs text-gray-600">Zone saine - Cliquer pour signaler un défaut</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-[10px] font-bold">✓</div>
                            <span className="text-xs text-gray-600">Défaut signalé</span>
                        </div>
                    </div>

                    {/* Liste des défauts signalés */}
                    {defectiveParts.length > 0 && (
                        <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
                            <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Défauts signalés ({defectiveParts.length})
                            </h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {defectiveParts.map(part => (
                                    <div key={part.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-red-100">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{part.name}</p>
                                            {part.comment && <p className="text-xs text-gray-500 italic mt-1">"{part.comment}"</p>}
                                        </div>
                                        <button onClick={() => removeDefectivePart(part.id)} className="text-red-500 hover:text-red-700 p-1">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal pour signaler un défaut */}
            <Modal isOpen={showPartModal} onClose={() => setShowPartModal(false)} title="Signaler un défaut" size="md">
                <div className="space-y-4">
                    {selectedPart && (
                        <>
                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                <p className="text-base font-semibold text-amber-800">{selectedPart.name}</p>
                                <p className="text-xs text-amber-600">{selectedPart.nameEn}</p>
                                <p className="text-xs text-gray-500 mt-2">Zone: {selectedPart.area}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description du défaut (optionnel)
                                </label>
                                <textarea
                                    value={partComment}
                                    onChange={(e) => setPartComment(e.target.value)}
                                    rows={3}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500"
                                    placeholder="Ex: Rayure profonde, enfoncement, fissure, corrosion, mauvais fonctionnement..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                <button onClick={() => setShowPartModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                                    Annuler
                                </button>
                                <button onClick={addDefectivePart} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Signaler ce défaut
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* Sections d'inspection */}
            {INSPECTION_SECTIONS.map((section, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className={`${section.headerBg} px-4 py-2 border-b font-semibold text-sm uppercase tracking-wider`}>
                        {section.title} / {section.titleEn}
                    </div>
                    <div>
                        {section.items.map(item => {
                            const currentStatus = points[item.key]?.status || 'conforme'
                            const statusClass = currentStatus === 'non_conforme' ? 'bg-red-50' : currentStatus === 'surveiller' ? 'bg-amber-50' : ''
                            return (
                                <div key={item.key}>
                                    <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${statusClass}`}>
                                        <div className="flex-1 min-w-0 mr-4">
                                            <p className="text-sm font-medium text-gray-800">{item.label}</p>
                                            <p className="text-xs text-gray-400 italic">{item.labelEn}</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {[
                                                { val: 'conforme', icon: '✓', label: 'OK', active: 'border-2 border-green-500 bg-green-50 text-green-700 font-semibold', inactive: 'border border-gray-300 bg-white text-gray-500 hover:bg-gray-50' },
                                                { val: 'surveiller', icon: '⚠', label: 'Surveiller', active: 'border-2 border-amber-500 bg-amber-50 text-amber-700 font-semibold', inactive: 'border border-gray-300 bg-white text-gray-500 hover:bg-gray-50' },
                                                { val: 'non_conforme', icon: '✗', label: 'Non conforme', active: 'border-2 border-red-500 bg-red-50 text-red-700 font-semibold', inactive: 'border border-gray-300 bg-white text-gray-500 hover:bg-gray-50' },
                                            ].map(opt => (
                                                <button key={opt.val} type="button" onClick={() => updatePointStatus(item.key, opt.val)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all ${currentStatus === opt.val ? opt.active : opt.inactive}`}>
                                                    <span>{opt.icon}</span>
                                                    <span className="hidden sm:inline">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {(currentStatus === 'non_conforme' || currentStatus === 'surveiller') && (
                                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                                            <input type="text" placeholder="Précisez l'anomalie..." maxLength={200} value={points[item.key]?.comment || ''} onChange={(e) => updatePointComment(item.key, e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-amber-400" />
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}

            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
                <h3 className="font-semibold text-gray-900">C — OBSERVATIONS & CONCLUSIONS</h3>
                <label className="block text-sm font-medium text-gray-700">Observations sur les non-conformités / Observations on findings</label>
                <textarea rows={4} maxLength={2000} value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Décrivez ici toutes les anomalies, problèmes ou points à signaler..." className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 resize-none" />
                <p className="text-xs text-gray-400 text-right">{observations.length}/2000</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <h3 className="font-semibold text-gray-900">D — CONCLUSION (Cochez la bonne mention)</h3>
                {conclusion && (
                    <div className={`p-3 rounded-xl border text-sm font-medium flex items-center gap-2 ${conclusion === 'fit' ? 'bg-green-50 border-green-200 text-green-700' : conclusion === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        <span>{conclusion === 'fit' ? '✓' : conclusion === 'warning' ? '⚠' : '✗'}</span>
                        Évaluation automatique : {conclusion === 'fit' ? 'Véhicule apte' : conclusion === 'warning' ? 'Avec réserves' : 'Inapte'}
                    </div>
                )}
                <div className="space-y-3">
                    {[
                        { val: 'fit', text: 'Le véhicule peut être utilisé en sécurité', textEn: 'Car can be used safely', icon: '✓', active: 'border-green-500 bg-green-50' },
                        { val: 'warning', text: 'Le véhicule est utilisable avec réserves', textEn: 'Car can be used with restrictions', icon: '⚠', active: 'border-amber-500 bg-amber-50' },
                        { val: 'unfit', text: 'Le véhicule ne doit pas être utilisé compte tenu des non-conformités constatées', textEn: 'The car must not be used given the findings noted', icon: '✗', active: 'border-red-500 bg-red-50' },
                    ].map(opt => (
                        <label key={opt.val} className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${conclusion === opt.val ? opt.active : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                            <input type="radio" name="conclusion" value={opt.val} checked={conclusion === opt.val} onChange={() => setConclusion(opt.val)} className="mt-0.5 accent-green-500" />
                            <div><p className="font-semibold text-sm text-gray-900">{opt.icon} {opt.text}</p><p className="text-xs text-gray-500 italic mt-0.5">{opt.textEn}</p></div>
                        </label>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6">
                <div className="text-center space-y-4">
                    <p className="font-semibold text-gray-900 uppercase tracking-wide text-sm flex items-center justify-center gap-2">
                        <PenLine className="w-4 h-4 text-green-600" /> Attestation / Signature électronique
                    </p>
                    <div className="text-sm text-gray-700 leading-relaxed">
                        <p>Je soussigné(e) <strong className="text-gray-900">{user?.full_name}</strong>,</p>
                        <p className="mt-1">confirme que les informations mentionnées sur ce formulaire sont conformes à l'état réel du véhicule.</p>
                        <p className="text-xs text-gray-500 italic mt-1">that the information filled in this form is compliant to the state of the vehicle.</p>
                    </div>
                    <div className="border-t border-gray-200 pt-4">
                        <SignatureCanvas onSign={setSignature} onClear={() => setSignature('')} value={signature} />
                        {!signature && <p className="text-xs text-red-500 mt-2">* Signature obligatoire - Dessinez votre signature ci-dessus (souris ou tactile)</p>}
                        {signature && <p className="text-xs text-green-600 mt-2">✓ Signature enregistrée</p>}
                    </div>
                    <p className="text-center text-xs text-green-600 italic">🌿 "Safe drive to preserve our lives and asset"</p>
                </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-lg">
                <button type="button" disabled={!canSubmit || submitting} onClick={handleSubmit} className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${canSubmit && !submitting ? 'bg-green-500 hover:bg-green-600 text-white shadow-md' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                    {!canSubmit ? `Complétez l'inspection (${completedCount}/${TOTAL_POINTS} points)${!mileage ? ' · Kilométrage requis' : ''}${!signature ? ' · Signature requise' : ''}` : submitting ? '⏳ Soumission en cours...' : '✍ Signer et Soumettre le Rapport d\'Inspection →'}
                </button>
            </div>
        </div>
    )
}

export default NewInspectionPage