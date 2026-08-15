namespace eDMS.Domain.Common;

public abstract class SoftDeletableEntity : AuditableEntity
{
    public bool IsDeleted { get; protected set; }

    public DateTimeOffset? DeletedAt { get; protected set; }

    public Guid? DeletedBy { get; protected set; }

    public void MarkDeleted(Guid byUserId, DateTimeOffset at)
    {
        if (IsDeleted)
        {
            return;
        }

        IsDeleted = true;
        DeletedAt = at;
        DeletedBy = byUserId;
    }

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
        DeletedBy = null;
    }
}
