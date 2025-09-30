
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Mock sports programming data (in production, this would come from a sports API)
const generateSportsSchedule = () => {
  const channels = [
    { number: '206', callSign: 'ESPN', type: 'sports' },
    { number: '207', callSign: 'ESPN2', type: 'sports' },
    { number: '213', callSign: 'FS1', type: 'sports' },
    { number: '214', callSign: 'FS2', type: 'sports' },
    { number: '215', callSign: 'MLBN', type: 'sports' },
    { number: '216', callSign: 'NBATV', type: 'sports' },
    { number: '217', callSign: 'NHLN', type: 'sports' },
    { number: '219', callSign: 'GOLF', type: 'sports' },
    { number: '701', callSign: 'NFLST1', type: 'nfl' },
    { number: '702', callSign: 'NFLST2', type: 'nfl' },
    { number: '703', callSign: 'NFLST3', type: 'nfl' },
    { number: '704', callSign: 'NFLST4', type: 'nfl' },
    { number: '212-ST', callSign: 'NFLRZ', type: 'nfl' }
  ]

  const now = new Date()
  const schedule: any = {}

  channels.forEach(channel => {
    schedule[channel.number] = []

    // Generate programming for next 7 days
    for (let day = 0; day < 7; day++) {
      const date = new Date(now)
      date.setDate(date.getDate() + day)
      date.setHours(0, 0, 0, 0)

      const daySchedule = generateDaySchedule(channel, date)
      schedule[channel.number] = [...(schedule[channel.number] || []), ...daySchedule]
    }
  })

  return schedule
}

const generateDaySchedule = (channel: any, date: Date) => {
  const daySchedule = []
  const isWeekend = date.getDay() === 0 || date.getDay() === 6 // Sunday or Saturday
  
  if (channel.type === 'nfl' && date.getDay() === 0) { // NFL Sunday
    // Sunday NFL games
    const games = [
      { teams: 'Packers @ Bears', time: '13:00' },
      { teams: 'Vikings @ Lions', time: '16:25' },
      { teams: 'Cowboys @ Giants', time: '20:20' }
    ]
    
    games.forEach(game => {
      const gameTime = new Date(date)
      const [hours, minutes] = game.time.split(':')
      gameTime.setHours(parseInt(hours), parseInt(minutes))
      
      if (channel.number === '212-ST') { // NFL RedZone
        daySchedule.push({
          startTime: gameTime.toISOString(),
          endTime: new Date(gameTime.getTime() + 7 * 60 * 60 * 1000).toISOString(), // 7 hours
          title: 'NFL RedZone',
          description: 'Every touchdown from every game',
          type: 'live_sports',
          sport: 'football'
        })
      } else {
        daySchedule.push({
          startTime: gameTime.toISOString(),
          endTime: new Date(gameTime.getTime() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours
          title: `NFL: ${game.teams}`,
          description: `Live NFL game`,
          type: 'live_sports',
          sport: 'football'
        })
      }
    })
  } else if (channel.callSign === 'ESPN') {
    // ESPN Programming
    const programs = [
      { time: '06:00', title: 'SportsCenter', duration: 60 },
      { time: '10:00', title: 'First Take', duration: 120 },
      { time: '14:00', title: 'Around The Horn', duration: 30 },
      { time: '14:30', title: 'Pardon The Interruption', duration: 30 },
      { time: '18:00', title: 'SportsCenter', duration: 60 },
      { time: '21:00', title: 'College Football Live', duration: 60 }
    ]

    if (isWeekend) {
      programs.push(
        { time: '12:00', title: 'College GameDay', duration: 180 },
        { time: '15:00', title: 'College Football', duration: 210 }
      )
    }

    programs.forEach(program => {
      const startTime = new Date(date)
      const [hours, minutes] = program.time.split(':')
      startTime.setHours(parseInt(hours), parseInt(minutes))
      
      daySchedule.push({
        startTime: startTime.toISOString(),
        endTime: new Date(startTime.getTime() + program.duration * 60 * 1000).toISOString(),
        title: program.title,
        description: '',
        type: program.title.includes('College Football') ? 'live_sports' : 'sports_talk',
        sport: program.title.includes('Football') ? 'football' : 'general'
      })
    })
  } else if (channel.callSign === 'FS1') {
    // Fox Sports 1 Programming
    const programs = [
      { time: '07:00', title: 'FS1 Morning', duration: 180 },
      { time: '12:00', title: 'The Herd', duration: 180 },
      { time: '15:00', title: 'First Things First', duration: 120 },
      { time: '18:00', title: 'FS1 Live', duration: 60 },
      { time: '19:00', title: 'MLB Tonight', duration: 60 }
    ]

    programs.forEach(program => {
      const startTime = new Date(date)
      const [hours, minutes] = program.time.split(':')
      startTime.setHours(parseInt(hours), parseInt(minutes))
      
      daySchedule.push({
        startTime: startTime.toISOString(),
        endTime: new Date(startTime.getTime() + program.duration * 60 * 1000).toISOString(),
        title: program.title,
        description: '',
        type: 'sports_talk',
        sport: 'general'
      })
    })
  } else {
    // Generic sports programming
    const programs = [
      { time: '09:00', title: 'Sports Talk', duration: 120 },
      { time: '14:00', title: 'Game Highlights', duration: 60 },
      { time: '19:00', title: 'Sports Tonight', duration: 60 }
    ]

    programs.forEach(program => {
      const startTime = new Date(date)
      const [hours, minutes] = program.time.split(':')
      startTime.setHours(parseInt(hours), parseInt(minutes))
      
      daySchedule.push({
        startTime: startTime.toISOString(),
        endTime: new Date(startTime.getTime() + program.duration * 60 * 1000).toISOString(),
        title: program.title,
        description: '',
        type: 'sports_talk',
        sport: 'general'
      })
    })
  }

  return daySchedule
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const channelNumber = url.searchParams.get('channel')
    const days = parseInt(url.searchParams.get('days') || '7')
    
    // Generate mock schedule data
    const schedule = generateSportsSchedule()
    
    if (channelNumber && schedule[channelNumber]) {
      return NextResponse.json({
        channel: channelNumber,
        programs: schedule[channelNumber].slice(0, days * 10) // Limit results
      })
    }
    
    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Error fetching TV programming:', error)
    return NextResponse.json({ error: 'Failed to fetch programming' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // This endpoint will be called by the scheduler to update programming data
    const schedule = generateSportsSchedule()
    
    // For now, just return the generated schedule since we don't have a TvChannel table
    // In a real implementation, this would update a database table
    console.log('Generated TV programming schedule:', new Date().toISOString())
    
    return NextResponse.json({
      message: `Generated programming for ${Object.keys(schedule).length} channels`,
      timestamp: new Date().toISOString(),
      channels: Object.keys(schedule)
    })
  } catch (error) {
    console.error('Error updating TV programming:', error)
    return NextResponse.json({ error: 'Failed to update programming' }, { status: 500 })
  }
}
