import { getStatusLabel, getStatusColor } from '../../utils/helpers'

const StatusBadge = ({ status }) => {
    return (
        <span className={getStatusColor(status)}>
            {getStatusLabel(status)}
        </span>
    )
}

export default StatusBadge