'use client'

import { useQuery } from '@tanstack/react-query'
import { getConfig } from '@/config/env'
import { useWalletContext } from '../context/WalletContext'

export type WhitelistStatus = 'verified' | 'pending' | 'not_eligible'

interface WhitelistResponse {
  enabled: boolean
  whitelisted: boolean
  status: WhitelistStatus
}

async function fetchWhitelistStatus(address: string): Promise<WhitelistResponse> {
  const { apiUrl } = getConfig()
  const res = await fetch(
    `${apiUrl}/api/chain/whitelist/status?address=${encodeURIComponent(address)}`,
  )
  if (!res.ok) {
    return { enabled: false, whitelisted: false, status: 'not_eligible' }
  }
  return res.json()
}

export function useWhitelistStatus() {
  const { address, connectionStatus } = useWalletContext()
  const isConnected = connectionStatus === 'connected' && !!address

  const { data, isLoading } = useQuery({
    queryKey: ['whitelist-status', address],
    queryFn: () => fetchWhitelistStatus(address!),
    enabled: isConnected,
    staleTime: 60_000,
    retry: 1,
  })

  return {
    whitelistEnabled: data?.enabled ?? false,
    status: data?.status ?? null,
    isLoading: isConnected && isLoading,
  }
}
