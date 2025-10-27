import { NextResponse, NextRequest } from 'next/server'
import { Configuration, OpenAIApi } from 'openai'
import { getApiContext } from '@/app/lib/api-ctx'

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}))

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || ''
  const category = searchParams.get('category') || ''
  const sku = searchParams.get('sku') || ''
  const revenue = Number(searchParams.get('revenue') || 0)
  const delta = Number(searchParams.get('delta') || 0)
  const storeId = searchParams.get('store') || ''

  // Get Supabase context for optional data (store or product names)
  const ctx = await getApiContext()
  if ('error' in ctx) return ctx.error
  const { supabase, groupId } = ctx

  let storeName = ''
  if (storeId) {
    const { data: storeData } = await supabase
      .from('stores')
      .select('store_name')
      .eq('group_id', groupId)
      .eq('store_id', storeId)
      .single()
    storeName = storeData?.store_name || ''
  }

  let subject: string
  if (sku) {
    // We have an anomaly for a specific SKU
    let productName = ''
    const { data: prodData } = await supabase
      .from('products')
      .select('product_name')
      .eq('group_id', groupId)
      .eq('sku', sku)
      .single()
    productName = prodData?.product_name || ''
    subject = productName 
      ? `SKU ${sku} (${productName})` 
      : `SKU ${sku}`
  } else {
    // Category-level anomaly
    subject = `Category "${category}"`
  }
  if (storeName) {
    subject += ` in store "${storeName}"`
  }

  const direction = delta >= 0 
    ? `${delta.toFixed(1)}% above` 
    : `${Math.abs(delta).toFixed(1)}% below`
  const prompt = `
On ${date}, ${subject} had an anomalous revenue of $${Math.round(revenue).toLocaleString()}, which was ${direction} its typical level. 
Explain possible reasons for this anomaly and why it is important.
  `.trim()

  try {
    const aiResponse = await openai.createChatCompletion({
      model: 'gpt-5',  // use GPT-5 for explanation
      messages: [
        { role: 'system', content: 'You are a data analyst assistant who explains retail sales anomalies.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 200
    })
    const explanation = aiResponse.data.choices[0]?.message?.content?.trim() 
                     || "I'm sorry, I cannot explain this anomaly."
    return NextResponse.json({ explanation })
  } catch (err: any) {
    console.error('AI explanation error:', err)
    return NextResponse.json({ error: 'Failed to generate explanation' }, { status: 500 })
  }
}
