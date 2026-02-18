/**
 * Global Notification System
 * Replaces native alert() and confirm() with themed modals.
 */

window.showAlert = function (message, type = 'info') {
    const modalId = 'globalAlertModal';
    let modal = document.getElementById(modalId);

    if (!modal) {
        const modalHtml = `
            <div id="${modalId}" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center hidden">
                <div class="bg-navy-card border border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 transform transition-all scale-95 opacity-0 duration-200">
                    <div id="alertIconContainer" class="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span id="alertIcon" class="material-icons-round text-2xl">info</span>
                    </div>
                    <h3 id="alertTitle" class="text-white text-center font-bold mb-2">Notification</h3>
                    <p id="alertMessage" class="text-slate-400 text-center text-xs leading-relaxed mb-6"></p>
                    <button id="alertCloseBtn" class="w-full py-3 bg-primary-blue hover:bg-blue-600 text-white text-[10px] font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 uppercase tracking-widest">OK</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById(modalId);
    }

    const container = modal.querySelector('.bg-navy-card');
    const iconContainer = document.getElementById('alertIconContainer');
    const icon = document.getElementById('alertIcon');
    const title = document.getElementById('alertTitle');
    const msg = document.getElementById('alertMessage');
    const btn = document.getElementById('alertCloseBtn');

    // Set types
    if (type === 'success') {
        iconContainer.className = 'w-12 h-12 rounded-full bg-accent-green/10 text-accent-green flex items-center justify-center mx-auto mb-4';
        icon.innerText = 'check_circle';
        title.innerText = 'Success';
        btn.className = 'w-full py-3 bg-accent-green hover:bg-green-600 text-white text-[10px] font-bold rounded-xl transition-all shadow-lg shadow-green-500/20 uppercase tracking-widest';
    } else if (type === 'error') {
        iconContainer.className = 'w-12 h-12 rounded-full bg-accent-rose/10 text-accent-rose flex items-center justify-center mx-auto mb-4';
        icon.innerText = 'error';
        title.innerText = 'Error';
        btn.className = 'w-full py-3 bg-accent-rose hover:bg-rose-600 text-white text-[10px] font-bold rounded-xl transition-all shadow-lg shadow-rose-500/20 uppercase tracking-widest';
    } else if (type === 'warning') {
        iconContainer.className = 'w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4';
        icon.innerText = 'warning';
        title.innerText = 'Warning';
        btn.className = 'w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20 uppercase tracking-widest';
    } else {
        iconContainer.className = 'w-12 h-12 rounded-full bg-primary-blue/10 text-primary-blue flex items-center justify-center mx-auto mb-4';
        icon.innerText = 'info';
        title.innerText = 'Notification';
        btn.className = 'w-full py-3 bg-primary-blue hover:bg-blue-600 text-white text-[10px] font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 uppercase tracking-widest';
    }

    msg.innerText = message;

    // Show with animation
    modal.classList.remove('hidden');
    setTimeout(() => {
        container.classList.remove('scale-95', 'opacity-0');
        container.classList.add('scale-100', 'opacity-100');
    }, 10);

    const close = () => {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    };

    btn.onclick = close;
};

window.showConfirm = function (message, onConfirm, onCancel = null) {
    const modalId = 'globalConfirmModal';
    let modal = document.getElementById(modalId);

    if (!modal) {
        const modalHtml = `
            <div id="${modalId}" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center hidden">
                <div class="bg-navy-card border border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 transform transition-all scale-95 opacity-0 duration-200">
                    <div class="w-12 h-12 rounded-full bg-primary-blue/10 text-primary-blue flex items-center justify-center mx-auto mb-4">
                        <span class="material-icons-round text-2xl">help_outline</span>
                    </div>
                    <h3 class="text-white text-center font-bold mb-2">Are you sure?</h3>
                    <p id="confirmMessage" class="text-slate-400 text-center text-xs leading-relaxed mb-8"></p>
                    <div class="flex gap-3">
                        <button id="confirmCancelBtn" class="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest">Cancel</button>
                        <button id="confirmConfirmBtn" class="flex-1 py-3 bg-primary-blue hover:bg-blue-600 text-white text-[10px] font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 uppercase tracking-widest">Confirm</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById(modalId);
    }

    const container = modal.querySelector('.bg-navy-card');
    const msg = document.getElementById('confirmMessage');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    const confirmBtn = document.getElementById('confirmConfirmBtn');

    msg.innerText = message;

    // Show with animation
    modal.classList.remove('hidden');
    setTimeout(() => {
        container.classList.remove('scale-95', 'opacity-0');
        container.classList.add('scale-100', 'opacity-100');
    }, 10);

    const close = () => {
        container.classList.remove('scale-100', 'opacity-100');
        container.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    };

    confirmBtn.onclick = () => {
        close();
        if (onConfirm) onConfirm();
    };

    cancelBtn.onclick = () => {
        close();
        if (onCancel) onCancel();
    };
};
