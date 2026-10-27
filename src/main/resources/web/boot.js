try {
  await import('./main.js');
} catch (error) {
  console.error(error);
  const mount = document.getElementById('app');
  mount.replaceChildren();
  const message = document.createElement('p');
  message.textContent = 'Não foi possível carregar o Squelch. Confira o servidor Java e use um navegador com Web Audio.';
  message.setAttribute('role', 'alert');
  const retry = document.createElement('button');
  retry.className = 'btn export';
  retry.textContent = 'Tentar novamente';
  retry.addEventListener('click', () => location.reload());
  mount.append(message, retry);
}
