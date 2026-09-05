// =============================================================================
// SWITCHER CONFIG
// =============================================================================

export interface SwitcherOption {
  id: string;
  label: string;
  description?: string;
}

export interface SwitcherConfig {
  type: 'age' | 'role' | 'official_role' | 'scout' | null;
  displayStyle: 'radio' | 'dropdown' | 'none';
  options: SwitcherOption[];
  defaultOption: string;
}

export async function getSwitcherConfig(hubId: string): Promise<SwitcherConfig> {
  return {
    type: null,
    displayStyle: 'none',
    options: [],
    defaultOption: ''
  };
}