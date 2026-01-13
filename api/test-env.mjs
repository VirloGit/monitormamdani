// Test endpoint to check environment variables
export async function handler(event, context) {
    const hasSupabaseUrl = !!process.env.SUPABASE_URL;
    const hasSupabaseKey = !!process.env.SUPABASE_KEY;
    const hasButtondown = !!process.env.BUTTDOWN_API;

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            environment_check: {
                SUPABASE_URL: hasSupabaseUrl ? 'SET' : 'MISSING',
                SUPABASE_KEY: hasSupabaseKey ? 'SET' : 'MISSING',
                BUTTDOWN_API: hasButtondown ? 'SET' : 'MISSING',
                supabase_url_value: hasSupabaseUrl ? process.env.SUPABASE_URL : 'not set',
                all_env_keys: Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('BUTTON') || k.includes('BUTT'))
            }
        })
    };
}
