
# AI Document Upload Feature

## Overview

The AI Assistant now includes a document upload feature that allows you to easily add new PDFs, Markdown, and text files to the knowledge base directly from the web interface.

## What's New

### Upload Button in AI Assistant
- A new **Upload** button (green upload icon) has been added to the AI Assistant header
- Located next to the Knowledge Base rebuild button
- Click to open the document upload modal

### Upload Modal Features

#### File Selection
- Click the dashed border area to select files
- Supports multiple file selection at once
- Accepts: **PDF**, **Markdown (.md)**, and **Text (.txt)** files
- Invalid file types are automatically filtered out

#### File Management
- View all selected files before uploading
- See file name and size for each file
- Remove individual files from the selection
- Upload multiple files in a single batch

#### Smart Upload Process
1. Files are uploaded to `/Uploads` directory
2. Duplicate filenames are automatically renamed (e.g., `file.pdf`, `file_1.pdf`)
3. Knowledge base is automatically rebuilt after upload
4. Success/error messages appear in the chat

## How to Use

### Upload New Documents

1. **Open AI Assistant**
   - Navigate to the AI Assistant page
   - Click the green **Upload** button in the header

2. **Select Files**
   - Click the upload area in the modal
   - Select one or more PDF, MD, or TXT files
   - Selected files will appear in a list

3. **Review Selection**
   - Check the file list to ensure correct files
   - Remove any unwanted files by clicking the X button
   - Add more files if needed

4. **Upload**
   - Click "Upload & Add to KB" button
   - Wait for upload to complete
   - Knowledge base will automatically rebuild

5. **Verify**
   - Check the chat for confirmation message
   - Knowledge base stats will update
   - New documents are now available for AI queries

## Technical Details

### API Endpoint
- **Route**: `/api/ai/upload-documents`
- **Method**: POST
- **Content-Type**: multipart/form-data
- **Response**: Upload results with file count and any errors

### File Storage
- **Location**: `/home/ubuntu/Uploads/`
- **Validation**: File type checked by extension
- **Conflict Resolution**: Automatic filename incrementation
- **Security**: Server-side validation of file types

### Knowledge Base Integration
- Uploaded files are automatically included in next rebuild
- Uses the same processing pipeline as existing documents
- Chunked and indexed for efficient retrieval
- Immediately available after rebuild completes

## Supported File Types

### PDF Documents
- Technical documentation
- User manuals
- Equipment specifications
- Configuration guides

### Markdown Files (.md)
- System documentation
- README files
- Implementation guides
- Knowledge base articles

### Text Files (.txt)
- Log files
- Configuration files
- Plain text documentation
- Notes and references

## Best Practices

### File Organization
- Use descriptive filenames
- Keep files focused on specific topics
- Organize related documents together
- Update outdated documents regularly

### File Size
- Large files are supported but may take longer to process
- Consider splitting very large documents
- Optimize PDFs before upload if possible

### Knowledge Base Maintenance
- Upload related documents together
- Rebuild knowledge base after batches of uploads
- Monitor chat for upload confirmations
- Check knowledge base stats for verification

## Features

### Automatic Processing
✓ Files uploaded to correct directory
✓ Duplicate handling with auto-rename
✓ Automatic knowledge base rebuild
✓ Real-time progress feedback

### User Experience
✓ Drag-and-drop interface (click to select)
✓ Multi-file selection support
✓ File preview before upload
✓ Individual file removal
✓ Upload progress indication
✓ Success/error notifications in chat

### Error Handling
✓ Invalid file type filtering
✓ Upload failure detection
✓ Detailed error messages
✓ Partial upload support (some files succeed, some fail)

## Troubleshooting

### Files Not Uploading
1. Check file type is PDF, MD, or TXT
2. Verify file is not corrupted
3. Check server logs for errors
4. Ensure sufficient disk space

### Knowledge Base Not Updating
1. Wait for rebuild to complete
2. Check chat for error messages
3. Manually trigger rebuild if needed
4. Verify files are in `/Uploads` directory

### Upload Button Not Visible
1. Ensure AI Assistant page is loaded
2. Check that knowledge base stats are visible
3. Refresh the page
4. Check browser console for errors

## Integration with Existing System

### Works With
- All existing documentation in `/Uploads`
- Project documentation in repository
- Existing knowledge base rebuild functionality
- AI query and chat features

### Enhances
- Documentation management workflow
- System learning capabilities
- Troubleshooting resources
- Knowledge base completeness

## Future Enhancements (Potential)

- Drag-and-drop file upload
- Bulk document management
- Document preview before upload
- Document deletion from knowledge base
- Document version control
- Upload history tracking

## Summary

The document upload feature makes it easy to continuously improve the AI Assistant's knowledge base by adding new documentation directly from the web interface. This enables the system to learn about new equipment, procedures, and configurations as your setup evolves.

**Key Benefits:**
- No need to manually copy files to server
- Automatic knowledge base integration
- Immediate availability for AI queries
- User-friendly interface
- Batch upload support
- Smart conflict resolution

---

*Last Updated: October 1, 2025*
*Part of Sports Bar AI Assistant Knowledge System*
