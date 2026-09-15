document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
});
const slug = document.querySelector('input[name="slug"]');
const title = document.querySelector('input[name="title"], input[name="name"]');
if (slug && title) {
  let edited = Boolean(slug.value);
  slug.addEventListener('input', () => {
    edited = true;
  });
  title.addEventListener('input', () => {
    if (!edited)
      slug.value = title.value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 180);
  });
}
