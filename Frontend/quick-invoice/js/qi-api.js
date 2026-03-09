(function () {
  const API_BASE = `${window.location.origin}/api/quick-invoice`;

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const hasBody = options.body !== undefined && options.body !== null;
    const isFormData = hasBody && options.body instanceof FormData;

    if (hasBody && !isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (response.status === 401) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/Frontend/comp/Login.html?product=quick-invoice&next=${next}`;
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

  function formatCurrency(value) {
    const amount = Number(value || 0);
    return `PKR ${amount.toLocaleString('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatDateInput(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getInitials(name) {
    return String(name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase())
      .join('') || 'NA';
  }

  function statusLabel(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'partially_paid') return 'Partial';
    if (s === 'unpaid') return 'Unpaid';
    if (s === 'overdue') return 'Overdue';
    if (s === 'paid') return 'Paid';
    return s.replace(/_/g, ' ') || 'Unknown';
  }

  function statusClasses(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'paid') return 'bg-emerald-100 text-emerald-700';
    if (s === 'partially_paid') return 'bg-amber-100 text-amber-700';
    if (s === 'overdue') return 'bg-rose-100 text-rose-700';
    return 'bg-slate-100 text-slate-700';
  }

  window.QiApi = {
    request,
    formatCurrency,
    formatDate,
    formatDateInput,
    escapeHtml,
    getInitials,
    statusLabel,
    statusClasses,
  };
})();
