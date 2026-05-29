import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = 'https://fims-project-production.up.railway.app'

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Intercepteur pour ajouter le token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('fims_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('fims_token')
            localStorage.removeItem('fims-auth')
            localStorage.removeItem('user')
            window.location.href = '/login'
            toast.error('Session expirée, veuillez vous reconnecter')
        }
        return Promise.reject(error)
    }
)

// ==================== AUTH ====================
export const login = async (email, password) => {
    try {
        const response = await api.post('/api/auth/login', { email, password })
        return response
    } catch (error) {
        throw error
    }
}

export const getMe = () => api.get('/api/auth/me')

// ==================== VEHICLES ====================
export const getVehicles = (params) => api.get('/api/vehicles', { params })
export const getVehicle = (id) => api.get(`/api/vehicles/${id}`)
export const createVehicle = (data) => api.post('/api/vehicles', data)
export const updateVehicle = (id, data) => api.put(`/api/vehicles/${id}`, data)
export const decommissionVehicle = (id) => api.delete(`/api/vehicles/${id}`)
export const getAvailableVehicles = () => api.get('/api/missions/available')
export const getVehicleHistory = (id) => api.get(`/api/vehicles/${id}/history`)

// ==================== MISSIONS ====================
export const getMissions = (params) => api.get('/api/missions', { params })
export const getPendingMissions = () => api.get('/api/missions/pending')
export const getMission = (id) => api.get(`/api/missions/${id}`)
export const createMission = (data) => api.post('/api/missions', data)
export const assignMissionVehicle = (id, data) => api.put(`/api/missions/${id}/assign`, data)
export const rejectMission = (id, data) => api.put(`/api/missions/${id}/reject`, data)
export const cancelMission = (id, data) => api.put(`/api/missions/${id}/cancel`, data)
export const getMissionTimeline = (id) => api.get(`/api/missions/${id}/timeline`)
export const completeMission = (id, data) => api.put(`/api/missions/${id}/complete`, data || {})

// ==================== INSPECTIONS ====================
export const getInspections = (params) => api.get('/api/inspections', { params })
export const getPendingInspections = () => api.get('/api/inspections/pending')
export const getInspection = (id) => api.get(`/api/inspections/${id}`)
export const createInspection = (data) => api.post('/api/inspections', data)
export const validateInspection = (id, data) => api.put(`/api/inspections/${id}/validate`, data)
export const rejectInspection = (id, data) => api.put(`/api/inspections/${id}/reject`, data)
export const getInspectionPdf = (id) => api.get(`/api/inspections/${id}/pdf`, { responseType: 'blob' })

// ==================== DASHBOARD ====================
export const getDashboardStats = () => api.get('/api/dashboard/stats')

// ==================== MAINTENANCE ====================
export const getMaintenanceTasks = (params) => api.get('/api/maintenance', { params })
export const getMaintenanceTask = (id) => api.get(`/api/maintenance/${id}`)
export const createMaintenanceTask = (data) => api.post('/api/maintenance', data)
export const updateMaintenanceTask = (id, data) => api.put(`/api/maintenance/${id}`, data)
export const deleteMaintenanceTask = (id) => api.delete(`/api/maintenance/${id}`)

// ==================== USERS ====================
export const getUsers = () => api.get('/api/users')
export const getUser = (id) => api.get(`/api/users/${id}`)
export const createUser = (data) => api.post('/api/users', data)
export const updateUser = (id, data) => api.put(`/api/users/${id}`, data)
export const deleteUser = (id) => api.delete(`/api/users/${id}`)

// ==================== DEPARTMENTS ====================
export const getDepartments = () => api.get('/api/departments/')

// ==================== SUPERVISOR ====================
export const getSupervisorAgents = () => api.get('/api/supervisor/agents')


// ==================== USERS - PROFIL (POUR SETTINGS) ====================
export const getCurrentUser = () => api.get('/api/users/me')
export const updateCurrentUser = (data) => api.put('/api/users/me', data)
export const changePassword = (data) => api.post('/api/users/change-password', data)
export const deleteAccount = () => api.delete('/api/users/me')

export default api