// Sports Bar TV Controller Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Load system status
    fetch('/api/status')
        .then(response => response.json())
        .then(data => {
            document.getElementById('system-status').innerHTML = 
                `<strong>Status:</strong> ${data.status}<br>
                 <strong>AV Manager:</strong> ${data.av_manager ? 'Connected' : 'Disconnected'}`;
        })
        .catch(error => {
            document.getElementById('system-status').innerHTML = 
                '<span class="text-danger">Error loading status</span>';
        });
    
    // Load device list
    fetch('/api/devices')
        .then(response => response.json())
        .then(data => {
            const deviceList = document.getElementById('device-list');
            if (data.devices && data.devices.length > 0) {
                deviceList.innerHTML = data.devices.map(device => 
                    `<div class="mb-2">
                        <strong>${device.name}</strong> (${device.type})
                        <span class="badge bg-success ms-2">${device.status}</span>
                     </div>`
                ).join('');
            } else {
                deviceList.innerHTML = '<em>No devices connected</em>';
            }
        })
        .catch(error => {
            document.getElementById('device-list').innerHTML = 
                '<span class="text-danger">Error loading devices</span>';
        });
});
