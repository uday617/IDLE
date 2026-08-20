const languageByExtension: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.md': 'markdown',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.xml': 'xml',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
};

export function getEditorLanguage(path: string): string {
  const fileName = path.split('/').at(-1) ?? path;
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return 'plaintext';
  return languageByExtension[fileName.slice(dot).toLowerCase()] ?? 'plaintext';
}
