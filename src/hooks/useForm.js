import { useState, useRef } from 'react';

/**
 * useForm — local draft state for any form.
 *
 * Rules enforced by this hook:
 *  - onChange → setField()  (local draft only, never touches DB or global state)
 *  - onBlur / button click → save(callback)  (callback receives the final draft)
 *
 * isDirty is true when the draft differs from the last reset/save baseline,
 * so you can show a Save button only when there are actual changes.
 */
export function useForm(initialData) {
  // baseRef tracks the last "clean" snapshot (after reset or save)
  const baseRef = useRef(initialData);
  const [draft, setDraft] = useState(initialData);

  /** Update a single key inside the draft object */
  function setField(key, value) {
    setDraft(prev => ({ ...prev, [key]: value }));
  }

  /**
   * Reset the draft to new data (e.g. after loading from DB, or clearing a form).
   * Also resets the dirty baseline so isDirty becomes false again.
   */
  function reset(data) {
    const next = data ?? initialData;
    baseRef.current = next;
    setDraft(next);
  }

  /**
   * Persist the draft.
   * Calls onSave(draft), then marks the current draft as the new clean baseline
   * so isDirty flips back to false.
   */
  function save(onSave) {
    onSave(draft);
    baseRef.current = draft;
  }

  const isDirty =
    JSON.stringify(draft) !== JSON.stringify(baseRef.current);

  return { draft, setField, reset, save, isDirty };
}
