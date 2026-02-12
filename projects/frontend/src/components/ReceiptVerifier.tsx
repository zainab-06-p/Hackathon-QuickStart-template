import { useState } from 'react'
import { useSnackbar } from 'notistack'
import { verifyReceipt, validateReceiptFile, type ReceiptVerificationResult } from '../utils/aiVerification'

interface ReceiptVerifierProps {
  campaignId: number
  campaignTitle: string
}

const ReceiptVerifier = ({ campaignId, campaignTitle }: ReceiptVerifierProps) => {
  const { enqueueSnackbar } = useSnackbar()
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<ReceiptVerificationResult | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    const validation = validateReceiptFile(file)
    if (!validation.valid) {
      enqueueSnackbar(validation.error!, { variant: 'error' })
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onload = () => setReceiptPreview(reader.result as string)
    reader.readAsDataURL(file)

    // Verify with AI
    setVerifying(true)
    setResult(null)
    
    try {
      enqueueSnackbar('🤖 AI analyzing receipt...', { variant: 'info' })
      const verification = await verifyReceipt(file)
      setResult(verification)
      
      if (verification.isValid) {
        enqueueSnackbar('✅ Receipt verified as authentic!', { variant: 'success' })
      } else {
        enqueueSnackbar('⚠️ Receipt verification flagged issues', { variant: 'warning' })
      }
    } catch (error) {
      console.error('Verification error:', error)
      enqueueSnackbar(`Verification failed: ${(error as Error).message}`, { variant: 'error' })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="card bg-gradient-to-br from-blue-500 to-purple-600 text-white">
      <div className="card-body">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-3xl">🤖</span>
          <div>
            <h4 className="font-bold text-lg">AI Fraud Detection</h4>
            <p className="text-sm opacity-90">Upload receipts to verify spending</p>
          </div>
        </div>

        <div className="alert bg-white/20 border-white/30 text-white mb-4">
          <div className="text-sm">
            <p className="font-bold">How it works:</p>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Upload receipt image (JPG/PNG, max 4MB)</li>
              <li>AI analyzes for photoshopping/fraud</li>
              <li>Get instant verdict with confidence score</li>
              <li>Transparency builds donor trust</li>
            </ol>
          </div>
        </div>

        <input
          type="file"
          accept="image/*"
          className="file-input file-input-bordered w-full bg-white text-gray-800"
          onChange={handleFileUpload}
          disabled={verifying}
        />

        {verifying && (
          <div className="flex items-center gap-3 mt-4 bg-white/10 p-4 rounded-lg">
            <span className="loading loading-spinner loading-md"></span>
            <div className="text-sm">
              <p className="font-bold">AI Vision Processing...</p>
              <p className="opacity-90">Analyzing image for fraud indicators</p>
            </div>
          </div>
        )}

        {receiptPreview && !verifying && (
          <div className="mt-4">
            <img 
              src={receiptPreview} 
              alt="Receipt preview" 
              className="w-full max-h-64 object-contain rounded-lg bg-white/10 p-2"
            />
          </div>
        )}

        {result && (
          <div className={`mt-4 p-4 rounded-lg ${
            result.isValid 
              ? 'bg-green-500/30 border-2 border-green-300' 
              : 'bg-red-500/30 border-2 border-red-300'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl">{result.isValid ? '✅' : '⚠️'}</span>
              <div>
                <h5 className="font-bold text-lg">
                  {result.isValid ? 'Receipt Verified' : 'Verification Failed'}
                </h5>
                <p className="text-sm">Confidence: {result.confidence}%</p>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="font-semibold">Analysis:</p>
                <p className="text-sm bg-white/10 p-2 rounded">{result.analysis}</p>
              </div>

              {result.details.amount && (
                <div>
                  <p className="font-semibold">Amount: ${result.details.amount}</p>
                </div>
              )}

              {result.details.vendor && (
                <div>
                  <p className="font-semibold">Vendor: {result.details.vendor}</p>
                </div>
              )}

              {result.details.date && (
                <div>
                  <p className="font-semibold">Date: {result.details.date}</p>
                </div>
              )}

              {result.flags.length > 0 && (
                <div>
                  <p className="font-semibold">⚠️ Flags:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {result.flags.map((flag, idx) => (
                      <li key={idx} className="bg-red-500/20 p-1 rounded">{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.details.items && result.details.items.length > 0 && (
                <div>
                  <p className="font-semibold">Items:</p>
                  <ul className="list-disc list-inside text-sm">
                    {result.details.items.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-3 text-xs opacity-75">
              <p>🔬 Powered by Gemini Vision AI</p>
              <p>Campaign: {campaignTitle} (ID: {campaignId})</p>
            </div>
          </div>
        )}

        {!result && !verifying && (
          <div className="text-xs opacity-75 mt-2 text-center">
            <p>No API key detected? Get free Gemini API key at:</p>
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-yellow-300"
            >
              aistudio.google.com/app/apikey
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReceiptVerifier
