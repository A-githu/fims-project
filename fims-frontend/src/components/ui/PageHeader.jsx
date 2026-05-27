const PageHeader = ({ title, actions }) => {
    return (
        <div className="flex justify-between items-center mb-8">
            <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-surface-100">
                {title}
            </h1>
            {actions && <div className="flex gap-3">{actions}</div>}
        </div>
    )
}

export default PageHeader