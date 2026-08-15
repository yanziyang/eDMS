namespace eDMS.Domain;

public static class SiteRoleExtensions
{
    public static PermissionLevel ToPermissionLevel(this SiteRole role) =>
        role switch
        {
            SiteRole.Owner => PermissionLevel.FullControl,
            SiteRole.Member => PermissionLevel.Contribute,
            SiteRole.Visitor => PermissionLevel.Read,
            _ => PermissionLevel.NoAccess,
        };
}
