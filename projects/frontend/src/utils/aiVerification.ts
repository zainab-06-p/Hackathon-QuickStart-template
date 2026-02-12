/**
 * AI-Powered Receipt Verification using Gemini API
 * Analyzes uploaded receipts to detect fraud and verify spending
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyCrwVdY3i0W0AoiL3rY6EZS2cm12yUul28'
// Use Gemini 1.5 Pro (latest) for vision/image analysis - Flash doesn't support vision
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_API_KEY}`

export interface ReceiptVerificationResult {
  isValid: boolean
  confidence: number // 0-100
  analysis: string
  flags: string[]
  details: {
    amount?: number
    vendor?: string
    date?: string
    items?: string[]
  }
}

/**
 * Convert image file to base64 for Gemini API
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Verify receipt using Gemini Vision API
 */
export async function verifyReceipt(file: File): Promise<ReceiptVerificationResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured. Please set VITE_GEMINI_API_KEY in .env')
  }

  try {
    // Convert image to base64
    const base64Image = await fileToBase64(file)
    const mimeType = file.type

    // Call Gemini API with vision capabilities
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `You are an AI fraud detection system for campus fundraising campaigns. Analyze this receipt image and provide:

1. Is this a REAL receipt or potentially fake/photoshopped? (Look for:
   - Inconsistent fonts or alignments
   - Unusual shadows or artifacts
   - Missing standard receipt elements like timestamps, store info, tax details
   - Signs of digital manipulation)

2. Extract key details:
   - Total amount
   - Vendor/store name
   - Date of purchase
   - Items purchased (if visible)

3. Fraud risk flags (if any):
   - Photoshopped elements
   - Inconsistent formatting
   - Suspicious patterns
   - Missing required information

Respond in this exact JSON format:
{
  "isValid": true/false,
  "confidence": 0-100,
  "analysis": "Brief explanation of findings",
  "flags": ["list", "of", "concerns"],
  "details": {
    "amount": number or null,
    "vendor": "string" or null,
    "date": "string" or null,
    "items": ["array"] or []
  }
}

Be strict in your analysis. If anything looks suspicious, mark as invalid.`
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image
              }
            }
          ]
        }]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // Extract JSON from response (Gemini sometimes wraps it in markdown)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response')
    }

    const result = JSON.parse(jsonMatch[0]) as ReceiptVerificationResult
    
    // Validate result structure
    if (typeof result.isValid !== 'boolean' || typeof result.confidence !== 'number') {
      throw new Error('Invalid response format from AI')
    }

    return result

  } catch (error) {
    console.error('Receipt verification error:', error)
    throw error
  }
}

/**
 * Quick validation check (for file type/size before sending to API)
 */
export function validateReceiptFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Please upload an image file (JPG, PNG, etc.)' }
  }

  // Check file size (max 4MB for Gemini API)
  const maxSize = 4 * 1024 * 1024 // 4MB
  if (file.size > maxSize) {
    return { valid: false, error: 'Image must be less than 4MB' }
  }

  return { valid: true }
}
