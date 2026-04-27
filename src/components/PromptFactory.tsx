'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Edit2, Trash2, Check, X, Wand2 } from 'lucide-react'
import clsx from 'clsx'

export interface PromptTemplate {
  id: string
  name: string
  content: string
}

interface Props {
  templates: PromptTemplate[]
  selectedId: string | null
  onSelect: (id: string) => void
  onSave: (template: PromptTemplate) => void
  onDelete: (id: string) => void
}

const MAX = 5

export default function PromptFactory({ templates, selectedId, onSelect, onSave, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PromptTemplate | null>(null)
  const [isNew, setIsNew] = useState(false)

  const selected = templates.find((t) => t.id === selectedId)

  function startNew() {
    setEditing({ id: `pt_${Date.now()}`, name: '', content: '' })
    setIsNew(true)
    if (!open) setOpen(true)
  }

  function startEdit(t: PromptTemplate, e: React.MouseEvent) {
    e.stopPropagation()
    setEditing({ ...t })
    setIsNew(false)
    if (!open) setOpen(true)
  }

  function cancelEdit() {
    setEditing(null)
    setIsNew(false)
  }

  function handleSave() {
    if (!editing?.name.trim() || !editing?.content.trim()) return
    onSave(editing)
    setEditing(null)
    setIsNew(false)
  }

  return (
    <div className="mb-5 rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
      {/* ── Header (always visible) ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Wand2 className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-slate-300">Prompt Factory</span>
          <span className="text-xs text-slate-600">·</span>
          {selected ? (
            <span className="text-xs text-violet-300 truncate">{selected.name}</span>
          ) : (
            <span className="text-xs text-amber-400/80">no prompt selected</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className="text-xs text-slate-600">{templates.length}/{MAX}</span>
          {open
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
        </div>
      </button>

      {/* ── Body ── */}
      {open && (
        <div className="border-t border-slate-700/60 p-4 space-y-2.5">
          {templates.length === 0 && !isNew && (
            <p className="text-xs text-slate-500 text-center py-3">
              No prompts yet — create one to control how ideas are generated.
            </p>
          )}

          {/* Saved prompts */}
          {templates.map((t) =>
            editing && editing.id === t.id ? (
              <PromptEditForm
                key={t.id}
                editing={editing}
                onChange={setEditing}
                onSave={handleSave}
                onCancel={cancelEdit}
              />
            ) : (
              <div
                key={t.id}
                role="radio"
                aria-checked={selectedId === t.id}
                onClick={() => onSelect(t.id)}
                className={clsx(
                  'group flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedId === t.id
                    ? 'border-violet-500/50 bg-violet-500/10'
                    : 'border-slate-700/60 bg-slate-900/30 hover:border-slate-600 hover:bg-slate-900/50',
                )}
              >
                {/* Radio dot */}
                <div className={clsx(
                  'mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors',
                  selectedId === t.id
                    ? 'border-violet-400 bg-violet-400'
                    : 'border-slate-600 group-hover:border-slate-500',
                )} />

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-200 leading-tight">{t.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{t.content}</p>
                </div>

                {/* Edit / Delete — revealed on hover */}
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => startEdit(t, e)}
                    title="Edit"
                    className="p-1.5 text-slate-500 hover:text-slate-200 rounded-md transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(t.id) }}
                    title="Delete"
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          )}

          {/* New prompt form */}
          {isNew && editing && !templates.find((t) => t.id === editing.id) && (
            <PromptEditForm
              editing={editing}
              onChange={setEditing}
              onSave={handleSave}
              onCancel={cancelEdit}
            />
          )}

          {/* Add button */}
          {!editing && templates.length < MAX && (
            <button
              onClick={startNew}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-slate-700 text-xs text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Prompt
            </button>
          )}

          {!editing && templates.length >= MAX && (
            <p className="text-xs text-slate-600 text-center pt-1">
              Max {MAX} prompts reached — delete one to add another
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function PromptEditForm({
  editing,
  onChange,
  onSave,
  onCancel,
}: {
  editing: PromptTemplate
  onChange: (t: PromptTemplate) => void
  onSave: () => void
  onCancel: () => void
}) {
  const valid = editing.name.trim().length > 0 && editing.content.trim().length > 0

  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
      <input
        autoFocus
        type="text"
        value={editing.name}
        onChange={(e) => onChange({ ...editing, name: e.target.value })}
        placeholder="Prompt name (e.g. Vedic Astrology Focus)"
        className="w-full bg-slate-900/70 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-violet-500 placeholder:text-slate-600"
      />
      <textarea
        value={editing.content}
        onChange={(e) => onChange({ ...editing, content: e.target.value })}
        placeholder="Write your full system prompt here — this becomes the AI's complete instructions when generating content ideas…"
        rows={8}
        className="w-full bg-slate-900/70 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500 placeholder:text-slate-600 resize-y font-mono leading-relaxed"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-600">{editing.content.length.toLocaleString()} chars</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors"
          >
            <X className="w-3 h-3" /> Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!valid}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-3 h-3" /> Save
          </button>
        </div>
      </div>
    </div>
  )
}