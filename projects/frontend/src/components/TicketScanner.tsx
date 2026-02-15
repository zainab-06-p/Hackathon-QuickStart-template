import { useState, useRef } from 'react'
import { QrReader } from 'react-qr-reader'
import { useWallet} from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'
import { TicketingFactory } from '../contracts/TicketingClient'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { Card } from './Base/Card'
import { BrandButton } from './Base/BrandButton'
import { X, Scan, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface TicketScannerProps {
  appId: number
  onVerified: (assetId: bigint) => void
  onClose: () => void
}

const TicketScanner = ({ appId, onVerified, onClose }: TicketScannerProps) => {
  const [scanning, setScanning] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [verifiedAssetId, setVerifiedAssetId] = useState<bigint | null>(null)
  const processingRef = useRef(false) // prevent double-processing
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  })
  
  algorand.setDefaultSigner(transactionSigner)
  algorand.setDefaultValidityWindow(1000)

  const handleScan = async (result: any, error: any) => {
    // Silently ignore scan errors — these fire on every frame when no QR code is visible
    if (error) return

    // result?.text contains the QR code data in react-qr-reader 3.0.0-beta-1
    if (!result?.text || verifying || !activeAddress || processingRef.current) return

    processingRef.current = true

    try {
      setScanning(false)
      setVerifying(true)

      // Parse QR code data: format is "ALGO_TICKET_{appId}_{assetId}_{holderAddress}"
      const data = result.text
      const parts = data.split('_')
      
      if (parts[0] !== 'ALGO' || parts[1] !== 'TICKET' || parts.length < 4) {
        enqueueSnackbar('Invalid QR code format', { variant: 'error' })
        setScanning(true)
        setVerifying(false)
        processingRef.current = false
        return
      }

      const scannedAppId = parseInt(parts[2])
      const assetId = BigInt(parts[3])
      const holderAddress = parts[4]

      // Verify it's for the correct event
      if (scannedAppId !== appId) {
        enqueueSnackbar('Wrong event ticket', { variant: 'error' })
        setScanning(true)
        setVerifying(false)
        processingRef.current = false
        return
      }

      enqueueSnackbar('Verifying ticket on blockchain...', { variant: 'info' })

      // Call verify_entry on smart contract
      const factory = new TicketingFactory({
        algorand,
        defaultSender: activeAddress,
      })

      const appClient = factory.getAppClientById({
        appId: BigInt(appId)
      })

      // Fund the app account to cover box MBR for check-in record
      // Box cost: 2500 + 400*(8+8) = 8900 microALGO per ticket check-in
      const appAddress = appClient.appAddress
      await algorand.send.payment({
        sender: activeAddress,
        receiver: appAddress,
        amount: algokit.microAlgos(50_000), // 0.05 ALGO to cover box MBR + fees
      })
      
      const txResult = await appClient.send.verifyEntry({
        args: {
          ticketHolder: holderAddress,
          ticketAssetId: assetId
        },
        sender: activeAddress,
        maxFee: algokit.microAlgos(5_000),
        populateAppCallResources: true,
      })

      if (txResult.return) {
        setVerified(true)
        setVerifiedAssetId(assetId)
        setVerifying(false)
        enqueueSnackbar('TICKET VERIFIED - Entry Granted!', { 
          variant: 'success',
          autoHideDuration: 5000
        })
        onVerified(assetId)
        
        // Auto-close after showing success
        setTimeout(() => {
          onClose()
        }, 3000)
      } else {
        enqueueSnackbar('Ticket verification failed', { variant: 'error' })
        setScanning(true)
        setVerifying(false)
        processingRef.current = false
      }
      
    } catch (e) {
      console.error('Verification error:', e)
      const errorMsg = (e as Error).message
      
      if (errorMsg.includes('already used') || errorMsg.includes('Ticket already used')) {
        enqueueSnackbar('TICKET ALREADY USED! Entry denied.', { 
          variant: 'error',
          autoHideDuration: 5000
        })
      } else if (errorMsg.includes('not owned') || errorMsg.includes('Ticket not owned')) {
        enqueueSnackbar('INVALID TICKET! Not owned by holder.', { 
          variant: 'error',
          autoHideDuration: 5000
        })
      } else if (errorMsg.includes('Only organizer') || errorMsg.includes('Only creator')) {
        enqueueSnackbar('Only event organizer can verify tickets', { 
          variant: 'error',
          autoHideDuration: 5000
        })
      } else {
        enqueueSnackbar(`Verification Error: ${errorMsg.substring(0, 100)}`, { 
          variant: 'error',
          autoHideDuration: 5000
        })
      }
      
      // Reset to scanning after error
      setTimeout(() => {
        setScanning(true)
        setVerifying(false)
        processingRef.current = false
      }, 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl">
        <Card className="relative">
          <button 
            className="absolute right-4 top-4 p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors z-10"
            onClick={onClose}
            disabled={verifying}
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Scan className="w-6 h-6 text-indigo-400" /> Scan Ticket QR Code
          </h3>
        
          {!activeAddress && (
            <div className="p-3 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm">
              Please connect your wallet as event organizer
            </div>
          )}

          {scanning && activeAddress && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300 text-sm">
                Point camera at attendee's QR code
              </div>
            
              <div className="relative rounded-xl overflow-hidden border border-zinc-800">
                <QrReader
                  onResult={handleScan}
                  constraints={{ 
                    facingMode: 'environment',
                    aspectRatio: 1
                  }}
                  containerStyle={{ width: '100%' }}
                  videoStyle={{ width: '100%', height: 'auto' }}
                  scanDelay={1000}
                />
              </div>

              <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-800">
                <p className="text-sm font-semibold mb-2 text-zinc-300">Instructions:</p>
                <ul className="text-sm space-y-1 list-disc list-inside text-zinc-400">
                  <li>Ask attendee to show their ticket QR code</li>
                  <li>Hold camera steady over QR code</li>
                  <li>Wait for automatic verification</li>
                  <li>Green checkmark = Entry approved</li>
                  <li>Red X = Ticket invalid/used</li>
                </ul>
              </div>
            </div>
          )}

          {verifying && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
              <p className="text-lg font-semibold">Verifying on blockchain...</p>
              <p className="text-sm text-zinc-400">Checking NFT ownership & check-in status</p>
            </div>
          )}

          {verified && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="w-20 h-20 text-green-500 mb-4" />
              <p className="text-2xl font-bold text-green-400 mb-2">ENTRY GRANTED</p>
              <p className="text-lg text-zinc-300">Ticket #{verifiedAssetId?.toString()}</p>
              <p className="text-sm text-zinc-500 mt-4">This ticket has been marked as checked-in</p>
              <p className="text-sm text-zinc-500">Cannot be used again</p>
              <div className="mt-6">
                <BrandButton onClick={onClose}>Close</BrandButton>
              </div>
            </div>
          )}
        </Card>
      </div>
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  )
}

export default TicketScanner
