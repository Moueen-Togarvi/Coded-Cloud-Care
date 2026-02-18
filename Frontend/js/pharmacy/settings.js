// Pharmacy Settings Logic

document.addEventListener('DOMContentLoaded', function () {
    fetchSettings();
});

let logoBase64 = '';

function previewLogo(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        alert('Image size must be less than 2MB');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        logoBase64 = e.target.result;
        const preview = document.getElementById('logoPreview');
        const placeholder = document.getElementById('logoPlaceholder');
        if (preview && placeholder) {
            preview.src = logoBase64;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
        }
    };
    reader.readAsDataURL(file);
}

async function fetchSettings() {
    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return;
        const headers = { 'Authorization': `Bearer ${token}` };

        // 1. Fetch User Profile
        const userRes = await fetch('/api/auth/me', { headers });
        const userData = await userRes.json();
        if (userData.success) {
            document.getElementById('adminName').value = userData.data.name || '';
            document.getElementById('adminEmail').value = userData.data.email || '';
        }

        // 2. Fetch Pharmacy Details
        const settingsRes = await fetch('/api/settings', { headers });
        const settingsData = await settingsRes.json();
        if (settingsData.success && settingsData.data) {
            const s = settingsData.data;
            document.getElementById('pharmacyName').value = s.clinicName || '';
            document.getElementById('pharmacyTaxId').value = s.taxId || '';
            document.getElementById('pharmacyAddress').value = s.clinicAddress || '';

            if (s.clinicLogo) {
                logoBase64 = s.clinicLogo;
                const preview = document.getElementById('logoPreview');
                const placeholder = document.getElementById('logoPlaceholder');
                if (preview && placeholder) {
                    preview.src = s.clinicLogo;
                    preview.classList.remove('hidden');
                    placeholder.classList.add('hidden');
                }
            }
        }

    } catch (error) {
        console.error('Error fetching settings:', error);
    }
}

async function saveSettings() {
    try {
        const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return;

        const payload = {
            clinicName: document.getElementById('pharmacyName').value,
            clinicAddress: document.getElementById('pharmacyAddress').value,
            taxId: document.getElementById('pharmacyTaxId').value,
            clinicLogo: logoBase64
        };

        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            showAlert('Settings saved successfully!', 'success');
        } else {
            showAlert('Failed: ' + result.message, 'error');
        }

    } catch (e) {
        console.error('Error saving settings:', e);
        showAlert('An error occurred while saving settings', 'error');
    }
}

// Sidebar etc.
window.previewLogo = previewLogo;
window.saveSettings = saveSettings;
