document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('wkz')) {
    const wkz = urlParams.get('wkz');
    const body = JSON.stringify({ attributes: { wkz } });
    fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } });
  }
});