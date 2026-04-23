document.addEventListener('DOMContentLoaded', () => {
  // Form validation
  const forms = document.querySelectorAll('form[data-validate]');
  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      const requiredFields = form.querySelectorAll('[required]');
      let isValid = true;
      requiredFields.forEach(field => {
        const errorEl = field.parentElement.querySelector('.field-error');
        if (errorEl) errorEl.remove();
        if (!field.value.trim()) {
          isValid = false;
          field.style.borderColor = '#dc2626';
          const error = document.createElement('small');
          error.className = 'field-error';
          error.style.cssText = 'color:#dc2626;font-size:12px;margin-top:4px;display:block';
          error.textContent = `${field.getAttribute('data-label') || 'This field'} is required`;
          field.parentElement.appendChild(error);
        } else { field.style.borderColor = ''; }
      });
      const emailFields = form.querySelectorAll('input[type="email"]');
      emailFields.forEach(field => {
        if (field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
          isValid = false;
          field.style.borderColor = '#dc2626';
          if (!field.parentElement.querySelector('.field-error')) {
            const error = document.createElement('small');
            error.className = 'field-error';
            error.style.cssText = 'color:#dc2626;font-size:12px;margin-top:4px;display:block';
            error.textContent = 'Please enter a valid email address';
            field.parentElement.appendChild(error);
          }
        }
      });
      if (!isValid) e.preventDefault();
    });
  });

  // Clear field errors on input
  document.querySelectorAll('.form-control').forEach(field => {
    field.addEventListener('input', () => {
      field.style.borderColor = '';
      const errorEl = field.parentElement.querySelector('.field-error');
      if (errorEl) errorEl.remove();
    });
  });

  // Auto-dismiss alerts
  document.querySelectorAll('.alert').forEach(alert => {
    setTimeout(() => {
      alert.style.opacity = '0';
      alert.style.transform = 'translateY(-6px)';
      alert.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      setTimeout(() => alert.remove(), 250);
    }, 5000);
  });

  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('open');
    });
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      });
    }
  }

  // Cart quantity auto-submit
  document.querySelectorAll('.qty-select').forEach(select => {
    select.addEventListener('change', () => {
      select.closest('form').submit();
    });
  });

  // Role tab switching (login page)
  const roleTabs = document.querySelectorAll('.role-tab');
  const roleInput = document.getElementById('role-input');
  roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      roleTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (roleInput) roleInput.value = tab.dataset.role;
    });
  });
});
