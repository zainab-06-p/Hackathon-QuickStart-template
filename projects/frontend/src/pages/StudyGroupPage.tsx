import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useState } from 'react'
import { Card } from '../components/Base/Card'
import { BrandButton } from '../components/Base/BrandButton'
import { ImpactBadge } from '../components/Base/ImpactBadge'
import { Users, BookOpen, Clock, Globe, Plus, Hash } from 'lucide-react'

// Mock Data Interface
interface StudyGroup {
  id: number
  name: string
  topic: string
  members: number
  maxMembers: number
  meetingTime: string
  isPublic: boolean
  tags: string[]
  level: string
}

const StudyGroupPage = () => {
  const { activeAddress } = useWallet()
  const { enqueueSnackbar } = useSnackbar()

  const [groups] = useState<StudyGroup[]>([
    {
      id: 1,
      name: 'Algorithm Wizards',
      topic: 'Computer Science',
      members: 5,
      maxMembers: 8,
      meetingTime: 'Wed 6pm',
      isPublic: true,
      tags: ['Algorithms', 'Data Structures', 'Python'],
      level: 'Advanced'
    },
    {
      id: 2,
      name: 'Macroeconomics 101',
      topic: 'Economics',
      members: 12,
      maxMembers: 15,
      meetingTime: 'Mon 4pm',
      isPublic: true,
      tags: ['Finance', 'Macro', 'Exam Prep'],
      level: 'Beginner'
    },
    {
      id: 3,
      name: 'Quantum Mechanics',
      topic: 'Physics',
      members: 3,
      maxMembers: 5,
      meetingTime: 'Fri 2pm',
      isPublic: false,
      tags: ['Quantum', 'Physics', 'Math'],
      level: 'Intermediate'
    }
  ])

  const handleJoin = (group: StudyGroup) => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect your wallet first', { variant: 'warning' })
      return
    }
    
    if (group.members >= group.maxMembers) {
      enqueueSnackbar('Group is full!', { variant: 'error' })
      return
    }

    enqueueSnackbar(`Request sent to join ${group.name}`, { variant: 'success' })
  }

  return (
    <div className='max-w-7xl mx-auto pb-20 space-y-8'>
      
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-8 border-b border-zinc-800'>
        <div>
          <h1 className='text-3xl font-display font-semibold text-white flex items-center gap-3'>
            <Users className='text-indigo-500 w-8 h-8' />
            Study Groups
          </h1>
          <p className='text-zinc-500 mt-1'>Collaborative learning with verified attendance tracking</p>
        </div>
        <BrandButton onClick={() => enqueueSnackbar('Create Group feature coming soon!', { variant: 'info' })}>
          <Plus className='w-4 h-4 mr-2' />
          Create Group
        </BrandButton>
      </div>

      {/* Featured Stats */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {[
          { label: 'Active Groups', value: '42', color: 'indigo' },
          { label: 'Learners Online', value: '1,208', color: 'emerald' },
          { label: 'Study Hours', value: '8.5k', color: 'amber' },
          { label: 'Topics Covered', value: '156', color: 'rose' }
        ].map((stat, i) => (
          <div key={i} className='bg-zinc-900 border border-zinc-800 p-4 rounded-xl'>
            <div className={`text-xs font-medium uppercase tracking-wider text-${stat.color}-500 mb-1`}>{stat.label}</div>
            <div className='text-2xl font-bold text-white'>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Groups Grid */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {groups.map((group) => (
          <Card key={group.id} hoverable className='flex flex-col'>
            <div className='flex justify-between items-start mb-4'>
              <div className='flex items-center gap-3'>
                 <div className='w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400'>
                   <BookOpen className='w-5 h-5' />
                 </div>
                 <div>
                   <h3 className='text-lg font-semibold text-white'>{group.name}</h3>
                   <div className='text-xs text-zinc-500 flex items-center gap-1'>
                     <Globe className='w-3 h-3' /> {group.topic}
                   </div>
                 </div>
              </div>
              <ImpactBadge 
                label={group.level} 
                color={group.level === 'Advanced' ? 'rose' : group.level === 'Intermediate' ? 'warning' : 'success'} 
                size='sm'
              />
            </div>

            <p className='text-zinc-400 text-sm mb-4 line-clamp-2'>
              Join {group.topic} enthusiasts to master {group.tags.join(', ')}. Weekly sessions with peer review.
            </p>

            <div className='flex flex-wrap gap-2 mb-6'>
              {group.tags.map((tag) => (
                <span key={tag} className='px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 flex items-center gap-1'>
                  <Hash className='w-3 h-3' /> {tag}
                </span>
              ))}
            </div>

            <div className='border-t border-zinc-800/50 pt-4 mt-auto flex items-center justify-between'>
              <div className='space-y-1'>
                <div className='flex items-center gap-2 text-sm text-zinc-400'>
                  <Clock className='w-4 h-4 text-zinc-600' />
                  <span>{group.meetingTime}</span>
                </div>
                <div className='flex items-center gap-2 text-sm text-zinc-400'>
                  <Users className='w-4 h-4 text-zinc-600' />
                  <span>{group.members} / {group.maxMembers} Members</span>
                </div>
              </div>

              <BrandButton 
                onClick={() => handleJoin(group)} 
                variant={group.members >= group.maxMembers ? 'secondary' : 'primary'}
                className='min-w-[100px]'
                disabled={group.members >= group.maxMembers}
              >
                {group.members >= group.maxMembers ? 'Full' : 'Join'}
              </BrandButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default StudyGroupPage
