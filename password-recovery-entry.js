// Runs before the lobby Auth client: never consume recovery credentials in a lobby.
(() => {
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.get('type') === 'recovery' || fragment.has('error') || fragment.has('error_code')) {
    const target = new URL('password-reset.html?recovery=1' + location.hash, location.href).href;
    history.replaceState(null, '', location.pathname);
    location.replace(target);
  }
})();
