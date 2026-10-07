/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ConfirmContext = createContext(() => Promise.resolve(false));

// confirm({ title, message, confirmLabel, danger }) -> Promise<boolean>
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const confirmRef = useRef(null);
  const returnFocus = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    returnFocus.current = document.activeElement;
    setDialog({ ...options, resolve });
  }), []);

  const close = useCallback((result) => {
    setDialog((d) => {
      if (d) d.resolve(result);
      return null;
    });
    if (returnFocus.current && returnFocus.current.focus) returnFocus.current.focus();
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Tab') {
        // keep keyboard focus inside the dialog
        const nodes = document.querySelectorAll('.modal button');
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
            <h2 id="confirm-title" className="modal-title">{dialog.title || 'Are you sure?'}</h2>
            <p id="confirm-message" className="modal-message">{dialog.message}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => close(false)}>Cancel</button>
              <button type="button" ref={confirmRef} className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
                {dialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
