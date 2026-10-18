'use client';
import { useState } from 'react';
import { useBackend } from '@/components/next/backend';
import { useNav } from '@/components/next/nav';
import { setSignupMode } from '../signup/mode';

/**
 * Where the landing page's buttons go, shared by both versions. "Start a challenge" and every theme
 * open Sign up; "Sign in" opens the same page on its sign-in form; "I have an invite" opens Invite
 * (the preview only: in the live app the invite link itself opens it).
 * `how` is the "How it works" sheet.
 */
export function useLanding() {
  const { navigate } = useNav();
  const [how, setHow] = useState(false);
  const start = () => {
    setHow(false);
    setSignupMode('signup');
    navigate('signup');
  };
  const signIn = () => {
    setSignupMode('signin');
    navigate('signup');
  };
  const invite = () => navigate('invite');
  // In the live app an invite opens from its link, so there is no page to go to without one.
  const canOpenInvite = !useBackend().live;
  return { start, signIn, invite, canOpenInvite, how, setHow };
}
