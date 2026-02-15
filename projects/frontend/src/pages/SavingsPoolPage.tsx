import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { Card } from '../components/Base/Card'
import { BrandButton } from '../components/Base/BrandButton'
import { ProgressBar } from '../components/Base/ProgressBar'
import { ImpactBadge } from '../components/Base/ImpactBadge'
import { Wallet, PiggyBank, Target, ArrowUpRight, TrendingUp, Users } from 'lucide-react'

// Mock Data Interfaces
interface SavingGoal {
  id: number
  title: string
  targetAmount: number
  currentAmount: number
  deadline: string
  contributors: number
  type: 'Personal' | 'Group'
}

const SavingsPoolPage = () => {
  const { activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()

  const [goals, setGoals] = useState<SavingGoal[]>([
    {
      id: 1,
      title: 'Spring Break Trip',
      targetAmount: 500,
      currentAmount: 350,
      deadline: '2024-03-15',
      contributors: 4,
      type: 'Group'
    },
    {
      id: 2,
      title: 'New Laptop Fund',
      targetAmount: 1200,
      currentAmount: 450,
      deadline: '2024-05-01',
      contributors: 1,
      type: 'Personal'
    },
    {
      id: 3,
      title: 'Emergency Textbook Fund',
      targetAmount: 200,
      currentAmount: 200,
      deadline: '2024-02-20',
      contributors: 1,
      type: 'Personal'
    }
  ])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newDeposit, setNewDeposit] = useState<{ id: number | null, amount: string }>({ id: null, amount: '' })

  const handleDeposit = (goal: SavingGoal) => {
    setNewDeposit({ id: goal.id, amount: '' })
    setIsModalOpen(true)
  }

  const submitDeposit = () => {
    if (!newDeposit.amount || isNaN(Number(newDeposit.amount))) {
      enqueueSnackbar('Please enter a valid amount', { variant: 'error' })
      return
    }

    setGoals(prev => prev.map(g => {
      if (g.id === newDeposit.id) {
        return { ...g, currentAmount: g.currentAmount + Number(newDeposit.amount) }
      }
      return g
    }))
    
    enqueueSnackbar(`Successfully deposited ${newDeposit.amount} ALGO!`, { variant: 'success' })
    setIsModalOpen(false)
  }

  const totalSaved = goals.reduce((acc, curr) => acc + curr.currentAmount, 0)
  const totalTarget = goals.reduce((acc, curr) => acc + curr.targetAmount, 0)
  const overallProgress = (totalSaved / totalTarget) * 100

  return (
    <div className='max-w-7xl mx-auto pb-20 space-y-8'>
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-8 border-b border-zinc-800'>
        <div>
          <h1 className='text-3xl font-display font-semibold text-white flex items-center gap-3'>
            <PiggyBank className='text-emerald-500 w-8 h-8' />
            Savings Pools
          </h1>
          <p className='text-zinc-500 mt-1'>Gamified saving goals with yield-generating smart contracts</p>
        </div>
        <BrandButton onClick={() => enqueueSnackbar('Create Goal feature coming soon!', { variant: 'info' })}>
          + New Goal
        </BrandButton>
      </div>

      {/* Stats Overview */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <Card className='bg-gradient-to-br from-emerald-900/20 to-zinc-900 border-emerald-500/20'>
          <div className='flex items-start justify-between mb-4'>
            <div className='p-3 rounded-lg bg-emerald-500/10 text-emerald-500'>
              <Wallet className='w-6 h-6' />
            </div>
            <ImpactBadge label='+4.2% APY' color='success' size='sm' />
          </div>
          <div className='space-y-1'>
            <h3 className='text-zinc-500 text-sm font-medium'>Total Saved</h3>
            <div className='text-3xl font-bold text-white'>{totalSaved} <span className="text-lg text-zinc-500 font-normal">ALGO</span></div>
          </div>
        </Card>

        <Card>
          <div className='flex items-start justify-between mb-4'>
            <div className='p-3 rounded-lg bg-indigo-500/10 text-indigo-500'>
              <Target className='w-6 h-6' />
            </div>
            <span className='text-zinc-500 text-xs font-mono'>GLOBAL</span>
          </div>
          <div className='space-y-1'>
            <h3 className='text-zinc-500 text-sm font-medium'>Overall Progress</h3>
            <div className='text-3xl font-bold text-white'>{overallProgress.toFixed(1)}%</div>
            <div className="mt-2">
              <ProgressBar progress={overallProgress} color='indigo' />
            </div>
          </div>
        </Card>

        <Card>
           <div className='flex items-start justify-between mb-4'>
            <div className='p-3 rounded-lg bg-amber-500/10 text-amber-500'>
              <TrendingUp className='w-6 h-6' />
            </div>
          </div>
          <div className='space-y-1'>
             <h3 className='text-zinc-500 text-sm font-medium'>Weekly Growth</h3>
             <div className='text-3xl font-bold text-white'>+125 <span className="text-lg text-zinc-500 font-normal">ALGO</span></div>
          </div>
        </Card>
      </div>

      {/* Goals Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {goals.map((goal) => (
          <Card key={goal.id} hoverable className='flex flex-col h-full'>
            <div className='flex justify-between items-start mb-4'>
              <div className={`p-2 rounded-full ${goal.type === 'Group' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-800 text-zinc-400'}`}>
                {goal.type === 'Group' ? <Users className='w-5 h-5' /> : <Wallet className='w-5 h-5' />}
              </div>
              <ImpactBadge 
                label={goal.currentAmount >= goal.targetAmount ? 'Completed' : 'Active'} 
                color={goal.currentAmount >= goal.targetAmount ? 'success' : 'default'} 
              />
            </div>

            <h3 className='text-lg font-semibold text-white mb-1'>{goal.title}</h3>
            <p className='text-sm text-zinc-500 mb-6'>Target: {goal.deadline}</p>

            <div className='space-y-4 mb-6 flex-1'>
              <div className='flex justify-between text-sm'>
                <span className='text-zinc-400'>Progress</span>
                <span className='text-white font-medium'>{Math.round((goal.currentAmount / goal.targetAmount) * 100)}%</span>
              </div>
              <ProgressBar 
                progress={(goal.currentAmount / goal.targetAmount) * 100} 
                color={goal.currentAmount >= goal.targetAmount ? 'emerald' : 'indigo'} 
              />
              <div className='flex justify-between text-xs text-zinc-500 font-mono'>
                <span>{goal.currentAmount} ALGO</span>
                <span>{goal.targetAmount} ALGO</span>
              </div>
            </div>

            <div className='mt-auto pt-4 border-t border-zinc-800/50 flex gap-3'>
              <BrandButton 
                onClick={() => handleDeposit(goal)} 
                variant="primary" 
                className='w-full'
                disabled={goal.currentAmount >= goal.targetAmount}
              >
                Deposit
              </BrandButton>
              <button className='p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors'>
                <ArrowUpRight className='w-5 h-5' />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Deposit Modal */}
      {isModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
          <div className='w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-6 animate-fade-in'>
            <div className='text-center space-y-2'>
              <div className='mx-auto w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-4'>
                <PiggyBank className='w-6 h-6' />
              </div>
              <h3 className='text-xl font-semibold text-white'>Add Funds to Goal</h3>
              <p className='text-sm text-zinc-500'>Enter amount to deposit into smart contract</p>
            </div>

            <div className='space-y-4'>
              <div>
                <label className='block text-xs font-medium text-zinc-400 mb-1.5 uppercase ml-1'>Amount (ALGO)</label>
                <div className='relative'>
                  <input
                    type='number'
                    value={newDeposit.amount}
                    onChange={(e) => setNewDeposit({ ...newDeposit, amount: e.target.value })}
                    className='w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 rounded-xl px-4 py-3 text-white placeholder-zinc-600 outline-none transition-all font-mono text-lg'
                    placeholder='0.00'
                    autoFocus
                  />
                  <div className='absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-medium'>ALGO</div>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <BrandButton variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </BrandButton>
                <BrandButton variant="primary" onClick={submitDeposit}>
                  Confirm
                </BrandButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SavingsPoolPage
