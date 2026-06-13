import { Button, SectionHeader } from 'even-toolkit/web'
import type { DesignParams } from '../params/types'
import { containerSnippet, designParamsJson } from './export'

export interface ExportPanelProps {
  params: DesignParams
}

export function ExportPanel({ params }: ExportPanelProps) {
  const json = designParamsJson(params)
  const snippet = containerSnippet(params)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader title="Export" />
        <Button
          size="sm"
          variant="highlight"
          onClick={async () => {
            try {
              await navigator.clipboard?.writeText(snippet)
            } catch (err) {
              console.error('Failed to copy snippet:', err)
            }
          }}
        >
          Copy TS
        </Button>
      </div>
      <label className="block space-y-1">
        <span className="text-[13px] text-text-dim">DesignParams JSON</span>
        <textarea
          className="h-48 w-full resize-y rounded-md border border-border bg-input-bg p-2 font-mono text-[12px] text-text"
          readOnly
          value={json}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[13px] text-text-dim">Container TS</span>
        <textarea
          className="h-72 w-full resize-y rounded-md border border-border bg-input-bg p-2 font-mono text-[12px] text-text"
          readOnly
          value={snippet}
        />
      </label>
    </section>
  )
}
