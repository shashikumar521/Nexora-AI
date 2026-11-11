/**
 * Formats a raw model identifier (e.g. 'gemini-3.1-flash-lite') into a clean, display-friendly name.
 */
export function formatModelDisplayName(modelName?: string): string {
  if (!modelName) return 'Gemini';

  const clean = modelName.trim();

  // If already formatted like "Gemini 3.1 Flash Lite" or "Google Gemini"
  if (clean.toLowerCase().startsWith('gemini') && clean.includes(' ')) {
    return clean;
  }

  // Handle common aliases
  if (clean === 'gemini-3.1-flash-lite') return 'Gemini 3.1 Flash Lite';
  if (clean === 'gemini-3.8-flash') return 'Gemini 3.8 Flash';
  if (clean === 'gemini-2.5-flash') return 'Gemini 2.5 Flash';
  if (clean === 'gemini-2.5-pro') return 'Gemini 2.5 Pro';
  if (clean === 'gemini-1.5-flash') return 'Gemini 1.5 Flash';

  // Fallback slug to Title Case
  return clean
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
