// src/pages/LoginPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ArrowRight, CheckCircle, Shield, Car, ClipboardCheck, Users, Activity, Globe } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { login } from '../services/api'

// Traductions
const translations = {
    fr: {
        title: 'Connexion',
        subtitle: 'Accédez à votre espace de gestion',
        email: 'Email',
        password: 'Mot de passe',
        login: 'Se connecter',
        logging: 'Connexion...',
        demoTitle: 'Comptes de démonstration',
        passwordLabel: 'Mot de passe:',
        brandTitle: 'Gérez votre flotte sans papier',
        brandDesc: 'Digitalisez vos inspections véhicules. Traçabilité totale, workflows automatisés, décisions en temps réel.',
        features: {
            fleet: 'Gestion complète du parc',
            digital: 'Inspections digitales',
            workflow: 'Validation en temps réel',
            roles: 'Gestion multi-rôles'
        },
        copyright: 'Fleet Inspection Management System'
    },
    en: {
        title: 'Login',
        subtitle: 'Access your management space',
        email: 'Email',
        password: 'Password',
        login: 'Sign in',
        logging: 'Logging in...',
        demoTitle: 'Demo accounts',
        passwordLabel: 'Password:',
        brandTitle: 'Manage your fleet paperless',
        brandDesc: 'Digitize your vehicle inspections. Full traceability, automated workflows, real-time decisions.',
        features: {
            fleet: 'Complete fleet management',
            digital: 'Digital inspections',
            workflow: 'Real-time validation',
            roles: 'Multi-role management'
        },
        copyright: 'Fleet Inspection Management System'
    }
}

const LoginPage = () => {
    const [showPass, setShowPass] = useState(false)
    const [loading, setLoading] = useState(false)
    const [language, setLanguage] = useState('fr')
    const navigate = useNavigate()
    const { setAuth } = useAuthStore()
    const { register, handleSubmit, setValue, formState: { errors } } = useForm()
    const t = translations[language]

    const features = [
        { icon: CheckCircle, text: t.features.fleet },
        { icon: ClipboardCheck, text: t.features.digital },
        { icon: Shield, text: t.features.workflow },
        { icon: Users, text: t.features.roles },
    ]

    // Fonction universelle pour extraire le token
    const extractToken = (data) => {
        const possibleKeys = ['access_token', 'token', 'accessToken', 'jwt', 'auth_token', 'bearer', 'authorization']
        for (const key of possibleKeys) {
            if (data[key]) return data[key]
        }
        if (data.data && typeof data.data === 'object') return extractToken(data.data)
        return null
    }

    // Fonction universelle pour extraire l'utilisateur
    const extractUser = (data, email) => {
        // Cas 1: user est directement dans data.user
        if (data.user && typeof data.user === 'object') {
            return normalizeUser(data.user, email)
        }
        // Cas 2: data contient directement les champs utilisateur
        if (data.id || data.email || data.full_name || data.name) {
            return normalizeUser(data, email)
        }
        // Cas 3: data.data contient l'utilisateur
        if (data.data && typeof data.data === 'object') {
            return extractUser(data.data, email)
        }
        // Cas 4: Créer un utilisateur à partir de l'email
        let role = 'agent'
        if (email.includes('admin')) role = 'admin'
        else if (email.includes('manager')) role = 'manager'
        else if (email.includes('supervisor')) role = 'unit_supervisor'
        return {
            id: Date.now(),
            full_name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
            email: email,
            role: role,
            department: null
        }
    }

    // Fonction pour normaliser l'utilisateur
    const normalizeUser = (userData, email) => {
        let role = userData.role
        if (!role) {
            if (email.includes('admin')) role = 'admin'
            else if (email.includes('manager')) role = 'manager'
            else if (email.includes('supervisor')) role = 'unit_supervisor'
            else role = 'agent'
        }
        return {
            id: userData.id || userData.user_id || Date.now(),
            full_name: userData.full_name || userData.name || userData.username || email.split('@')[0],
            email: userData.email || email,
            role: role.toLowerCase(),
            department: userData.department || userData.service || null
        }
    }

    const onSubmit = async (data) => {
        setLoading(true)
        try {
            const response = await login(data.email, data.password)

            console.log('=== RÉPONSE BRUTE BACKEND ===')
            console.log('Status:', response.status)
            console.log('Data:', response.data)

            const token = extractToken(response.data)
            const user = extractUser(response.data, data.email)

            console.log('Token extrait:', token ? 'OUI' : 'NON')
            console.log('User extrait:', user)

            if (!token) {
                toast.error(language === 'fr' ? 'Erreur de connexion: token non trouvé' : 'Login error: token not found')
                return
            }

            setAuth(user, token)
            toast.success(language === 'fr' ? `Bienvenue ${user.full_name} 👋` : `Welcome ${user.full_name} 👋`)

            // ✅ CORRECTION: Ajout de unit_supervisor dans les routes
            const routes = {
                admin: '/admin/dashboard',
                manager: '/manager/dashboard',
                agent: '/agent/dashboard',
                unit_supervisor: '/supervisor/dashboard'  // ← AJOUT
            }
            navigate(routes[user.role] || '/agent/dashboard')

        } catch (error) {
            console.error('Erreur:', error.response?.data)
            const errorMsg = error.response?.data?.detail
                || error.response?.data?.message
                || error.response?.data?.error
                || (language === 'fr' ? 'Email ou mot de passe incorrect' : 'Invalid email or password')
            toast.error(errorMsg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex">
            {/* Left side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 to-gray-800 relative overflow-hidden">
                <div className="absolute inset-0 bg-grid-pattern opacity-5" />
                <div className="relative z-10 flex flex-col justify-between p-10 h-full">
                    <div>
                        <div className="flex items-center gap-2.5 mb-12">
                            <div className="w-9 h-9 bg-gradient-to-br from-eneo-lime to-green-600 rounded-xl flex items-center justify-center">
                                <Activity className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">FIMS</h1>
                                <p className="text-[10px] text-gray-400 tracking-wide">Fleet Management</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl font-bold text-white leading-tight">
                                {t.brandTitle.split(' ').map((word, i) =>
                                    word === 'sans' || word === 'paperless' ?
                                        <span key={i}>{word} </span> :
                                        word === 'papier' || word === 'fleet' ?
                                            <span key={i} className="text-eneo-lime">{word} </span> :
                                            <span key={i}>{word} </span>
                                )}
                            </h2>
                            <p className="text-gray-300 text-sm leading-relaxed">{t.brandDesc}</p>
                        </div>
                    </div>
                    <div className="space-y-2.5">
                        {features.map((f, i) => (
                            <div key={i} className="flex items-center gap-3 text-gray-300 text-sm">
                                <div className="w-5 h-5 rounded-full bg-eneo-lime/20 flex items-center justify-center">
                                    <f.icon className="w-3 h-3 text-eneo-lime" />
                                </div>
                                <span>{f.text}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-gray-500 text-xs">© 2025 FIMS — {t.copyright}</p>
                </div>
            </div>

            {/* Right side - Login Form avec cadre visible */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-6">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-eneo-lime to-green-600 rounded-xl flex items-center justify-center">
                                <Activity className="w-4 h-4 text-white" />
                            </div>
                            <h1 className="text-xl font-bold text-gray-900">FIMS</h1>
                        </div>
                    </div>

                    {/* Cadre de connexion - bien visible */}
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                        {/* Language selector */}
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition text-sm font-medium text-gray-600"
                            >
                                <Globe className="w-3.5 h-3.5" />
                                {language === 'fr' ? 'EN' : 'FR'}
                            </button>
                        </div>

                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">{t.title}</h2>
                            <p className="text-sm text-gray-500 mt-1">{t.subtitle}</p>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.email}</label>
                                <input
                                    type="email"
                                    {...register('email', { required: t.email === 'Email' ? 'Email required' : 'Email requis' })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:border-eneo-lime focus:ring-2 focus:ring-eneo-lime/20 transition"
                                    placeholder="admin@fims.cm"
                                    defaultValue="admin@fims.cm"
                                />
                                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.password}</label>
                                <div className="relative">
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        {...register('password', { required: t.password === 'Password' ? 'Password required' : 'Mot de passe requis' })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:border-eneo-lime focus:ring-2 focus:ring-eneo-lime/20 transition pr-10"
                                        placeholder="••••••••"
                                        defaultValue="password123"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPass(!showPass)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-eneo-lime transition"
                                    >
                                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                            </div>

                            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-eneo-lime to-green-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-eneo-lime/20 transition-all flex items-center justify-center gap-2">
                                {loading ? (
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <>
                                        {t.login} <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Demo accounts section - AJOUT DU COMPTE SUPERVISOR */}
                        <div className="mt-6 pt-5 border-t border-gray-100">
                            <p className="text-xs text-center text-gray-400 mb-3">{t.demoTitle}</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                <button
                                    onClick={() => { setValue('email', 'admin@fims.cm'); setValue('password', 'password123') }}
                                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-eneo-lime/10 hover:text-eneo-lime transition"
                                >
                                    Admin
                                </button>
                                <button
                                    onClick={() => { setValue('email', 'manager@fims.cm'); setValue('password', 'password123') }}
                                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-eneo-lime/10 hover:text-eneo-lime transition"
                                >
                                    Manager
                                </button>
                                <button
                                    onClick={() => { setValue('email', 'agent@fims.cm'); setValue('password', 'password123') }}
                                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-eneo-lime/10 hover:text-eneo-lime transition"
                                >
                                    Agent
                                </button>
                                <button
                                    onClick={() => { setValue('email', 'supervisor@fims.cm'); setValue('password', 'password123') }}
                                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-eneo-lime/10 hover:text-eneo-lime transition"
                                >
                                    Supervisor
                                </button>
                            </div>
                            <p className="text-center text-xs text-gray-400 mt-3">
                                {t.passwordLabel} <span className="text-eneo-lime font-medium">password123</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LoginPage