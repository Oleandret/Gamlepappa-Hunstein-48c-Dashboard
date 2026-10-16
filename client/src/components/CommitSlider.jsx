import { useEffect, useRef, useState } from 'react';

// Editing is local. Pointer release, keyboard release or blur commits once.
export function CommitSlider({ value, onCommit, disabled, label, min = 0, max = 100, step = 1, suffix = '%' }) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const observedRef = useRef(value);
  observedRef.current = value;
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) { setDraft(value); draftRef.current = value; }
  }, [value]);
  function commit() {
    if (!dirty.current || disabled) return;
    dirty.current = false;
    Promise.resolve(onCommit(draftRef.current)).then(result => {
      if (result?.ok === false && !dirty.current) cancel();
    }).catch(() => { if (!dirty.current) cancel(); });
  }
  function cancel() {
    dirty.current = false; draftRef.current = observedRef.current; setDraft(observedRef.current);
  }
  return <>
    <input type="range" min={min} max={max} step={step} value={draft} disabled={disabled}
      aria-label={label} aria-valuetext={`${draft}${suffix}`} className="w-32 accent-nx-cyan disabled:opacity-40"
      onChange={event => { draftRef.current = Number(event.target.value); dirty.current = true; setDraft(draftRef.current); }}
      onPointerDown={event => event.currentTarget.setPointerCapture?.(event.pointerId)}
      onPointerUp={commit} onPointerCancel={cancel} onBlur={commit}
      onKeyDown={event => { if (event.key === 'Escape') cancel(); }}
      onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) commit(); }}
    />
    <span className="font-mono text-[10px] text-nx-mute tabular-nums w-12 text-right">{draft}{suffix}</span>
  </>;
}
