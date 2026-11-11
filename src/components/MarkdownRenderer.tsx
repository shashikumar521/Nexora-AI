import React, { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Split content into blocks: code blocks vs standard text
  const blocks = parseBlocks(content);

  return (
    <div className="space-y-3.5 text-sm leading-relaxed text-[#F1F5F9] select-text">
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return (
            <CodeBlock
              key={idx}
              language={block.language || 'text'}
              filename={block.filename}
              code={block.content}
            />
          );
        } else if (block.type === 'callout') {
          return (
            <div
              key={idx}
              className="p-4 rounded-xl bg-gradient-to-r from-[#1E293B]/90 to-[#0F172A]/90 border border-[#6366F1]/30 my-3 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
            >
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#6366F1]/20 border border-[#6366F1]/40 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[#A5B4FC] text-sm">💡</span>
                </div>
                <div>
                  {block.title && (
                    <h4 className="font-display font-semibold text-[#F8FAFC] text-sm mb-1 tracking-tight">
                      {block.title}
                    </h4>
                  )}
                  <div className="text-xs text-[#CBD5E1] leading-relaxed">
                    {renderInline(block.content)}
                  </div>
                </div>
              </div>
            </div>
          );
        } else if (block.type === 'table') {
          return <TableBlock key={idx} rows={block.rows || []} />;
        } else {
          return (
            <div key={idx} className="space-y-2">
              {block.content.split('\n\n').map((para, pIdx) => (
                <Paragraph key={pIdx} text={para} />
              ))}
            </div>
          );
        }
      })}
    </div>
  );
};

interface Block {
  type: 'text' | 'code' | 'callout' | 'table';
  content: string;
  language?: string;
  filename?: string;
  title?: string;
  rows?: string[][];
}

function parseBlocks(raw: string): Block[] {
  const blocks: Block[] = [];
  const lines = raw.split('\n');
  let inCode = false;
  let currentLanguage = '';
  let currentFilename = '';
  let codeBuffer: string[] = [];
  let textBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for fenced code block start/end
    if (line.trim().startsWith('```')) {
      if (!inCode) {
        // flush text buffer
        if (textBuffer.length > 0) {
          blocks.push(...parseTextBlocks(textBuffer.join('\n')));
          textBuffer = [];
        }
        inCode = true;
        const tag = line.trim().slice(3).trim();
        if (tag.includes(':') || tag.includes('filename=')) {
          const parts = tag.split(/[:=]/);
          currentLanguage = parts[0] || 'code';
          currentFilename = parts[1] || '';
        } else if (tag.includes(' ')) {
          const parts = tag.split(' ');
          currentLanguage = parts[0];
          currentFilename = parts.slice(1).join(' ');
        } else {
          currentLanguage = tag || 'code';
          currentFilename = suggestFilename(currentLanguage);
        }
        codeBuffer = [];
      } else {
        // end code block
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
      }
    } else if (inCode) {
      codeBuffer.push(line);
    } else {
      textBuffer.push(line);
    }
  }

  if (inCode && codeBuffer.length > 0) {
    blocks.push({
      type: 'code',
      language: currentLanguage,
      filename: currentFilename,
      content: codeBuffer.join('\n'),
    });
  } else if (textBuffer.length > 0) {
    blocks.push(...parseTextBlocks(textBuffer.join('\n')));
  }

  return blocks;
}

function parseTextBlocks(text: string): Block[] {
  const result: Block[] = [];
  const sections = text.split('\n\n');

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Check for callout markdown or blockquotes
    if (trimmed.startsWith('>')) {
      const cleanQuote = trimmed
        .split('\n')
        .map((l) => l.replace(/^>\s?/, ''))
        .join('\n')
        .trim();

      const lines = cleanQuote.split('\n');
      let title = '';
      let body = cleanQuote;

      if (lines[0].startsWith('**') && lines[0].endsWith('**')) {
        title = lines[0].replace(/\*\*/g, '');
        body = lines.slice(1).join('\n').trim();
      } else if (lines[0].includes(':')) {
        const [first, ...rest] = lines[0].split(':');
        title = first.replace(/[*_#]/g, '').trim();
        body = [rest.join(':').trim(), ...lines.slice(1)].join('\n').trim();
      }

      result.push({
        type: 'callout',
        title: title || 'Note',
        content: body,
      });
      continue;
    }

    // Check for Markdown Table
    if (trimmed.includes('|') && trimmed.split('\n').length >= 2) {
      const tLines = trimmed.split('\n').filter((l) => l.trim().startsWith('|'));
      if (tLines.length >= 2) {
        const rows = tLines
          .filter((l) => !l.includes('---'))
          .map((l) =>
            l
              .split('|')
              .slice(1, -1)
              .map((cell) => cell.trim())
          );
        if (rows.length > 0) {
          result.push({
            type: 'table',
            content: trimmed,
            rows,
          });
          continue;
        }
      }
    }

    result.push({
      type: 'text',
      content: trimmed,
    });
  }

  return result;
}

function suggestFilename(lang: string): string {
  const l = lang.toLowerCase();
  if (l.includes('python') || l === 'py') return 'main.py';
  if (l.includes('typescript') || l === 'ts') return 'index.ts';
  if (l.includes('javascript') || l === 'js') return 'script.js';
  if (l.includes('tsx') || l.includes('jsx')) return 'Component.tsx';
  if (l.includes('html')) return 'index.html';
  if (l.includes('css')) return 'styles.css';
  if (l.includes('json')) return 'data.json';
  if (l.includes('sql')) return 'query.sql';
  if (l.includes('bash') || l.includes('sh')) return 'terminal.sh';
  return 'snippet';
}

const Paragraph: React.FC<{ text: string }> = ({ text }) => {
  const trimmed = text.trim();

  // Heading 1
  if (trimmed.startsWith('# ')) {
    return (
      <h1 className="font-display font-bold text-xl text-[#F8FAFC] tracking-tight mt-3 mb-1.5 border-b border-white/10 pb-1.5">
        {renderInline(trimmed.slice(2))}
      </h1>
    );
  }

  // Heading 2
  if (trimmed.startsWith('## ')) {
    return (
      <h2 className="font-display font-semibold text-lg text-[#F8FAFC] tracking-tight mt-2.5 mb-1 text-indigo-200">
        {renderInline(trimmed.slice(3))}
      </h2>
    );
  }

  // Heading 3
  if (trimmed.startsWith('### ')) {
    return (
      <h3 className="font-display font-semibold text-base text-[#E2E8F0] tracking-tight mt-2 mb-1">
        {renderInline(trimmed.slice(4))}
      </h3>
    );
  }

  // Lists (bullet or numbered)
  const lines = trimmed.split('\n');
  const isBulletList = lines.every((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '));
  const isNumberedList = lines.every((l) => /^\d+\.\s/.test(l.trim()));

  if (isBulletList) {
    return (
      <ul className="space-y-1.5 my-2 pl-2">
        {lines.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] mt-2 shrink-0" />
            <span className="text-[#E2E8F0]">{renderInline(item.replace(/^[-*]\s*/, ''))}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (isNumberedList) {
    return (
      <ol className="space-y-1.5 my-2 pl-2">
        {lines.map((item, idx) => {
          const numMatch = item.trim().match(/^(\d+)\.\s*(.*)/);
          const num = numMatch ? numMatch[1] : `${idx + 1}`;
          const content = numMatch ? numMatch[2] : item;
          return (
            <li key={idx} className="flex items-start gap-2.5">
              <span className="text-[11px] font-mono font-bold text-[#818CF8] bg-[#6366F1]/10 px-1.5 py-0.5 rounded border border-[#6366F1]/20 shrink-0">
                {num}
              </span>
              <span className="text-[#E2E8F0]">{renderInline(content)}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  return <p className="text-[#CBD5E1] leading-relaxed">{renderInline(trimmed)}</p>;
};

const CodeBlock: React.FC<{ language: string; filename?: string; code: string }> = ({
  language,
  filename,
  code,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0B0F19] my-3 shadow-lg">
      {/* Code Header Bar matching Stitch AI designs */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#0B0F19] border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Mac style 3 dots */}
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]/80" />
          </div>

          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="font-mono text-xs font-medium text-[#E2E8F0]">
              {filename || 'snippet'}
            </span>
          </div>

          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#1F2937] text-[#94A3B8] border border-white/5">
            {language}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-white px-2.5 py-1 rounded-md bg-[#1F2937]/60 hover:bg-[#1F2937] transition-colors border border-white/5 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-[#10B981]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <pre className="p-4 font-mono text-xs text-[#E2E8F0] overflow-x-auto leading-relaxed bg-[#0B0F19]">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const TableBlock: React.FC<{ rows: string[][] }> = ({ rows }) => {
  if (rows.length === 0) return null;
  const [header, ...body] = rows;

  return (
    <div className="overflow-x-auto my-3 rounded-xl border border-white/10 bg-[#0F172A]/50">
      <table className="w-full text-left text-xs text-[#CBD5E1]">
        <thead className="bg-[#1E293B] text-[#F8FAFC] font-semibold border-b border-white/10">
          <tr>
            {header.map((col, i) => (
              <th key={i} className="px-3.5 py-2.5">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {body.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-white/[0.02]">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3.5 py-2">
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
 * Parses inline elements: bold, inline code, italics
 */
function renderInline(text: string): React.ReactNode[] {
  // Regex splitting by bold (**...**) and inline code (`...`)
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="font-mono text-[12px] px-1.5 py-0.5 rounded-md bg-[#1F2937] text-[#38BDF8] border border-white/10 mx-0.5"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={match.index} className="italic text-[#E2E8F0]">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
