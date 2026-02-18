// Patients Management Module
// Handles CRUD operations for patient records

// Load all patients
async function loadPatients() {
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/patients`);
        const data = await response.json();

        if (data.success) {
            displayPatients(data.data);
        } else {
            showError('Failed to load patients');
        }
    } catch (error) {
        console.error('Load patients error:', error);
        showError('Failed to load patients');
    }
}

// Display patients in the table
function displayPatients(patients) {
    const tableBody = document.getElementById('patientsTableBody');

    if (!tableBody) return;

    if (patients.length === 0) {
        tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-gray-500">
          No patients found. Click "Add Patient" to create one.
        </td>
      </tr>
    `;
        return;
    }

    tableBody.innerHTML = patients.map(patient => `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm font-medium text-gray-900">${patient.firstName} ${patient.lastName}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm text-gray-500">${patient.email || 'N/A'}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm text-gray-500">${patient.phone || 'N/A'}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="text-sm text-gray-500">${patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : 'N/A'}</div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${patient.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
          ${patient.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <button onclick="editPatient('${patient._id}')" class="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
        <button onclick="deletePatient('${patient._id}')" class="text-red-600 hover:text-red-900">Delete</button>
      </td>
    </tr>
  `).join('');
}

// Create new patient
async function createPatient(formData) {
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/patients`, {
            method: 'POST',
            body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Patient created successfully');
            loadPatients(); // Reload the list
            return true;
        } else {
            showError(data.message || 'Failed to create patient');
            return false;
        }
    } catch (error) {
        console.error('Create patient error:', error);
        showError('Failed to create patient');
        return false;
    }
}

// Update patient
async function updatePatient(patientId, formData) {
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/patients/${patientId}`, {
            method: 'PUT',
            body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Patient updated successfully');
            loadPatients(); // Reload the list
            return true;
        } else {
            showError(data.message || 'Failed to update patient');
            return false;
        }
    } catch (error) {
        console.error('Update patient error:', error);
        showError('Failed to update patient');
        return false;
    }
}

// Delete patient
async function deletePatient(patientId) {
    if (!confirm('Are you sure you want to delete this patient?')) {
        return;
    }

    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/patients/${patientId}`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Patient deleted successfully');
            loadPatients(); // Reload the list
        } else {
            showError(data.message || 'Failed to delete patient');
        }
    } catch (error) {
        console.error('Delete patient error:', error);
        showError('Failed to delete patient');
    }
}

// Handle patient form submission
function setupPatientForm() {
    const form = document.getElementById('patientForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            dateOfBirth: document.getElementById('dateOfBirth').value,
            address: document.getElementById('address').value,
            medicalHistory: document.getElementById('medicalHistory').value,
        };

        const patientId = document.getElementById('patientId').value;

        let success;
        if (patientId) {
            success = await updatePatient(patientId, formData);
        } else {
            success = await createPatient(formData);
        }

        if (success) {
            form.reset();
            closePatientModal();
        }
    });
}

// Modal management
function openPatientModal(patientId = null) {
    const modal = document.getElementById('patientModal');
    const form = document.getElementById('patientForm');

    if (!modal || !form) return;

    if (patientId) {
        // Load patient data for editing
        loadPatientForEdit(patientId);
    } else {
        form.reset();
        document.getElementById('patientId').value = '';
        document.getElementById('modalTitle').textContent = 'Add New Patient';
    }

    modal.classList.remove('hidden');
}

function closePatientModal() {
    const modal = document.getElementById('patientModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function loadPatientForEdit(patientId) {
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/patients/${patientId}`);
        const data = await response.json();

        if (data.success) {
            const patient = data.data;
            document.getElementById('patientId').value = patient._id;
            document.getElementById('firstName').value = patient.firstName;
            document.getElementById('lastName').value = patient.lastName;
            document.getElementById('email').value = patient.email || '';
            document.getElementById('phone').value = patient.phone || '';
            document.getElementById('dateOfBirth').value = patient.dateOfBirth ? patient.dateOfBirth.split('T')[0] : '';
            document.getElementById('address').value = patient.address || '';
            document.getElementById('medicalHistory').value = patient.medicalHistory || '';
            document.getElementById('modalTitle').textContent = 'Edit Patient';
        }
    } catch (error) {
        console.error('Load patient error:', error);
        showError('Failed to load patient details');
    }
}

// Alias for compatibility
function editPatient(patientId) {
    openPatientModal(patientId);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupPatientForm();

    // Load patients if on the patients tab
    const patientsTab = document.querySelector('[data-tab="patients"]');
    if (patientsTab && patientsTab.classList.contains('active')) {
        loadPatients();
    }
});
