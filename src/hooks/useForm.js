import { useState, useRef, useEffect } from 'react';

/**
 * useForm — stable local draft state for any form.
 *
 * KEY RULE — do NOT create initialData inline on every render:
 *   ✗  useForm({ name: user.name })   ← new object every render → re-init loop
 *   ✓  useForm(user)                  ← stable reference
 *   ✓  const EMPTY = { name: '' }; useForm(EMPTY)   ← module-level constant
 *
 * Lifecycle:
 *   onChange  → setField()             (local draft only, never DB / global state)
 *   onBlur
 *   or button → save(callback)         (callback receives the final draft)
 *   load/clear→ reset(data)            (explicit reset, e.g. after DB load or modal close)
 */
export function useForm(initialData) {
  const [draft, setDraft] = useState(initialData);

  // Ref always holds the latest draft — avoids stale-closure bug in save().
  // Without this, calling save() immediately after setField() (e.g. onBlur after
  // onChange) would pass the pre-change draft to the callback because React
  // batches state updates and the closure captures the old value.
  const draftRef = useRef(draft);

  // Guard: only initialise once so a new object reference on a re-render
  // (e.g. derived/spread props) does NOT wipe the user's in-progress draft.
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      setDraft(initialData);
      draftRef.current = initialData;
      initialized.current = true;
    }
  }, [initialData]);  

  /** Update one key — safe to call directly from onChange */
  function setField(key, value) {
    setDraft(prev => {
      const next = { ...prev, [key]: value };
      draftRef.current = next; // keep ref in sync immediately (before re-render)
      return next;
    });
  }

  /** Persist: calls onSave(draft). Uses ref to always get the latest value. */
  function save(onSave) {
    onSave(draftRef.current);
  }

  /**
   * Explicit reset (e.g. data loaded from DB, modal closed, form cleared).
   * This is the ONLY way to update the draft from outside after mount.
   */
  function reset(data) {
    setDraft(data);
    draftRef.current = data;
  }

  return { draft, setField, save, reset };
}
