import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CodeBlock from './CodeBlock'

// Renders fenced code blocks through the existing CodeBlock (highlight.js),
// and inline code as a styled <code>. react-markdown passes `node` in props,
// which must be stripped before spreading onto a DOM element.
function CodeRenderer({ className, children, node, ...props }) {
  const raw = String(children ?? '')
  const languageMatch = /language-([\w-]+)/.exec(className || '')
  const isBlock = Boolean(languageMatch) || raw.includes('\n')

  if (isBlock) {
    return (
      <div className="md-code-block">
        <CodeBlock code={raw.replace(/\n$/, '')} language={languageMatch ? languageMatch[1] : 'text'} />
      </div>
    )
  }

  return <code className="md-inline-code" {...props}>{children}</code>
}

const COMPONENTS = {
  // Unwrap <pre> so fenced blocks are not nested inside another <pre>
  pre: ({ children }) => <>{children}</>,
  code: CodeRenderer,
  a: ({ href, children }) => (
    <a className="md-link" href={href} target="_blank" rel="noreferrer">{children}</a>
  ),
  table: ({ children }) => (
    <div className="md-table-wrap"><table className="md-table">{children}</table></div>
  ),
}

export default function Markdown({ children }) {
  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children || ''}
      </ReactMarkdown>
    </div>
  )
}
