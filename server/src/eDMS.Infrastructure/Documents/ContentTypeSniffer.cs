namespace eDMS.Infrastructure.Documents;

/// <summary>
/// Detects a small allow-listed set of content types from magic bytes, independent of
/// the client-supplied MIME type (TDS §10.3).
/// </summary>
public static class ContentTypeSniffer
{
    public static string Detect(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 4 && header[0] == 0x25 && header[1] == 0x50 && header[2] == 0x44 && header[3] == 0x46)
        {
            return "application/pdf";
        }

        if (header.Length >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47)
        {
            return "image/png";
        }

        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF)
        {
            return "image/jpeg";
        }

        if (header.Length >= 6 && header[0] == 0x47 && header[1] == 0x49 && header[2] == 0x46)
        {
            return "image/gif";
        }

        if (header.Length >= 4 && header[0] == 0x50 && header[1] == 0x4B && header[2] == 0x03 && header[3] == 0x04)
        {
            return "application/zip";
        }

        if (header.Length >= 8 && header[0] == 0x50 && header[1] == 0x4B && header[2] == 0x05 && header[3] == 0x06)
        {
            return "application/zip";
        }

        return "application/octet-stream";
    }
}
