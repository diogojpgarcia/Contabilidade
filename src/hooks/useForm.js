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

  // Guard: only initialise once so a new object reference on a re-render
  // (e.g. derived/spread props) does NOT wipe the user's in-progress draft.
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      setDraft(initialData);
      initialized.current = true;
    }
  }, [initialData]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Update one key — safe to call directly from onChange */
  function setField(key, value) {
    setDraft(prev => ({ ...prev, [key]: value }));
  }

  /** Persist: calls onSave(draft). No DB/global state here. */
  function save(onSave) {
    onSave(draft);
  }

  /**
   * Explicit reset (e.g. data loaded from DB, modal closed, form cleared).
   * This is the ONLY way to update the draft from outside after mount.
   */
  function reset(data) {
    setDraft(data);
  }

  return { draft, setField, save, reset };
}
