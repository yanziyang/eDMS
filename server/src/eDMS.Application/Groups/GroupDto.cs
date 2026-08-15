namespace eDMS.Application.Groups;

public sealed record GroupDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsSystem,
    Guid? SiteId,
    IReadOnlyList<Guid> MemberIds);
