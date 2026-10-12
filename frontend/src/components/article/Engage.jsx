import { useState } from 'react';
import API, { authHeaders, errorMessage } from '../../config/API';
import { useToast } from '../../context/ToastContext';
import { REACTIONS, REACTION_LABEL } from '../../shared/rules';
import { formatNumber } from '../../lib/text';

const ICON = { like: 'bi-hand-thumbs-up', insightful: 'bi-lightbulb', sad: 'bi-emoji-frown', surprised: 'bi-emoji-surprise' };

export function Reactions({ newsId, initial }) {
  const toast = useToast();
  const [state, setState] = useState({ reactions: initial.reactions, mine: initial.mine });
  const [busy, setBusy] = useState(false);
  const pick = async (type) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await API.put(`/news/${newsId}/reaction`, { type: state.mine === type ? null : type }, { headers: authHeaders() });
      setState({ reactions: res.data.reactions, mine: res.data.mine });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="reactions" role="group" aria-label="How did this story make you feel?">
      {REACTIONS.map((r) => (
        <button key={r} type="button" className={`reaction ${state.mine === r ? 'is-on' : ''}`} aria-pressed={state.mine === r} onClick={() => pick(r)} disabled={busy}>
          <i className={`bi ${ICON[r]}`} aria-hidden="true" /> <span>{REACTION_LABEL[r]}</span> <strong>{formatNumber(state.reactions[r] || 0)}</strong>
        </button>
      ))}
    </div>
  );
}

export function Poll({ newsId, initial }) {
  const toast = useToast();
  const [poll, setPoll] = useState(initial);
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const voted = !!poll.myVote;
  const showResults = voted || poll.closed;
  const vote = async (e) => {
    e.preventDefault();
    if (!choice) { toast.error('Choose an answer first'); return; }
    setBusy(true);
    try {
      const res = await API.post(`/news/${newsId}/poll/vote`, { optionId: choice }, { headers: authHeaders() });
      setPoll(res.data.poll);
      toast.success('Thanks for voting');
    } catch (err) {
      if (err.response && err.response.data && err.response.data.poll) setPoll(err.response.data.poll);
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="poll panel" aria-labelledby="poll-q">
      <h2 id="poll-q" className="poll-q"><i className="bi bi-bar-chart-line" aria-hidden="true" /> {poll.question}</h2>
      {showResults ? (
        <>
          <ul className="poll-results">
            {poll.options.map((o) => {
              const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0;
              return (
                <li key={o.id}>
                  <span className="poll-label">{o.label}{poll.myVote === o.id && <em> (your vote)</em>}</span>
                  <span className="bar-track" aria-hidden="true"><span className="bar-fill" style={{ width: `${pct}%` }} /></span>
                  <span className="bar-value">{pct}%<span className="visually-hidden">, {o.votes} votes</span></span>
                </li>
              );
            })}
          </ul>
          <p className="muted small">{poll.total} {poll.total === 1 ? 'vote' : 'votes'}{poll.closed ? ' · poll closed' : ''}</p>
        </>
      ) : (
        <form onSubmit={vote}>
          <fieldset className="poll-options">
            <legend className="visually-hidden">{poll.question}</legend>
            {poll.options.map((o) => (
              <label key={o.id} className="check"><input type="radio" name="poll" value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} /> {o.label}</label>
            ))}
          </fieldset>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Sending…' : 'Vote'}</button>
        </form>
      )}
    </section>
  );
}
