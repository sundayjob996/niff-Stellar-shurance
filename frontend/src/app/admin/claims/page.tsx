'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  adminApi,
  type AdminClaim,
  type AdminClaimStatus,
  type BulkUpdateDryRunResult,
} from '@/lib/api/admin'

// ── JWT role helper ────────────────────────────────────────────────────────

function isStaff(jwt: string | null): boolean {
  if (!jwt) return false
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.role === 'admin' || payload?.isAdmin === true
  } catch {
    return false
  }
}

const PAGE_SIZE = 20
const ALL_STATUSES: AdminClaimStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'PAID']

// ── Root page ──────────────────────────────────────────────────────────────

export default function AdminClaimsPage() {
  const { jwt } = useAuth()
  const staff = isStaff(jwt)

  if (!jwt) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Authentication required</h1>
        <p className="text-sm text-muted-foreground">Connect your wallet and sign in to continue.</p>
      </main>
    )
  }

  if (!staff) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-6xl font-bold text-destructive">403</p>
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-muted-foreground max-w-sm">
          You do not have permission to view this page. Staff authentication is required.
        </p>
        <Link href="/" className="text-primary underline underline-offset-4 text-sm">
          Return home
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Claims Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search, filter and bulk-manage claims.{' '}
          <Link href="/admin" className="text-primary underline underline-offset-2">
            ← Back to Admin
          </Link>
        </p>
      </div>
      <ClaimsDashboard jwt={jwt} />
    </main>
  )
}

// ── Claims Dashboard ───────────────────────────────────────────────────────

function ClaimsDashboard({ jwt }: { jwt: string }) {
  const [claims, setClaims] = useState<AdminClaim[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AdminClaimStatus | ''>('')

  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [overrideClaim, setOverrideClaim] = useState<AdminClaim | null>(null)
  const [overrideStatus, setOverrideStatus] = useState<AdminClaimStatus>('APPROVED')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [overriding, setOverriding] = useState(false)

  const [bulkStatus, setBulkStatus] = useState<AdminClaimStatus>('APPROVED')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkDryRun, setBulkDryRun] = useState<BulkUpdateDryRunResult | null>(null)
  const [bulkConfirming, setBulkConfirming] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(
    (s: string, st: AdminClaimStatus | '', append = false, cur?: string) => {
      setLoading(true)
      adminApi
        .getClaims(jwt, {
          limit: PAGE_SIZE,
          search: s || undefined,
          status: st || undefined,
          cursor: cur,
        })
        .then((page) => {
          setClaims((prev) => (append ? [...prev, ...page.items] : page.items))
          setCursor(page.nextCursor)
          setHasMore(!!page.nextCursor)
          setError(null)
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load claims'))
        .finally(() => setLoading(false))
    },
    [jwt],
  )

  useEffect(() => {
    load('', '')
  }, [load])

  function handleSearchChange(value: string) {
    setSearch(value)
    setSelected(new Set())
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(value, statusFilter), 300)
  }

  function handleStatusFilterChange(value: AdminClaimStatus | '') {
    setStatusFilter(value)
    setSelected(new Set())
    load(search, value)
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === claims.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(claims.map((c) => c.id)))
    }
  }

  // ── Override status ──

  function openOverride(claim: AdminClaim) {
    setOverrideClaim(claim)
    setOverrideStatus('APPROVED')
    setOverrideReason('')
    setOverrideError(null)
  }

  async function handleOverrideConfirm() {
    if (!overrideClaim) return
    if (!overrideReason.trim()) {
      setOverrideError('Reason is required.')
      return
    }
    setOverriding(true)
    setOverrideError(null)
    try {
      const updated = await adminApi.overrideClaimStatus(jwt, overrideClaim.id, overrideStatus, overrideReason)
      setClaims((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setOverrideClaim(null)
    } catch (e: unknown) {
      setOverrideError(e instanceof Error ? e.message : 'Override failed')
    } finally {
      setOverriding(false)
    }
  }

  // ── Bulk update ──

  async function handleBulkDryRun() {
    if (selected.size === 0) return
    setBulkError(null)
    setBulkDryRun(null)
    setBulkOpen(true)
    try {
      const result = await adminApi.bulkUpdateClaims(jwt, Array.from(selected), bulkStatus, true)
      setBulkDryRun(result as BulkUpdateDryRunResult)
    } catch (e: unknown) {
      setBulkError(e instanceof Error ? e.message : 'Dry-run failed')
    }
  }

  async function handleBulkConfirm() {
    setBulkConfirming(true)
    setBulkError(null)
    try {
      const result = await adminApi.bulkUpdateClaims(jwt, Array.from(selected), bulkStatus, false) as { updated: number }
      setBulkSuccess(`Updated ${result.updated} claim(s).`)
      setBulkOpen(false)
      setBulkDryRun(null)
      setSelected(new Set())
      load(search, statusFilter)
    } catch (e: unknown) {
      setBulkError(e instanceof Error ? e.message : 'Bulk update failed')
    } finally {
      setBulkConfirming(false)
    }
  }

  const allSelected = claims.length > 0 && selected.size === claims.length

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Claims</CardTitle>
          <CardDescription>Select claims to perform bulk actions or override individual statuses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search by ID, address, or description"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-8 w-72 text-xs"
              aria-label="Search claims"
            />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value as AdminClaimStatus | '')}
              className="h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="text-xs font-medium">{selected.size} selected</span>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as AdminClaimStatus)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Bulk update target status"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleBulkDryRun}>
                Bulk Update…
              </Button>
              {bulkSuccess && (
                <span className="text-xs text-green-600" role="status">{bulkSuccess}</span>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          {/* Table */}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all claims"
                    />
                  </th>
                  {['ID', 'Policy', 'Creator', 'Status', 'Amount', 'Created', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {claims.map((claim) => (
                  <tr
                    key={claim.id}
                    className={['hover:bg-muted/30', selected.has(claim.id) ? 'bg-primary/5' : ''].join(' ')}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(claim.id)}
                        onChange={() => toggleSelect(claim.id)}
                        aria-label={`Select claim ${claim.id}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono">{claim.id}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[8rem]">{claim.policyId}</td>
                    <td className="px-3 py-2 font-mono truncate max-w-[10rem]" title={claim.creatorAddress}>
                      {claim.creatorAddress}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={[
                          'inline-flex rounded px-1.5 py-0.5 text-xs font-medium',
                          claim.status === 'APPROVED' ? 'bg-green-100 text-green-800' : '',
                          claim.status === 'REJECTED' ? 'bg-red-100 text-red-800' : '',
                          claim.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : '',
                          claim.status === 'PAID' ? 'bg-blue-100 text-blue-800' : '',
                        ].join(' ')}
                      >
                        {claim.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono">{claim.amount}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono">
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => openOverride(claim)}
                        aria-label={`Override status for claim ${claim.id}`}
                      >
                        Override
                      </Button>
                    </td>
                  </tr>
                ))}
                {!loading && claims.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                      No claims found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
            </div>
          )}

          {hasMore && !loading && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(search, statusFilter, true, cursor)}
            >
              Load more
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Override Status Modal ─────────────────────────────────────── */}
      <Dialog open={!!overrideClaim} onOpenChange={(v) => !overriding && !v && setOverrideClaim(null)}>
        <DialogContent aria-labelledby="override-title" aria-describedby="override-desc">
          <DialogHeader>
            <DialogTitle id="override-title">Override claim status</DialogTitle>
            <DialogDescription id="override-desc">
              Manually set the status for claim #{overrideClaim?.id}. A reason is required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="override-status">New status</Label>
              <select
                id="override-status"
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value as AdminClaimStatus)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="override-reason">Reason <span className="text-destructive">*</span></Label>
              <textarea
                id="override-reason"
                rows={3}
                placeholder="Explain why this status change is necessary…"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-required="true"
                aria-describedby={overrideError ? 'override-error' : undefined}
                aria-invalid={!!overrideError}
              />
              {overrideError && (
                <p id="override-error" className="text-xs text-destructive" role="alert">
                  {overrideError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideClaim(null)} disabled={overriding}>
              Cancel
            </Button>
            <Button onClick={handleOverrideConfirm} disabled={overriding} aria-busy={overriding}>
              {overriding ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Saving…</>
              ) : (
                'Confirm override'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Update Modal ─────────────────────────────────────────── */}
      <Dialog open={bulkOpen} onOpenChange={(v) => !bulkConfirming && setBulkOpen(v)}>
        <DialogContent aria-labelledby="bulk-title" aria-describedby="bulk-desc">
          <DialogHeader>
            <DialogTitle id="bulk-title">Bulk status update</DialogTitle>
            <DialogDescription id="bulk-desc">
              Review the affected claims before confirming the update to{' '}
              <strong>{bulkStatus}</strong>.
            </DialogDescription>
          </DialogHeader>

          {!bulkDryRun && !bulkError && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Running dry run" />
            </div>
          )}

          {bulkError && (
            <p className="text-sm text-destructive" role="alert">{bulkError}</p>
          )}

          {bulkDryRun && (
            <div className="space-y-3">
              <p className="text-sm">
                {bulkDryRun.totalAffected} claim(s) will be updated.
              </p>
              <div className="max-h-60 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">ID</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Current status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bulkDryRun.affectedClaims.map((c) => (
                      <tr key={c.id}>
                        <td className="px-3 py-1.5 font-mono">{c.id}</td>
                        <td className="px-3 py-1.5">{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkConfirming}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkConfirm}
              disabled={!bulkDryRun || bulkConfirming}
              aria-busy={bulkConfirming}
            >
              {bulkConfirming ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Updating…</>
              ) : (
                'Confirm update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
