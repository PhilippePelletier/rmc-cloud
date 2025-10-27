// app/api/anomaly-explain/route.ts  (new file)
import { NextResponse, NextRequest } from 'next/server';
import { getApiContext } from '@/app/lib/api-ctx';

export async function GET(req: NextRequest) {
  const ctx = await getApiContext();
  if ('error' in ctx) return ctx.error;
  const { supabase, groupId } = ctx;

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  const category = url.searchParams.get('category');
  const sku = url.searchParams.get('sku');
  const storeId = url.searchParams.get('store');
  const revenue = url.searchParams.get('revenue');
  const delta = url.searchParams.get('delta');  // percent difference as string

  if (!date || (!category && !sku) || !revenue || !delta) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // Fetch additional context (store or product names) if available
  let storeName: string | undefined;
  if (storeId) {
    const { data: storeData } = await supabase
      .from('stores')
      .select('store_name')
      .eq('group_id', groupId)
      .eq('store_id', storeId)
      .single();
    storeName = storeData?.store_name || undefined;
  }

  let productName: string | undefined;
  if (sku) {
    const { data: prodData } = await supabase
      .from('products')
      .select('product_name')
      .eq('group_id', groupId)
      .eq('sku', sku)
      .single();
    productName = prodData?.product_name || undefined;
  }

  // Compose the subject of the anomaly (category or SKU, with names if available)
  let subject: string;
  if (sku) {
    subject = productName ? `SKU ${sku} (${productName})` : `SKU ${sku}`;
  } else {
    subject = `Category "${category}"`;
  }
  if (storeName) {
    subject += ` in store "${storeName}"`;
  } else if (storeId) {
    subject += ` in store ${storeId}`;
  }

  // Describe the anomaly for the prompt
  const direction = parseFloat(delta) >= 0 ? `${delta}% above` : `${Math.abs(parseFloat(delta)).toFixed(1)}% below`;
  const prompt = `
On ${date}, ${subject} had an **anomalous** revenue of $${Math.round(parseFloat(revenue)).toLocaleString()}, which was ${direction} its typical level.
Explain possible reasons for this anomaly and why it is important.
`.trim();

  // Call OpenAI GPT-5 to get an explanation
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5',   // using GPT-5 for explanation
        messages: [
          { role: 'system', content: 'You are a data analyst assistant who explains retail sales anomalies.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 200
      })
    });
    const result = await openaiRes.json();
    const explanation = result.choices?.[0]?.message?.content?.trim();
    if (!openaiRes.ok || !explanation) {
      throw new Error(result.error?.message || `OpenAI API error (status ${openaiRes.status})`);
    }
    return NextResponse.json({ explanation });
  } catch (err: any) {
    console.error('AI explanation failed:', err);
    return NextResponse.json({ error: 'Failed to generate explanation' }, { status: 500 });
  }
}
