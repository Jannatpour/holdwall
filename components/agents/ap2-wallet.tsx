/**
 * AP2 Wallet Component
 * 
 * Interactive wallet management UI for Agent Payment Protocol
 */

"use client";

import { useState, useEffect } from "react";
import { useGraphQL } from "@/lib/graphql/client";
import { AP2_QUERIES, AP2_MUTATIONS } from "@/lib/graphql/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Wallet, Plus, DollarSign, TrendingUp, TrendingDown } from "@/components/demo-icons";

interface WalletBalance {
  walletId: string;
  agentId: string;
  currency: string;
  balance: number;
  availableBalance: number;
}

interface LedgerEntry {
  entryId: string;
  walletId: string;
  agentId: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  currency: string;
  mandateId?: string;
  transactionId?: string;
  description?: string;
  balance: number;
  timestamp: string;
}

export function AP2Wallet({ walletId, agentId }: { walletId: string; agentId: string }) {
  const { query, mutate, isAuthenticated } = useGraphQL();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("USD");
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [limitType, setLimitType] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "TRANSACTION" | "LIFETIME">("DAILY");
  const [limitAmount, setLimitAmount] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      loadWalletData();
    }
  }, [walletId, currency, isAuthenticated]);

  const loadWalletData = async () => {
    setLoading(true);
    try {
      const [balanceResult, ledgerResult] = await Promise.all([
        query<{ walletBalance: WalletBalance }>({
          query: AP2_QUERIES.GET_WALLET_BALANCE,
          variables: { walletId, currency },
        }),
        query<{ walletLedger: { edges: Array<{ node: LedgerEntry }> } }>({
          query: AP2_QUERIES.GET_WALLET_LEDGER,
          variables: { walletId, currency, limit: 50 },
        }),
      ]);

      if (balanceResult?.walletBalance) {
        setBalance(balanceResult.walletBalance);
      }

      if (ledgerResult?.walletLedger?.edges) {
        setLedger(ledgerResult.walletLedger.edges.map((e) => e.node));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  const handleSetLimit = async () => {
    if (!limitAmount || parseFloat(limitAmount) <= 0) {
      toast.error("Please enter a valid limit amount");
      return;
    }

    try {
      await mutate({
        query: AP2_MUTATIONS.SET_WALLET_LIMIT,
        variables: {
          input: {
            walletId,
            agentId,
            limitType,
            limitAmount: Math.round(parseFloat(limitAmount) * 100), // Convert to cents
            currency,
          },
        },
      });

      toast.success("Wallet limit set successfully");
      setLimitDialogOpen(false);
      setLimitAmount("");
      await loadWalletData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to set wallet limit");
    }
  };

  const formatCurrency = (amount: number, curr: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
    }).format(amount / 100); // Convert from cents
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Wallet Balance
              </CardTitle>
              <CardDescription>Agent: {agentId}</CardDescription>
            </div>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {balance ? (
            <div className="space-y-4">
              <div className="text-3xl font-bold">
                {formatCurrency(balance.balance, balance.currency)}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Available: {formatCurrency(balance.availableBalance, balance.currency)}</span>
              </div>
              <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Set Limit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Set Wallet Limit</DialogTitle>
                    <DialogDescription>
                      Configure spending limits for this wallet
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Limit Type</Label>
                      <Select value={limitType} onValueChange={(v) => setLimitType(v as typeof limitType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DAILY">Daily</SelectItem>
                          <SelectItem value="WEEKLY">Weekly</SelectItem>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="TRANSACTION">Per Transaction</SelectItem>
                          <SelectItem value="LIFETIME">Lifetime</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Limit Amount ({currency})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={limitAmount}
                        onChange={(e) => setLimitAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <Button onClick={handleSetLimit} className="w-full">
                      Set Limit
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="text-muted-foreground">No balance data available</div>
          )}
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Ledger</CardTitle>
          <CardDescription>Recent wallet transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {ledger.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((entry) => (
                  <TableRow key={entry.entryId}>
                    <TableCell>
                      <Badge variant={entry.type === "CREDIT" ? "default" : "secondary"}>
                        {entry.type === "CREDIT" ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(entry.amount, entry.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.description || entry.mandateId || "-"}
                    </TableCell>
                    <TableCell>{formatCurrency(entry.balance, entry.currency)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No transactions yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
