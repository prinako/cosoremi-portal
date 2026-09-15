const navToggle = document.querySelector('[data-nav-toggle]');
const navMenu = document.querySelector('[data-nav-menu]');
const header = document.querySelector('[data-header]');

if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => {
    const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!isOpen));
    navToggle.classList.toggle('is-open', !isOpen);
    navMenu.classList.toggle('is-open', !isOpen);
    document.body.classList.toggle('nav-open', !isOpen);
  });

  navMenu.addEventListener('click', (event) => {
    if (event.target.matches('a')) {
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.classList.remove('is-open');
      navMenu.classList.remove('is-open');
      document.body.classList.remove('nav-open');
    }
  });
}

if (header) {
  const updateHeader = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.getElementById(link.getAttribute('href').slice(1));

    if (target) {
      event.preventDefault();
      target.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'start',
      });
    }
  });
});

document.querySelectorAll('.placeholder-image img').forEach((image) => {
  image.addEventListener('error', () => {
    image.classList.add('is-missing');
    image.setAttribute('aria-hidden', 'true');
  });
});

if (navToggle && navMenu) {
  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      navToggle.getAttribute('aria-expanded') === 'true'
    ) {
      navToggle.click();
      navToggle.focus();
    }
  });
  window
    .matchMedia('(min-width: 980px)')
    .addEventListener('change', (event) => {
      if (event.matches && navToggle.getAttribute('aria-expanded') === 'true')
        navToggle.click();
    });
}
