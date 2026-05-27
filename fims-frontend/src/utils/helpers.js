import { format } from 'date-fns'
import fr from 'date-fns/locale/fr'

export const formatDate = (date) => {
    if (!date) return '—'
    return format(new Date(date), 'dd/MM/yyyy', { locale: fr })
}

export const formatDateTime = (date) => {
    if (!date) return '—'
    return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: fr })
}

export const STATUS_LABELS = {
    // Vehicles
    active: 'Actif',
    maintenance: 'Maintenance',
    blocked: 'Bloqué',
    decommissioned: 'Hors service',

    // Missions
    DEMANDE_CREEE: 'Demande créée',
    EN_ATTENTE_ATTRIBUTION: 'En attente',
    VEHICULE_ATTRIBUE: 'Véhicule attribué',
    INSPECTION_EN_COURS: 'Inspection en cours',
    INSPECTION_SOUMISE: 'Inspection soumise',
    APPROUVEE: 'Approuvée',
    NOUVEAU_VEHICULE_REQUIS: 'Nouveau véhicule requis',
    TERMINEE: 'Terminée',
    REJETEE: 'Rejetée',

    // Inspections
    fit: 'Apte',
    warning: 'Avec réserves',
    unfit: 'Inapte',

    // Decisions
    approved: 'Approuvé',
    rejected: 'Rejeté',
    pending: 'En attente',
}

export const STATUS_COLORS = {
    // Vehicles
    active: 'badge-active',
    maintenance: 'badge-maintenance',
    blocked: 'badge-blocked',
    decommissioned: 'badge-blocked',

    // Missions
    DEMANDE_CREEE: 'badge-pending',
    EN_ATTENTE_ATTRIBUTION: 'badge-pending',
    VEHICULE_ATTRIBUE: 'badge-maintenance',
    INSPECTION_EN_COURS: 'badge-maintenance',
    INSPECTION_SOUMISE: 'badge-maintenance',
    APPROUVEE: 'badge-active',
    NOUVEAU_VEHICULE_REQUIS: 'badge-maintenance',
    TERMINEE: 'badge-active',
    REJETEE: 'badge-blocked',

    // Inspections
    fit: 'badge-active',
    warning: 'badge-maintenance',
    unfit: 'badge-blocked',

    // Decisions
    approved: 'badge-active',
    rejected: 'badge-blocked',
    pending: 'badge-pending',
}

export const getStatusLabel = (status) => STATUS_LABELS[status] || status
export const getStatusColor = (status) => STATUS_COLORS[status] || 'badge-pending'