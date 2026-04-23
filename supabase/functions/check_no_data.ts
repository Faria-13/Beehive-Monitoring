import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: deadSensors, error } = await supabase.rpc('check_no_data_sensors')

  if (error) {
    console.error('RPC error:', error)
    return new Response(error.message, { status: 500 })
  }

  if (!deadSensors || deadSensors.length === 0) {
    return new Response('All sensors reporting normally', { status: 200 })
  }

  const { data: adminUser } = await supabase
    .from('users')
    .select('user_id')
    .eq('user_type', 'system_administrator')
    .limit(1)
    .single()

  let inserted = 0

  for (const sensor of deadSensors) {
    // Check if a pending notification already exists for this sensor
    const { data: existing } = await supabase
      .from('notifications')
      .select('notification_id')
      .eq('notification_type', 'no_data')
      .eq('delivery_status', 'pending')
      .like('message', `%Sensor ${sensor.sensor_id}%`)
      .limit(1)

    if (existing && existing.length > 0) continue

    const message = `Sensor ${sensor.sensor_id} (${sensor.sensor_type}) on Hive ${sensor.hive_id} has not reported in ${sensor.duration_minutes} minutes. Last reading: ${sensor.last_reading ?? 'never'}`

    // Insert into notifications table
    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: adminUser?.user_id,
        alert_id: null,
        notification_type: 'no_data',
        recipient: 'admin',
        message,
        delivery_status: 'pending',
        delivery_attempts: 0
      })

    if (insertError) {
      console.error('Insert notification error:', insertError)
      continue
    }

    // Insert into alerts table so it shows on the web app
    const { error: alertError } = await supabase
      .from('alerts')
      .insert({
        hive_id: sensor.hive_id,
        rule_id: sensor.rule_id,
        alert_type: 'critical',
        alert_level: 'critical',
        message,
        sensor_value: null,
        timestamp: new Date().toISOString(),
        acknowledged: false,
        resolved: false
      })

    if (alertError) console.error('Insert alert error:', alertError)

    // Call send-sms
    const { error: smsError } = await supabase.functions.invoke('send-sms', {
      body: { message }
    })

    if (smsError) console.error('SMS error:', smsError)
    else inserted++
  }

  return new Response(
    `Flagged ${inserted} new silent sensor(s)`,
    { status: 200 }
  )
})