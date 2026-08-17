namespace eDMS.Infrastructure.Documents;

/// <summary>
/// Detects a small allow-listed set of content types from magic bytes, independent of
/// the client-supplied MIME type (TDS §10.3).
/// </summary>
public static class ContentTypeSniffer
{
    public static string Detect(ReadOnlySpan<byte> header, string? fileName = null)
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
            return DetectOfficePackageType(fileName) ?? "application/zip";
        }

        if (header.Length >= 8 && header[0] == 0x50 && header[1] == 0x4B && header[2] == 0x05 && header[3] == 0x06)
        {
            return DetectOfficePackageType(fileName) ?? "application/zip";
        }

        // Legacy Office files use the OLE compound-file signature. The
        // extension is only consulted after the magic bytes establish that
        // this is an OLE container; arbitrary client MIME types are ignored.
        if (header.Length >= 8
            && header[0] == 0xD0 && header[1] == 0xCF && header[2] == 0x11 && header[3] == 0xE0
            && header[4] == 0xA1 && header[5] == 0xB1 && header[6] == 0x1A && header[7] == 0xE1)
        {
            return DetectLegacyOfficeType(fileName) ?? "application/octet-stream";
        }

        return "application/octet-stream";
    }

    private static string? DetectOfficePackageType(string? fileName) =>
        Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant() switch
        {
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".docm" => "application/vnd.ms-word.document.macroEnabled.12",
            ".dotx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
            ".dotm" => "application/vnd.ms-word.template.macroEnabled.12",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xlsm" => "application/vnd.ms-excel.sheet.macroEnabled.12",
            ".xltx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
            ".xltm" => "application/vnd.ms-excel.template.macroEnabled.12",
            ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".pptm" => "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
            ".ppsx" => "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
            ".ppsm" => "application/vnd.ms-powerpoint.slideshow.macroEnabled.12",
            ".potx" => "application/vnd.openxmlformats-officedocument.presentationml.template",
            ".potm" => "application/vnd.ms-powerpoint.template.macroEnabled.12",
            ".odt" => "application/vnd.oasis.opendocument.text",
            ".ods" => "application/vnd.oasis.opendocument.spreadsheet",
            ".odp" => "application/vnd.oasis.opendocument.presentation",
            _ => null,
        };

    private static string? DetectLegacyOfficeType(string? fileName) =>
        Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant() switch
        {
            ".doc" => "application/msword",
            ".xls" => "application/vnd.ms-excel",
            ".ppt" => "application/vnd.ms-powerpoint",
            _ => null,
        };
}
