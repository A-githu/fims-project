const Spinner = () => {
    return (
        <div className="flex justify-center items-center">
            <div className="w-8 h-8 border-4 border-surface-500 border-t-brand-500 rounded-full animate-spin" />
        </div>
    )
}

export const FullPageSpinner = () => {
    return (
        <div className="fixed inset-0 bg-surface-900 flex justify-center items-center z-50">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-surface-500 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-surface-100 font-mono text-sm">Chargement...</p>
            </div>
        </div>
    )
}

export default Spinner