'use client';

import { memo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { UIMessage } from 'ai';
import ToolProgress from './tool_progress';
import ChartRenderer from '@/components/charts/chart_renderer';
import DataTable from '@/components/charts/data_table';
import type { TableInput } from '@/lib/chart_tool';

function UserMessage({ text }: { text: string }) {
  return (
    <div className="rise-in mb-5 mt-10 first:mt-0">
      <div className="flex items-baseline gap-3">
        <span aria-hidden className="h-6 w-1 shrink-0 translate-y-1 rounded-full bg-accent" />
        <h2 className="font-display text-xl leading-snug text-ink sm:text-2xl">{text}</h2>
      </div>
    </div>
  );
}

function AssistantText({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <div
      className={`prose-fiscal max-w-none text-[15px] leading-relaxed text-ink-soft ${
        streaming ? 'streaming-caret' : ''
      }`}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          strong: (props) => <strong className="font-semibold text-ink" {...props} />,
          h1: (props) => <h3 className="mb-2 mt-4 font-display text-lg text-ink" {...props} />,
          h2: (props) => <h3 className="mb-2 mt-4 font-display text-lg text-ink" {...props} />,
          h3: (props) => <h4 className="mb-2 mt-3 font-display text-base text-ink" {...props} />,
          ul: (props) => <ul className="my-2 space-y-1 ps-5 [list-style-type:'– ']" {...props} />,
          ol: (props) => <ol className="my-2 list-decimal space-y-1 ps-5" {...props} />,
          p: (props) => <p className="my-2" {...props} />,
          a: (props) => (
            <a
              className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          table: (props) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-hairline">
              <table className="w-full text-sm" {...props} />
            </div>
          ),
          th: (props) => (
            <th className="border-b border-hairline bg-surface px-3 py-1.5 text-start text-xs font-medium text-ink-faint" {...props} />
          ),
          td: (props) => <td className="border-b border-hairline/50 px-3 py-1.5" {...props} />,
          code: (props) => (
            <code dir="ltr" className="rounded bg-surface px-1 py-0.5 font-figures text-[13px]" {...props} />
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

function MessageBubble({ message, is_last, streaming }: { message: UIMessage; is_last: boolean; streaming: boolean }) {
  if (message.role === 'user') {
    const text = message.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('');
    return <UserMessage text={text} />;
  }

  const last_text_index = message.parts.findLastIndex((p) => p.type === 'text');

  return (
    <div className="mb-6">
      {message.parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <AssistantText
              key={i}
              text={part.text}
              streaming={streaming && is_last && i === last_text_index}
            />
          );
        }
        if (part.type === 'dynamic-tool') {
          return (
            <ToolProgress
              key={part.toolCallId}
              tool_name={part.toolName}
              state={normalizeToolState(part.state)}
              input={part.input}
              error_text={part.state === 'output-error' ? part.errorText : undefined}
            />
          );
        }
        if (part.type === 'tool-display_chart') {
          if (part.state === 'output-available' || part.state === 'input-available') {
            return <ChartRenderer key={part.toolCallId} input={part.input} />;
          }
          return null;
        }
        if (part.type === 'tool-display_table') {
          if (part.state === 'output-available' || part.state === 'input-available') {
            const input = part.input as TableInput;
            if (!input?.columns || !input?.rows) return null;
            return (
              <DataTable
                key={part.toolCallId}
                title={input.title}
                columns={input.columns}
                rows={input.rows}
                footnote={input.footnote}
              />
            );
          }
          return null;
        }
        // Any other data tool routed through the REST fallback (static tools).
        if (part.type.startsWith('tool-Dataset')) {
          const p = part as unknown as {
            toolCallId: string;
            state: ToolProgressState;
            input?: unknown;
            errorText?: string;
          };
          return (
            <ToolProgress
              key={p.toolCallId}
              tool_name={part.type.replace('tool-', '')}
              state={p.state}
              input={p.input}
              error_text={p.errorText}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

type ToolProgressState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error';

// Approval/denial states never occur here (no tools require approval) — map
// anything unexpected onto the closest visual.
function normalizeToolState(state: string): ToolProgressState {
  if (state === 'input-streaming' || state === 'output-available' || state === 'output-error') {
    return state;
  }
  return 'input-available';
}

export default memo(MessageBubble);
