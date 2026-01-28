/**
 * Consent Management Component
 * GDPR/CCPA consent collection and management UI
 */

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, CheckCircle2 } from "@/components/demo-icons";
import { gdprCompliance, type ConsentRecord } from "./gdpr";

interface ConsentManagementProps {
  userId: string;
  tenantId: string;
}

export function ConsentManagement({ userId, tenantId }: ConsentManagementProps) {
  const [consents, setConsents] = useState<Record<string, boolean>>({
    analytics: false,
    marketing: false,
    essential: true, // Always true, cannot be disabled
    functional: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load existing consents
    async function loadConsents() {
      try {
        const analytics = await gdprCompliance.hasConsent(userId, "analytics");
        const marketing = await gdprCompliance.hasConsent(userId, "marketing");
        const functional = await gdprCompliance.hasConsent(userId, "functional");

        setConsents({
          analytics,
          marketing,
          essential: true,
          functional,
        });
      } catch (error) {
        console.error("Failed to load consents:", error);
      }
    }

    loadConsents();
  }, [userId]);

  const handleConsentChange = async (type: ConsentRecord["consentType"], granted: boolean) => {
    if (type === "essential") {
      return; // Essential cannot be disabled
    }

    setSaving(true);
    setSaved(false);

    try {
      const consent: ConsentRecord = {
        userId,
        tenantId,
        consentType: type,
        granted,
        timestamp: new Date().toISOString(),
        ipAddress: typeof window !== "undefined" ? await getClientIP() : undefined,
        userAgent: typeof window !== "undefined" ? navigator.userAgent : undefined,
      };

      await gdprCompliance.recordConsent(consent);
      setConsents((prev) => ({ ...prev, [type]: granted }));
      setSaved(true);

      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save consent:", error);
    } finally {
      setSaving(false);
    }
  };

  const getClientIP = async (): Promise<string | undefined> => {
    try {
      const response = await fetch("/api/ip");
      const data = await response.json();
      return data.ip;
    } catch {
      return undefined;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy Preferences</CardTitle>
        <CardDescription>
          Manage your data privacy and consent preferences (GDPR/CCPA compliant)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            You can update your consent preferences at any time. Essential cookies are required for the site to function.
          </AlertDescription>
        </Alert>

        {saved && (
          <Alert variant="default" className="bg-green-50 border-green-200">
            <CheckCircle2 className="size-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Consent preferences saved successfully
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="essential">Essential Cookies</Label>
              <p className="text-sm text-muted-foreground">
                Required for the site to function. Cannot be disabled.
              </p>
            </div>
            <Switch id="essential" checked={true} disabled />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="functional">Functional Cookies</Label>
              <p className="text-sm text-muted-foreground">
                Enable enhanced features and personalization
              </p>
            </div>
            <Switch
              id="functional"
              checked={consents.functional}
              onCheckedChange={(checked) => handleConsentChange("functional", checked)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="analytics">Analytics Cookies</Label>
              <p className="text-sm text-muted-foreground">
                Help us improve by analyzing usage patterns
              </p>
            </div>
            <Switch
              id="analytics"
              checked={consents.analytics}
              onCheckedChange={(checked) => handleConsentChange("analytics", checked)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="marketing">Marketing Cookies</Label>
              <p className="text-sm text-muted-foreground">
                Used for advertising and marketing purposes
              </p>
            </div>
            <Switch
              id="marketing"
              checked={consents.marketing}
              onCheckedChange={(checked) => handleConsentChange("marketing", checked)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = "/api/compliance/gdpr/access";
            }}
          >
            Request My Data
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
