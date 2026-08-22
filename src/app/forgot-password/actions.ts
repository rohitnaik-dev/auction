'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'

const emailSchema = z.string().email('Please enter a valid email address.')

export async function requestPasswordReset(formData: FormData) {
  const email = (formData.get('email') as string || '').trim()

  const validation = emailSchema.safeParse(email)
  if (!validation.success) {
    redirect(`/forgot-password?error=${encodeURIComponent(validation.error.issues[0].message)}`)
  }

  const headerList = await headers()
  const host = headerList.get('host') || 'localhost:3000'
  const protocol = headerList.get('x-forwarded-proto') || 'http'
  const origin = `${protocol}://${host}`

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/forgot-password?message=${encodeURIComponent('Password reset link sent! Please check your email inbox.')}`)
}

