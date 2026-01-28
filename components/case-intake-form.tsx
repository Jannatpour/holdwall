/**
 * Case Intake Form Component
 * 
 * Public form for case submission with file upload support.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, CheckCircle2, AlertCircle } from "@/components/demo-icons";
import { toast } from "sonner";
import { t, type Locale } from "@/lib/i18n/config";

type CaseType = "DISPUTE" | "FRAUD_ATO" | "OUTAGE_DELAY" | "COMPLAINT";

interface CaseIntakeFormProps {
  locale?: Locale;
}

export function CaseIntakeForm({ locale = "en" }: CaseIntakeFormProps = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [caseNumber, setCaseNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const [formData, setFormData] = useState({
    type: "" as CaseType | "",
    submittedBy: "",
    submittedByEmail: "",
    submittedByName: "",
    description: "",
    impact: "",
    preferredResolution: "",
    consent: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.type || !formData.submittedBy || !formData.description || !formData.consent) {
        setError(t("cases.consentRequired", locale));
        setLoading(false);
        return;
      }

      // Create FormData for file uploads
      const submitData = new FormData();
      submitData.append("type", formData.type);
      submitData.append("submittedBy", formData.submittedBy);
      if (formData.submittedByEmail) submitData.append("submittedByEmail", formData.submittedByEmail);
      if (formData.submittedByName) submitData.append("submittedByName", formData.submittedByName);
      submitData.append("description", formData.description);
      if (formData.impact) submitData.append("impact", formData.impact);
      if (formData.preferredResolution) submitData.append("preferredResolution", formData.preferredResolution);

      // Add files
      files.forEach((file) => {
        submitData.append("files", file);
      });

      const response = await fetch("/api/cases?tenant=default", {
        method: "POST",
        body: submitData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || "Failed to submit case");
      }

      const result = await response.json();
      setCaseNumber(result.case?.caseNumber || null);
      setSubmitted(true);
      toast.success("Case submitted successfully!");

      // Redirect to tracking page after 3 seconds
      setTimeout(() => {
        if (result.case?.caseNumber) {
          router.push(`/cases/track/${result.case.caseNumber}`);
        }
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit case";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    // Limit to 5 files, 10MB each
    const validFiles = selectedFiles.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} exceeds 10MB limit`);
        return false;
      }
      return true;
    }).slice(0, 5);

    setFiles((prev) => [...prev, ...validFiles].slice(0, 5));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (submitted && caseNumber) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Case Submitted Successfully
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Your case number:</p>
            <p className="text-2xl font-mono font-bold">{caseNumber}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            You will receive a confirmation email shortly. You can track your case using the case number above.
          </p>
          <Button onClick={() => router.push(`/cases/track/${caseNumber}`)}>
            Track Your Case
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("cases.title", locale)}</CardTitle>
          <CardDescription>{t("cases.description", locale)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">
              {t("cases.type", locale)} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value as CaseType })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder={t("cases.type", locale)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DISPUTE">{t("cases.dispute", locale)}</SelectItem>
                <SelectItem value="FRAUD_ATO">{t("cases.fraud", locale)}</SelectItem>
                <SelectItem value="OUTAGE_DELAY">{t("cases.outage", locale)}</SelectItem>
                <SelectItem value="COMPLAINT">{t("cases.complaint", locale)}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              {t("cases.descriptionLabel", locale)} <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder={t("cases.descriptionLabel", locale)}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              minLength={10}
              rows={6}
            />
            <p className="text-xs text-muted-foreground">{t("cases.descriptionMinLength", locale)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="impact">{t("cases.impact", locale)}</Label>
            <Textarea
              id="impact"
              placeholder={t("cases.impact", locale)}
              value={formData.impact}
              onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferredResolution">{t("cases.preferredResolution", locale)}</Label>
            <Textarea
              id="preferredResolution"
              placeholder={t("cases.preferredResolution", locale)}
              value={formData.preferredResolution}
              onChange={(e) => setFormData({ ...formData, preferredResolution: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>How we can reach you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="submittedBy">
              Email or Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="submittedBy"
              type="text"
              placeholder="your.email@example.com or Your Name"
              value={formData.submittedBy}
              onChange={(e) => setFormData({ ...formData, submittedBy: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="submittedByEmail">Email (Optional, for notifications)</Label>
            <Input
              id="submittedByEmail"
              type="email"
              placeholder="your.email@example.com"
              value={formData.submittedByEmail}
              onChange={(e) => setFormData({ ...formData, submittedByEmail: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="submittedByName">Full Name (Optional)</Label>
            <Input
              id="submittedByName"
              type="text"
              placeholder="Your Full Name"
              value={formData.submittedByName}
              onChange={(e) => setFormData({ ...formData, submittedByName: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attachments (Optional)</CardTitle>
          <CardDescription>Upload supporting documents (PDF, PNG, JPG, CSV - max 10MB each, up to 5 files)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="files">Files</Label>
            <Input
              id="files"
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.csv"
              onChange={handleFileChange}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Selected files:</p>
              <ul className="space-y-1">
                {files.map((file, index) => (
                  <li key={index} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy Notice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              By submitting this case, you consent to the processing of your personal data for the purpose of case resolution.
              We will:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Store your case information securely</li>
              <li>Use your contact information to communicate about your case</li>
              <li>Retain case data as required by law and our retention policy</li>
              <li>Share case information only with authorized personnel involved in resolution</li>
            </ul>
            <p>
              You have the right to access, correct, or delete your personal data. For more information, see our Privacy Policy.
            </p>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="consent"
              checked={formData.consent}
              onCheckedChange={(checked) => setFormData({ ...formData, consent: checked === true })}
              required
            />
            <Label htmlFor="consent" className="text-sm font-normal cursor-pointer">
              I have read and accept the privacy notice <span className="text-red-500">*</span>
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="submit" disabled={loading} size="lg">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Case"
          )}
        </Button>
      </div>
    </form>
  );
}
