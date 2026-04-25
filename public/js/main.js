// NexCart — Main JavaScript
document.addEventListener('DOMContentLoaded', function () {
  // Sidebar toggle (mobile)
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('open');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  // Form validation
  document.querySelectorAll('form[data-validate]').forEach(form => {
    form.addEventListener('submit', function (e) {
      let valid = true;
      form.querySelectorAll('[required]').forEach(input => {
        if (!input.value.trim()) {
          valid = false;
          input.style.borderColor = 'var(--danger)';
          input.style.boxShadow = '0 0 0 3px rgba(239,68,68,.12)';
          input.addEventListener('input', function handler() {
            input.style.borderColor = '';
            input.style.boxShadow = '';
            input.removeEventListener('input', handler);
          });
        }
      });
      if (!valid) e.preventDefault();
    });
  });

  // Auto-dismiss alerts
  document.querySelectorAll('.alert').forEach(alert => {
    setTimeout(() => {
      alert.style.transition = 'opacity .3s, transform .3s';
      alert.style.opacity = '0';
      alert.style.transform = 'translateY(-8px)';
      setTimeout(() => alert.remove(), 300);
    }, 4000);
  });

  // Cart quantity change auto-submit
  document.querySelectorAll('.qty-select').forEach(select => {
    select.addEventListener('change', function () {
      this.closest('form').submit();
    });
  });

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
});
