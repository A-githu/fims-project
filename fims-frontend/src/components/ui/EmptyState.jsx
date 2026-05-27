import { Inbox } from 'lucide-react'

const EmptyState = ({ title, description, icon: Icon = Inbox }) => {
    return (
        <div className="text-center py-12">
            <Icon className="w-16 h-16 text-surface-400 mx-auto mb-4" />
            <h3 className="font-display text-xl font-bold uppercase text-surface-100 mb-2">{title}</h3>
            <p className="text-surface-100">{description}</p>
        </div>
    )
}

export default EmptyState