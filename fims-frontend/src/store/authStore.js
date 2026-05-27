import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { login as apiLogin, getMe } from '../services/api'
import toast from 'react-hot-toast'

export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isLoading: false,
            isInitialized: false,

            setAuth: (user, token) => {
                if (token) {
                    localStorage.setItem('fims_token', token)
                }
                set({ user, token, isInitialized: true })
            },

            updateUser: (userData) => {
                set({ user: { ...get().user, ...userData } })
            },

            initialize: async () => {
                const token = localStorage.getItem('fims_token')
                if (!token) {
                    set({ isInitialized: true })
                    return
                }

                set({ isLoading: true })
                try {
                    const response = await getMe()
                    const userData = response.data
                    set({
                        user: userData,
                        token: token,
                        isLoading: false,
                        isInitialized: true
                    })
                } catch (error) {
                    console.error('Erreur initialization:', error)
                    localStorage.removeItem('fims_token')
                    set({
                        user: null,
                        token: null,
                        isLoading: false,
                        isInitialized: true
                    })
                }
            },

            login: async (emailOrUsername, password) => {
                set({ isLoading: true })
                try {
                    const response = await apiLogin(emailOrUsername, password)
                    const { access_token, user: userData } = response.data

                    localStorage.setItem('fims_token', access_token)
                    set({
                        user: userData,
                        token: access_token,
                        isLoading: false
                    })

                    toast.success(`Bienvenue ${userData.full_name || userData.email || emailOrUsername}`)
                    return { success: true, user: userData }
                } catch (error) {
                    const message = error.response?.data?.detail || 'Email ou mot de passe incorrect'
                    toast.error(message)
                    set({ isLoading: false })
                    return { success: false, error: message }
                }
            },

            logout: () => {
                localStorage.removeItem('fims_token')
                set({ user: null, token: null, isLoading: false })
                toast.success('Déconnexion réussie')
            },

            isAuthenticated: () => {
                return !!get().token && !!get().user
            },

            hasRole: (role) => {
                const user = get().user
                if (!user) return false
                if (Array.isArray(role)) {
                    return role.includes(user.role)
                }
                return user.role === role
            },

            isAdmin: () => get().user?.role === 'admin',
            isManager: () => get().user?.role === 'manager',
            isAgent: () => get().user?.role === 'agent',
        }),
        {
            name: 'fims-auth',
            partialize: (state) => ({
                user: state.user,
                token: state.token
            }),
        }
    )
)