interface CyberTerminalHelpGlobal {
  open: (modalId: string, topic?: string, onClose?: () => void) => void;
  close: (modalId?: string) => void;
  isOpen: (modalId?: string) => boolean;
}

function getHelpApi(): CyberTerminalHelpGlobal | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { CyberTerminalHelp?: CyberTerminalHelpGlobal }).CyberTerminalHelp;
}

export function openLinuxHelpModal(modalId: string, topic?: string, onClose?: () => void): void {
  getHelpApi()?.open(modalId, topic, onClose);
}

export function closeLinuxHelpModal(modalId?: string): void {
  getHelpApi()?.close(modalId);
}

export function isLinuxHelpModalOpen(modalId?: string): boolean {
  return Boolean(getHelpApi()?.isOpen(modalId));
}
