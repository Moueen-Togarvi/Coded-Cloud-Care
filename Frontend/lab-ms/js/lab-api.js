(function () {
  const API_BASE = `${window.location.origin}/api/lab`;

  async function request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (response.status === 401) {
      window.location.href = '/Frontend/comp/Login.html?product=lab-reporting';
      throw new Error('Authentication required');
    }

    let payload = {};
    try {
      payload = await response.json();
    } catch (_) {
      payload = {};
    }

    if (!response.ok || payload.success === false) {
      const message = payload.message || `Request failed (${response.status})`;
      throw new Error(message);
    }

    return payload;
  }

  function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
  }

  function formatCurrency(value) {
    const n = Number(value || 0);
    return `PKR ${n.toLocaleString('en-US')}`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  window.LabApi = {
    request,
    formatDate,
    formatCurrency,
    escapeHtml,
  };
})();
