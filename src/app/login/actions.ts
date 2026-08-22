'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'

function getSafeRedirectUrl(url: string | null | undefined, fallback = '/dashboard'): string {
  if (!url || typeof url !== 'string') return fallback
  const trimmed = url.trim()
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed
  }
  return fallback
}

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
})

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const rawNext = formData.get('next') as string
  const nextUrl = getSafeRedirectUrl(rawNext)

  const validation = loginSchema.safeParse({ email, password })
  if (!validation.success) {
    redirect(`/login?error=${encodeURIComponent(validation.error.issues[0].message)}&next=${encodeURIComponent(nextUrl)}`)
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(nextUrl)}`)
  }

  revalidatePath('/', 'layout')
  redirect(nextUrl)
}

export async function signup(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const rawNext = data.next as string
  const nextUrl = getSafeRedirectUrl(rawNext)
  
  const result = registerSchema.safeParse(data);
  
  if (!result.success) {
    redirect(`/register?error=${encodeURIComponent(result.error.issues[0].message)}&next=${encodeURIComponent(nextUrl)}`)
  }

  const { email, password, fullName } = result.data

  const supabase = await createClient()

  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      }
    }
  })

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(nextUrl)}`)
  }

  // Create or update the public profile row immediately
  if (authData.user) {
    await supabase.from('profiles').upsert({
      id: authData.user.id,
      full_name: fullName
    })
  }

  // If auto-confirm is enabled, signUp returns a session. Redirect directly to nextUrl!
  if (authData.session) {
    redirect(nextUrl)
  }

  // Next.js App Router redirect
  redirect(`/login?message=${encodeURIComponent('Account created successfully! You can now log in.')}&next=${encodeURIComponent(nextUrl)}`)
}

