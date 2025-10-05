# AI Teaching Interface Documentation

## Overview

The AI Teaching Interface is a dedicated system for training the local AI assistant about your specific Sports Bar setup, equipment, and operational procedures. This interface allows you to upload custom documentation and add Q&A pairs to enhance the AI's knowledge beyond the default system documentation.

## Features

### 1. Document Upload
- **Supported Formats**: PDF, Markdown (.md), Text (.txt)
- **Automatic Processing**: Documents are automatically indexed and chunked for optimal AI retrieval
- **Persistent Storage**: Uploaded documents are stored in the `uploads/` directory
- **Knowledge Base Integration**: Automatically rebuilds the knowledge base after uploads

### 2. Q&A Training
- **Custom Q&A Pairs**: Add specific questions and answers about your system
- **Categories**: Organize entries by category (General, Equipment, Troubleshooting, Configuration, Maintenance)
- **Persistent Storage**: Q&A entries are stored in `data/qa-entries.json`
- **Easy Management**: View, add, and delete Q&A entries through the interface

### 3. AI Testing
- **Real-time Testing**: Test the AI's knowledge with custom questions
- **Knowledge Verification**: Verify that the AI uses your uploaded documents and Q&A entries
- **Response Quality**: Check accuracy and completeness of AI responses

### 4. Knowledge Base Statistics
- **Document Count**: Total number of indexed documents
- **Q&A Pairs**: Number of custom Q&A training entries
- **Content Size**: Total characters in the knowledge base
- **Last Updated**: Timestamp of the last knowledge base rebuild

## How to Use

### Accessing the Interface

1. Navigate to the AI Hub: `/ai-hub`
2. Click on the **"Teach AI"** tab
3. The interface will load with three sub-tabs: Upload Documents, Q&A Training, and Test AI

### Uploading Documents

1. Click the **"Upload Documents"** tab
2. Click **"Click to select files"** or drag files to the upload area
3. Select one or more PDF, Markdown, or text files
4. Review the selected files list
5. Click **"Upload X File(s)"** to upload
6. Wait for the upload to complete and knowledge base to rebuild

**Best Practices for Document Uploads:**
- Upload equipment manuals and technical documentation
- Include troubleshooting guides and FAQs
- Add configuration examples and best practices
- Use descriptive filenames for easy identification

### Adding Q&A Training Pairs

1. Click the **"Q&A Training"** tab
2. Select a category from the dropdown:
   - General
   - Equipment
   - Troubleshooting
   - Configuration
   - Maintenance
3. Enter your question in the "Question" field
4. Enter the detailed answer in the "Answer" field
5. Click **"Add Q&A Entry"**
6. The entry will be added and the knowledge base will rebuild

**Example Q&A Entries:**

**Question**: "How do I reset the Wolf Pack matrix switcher?"
**Answer**: "To reset the Wolf Pack matrix switcher: 1) Power off the unit, 2) Wait 30 seconds, 3) Power on while holding the reset button, 4) Release after 5 seconds. The unit will restore factory defaults."

**Question**: "What's the IP address of our main Atlas audio processor?"
**Answer**: "The main Atlas AZM8 audio processor is located at IP address 192.168.1.50. Access the web interface at http://192.168.1.50"

### Testing AI Knowledge

1. Click the **"Test AI"** tab
2. Enter a question in the "Test Question" field
3. Click **"Test AI Response"**
4. Review the AI's response
5. Verify that it uses information from your uploaded documents and Q&A entries

**Testing Tips:**
- Ask questions similar to what you've trained
- Test different phrasings of the same question
- Check if the AI uses your uploaded documents
- Verify accuracy and add more training if needed

## Technical Details

### File Storage

```
Sports-Bar-TV-Controller/
├── uploads/                    # User-uploaded documents
│   ├── equipment_manual.pdf
│   └── troubleshooting_guide.md
├── data/
│   ├── qa-entries.json        # Q&A training entries
│   └── ai-knowledge-base.json # Compiled knowledge base
└── docs/                       # System documentation
```

### API Endpoints

#### Upload Documents
```
POST /api/ai/upload-documents
Content-Type: multipart/form-data

Body: FormData with 'files' field containing one or more files
```

#### Q&A Entries - Get All
```
GET /api/ai/qa-entries

Response:
{
  "success": true,
  "entries": [
    {
      "id": "qa_1234567890_abc123",
      "question": "How do I...",
      "answer": "To do this...",
      "category": "equipment",
      "createdAt": "2025-10-05T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

#### Q&A Entries - Add New
```
POST /api/ai/qa-entries
Content-Type: application/json

Body:
{
  "question": "How do I configure...",
  "answer": "To configure...",
  "category": "configuration"
}
```

#### Q&A Entries - Delete
```
DELETE /api/ai/qa-entries?id=qa_1234567890_abc123
```

#### Knowledge Base Stats
```
GET /api/ai/knowledge-stats

Response:
{
  "success": true,
  "stats": {
    "totalDocuments": 502,
    "totalQAPairs": 15,
    "totalCharacters": 1250000,
    "lastUpdated": "2025-10-05T12:00:00.000Z"
  }
}
```

#### Rebuild Knowledge Base
```
POST /api/ai/rebuild-knowledge-base

Response:
{
  "success": true,
  "message": "Knowledge base rebuilt successfully"
}
```

### Knowledge Base Building Process

When you upload documents or add Q&A entries, the system automatically:

1. **Stores the content**: Files go to `uploads/`, Q&A entries to `data/qa-entries.json`
2. **Triggers rebuild**: Calls the knowledge base builder script
3. **Processes documents**: Extracts text from PDFs, reads Markdown/text files
4. **Chunks content**: Splits large documents into 3000-character chunks
5. **Includes Q&A**: Formats Q&A entries as "Q: ... A: ..." documents
6. **Saves knowledge base**: Writes to `data/ai-knowledge-base.json`
7. **Updates stats**: Calculates totals and timestamps

### Manual Knowledge Base Rebuild

You can manually rebuild the knowledge base using:

```bash
npm run build-knowledge-base
```

This will:
- Process all files in `docs/` and `uploads/`
- Include all Q&A entries from `data/qa-entries.json`
- Generate a new `data/ai-knowledge-base.json`

## Use Cases

### 1. Equipment-Specific Training

Upload your specific equipment manuals and add Q&A entries about your exact setup:

```
Q: What model Wolf Pack matrix do we have?
A: We have the Wolf Pack 16x16 HDMI matrix switcher, model WP-1616-HDMI-4K

Q: Where is the Wolf Pack located?
A: The Wolf Pack is in the equipment rack in the back office, second shelf from the top
```

### 2. Troubleshooting Procedures

Document your specific troubleshooting steps:

```
Q: What do I do if TV 5 shows no signal?
A: 1) Check if the DirecTV receiver is on (green light), 2) Verify the matrix input is set to Input 3, 3) Check HDMI cable connections, 4) If still no signal, power cycle the receiver
```

### 3. Configuration Documentation

Add your specific configuration details:

```
Q: What are our audio zone assignments?
A: Zone 1: Main Bar Area, Zone 2: Dining Room, Zone 3: Patio, Zone 4: Pool Table Area, Zone 5: Private Room, Zone 6: Kitchen, Zone 7: Restrooms, Zone 8: Outdoor Speakers
```

### 4. Operational Procedures

Document daily operations and special procedures:

```
Q: How do I set up for UFC fight night?
A: 1) Switch all main bar TVs to Input 1 (PPV receiver), 2) Set audio zones 1-4 to Input 7 (PPV audio), 3) Increase volume to preset 3, 4) Verify closed captions are enabled on TVs 1, 3, 5
```

## Best Practices

### Document Organization
- Use clear, descriptive filenames
- Organize documents by category (equipment, procedures, troubleshooting)
- Keep documents up-to-date
- Remove outdated information

### Q&A Entry Guidelines
- Write clear, specific questions
- Provide detailed, step-by-step answers
- Use consistent terminology
- Include relevant details (IP addresses, model numbers, locations)
- Categorize entries appropriately

### Testing and Validation
- Test the AI after adding new content
- Verify accuracy of responses
- Add clarifications if responses are incomplete
- Update entries based on testing results

### Maintenance
- Review and update Q&A entries quarterly
- Remove obsolete information
- Add new procedures as they're developed
- Keep equipment documentation current

## Troubleshooting

### Documents Not Appearing in AI Responses

1. Check that the knowledge base was rebuilt after upload
2. Verify the document contains searchable text (not just images)
3. Try asking more specific questions
4. Check the knowledge base stats to confirm the document was indexed

### Q&A Entries Not Working

1. Verify the entry was saved (check the existing entries list)
2. Rebuild the knowledge base manually: `npm run build-knowledge-base`
3. Test with the exact question you entered
4. Try rephrasing the question

### Upload Failures

1. Check file format (must be PDF, MD, or TXT)
2. Verify file size is reasonable (< 50MB recommended)
3. Check server logs for errors
4. Ensure the `uploads/` directory exists and is writable

### Knowledge Base Not Updating

1. Check that `data/` directory exists
2. Verify write permissions on `data/ai-knowledge-base.json`
3. Manually rebuild: `npm run build-knowledge-base`
4. Check server logs for errors

## Security Considerations

- **Access Control**: The Teaching Interface is accessible to all users with access to the AI Hub
- **File Validation**: Only PDF, MD, and TXT files are accepted
- **Storage Location**: Uploaded files are stored locally on the server
- **Data Privacy**: All training data stays on your local system
- **Backup**: Include `uploads/` and `data/qa-entries.json` in your backup procedures

## Future Enhancements

Planned features for future releases:

- **Bulk Q&A Import**: Import Q&A entries from CSV/JSON files
- **Document Preview**: Preview uploaded documents before processing
- **Search Training Data**: Search through uploaded documents and Q&A entries
- **Training Analytics**: Track which training data is most frequently used
- **Version Control**: Track changes to Q&A entries over time
- **Export/Import**: Export and import training data for backup or sharing
- **AI Feedback**: Rate AI responses to improve training

## Support

For issues or questions about the AI Teaching Interface:

1. Check this documentation
2. Review the AI Backend Setup guide: `docs/AI_BACKEND_SETUP.md`
3. Run the AI verification script: `npm run verify-ai`
4. Check server logs for errors
5. Test the knowledge base manually

## Version History

- **v1.0** (2025-10-05): Initial release
  - Document upload functionality
  - Q&A training interface
  - AI testing capabilities
  - Knowledge base statistics
  - Automatic knowledge base rebuilding
