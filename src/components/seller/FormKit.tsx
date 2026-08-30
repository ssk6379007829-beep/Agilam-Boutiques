import type { ReactNode } from 'react';
import { css } from '@/lib/css';

/**
 * Field primitives shared by the seller setup wizard and the seller settings
 * screens. The design is ported from inline-styled markup (see @/lib/css), so
 * these wrappers exist to keep one copy of each style string rather than
 * repeating it across ~40 onboarding inputs.
 */

const INPUT = 'width:100%;margin-top:6px;border:1.5px solid var(--ag-border);background:var(--ag-surface);border-radius:13px;padding:0 14px;height:50px;font-size:14px;font-weight:600;color:var(--ag-ink);box-sizing:border-box;font-family:inherit;';
// An errored control changes its BORDER, not just its fill. The previous form
// of this line replaced `var(--ag-border)` with itself, so the only difference
// between a valid and an invalid field was a faint surface tint — which on its
// own is both easy to miss and (being colour alone) not an accessible signal.
const INPUT_ERR = INPUT
  .replace('1.5px solid var(--ag-border)', '1.5px solid var(--ag-danger-text)')
  .replace('background:var(--ag-surface)', 'background:var(--ag-surface-2)');
const TEXTAREA = 'width:100%;margin-top:6px;border:1.5px solid var(--ag-border);background:var(--ag-surface);border-radius:13px;padding:12px 14px;font-size:14px;font-weight:500;color:var(--ag-ink);box-sizing:border-box;font-family:inherit;resize:vertical;min-height:88px;';
const TEXTAREA_ERR = TEXTAREA
  .replace('1.5px solid var(--ag-border)', '1.5px solid var(--ag-danger-text)')
  .replace('background:var(--ag-surface)', 'background:var(--ag-surface-2)');
const LABEL = 'display:block;font-size:13px;font-weight:700;color:var(--ag-label);';
// 12.5px, not 11.5px: this is the text that tells a seller how to fix a blocked
// form, so it must not be the smallest type on the screen.
const ERR = 'display:block;margin-top:4px;font-size:12.5px;font-weight:700;color:var(--ag-danger-text);';
const WARN = 'display:block;margin-top:4px;font-size:12.5px;font-weight:700;color:var(--ag-warn-text);';
const HINT = 'display:block;margin-top:4px;font-size:12.5px;font-weight:600;color:var(--ag-muted);';

/** A DOM-safe slug for a field's label, used to mint ids for its help text. */
function slug(label: string) {
  return label.replace(/\W+/g, '-').toLowerCase();
}

export function Field({
  label, value, onChange, placeholder, error, warning, hint, type = 'text', inputMode, maxLength, disabled, suggestions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  /**
   * A value that is accepted but probably wrong. Unlike `error` it never blocks
   * saving — it is shown under the input in amber, and only when there is no
   * error to show instead.
   */
  warning?: string;
  hint?: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'url';
  maxLength?: number;
  disabled?: boolean;
  /**
   * Offered spellings, shown as the browser's native autocomplete list. The
   * field stays free text — a shop in a town that isn't listed must still be
   * able to sign up — but picking from the list is one tap, which is what keeps
   * "Cbe" and "Coimbatore" from both ending up in the city column.
   */
  suggestions?: readonly string[];
}) {
  // Stable per label so two fields on one screen can't share a list.
  const base = slug(label);
  const listId = suggestions?.length ? `agx-dl-${base}` : undefined;
  // Whichever line of help text is actually rendered gets the id the input
  // points at, so a screen reader announces the error (or the hint) as part of
  // the field rather than as loose prose somewhere after it.
  const noteId = error || warning || hint ? `agx-note-${base}` : undefined;
  return (
    <label style={css(LABEL)}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        disabled={disabled}
        list={listId}
        aria-invalid={error ? true : undefined}
        aria-describedby={noteId}
        data-agx-field={base}
        style={css(`${error ? INPUT_ERR : INPUT}${disabled ? 'opacity:.6;' : ''}`)}
      />
      {listId && (
        <datalist id={listId}>
          {suggestions?.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
      {error ? <span id={noteId} style={css(ERR)}>{error}</span>
        : warning ? <span id={noteId} style={css(WARN)}>{warning}</span>
        : hint ? <span id={noteId} style={css(HINT)}>{hint}</span> : null}
    </label>
  );
}

export function TextArea({
  label, value, onChange, placeholder, error, hint, maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  maxLength?: number;
}) {
  const base = slug(label);
  const noteId = error || hint ? `agx-note-${base}` : undefined;
  return (
    <label style={css(LABEL)}>
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={noteId}
        data-agx-field={base}
        style={css(error ? TEXTAREA_ERR : TEXTAREA)}
      />
      {error ? <span id={noteId} style={css(ERR)}>{error}</span>
        : hint ? <span id={noteId} style={css(HINT)}>{hint}</span> : null}
    </label>
  );
}

/** A row of pills — one pick by default, any number of them with `multiple`. */
export function ChipPicker({
  label, options, value, onChange, error, multiple, hint,
}: {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
  multiple?: boolean;
  hint?: string;
}) {
  const toggle = (opt: string) => {
    if (!multiple) return onChange(value[0] === opt ? [] : [opt]);
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };

  const base = slug(label);
  const noteId = error || hint ? `agx-note-${base}` : undefined;
  const groupId = `agx-group-${base}`;

  return (
    <div>
      <div id={groupId} style={css(LABEL)}>{label}</div>
      <div
        role="group"
        aria-labelledby={groupId}
        aria-describedby={noteId}
        style={css('display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;')}
      >
        {options.map((opt) => {
          const on = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              // The pill IS the state, so it has to say so — a sighted user reads
              // the fill, everyone else reads aria-pressed.
              aria-pressed={on}
              style={css(`min-height:44px;padding:9px 14px;border-radius:11px;border:1.5px solid ${on ? 'var(--ag-crimson)' : 'var(--ag-border)'};background:${on ? 'var(--ag-surface-2)' : 'var(--ag-surface)'};color:${on ? 'var(--ag-crimson)' : 'var(--ag-ink-2)'};font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;`)}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {error ? <span id={noteId} style={css(ERR)}>{error}</span>
        : hint ? <span id={noteId} style={css(HINT)}>{hint}</span> : null}
    </div>
  );
}

export function Toggle({
  label, description, icon, on, onChange,
}: {
  label: string;
  description?: string;
  icon?: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={css('width:100%;min-height:44px;display:flex;align-items:center;gap:12px;padding:13px 14px;border:1.5px solid var(--ag-border);background:var(--ag-surface);border-radius:14px;cursor:pointer;text-align:left;font-family:inherit;')}
    >
      {icon && (
        <span style={css('width:44px;height:44px;flex:none;border-radius:12px;background:var(--ag-surface-2);display:flex;align-items:center;justify-content:center;')}>
          <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';color:var(--ag-crimson);font-size:19px;")}>{icon}</span>
        </span>
      )}
      <span style={css('flex:1;min-width:0;')}>
        <span style={css('display:block;font-weight:700;font-size:14px;color:var(--ag-ink);')}>{label}</span>
        {description && <span style={css('display:block;font-size:12.5px;color:var(--ag-muted);font-weight:600;margin-top:2px;')}>{description}</span>}
      </span>
      <span aria-hidden="true" style={css(`width:46px;height:27px;flex:none;border-radius:999px;background:${on ? 'var(--ag-crimson)' : 'var(--ag-border)'};position:relative;transition:background .18s;`)}>
        <span style={css(`position:absolute;top:3px;left:${on ? '22px' : '3px'};width:21px;height:21px;border-radius:50%;background:var(--ag-surface);box-shadow:0 2px 6px rgba(0,0,0,.2);transition:left .18s;`)} />
      </span>
    </button>
  );
}

/** A titled block inside a step or a settings page. */
export function SectionCard({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={css('background:var(--ag-surface);border:1px solid var(--ag-surface-3);border-radius:20px;padding:18px;box-shadow:0 16px 38px -30px rgba(107,20,54,.6);')}>
      {title && <h2 style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:19px;color:var(--ag-ink);margin:0;")}>{title}</h2>}
      {subtitle && <div style={css('font-size:12.5px;color:var(--ag-muted);font-weight:600;margin-top:3px;')}>{subtitle}</div>}
      <div style={css(`display:flex;flex-direction:column;gap:14px;${title || subtitle ? 'margin-top:16px;' : ''}`)}>{children}</div>
    </div>
  );
}

/** Two fields side by side on wide screens, stacked on a phone. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="agx-form-row" style={css('display:grid;grid-template-columns:1fr 1fr;gap:14px;')}>{children}</div>;
}
