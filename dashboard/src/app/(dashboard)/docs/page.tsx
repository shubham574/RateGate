'use client';

import React, { useState } from 'react';
import { Book, Code, Terminal, Server, ArrowRight, Check, ShieldAlert, Webhook, Activity, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<'node' | 'curl' | 'python' | 'nextjs'>('node');
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeSnippets = {
    curl: `curl -X POST https://api.rategate.dev/v1/notify \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "EMAIL",
    "recipient": "user@example.com",
    "templateName": "welcome-email",
    "variables": { "firstName": "Alice" },
    "idempotencyKey": "req_12345"
  }'

# Alternative: Sending raw body instead of a template
# curl -X POST https://api.rategate.dev/v1/notify \\
#  -H "Authorization: Bearer YOUR_API_KEY" \\
#  -H "Content-Type: application/json" \\
#  -d '{"channel": "EMAIL", "recipient": "user@example.com", "subject": "Hello", "body": "Raw HTML body here"}'`,
    node: `const response = await fetch('https://api.rategate.dev/v1/notify', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    channel: 'EMAIL',
    recipient: 'user@example.com',
    templateName: 'welcome-email',
    variables: { firstName: 'Alice' },
    idempotencyKey: 'req_12345'
  })
});

// Alternative raw body:
// body: JSON.stringify({ channel: 'EMAIL', recipient: 'user@example.com', subject: 'Hello', body: 'Raw HTML' })

if (response.status === 429) {
  const error = await response.json();
  console.error(\`Rate limited by scope: \${error.scope}, retry after \${error.retryAfterSecs}s\`);
} else if (response.status === 202) {
  const data = await response.json();
  console.log(\`Queued: \${data.id}\`);
}`,
    python: `import requests

url = "https://api.rategate.dev/v1/notify"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
payload = {
    "channel": "EMAIL",
    "recipient": "user@example.com",
    "templateName": "welcome-email",
    "variables": { "firstName": "Alice" },
    "idempotencyKey": "req_12345"
}

# Alternative raw body:
# payload = { "channel": "EMAIL", "recipient": "user@example.com", "subject": "Hello", "body": "Raw HTML" }

response = requests.post(url, json=payload, headers=headers)

if response.status_code == 429:
    error = response.json()
    print(f"Rate limited by {error.get('scope')}, retry after {error.get('retryAfterSecs')}s")
elif response.status_code == 202:
    print(f"Queued: {response.json().get('id')}")`,
    nextjs: `'use server';

export async function sendNotificationAction(email: string, name: string) {
  const response = await fetch('https://api.rategate.dev/v1/notify', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${process.env.RATEGATE_API_KEY}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: 'EMAIL',
      recipient: email,
      templateName: 'welcome-email',
      variables: { firstName: name },
      idempotencyKey: \`signup-\${email}\`
    })
  });

  if (!response.ok) {
    if (response.status === 429) {
      const { retryAfterSecs } = await response.json();
      return { error: \`Please try again in \${retryAfterSecs} seconds.\` };
    }
    return { error: 'Failed to send notification.' };
  }

  return { success: true };
}`
  };

  return (
    <div className="flex flex-col md:flex-row gap-12 max-w-7xl mx-auto p-8 pb-24 relative items-start">
      <aside className="w-56 shrink-0 hidden md:block sticky top-24">
        <h3 className="font-semibold mb-4 text-gray-900">On this page</h3>
        <ul className="space-y-2.5 text-sm text-gray-600">
          <li><a href="#setup" className="hover:text-primary transition-colors">Base URL & Setup</a></li>
          <li><a href="#authentication" className="hover:text-primary transition-colors">Authentication</a></li>
          <li><a href="#rate-limiting" className="hover:text-primary transition-colors">Rate Limiting</a></li>
          <li><a href="#notifications" className="hover:text-primary transition-colors">Notifications</a></li>
          <li><a href="#rate-limit-rules" className="hover:text-primary transition-colors">Rate Limit Rules</a></li>
          <li><a href="#usage-settings" className="hover:text-primary transition-colors">Usage & Settings</a></li>
          <li><a href="#webhooks" className="hover:text-primary transition-colors">Webhooks</a></li>
          <li><a href="#integration" className="hover:text-primary transition-colors">Integration Boilerplate</a></li>
          <li><a href="#errors" className="hover:text-primary transition-colors">Error Handling</a></li>
        </ul>
      </aside>

      <main className="flex-1 min-w-0 space-y-16">
        <header className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
            <Book className="h-8 w-8 text-primary" />
            API Documentation
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Integrate the RateGate Multi-tenant Notification API into your application. 
            Send emails and SMS flawlessly without worrying about rate limits.
          </p>
        </header>

        <section id="setup" className="space-y-6 scroll-mt-24">
          <h2 className="text-2xl font-bold border-b pb-2">Base URL & Setup</h2>
          <p className="text-gray-600">
            To integrate RateGate into a separate consumer project, add the live RateGate API URL into your consumer project's environment variables.
          </p>
          <div className="bg-gray-100 p-4 rounded-md border text-sm font-mono flex flex-col gap-2">
             <div>
               <span className="text-gray-500 mr-2"># In your consumer project's .env file</span>
             </div>
             <div>RATEGATE_API_URL=<span className="text-primary font-bold">https://api.rategate.dev</span></div>
          </div>
          <p className="text-gray-600">
            All endpoints you use will be prefixed with this base URL.
          </p>
        </section>

        <section id="authentication" className="space-y-6 scroll-mt-24">
          <h2 className="text-2xl font-bold border-b pb-2">Authentication</h2>
          <p className="text-gray-600">
            All API requests require your tenant API key to be passed in the <code className="bg-gray-100 px-1 rounded">Authorization</code> header as a Bearer token.
            You can generate and revoke API keys from your <a href="/api-keys" className="text-primary hover:underline font-medium">API Keys</a> dashboard.
          </p>
          <div className="bg-gray-100 p-4 rounded-md border text-sm font-mono flex items-center">
            <span className="text-gray-500 mr-4">Header</span>
            <span className="text-gray-900 leading-none">Authorization: Bearer <span className="text-primary">YOUR_API_KEY</span></span>
          </div>
        </section>

        <section id="rate-limiting" className="space-y-6 scroll-mt-24">
          <h2 className="text-2xl font-bold border-b pb-2 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-500" />
            Rate Limiting
          </h2>
          <p className="text-gray-600">
            RateGate's core feature is dynamic, hierarchical rate limiting. Every notification request is checked against up to three Rate Limit Rules before being accepted.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className="border rounded-lg p-4 bg-white shadow-sm">
              <h4 className="font-bold text-gray-900 mb-1">API_KEY Scope</h4>
              <p className="text-sm text-gray-600">Protects your global tenant throughput across all channels and users.</p>
            </div>
            <div className="border rounded-lg p-4 bg-white shadow-sm">
              <h4 className="font-bold text-gray-900 mb-1">RECIPIENT Scope</h4>
              <p className="text-sm text-gray-600">Protects individual users from being spammed on a specific channel.</p>
            </div>
            <div className="border rounded-lg p-4 bg-white shadow-sm">
              <h4 className="font-bold text-gray-900 mb-1">TEMPLATE Scope</h4>
              <p className="text-sm text-gray-600">Limits high-risk workflows like OTP verification or password resets.</p>
            </div>
          </div>
          <p className="text-gray-600">
            <strong>The Hierarchy:</strong> A single request is checked against all applicable scopes. The tightest scope takes precedence. If a <code className="bg-gray-100 px-1 rounded">TEMPLATE</code> rule blocks a request, your global <code className="bg-gray-100 px-1 rounded">API_KEY</code> quota is <em>not</em> consumed.
          </p>
          <p className="text-gray-600">
            When a limit is exceeded, RateGate responds with a <code className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded font-mono font-medium text-sm">429 Too Many Requests</code> status code. The response includes the exact scope that triggered the rejection and a <code className="bg-gray-100 px-1 rounded font-mono text-sm">retryAfterSecs</code> indicating when to try again.
          </p>
        </section>

        <section id="notifications" className="space-y-12 scroll-mt-24">
          <h2 className="text-2xl font-bold border-b pb-2">Notifications</h2>

          {/* POST /v1/notify */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-md text-sm">POST</span>
              <code className="text-gray-800 bg-gray-100 px-2 py-1 rounded font-mono font-medium text-base">/v1/notify</code>
            </div>
            <p className="text-gray-600">Submits a new notification to the queue. Limits are evaluated before acceptance.</p>

            <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-blue-800 mb-2">Template vs. Raw Body</h4>
              <p className="text-sm text-blue-900">
                You must provide either <code className="bg-white/60 px-1 rounded">templateName</code> (to use a pre-created template with variable substitution) OR <code className="bg-white/60 px-1 rounded">body</code> (to send raw content directly). You cannot provide both, and at least one is required.
              </p>
            </div>

            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b font-medium text-gray-700 text-sm">Request Body</div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="px-4 py-3 text-sm font-medium text-gray-500 w-40">Field</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-500 w-24">Type</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-500 w-24">Required</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-500">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm text-gray-700">
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">channel</td>
                    <td className="px-4 py-3">string</td>
                    <td className="px-4 py-3 font-medium text-green-600">Yes</td>
                    <td className="px-4 py-3 border-l text-gray-600">Enum: <code className="bg-gray-100 px-1 rounded">EMAIL</code> or <code className="bg-gray-100 px-1 rounded">SMS</code></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">recipient</td>
                    <td className="px-4 py-3">string</td>
                    <td className="px-4 py-3 font-medium text-green-600">Yes</td>
                    <td className="px-4 py-3 border-l text-gray-600">Email address or Phone number with country code.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">templateName</td>
                    <td className="px-4 py-3">string</td>
                    <td className="px-4 py-3 text-gray-500">Cond</td>
                    <td className="px-4 py-3 border-l text-gray-600">Name of template. Requires existing template on tenant.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">body</td>
                    <td className="px-4 py-3">string</td>
                    <td className="px-4 py-3 text-gray-500">Cond</td>
                    <td className="px-4 py-3 border-l text-gray-600">Raw notification body. Used if <code className="bg-gray-100 px-1 rounded">templateName</code> is omitted.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">subject</td>
                    <td className="px-4 py-3">string</td>
                    <td className="px-4 py-3 text-gray-500">No</td>
                    <td className="px-4 py-3 border-l text-gray-600">Required if channel is EMAIL and no template is used.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">variables</td>
                    <td className="px-4 py-3">object</td>
                    <td className="px-4 py-3 text-gray-500">No</td>
                    <td className="px-4 py-3 border-l text-gray-600">Key-value pairs to replace <code className="bg-gray-100 px-1 rounded">{`{{key}}`}</code> in templates.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">idempotencyKey</td>
                    <td className="px-4 py-3">string</td>
                    <td className="px-4 py-3 text-gray-500">No</td>
                    <td className="px-4 py-3 border-l text-gray-600">UUID or stable identifier to prevent duplicate sends on retries.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 border rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-2">Idempotency</h4>
              <p className="text-sm text-gray-600">
                It's strongly recommended to provide an <code className="bg-gray-200 px-1 rounded">idempotencyKey</code> tied to your business logic (e.g., <code className="bg-gray-200 px-1 rounded">signup-user_123</code>). If a network failure occurs and you retry the request with the same key, RateGate will safely return the original notification status (HTTP 200) instead of double-sending.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Response Examples</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                  <div className="text-xs font-semibold text-green-400 mb-2">202 Accepted (New)</div>
                  <pre className="text-sm font-mono text-gray-300"><code>{`{
  "id": "uuid-here",
  "status": "queued"
}`}</code></pre>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                  <div className="text-xs font-semibold text-blue-400 mb-2">200 OK (Idempotent Hit)</div>
                  <pre className="text-sm font-mono text-gray-300"><code>{`{
  "id": "uuid-here",
  "status": "queued",
  "message": "Duplicate request — returning existing notification"
}`}</code></pre>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                  <div className="text-xs font-semibold text-orange-400 mb-2">429 Too Many Requests</div>
                  <pre className="text-sm font-mono text-gray-300"><code>{`{
  "error": "rate_limit_exceeded",
  "notificationId": "uuid-here",
  "scope": "RECIPIENT",
  "limit": 5,
  "windowSecs": 3600,
  "retryAfterSecs": 420
}`}</code></pre>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                  <div className="text-xs font-semibold text-red-400 mb-2">404 Not Found</div>
                  <pre className="text-sm font-mono text-gray-300"><code>{`{
  "error": "Template 'welcome-email' not found"
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          {/* GET /v1/notify/:id */}
          <div className="space-y-6 pt-6 border-t">
            <div className="flex items-center gap-3">
              <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-md text-sm">GET</span>
              <code className="text-gray-800 bg-gray-100 px-2 py-1 rounded font-mono font-medium text-base">/v1/notify/:id</code>
            </div>
            <p className="text-gray-600">Retrieve the status, timestamps, and error messages for a specific notification.</p>
            <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
              <div className="text-xs font-semibold text-green-400 mb-2">200 OK</div>
              <pre className="text-sm font-mono text-gray-300"><code>{`{
  "id": "uuid-here",
  "channel": "EMAIL",
  "recipient": "user@example.com",
  "status": "DELIVERED",
  "rateLimited": false,
  "templateId": "uuid-here",
  "providerMsgId": "msg_1234",
  "errorMessage": null,
  "createdAt": "2026-07-23T10:00:00Z",
  "updatedAt": "2026-07-23T10:00:02Z",
  "deliveredAt": "2026-07-23T10:00:02Z"
}`}</code></pre>
            </div>
          </div>

          {/* GET /v1/notifications */}
          <div className="space-y-6 pt-6 border-t">
            <div className="flex items-center gap-3">
              <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-md text-sm">GET</span>
              <code className="text-gray-800 bg-gray-100 px-2 py-1 rounded font-mono font-medium text-base">/v1/notifications</code>
            </div>
            <p className="text-gray-600">List and filter notifications with cursor-based pagination.</p>
            
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b font-medium text-gray-700 text-sm">Query Parameters</div>
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y text-sm text-gray-700">
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary w-40">status</td>
                    <td className="px-4 py-3 text-gray-600">QUEUED, SENT, DELIVERED, FAILED, RATE_LIMITED</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">channel</td>
                    <td className="px-4 py-3 text-gray-600">EMAIL, SMS</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">startDate / endDate</td>
                    <td className="px-4 py-3 text-gray-600">ISO-8601 date strings for filtering.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">limit</td>
                    <td className="px-4 py-3 text-gray-600">Results per page (1-100, default 25).</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">cursor</td>
                    <td className="px-4 py-3 text-gray-600">The notification ID to paginate after.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="rate-limit-rules" className="space-y-12 scroll-mt-24">
          <h2 className="text-2xl font-bold border-b pb-2">Rate Limit Rules</h2>
          <p className="text-gray-600">Manage the dynamic limits applied to your tenant. Changes take effect immediately.</p>
          
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-md text-sm">POST</span>
              <code className="text-gray-800 bg-gray-100 px-2 py-1 rounded font-mono font-medium text-base">/v1/rate-limit-rules</code>
            </div>
            
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b font-medium text-gray-700 text-sm">Request Body</div>
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y text-sm text-gray-700">
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary w-40">scope</td>
                    <td className="px-4 py-3 text-gray-600">Required. API_KEY, RECIPIENT, or TEMPLATE.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">windowSecs</td>
                    <td className="px-4 py-3 text-gray-600">Required. Time window in seconds.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">maxRequests</td>
                    <td className="px-4 py-3 text-gray-600">Required. Maximum requests allowed.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">channel</td>
                    <td className="px-4 py-3 text-gray-600">Optional. EMAIL or SMS. Null applies to all.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">strategy</td>
                    <td className="px-4 py-3 text-gray-600">Optional. Default: SLIDING_WINDOW.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-md text-sm">GET</span>
                <code className="text-gray-800 bg-gray-100 px-2 py-1 rounded font-mono text-sm">/v1/rate-limit-rules</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded-md text-sm">PATCH</span>
                <code className="text-gray-800 bg-gray-100 px-2 py-1 rounded font-mono text-sm">/v1/rate-limit-rules/:id</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded-md text-sm">DELETE</span>
                <code className="text-gray-800 bg-gray-100 px-2 py-1 rounded font-mono text-sm">/v1/rate-limit-rules/:id</code>
              </div>
            </div>
            <p className="text-gray-600 text-sm">Standard REST endpoints for listing, updating, and removing rules.</p>
          </div>
        </section>

        <section id="usage-settings" className="space-y-12 scroll-mt-24">
          <h2 className="text-2xl font-bold border-b pb-2">Usage & Settings</h2>
          
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-md text-sm">GET</span>
              <code className="text-gray-800 bg-gray-100 px-2 py-1 rounded font-mono font-medium text-base">/v1/usage</code>
            </div>
            <p className="text-gray-600">Returns your current billing period usage grouped by channel, along with a 6-month history.</p>
          </div>

          <div className="space-y-6 pt-6 border-t">
            <div className="flex items-center gap-3">
              <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded-md text-sm">PATCH</span>
              <code className="text-gray-800 bg-gray-100 px-2 py-1 rounded font-mono font-medium text-base">/v1/tenant</code>
            </div>
            <p className="text-gray-600">Update tenant configuration, such as setting your webhook URL.</p>
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b font-medium text-gray-700 text-sm">Request Body</div>
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y text-sm text-gray-700">
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary w-40">name</td>
                    <td className="px-4 py-3 text-gray-600">Optional. Update your organization name.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-primary">webhookUrl</td>
                    <td className="px-4 py-3 text-gray-600">Optional. Valid HTTPs URL for callbacks.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="webhooks" className="space-y-12 scroll-mt-24">
          <h2 className="text-2xl font-bold border-b pb-2 flex items-center gap-2">
            <Webhook className="h-5 w-5 text-purple-500" />
            Webhooks (Real-Time Delivery)
          </h2>
          <p className="text-gray-600">
            Configure a Webhook URL in your Settings. RateGate will send a signed <code className="bg-gray-100 px-1 rounded font-mono">POST</code> request to your backend whenever a notification transitions to <code className="bg-gray-100 px-1 rounded font-mono">SENT</code>, <code className="bg-gray-100 px-1 rounded font-mono">DELIVERED</code>, <code className="bg-gray-100 px-1 rounded font-mono">FAILED</code>, or <code className="bg-gray-100 px-1 rounded font-mono">RATE_LIMITED</code>.
          </p>
          <p className="text-gray-600 text-sm bg-purple-50/50 p-4 border border-purple-100 rounded-md">
            <strong>Security:</strong> Payloads include an <code className="bg-white/60 px-1 rounded font-mono">X-RateGate-Signature</code> header. Use your Webhook Secret (visible once during generation in the dashboard) to compute the HMAC-SHA256 signature of the raw request body and compare.
          </p>

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-md text-sm">GET</span>
              <code className="text-gray-800 bg-gray-100 px-2 py-1 rounded font-mono font-medium text-base">/v1/webhooks/deliveries</code>
            </div>
            <p className="text-gray-600">Retrieve logs of webhook delivery attempts, useful for debugging failures on your receiver endpoint.</p>
          </div>
          
          <div className="space-y-6 pt-6 border-t">
            <div className="flex items-center gap-3">
              <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-md text-sm">POST</span>
              <code className="text-gray-800 bg-gray-100 px-2 py-1 rounded font-mono font-medium text-base">/v1/webhooks/test</code>
              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold ml-auto border">Dashboard Auth Only</span>
            </div>
            <p className="text-gray-600 text-sm">
              Triggers a test webhook to your configured endpoint. Note: This endpoint is strictly for dashboard UI use and relies on Clerk authentication. It is not accessible via standard API keys.
            </p>
          </div>
        </section>

        <section id="integration" className="space-y-6 pt-6 scroll-mt-24">
          <h2 className="text-2xl font-bold border-b pb-2 flex items-center gap-2">
            <Code className="h-5 w-5" />
            Integration Boilerplate
          </h2>
          
          <div className="bg-gray-900 rounded-xl overflow-hidden shadow-xl ring-1 ring-gray-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 gap-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab('node')}
                  className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === 'node' ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
                >
                  Node.js (Fetch)
                </button>
                <button
                  onClick={() => setActiveTab('nextjs')}
                  className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === 'nextjs' ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
                >
                  Next.js Action
                </button>
                <button
                  onClick={() => setActiveTab('python')}
                  className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === 'python' ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
                >
                  Python
                </button>
                <button
                  onClick={() => setActiveTab('curl')}
                  className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors", activeTab === 'curl' ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white")}
                >
                  cURL
                </button>
              </div>
              
              <button 
                onClick={() => copyToClipboard(codeSnippets[activeTab])}
                className="text-gray-400 hover:text-white transition-colors p-1"
                title="Copy to clipboard"
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <div className="text-xs border border-gray-600 px-2 py-1 rounded hover:bg-gray-700">Copy</div>}
              </button>
            </div>
            
            <div className="p-4 overflow-x-auto">
              <pre className="text-sm font-mono text-gray-300 leading-relaxed">
                <code>{codeSnippets[activeTab]}</code>
              </pre>
            </div>
          </div>
        </section>

        <section id="errors" className="space-y-6 pt-6 scroll-mt-24">
          <h2 className="text-2xl font-bold border-b pb-2 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Error Handling
          </h2>
          <p className="text-gray-600">
            RateGate uses standard HTTP status codes to indicate the success or failure of an API request. Errors are always returned as a JSON object containing an <code className="bg-gray-100 px-1 rounded font-mono">error</code> string and optionally a <code className="bg-gray-100 px-1 rounded font-mono">message</code>.
          </p>

          <div className="bg-white border rounded-lg shadow-sm overflow-hidden mt-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className="px-4 py-3 text-sm font-medium text-gray-500 w-24">Code</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm text-gray-700">
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">400</td>
                  <td className="px-4 py-3 text-gray-600"><strong>Bad Request:</strong> Validation error (e.g., missing required fields, mismatched channels).</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">401</td>
                  <td className="px-4 py-3 text-gray-600"><strong>Unauthorized:</strong> Missing, revoked, or invalid API key.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">404</td>
                  <td className="px-4 py-3 text-gray-600"><strong>Not Found:</strong> Resource does not exist (e.g., requesting an unknown template or notification ID).</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">429</td>
                  <td className="px-4 py-3 text-gray-600"><strong>Too Many Requests:</strong> Rate limit exceeded. Returns <code className="bg-gray-100 px-1 rounded font-mono text-xs">retryAfterSecs</code>.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">500</td>
                  <td className="px-4 py-3 text-gray-600"><strong>Internal Error:</strong> An unexpected issue occurred on RateGate servers.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        
        <div className="mt-16 pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <div>RateGate APIDoc v2.0.0</div>
          <a href="/api-keys" className="flex items-center gap-1 hover:text-primary transition-colors">
            Go to API Keys <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </main>
    </div>
  );
}
