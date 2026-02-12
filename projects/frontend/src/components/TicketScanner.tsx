import { useState } from 'react'
import { QrReader } from 'react-qr-reader'
import { useWallet} from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { TicketingFactory } from '../contracts/TicketingClient'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'

interface TicketScannerProps {
  appId: number
  onVerified: (assetId: bigint) => void
  onClose: () => void
}

const TicketScanner = ({ appId, onVerified, onClose }: TicketScannerProps) => {
  const [scanning, setScanning] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const { activeAddress, transactionSigner } = useWallet()
  const { enqueueSnackbar } = useSnackbar()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  })
  
  algorand.setDefaultSigner(transactionSigner)

  const handleScan = async (qrResult: any) => {
    if (!qrResult || verifying || !activeAddress) return

    try {
      setScanning(false)
      setVerifying(true)

      // Parse QR code data: format is "ALGO_TICKET_{appId}_{assetId}_{holderAddress}"
      const data = qrResult.getText()
      const parts = data.split('_')
      
      if (parts[0] !== 'ALGO' || parts[1] !== 'TICKET' || parts.length < 4) {
        enqueueSnackbar('❌ Invalid QR code format', { variant: 'error' })
        setScanning(true)
        setVerifying(false)
        return
      }

      const scannedAppId = parseInt(parts[2])
      const assetId = BigInt(parts[3])
      const holderAddress = parts[4]

      // Verify it's for the correct event
      if (scannedAppId !== appId) {
        enqueueSnackbar('❌ Wrong event ticket', { variant: 'error' })
        setScanning(true)
        setVerifying(false)
        return
      }

      enqueueSnackbar('🔍 Verifying ticket on blockchain...', { variant: 'info' })

      // Call verify_entry on smart contract
      const factory = new TicketingFactory({
        algorand,
        defaultSender: activeAddress,
      })

      const appClient = factory.getAppClientById({
        appId: BigInt(appId)
      })

      const txResult = await appClient.send.verifyEntry({
        args: {
          ticketHolder: holderAddress,
          ticketAssetId: assetId
        },
        sender: activeAddress
      })

      if (txResult.return) {
        enqueueSnackbar('✅ Valid ticket! Entry granted', { variant: 'success' })
        onVerified(assetId)
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        enqueueSnackbar('❌ Ticket verification failed', { variant: 'error' })
        setScanning(true)
        setVerifying(false)
      }
      
    } catch (e) {
      console.error('Verification error:', e)
      const errorMsg = (e as Error).message
      
      if (errorMsg.includes('already used')) {
        enqueueSnackbar('❌ Ticket already used!', { variant: 'error' })
      } else if (errorMsg.includes('not owned')) {
        enqueueSnackbar('❌ Ticket not owned by holder', { variant: 'error' })
      } else {
        enqueueSnackbar(`❌ Error: ${errorMsg}`, { variant: 'error' })
      }
      
      setScanning(true)
      setVerifying(false)
    }
  }

  const handleError = (error: any) => {
    console.error('Scanner error:', error)
    enqueueSnackbar('Camera error. Please check permissions.', { variant: 'error' })
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <button 
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
          disabled={verifying}
        >
          ✕
        </button>
        
        <h3 className="font-bold text-2xl mb-4">🎫 Scan Ticket QR Code</h3>
        
        {!activeAddress && (
          <div className="alert alert-warning mb-4">
            <span>⚠️ Please connect your wallet as event organizer</span>
          </div>
        )}

        {scanning && activeAddress && (
          <div className="space-y-4">
            <div className="alert alert-info">
              <span>📱 Point camera at attendee's QR code</span>
            </div>
            
            <div className="relative">
              <QrReader
                onResult={handleScan}
                constraints={{ facingMode: 'environment' }}
                containerStyle={{ width: '100%' }}
                videoContainerStyle={{ paddingTop: '75%' }}
              />
              {verifying && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <div className="loading loading-spinner loading-lg text-white"></div>
                </div>
              )}
            </div>

            <div className="bg-base-200 p-4 rounded-lg">
              <p className="text-sm font-semibold mb-2">📋 Instructions:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
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
            <div className="loading loading-spinner loading-lg text-primary mb-4"></div>
            <p className="text-lg font-semibold">Verifying on blockchain...</p>
            <p className="text-sm text-gray-600">Checking NFT ownership & check-in status</p>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}

export default TicketScanner
