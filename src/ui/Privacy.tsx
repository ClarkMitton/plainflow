import { useState } from "react";
import { APP_NAME } from "./brand";

/**
 * Practising what we preach: what this app stores, where it goes, and a way to clear it.
 * Plainflow has no server, no accounts and no database; everything stays in this browser.
 */
export function PrivacyNote({ onCleared }: { onCleared(): void }) {
  const [open, setOpen] = useState(false);
  const clear = () => {
    if (!confirm("Clear everything Plainflow has stored in this browser? Save any flow you want to keep first.")) return;
    try { localStorage.clear(); } catch { /* nothing to clear */ }
    setOpen(false);
    onCleared();
  };
  return (
    <>
      <button type="button" className="linkish" onClick={() => setOpen(true)}>Your data and this app</button>
      {open && (
        <>
          <div className="coach-backdrop" onClick={() => setOpen(false)} />
          <div className="coach modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title" style={{ width: 520 }}>
            <p className="lab">How this app handles data</p>
            <h2 id="privacy-title">Your data and this app</h2>
            <p><strong>Where it goes:</strong> nowhere. {APP_NAME} has no server, no accounts and no database. What you type stays in this browser until you save a file.</p>
            <p style={{ marginTop: 8 }}><strong>What's stored here:</strong> the flow you're working on, the answers you gave, any company cards you chose to save for next time, and a note of which first-time guides you've seen. Nothing else.</p>
            <p style={{ marginTop: 8 }}><strong>What leaves this browser:</strong> only when you scan an app's code, requests go to GitHub for that repository's public files. The code is read in memory and dropped. No other outside service is called.</p>
            <p style={{ marginTop: 8 }}><strong>No real names:</strong> every text box warns if what you type looks like a person's name or contact details, because this app is meant to hold none.</p>
            <div className="coach-nav">
              <button type="button" className="btn" onClick={clear}>Clear everything stored here</button>
              <span className="spacer" />
              <button type="button" className="btn dk" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
