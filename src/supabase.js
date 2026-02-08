import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zjeccddhahjoidxfhygd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZWNjZGRoYWhqb2lkeGZoeWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NzY5MTEsImV4cCI6MjA4NjE1MjkxMX0.falvreNZTf2nBRvJ5jHgGRJipa1r35ZzOtF8QzqjbjA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
