import React from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

function renderInline(text: string): React.ReactNode {
  const elements: React.ReactNode[] = []
  let remaining = text

  const patterns: Array<{
    regex: RegExp
    render: (match: RegExpExecArray, key: number) => React.ReactNode
  }> = [
    {
      regex: /\*\*\*(.+?)\*\*\*/g,
      render: (m, k) => (
        <strong key={k} className="font-semibold">
          <em>{m[1]}</em>
        </strong>
      ),
    },
    {
      regex: /\*\*(.+?)\*\*/g,
      render: (m, k) => (
        <strong key={k} className="font-semibold">
          {m[1]}
        </strong>
      ),
    },
    {
      regex: /\*(.+?)\*/g,
      render: (m, k) => (
        <em key={k} className="italic">
          {m[1]}
        </em>
      ),
    },
    {
      regex: /`([^`]+)`/g,
      render: (m, k) => (
        <code
          key={k}
          className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-sm font-mono"
        >
          {m[1]}
        </code>
      ),
    },
    {
      regex: /\[([^\]]+)\]\(([^)]+)\)/g,
      render: (m, k) => (
        <a
          key={k}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
        >
          {m[1]}
        </a>
      ),
    },
    {
      regex: /(https?:\/\/[^\s]+)/g,
      render: (m, k) => (
        <a
          key={k}
          href={m[1]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
        >
          {m[1]}
        </a>
      ),
    },
  ]

  let index = 0
  while (remaining.length > 0) {
    let earliestMatch: { patternIndex: number; match: RegExpExecArray; position: number } | null = null

    patterns.forEach((pattern, patternIndex) => {
      pattern.regex.lastIndex = 0
      const match = pattern.regex.exec(remaining)
      if (match && (earliestMatch === null || match.index < earliestMatch.position)) {
        earliestMatch = { patternIndex, match, position: match.index }
      }
    })

    if (!earliestMatch) {
      elements.push(<span key={`text-${index}`}>{remaining}</span>)
      break
    }

    if (earliestMatch.position > 0) {
      elements.push(
        <span key={`text-${index}-${earliestMatch.position}`}>{remaining.slice(0, earliestMatch.position)}</span>
      )
    }

    const pattern = patterns[earliestMatch.patternIndex]
    elements.push(pattern.render(earliestMatch.match, index))

    remaining = remaining.slice(earliestMatch.position + earliestMatch.match[0].length)
    index++
  }

  return elements.length === 1 ? elements[0] : elements
}

function parseBlocks(content: string): Array<{ type: string; lines: string[]; language?: string }> {
  const blocks: Array<{ type: string; lines: string[]; language?: string }> = []
  const lines = content.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trimStart().startsWith('```')) {
      const language = line.trimStart().slice(3).trim() || undefined
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      blocks.push({ type: 'code', lines: codeLines, language })
      continue
    }

    if (line.trimStart().startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        quoteLines.push(lines[i].trimStart().slice(1).trimStart())
        i++
      }
      blocks.push({ type: 'quote', lines: quoteLines })
      continue
    }

    const unorderedMatch = line.match(/^(\s*)[-*+]\s+/)
    const orderedMatch = line.match(/^(\s*)\d+\.\s+/)
    if (unorderedMatch || orderedMatch) {
      const listType = unorderedMatch ? 'unordered' : 'ordered'
      const listLines: string[] = []
      while (i < lines.length) {
        const currentUnordered = lines[i].match(/^(\s*)[-*+]\s+/)
        const currentOrdered = lines[i].match(/^(\s*)\d+\.\s+/)
        if ((listType === 'unordered' && currentUnordered) || (listType === 'ordered' && currentOrdered)) {
          listLines.push(lines[i])
          i++
        } else if (lines[i].trim() === '') {
          i++
        } else {
          break
        }
      }
      blocks.push({ type: listType, lines: listLines })
      continue
    }

    if (line.trim() === '') {
      i++
      continue
    }

    // Collect paragraph lines until empty line or special block
    const paraLines: string[] = [line]
    i++
    while (i < lines.length) {
      const next = lines[i]
      if (next.trim() === '') break
      if (/^#{1,6}\s/.test(next.trimStart())) break
      if (/^\s*([-+*]|\d+\.)\s+/.test(next)) break
      if (next.trimStart().startsWith('>')) break
      if (next.trimStart().startsWith('```')) break
      paraLines.push(next)
      i++
    }
    blocks.push({ type: 'paragraph', lines: paraLines })
  }

  return blocks
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content.trim()) {
    return <div className={className} />
  }

  const blocks = parseBlocks(content)

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, index) => {
        const key = `block-${index}`

        if (block.type === 'code') {
          return (
            <div key={key} className="rounded-lg overflow-hidden bg-black/5 dark:bg-white/10 my-2">
              {block.language && (
                <div className="px-3 py-1 text-xs text-text-secondary bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/5">
                  {block.language}
                </div>
              )}
              <pre className="p-3 overflow-x-auto text-sm font-mibold">
                <code className="text-sm font-mono">{block.lines.join('\n')}</code>
              </pre>
            </div>
          )
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={key}
              className="border-l-4 border-primary/40 pl-3 py-1 my-2 text-text-secondary italic bg-black/[0.02] dark:bg-white/[0.02] rounded-r"
            >
              {block.lines.map((line, i) => (
                <p key={i} className="text-sm leading-relaxed">
                  {renderInline(line)}
                </p>
              ))}
            </blockquote>
          )
        }

        if (block.type === 'unordered') {
          return (
            <ul key={key} className="list-disc list-inside space-y-1 pl-1">
              {block.lines.map((line, i) => {
                const text = line.replace(/^\s*[-*+]\s+/, '')
                return (
                  <li key={i} className="text-sm leading-relaxed">
                    {renderInline(text)}
                  </li>
                )
              })}
            </ul>
          )
        }

        if (block.type === 'ordered') {
          return (
            <ol key={key} className="list-decimal list-inside space-y-1 pl-1">
              {block.lines.map((line, i) => {
                const text = line.replace(/^\s*\d+\.\s+/, '')
                return (
                  <li key={i} className="text-sm leading-relaxed">
                    {renderInline(text)}
                  </li>
                )
              })}
            </ol>
          )
        }

        const paragraphText = block.lines.join(' ')
        const headingMatch = paragraphText.match(/^(#{1,6})\s+(.+)$/)
        if (headingMatch) {
          const level = headingMatch[1].length
          const text = headingMatch[2]
          const sizeClass =
            level === 1
              ? 'text-lg'
              : level === 2
              ? 'text-base'
              : level === 3
              ? 'text-sm'
              : 'text-xs'
          const HeadingTag = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' } as const
          return React.createElement(
            HeadingTag[level] || 'h6',
            {
              key,
              className: `font-bold text-text-primary mt-4 mb-2 ${sizeClass}`,
            },
            renderInline(text)
          )
        }

        return (
          <p key={key} className="text-sm leading-relaxed">
            {renderInline(paragraphText)}
          </p>
        )
      })}
    </div>
  )
}
