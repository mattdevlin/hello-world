import { useState, useRef, useMemo } from 'react';
import { evaluateMathExpression } from '../utils/mathEval.js';

export default function CalcInput({ value, onChange, onBlur, style, disabled, ...rest }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const inputRef = useRef(null);

  const displayValue = editing ? editText : String(value ?? '');

  // Compute preview during render
  const preview = useMemo(() => {
    if (!editing || !editText.startsWith('=')) return null;
    try {
      return evaluateMathExpression(editText.slice(1));
    } catch {
      return null;
    }
  }, [editing, editText]);

  const commit = (currentText) => {
    setEditing(false);
    if (currentText.startsWith('=')) {
      try {
        const result = evaluateMathExpression(currentText.slice(1));
        onChange(result);
        return;
      } catch {
        // revert — display reverts to value prop automatically
        return;
      }
    }
    const num = parseInt(currentText) || 0;
    onChange(num);
  };

  const handleFocus = () => {
    setEditing(true);
    setEditText(String(value ?? ''));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(editText);
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      setEditing(false);
      inputRef.current?.blur();
    }
  };

  const handleBlur = () => {
    commit(editText);
    if (onBlur) onBlur();
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={e => setEditText(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={style}
        disabled={disabled}
        {...rest}
      />
      {editing && preview != null && (
        <div style={previewStyle}>
          = {preview}
        </div>
      )}
    </div>
  );
}

const previewStyle = {
  position: 'absolute',
  left: 0,
  top: '100%',
  marginTop: 2,
  padding: '2px 8px',
  fontSize: 11,
  fontWeight: 600,
  color: '#2C5F8A',
  background: '#f0f7ff',
  border: '1px solid #c4daf0',
  borderRadius: 3,
  whiteSpace: 'nowrap',
  zIndex: 10,
  pointerEvents: 'none',
};
