document.addEventListener('DOMContentLoaded', function () {
  console.log('handle wkz parameter');

  // Function to set a cookie
  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  }


  function fetchConfig(type = 'json') {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: `application/${type}` },
    };
  }  
  
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('wkz')) {
    const wkz = urlParams.get('wkz');
    const body = JSON.stringify({ attributes: { wkz } });

    setCookie("wkz", wkz, 7); // Sets the cookie for 7 days

    // attach wkz to cart
    fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } });
  }
});