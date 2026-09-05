import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { file_id, format, text } = body

    if (!file_id || !format || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: file_id, format, text' },
        { status: 400 }
      )
    }

    const validFormats = ['CSV', 'JSON', 'TXT', 'XML']
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      )
    }

    const lines = format === 'JSON' ? [text] : text.split(/\r?\n/)

    const { data: row, error: insertError } = await supabase
      .from('competition_import_files')
      .insert({
        file_id: file_id,
        user_id: session.user.id,
        format: format,
        status: 'processing',
        total_lines: lines.length
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting import file:', insertError)
      return NextResponse.json(
        { error: 'Failed to create import record' },
        { status: 500 }
      )
    }

    const batchSize = 100
    let staged = 0

    for (let i = 0; i < lines.length; i += batchSize) {
      const batch = lines.slice(i, i + batchSize).map((line: string, index: number) => ({
        import_file_id: row.id,
        record_type: 'RAW',
        line_number: i + index + 1,
        raw_record: { raw: line }
      }))

      const { error: batchError } = await supabase
        .from('competition_import_records')
        .insert(batch)

      if (batchError) {
        console.error('Error inserting batch:', batchError)
        await supabase
          .from('competition_import_files')
          .update({ status: 'failed' })
          .eq('id', row.id)
        
        return NextResponse.json(
          { error: 'Failed to process import data' },
          { status: 500 }
        )
      }
      staged += batch.length
    }

    await supabase
      .from('competition_import_files')
      .update({ 
        status: 'completed',
        processed_lines: staged
      })
      .eq('id', row.id)

    return NextResponse.json({
      success: true,
      file_id: row.id,
      total_lines: lines.length,
      processed_lines: staged
    })

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
