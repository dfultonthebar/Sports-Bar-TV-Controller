
# TV Manuals Directory

This directory contains automatically downloaded TV manuals for the TVs discovered in your sports bar system.

## Directory Structure

```
tv-manuals/
├── Samsung_UN55TU8000_Manual.pdf
├── LG_OLED55C1PUB_Manual.pdf
├── Sony_XBR55X900H_Manual.pdf
└── README.md (this file)
```

## File Naming Convention

Files are named using the format: `Manufacturer_Model_Manual.extension`

- **Manufacturer:** TV brand (e.g., Samsung, LG, Sony)
- **Model:** TV model number (e.g., UN55TU8000)
- **Extension:** `.pdf` for PDF manuals, `.txt` for text documentation

## Automatic Management

- Files are automatically downloaded when new TVs are discovered via CEC
- Existing files are not re-downloaded unless forced
- Invalid or corrupted files are automatically deleted
- File sizes are validated (100KB - 50MB)

## Manual Management

You can also manually add TV manuals to this directory:

1. Download the manual from the manufacturer's website
2. Rename it following the naming convention above
3. Place it in this directory
4. The system will recognize it automatically

## Storage Considerations

- Average manual size: 2-5 MB
- Recommended free space: 500 MB minimum
- Old manuals can be safely deleted if needed
- The system will re-download if needed

## Backup

It's recommended to backup this directory periodically:

```bash
tar -czf tv-manuals-backup-$(date +%Y%m%d).tar.gz tv-manuals/
```

## Security

- Only PDF and text files are allowed
- Files are validated before saving
- Filenames are sanitized to prevent security issues
- No executable files are permitted

---

**Note:** This directory is managed automatically by the Sports Bar TV Controller system.
