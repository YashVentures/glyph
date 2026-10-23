import React, { useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  List, 
  Code, 
  Quote, 
  FileText 
} from 'lucide-react';

export default function DocPane({
  docContent,
  onChange,
  fileTitle
}) {
  const textareaRef = useRef(null);

  // Helper to insert markdown tokens at cursor
  const insertToken = (before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selection = text.substring(start, end);
    const replacement = `${before}${selection}${after}`;
    const nextContent = text.substring(0, start) + replacement + text.substring(end);
    onChange(nextContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        end + before.length
      );
    }, 0);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-primary)',
      overflow: 'hidden'
    }}>
      {/* Markdown Quick Toolbar */}
      <div style={{
        height: '40px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '4px',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginRight: '12px',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-muted)'
        }}>
          <FileText size={14} />
          <span>NOTES</span>
        </div>

        <button 
          type="button"
          onClick={() => insertToken('**', '**')}
          className="btn-icon"
          title="Bold (**text**)"
          style={{ width: '28px', height: '28px' }}
        >
          <Bold size={13} />
        </button>

        <button 
          type="button"
          onClick={() => insertToken('*', '*')}
          className="btn-icon"
          title="Italic (*text*)"
          style={{ width: '28px', height: '28px' }}
        >
          <Italic size={13} />
        </button>

        <button 
          type="button"
          onClick={() => insertToken('\n# ')}
          className="btn-icon"
          title="Heading 1 (# Heading)"
          style={{ width: '28px', height: '28px' }}
        >
          <Heading1 size={14} />
        </button>

        <button 
          type="button"
          onClick={() => insertToken('\n## ')}
          className="btn-icon"
          title="Heading 2 (## Heading)"
          style={{ width: '28px', height: '28px' }}
        >
          <Heading2 size={14} />
        </button>

        <button 
          type="button"
          onClick={() => insertToken('\n- ')}
          className="btn-icon"
          title="Bullet List (- item)"
          style={{ width: '28px', height: '28px' }}
        >
          <List size={14} />
        </button>

        <button 
          type="button"
          onClick={() => insertToken('\n```\n', '\n```\n')}
          className="btn-icon"
          title="Code Block (```code```)"
          style={{ width: '28px', height: '28px' }}
        >
          <Code size={13} />
        </button>

        <button 
          type="button"
          onClick={() => insertToken('\n> ')}
          className="btn-icon"
          title="Blockquote (> text)"
          style={{ width: '28px', height: '28px' }}
        >
          <Quote size={13} />
        </button>
      </div>

      {/* Editor Body */}
      <div style={{
        flex: 1,
        padding: '24px 32px',
        overflowY: 'auto'
      }}>
        <textarea
          ref={textareaRef}
          value={docContent || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="# Start typing your document notes here..."
          style={{
            width: '100%',
            height: '100%',
            minHeight: '400px',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: 'var(--text-primary)',
            fontSize: '14px',
            lineHeight: '1.7',
            fontFamily: 'var(--font-sans)',
            letterSpacing: '0.01em'
          }}
        />
      </div>
    </div>
  );
}
