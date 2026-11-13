import React, { useState, useMemo } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-yaml';

interface MarkdownRendererProps {
  content: string;
  showSyntaxHighlighting?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  showSyntaxHighlighting = true,
}) => {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className="space-y-3.5 text-sm leading-relaxed text-[var(--nx-text-primary)] select-text max-w-full overflow-hidden break-words">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'code':
            return (
              <CodeBlock
                key={idx}
                language={block.language || 'text'}
                filename={block.filename}
                code={block.content}
                showSyntaxHighlighting={showSyntaxHighlighting}
              />
            );
          case 'callout':
            return (
              <div
                key={idx}
                className="p-4 rounded-xl [background:var(--nx-callout-bg)] border border-[var(--nx-accent-border)] my-3 shadow-[var(--nx-card-shadow)] max-w-full overflow-hidden"
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[var(--nx-accent-soft)] border border-[var(--nx-accent-border)] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[var(--nx-accent-text)] text-sm">💡</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    {block.title && (
                      <h4 className="font-display font-semibold text-[var(--nx-text-heading-alt)] text-sm mb-1 tracking-tight">
                        {renderInline(block.title)}
                      </h4>
                    )}
                    <div className="text-xs text-[var(--nx-text-body)] leading-relaxed break-words">
                      {renderInline(block.content)}
                    </div>
                  </div>
                </div>
              </div>
            );
          case 'table':
            return <TableBlock key={idx} rows={block.rows || []} />;
          case 'heading':
            return <HeadingBlock key={idx} level={block.level || 2} text={block.content} />;
          case 'bullet-list':
            return (
              <ul key={idx} className="space-y-1.5 my-2.5 pl-2 max-w-full">
                {block.items?.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2.5 text-[var(--nx-text-primary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--nx-accent)] mt-2 shrink-0" />
                    <span className="flex-1 min-w-0 leading-relaxed break-words">
                      {renderInline(item)}
                    </span>
                  </li>
                ))}
              </ul>
            );
          case 'numbered-list':
            return (
              <ol key={idx} className="space-y-1.5 my-2.5 pl-2 max-w-full">
                {block.items?.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2.5 text-[var(--nx-text-primary)]">
                    <span className="text-[11px] font-mono font-bold text-[var(--nx-accent-text)] bg-[var(--nx-accent-soft)] px-1.5 py-0.5 rounded border border-[var(--nx-accent-border)] shrink-0 mt-0.5">
                      {itemIdx + 1}
                    </span>
                    <span className="flex-1 min-w-0 leading-relaxed break-words">
                      {renderInline(item)}
                    </span>
                  </li>
                ))}
              </ol>
            );
          case 'hr':
            return <hr key={idx} className="border-t border-[var(--nx-border-subtle)] my-4" />;
          default:
            return (
              <p key={idx} className="text-[var(--nx-text-body)] leading-relaxed break-words my-2">
                {renderInline(block.content)}
              </p>
            );
        }
      })}
    </div>
  );
};

interface Block {
  type: 'text' | 'code' | 'callout' | 'table' | 'heading' | 'bullet-list' | 'numbered-list' | 'hr';
  content: string;
  language?: string;
  filename?: string;
  title?: string;
  level?: number;
  rows?: string[][];
  items?: string[];
}

function parseBlocks(raw: string): Block[] {
  const blocks: Block[] = [];
  const lines = raw.split(/\r?\n/);
  let inCode = false;
  let currentLanguage = '';
  let currentFilename = '';
  let codeBuffer: string[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    // 1. Fenced Code Block
    if (line.trim().startsWith('```')) {
      if (!inCode) {
        inCode = true;
        const tag = line.trim().slice(3).trim();
        if (tag.includes(':') || tag.includes('=')) {
          const parts = tag.split(/[:=]/);
          currentLanguage = parts[0]?.trim() || 'code';
          currentFilename = parts.slice(1).join('=').trim() || '';
        } else if (tag.includes(' ')) {
          const parts = tag.split(/\s+/);
          currentLanguage = parts[0]?.trim() || 'code';
          currentFilename = parts.slice(1).join(' ').trim();
        } else {
          currentLanguage = tag || 'code';
          currentFilename = suggestFilename(currentLanguage);
        }
        codeBuffer = [];
        lineIndex++;
        continue;
      } else {
        inCode = false;
        blocks.push({
          type: 'code',
          language: currentLanguage,
          filename: currentFilename,
          content: codeBuffer.join('\n'),
        });
        codeBuffer = [];
        currentLanguage = '';
        currentFilename = '';
        lineIndex++;
        continue;
      }
    }

    if (inCode) {
      codeBuffer.push(line);
      lineIndex++;
      continue;
    }

    const trimmed = line.trim();

    // Empty lines
    if (!trimmed) {
      lineIndex++;
      continue;
    }

    // Horizontal Rule
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr', content: '' });
      lineIndex++;
      continue;
    }

    // Headings (# Heading)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      });
      lineIndex++;
      continue;
    }

    // Blockquote / Callout (> Note)
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (lineIndex < lines.length && lines[lineIndex].trim().startsWith('>')) {
        quoteLines.push(lines[lineIndex].trim().replace(/^>\s?/, ''));
        lineIndex++;
      }
      const rawQuote = quoteLines.join('\n').trim();
      let title = '';
      let body = rawQuote;

      if (rawQuote.startsWith('**') && rawQuote.includes('**\n')) {
        const parts = rawQuote.split('**\n');
        title = parts[0].replace(/\*\*/g, '').trim();
        body = parts.slice(1).join('**\n').trim();
      } else if (rawQuote.includes(':') && !rawQuote.split('\n')[0].includes('http')) {
        const firstLine = rawQuote.split('\n')[0];
        const [first, ...rest] = firstLine.split(':');
        if (first.length < 40) {
          title = first.replace(/[*_#]/g, '').trim();
          const remFirst = rest.join(':').trim();
          body = [remFirst, ...rawQuote.split('\n').slice(1)].filter(Boolean).join('\n').trim();
        }
      }

      blocks.push({
        type: 'callout',
        title: title || 'Note',
        content: body || rawQuote,
      });
      continue;
    }

    // Tables (| col1 | col2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && lineIndex + 1 < lines.length) {
      const nextTrimmed = lines[lineIndex + 1]?.trim() || '';
      if (nextTrimmed.startsWith('|') && /[-:]{2,}/.test(nextTrimmed)) {
        const tableLines: string[] = [];
        while (lineIndex < lines.length && lines[lineIndex].trim().startsWith('|')) {
          tableLines.push(lines[lineIndex].trim());
          lineIndex++;
        }
        const parsedRows = tableLines
          .filter((l) => !/^\|[\s\-:|]+\|$/.test(l))
          .map((l) =>
            l
              .split('|')
              .slice(1, -1)
              .map((c) => c.trim())
          );
        if (parsedRows.length > 0) {
          blocks.push({
            type: 'table',
            content: '',
            rows: parsedRows,
          });
          continue;
        }
      }
    }

    // Bullet Lists (- or * or +)
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (lineIndex < lines.length) {
        const currTrimmed = lines[lineIndex].trim();
        if (/^[-*+]\s+/.test(currTrimmed)) {
          items.push(currTrimmed.replace(/^[-*+]\s+/, ''));
          lineIndex++;
        } else if (currTrimmed && !/^(#{1,6}\s|```|\||>|\d+\.\s)/.test(currTrimmed) && items.length > 0) {
          // Continuation of previous item
          items[items.length - 1] += ' ' + currTrimmed;
          lineIndex++;
        } else {
          break;
        }
      }
      blocks.push({
        type: 'bullet-list',
        content: '',
        items,
      });
      continue;
    }

    // Numbered Lists (1. or 2.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (lineIndex < lines.length) {
        const currTrimmed = lines[lineIndex].trim();
        if (/^\d+\.\s+/.test(currTrimmed)) {
          items.push(currTrimmed.replace(/^\d+\.\s+/, ''));
          lineIndex++;
        } else if (currTrimmed && !/^(#{1,6}\s|```|\||>|[-*+]\s)/.test(currTrimmed) && items.length > 0) {
          // Continuation of previous numbered item
          items[items.length - 1] += ' ' + currTrimmed;
          lineIndex++;
        } else {
          break;
        }
      }
      blocks.push({
        type: 'numbered-list',
        content: '',
        items,
      });
      continue;
    }

    // Regular Paragraph: gather consecutive text lines until a block boundary or empty line
    const paragraphLines: string[] = [];
    while (lineIndex < lines.length) {
      const pLine = lines[lineIndex];
      const pTrimmed = pLine.trim();
      if (!pTrimmed) {
        lineIndex++;
        break;
      }
      if (
        pTrimmed.startsWith('```') ||
        pTrimmed.startsWith('#') ||
        pTrimmed.startsWith('>') ||
        (/^[-*+]\s+/.test(pTrimmed)) ||
        (/^\d+\.\s+/.test(pTrimmed)) ||
        (/^(\-{3,}|\*{3,}|_{3,})$/.test(pTrimmed)) ||
        (pTrimmed.startsWith('|') && pTrimmed.endsWith('|'))
      ) {
        break;
      }
      paragraphLines.push(pTrimmed);
      lineIndex++;
    }

    if (paragraphLines.length > 0) {
      blocks.push({
        type: 'text',
        content: paragraphLines.join(' '),
      });
    }
  }

  if (inCode && codeBuffer.length > 0) {
    blocks.push({
      type: 'code',
      language: currentLanguage,
      filename: currentFilename,
      content: codeBuffer.join('\n'),
    });
  }

  return blocks;
}

function suggestFilename(lang: string): string {
  const l = (lang || '').toLowerCase();
  if (l.includes('python') || l === 'py') return 'main.py';
  if (l.includes('typescript') || l === 'ts') return 'index.ts';
  if (l.includes('javascript') || l === 'js') return 'script.js';
  if (l.includes('tsx') || l.includes('jsx')) return 'Component.tsx';
  if (l.includes('html')) return 'index.html';
  if (l.includes('css')) return 'styles.css';
  if (l.includes('json')) return 'data.json';
  if (l.includes('sql')) return 'query.sql';
  if (l.includes('bash') || l.includes('sh') || l.includes('shell') || l.includes('zsh')) return 'terminal.sh';
  if (l.includes('yaml') || l.includes('yml')) return 'config.yaml';
  if (l.includes('markdown') || l === 'md') return 'README.md';
  return 'snippet';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightCode(code: string, language: string): string {
  const l = (language || 'text').toLowerCase().trim();
  let grammar = Prism.languages[l];

  if (!grammar) {
    if (l === 'js' || l === 'node') grammar = Prism.languages.javascript;
    else if (l === 'ts') grammar = Prism.languages.typescript;
    else if (l === 'py') grammar = Prism.languages.python;
    else if (l === 'sh' || l === 'shell' || l === 'zsh') grammar = Prism.languages.bash;
    else if (l === 'yml') grammar = Prism.languages.yaml;
    else if (l === 'md') grammar = Prism.languages.markdown;
  }

  if (!grammar) {
    return escapeHtml(code);
  }

  try {
    return Prism.highlight(code, grammar, l);
  } catch {
    return escapeHtml(code);
  }
}

const HeadingBlock: React.FC<{ level: number; text: string }> = ({ level, text }) => {
  const rendered = renderInline(text);

  switch (level) {
    case 1:
      return (
        <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--nx-text-heading-alt)] tracking-tight mt-5 mb-2.5 pb-2 border-b border-[var(--nx-border-subtle)] break-words">
          {rendered}
        </h1>
      );
    case 2:
      return (
        <h2 className="font-display font-semibold text-lg sm:text-xl text-[var(--nx-text-heading-h2)] tracking-tight mt-4 mb-2 break-words">
          {rendered}
        </h2>
      );
    case 3:
      return (
        <h3 className="font-display font-semibold text-base sm:text-lg text-[var(--nx-text-primary)] tracking-tight mt-3 mb-1.5 break-words">
          {rendered}
        </h3>
      );
    case 4:
    default:
      return (
        <h4 className="font-display font-semibold text-sm sm:text-base text-[var(--nx-text-body)] tracking-tight mt-2.5 mb-1 break-words">
          {rendered}
        </h4>
      );
  }
};

const CodeBlock: React.FC<{
  language: string;
  filename?: string;
  code: string;
  showSyntaxHighlighting?: boolean;
}> = ({
  language,
  filename,
  code,
  showSyntaxHighlighting = true,
}) => {
  const [copied, setCopied] = useState(false);

  const highlightedHtml = useMemo(() => {
    return showSyntaxHighlighting ? highlightCode(code, language) : escapeHtml(code);
  }, [code, language, showSyntaxHighlighting]);

  const handleCopy = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(code)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => fallbackCopy(code));
    } else {
      fallbackCopy(code);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Failed to copy code to clipboard', e);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0B0F19] my-3 shadow-lg max-w-full">
      {/* Code Header Bar matching Stitch AI designs */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#0E1524] border-b border-white/10 gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mac style 3 dots */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]/80" />
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <Terminal className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
            <span className="font-mono text-xs font-medium text-[#E2E8F0] truncate">
              {filename || 'snippet'}
            </span>
          </div>

          {showSyntaxHighlighting && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#1F2937] text-[#94A3B8] border border-white/5 shrink-0">
              {language}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-white px-2.5 py-1 rounded-md bg-[#1F2937]/70 hover:bg-[#1F2937] transition-colors border border-white/5 cursor-pointer shrink-0"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-[#10B981] font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content with Horizontal Scroll */}
      <pre className="p-4 font-mono text-xs text-[#E2E8F0] overflow-x-auto leading-relaxed bg-[#0B0F19] max-w-full">
        <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </pre>
    </div>
  );
};

const TableBlock: React.FC<{ rows: string[][] }> = ({ rows }) => {
  if (rows.length === 0) return null;
  const [header, ...body] = rows;

  return (
    <div className="overflow-x-auto my-3 rounded-xl border border-[var(--nx-border-subtle)] [background:var(--nx-table-bg)] shadow-xs max-w-full">
      <table className="w-full text-left text-xs text-[var(--nx-text-body)] border-collapse min-w-[340px]">
        <thead className="bg-[var(--nx-table-head-bg)] text-[var(--nx-text-heading-alt)] font-semibold border-b border-[var(--nx-border-subtle)]">
          <tr>
            {header.map((col, i) => (
              <th key={i} className="px-3.5 py-2.5 font-medium">
                {renderInline(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--nx-border-faint)]">
          {body.map((row, rIdx) => (
            <tr key={rIdx} className="hover:[background:var(--nx-table-row-hover)] transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3.5 py-2.5 align-top">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Parses inline elements: bold, italics, inline code, links, strikethrough
 */
export function renderInline(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match:
  // 1. Links: [text](url)
  // 2. Bold+Italic: ***text*** or ___text___
  // 3. Bold: **text** or __text__
  // 4. Strikethrough: ~~text~~
  // 5. Inline code: `code`
  // 6. Italic: *text* or _text_
  const tokenRegex = /(\[.*?\]\(https?:\/\/[^\s)]+\)|\*\*\*.*?\*\*\*|___.*?___|\*\*.*?\*\*|__.*?__|~~.*?~~|`.*?`|\*.*?\*|_.*?_)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = match.index;

    // Link: [label](url)
    if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/^\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/);
      if (linkMatch) {
        parts.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--nx-accent-text)] hover:text-[var(--nx-accent)] underline underline-offset-2 break-all"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    }
    // Bold + Italic: ***text*** or ___text___
    else if ((token.startsWith('***') && token.endsWith('***')) || (token.startsWith('___') && token.endsWith('___'))) {
      parts.push(
        <strong key={key} className="font-semibold italic text-[var(--nx-text-heading)]">
          {token.slice(3, -3)}
        </strong>
      );
    }
    // Bold: **text** or __text__
    else if ((token.startsWith('**') && token.endsWith('**')) || (token.startsWith('__') && token.endsWith('__'))) {
      parts.push(
        <strong key={key} className="font-semibold text-[var(--nx-text-heading)]">
          {token.slice(2, -2)}
        </strong>
      );
    }
    // Strikethrough: ~~text~~
    else if (token.startsWith('~~') && token.endsWith('~~')) {
      parts.push(
        <del key={key} className="line-through text-[var(--nx-text-muted)]">
          {token.slice(2, -2)}
        </del>
      );
    }
    // Inline code: `code`
    else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={key}
          className="font-mono text-[12px] px-1.5 py-0.5 rounded-md bg-[var(--nx-code-inline-bg)] text-[var(--nx-code-inline-text)] border border-[var(--nx-code-inline-border)] mx-0.5 break-all"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    // Italic: *text* or _text_
    else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      parts.push(
        <em key={key} className="italic text-[var(--nx-text-primary)]">
          {token.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(token);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
