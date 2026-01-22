/**
 * API Documentation Generator
 * Generate comprehensive API documentation
 */

import { openAPISpec } from "./openapi";

/**
 * Generate API documentation HTML
 */
export function generateAPIDocumentationHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Holdwall POS API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css">
  <style>
    body { margin: 0; }
    #swagger-ui { padding: 20px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/openapi.json',
      dom_id: '#swagger-ui',
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.presets.standalone
      ],
      layout: "StandaloneLayout"
    });
  </script>
</body>
</html>
  `.trim();
}

/**
 * Generate API usage examples
 */
export function generateAPIExamples(): Record<string, string> {
  return {
    "Search Claims": `
curl -X GET "https://api.holdwall.com/api/claims?cluster_id=cluster-123" \\
  -H "Authorization: Bearer YOUR_TOKEN"
    `.trim(),
    "Create Claim": `
curl -X POST "https://api.holdwall.com/api/claims" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "canonicalText": "Example claim",
    "variants": ["Variant 1", "Variant 2"],
    "evidenceIds": ["evidence-1", "evidence-2"]
  }'
    `.trim(),
    "Global Search": `
curl -X GET "https://api.holdwall.com/api/search?q=climate+change" \\
  -H "Authorization: Bearer YOUR_TOKEN"
    `.trim(),
    "Get Metrics": `
curl -X GET "https://api.holdwall.com/api/metrics?format=json" \\
  -H "Authorization: Bearer YOUR_TOKEN"
    `.trim(),
  };
}
