export const workspacePanels = [
  { id: 'explorer', title: 'Project' },
  { id: 'editor', title: 'Editor' },
  { id: 'agents', title: 'Agents' },
] as const;

export type WorkspacePanelId = (typeof workspacePanels)[number]['id'];

export function getWorkspacePanelTitle(id: WorkspacePanelId): string {
  return workspacePanels.find((panel) => panel.id === id)!.title;
}
