import React from 'react';
import { useForm } from '../../hooks/useForm';

/**
 * Isolated input so the goal-savings field has its own draft.
 * onChange → local draft only.  onBlur → parent save (touches DB).
 */
const GoalSavingsInput = ({ goal, onSave, className }) => {
  const { draft, setField } = useForm({ currentSavings: goal.currentSavings ?? 0 });
  return (
    <input
      type="number"
      className={className}
      value={draft.currentSavings || ''}
      onChange={(e) => setField('currentSavings', e.target.value)}
      onBlur={() => onSave(goal.id, parseFloat(draft.currentSavings) || 0)}
      step="10"
      min="0"
      placeholder="0"
    />
  );
};

export default GoalSavingsInput;
