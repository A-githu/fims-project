import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useThemeStore = create(
    persist(
        (set) => ({
            theme: 'light',
            setTheme: (theme) => {
                set({ theme })
                // Appliquer le thème au document
                if (theme === 'dark') {
                    document.documentElement.classList.add('dark')
                } else {
                    document.documentElement.classList.remove('dark')
                }
            },
        }),
        {
            name: 'fims-theme',
        }
    )
)

// Initialiser le thème au chargement
if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('fims-theme')
    if (savedTheme) {
        try {
            const { state } = JSON.parse(savedTheme)
            if (state?.theme === 'dark') {
                document.documentElement.classList.add('dark')
            }
        } catch (e) { }
    }
}