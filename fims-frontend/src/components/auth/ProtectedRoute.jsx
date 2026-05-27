import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const ProtectedRoute = ({ allowedRoles }) => {
    const { token, user } = useAuthStore()

    if (!token || !user) {
        return <Navigate to="/login" replace />
    }

    if (!allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />
    }

    return <Outlet />
}

export default ProtectedRoute