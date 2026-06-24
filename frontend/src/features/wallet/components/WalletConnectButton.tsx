'use client'

import { useState } from 'react'
import { Copy, Check, Wallet, ChevronDown, ShieldCheck, Clock, ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWallet } from '../hooks/useWallet'
import { useWhitelistStatus } from '../hooks/useWhitelistStatus'
import { truncateAddress } from '../utils/truncateAddress'
import { WalletConnectModal } from './WalletConnectModal'

function WhitelistIndicator() {
  const { whitelistEnabled, status, isLoading } = useWhitelistStatus()

  if (!whitelistEnabled || isLoading) return null

  const config = {
    verified: { icon: ShieldCheck, label: 'Verified', className: 'text-green-600' },
    pending: { icon: Clock, label: 'Pending', className: 'text-yellow-600' },
    not_eligible: { icon: ShieldX, label: 'Not eligible', className: 'text-red-600' },
  } as const

  if (!status) return null
  const { icon: Icon, label, className } = config[status]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${className}`}
      title={`KYC status: ${label}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  )
}

export function WalletConnectButton() {
  const { address, connectionStatus, disconnect } = useWallet()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const isConnected = connectionStatus === 'connected' && address
  const isConnecting = connectionStatus === 'connecting'

  async function handleCopy() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <WhitelistIndicator />
        <button
          onClick={handleCopy}
          title="Click to copy address"
          className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono hover:bg-accent transition-colors"
          aria-label={`Copy wallet address: ${truncateAddress(address)}`}
        >
          {truncateAddress(address)}
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
        </button>
        <Button variant="outline" size="sm" onClick={disconnect} aria-label="Disconnect wallet">
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={isConnecting}
        size="sm"
        className="gap-2"
        data-tour="connect-wallet"
      >
        <Wallet className="h-4 w-4" />
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>

      <WalletConnectModal open={open} onOpenChange={setOpen} />
    </>
  )
}
