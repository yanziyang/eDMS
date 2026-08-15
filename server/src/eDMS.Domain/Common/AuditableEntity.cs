namespace eDMS.Domain.Common;

public abstract class AuditableEntity
{
    public Guid Id { get; protected set; } = Guid.CreateVersion7();

    public Guid CreatedBy { get; protected set; }

    public DateTimeOffset CreatedAt { get; protected set; } = DateTimeOffset.UtcNow;

    public void SetCreator(Guid userId)
    {
        CreatedBy = userId;
        CreatedAt = DateTimeOffset.UtcNow;
    }
}
