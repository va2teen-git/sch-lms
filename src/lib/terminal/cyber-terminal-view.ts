export type CyberTerminalLineVariant =
  | 'cmd'
  | 'ok'
  | 'info'
  | 'warn'
  | 'err'
  | 'dim'
  | 'accent';

export interface CyberTerminalViewOptions {
  windowEl?: HTMLElement | null;
  outputEl: HTMLElement | null;
  inputEl?: HTMLInputElement | null;
  promptEl?: HTMLElement | null;
  titleEl?: HTMLElement | null;
}

export interface CyberTerminalInteractiveHandlers {
  onCommand: (cmd: string) => void;
  onEscape?: () => void;
  getHistory?: () => string[];
  autocomplete?: (value: string) => string[];
  getPrompt?: () => string;
}

/**
 * Framework-agnostic DOM controller for CyberTerminal instances.
 */
export class CyberTerminalView {
  private readonly windowEl: HTMLElement | null;
  private readonly outputEl: HTMLElement | null;
  private readonly inputEl: HTMLInputElement | null;
  private readonly promptEl: HTMLElement | null;
  private readonly titleEl: HTMLElement | null;
  private errorFlashTimer: number | null = null;
  private histIdx = -1;

  constructor(opts: CyberTerminalViewOptions) {
    this.windowEl = opts.windowEl ?? null;
    this.outputEl = opts.outputEl;
    this.inputEl = opts.inputEl ?? null;
    this.promptEl = opts.promptEl ?? null;
    this.titleEl = opts.titleEl ?? null;
  }

  appendLine(text: string, variant: CyberTerminalLineVariant = 'info', extraClass = ''): void {
    if (!this.outputEl) return;
    const lineEl = document.createElement('div');
    lineEl.className = `ct-line ct-line--${variant}${extraClass ? ` ${extraClass}` : ''}`;
    lineEl.textContent = text;
    this.outputEl.appendChild(lineEl);
    this.scrollToBottom();
  }

  appendCommand(prompt: string, cmd: string): void {
    if (!this.outputEl) return;
    const row = document.createElement('div');
    row.className = 'ct-line ct-line--cmd';

    const promptSpan = document.createElement('span');
    promptSpan.className = 'ct-prompt';
    promptSpan.textContent = prompt;

    const space = document.createTextNode(' ');
    const cmdSpan = document.createElement('span');
    cmdSpan.textContent = cmd;

    row.appendChild(promptSpan);
    row.appendChild(space);
    row.appendChild(cmdSpan);
    this.outputEl.appendChild(row);
    this.scrollToBottom();
  }

  clear(): void {
    if (this.outputEl) {
      this.outputEl.innerHTML = '';
    }
  }

  setPrompt(prompt: string): void {
    if (this.promptEl) {
      this.promptEl.textContent = prompt;
    }
  }

  setTitle(title: string): void {
    if (this.titleEl) {
      this.titleEl.textContent = title;
    }
  }

  focus(): void {
    this.inputEl?.focus();
  }

  scrollToBottom(): void {
    if (this.outputEl) {
      this.outputEl.scrollTop = this.outputEl.scrollHeight;
    }
  }

  flashError(durationMs = 260): void {
    if (!this.windowEl) return;
    if (this.errorFlashTimer !== null) {
      window.clearTimeout(this.errorFlashTimer);
    }
    this.windowEl.classList.add('ct-window--error');
    this.errorFlashTimer = window.setTimeout(() => {
      this.windowEl?.classList.remove('ct-window--error');
      this.errorFlashTimer = null;
    }, durationMs);
  }

  bindInteractive(handlers: CyberTerminalInteractiveHandlers): () => void {
    const input = this.inputEl;
    if (!input) return () => {};

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (handlers.onEscape) {
          e.preventDefault();
          handlers.onEscape();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = input.value;
        input.value = '';
        this.histIdx = -1;
        handlers.onCommand(cmd);
        return;
      }

      if (e.key === 'ArrowUp' && handlers.getHistory) {
        e.preventDefault();
        const hist = handlers.getHistory();
        if (hist.length === 0) return;
        if (this.histIdx === -1) this.histIdx = hist.length - 1;
        else this.histIdx = Math.max(0, this.histIdx - 1);
        input.value = hist[this.histIdx] || '';
        return;
      }

      if (e.key === 'ArrowDown' && handlers.getHistory) {
        e.preventDefault();
        const hist = handlers.getHistory();
        if (this.histIdx === -1) return;
        this.histIdx++;
        if (this.histIdx >= hist.length) {
          this.histIdx = -1;
          input.value = '';
        } else {
          input.value = hist[this.histIdx] || '';
        }
        return;
      }

      if (e.key === 'Tab' && handlers.autocomplete) {
        e.preventDefault();
        const matches = handlers.autocomplete(input.value);
        if (matches.length === 1) {
          const parts = input.value.split(/\s+/);
          if (parts.length <= 1) {
            input.value = matches[0] + ' ';
          } else {
            parts[parts.length - 1] = matches[0];
            input.value = parts.join(' ');
          }
        } else if (matches.length > 1) {
          this.appendLine(matches.join('  '), 'dim');
        }
      }
    };

    const onOutputClick = () => {
      const sel = window.getSelection?.()?.toString() || '';
      if (!sel && !input.disabled) {
        input.focus();
      }
    };

    input.addEventListener('keydown', onKeyDown);
    this.outputEl?.addEventListener('click', onOutputClick);

    return () => {
      input.removeEventListener('keydown', onKeyDown);
      this.outputEl?.removeEventListener('click', onOutputClick);
    };
  }
}
