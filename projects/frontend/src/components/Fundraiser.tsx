import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import * as algokit from '@algorandfoundation/algokit-utils'

interface FundraiserInterface {
  openModal: boolean
  setModalState: (value: boolean) => void
}

const Fundraiser = ({ openModal, setModalState }: FundraiserInterface) => {
  const [loading, setLoading] = useState<boolean>(false)
  const [deploying, setDeploying] = useState<boolean>(false)
  const [appId, setAppId] = useState<number | null>(null)
  const [goalAmount, setGoalAmount] = useState<string>('5')
  const [raisedAmount, setRaisedAmount] = useState<number>(0)
  const [donationAmount, setDonationAmount] = useState<string>('1')
  const { enqueueSnackbar } = useSnackbar()
  const { activeAccount, activeAddress, transactionSigner: TransactionSigner } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({
    algodConfig,
    indexerConfig,
  })
  
  algorand.setDefaultSigner(TransactionSigner)

  const createCampaign = async () => {
    setDeploying(true)
    try {
      // Note: This is a placeholder - actual implementation would use FundraiserFactory
      // For this demo, we'll simulate the creation
      const simulatedAppId = Math.floor(Math.random() * 1000000) + 1000000
      setAppId(simulatedAppId)
      setRaisedAmount(0)
      enqueueSnackbar(`Campaign created with App ID: ${simulatedAppId}. Goal: ${goalAmount} ALGO`, { 
        variant: 'success' 
      })
    } catch (e) {
      enqueueSnackbar(`Error creating campaign: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setDeploying(false)
    }
  }

  const donate = async () => {
    if (!appId) {
      enqueueSnackbar('Please create a campaign first', { variant: 'error' })
      return
    }

    if (!donationAmount || parseFloat(donationAmount) <= 0) {
      enqueueSnackbar('Please enter a valid donation amount', { variant: 'error' })
      return
    }

    setLoading(true)
    try {
      const amountInMicroAlgos = Math.floor(parseFloat(donationAmount) * 1_000_000)
      
      // Send payment to app address (placeholder for demo)
      await algorand.send.payment({
        sender: activeAddress ?? '',
        receiver: activeAddress ?? '', // In production, this would be the app address
        amount: algokit.microAlgos(amountInMicroAlgos),
      })

      const newRaised = raisedAmount + parseFloat(donationAmount)
      setRaisedAmount(newRaised)
      
      enqueueSnackbar(
        `Donated ${donationAmount} ALGO! Total raised: ${newRaised}/${goalAmount} ALGO`, 
        { variant: 'success' }
      )
    } catch (e) {
      enqueueSnackbar(`Error donating: ${(e as Error).message}`, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const progressPercentage = appId ? Math.min((raisedAmount / parseFloat(goalAmount)) * 100, 100) : 0

  return (
    <dialog id="fundraiser_modal" className={`modal ${openModal ? 'modal-open' : ''} bg-slate-200`}>
      <form method="dialog" className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg">🏦 Campus Fundraiser</h3>
        <p className="text-sm text-gray-600 mt-1">Milestone-based transparent funding for campus activities</p>
        <br />
        
        <div className="flex flex-col gap-4">
          {appId && (
            <div className="alert alert-info flex flex-col gap-2">
              <div className="flex justify-between w-full">
                <span className="font-semibold">App ID: {appId}</span>
                <span className="font-semibold">{raisedAmount.toFixed(2)} / {goalAmount} ALGO</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300" 
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-xs">{progressPercentage.toFixed(0)}% funded</span>
            </div>
          )}
          
          {!appId ? (
            <>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Campaign Goal (ALGO)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  className="input input-bordered"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                  placeholder="Enter goal amount"
                />
                <label className="label">
                  <span className="label-text-alt">Target amount to raise for your campus project</span>
                </label>
              </div>

              <button 
                className={`btn btn-primary ${deploying ? 'loading' : ''}`}
                onClick={createCampaign}
                disabled={deploying || !activeAccount || !goalAmount}
              >
                {deploying ? 'Creating...' : '🚀 Create Campaign'}
              </button>
            </>
          ) : (
            <>
              <div className="divider">Donate to Campaign</div>
              
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Donation Amount (ALGO)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  className="input input-bordered"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  placeholder="Enter donation amount"
                />
              </div>

              <button 
                className={`btn btn-success ${loading ? 'loading' : ''}`}
                onClick={donate}
                disabled={loading || !activeAccount}
              >
                {loading ? 'Processing...' : '💝 Donate Now'}
              </button>

              <div className="alert alert-warning">
                <span className="text-xs">
                  📊 <strong>Note:</strong> This is a demo on LocalNet. In production, funds would be locked until milestone approval.
                </span>
              </div>
            </>
          )}
          
          <div className="modal-action">
            <button 
              className="btn" 
              onClick={() => setModalState(false)}
              disabled={loading || deploying}
            >
              Close
            </button>
          </div>
        </div>
      </form>
    </dialog>
  )
}

export default Fundraiser
