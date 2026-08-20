export interface OpenProject {
  id: string;
  path: string;
}

export interface ProjectWorkspaceState {
  project: OpenProject | null;
  opening: boolean;
  error: string | null;
}

export const initialProjectWorkspaceState: ProjectWorkspaceState = {
  project: null,
  opening: false,
  error: null,
};

export function beginProjectOpen(): ProjectWorkspaceState {
  return { project: null, opening: true, error: null };
}

export function completeProjectOpen(
  state: ProjectWorkspaceState,
  project: OpenProject | null,
): ProjectWorkspaceState {
  return { ...state, project: project ?? state.project, opening: false, error: null };
}

export function failProjectOpen(
  state: ProjectWorkspaceState,
  message: string,
): ProjectWorkspaceState {
  return { ...state, opening: false, error: message };
}
