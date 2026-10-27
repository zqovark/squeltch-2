async function checked(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}
export async function getConfig() {
  return (await checked(await fetch('/api/config', {signal: AbortSignal.timeout(8000)}))).json();
}
export async function generatePattern(settings, signal) {
  const timeout = AbortSignal.timeout(8000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  return (await checked(await fetch('/api/generate?' + new URLSearchParams(settings), {signal: combined}))).json();
}
export async function exportPattern(pattern, bpm, target) {
  // Serialize the displayed pattern, never regenerate on export.
  const steps = pattern.steps.map(s => [+s.on, s.note, +s.accent, +s.slide].join(',')).join(';');
  const response = await checked(await fetch('/api/export', {
    method: 'POST', body: new URLSearchParams({steps, bpm, target}), signal: AbortSignal.timeout(8000)
  }));
  const blob = await response.blob();
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const name = `squelch_${slug(pattern.rootName)}-${slug(pattern.scaleName)}_${Math.round(bpm)}bpm_${target}.mid`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}
