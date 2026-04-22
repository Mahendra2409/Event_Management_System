// Client-side validation and interactions
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
          field.style.borderColor = '#ef476f';
          const error = document.createElement('small');
          error.className = 'field-error';
          error.style.color = '#ef476f';
          error.style.fontSize = '0.8rem';
          error.style.marginTop = '0.3rem';
          error.style.display = 'block';
          error.textContent = `${field.getAttribute('data-label') || 'This field'} is required`;
          field.parentElement.appendChild(error);
        } else {
          field.style.borderColor = '';
        }
      });

      // Email validation
      const emailFields = form.querySelectorAll('input[type="email"]');
      emailFields.forEach(field => {
        if (field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
          isValid = false;
          field.style.borderColor = '#ef476f';
          const existing = field.parentElement.querySelector('.field-error');
          if (!existing) {
            const error = document.createElement('small');
            error.className = 'field-error';
            error.style.color = '#ef476f';
            error.style.fontSize = '0.8rem';
            error.style.marginTop = '0.3rem';
            error.style.display = 'block';
            error.textContent = 'Please enter a valid email address';
            field.parentElement.appendChild(error);
          }
        }
      });

      if (!isValid) {
        e.preventDefault();
      }
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

  // Auto-dismiss alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.opacity = '0';
      alert.style.transform = 'translateY(-10px)';
      setTimeout(() => alert.remove(), 300);
    }, 5000);
  });

  // Role tab switching on login page
  const roleTabs = document.querySelectorAll('.role-tab');
  const roleInput = document.getElementById('role-input');
  roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      roleTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (roleInput) roleInput.value = tab.dataset.role;
    });
  });

  // Cart quantity change auto-submit
  document.querySelectorAll('.qty-select').forEach(select => {
    select.addEventListener('change', () => {
      select.closest('form').submit();
    });
  });
});
