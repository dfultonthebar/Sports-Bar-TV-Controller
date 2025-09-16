"""
Label Management Web Interface
Flask blueprint for managing input/output labels and visual mapping
"""

from flask import Blueprint, render_template, request, jsonify, redirect, url_for
import json
import logging
from pathlib import Path
from typing import Dict, Any

# Configure logging
logger = logging.getLogger(__name__)

class LabelManager:
    """
    Label Management System for Wolfpack Matrix
    Handles CRUD operations for input/output labels
    """
    
    def __init__(self, labels_file: str = "config/labels.json"):
        self.labels_file = labels_file
        self.labels_data = {}
        self.load_labels()
    
    def load_labels(self):
        """Load labels from file"""
        try:
            if Path(self.labels_file).exists():
                with open(self.labels_file, 'r') as f:
                    self.labels_data = json.load(f)
            else:
                self.create_default_labels()
                self.save_labels()
        except Exception as e:
            logger.error(f"Failed to load labels: {e}")
            self.create_default_labels()
    
    def create_default_labels(self):
        """Create default labels structure"""
        self.labels_data = {
            'inputs': {str(i): f"Input {i}" for i in range(1, 37)},
            'outputs': {str(i): f"Output {i}" for i in range(1, 37)},
            'matrix_info': {
                'total_inputs': 36,
                'total_outputs': 36,
                'last_updated': ''
            }
        }
    
    def save_labels(self):
        """Save labels to file"""
        try:
            Path(self.labels_file).parent.mkdir(parents=True, exist_ok=True)
            with open(self.labels_file, 'w') as f:
                json.dump(self.labels_data, f, indent=2)
            logger.info(f"Saved labels to {self.labels_file}")
        except Exception as e:
            logger.error(f"Failed to save labels: {e}")
    
    def get_all_labels(self) -> Dict[str, Any]:
        """Get all labels"""
        return self.labels_data.copy()
    
    def update_input_label(self, input_num: int, label: str):
        """Update input label"""
        self.labels_data['inputs'][str(input_num)] = label
        self.save_labels()
    
    def update_output_label(self, output_num: int, label: str):
        """Update output label"""
        self.labels_data['outputs'][str(output_num)] = label
        self.save_labels()
    
    def bulk_update_labels(self, input_labels: Dict[str, str] = None, output_labels: Dict[str, str] = None):
        """Bulk update labels"""
        if input_labels:
            self.labels_data['inputs'].update(input_labels)
        if output_labels:
            self.labels_data['outputs'].update(output_labels)
        self.save_labels()

# Create Flask blueprint
label_bp = Blueprint('labels', __name__, url_prefix='/labels')
label_manager = LabelManager()

@label_bp.route('/')
def label_editor():
    """Main label editor page"""
    return render_template('label_editor.html')

@label_bp.route('/api/labels')
def get_labels():
    """API endpoint to get all labels"""
    try:
        labels = label_manager.get_all_labels()
        return jsonify(labels)
    except Exception as e:
        logger.error(f"Get labels API error: {e}")
        return jsonify({'error': str(e)}), 500

@label_bp.route('/api/labels/input/<int:input_num>', methods=['PUT'])
def update_input_label(input_num):
    """API endpoint to update input label"""
    try:
        data = request.get_json()
        label = data.get('label', '').strip()
        
        if not label:
            return jsonify({'error': 'Label cannot be empty'}), 400
        
        if not (1 <= input_num <= 36):
            return jsonify({'error': 'Input number must be between 1 and 36'}), 400
        
        label_manager.update_input_label(input_num, label)
        return jsonify({'success': True, 'input': input_num, 'label': label})
    
    except Exception as e:
        logger.error(f"Update input label API error: {e}")
        return jsonify({'error': str(e)}), 500

@label_bp.route('/api/labels/output/<int:output_num>', methods=['PUT'])
def update_output_label(output_num):
    """API endpoint to update output label"""
    try:
        data = request.get_json()
        label = data.get('label', '').strip()
        
        if not label:
            return jsonify({'error': 'Label cannot be empty'}), 400
        
        if not (1 <= output_num <= 36):
            return jsonify({'error': 'Output number must be between 1 and 36'}), 400
        
        label_manager.update_output_label(output_num, label)
        return jsonify({'success': True, 'output': output_num, 'label': label})
    
    except Exception as e:
        logger.error(f"Update output label API error: {e}")
        return jsonify({'error': str(e)}), 500

@label_bp.route('/api/labels/bulk', methods=['PUT'])
def bulk_update_labels():
    """API endpoint for bulk label updates"""
    try:
        data = request.get_json()
        input_labels = data.get('inputs', {})
        output_labels = data.get('outputs', {})
        
        # Validate input labels
        for input_num, label in input_labels.items():
            if not (1 <= int(input_num) <= 36):
                return jsonify({'error': f'Invalid input number: {input_num}'}), 400
            if not label.strip():
                return jsonify({'error': f'Empty label for input {input_num}'}), 400
        
        # Validate output labels
        for output_num, label in output_labels.items():
            if not (1 <= int(output_num) <= 36):
                return jsonify({'error': f'Invalid output number: {output_num}'}), 400
            if not label.strip():
                return jsonify({'error': f'Empty label for output {output_num}'}), 400
        
        label_manager.bulk_update_labels(input_labels, output_labels)
        return jsonify({'success': True, 'updated_inputs': len(input_labels), 'updated_outputs': len(output_labels)})
    
    except Exception as e:
        logger.error(f"Bulk update labels API error: {e}")
        return jsonify({'error': str(e)}), 500

@label_bp.route('/visual-map')
def visual_map():
    """Visual mapping interface"""
    return render_template('visual_map.html')

@label_bp.route('/api/visual-map/data')
def get_visual_map_data():
    """Get data for visual mapping interface"""
    try:
        labels = label_manager.get_all_labels()
        
        # Create visual map data structure
        map_data = {
            'inputs': [],
            'outputs': [],
            'connections': []
        }
        
        # Add inputs
        for i in range(1, 37):
            map_data['inputs'].append({
                'id': i,
                'label': labels['inputs'].get(str(i), f'Input {i}'),
                'x': 50,  # Left side
                'y': 20 + (i - 1) * 25
            })
        
        # Add outputs
        for i in range(1, 37):
            map_data['outputs'].append({
                'id': i,
                'label': labels['outputs'].get(str(i), f'Output {i}'),
                'x': 800,  # Right side
                'y': 20 + (i - 1) * 25
            })
        
        return jsonify(map_data)
    
    except Exception as e:
        logger.error(f"Visual map data API error: {e}")
        return jsonify({'error': str(e)}), 500

@label_bp.route('/presets')
def preset_templates():
    """Preset template management"""
    return render_template('preset_templates.html')

@label_bp.route('/api/presets/sports-bar')
def get_sports_bar_presets():
    """Get predefined sports bar preset templates"""
    try:
        presets = {
            'big_game': {
                'name': 'Big Game Mode',
                'description': 'All main TVs show the primary game feed',
                'routes': {str(i): 1 for i in range(1, 13)},  # First 12 outputs to ESPN
                'inputs_used': [1],
                'outputs_used': list(range(1, 13))
            },
            'multi_game': {
                'name': 'Multi-Game Mode',
                'description': 'Different games on different TV zones',
                'routes': {
                    '1': 1, '2': 1, '3': 1, '4': 1,  # Main bar - ESPN
                    '5': 2, '6': 2,  # Patio - Fox Sports
                    '7': 3, '8': 3,  # Dining - NBC Sports
                    '9': 4,  # Private room - Local
                    '10': 1, '11': 1,  # Pool tables - ESPN
                    '12': 2  # VIP - Fox Sports
                },
                'inputs_used': [1, 2, 3, 4],
                'outputs_used': list(range(1, 13))
            },
            'menu_mode': {
                'name': 'Menu/Info Mode',
                'description': 'All TVs show menu channel or info displays',
                'routes': {str(i): 8 for i in range(1, 37)},  # All outputs to menu channel
                'inputs_used': [8],
                'outputs_used': list(range(1, 37))
            },
            'zone_split': {
                'name': 'Zone Split Mode',
                'description': 'Different content for different bar zones',
                'routes': {
                    # Main bar zone
                    '1': 1, '2': 1, '3': 1, '4': 1,
                    # Patio zone
                    '5': 7, '6': 7,  # Music videos
                    # Dining zone
                    '7': 6, '8': 6,  # Weather channel
                    # Game area
                    '10': 2, '11': 2,  # Fox Sports
                    # VIP area
                    '12': 1,  # ESPN
                    # Background displays
                    '13': 8, '14': 8, '15': 8, '16': 8  # Menu channel
                },
                'inputs_used': [1, 2, 6, 7, 8],
                'outputs_used': [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16]
            }
        }
        
        return jsonify(presets)
    
    except Exception as e:
        logger.error(f"Sports bar presets API error: {e}")
        return jsonify({'error': str(e)}), 500

# Template creation functions
def create_label_templates():
    """Create HTML templates for label management"""
    templates_dir = Path("ui/templates")
    templates_dir.mkdir(parents=True, exist_ok=True)
    
    # Label Editor Template
    label_editor_html = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wolfpack Matrix - Label Editor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .nav-tabs {
            display: flex;
            justify-content: center;
            margin-bottom: 30px;
            gap: 10px;
        }
        
        .nav-tab {
            padding: 12px 24px;
            background: rgba(255,255,255,0.1);
            border: none;
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s;
        }
        
        .nav-tab.active {
            background: rgba(255,255,255,0.3);
            border-bottom: 3px solid #44ff44;
        }
        
        .nav-tab:hover {
            background: rgba(255,255,255,0.2);
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .labels-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        
        .labels-section {
            background: rgba(255,255,255,0.1);
            padding: 25px;
            border-radius: 15px;
        }
        
        .labels-section h2 {
            margin-bottom: 20px;
            text-align: center;
            font-size: 1.5em;
            border-bottom: 2px solid rgba(255,255,255,0.3);
            padding-bottom: 10px;
        }
        
        .label-item {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
            gap: 15px;
        }
        
        .label-number {
            min-width: 40px;
            text-align: center;
            font-weight: bold;
            background: rgba(255,255,255,0.2);
            padding: 8px;
            border-radius: 5px;
        }
        
        .label-input {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 5px;
            background: rgba(255,255,255,0.9);
            color: #333;
            font-size: 14px;
        }
        
        .label-input:focus {
            outline: none;
            box-shadow: 0 0 5px rgba(68,255,68,0.5);
        }
        
        .save-button {
            background: #44ff44;
            color: #333;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s;
        }
        
        .save-button:hover {
            background: #33dd33;
            transform: translateY(-1px);
        }
        
        .bulk-actions {
            text-align: center;
            margin: 30px 0;
        }
        
        .bulk-button {
            background: #ff6b35;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            margin: 0 10px;
            transition: all 0.3s;
        }
        
        .bulk-button:hover {
            background: #e55a2b;
            transform: translateY(-2px);
        }
        
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            transform: translateX(400px);
            transition: transform 0.3s;
        }
        
        .notification.show {
            transform: translateX(0);
        }
        
        .notification.success {
            background: #44ff44;
            color: #333;
        }
        
        .notification.error {
            background: #ff4444;
        }
        
        .search-box {
            width: 100%;
            padding: 12px;
            margin-bottom: 20px;
            border: none;
            border-radius: 8px;
            background: rgba(255,255,255,0.9);
            color: #333;
            font-size: 16px;
        }
        
        .search-box::placeholder {
            color: #666;
        }
        
        @media (max-width: 768px) {
            .labels-grid {
                grid-template-columns: 1fr;
            }
            
            .nav-tabs {
                flex-direction: column;
                align-items: center;
            }
            
            .label-item {
                flex-direction: column;
                align-items: stretch;
            }
            
            .label-number {
                text-align: left;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎛️ Wolfpack Matrix Label Editor</h1>
            <p>Customize Input and Output Labels for 36x36 Matrix</p>
        </div>
        
        <div class="nav-tabs">
            <button class="nav-tab active" onclick="showTab('labels')">Edit Labels</button>
            <button class="nav-tab" onclick="showTab('visual')">Visual Map</button>
            <button class="nav-tab" onclick="showTab('presets')">Preset Templates</button>
        </div>
        
        <div id="labels-tab" class="tab-content active">
            <div class="labels-grid">
                <div class="labels-section">
                    <h2>📺 Input Sources</h2>
                    <input type="text" class="search-box" placeholder="Search inputs..." onkeyup="filterLabels('inputs', this.value)">
                    <div id="inputs-container">
                        <!-- Input labels will be loaded here -->
                    </div>
                </div>
                
                <div class="labels-section">
                    <h2>🖥️ Output Destinations</h2>
                    <input type="text" class="search-box" placeholder="Search outputs..." onkeyup="filterLabels('outputs', this.value)">
                    <div id="outputs-container">
                        <!-- Output labels will be loaded here -->
                    </div>
                </div>
            </div>
            
            <div class="bulk-actions">
                <button class="bulk-button" onclick="saveAllLabels()">💾 Save All Changes</button>
                <button class="bulk-button" onclick="resetToDefaults()">🔄 Reset to Defaults</button>
                <button class="bulk-button" onclick="exportLabels()">📤 Export Labels</button>
                <button class="bulk-button" onclick="importLabels()">📥 Import Labels</button>
            </div>
        </div>
        
        <div id="visual-tab" class="tab-content">
            <div style="text-align: center; padding: 50px;">
                <h2>🗺️ Visual Matrix Map</h2>
                <p>Interactive visual representation of your matrix routing</p>
                <button class="bulk-button" onclick="loadVisualMap()">Load Visual Map</button>
                <div id="visual-map-container" style="margin-top: 30px;">
                    <!-- Visual map will be loaded here -->
                </div>
            </div>
        </div>
        
        <div id="presets-tab" class="tab-content">
            <div style="text-align: center; padding: 50px;">
                <h2>⚡ Preset Templates</h2>
                <p>Pre-configured routing templates for common sports bar scenarios</p>
                <button class="bulk-button" onclick="loadPresetTemplates()">Load Preset Templates</button>
                <div id="presets-container" style="margin-top: 30px;">
                    <!-- Presets will be loaded here -->
                </div>
            </div>
        </div>
    </div>
    
    <div id="notification" class="notification"></div>
    
    <script>
        let currentLabels = {};
        let unsavedChanges = {};
        
        // Load labels on page load
        document.addEventListener('DOMContentLoaded', function() {
            loadLabels();
        });
        
        // Tab switching
        function showTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab
            document.getElementById(tabName + '-tab').classList.add('active');
            event.target.classList.add('active');
        }
        
        // Load labels from API
        async function loadLabels() {
            try {
                const response = await fetch('/labels/api/labels');
                const data = await response.json();
                currentLabels = data;
                renderLabels();
            } catch (error) {
                showNotification('Failed to load labels: ' + error.message, 'error');
            }
        }
        
        // Render labels in the UI
        function renderLabels() {
            renderInputs();
            renderOutputs();
        }
        
        function renderInputs() {
            const container = document.getElementById('inputs-container');
            container.innerHTML = '';
            
            for (let i = 1; i <= 36; i++) {
                const label = currentLabels.inputs[i.toString()] || `Input ${i}`;
                const item = createLabelItem(i, label, 'input');
                container.appendChild(item);
            }
        }
        
        function renderOutputs() {
            const container = document.getElementById('outputs-container');
            container.innerHTML = '';
            
            for (let i = 1; i <= 36; i++) {
                const label = currentLabels.outputs[i.toString()] || `Output ${i}`;
                const item = createLabelItem(i, label, 'output');
                container.appendChild(item);
            }
        }
        
        function createLabelItem(number, label, type) {
            const item = document.createElement('div');
            item.className = 'label-item';
            item.innerHTML = `
                <div class="label-number">${number}</div>
                <input type="text" class="label-input" value="${label}" 
                       onchange="updateLabel(${number}, this.value, '${type}')"
                       data-number="${number}" data-type="${type}">
                <button class="save-button" onclick="saveLabel(${number}, '${type}')">Save</button>
            `;
            return item;
        }
        
        function updateLabel(number, value, type) {
            if (!unsavedChanges[type]) {
                unsavedChanges[type] = {};
            }
            unsavedChanges[type][number.toString()] = value;
        }
        
        async function saveLabel(number, type) {
            const input = document.querySelector(`input[data-number="${number}"][data-type="${type}"]`);
            const label = input.value.trim();
            
            if (!label) {
                showNotification('Label cannot be empty', 'error');
                return;
            }
            
            try {
                const endpoint = `/labels/api/labels/${type}/${number}`;
                const response = await fetch(endpoint, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ label: label })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} ${number} label updated`, 'success');
                    // Update local data
                    currentLabels[type + 's'][number.toString()] = label;
                    // Remove from unsaved changes
                    if (unsavedChanges[type]) {
                        delete unsavedChanges[type][number.toString()];
                    }
                } else {
                    showNotification('Failed to update label: ' + result.error, 'error');
                }
            } catch (error) {
                showNotification('Failed to update label: ' + error.message, 'error');
            }
        }
        
        async function saveAllLabels() {
            if (Object.keys(unsavedChanges).length === 0) {
                showNotification('No changes to save', 'error');
                return;
            }
            
            try {
                const response = await fetch('/labels/api/labels/bulk', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(unsavedChanges)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification(`Saved ${result.updated_inputs} input and ${result.updated_outputs} output labels`, 'success');
                    unsavedChanges = {};
                    loadLabels(); // Reload to sync
                } else {
                    showNotification('Failed to save labels: ' + result.error, 'error');
                }
            } catch (error) {
                showNotification('Failed to save labels: ' + error.message, 'error');
            }
        }
        
        function filterLabels(type, searchTerm) {
            const container = document.getElementById(type + '-container');
            const items = container.querySelectorAll('.label-item');
            
            items.forEach(item => {
                const input = item.querySelector('.label-input');
                const label = input.value.toLowerCase();
                const number = input.dataset.number;
                
                if (label.includes(searchTerm.toLowerCase()) || number.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        }
        
        function resetToDefaults() {
            if (confirm('Are you sure you want to reset all labels to defaults? This cannot be undone.')) {
                // This would need to call an API endpoint to reset labels
                showNotification('Reset functionality would be implemented here', 'error');
            }
        }
        
        function exportLabels() {
            const dataStr = JSON.stringify(currentLabels, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'wolfpack_labels.json';
            link.click();
            URL.revokeObjectURL(url);
            showNotification('Labels exported successfully', 'success');
        }
        
        function importLabels() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            const importedLabels = JSON.parse(e.target.result);
                            // Validate and import labels
                            showNotification('Import functionality would be implemented here', 'error');
                        } catch (error) {
                            showNotification('Invalid JSON file', 'error');
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        }
        
        function loadVisualMap() {
            showNotification('Visual map functionality would be implemented here', 'error');
        }
        
        function loadPresetTemplates() {
            showNotification('Preset templates functionality would be implemented here', 'error');
        }
        
        function showNotification(message, type) {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.className = `notification ${type} show`;
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
    </script>
</body>
</html>'''
    
    with open(templates_dir / "label_editor.html", "w") as f:
        f.write(label_editor_html)
    
    # Visual Map Template
    visual_map_html = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wolfpack Matrix - Visual Map</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            margin: 0;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        #visual-map {
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            padding: 20px;
            min-height: 600px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗺️ Wolfpack Matrix Visual Map</h1>
            <p>Interactive visual representation of your 36x36 matrix</p>
        </div>
        
        <div id="visual-map">
            <p>Visual mapping interface will be implemented here with SVG or Canvas</p>
        </div>
    </div>
</body>
</html>'''
    
    with open(templates_dir / "visual_map.html", "w") as f:
        f.write(visual_map_html)

if __name__ == "__main__":
    create_label_templates()
    print("✅ Created label management templates")
