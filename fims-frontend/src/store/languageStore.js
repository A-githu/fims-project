import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useLanguageStore = create(
    persist(
        (set) => ({
            language: 'fr',
            setLanguage: (lang) => set({ language: lang }),
        }),
        {
            name: 'fims-language',
        }
    )
)