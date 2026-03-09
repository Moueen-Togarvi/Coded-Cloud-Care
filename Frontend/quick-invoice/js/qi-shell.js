(function () {
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function createModal({ title, contentHtml, widthClass = 'max-w-2xl', closeOnOverlay = true }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'fixed inset-0 z-[110] flex items-center justify-center p-4';
    wrapper.innerHTML = `
      <div class="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" data-role="overlay"></div>
      <div class="relative w-full ${widthClass} rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 class="text-lg font-black tracking-tight text-slate-900" data-role="title"></h3>
          <button type="button" class="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" data-role="x">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="px-5 py-4 overflow-y-auto" data-role="content"></div>
      </div>
    `;

    wrapper.querySelector('[data-role="title"]').textContent = title || 'Action Required';
    wrapper.querySelector('[data-role="content"]').innerHTML = contentHtml || '';

    const closeBtn = wrapper.querySelector('[data-role="x"]');
    const overlay = wrapper.querySelector('[data-role="overlay"]');
    closeBtn.addEventListener('click', () => closeModal(wrapper));
    if (closeOnOverlay) {
      overlay.addEventListener('click', () => closeModal(wrapper));
    }

    document.body.appendChild(wrapper);
    return wrapper;
  }

  function closeModal(modal) {
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
  }

  function alert(message, opts = {}) {
    return new Promise((resolve) => {
      const modal = createModal({
        title: opts.title || 'Notice',
        widthClass: 'max-w-md',
        contentHtml: `
          <p class="text-sm leading-6 text-slate-700 whitespace-pre-line">${escapeHtml(message)}</p>
          <div class="mt-5 flex justify-end">
            <button type="button" data-role="ok" class="px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-colors">OK</button>
          </div>
        `,
      });

      const done = () => {
        closeModal(modal);
        resolve(true);
      };

      modal.querySelector('[data-role="ok"]').addEventListener('click', done);
      const onEsc = (event) => {
        if (event.key === 'Escape') {
          document.removeEventListener('keydown', onEsc);
          done();
        }
      };
      document.addEventListener('keydown', onEsc);
    });
  }

  function confirm(message, opts = {}) {
    return new Promise((resolve) => {
      const modal = createModal({
        title: opts.title || 'Confirm',
        widthClass: 'max-w-md',
        closeOnOverlay: false,
        contentHtml: `
          <p class="text-sm leading-6 text-slate-700 whitespace-pre-line">${escapeHtml(message)}</p>
          <div class="mt-5 flex justify-end gap-2">
            <button type="button" data-role="cancel" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors">${escapeHtml(opts.cancelText || 'Cancel')}</button>
            <button type="button" data-role="confirm" class="px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-colors">${escapeHtml(opts.confirmText || 'Confirm')}</button>
          </div>
        `,
      });

      const finish = (result) => {
        closeModal(modal);
        resolve(Boolean(result));
      };

      modal.querySelector('[data-role="cancel"]').addEventListener('click', () => finish(false));
      modal.querySelector('[data-role="confirm"]').addEventListener('click', () => finish(true));
      const onEsc = (event) => {
        if (event.key === 'Escape') {
          document.removeEventListener('keydown', onEsc);
          finish(false);
        }
      };
      document.addEventListener('keydown', onEsc);
    });
  }

  function form(opts = {}) {
    const fields = Array.isArray(opts.fields) ? opts.fields : [];

    const fieldHtml = fields.map((field) => {
      const type = field.type || 'text';
      const value = field.value !== undefined ? String(field.value) : '';

      if (type === 'select') {
        const selectOptions = (field.options || []).map((opt) => {
          const selected = String(opt.value) === value ? 'selected' : '';
          return `<option value="${escapeHtml(opt.value)}" ${selected}>${escapeHtml(opt.label)}</option>`;
        }).join('');

        return `
          <label class="block">
            <span class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">${escapeHtml(field.label || field.name)}</span>
            <select name="${escapeHtml(field.name)}" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary">${selectOptions}</select>
          </label>
        `;
      }

      if (type === 'textarea') {
        return `
          <label class="block">
            <span class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">${escapeHtml(field.label || field.name)}</span>
            <textarea name="${escapeHtml(field.name)}" rows="${field.rows || 3}" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(value)}</textarea>
          </label>
        `;
      }

      return `
        <label class="block">
          <span class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">${escapeHtml(field.label || field.name)}</span>
          <input name="${escapeHtml(field.name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.min !== undefined ? `min="${escapeHtml(field.min)}"` : ''} ${field.max !== undefined ? `max="${escapeHtml(field.max)}"` : ''} ${field.step !== undefined ? `step="${escapeHtml(field.step)}"` : ''} class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary"/>
        </label>
      `;
    }).join('');

    return new Promise((resolve) => {
      const modal = createModal({
        title: opts.title || 'Form',
        closeOnOverlay: false,
        widthClass: opts.widthClass || 'max-w-lg',
        contentHtml: `
          <form data-role="form" class="space-y-3">
            ${fieldHtml}
            <div class="pt-2 flex justify-end gap-2">
              <button type="button" data-role="cancel" class="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors">${escapeHtml(opts.cancelText || 'Cancel')}</button>
              <button type="submit" class="px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-colors">${escapeHtml(opts.submitText || 'Save')}</button>
            </div>
          </form>
        `,
      });

      const formEl = modal.querySelector('[data-role="form"]');
      const cancelBtn = modal.querySelector('[data-role="cancel"]');

      const finish = (result) => {
        closeModal(modal);
        resolve(result);
      };

      cancelBtn.addEventListener('click', () => finish(null));
      formEl.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = {};

        for (const field of fields) {
          const input = formEl.elements.namedItem(field.name);
          if (!input) continue;
          const raw = String(input.value || '').trim();

          if (field.required && !raw) {
            input.focus();
            return;
          }

          data[field.name] = raw;
        }

        finish(data);
      });
    });
  }

  function initMobileSidebar() {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const closeBtn = document.getElementById('close-mobile-menu');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const overlay = document.getElementById('mobile-sidebar-overlay');

    if (mobileBtn && mobileSidebar) {
      mobileBtn.addEventListener('click', () => mobileSidebar.classList.remove('hidden'));
    }
    if (closeBtn && mobileSidebar) {
      closeBtn.addEventListener('click', () => mobileSidebar.classList.add('hidden'));
    }
    if (overlay && mobileSidebar) {
      overlay.addEventListener('click', () => mobileSidebar.classList.add('hidden'));
    }
  }

  window.QiUi = {
    alert,
    confirm,
    form,
    createModal,
    closeModal,
    escapeHtml,
    initMobileSidebar,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (window.QiUi) {
    window.QiUi.initMobileSidebar();
  }
});
