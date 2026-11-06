import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Profile } from './finance';

const fields: (keyof Profile)[] = ['name', 'email', 'currency', 'monthlyBudget', 'theme', 'language', 'avatar'];
const same = (a: Profile, b: Profile) => fields.every((field) => a[field] === b[field]);
const valid = (profile: Profile, persisted: Profile) => Boolean(profile.name.trim()) && Number.isFinite(profile.monthlyBudget) &&
  profile.monthlyBudget >= 0 && profile.monthlyBudget <= 1e12 &&
  (profile.monthlyBudget === persisted.monthlyBudget || Math.round(profile.monthlyBudget * 100) / 100 === profile.monthlyBudget) &&
  (!profile.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim()));

/** Keep typing responsive; blur, navigation and pagehide flush the latest valid draft. */
export function useProfileDraft(
  persisted: Profile,
  active: boolean,
  save: (base: Profile, draft: Profile) => Profile | null,
) {
  const [profile, renderProfile] = useState(persisted);
  const base = useRef(persisted);
  const observed = useRef(persisted);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ profile, persisted, active, save });
  latest.current = { profile, persisted, active, save };
  const setProfile: Dispatch<SetStateAction<Profile>> = useCallback((change) => {
    const next = typeof change === 'function' ? change(latest.current.profile) : change;
    latest.current = { ...latest.current, profile: next };
    renderProfile(next);
  }, []);
  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const flushProfile = useCallback((): boolean => {
    cancel();
    const current = latest.current;
    if (!current.active) return true;
    if (!valid(current.profile, current.persisted)) return false;
    const normalized = { ...current.profile, name: current.profile.name.trim(), email: current.profile.email.trim() };
    if (same(normalized, current.persisted)) {
      base.current = current.persisted;
      return true;
    }
    const previous = base.current;
    const saved = current.save(previous, normalized);
    if (!saved) return false;
    base.current = saved;
    // Retain the user's raw spacing while reconciling fields changed in another tab.
    const next = { ...saved };
    for (const field of fields) {
      if (current.profile[field] !== previous[field] && saved[field] === normalized[field]) {
        Object.assign(next, { [field]: current.profile[field] });
      }
    }
    latest.current = { ...current, profile: next, persisted: saved };
    if (!same(current.profile, next)) setProfile(next);
    return true;
  }, [cancel, setProfile]);
  const reloadProfile = useCallback(() => {
    cancel();
    base.current = latest.current.persisted;
    latest.current = { ...latest.current, profile: latest.current.persisted };
    setProfile(latest.current.persisted);
  }, [cancel, setProfile]);

  const commitProfileFields = useCallback((patch: Partial<Profile>): Profile | null => {
    const current = latest.current;
    const previous = base.current;
    const selected = new Set(fields.filter((field) => Object.prototype.hasOwnProperty.call(patch, field)));
    // Clicking the selected theme must not cancel an unrelated pending autosave.
    if ([...selected].every((field) => patch[field] === current.persisted[field] && current.profile[field] === current.persisted[field])) {
      return current.persisted;
    }
    cancel();
    const patchBase = { ...current.persisted };
    for (const field of selected) Object.assign(patchBase, { [field]: previous[field] });
    // Unrelated draft text may be temporarily invalid. Only selected fields are
    // submitted, against their original baseline, so conflicts remain visible.
    const saved = current.save(patchBase, { ...current.persisted, ...patch });
    if (!saved) return null;
    const next = { ...saved };
    const nextBase = { ...saved };
    for (const field of fields) {
      if (!selected.has(field) && current.profile[field] !== previous[field] && current.profile[field] !== saved[field]) {
        Object.assign(next, { [field]: current.profile[field] });
        Object.assign(nextBase, { [field]: previous[field] });
      }
    }
    base.current = nextBase;
    latest.current = { ...current, profile: next, persisted: saved };
    if (!same(current.profile, next)) setProfile(next);
    return saved;
  }, [cancel, setProfile]);

  useLayoutEffect(() => {
    if (observed.current === persisted) return;
    observed.current = persisted;
    if (base.current === persisted) return;
    const previous = base.current;
    const draft = latest.current.profile;
    const next = { ...persisted };
    const nextBase = { ...persisted };
    for (const field of fields) {
      if (draft[field] !== previous[field] && draft[field] !== persisted[field]) {
        Object.assign(next, { [field]: draft[field] });
        Object.assign(nextBase, { [field]: previous[field] });
      }
    }
    base.current = nextBase;
    if (!same(draft, next)) setProfile(next);
  }, [persisted]);
  useLayoutEffect(() => {
    cancel();
    const current = latest.current;
    if (!current.active || !valid(current.profile, current.persisted)) return;
    const normalized = { ...current.profile, name: current.profile.name.trim(), email: current.profile.email.trim() };
    if (same(normalized, current.persisted)) return;
    const immediate = current.profile.theme !== base.current.theme || current.profile.currency !== base.current.currency ||
      current.profile.language !== base.current.language || current.profile.avatar !== base.current.avatar;
    if (immediate) flushProfile();
    else timer.current = setTimeout(flushProfile, 350);
    return cancel;
  }, [profile, persisted, active, cancel, flushProfile]);
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') flushProfile(); };
    window.addEventListener('pagehide', flushProfile);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      flushProfile();
      window.removeEventListener('pagehide', flushProfile);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [flushProfile]);
  return { profile, setProfile, flushProfile, reloadProfile, commitProfileFields };
}
