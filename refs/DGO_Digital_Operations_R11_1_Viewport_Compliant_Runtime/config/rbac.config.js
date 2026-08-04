export const Personas = ['admin','executive','registry','general'];
export function canAccess(persona, route) {
  if (persona === 'admin') return true;
  if (route === 'user-admin') return false;
  if (persona === 'executive') return !['settings','operator-hud'].includes(route);
  if (persona === 'general') return !['executive','settings','operator-hud','diagnostics','user-admin'].includes(route);
  return true;
}
