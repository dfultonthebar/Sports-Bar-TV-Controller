'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tv2,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Plug,
  LayoutGrid,
  Columns,
  Square,
  Grid2X2,
  PictureInPicture2,
  Usb
} from 'lucide-react'

// Multi-view mode definitions
const MULTIVIEW_MODES = [
  { id: 0, name: 'Single Window', icon: Square, description: 'Full screen single input' },
  { id: 1, name: '2-Window Split', icon: Columns, description: 'Side by side' },
  { id: 2, name: 'PIP (Left Top)', icon: PictureInPicture2, description: 'Main + small top-left' },
  { id: 3, name: 'PIP (Right Bottom)', icon: PictureInPicture2, description: 'Main + small bottom-right' },
  { id: 4, name: '3-Window', icon: LayoutGrid, description: '1 top, 2 bottom' },
  { id: 5, name: '3-Window Alt', icon: LayoutGrid, description: 'Alternative layout' },
  { id: 6, name: '3-Window PIP', icon: LayoutGrid, description: 'Main + 2 PIP' },
  { id: 7, name: 'Quad View', icon: Grid2X2, description: '2x2 grid' },
]

// Slot range options (groups of 4)
const SLOT_RANGES = [
  { start: 1, end: 4, label: 'Slots 1-4' },
  { start: 5, end: 8, label: 'Slots 5-8' },
  { start: 9, end: 12, label: 'Slots 9-12' },
  { start: 13, end: 16, label: 'Slots 13-16' },
  { start: 17, end: 20, label: 'Slots 17-20' },
  { start: 21, end: 24, label: 'Slots 21-24' },
  { start: 25, end: 28, label: 'Slots 25-28' },
  { start: 29, end: 32, label: 'Slots 29-32' },
  { start: 33, end: 36, label: 'Slots 33-36' },
]

interface MultiViewCard {
  id: string
  name: string
  startSlot: number
  endSlot: number
  serialPort: string
  baudRate: number
  currentMode: number
  inputAssignments: { window1: number; window2: number; window3: number; window4: number } | null
  status: string
  lastSeen?: string
}

interface SerialPort {
  path: string
  manufacturer?: string
}

export default function MultiViewCardManager() {
  const [cards, setCards] = useState<MultiViewCard[]>([])
  const [availablePorts, setAvailablePorts] = useState<SerialPort[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showModeDialog, setShowModeDialog] = useState(false)
  const [editingCard, setEditingCard] = useState<MultiViewCard | null>(null)
  const [selectedCard, setSelectedCard] = useState<MultiViewCard | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [changingModeId, setChangingModeId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    startSlot: 21,
    serialPort: '',
    baudRate: 115200,
  })

  useEffect(() => {
    loadCards()
    loadAvailablePorts()
  }, [])

  const loadCards = async () => {
    try {
      const res = await fetch('/api/wolfpack/multiview')
      const data = await res.json()
      if (data.success) {
        setCards(data.cards)
      }
    } catch (error) {
      console.error('Failed to load multi-view cards:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailablePorts = async () => {
    try {
      const res = await fetch('/api/wolfpack/multiview?listPorts=true')
      const data = await res.json()
      if (data.success) {
        setAvailablePorts(data.ports)
      }
    } catch (error) {
      console.error('Failed to load serial ports:', error)
    }
  }

  const handleAddCard = async () => {
    try {
      const res = await fetch('/api/wolfpack/multiview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (data.success) {
        setShowAddDialog(false)
        resetForm()
        loadCards()
      } else {
        alert(data.error || 'Failed to add card')
      }
    } catch (error) {
      console.error('Failed to add card:', error)
    }
  }

  const handleUpdateCard = async () => {
    if (!editingCard) return
    try {
      const res = await fetch(`/api/wolfpack/multiview/${editingCard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (data.success) {
        setEditingCard(null)
        setShowAddDialog(false)
        resetForm()
        loadCards()
      } else {
        alert(data.error || 'Failed to update card')
      }
    } catch (error) {
      console.error('Failed to update card:', error)
    }
  }

  const handleDeleteCard = async (id: string) => {
    if (!confirm('Delete this multi-view card?')) return
    try {
      const res = await fetch(`/api/wolfpack/multiview/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        loadCards()
      }
    } catch (error) {
      console.error('Failed to delete card:', error)
    }
  }

  const handleTestConnection = async (card: MultiViewCard) => {
    setTestingId(card.id)
    try {
      const res = await fetch(`/api/wolfpack/multiview/${card.id}/test`, { method: 'POST' })
      const data = await res.json()
      alert(data.success ? `Connection successful: ${data.message}` : `Connection failed: ${data.message}`)
      loadCards()
    } catch (error) {
      console.error('Test failed:', error)
      alert('Connection test failed')
    } finally {
      setTestingId(null)
    }
  }

  const handleChangeMode = async (card: MultiViewCard, mode: number) => {
    setChangingModeId(card.id)
    try {
      const res = await fetch(`/api/wolfpack/multiview/${card.id}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      })
      const data = await res.json()
      if (data.success) {
        loadCards()
        setShowModeDialog(false)
        setSelectedCard(null)
      } else {
        alert(data.error || 'Failed to change mode')
      }
    } catch (error) {
      console.error('Mode change failed:', error)
      alert('Failed to change mode')
    } finally {
      setChangingModeId(null)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      startSlot: 21,
      serialPort: '',
      baudRate: 115200,
    })
  }

  const openEditDialog = (card: MultiViewCard) => {
    setEditingCard(card)
    setFormData({
      name: card.name,
      startSlot: card.startSlot,
      serialPort: card.serialPort,
      baudRate: card.baudRate,
    })
    setShowAddDialog(true)
  }

  const openModeDialog = (card: MultiViewCard) => {
    setSelectedCard(card)
    setShowModeDialog(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-400'
      case 'offline': return 'text-red-400'
      default: return 'text-yellow-400'
    }
  }

  const getModeInfo = (modeId: number) => {
    return MULTIVIEW_MODES.find(m => m.id === modeId) || MULTIVIEW_MODES[0]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
        <span className="ml-2 text-slate-400">Loading multi-view cards...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Tv2 className="w-6 h-6 text-purple-400" />
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Wolf Pack Multi-View Cards</h2>
            <p className="text-sm text-slate-400">Control multi-window display cards via RS-232</p>
          </div>
        </div>
        <Button
          onClick={() => { resetForm(); setEditingCard(null); setShowAddDialog(true) }}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Card
        </Button>
      </div>

      {/* Card List */}
      {cards.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
          <Tv2 className="w-12 h-12 mx-auto text-slate-500 mb-4" />
          <p className="text-slate-400">No multi-view cards configured</p>
          <p className="text-sm text-slate-500">Click "Add Card" to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map(card => {
            const modeInfo = getModeInfo(card.currentMode)
            const ModeIcon = modeInfo.icon
            return (
              <div
                key={card.id}
                className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-100">{card.name}</h3>
                    <p className="text-sm text-slate-400">Slots {card.startSlot}-{card.endSlot}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${getStatusColor(card.status)} bg-slate-700`}>
                    {card.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-slate-400 mb-4">
                  <div className="flex items-center space-x-2">
                    <Usb className="w-4 h-4" />
                    <span>{card.serialPort}</span>
                    <span className="text-slate-500">({card.baudRate} baud)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ModeIcon className="w-4 h-4" />
                    <span>{modeInfo.name}</span>
                  </div>
                  {card.lastSeen && (
                    <p className="text-xs text-slate-500">
                      Last seen: {new Date(card.lastSeen).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openModeDialog(card)}
                    className="flex-1"
                  >
                    <LayoutGrid className="w-4 h-4 mr-1" />
                    Mode
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestConnection(card)}
                    disabled={testingId === card.id}
                  >
                    {testingId === card.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plug className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(card)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteCard(card.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {editingCard ? 'Edit Multi-View Card' : 'Add Multi-View Card'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Configure a Wolf Pack multi-view output card
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Bar Main Multi-View"
                className="bg-slate-700 border-slate-600 text-slate-100"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Output Slots</Label>
              <Select
                value={String(formData.startSlot)}
                onValueChange={(v) => setFormData({ ...formData, startSlot: parseInt(v) })}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  {SLOT_RANGES.map(range => (
                    <SelectItem key={range.start} value={String(range.start)} className="text-slate-100">
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Multi-view cards use 4 consecutive output slots</p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Serial Port</Label>
              <Select
                value={formData.serialPort}
                onValueChange={(v) => setFormData({ ...formData, serialPort: v })}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-100">
                  <SelectValue placeholder="Select USB serial port" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  {availablePorts.map(port => (
                    <SelectItem key={port.path} value={port.path} className="text-slate-100">
                      {port.path} {port.manufacturer && `(${port.manufacturer})`}
                    </SelectItem>
                  ))}
                  {availablePorts.length === 0 && (
                    <SelectItem value="manual" disabled className="text-slate-500">
                      No USB serial ports detected
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Input
                value={formData.serialPort}
                onChange={(e) => setFormData({ ...formData, serialPort: e.target.value })}
                placeholder="Or enter manually: /dev/ttyUSB0"
                className="bg-slate-700 border-slate-600 text-slate-100 mt-2"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Baud Rate</Label>
              <Select
                value={String(formData.baudRate)}
                onValueChange={(v) => setFormData({ ...formData, baudRate: parseInt(v) })}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="9600" className="text-slate-100">9600</SelectItem>
                  <SelectItem value="19200" className="text-slate-100">19200</SelectItem>
                  <SelectItem value="38400" className="text-slate-100">38400</SelectItem>
                  <SelectItem value="57600" className="text-slate-100">57600</SelectItem>
                  <SelectItem value="115200" className="text-slate-100">115200 (Default)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingCard ? handleUpdateCard : handleAddCard}
              className="bg-purple-600 hover:bg-purple-700"
              disabled={!formData.name || !formData.serialPort}
            >
              {editingCard ? 'Update' : 'Add Card'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mode Selection Dialog */}
      <Dialog open={showModeDialog} onOpenChange={setShowModeDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              Select Display Mode
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedCard?.name} - Choose a display layout
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-4">
            {MULTIVIEW_MODES.map(mode => {
              const Icon = mode.icon
              const isActive = selectedCard?.currentMode === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() => selectedCard && handleChangeMode(selectedCard, mode.id)}
                  disabled={changingModeId === selectedCard?.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isActive
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                  }`}
                >
                  <Icon className={`w-8 h-8 mx-auto mb-2 ${isActive ? 'text-purple-400' : 'text-slate-400'}`} />
                  <p className="text-sm font-medium text-slate-200">{mode.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{mode.description}</p>
                </button>
              )
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModeDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
