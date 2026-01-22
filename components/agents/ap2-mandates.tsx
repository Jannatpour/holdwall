/**
 * AP2 Payment Mandates Component
 * 
 * Interactive payment mandate management UI
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, FileText, CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";

interface PaymentMandate {
  mandateId: string;
  fromAgentId: string;
  toAgentId: string;
  type: "INTENT" | "CART" | "PAYMENT";
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "REVOKED" | "COMPLETED";
  createdAt: string;
  updatedAt: string;
}

export function AP2Mandates({ agentId }: { agentId: string }) {
  const { query, mutate, isAuthenticated } = useGraphQL();
  const [mandates, setMandates] = useState<PaymentMandate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedMandate, setSelectedMandate] = useState<PaymentMandate | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);

  // Form state
  const [toAgentId, setToAgentId] = useState("");
  const [mandateType, setMandateType] = useState<"INTENT" | "CART" | "PAYMENT">("INTENT");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      loadMandates();
    }
  }, [isAuthenticated]);

  const loadMandates = async () => {
    setLoading(true);
    try {
      // Use REST API to list mandates directly
      const response = await fetch(
        `/api/ap2/mandates?fromAgentId=${encodeURIComponent(agentId)}&limit=100`
      );

      if (!response.ok) {
        throw new Error(`Failed to load mandates: ${response.statusText}`);
      }

      const data = await response.json();
      const loadedMandates = (data.mandates || []).map((m: any) => ({
        ...m,
        type: m.type.toUpperCase() as "INTENT" | "CART" | "PAYMENT",
        status: m.status.toUpperCase() as PaymentMandate["status"],
        createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
        updatedAt: m.updatedAt instanceof Date ? m.updatedAt.toISOString() : m.updatedAt,
      }));

      setMandates(loadedMandates);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load mandates");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMandate = async () => {
    if (!toAgentId || !amount || parseFloat(amount) <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const result = await mutate<{ createPaymentMandate: PaymentMandate }>({
        query: AP2_MUTATIONS.CREATE_PAYMENT_MANDATE,
        variables: {
          input: {
            fromAgentId: agentId,
            toAgentId,
            type: mandateType,
            amount: Math.round(parseFloat(amount) * 100), // Convert to cents
            currency,
            description: description || undefined,
          },
        },
      });

      if (result?.createPaymentMandate) {
        toast.success("Payment mandate created successfully");
        setCreateDialogOpen(false);
        setToAgentId("");
        setAmount("");
        setDescription("");
        await loadMandates();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create mandate");
    }
  };

  const handleApproveMandate = async (mandate: PaymentMandate) => {
    try {
      const result = await mutate<{ approvePaymentMandate: PaymentMandate }>({
        query: AP2_MUTATIONS.APPROVE_PAYMENT_MANDATE,
        variables: {
          input: {
            mandateId: mandate.mandateId,
            agentId,
            signature: "", // In production, this would be a cryptographic signature
          },
        },
      });

      if (result?.approvePaymentMandate) {
        toast.success("Mandate approved successfully");
        setApproveDialogOpen(false);
        setSelectedMandate(null);
        await loadMandates();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve mandate");
    }
  };

  const handleRevokeMandate = async (mandate: PaymentMandate) => {
    try {
      await mutate({
        query: AP2_MUTATIONS.REVOKE_PAYMENT_MANDATE,
        variables: {
          mandateId: mandate.mandateId,
          agentId,
        },
      });

      toast.success("Mandate revoked successfully");
      await loadMandates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke mandate");
    }
  };

  const formatCurrency = (amount: number, curr: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
    }).format(amount / 100);
  };

  const getStatusBadge = (status: PaymentMandate["status"]) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDING: "outline",
      APPROVED: "default",
      REJECTED: "destructive",
      EXPIRED: "secondary",
      REVOKED: "secondary",
      COMPLETED: "default",
    };

    const icons = {
      PENDING: Clock,
      APPROVED: CheckCircle,
      REJECTED: XCircle,
      EXPIRED: Clock,
      REVOKED: XCircle,
      COMPLETED: CheckCircle,
    };

    const Icon = icons[status] || Clock;

    return (
      <Badge variant={variants[status] || "outline"}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Payment Mandates
              </CardTitle>
              <CardDescription>Manage payment mandates for agent transactions</CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Create Mandate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Payment Mandate</DialogTitle>
                  <DialogDescription>
                    Create a new payment mandate for agent-to-agent transactions
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>To Agent ID</Label>
                    <Input
                      value={toAgentId}
                      onChange={(e) => setToAgentId(e.target.value)}
                      placeholder="agent-123"
                    />
                  </div>
                  <div>
                    <Label>Mandate Type</Label>
                    <Select value={mandateType} onValueChange={(v) => setMandateType(v as typeof mandateType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTENT">Intent</SelectItem>
                        <SelectItem value="CART">Cart</SelectItem>
                        <SelectItem value="PAYMENT">Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description (Optional)</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Payment for services..."
                    />
                  </div>
                  <Button onClick={handleCreateMandate} className="w-full">
                    Create Mandate
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {mandates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mandate ID</TableHead>
                  <TableHead>To Agent</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mandates.map((mandate) => (
                  <TableRow key={mandate.mandateId}>
                    <TableCell className="font-mono text-sm">{mandate.mandateId.slice(0, 8)}...</TableCell>
                    <TableCell>{mandate.toAgentId}</TableCell>
                    <TableCell>{mandate.type}</TableCell>
                    <TableCell>{formatCurrency(mandate.amount, mandate.currency)}</TableCell>
                    <TableCell>{getStatusBadge(mandate.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(mandate.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {mandate.status === "PENDING" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedMandate(mandate);
                              setApproveDialogOpen(true);
                            }}
                          >
                            Approve
                          </Button>
                        )}
                        {mandate.status !== "COMPLETED" && mandate.status !== "REVOKED" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRevokeMandate(mandate)}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No payment mandates yet. Create one to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payment Mandate</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this payment mandate?
            </DialogDescription>
          </DialogHeader>
          {selectedMandate && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="font-medium">Amount: {formatCurrency(selectedMandate.amount, selectedMandate.currency)}</div>
                <div className="text-muted-foreground">To: {selectedMandate.toAgentId}</div>
                {selectedMandate.description && (
                  <div className="text-muted-foreground mt-2">{selectedMandate.description}</div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleApproveMandate(selectedMandate)}
                  className="flex-1"
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setApproveDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
