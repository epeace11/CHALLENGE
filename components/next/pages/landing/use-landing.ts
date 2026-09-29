'use client';
import { useState } from 'react';
import { useNav } from '@/components/next/nav';
import { setSignupMode } from '../signup/mode';

/**
 * Where the landing page's buttons go, shared by both versions. "Start a challenge" and every theme
 * open Sign up; "Sign in" opens the same page on its sign-in form; "I have an invite" opens Invite.
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
  return { start, signIn, invite, how, setHow };
}
