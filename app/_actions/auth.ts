'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../_lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const referredBy = formData.get('referred_by') as string | null

  const { data, error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        full_name: formData.get('full_name') as string,
        ...(referredBy ? { referred_by: referredBy } : {}),
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // If session exists, email confirmation is disabled — go to card collection
  if (data.session) {
    redirect('/setup-payment')
  }

  return { success: 'Check your email to confirm your account.' }
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(
    formData.get('email') as string,
    { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/settings` }
  )

  if (error) {
    return { error: error.message }
  }

  return { success: 'Check your email for a password reset link.' }
}
