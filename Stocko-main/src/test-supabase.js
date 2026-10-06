import { supabase } from './lib/supabase.js'

async function testConnection() {
  console.log('🔍 Testing Supabase connection...')
  console.log('URL:', supabase.supabaseUrl)
  
  try {
    const { data, error } = await supabase
      .from('demands')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Error:', error.message)
      console.error('Full error:', error)
    } else {
      console.log('✅ Supabase connected successfully!')
      console.log('Data:', data)
    }
  } catch (err) {
    console.error('❌ Exception:', err.message)
  }
}

testConnection()